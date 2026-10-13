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

export default class MedOSEnginePlugin implements IPlugin {
  private constraintRegistry!: ConstraintRegistry;
  private solverClient!: ExternalMilpClient;
  private demandPredictor = new DemandPredictor();
  private simulator = new DigitalTwinSimulator();
  private alnsOptimizer = new AlnsOptimizer();
  private auditLogger!: AuditLogger;

  async onInit(context: PluginContext): Promise<void> {
    context.logger.info('Initialisiere MedOS Engine v2 Plugin...');

    this.constraintRegistry = new ConstraintRegistry(context.db);
    this.auditLogger = new AuditLogger(context.db);

    try {
      const candidatePaths: string[] = [
        path.resolve(__dirname, '../config/default-constraints.json'),
        path.resolve(__dirname, '../../config/default-constraints.json'),
        path.resolve(process.cwd(), 'config/default-constraints.json'),
        path.resolve(__dirname, './config/default-constraints.json')
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
      context.logger.info(`Standard-Constraints erfolgreich initialisiert aus: ${loadedPath}`);
    } catch (error: any) {
      context.logger.error(`Fehler beim Laden der Standard-Constraints: ${error.message}`);
    }

    const solverUrl = context.config.get('MILP_SOLVER_URL') || 'http://localhost:8000';
    this.solverClient = new ExternalMilpClient(solverUrl);
    context.logger.info(`Externer MILP-Solver-Client initialisiert (${solverUrl})`);

    // Route: Alle Constraints abrufen
    context.registerRoute('GET', '/api/engine/constraints', async (_req, res) => {
      try {
        const constraints = this.constraintRegistry.getAllConstraints();
        res.json({ success: true, data: constraints });
      } catch (error: any) {
        context.logger.error(`Fehler beim Abrufen der Constraints: ${error.message}`);
        res.status(500).json({ error: 'Fehler beim Abrufen der Constraints' });
      }
    });

    // Route: Revisionssicheren Audit-Log abrufen
    context.registerRoute('GET', '/api/engine/audit-log', async (req, res) => {
      try {
        const limit = Number(req.query?.limit) || 50;
        const logs = this.auditLogger.getRecentLogs(limit);
        res.json({ success: true, logs });
      } catch (error: any) {
        context.logger.error(`Fehler beim Abrufen des Audit-Logs: ${error.message}`);
        res.status(500).json({ error: 'Fehler beim Abrufen des Audit-Logs' });
      }
    });

    // Route: Deterministisches Basisskelett via MILP-Solver berechnen
    context.registerRoute('POST', '/api/engine/solve-baseline', async (req, res) => {
      try {
        const { startDate, endDate, staffPool } = req.body;

        const hardConstraints = this.constraintRegistry.getHardConstraints();

        const requestPayload = {
          startDate,
          endDate,
          staffPool,
          hardConstraints
        };

        context.logger.info(`Sende Planungsauftrag an externe KI fuer Zeitraum: ${startDate} bis ${endDate}`);
        context.broadcast?.('ENGINE_STAGE_CHANGED', { stage: 'SOLVING_HARD_CONSTRAINTS', startDate, endDate });

        const solverResult = await this.solverClient.solveBaseline(requestPayload);

        if (!solverResult.isFeasible) {
          context.logger.warn(`Solver meldet Konflikt: ${solverResult.error}`);
          await this.auditLogger.logEvent('HARD_CONSTRAINT_VIOLATION_BLOCKED', 'Solver meldet Unfeasibility', {
            error: solverResult.error,
            startDate,
            endDate,
          });
          return res.status(409).json(solverResult);
        }

        await this.auditLogger.logEvent('SOLVER_BASELINE_COMPUTED', 'Basisskelett erfolgreich berechnet', {
          computationTimeMs: solverResult.computationTimeMs,
          shiftCount: solverResult.shiftSkeleton.length,
        });

        res.json(solverResult);
      } catch (error: any) {
        context.logger.error(`Fehler bei der Kommunikation mit der KI: ${error.message}`);
        res.status(500).json({ error: 'Interner Fehler bei der Solver-Berechnung' });
      }
    });

    // Route: Stochastische Patientennachfrage und Rush-Zeiten prognostizieren
    context.registerRoute('POST', '/api/engine/predict-demand', async (req, res) => {
      try {
        const { date, baseDailyVolume } = req.body;
        const targetDate = date || new Date().toISOString().slice(0, 10);

        if (baseDailyVolume && typeof baseDailyVolume === 'number') {
          this.demandPredictor = new DemandPredictor({ baseDailyVolume });
        }

        context.logger.info(`Berechne Nachfrageprognose fuer Datum: ${targetDate}`);
        const profile = this.demandPredictor.predictDemandForDate(targetDate);

        await this.auditLogger.logEvent('DEMAND_PREDICTED', 'Nachfrageprofil generiert', {
          targetDate,
          totalExpected: profile.totalExpectedPatients,
          noShowRate: profile.noShowProbability,
        });

        res.json({ success: true, profile });
      } catch (error: any) {
        context.logger.error(`Fehler bei der Nachfrageprognose: ${error.message}`);
        res.status(500).json({ error: 'Fehler bei der Nachfrageprognose' });
      }
    });

    // Route: Digitaler Zwilling Stresstest-Simulator mit Event-Heap und Multi-Day Spillover
    context.registerRoute('POST', '/api/engine/stress-test', async (req, res) => {
      try {
        const { dayId, nextDayId, staffPool, shocks, date } = req.body;
        const simDate = date || new Date().toISOString().slice(0, 10);
        const nextDate = nextDayId || 'folgetag';

        context.logger.info(`Starte Digitaler Zwilling Stresstest fuer Tag: ${dayId || simDate}`);
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

        context.logger.info(
          `Stresstest abgeschlossen in ${simResult.executionTimeMs}ms. Resilienz-Score: ${simResult.metrics.resilienceScore}/100, Spillover: ${simResult.metrics.spilloverCount}`
        );

        await this.auditLogger.logEvent('STRESS_TEST_EXECUTED', 'Digitaler Zwilling Stresstest abgeschlossen', {
          resilienceScore: simResult.metrics.resilienceScore,
          spilloverCount: simResult.metrics.spilloverCount,
          executionTimeMs: simResult.executionTimeMs,
        });

        res.json({ success: true, result: simResult });
      } catch (error: any) {
        context.logger.error(`Fehler beim Stresstest-Lauf: ${error.message}`);
        res.status(500).json({ error: 'Fehler bei der Simulation' });
      }
    });

    // Route: ALNS Metaheuristik Feinoptimierung (Ebene 4)
    context.registerRoute('POST', '/api/engine/optimize', async (req, res) => {
      try {
        const { shifts, maxIterations, initialTemperature, coolingRate } = req.body;

        const allConstraints = this.constraintRegistry.getAllConstraints();

        const initialSchedule: ShiftAssignment[] = shifts || [
          { employeeId: 'Dr. Mueller', role: 'Doctor', startTime: '08:00', endTime: '16:30', activePatientMinutes: 420 },
          { employeeId: 'Dr. Weber', role: 'Doctor', startTime: '08:00', endTime: '12:00', activePatientMinutes: 200 },
          { employeeId: 'Dr. Weber', role: 'Doctor', startTime: '14:00', endTime: '18:00', activePatientMinutes: 210 },
          { employeeId: 'MFA Anna', role: 'MFA', startTime: '07:30', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '12:30' },
          { employeeId: 'MFA Bernd', role: 'MFA', startTime: '08:00', endTime: '16:30', breakStartTime: '12:00', breakEndTime: '12:30' },
        ];

        context.logger.info(`Starte ALNS-Optimierung mit ${maxIterations || 60} Iterationen...`);
        context.broadcast?.('ENGINE_STAGE_CHANGED', { stage: 'ALNS_REFINEMENT' });

        const optResult = this.alnsOptimizer.optimizeSchedule(initialSchedule, allConstraints, {
          maxIterations,
          initialTemperature,
          coolingRate,
        });

        context.logger.info(
          `ALNS-Optimierung abgeschlossen in ${optResult.executionTimeMs}ms. Penalty: ${optResult.initialPenalty} -> ${optResult.optimizedPenalty} (-${optResult.improvementPercent}%)`
        );

        await this.auditLogger.logEvent('ALNS_OPTIMIZATION_COMPLETED', 'ALNS Feinoptimierung abgeschlossen', {
          initialPenalty: optResult.initialPenalty,
          optimizedPenalty: optResult.optimizedPenalty,
          improvementPercent: optResult.improvementPercent,
          executionTimeMs: optResult.executionTimeMs,
        });

        context.broadcast?.('OPTIMIZATION_RESULT', optResult);

        res.json({ success: true, optimization: optResult });
      } catch (error: any) {
        context.logger.error(`Fehler bei der ALNS-Optimierung: ${error.message}`);
        res.status(500).json({ error: 'Fehler bei der Optimierung' });
      }
    });
  }

  async onStop(context: PluginContext): Promise<void> {
    context.logger.info('Beende MedOS Engine v2 Plugin...');
  }
}
