import { ConstraintDefinition } from '../types/engine-types';
import { DestroyOperators, RepairOperators } from './destroy-repair';
import { PenaltyEvaluator, PenaltyViolation, ShiftAssignment } from './penalty-evaluator';

export interface AlnsOptions {
  maxIterations?: number;
  initialTemperature?: number;
  coolingRate?: number;
}

export interface OptimizationResult {
  initialPenalty: number;
  optimizedPenalty: number;
  improvementPercent: number;
  bestShifts: ShiftAssignment[];
  remainingViolations: PenaltyViolation[];
  iterationsRun: number;
  executionTimeMs: number;
  operatorUsage: Record<string, number>;
}

export class AlnsOptimizer {
  private evaluator = new PenaltyEvaluator();

  public optimizeSchedule(
    initialShifts: ShiftAssignment[],
    constraints: ConstraintDefinition[],
    options: AlnsOptions = {}
  ): OptimizationResult {
    const startTime = performance.now();
    const maxIterations = options.maxIterations ?? 60;
    const coolingRate = options.coolingRate ?? 0.95;
    let temperature = options.initialTemperature ?? 1000;

    // Initiale Bewertung
    const initialEval = this.evaluator.evaluateSchedule(initialShifts, constraints);
    let bestShifts = [...initialShifts];
    let bestPenalty = initialEval.totalPenalty;
    let currentShifts = [...initialShifts];
    let currentPenalty = bestPenalty;

    const operatorUsage: Record<string, number> = {
      worst_greedy: 0,
      random_greedy: 0,
      stagger_lunch: 0,
      consolidate_split: 0,
    };

    // Hauptschleife der Adaptive Large Neighborhood Search
    for (let iter = 0; iter < maxIterations; iter++) {
      let candidateShifts: ShiftAssignment[];
      const opChoice = Math.random();

      if (opChoice < 0.35) {
        // Operator 1: Worst-Penalty Schichten entfernen und bestmoeglich reparieren
        operatorUsage.worst_greedy++;
        const currentViolations = this.evaluator.evaluateSchedule(currentShifts, constraints).violations;
        const destroyed = DestroyOperators.destroyWorstPenalty(currentShifts, 2, currentViolations);
        candidateShifts = RepairOperators.repairGreedyBestFit(
          destroyed.retainedShifts,
          destroyed.removedShifts,
          constraints,
          this.evaluator
        );
      } else if (opChoice < 0.60) {
        // Operator 2: Zufallszerstoerung fuer breite Erkundung
        operatorUsage.random_greedy++;
        const destroyed = DestroyOperators.destroyRandomShifts(currentShifts, 2);
        candidateShifts = RepairOperators.repairGreedyBestFit(
          destroyed.retainedShifts,
          destroyed.removedShifts,
          constraints,
          this.evaluator
        );
      } else if (opChoice < 0.85) {
        // Operator 3: Gestaffelte Rezeptionspausen reparieren
        operatorUsage.stagger_lunch++;
        const cleared = DestroyOperators.destroyLunchBreaks(currentShifts);
        candidateShifts = RepairOperators.repairStaggeredLunchBreaks(cleared);
      } else {
        // Operator 4: Split-Shifts zusammenfuehren
        operatorUsage.consolidate_split++;
        candidateShifts = RepairOperators.repairConsolidateSplitShifts(currentShifts);
      }

      // Kandidatenloesung bewerten
      const candidateEval = this.evaluator.evaluateSchedule(candidateShifts, constraints);

      // Guard Rail: Niemals Hard Constraints brechen
      if (!candidateEval.isHardLegal) {
        continue;
      }

      // Akzeptanzkriterium (Simulated Annealing)
      const delta = candidateEval.totalPenalty - currentPenalty;
      if (delta < 0) {
        // Bessere Loesung immer akzeptieren
        currentShifts = candidateShifts;
        currentPenalty = candidateEval.totalPenalty;

        if (currentPenalty < bestPenalty) {
          bestShifts = candidateShifts;
          bestPenalty = currentPenalty;
        }
      } else {
        // Schlechtere Loesung probabilistisch akzeptieren (Entkommen aus lokalen Minima)
        const acceptanceProb = Math.exp(-delta / Math.max(1, temperature));
        if (Math.random() < acceptanceProb) {
          currentShifts = candidateShifts;
          currentPenalty = candidateEval.totalPenalty;
        }
      }

      temperature *= coolingRate;
    }

    const finalEval = this.evaluator.evaluateSchedule(bestShifts, constraints);
    const execTime = performance.now() - startTime;
    const improvement = initialEval.totalPenalty > 0
      ? Math.round(((initialEval.totalPenalty - bestPenalty) / initialEval.totalPenalty) * 100)
      : 0;

    return {
      initialPenalty: initialEval.totalPenalty,
      optimizedPenalty: bestPenalty,
      improvementPercent: Math.max(0, improvement),
      bestShifts,
      remainingViolations: finalEval.violations,
      iterationsRun: maxIterations,
      executionTimeMs: parseFloat(execTime.toFixed(2)),
      operatorUsage,
    };
  }
}
