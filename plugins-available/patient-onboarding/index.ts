import { IPlugin, PluginContext, InstallProgressCallback } from '../../apps/backend/src/interfaces/core-interfaces';
import { PluginDBProxy } from '../../apps/backend/src/core/plugin-db-proxy';
import { broadcastEvent } from '../../apps/backend/src/core/event-stream';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default class PatientOnboardingPlugin implements IPlugin {
  private context?: PluginContext;
  private memoryPatients: any[] = [];

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
      console.warn('[Patienten-Onboarding] DB-Service nicht verfügbar — nutze In-Memory-Speicher.');
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

        let newEntry: any;
        if (db) {
          newEntry = await db.create({
            key: `patient_${Date.now()}`,
            payload: JSON.stringify(payload),
          });
        } else {
          newEntry = {
            id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            pluginName: 'patient-onboarding',
            key: `patient_${Date.now()}`,
            payload: JSON.stringify(payload),
            createdAt: new Date().toISOString(),
          };
          this.memoryPatients.unshift(newEntry);
        }

        broadcastEvent('NEW_PATIENT', { data: newEntry });
        
        const successBody = JSON.stringify({ success: true, data: newEntry });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(successBody),
          'Connection': 'keep-alive',
        });
        res.end(successBody);
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Speichern:', err);
        const errBody = JSON.stringify({ error: err.message });
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(errBody),
          'Connection': 'keep-alive',
        });
        res.end(errBody);
      }
    });

    // GET Route — Alle Patienten auflisten
    this.context?.registerRoute('GET /api/onboarding/list', async (_req: any, res: any) => {
      try {
        let patients: any[] = [];
        if (db) {
          patients = await db.findMany({ orderBy: { createdAt: 'desc' } });
        } else {
          patients = this.memoryPatients;
        }
        
        const successBody = JSON.stringify({ success: true, data: patients });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(successBody),
          'Connection': 'keep-alive',
        });
        res.end(successBody);
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Abrufen:', err);
        const errBody = JSON.stringify({ error: err.message });
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(errBody),
          'Connection': 'keep-alive',
        });
        res.end(errBody);
      }
    });
  }

  async onDisable(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onDisable() - Stoppe Datenströme und trenne Datenbank...');
  }

  async onUnload(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onUnload() - Ressourcen freigegeben. Tschüss!');
  }

  async onUninstall(keepData: boolean): Promise<void> {
    console.log(`[Patienten-Onboarding] v1.0.0: onUninstall(keepData=${keepData})`);
    if (keepData) {
      console.log('[Patienten-Onboarding] Soft Uninstall: Patientendaten und Tabellen bleiben im System erhalten.');
    } else {
      console.log('[Patienten-Onboarding] Hard Uninstall: Datenbereinigung wird eingeleitet.');
    }
  }
}

