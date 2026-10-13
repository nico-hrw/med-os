import { SolverRequest, SolverResponse } from '../types/engine-types';
import { ExternalMilpClient } from './solver-client';
import { MilpModelBuilder } from './milp-model-builder';
import { SimplexSolver } from './simplex-solver';

export interface NativeControllerOptions {
  solverMode?: 'native' | 'external';
  externalSolverUrl?: string;
  maxSolveTimeMs?: number;
  maxBranchAndBoundNodes?: number;
}

export class NativeMilpController {
  private solverMode: 'native' | 'external';
  private externalClient?: ExternalMilpClient;
  private maxSolveTimeMs: number;
  private maxBranchAndBoundNodes: number;

  constructor(options: NativeControllerOptions = {}) {
    this.solverMode = options.solverMode || 'native';
    this.maxSolveTimeMs = options.maxSolveTimeMs || 500;
    this.maxBranchAndBoundNodes = options.maxBranchAndBoundNodes || 1200;

    if (options.externalSolverUrl) {
      this.externalClient = new ExternalMilpClient(options.externalSolverUrl);
    }
  }

  public setSolverMode(mode: 'native' | 'external'): void {
    this.solverMode = mode;
  }

  public getSolverMode(): 'native' | 'external' {
    return this.solverMode;
  }

  public async solveBaseline(request: SolverRequest): Promise<SolverResponse> {
    const startTime = performance.now();

    // 1. Optionaler Fallback auf externen Microservice, falls explizit konfiguriert
    if (this.solverMode === 'external') {
      if (!this.externalClient) {
        this.externalClient = new ExternalMilpClient('http://localhost:8000');
      }
      try {
        const extResult = await this.externalClient.solveBaseline(request);
        return {
          ...extResult,
          solverMode: 'external',
        };
      } catch (err: any) {
        // Bei Nichterreichbarkeit des externen Dienstes: Automatischer Fallback auf nativen Solver
        console.warn(`[NativeMilpController] Externer Dienst fehlgeschlagen (${err.message}). Wechsle auf nativen TypeScript-Solver.`);
      }
    }

    // 2. Primärer nativer 2-Phasen-Simplex & Branch-and-Bound Solver
    try {
      const buildResult = MilpModelBuilder.buildProblem(
        request.staffPool,
        request.hardConstraints,
        request.startDate
      );

      const solution = await SimplexSolver.solveMilp(buildResult.lpProblem, {
        maxTimeMs: this.maxSolveTimeMs,
        maxNodes: this.maxBranchAndBoundNodes,
      });

      const computationTimeMs = parseFloat((performance.now() - startTime).toFixed(2));

      if (!solution.isFeasible) {
        return {
          isFeasible: false,
          shiftSkeleton: [],
          computationTimeMs,
          error: 'Mathematisch unzulaessig: Keine loesbare Schichtbelegung moeglich.',
          solverMode: 'native',
        };
      }

      const extracted = MilpModelBuilder.extractSchedule(solution.variableValues, buildResult);

      return {
        isFeasible: true,
        shiftSkeleton: extracted.shifts,
        computationTimeMs,
        isEmergencySlack: extracted.hasEmergencyDeficits,
        emergencyDeficits: extracted.emergencyDeficits,
        solverMode: 'native',
      };
    } catch (error: any) {
      const computationTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
      return {
        isFeasible: false,
        shiftSkeleton: [],
        computationTimeMs,
        error: `Interner Berechnungsfehler im nativen MILP-Solver: ${error.message}`,
        solverMode: 'native',
      };
    }
  }
}
