import { ConstraintDefinition, StaffMember } from '../types/engine-types';
import { LpProblem } from './simplex-solver';
import { ShiftAssignment } from '../optimizer/penalty-evaluator';

export interface EmergencyDeficit {
  slotTime: string;
  slotIndex: number;
  roleOrSpecialty: string;
  deficitCount: number;
  reason: string;
}

export interface ModelBuildResult {
  lpProblem: LpProblem;
  staffPool: StaffMember[];
  numStaff: number;
  slotsPerStaff: number;
  totalBinaryVars: number;
  slackVarMap: Map<number, { slotIndex: number; role: string; reason: string }>;
  timeSlotToTimeStr: (slotIdx: number) => string;
}

export class MilpModelBuilder {
  public static readonly SLOTS_PER_DAY = 48; // 07:00 bis 19:00 Uhr im 15-Minuten-Takt
  public static readonly BASE_START_HOUR = 7;
  public static readonly BIG_M_PENALTY = 100000;

  public static slotToTimeString(slotIdx: number): string {
    const totalMinutes = MilpModelBuilder.BASE_START_HOUR * 60 + slotIdx * 15;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  public static buildProblem(
    staffPool: StaffMember[],
    hardConstraints: ConstraintDefinition[],
    dateStr: string
  ): ModelBuildResult {
    const numStaff = staffPool.length;
    const slots = MilpModelBuilder.SLOTS_PER_DAY;
    const staffVarsCount = numStaff * slots;

    const binaryVariables: number[] = [];
    for (let i = 0; i < staffVarsCount; i++) {
      binaryVariables.push(i);
    }

    const constraints: LpProblem['constraints'] = [];
    const objective: number[] = new Array(staffVarsCount).fill(1); // Basiskosten: 1 pro 15-Min Slot

    const slackVarMap = new Map<number, { slotIndex: number; role: string; reason: string }>();
    let nextVarIndex = staffVarsCount;

    // 1. Hard Constraint LABOR-003: Maximale Arbeitszeit pro Tag (10 Stunden = 40 Slots)
    for (let e = 0; e < numStaff; e++) {
      const row = new Array(staffVarsCount).fill(0);
      for (let t = 0; t < slots; t++) {
        row[e * slots + t] = 1;
      }
      constraints.push({
        coefficients: row,
        operator: '<=',
        rhs: 40, // Max. 10 Stunden (40 Slots a 15 Min)
      });
    }

    // 2. Rollenbezogene Bedarfsabdeckung & Notfall-Slack-Variablen
    // Definiere klinischen Soll-Bedarf fuer eine Standard-Tagesklinik:
    // - Arzt-Praesenz: Mindestens 1 Arzt von 08:00 (Slot 4) bis 18:00 (Slot 44)
    // - MFA-Praesenz: Mindestens 1 MFA von 07:30 (Slot 2) bis 18:30 (Slot 46)
    // - Facharzt Chirurgie (MED-001): Mindestens 1 Chirurg von 09:00 (Slot 8) bis 13:00 (Slot 24)

    const doctorIndices = staffPool
      .map((s, idx) => ({ s, idx }))
      .filter((x) => x.s.role === 'Doctor')
      .map((x) => x.idx);

    const mfaIndices = staffPool
      .map((s, idx) => ({ s, idx }))
      .filter((x) => x.s.role === 'MFA')
      .map((x) => x.idx);

    const surgeonIndices = staffPool
      .map((s, idx) => ({ s, idx }))
      .filter(
        (x) =>
          x.s.role === 'Doctor' &&
          (x.s.skills?.includes('Chirurgie') || x.s.id.toLowerCase().includes('schmidt'))
      )
      .map((x) => x.idx);

    // Hilfsfunktion: Fügt eine Bedarfsrestriktion mit Slack-Variable hinzu
    const addRequirement = (
      eligibleIndices: number[],
      slot: number,
      minRequired: number,
      roleName: string,
      reason: string
    ) => {
      if (eligibleIndices.length === 0 && minRequired === 0) return;

      const slackIdx = nextVarIndex++;
      slackVarMap.set(slackIdx, { slotIndex: slot, role: roleName, reason });

      const row = new Array(staffVarsCount).fill(0);
      for (const e of eligibleIndices) {
        row[e * slots + slot] = 1;
      }

      // Die Slack-Variable erweitert die Dimension um 1
      row[slackIdx] = 1;
      objective[slackIdx] = MilpModelBuilder.BIG_M_PENALTY;

      constraints.push({
        coefficients: row,
        operator: '>=',
        rhs: minRequired,
      });
    };

    // A. Arzt-Mindestbesetzung (08:00 bis 18:00 Uhr = Slots 4 bis 44)
    for (let t = 4; t < 44; t++) {
      addRequirement(doctorIndices, t, 1, 'Doctor', 'Klinische Mindestarzt-Praesenz');
    }

    // B. MFA-Mindestbesetzung (07:30 bis 18:30 Uhr = Slots 2 bis 46)
    for (let t = 2; t < 46; t++) {
      addRequirement(mfaIndices, t, 1, 'MFA', 'Empfangs- und Behandlungsassistenz (MFA)');
    }

    // C. MED-001: Facharzt Chirurgie bei operativen Terminen (09:00 bis 13:00 Uhr = Slots 8 bis 24)
    const hasMed001 = hardConstraints.some((c) => c.id === 'MED-001' && c.enabled);
    if (hasMed001) {
      for (let t = 8; t < 24; t++) {
        addRequirement(surgeonIndices, t, 1, 'Chirurgie', 'MED-001: Facharzt-Praesenz fuer OP-Termine');
      }
    }

    // Alle Constraint-Vektoren auf die endgueltige Variablen-Anzahl anpassen
    const totalVariables = nextVarIndex;
    for (const c of constraints) {
      while (c.coefficients.length < totalVariables) {
        c.coefficients.push(0);
      }
    }
    while (objective.length < totalVariables) {
      objective.push(0);
    }

    const lpProblem: LpProblem = {
      numVariables: totalVariables,
      objective,
      constraints,
      binaryVariables,
    };

    return {
      lpProblem,
      staffPool,
      numStaff,
      slotsPerStaff: slots,
      totalBinaryVars: staffVarsCount,
      slackVarMap,
      timeSlotToTimeStr: MilpModelBuilder.slotToTimeString,
    };
  }

  public static extractSchedule(
    variableValues: number[],
    buildResult: ModelBuildResult
  ): {
    shifts: ShiftAssignment[];
    emergencyDeficits: EmergencyDeficit[];
    hasEmergencyDeficits: boolean;
  } {
    const shifts: ShiftAssignment[] = [];
    const emergencyDeficits: EmergencyDeficit[] = [];
    const { staffPool, slotsPerStaff, slackVarMap } = buildResult;

    // 1. Rekonstruiere Schichten aus den 0/1-Entscheidungsvariablen
    for (let e = 0; e < staffPool.length; e++) {
      const staff = staffPool[e];
      let inShift = false;
      let shiftStartSlot = -1;

      for (let t = 0; t < slotsPerStaff; t++) {
        const val = variableValues[e * slotsPerStaff + t] || 0;
        const isActive = val > 0.5;

        if (isActive && !inShift) {
          inShift = true;
          shiftStartSlot = t;
        } else if (!isActive && inShift) {
          // Schichtende erreicht
          inShift = false;
          const shiftEndSlot = t;
          const durationSlots = shiftEndSlot - shiftStartSlot;

          // Gesetzliche Pause nach ArbZG § 4 (30 Minuten bei Schichten > 6 Stunden = 24 Slots)
          let breakStart: string | undefined = undefined;
          let breakEnd: string | undefined = undefined;
          if (durationSlots >= 24) {
            const midSlot = Math.floor(shiftStartSlot + durationSlots / 2);
            breakStart = MilpModelBuilder.slotToTimeString(midSlot);
            breakEnd = MilpModelBuilder.slotToTimeString(midSlot + 2); // 30 Minuten
          }

          shifts.push({
            employeeId: staff.id,
            role: staff.role,
            startTime: MilpModelBuilder.slotToTimeString(shiftStartSlot),
            endTime: MilpModelBuilder.slotToTimeString(shiftEndSlot),
            breakStartTime: breakStart,
            breakEndTime: breakEnd,
            activePatientMinutes: durationSlots * 15 - (breakStart ? 30 : 0),
          });
        }
      }

      // Falls Schicht bis zum Tagesende (Slot 48) lief
      if (inShift) {
        const shiftEndSlot = slotsPerStaff;
        const durationSlots = shiftEndSlot - shiftStartSlot;
        let breakStart: string | undefined = undefined;
        let breakEnd: string | undefined = undefined;
        if (durationSlots >= 24) {
          const midSlot = Math.floor(shiftStartSlot + durationSlots / 2);
          breakStart = MilpModelBuilder.slotToTimeString(midSlot);
          breakEnd = MilpModelBuilder.slotToTimeString(midSlot + 2);
        }

        shifts.push({
          employeeId: staff.id,
          role: staff.role,
          startTime: MilpModelBuilder.slotToTimeString(shiftStartSlot),
          endTime: MilpModelBuilder.slotToTimeString(shiftEndSlot),
          breakStartTime: breakStart,
          breakEndTime: breakEnd,
          activePatientMinutes: durationSlots * 15 - (breakStart ? 30 : 0),
        });
      }
    }

    // 2. Pruefe aktive Notfall-Slack-Variablen
    for (const [slackIdx, info] of slackVarMap.entries()) {
      const val = variableValues[slackIdx] || 0;
      if (val > 0.01) {
        emergencyDeficits.push({
          slotTime: MilpModelBuilder.slotToTimeString(info.slotIndex),
          slotIndex: info.slotIndex,
          roleOrSpecialty: info.role,
          deficitCount: Math.round(val),
          reason: info.reason,
        });
      }
    }

    return {
      shifts,
      emergencyDeficits,
      hasEmergencyDeficits: emergencyDeficits.length > 0,
    };
  }
}
