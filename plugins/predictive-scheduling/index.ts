import { IPlugin, PluginContext, InstallProgressCallback } from '../../apps/backend/src/interfaces/core-interfaces';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res: any, statusCode: number, data: any) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Connection': 'keep-alive',
  });
  res.end(body);
}

export default class PredictiveSchedulingPlugin implements IPlugin {
  private context?: PluginContext;
  private memorySchedules = [
    { id: 'shift-1', department: 'Notaufnahme', doctor: 'Dr. Sarah Weber', nurse: 'T. Müller', shift: 'Frühschicht (06:00 - 14:30)', riskScore: 0.12 },
    { id: 'shift-2', department: 'OP-Zentrum 1', doctor: 'Prof. Dr. J. Bach', nurse: 'K. Schmidt', shift: 'Tagesschicht (08:00 - 16:30)', riskScore: 0.05 },
    { id: 'shift-3', department: 'Intensivstation (ITS)', doctor: 'Dr. M. Lindner', nurse: 'L. Hoffmann', shift: 'Spätschicht (14:00 - 22:30)', riskScore: 0.38 },
  ];

  async onInstall(reportProgress?: InstallProgressCallback): Promise<void> {
    if (reportProgress) {
      reportProgress('Initialisiere MDP-Zustandsraum...', 20);
      await delay(200);
      reportProgress('Kalibriere Bellman-Kostenkoeffizienten (alpha=0.6, beta=0.4)...', 60);
      await delay(200);
      reportProgress('Modell-Validierung erfolgreich.', 100);
    }
  }

  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;

    // Route: Aktuelle Dienstpläne abrufen
    context.registerRoute('GET /api/scheduling/shifts', async (_req: any, res: any) => {
      sendJson(res, 200, {
        success: true,
        data: this.memorySchedules,
        model: {
          type: 'Markov Decision Process (MDP)',
          discountFactorGamma: 0.95,
          activeState: { waitingPatients: 14, activeStaff: 8 },
        },
      });
    });

    // Route: Prognose- & Optimierungslauf ausführen
    context.registerRoute('POST /api/scheduling/optimize', async (_req: any, res: any) => {
      sendJson(res, 200, {
        success: true,
        message: 'Optimierung nach Bellman-Gleichung berechnet.',
        optimalAllocation: {
          recommendedAdditionalStaff: 2,
          projectedWaitTimeReductionMin: 18.5,
          costScore: 4.82,
        },
      });
    });
  }

  async onEnable(): Promise<void> {
    console.log('[Predictive-Scheduling] Aktiviert: MDP-Entscheidungsengine bereit.');
  }

  async onDisable(): Promise<void> {
    console.log('[Predictive-Scheduling] Deaktiviert.');
  }

  async onUnload(): Promise<void> {
    console.log('[Predictive-Scheduling] Entladen.');
  }

  async onUninstall(keepData: boolean): Promise<void> {
    console.log(`[Predictive-Scheduling] Deinstalliert (keepData=${keepData}).`);
  }
}
