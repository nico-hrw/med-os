import { ConstraintDefinition } from '../types/engine-types';

export interface ShiftAssignment {
  employeeId: string;
  role: string;
  startTime: string;
  endTime: string;
  room?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  activePatientMinutes?: number;
}

export interface PenaltyViolation {
  constraintId: string;
  constraintName: string;
  employeeId?: string;
  penalty: number;
  details: string;
  isHard: boolean;
}

export interface EvaluationResult {
  totalPenalty: number;
  violations: PenaltyViolation[];
  isHardLegal: boolean;
  hardViolationsCount: number;
}

export class PenaltyEvaluator {
  public static timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  public static getNetWorkingMinutes(shift: ShiftAssignment): number {
    const start = PenaltyEvaluator.timeToMinutes(shift.startTime);
    const end = PenaltyEvaluator.timeToMinutes(shift.endTime);
    let gross = Math.max(0, end - start);
    if (shift.breakStartTime && shift.breakEndTime) {
      const bStart = PenaltyEvaluator.timeToMinutes(shift.breakStartTime);
      const bEnd = PenaltyEvaluator.timeToMinutes(shift.breakEndTime);
      const breakDuration = Math.max(0, bEnd - bStart);
      gross = Math.max(0, gross - breakDuration);
    }
    return gross;
  }

  public evaluateSchedule(
    shifts: ShiftAssignment[],
    constraints: ConstraintDefinition[]
  ): EvaluationResult {
    let totalPenalty = 0;
    let isHardLegal = true;
    let hardViolationsCount = 0;
    const violations: PenaltyViolation[] = [];

    const shiftsByEmployee = new Map<string, ShiftAssignment[]>();
    for (const shift of shifts) {
      const list = shiftsByEmployee.get(shift.employeeId) || [];
      list.push(shift);
      shiftsByEmployee.set(shift.employeeId, list);
    }

    // 1. Hard Constraints Pruefung
    for (const [employeeId, empShifts] of shiftsByEmployee.entries()) {
      empShifts.sort((a, b) => PenaltyEvaluator.timeToMinutes(a.startTime) - PenaltyEvaluator.timeToMinutes(b.startTime));

      let dailyNetMinutes = 0;
      for (let i = 0; i < empShifts.length; i++) {
        const s = empShifts[i];
        const start = PenaltyEvaluator.timeToMinutes(s.startTime);
        const end = PenaltyEvaluator.timeToMinutes(s.endTime);
        const grossDuration = end - start;

        // LABOR-002: Mindestschichtdauer >= 240 Min (4 Stunden)
        if (grossDuration < 240) {
          isHardLegal = false;
          hardViolationsCount++;
          violations.push({
            constraintId: 'LABOR-002',
            constraintName: 'Mindestschichtdauer',
            employeeId,
            penalty: 10000,
            details: `Schichtdauer von ${grossDuration} Minuten unterschreitet das Minimum von 240 Minuten.`,
            isHard: true,
          });
        }

        dailyNetMinutes += PenaltyEvaluator.getNetWorkingMinutes(s);

        // LABOR-001: Ruhezeit zwischen Schichten >= 11 Stunden (660 Min)
        if (i > 0) {
          const prevEnd = PenaltyEvaluator.timeToMinutes(empShifts[i - 1].endTime);
          const restMinutes = start - prevEnd;
          if (restMinutes < 660 && restMinutes >= 0) {
            isHardLegal = false;
            hardViolationsCount++;
            violations.push({
              constraintId: 'LABOR-001',
              constraintName: 'Gesetzliche Mindestruhezeit (ArbZG § 5)',
              employeeId,
              penalty: 10000,
              details: `Ruhezeit von ${restMinutes} Minuten unterschreitet 11 Stunden (660 Min).`,
              isHard: true,
            });
          }
        }
      }

      // LABOR-003: Max. 10 Stunden Netto-Arbeitszeit pro Tag (ohne Pausen nach ArbZG § 2)
      if (dailyNetMinutes > 600) {
        isHardLegal = false;
        hardViolationsCount++;
        violations.push({
          constraintId: 'LABOR-003',
          constraintName: 'Maximale Arbeitszeit pro Tag',
          employeeId,
          penalty: 10000,
          details: `Taegliche Netto-Arbeitszeit von ${(dailyNetMinutes / 60).toFixed(1)} Stunden ueberschreitet 10 Stunden.`,
          isHard: true,
        });
      }
    }

    // 2. Soft Constraints Pruefung
    for (const [employeeId, empShifts] of shiftsByEmployee.entries()) {
      // ERG-001: Vermeidung von Split-Shifts
      if (empShifts.length > 1) {
        const erg001 = constraints.find((c) => c.id === 'ERG-001');
        const penaltyScore = erg001?.evaluation_logic.penalty_score ?? 500;
        totalPenalty += penaltyScore;
        violations.push({
          constraintId: 'ERG-001',
          constraintName: 'Vermeidung von geteilten Diensten (Split-Shifts)',
          employeeId,
          penalty: penaltyScore,
          details: `Mitarbeiter hat ${empShifts.length} separate Schichten am selben Tag.`,
          isHard: false,
        });
      }

      // ERG-002: Erschoepfungs-Guard (>80% aktiver Patientenkontakt)
      for (const s of empShifts) {
        const totalDuration = PenaltyEvaluator.getNetWorkingMinutes(s);
        if (s.activePatientMinutes && totalDuration > 0) {
          const ratio = s.activePatientMinutes / totalDuration;
          if (ratio > 0.8) {
            const erg002 = constraints.find((c) => c.id === 'ERG-002');
            const penaltyScore = erg002?.evaluation_logic.penalty_score ?? 300;
            totalPenalty += penaltyScore;
            violations.push({
              constraintId: 'ERG-002',
              constraintName: 'Erschoepfungs-Guard fuer aktiven Patientenkontakt',
              employeeId,
              penalty: penaltyScore,
              details: `Kontakt-Quote von ${Math.round(ratio * 100)}% ueberschreitet 80%.`,
              isHard: false,
            });
          }
        }
      }

      // ECO-001: Ueberstunden-Vermeidung (>8h Netto-Arbeitszeit/Tag = 480 Min)
      let totalDayNetMins = 0;
      for (const s of empShifts) {
        totalDayNetMins += PenaltyEvaluator.getNetWorkingMinutes(s);
      }
      if (totalDayNetMins > 480) {
        const overtimeHours = (totalDayNetMins - 480) / 60;
        const eco001 = constraints.find((c) => c.id === 'ECO-001');
        const basePenalty = eco001?.evaluation_logic.penalty_score ?? 150;
        const penaltyScore = Math.round(overtimeHours * basePenalty);
        totalPenalty += penaltyScore;
        violations.push({
          constraintId: 'ECO-001',
          constraintName: 'Minimierung von Ueberstundenzuschlaegen',
          employeeId,
          penalty: penaltyScore,
          details: `${overtimeHours.toFixed(1)} Ueberstunden ueber der 8h-Regelarbeitszeit.`,
          isHard: false,
        });
      }
    }

    // ERG-003: Gestaffelte Pausenzeiten fuer Rezeption
    const receptionMfaShifts = shifts.filter((s) => s.role === 'MFA');
    const lunchMinutes = [720, 750, 780, 810];
    for (const checkMin of lunchMinutes) {
      let activeMfaCount = 0;
      for (const s of receptionMfaShifts) {
        const start = PenaltyEvaluator.timeToMinutes(s.startTime);
        const end = PenaltyEvaluator.timeToMinutes(s.endTime);
        const breakStart = s.breakStartTime ? PenaltyEvaluator.timeToMinutes(s.breakStartTime) : -1;
        const breakEnd = s.breakEndTime ? PenaltyEvaluator.timeToMinutes(s.breakEndTime) : -1;

        const isWorking = checkMin >= start && checkMin < end;
        const onBreak = checkMin >= breakStart && checkMin < breakEnd;

        if (isWorking && !onBreak) {
          activeMfaCount++;
        }
      }

      if (activeMfaCount === 0) {
        const erg003 = constraints.find((c) => c.id === 'ERG-003');
        const penaltyScore = erg003?.evaluation_logic.penalty_score ?? 200;
        totalPenalty += penaltyScore;
        violations.push({
          constraintId: 'ERG-003',
          constraintName: 'Gestaffelte Pausenzeiten fuer Rezeptionsbesetzung',
          penalty: penaltyScore,
          details: `Rezeption um ${Math.floor(checkMin / 60)}:${String(checkMin % 60).padStart(2, '0')} Uhr nicht besetzt.`,
          isHard: false,
        });
      }
    }

    return {
      totalPenalty,
      violations,
      isHardLegal,
      hardViolationsCount,
    };
  }
}
