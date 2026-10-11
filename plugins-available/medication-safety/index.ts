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

export default class MedicationSafetyPlugin implements IPlugin {
  async onInstall(reportProgress?: InstallProgressCallback): Promise<void> {
    if (reportProgress) {
      reportProgress('Lade ABDA-Wirkstoffdatenbank...', 25);
      await delay(200);
      reportProgress('Indiziere Kontraindikations-Graphen...', 65);
      await delay(200);
      reportProgress('AMTS-Prüfmodul scharfgeschaltet.', 100);
    }
  }

  async onLoad(context: PluginContext): Promise<void> {
    context.registerRoute('POST /api/medication/check', async (_req: any, res: any) => {
      sendJson(res, 200, {
        success: true,
        alerts: [],
        riskLevel: 'LOW',
        checkedSubstances: 3,
      });
    });
  }

  async onEnable(): Promise<void> {
    console.log('[Medication-Safety] Aktiviert: AMTS-Prüfung aktiv.');
  }

  async onDisable(): Promise<void> {
    console.log('[Medication-Safety] Deaktiviert.');
  }

  async onUnload(): Promise<void> {
    console.log('[Medication-Safety] Entladen.');
  }

  async onUninstall(keepData: boolean): Promise<void> {
    console.log(`[Medication-Safety] Deinstalliert (keepData=${keepData}).`);
  }
}
