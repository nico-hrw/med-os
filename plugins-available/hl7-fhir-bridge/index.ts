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

export default class HL7FhirBridgePlugin implements IPlugin {
  async onInstall(reportProgress?: InstallProgressCallback): Promise<void> {
    if (reportProgress) {
      reportProgress('Initialisiere MLLP/TCP Socket Listener...', 30);
      await delay(200);
      reportProgress('Lade FHIR R4 Struktur-Definitionen...', 70);
      await delay(200);
      reportProgress('Gateway betriebsbereit.', 100);
    }
  }

  async onLoad(context: PluginContext): Promise<void> {
    context.registerRoute('GET /api/hl7/status', async (_req: any, res: any) => {
      sendJson(res, 200, {
        success: true,
        protocol: 'HL7 v2.5 / FHIR R4',
        connectedModalities: ['CT-Scanner-01', 'MRT-3Tesla', 'Zentrallabor-Cobas'],
        messagesProcessed24h: 1420,
      });
    });
  }

  async onEnable(): Promise<void> {
    console.log('[HL7-FHIR-Bridge] Aktiviert: Interoperabilitäts-Gateway online.');
  }

  async onDisable(): Promise<void> {
    console.log('[HL7-FHIR-Bridge] Deaktiviert.');
  }

  async onUnload(): Promise<void> {
    console.log('[HL7-FHIR-Bridge] Entladen.');
  }

  async onUninstall(keepData: boolean): Promise<void> {
    console.log(`[HL7-FHIR-Bridge] Deinstalliert (keepData=${keepData}).`);
  }
}
