import * as fs from 'fs/promises';
import * as path from 'path';
import { IPlugin, PluginContext } from 'medos-core';
import { AuditLogger } from './audit/audit-logger';
import { ConstraintRegistry } from './constraints/constraint-registry';
import { ExternalMilpClient } from './controller/solver-client';
import { AlnsOptimizer } from './optimizer/alns-optimizer';
import { ShiftAssignment } from './optimizer/penalty-evaluator';
import { DemandPredictor } from './predictor/demand-predictor';
import { DigitalTwinSimulator } from './simulator/digital-twin';
import { ShockScenario } from './types/simulation-types';

function sendResponse(res: any, status: number, data: any): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(data);
    return;
  }
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Connection': 'keep-alive',
  });
  res.end(body);
}

function parseBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default class MedOSEnginePlugin implements IPlugin {
  private context?: PluginContext;
  private constraintRegistry!: ConstraintRegistry;
  private solverClient!: ExternalMilpClient;
  private demandPredictor = new DemandPredictor();
  private simulator = new DigitalTwinSimulator();
  private alnsOptimizer = new AlnsOptimizer();
  private auditLogger!: AuditLogger;

  // 1. Offizieller Microkernel Lifecycle-Hook: onLoad
  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    const logger = context.logger || {
      info: (msg: string) => console.log(`[MedOS-Engine] ${msg}`),
      warn: (msg: string) => console.warn(`[MedOS-Engine] ${msg}`),
      error: (msg: string) => console.error(`[MedOS-Engine] ${msg}`),
    };

    logger.info('Initialisiere MedOS Engine v2 Plugin...');

    const db = (context.getService ? context.getService('db') : undefined) || context.db;
    this.constraintRegistry = new ConstraintRegistry(db);
    this.auditLogger = new AuditLogger(db);

    try {
      const candidatePaths: string[] = [
        path.resolve(__dirname, '../config/default-constraints.json'),
        path.resolve(__dirname, '../../config/default-constraints.json'),
        path.resolve(process.cwd(), 'config/default-constraints.json'),
        path.resolve(__dirname, './config/default-constraints.json'),
      ];

      let jsonString = '';
      let loadedPath = '';

      for (const configPath of candidatePaths) {
        try {
          jsonString = await fs.readFile(configPath, 'utf-8');
          loadedPath = configPath;
          break;
        } catch {
          // Naechsten Pfad pruefen
        }
      }

      if (!jsonString) {
        throw new Error('default-constraints.json konnte in keinem konfigurierten Verzeichnis gefunden werden.');
      }

      await this.constraintRegistry.initializeFromDefaults(jsonString);
      logger.info(`Standard-Constraints erfolgreich initialisiert aus: ${loadedPath}`);
    } catch (error: any) {
      logger.error(`Fehler beim Laden der Standard-Constraints: ${error.message}`);
    }

    const solverUrl = (context.config && context.config.get('MILP_SOLVER_URL')) || 'http://localhost:8000';
    this.solverClient = new ExternalMilpClient(solverUrl);
    logger.info(`Externer MILP-Solver-Client initialisiert (${solverUrl})`);

    const register = (
      method: string,
      routePath: string,
      handler: (req: any, res: any) => Promise<void>
    ) => {
      context.registerRoute(`${method} ${routePath}`, handler);
    };

    // Route: Alle Constraints abrufen
    register('GET', '/api/engine/constraints', async (_req, res) => {
      try {
        const constraints = this.constraintRegistry.getAllConstraints();
        sendResponse(res, 200, { success: true, data: constraints });
      } catch (error: any) {
        logger.error(`Fehler beim Abrufen der Constraints: ${error.message}`);
        sendResponse(res, 500, { error: 'Fehler beim Abrufen der Constraints' });
      }
    });

    // Route: Revisionssicheren Audit-Log abrufen
    register('GET', '/api/engine/audit-log', async (req, res) => {
      try {
        const url = new URL(req.url || '', 'http://localhost');
        const limitParam = url.searchParams.get('limit') || (req.query && req.query.limit);
        const limit = Number(limitParam) || 50;
        const logs = this.auditLogger.getRecentLogs(limit);
        sendResponse(res, 200, { success: true, logs });
      } catch (error: any) {
        logger.error(`Fehler beim Abrufen des Audit-Logs: ${error.message}`);
        sendResponse(res, 500, { error: 'Fehler beim Abrufen des Audit-Logs' });
      }
    });

    // Route: Deterministisches Basisskelett via MILP-Solver berechnen
    register('POST', '/api/engine/solve-baseline', async (req, res) => {
      try {
        const body = await parseBody(req);
        const { startDate, endDate, staffPool } = body;

        const hardConstraints = this.constraintRegistry.getHardConstraints();

        const requestPayload = {
          startDate,
          endDate,
          staffPool,
          hardConstraints,
        };

        logger.info(`Sende Planungsauftrag an externe KI fuer Zeitraum: ${startDate} bis ${endDate}`);
        context.broadcast?.('ENGINE_STAGE_CHANGED', { stage: 'SOLVING_HARD_CONSTRAINTS', startDate, endDate });

        const solverResult = await this.solverClient.solveBaseline(requestPayload);

        if (!solverResult.isFeasible) {
          logger.warn(`Solver meldet Konflikt: ${solverResult.error}`);
          await this.auditLogger.logEvent('HARD_CONSTRAINT_VIOLATION_BLOCKED', 'Solver meldet Unfeasibility', {
            error: solverResult.error,
            startDate,
            endDate,
          });
          sendResponse(res, 409, solverResult);
          return;
        }

        await this.auditLogger.logEvent('SOLVER_BASELINE_COMPUTED', 'Basisskelett erfolgreich berechnet', {
          computationTimeMs: solverResult.computationTimeMs,
          shiftCount: solverResult.shiftSkeleton.length,
        });

        sendResponse(res, 200, solverResult);
      } catch (error: any) {
        logger.error(`Fehler bei der Kommunikation mit der KI: ${error.message}`);
        sendResponse(res, 500, { error: 'Interner Fehler bei der Solver-Berechnung' });
      }
    });

    // Route: Stochastische Patientennachfrage und Rush-Zeiten prognostizieren
    register('POST', '/api/engine/predict-demand', async (req, res) => {
      try {
        const body = await parseBody(req);
        const { date, baseDailyVolume } = body;
        const targetDate = date || new Date().toISOString().slice(0, 10);

        if (baseDailyVolume && typeof baseDailyVolume === 'number') {
          this.demandPredictor = new DemandPredictor({ baseDailyVolume });
        }

        logger.info(`Berechne Nachfrageprognose fuer Datum: ${targetDate}`);
        const profile = this.demandPredictor.predictDemandForDate(targetDate);

        await this.auditLogger.logEvent('DEMAND_PREDICTED', 'Nachfrageprofil generiert', {
          targetDate,
          totalExpected: profile.totalExpectedPatients,
          noShowRate: profile.noShowProbability,
        });

        sendResponse(res, 200, { success: true, profile });
      } catch (error: any) {
        logger.error(`Fehler bei der Nachfrageprognose: ${error.message}`);
        sendResponse(res, 500, { error: 'Fehler bei der Nachfrageprognose' });
      }
    });

    // Route: Digitaler Zwilling Stresstest-Simulator mit Event-Heap und Multi-Day Spillover
    register('POST', '/api/engine/stress-test', async (req, res) => {
      try {
        const body = await parseBody(req);
        const { dayId, nextDayId, staffPool, shocks, date } = body;
        const simDate = date || new Date().toISOString().slice(0, 10);
        const nextDate = nextDayId || 'folgetag';

        logger.info(`Starte Digitaler Zwilling Stresstest fuer Tag: ${dayId || simDate}`);
        context.broadcast?.('ENGINE_STAGE_CHANGED', { stage: 'SIMULATING_STRESS', date: simDate });

        const demandProfile = this.demandPredictor.predictDemandForDate(simDate);
        const effectiveStaff = staffPool || [
          { id: 'Dr. Mueller', role: 'Doctor', skills: ['Allgemeinmedizin'] },
          { id: 'Dr. Weber', role: 'Doctor', skills: ['Innere Medizin'] },
          { id: 'Dr. Schmidt', role: 'Doctor', skills: ['Chirurgie'] },
        ];

        const shockScenarios: ShockScenario[] = shocks || [];

        const simResult = this.simulator.runDaySimulation(
          dayId || simDate,
          nextDate,
          demandProfile.generatedPatients,
          effectiveStaff,
          shockScenarios
        );

        logger.info(
          `Stresstest abgeschlossen in ${simResult.executionTimeMs}ms. Resilienz-Score: ${simResult.metrics.resilienceScore}/100, Spillover: ${simResult.metrics.spilloverCount}`
        );

        await this.auditLogger.logEvent('STRESS_TEST_EXECUTED', 'Digitaler Zwilling Stresstest abgeschlossen', {
          resilienceScore: simResult.metrics.resilienceScore,
          spilloverCount: simResult.metrics.spilloverCount,
          executionTimeMs: simResult.executionTimeMs,
        });

        sendResponse(res, 200, { success: true, result: simResult });
      } catch (error: any) {
        logger.error(`Fehler beim Stresstest-Lauf: ${error.message}`);
        sendResponse(res, 500, { error: 'Fehler bei der Simulation' });
      }
    });

    // Route: ALNS Metaheuristik Feinoptimierung (Ebene 4)
    register('POST', '/api/engine/optimize', async (req, res) => {
      try {
        const body = await parseBody(req);
        const { shifts, maxIterations, initialTemperature, coolingRate } = body;

        const allConstraints = this.constraintRegistry.getAllConstraints();

        const initialSchedule: ShiftAssignment[] = shifts || [
          { employeeId: 'Dr. Mueller', role: 'Doctor', startTime: '08:00', endTime: '16:30', activePatientMinutes: 420 },
          { employeeId: 'Dr. Weber', role: 'Doctor', startTime: '08:00', endTime: '12:00', activePatientMinutes: 200 },
          { employeeId: 'Dr. Weber', role: 'Doctor', startTime: '14:00', endTime: '18:00', activePatientMinutes: 210 },
          { employeeId: 'MFA Anna', role: 'MFA', startTime: '07:30', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '12:30' },
          { employeeId: 'MFA Bernd', role: 'MFA', startTime: '08:00', endTime: '16:30', breakStartTime: '12:00', breakEndTime: '12:30' },
        ];

        logger.info(`Starte ALNS-Optimierung mit ${maxIterations || 60} Iterationen...`);
        context.broadcast?.('ENGINE_STAGE_CHANGED', { stage: 'ALNS_REFINEMENT' });

        const optResult = this.alnsOptimizer.optimizeSchedule(initialSchedule, allConstraints, {
          maxIterations,
          initialTemperature,
          coolingRate,
        });

        logger.info(
          `ALNS-Optimierung abgeschlossen in ${optResult.executionTimeMs}ms. Penalty: ${optResult.initialPenalty} -> ${optResult.optimizedPenalty} (-${optResult.improvementPercent}%)`
        );

        await this.auditLogger.logEvent('ALNS_OPTIMIZATION_COMPLETED', 'ALNS Feinoptimierung abgeschlossen', {
          initialPenalty: optResult.initialPenalty,
          optimizedPenalty: optResult.optimizedPenalty,
          improvementPercent: optResult.improvementPercent,
          executionTimeMs: optResult.executionTimeMs,
        });

        context.broadcast?.('OPTIMIZATION_RESULT', optResult);

        sendResponse(res, 200, { success: true, optimization: optResult });
      } catch (error: any) {
        logger.error(`Fehler bei der ALNS-Optimierung: ${error.message}`);
        sendResponse(res, 500, { error: 'Fehler bei der Optimierung' });
      }
    });
  }

  // 2. Offizieller Microkernel Lifecycle-Hook: onEnable
  async onEnable(): Promise<void> {
    const logger = this.context?.logger || console;
    logger.info('[MedOS-Engine] Plugin aktiviert und bereit.');
  }

  // 3. Offizieller Microkernel Lifecycle-Hook: onDisable
  async onDisable(): Promise<void> {
    const logger = this.context?.logger || console;
    logger.info('[MedOS-Engine] Plugin deaktiviert.');
  }

  // 4. Offizieller Microkernel Lifecycle-Hook: onUnload
  async onUnload(): Promise<void> {
    const logger = this.context?.logger || console;
    logger.info('[MedOS-Engine] Plugin entladen.');
  }

  // Kompatibilitaets-Hooks
  async onInit(context: PluginContext): Promise<void> {
    await this.onLoad(context);
    await this.onEnable();
  }

  async onStop(context?: PluginContext): Promise<void> {
    await this.onDisable();
    await this.onUnload();
  }
}
