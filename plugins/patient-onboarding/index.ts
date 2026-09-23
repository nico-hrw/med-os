import { IPlugin, PluginContext } from '../../apps/backend/src/interfaces/core-interfaces';
import { PrismaClient } from '../../apps/backend/src/generated/prisma/client.ts';
import { broadcastEvent } from '../../apps/backend/src/core/event-stream';

export default class PatientOnboardingPlugin implements IPlugin {
  private context?: PluginContext;

  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    console.log('[Patienten-Onboarding] v1.0.0: onLoad() - Initialisiere Warteschlangen-DB...');
  }

  async onEnable(): Promise<void> {
    console.log('[Patienten-Onboarding] v1.0.0: onEnable() - Modul ist jetzt LIVE.');
    
    const db = this.context?.getService<PrismaClient>('db');
    if (!db) {
      console.error('[Patienten-Onboarding] Kritischer Fehler: DB Service nicht gefunden!');
      return;
    }

    // POST Route
    this.context?.registerRoute('POST /api/onboarding/submit', async (req: any, res: any) => {
      try {
        let payload = req.body;
        // Fallback for raw HTTP handlers if Express is not parsing the body
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

        const newEntry = await db.pluginData.create({
          data: {
            pluginName: 'patient-onboarding',
            key: `patient_${Date.now()}`,
            payload: JSON.stringify(payload)
          }
        });

        broadcastEvent('NEW_PATIENT', { data: newEntry });
        
        if (res.json) {
          res.json({ success: true, data: newEntry });
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: newEntry }));
        }
      } catch (err: any) {
        console.error('Error saving patient:', err);
        if (res.status) {
          res.status(500).json({ error: err.message });
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });

    // GET Route
    this.context?.registerRoute('GET /api/onboarding/list', async (req: any, res: any) => {
      try {
        const patients = await db.pluginData.findMany({
          where: { pluginName: 'patient-onboarding' },
          orderBy: { createdAt: 'desc' }
        });
        
        if (res.json) {
          res.json({ success: true, data: patients });
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: patients }));
        }
      } catch (err: any) {
        console.error('Error fetching patients:', err);
        if (res.status) {
          res.status(500).json({ error: err.message });
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
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
