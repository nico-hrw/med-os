import { IPlugin, PluginContext, InstallProgressCallback } from '../../apps/backend/src/interfaces/core-interfaces';
import { PluginDBProxy } from '../../apps/backend/src/core/plugin-db-proxy';
import { broadcastEvent } from '../../apps/backend/src/core/event-stream';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default class PatientOnboardingPlugin implements IPlugin {
  private context?: PluginContext;

  /**
   * Simulierte Installationsroutine mit Fortschrittsmeldungen.
   * In Produktion würden hier DB-Migrationen, Seed-Daten etc. laufen.
   */
  async onInstall(reportProgress: InstallProgressCallback): Promise<void> {
    reportProgress('Prüfe Systemkompatibilität...', 10);
    await delay(800);

    reportProgress('Lege Datenbanktabellen an...', 40);
    await delay(1200);

    reportProgress('Konfiguriere Standardwerte...', 70);
    await delay(600);

    reportProgress('Erstelle initiale Einträge...', 90);
    await delay(400);

    reportProgress('Installation abgeschlossen.', 100);
  }

  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    console.log('[Patienten-Onboarding] v1.0.0: onLoad() - Initialisiere Warteschlangen-DB...');
  }

  async onEnable(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onEnable() - Modul ist jetzt LIVE.');
    
    const db = this.context?.getService<PluginDBProxy>('db');
    if (!db) {
      console.error('[Patienten-Onboarding] Kritischer Fehler: DB Service nicht gefunden!');
      return;
    }

    // POST Route — Neuen Patienten aufnehmen
    this.context?.registerRoute('POST /api/onboarding/submit', async (req: any, res: any) => {
      try {
        let payload = req.body;
        if (!payload && typeof req.on === 'function') {
          payload = await new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk: any) => body += chunk.toString());
            req.on('end', () => {
              try { resolve(JSON.parse(body || '{}')); } catch (e) { resolve({}); }
            });
            req.on('error', reject);
          });
        }

        const newEntry = await db.create({
          key: `patient_${Date.now()}`,
          payload: JSON.stringify(payload),
        });

        broadcastEvent('NEW_PATIENT', { data: newEntry });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: newEntry }));
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Speichern:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    // GET Route — Alle Patienten auflisten
    this.context?.registerRoute('GET /api/onboarding/list', async (_req: any, res: any) => {
      try {
        const patients = await db.findMany({ orderBy: { createdAt: 'desc' } });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: patients }));
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Abrufen:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  async onDisable(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onDisable() - Stoppe Datenströme und trenne Datenbank...');
  }

  async onUnload(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onUnload() - Ressourcen freigegeben. Tschüss!');
  }
}
