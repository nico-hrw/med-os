import { ConstraintDefinition } from '../types/engine-types';
import { PenaltyEvaluator, PenaltyViolation, ShiftAssignment } from './penalty-evaluator';

export interface DestroyResult {
  retainedShifts: ShiftAssignment[];
  removedShifts: ShiftAssignment[];
}

export class DestroyOperators {
  public static destroyWorstPenalty(
    shifts: ShiftAssignment[],
    count: number,
    violations: PenaltyViolation[]
  ): DestroyResult {
    const penaltyEmployees = new Set<string>();
    for (const v of violations) {
      if (v.employeeId) penaltyEmployees.add(v.employeeId);
    }

    const removed: ShiftAssignment[] = [];
    const retained: ShiftAssignment[] = [];

    for (const s of shifts) {
      if (removed.length < count && penaltyEmployees.has(s.employeeId)) {
        removed.push(s);
      } else {
        retained.push(s);
      }
    }

    return { retainedShifts: retained, removedShifts: removed };
  }

  public static destroyRandomShifts(
    shifts: ShiftAssignment[],
    count: number
  ): DestroyResult {
    const shuffled = [...shifts].sort(() => Math.random() - 0.5);
    const removed = shuffled.slice(0, count);
    const removedSet = new Set(removed);
    const retained = shifts.filter((s) => !removedSet.has(s));

    return { retainedShifts: retained, removedShifts: removed };
  }

  public static destroyLunchBreaks(shifts: ShiftAssignment[]): ShiftAssignment[] {
    return shifts.map((s) => {
      if (s.role === 'MFA') {
        return { ...s, breakStartTime: undefined, breakEndTime: undefined };
      }
      return { ...s };
    });
  }
}

export class RepairOperators {
  public static repairStaggeredLunchBreaks(shifts: ShiftAssignment[]): ShiftAssignment[] {
    const breakSlots = [
      { start: '12:00', end: '12:30' },
      { start: '12:30', end: '13:00' },
      { start: '13:00', end: '13:30' },
      { start: '13:30', end: '14:00' },
    ];

    let slotIdx = 0;
    return shifts.map((s) => {
      if (s.role === 'MFA') {
        const slot = breakSlots[slotIdx % breakSlots.length];
        slotIdx++;
        return {
          ...s,
          breakStartTime: slot.start,
          breakEndTime: slot.end,
        };
      }
      return { ...s };
    });
  }

  public static repairConsolidateSplitShifts(shifts: ShiftAssignment[]): ShiftAssignment[] {
    const byEmp = new Map<string, ShiftAssignment[]>();
    for (const s of shifts) {
      const list = byEmp.get(s.employeeId) || [];
      list.push(s);
      byEmp.set(s.employeeId, list);
    }

    const consolidated: ShiftAssignment[] = [];

    for (const [, empShifts] of byEmp.entries()) {
      if (empShifts.length > 1) {
        empShifts.sort((a, b) => PenaltyEvaluator.timeToMinutes(a.startTime) - PenaltyEvaluator.timeToMinutes(b.startTime));
        const first = empShifts[0];
        const last = empShifts[empShifts.length - 1];

        // Konsolidiere zu einer einzigen Schicht mit Pause dazwischen
        consolidated.push({
          ...first,
          endTime: last.endTime,
          breakStartTime: first.endTime,
          breakEndTime: last.startTime,
          activePatientMinutes: empShifts.reduce((acc, s) => acc + (s.activePatientMinutes || 0), 0),
        });
      } else {
        consolidated.push(...empShifts);
      }
    }

    return consolidated;
  }

  public static repairGreedyBestFit(
    currentShifts: ShiftAssignment[],
    removedShifts: ShiftAssignment[],
    constraints: ConstraintDefinition[],
    evaluator: PenaltyEvaluator
  ): ShiftAssignment[] {
    const result = [...currentShifts];

    for (const toInsert of removedShifts) {
      // Teste alternative Zeitfenster
      const candidateStarts = ['08:00', '08:30', '09:00', '07:30'];
      let bestShift = toInsert;
      let lowestPenalty = Infinity;

      for (const startStr of candidateStarts) {
        const duration = PenaltyEvaluator.timeToMinutes(toInsert.endTime) - PenaltyEvaluator.timeToMinutes(toInsert.startTime);
        const endMinutes = PenaltyEvaluator.timeToMinutes(startStr) + duration;
        const endStr = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        const testShift: ShiftAssignment = {
          ...toInsert,
          startTime: startStr,
          endTime: endStr,
        };

        const testSchedule = [...result, testShift];
        const evalRes = evaluator.evaluateSchedule(testSchedule, constraints);

        if (evalRes.isHardLegal && evalRes.totalPenalty < lowestPenalty) {
          lowestPenalty = evalRes.totalPenalty;
          bestShift = testShift;
        }
      }

      result.push(bestShift);
    }

    return result;
  }
}
