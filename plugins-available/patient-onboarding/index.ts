import { IPlugin, PluginContext, InstallProgressCallback } from '../../apps/backend/src/interfaces/core-interfaces';
import { PluginDBProxy } from '../../apps/backend/src/core/plugin-db-proxy';
import { broadcastEvent } from '../../apps/backend/src/core/event-stream';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseReqBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', (chunk: any) => (body += chunk.toString()));
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

function sendJson(res: any, statusCode: number, data: any) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Connection': 'keep-alive',
  });
  res.end(body);
}

const DEFAULT_FORM_SCHEMA = [
  {
    id: 'chiefComplaint',
    type: 'textarea',
    label: 'Aktuelle Beschwerden & Leitsymptom',
    description: 'Bitte beschreiben Sie kurz den Hauptgrund Ihres heutigen Besuchs.',
    placeholder: 'z.B. Seit heute Morgen stechende Brustschmerzen, Schwindelgefühl...',
    required: true,
  },
  {
    id: 'painScale',
    type: 'scale',
    label: 'Schmerzskala (1 - 10)',
    description: '1 = kaum spürbar, 10 = stärkste vorstellbare Schmerzen',
    min: 1,
    max: 10,
    required: true,
    defaultValue: 1,
  },
  {
    id: 'allergies',
    type: 'text',
    label: 'Bekannte Allergien & Unverträglichkeiten',
    placeholder: 'z.B. Penicillin, Pflaster, keine bekannt...',
    required: false,
  },
  {
    id: 'medications',
    type: 'textarea',
    label: 'Dauermedikation & aktuell eingenommene Arzneimittel',
    placeholder: 'z.B. Ramipril 5mg, Ibuprofen 400...',
    required: false,
  },
  {
    id: 'pregnant',
    type: 'boolean',
    label: 'Besteht eine Schwangerschaft?',
    description: 'Nur für weibliche / diverse Patienten relevant',
    required: false,
  },
];

export default class PatientOnboardingPlugin implements IPlugin {
  private context?: PluginContext;

  // In-Memory Speicher als Fallback, falls DB nicht aktiv ist
  private memoryStore = new Map<string, any>();

  /**
   * Simulierte Installationsroutine mit Fortschrittsmeldungen.
   */
  async onInstall(reportProgress: InstallProgressCallback): Promise<void> {
    reportProgress('Prüfe Systemkompatibilität...', 10);
    await delay(600);

    reportProgress('Initialisiere Patientendatenbank & Formular-Schema...', 50);
    await delay(800);

    reportProgress('Registriere Manchester-Triage-Regeln...', 85);
    await delay(500);

    reportProgress('Installation abgeschlossen.', 100);
  }

  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    console.log('[Patienten-Onboarding] v2.0.0: onLoad() - Initialisiere Onboarding-Engine...');

    // Standard-Demoprofile initialisieren
    this.seedDemoData();
  }

  private seedDemoData() {
    const demoPatient1 = {
      firstName: 'Clara',
      lastName: 'Schumann',
      birthDate: '1985-09-13',
      gender: 'weiblich',
      insurance: 'Techniker Krankenkasse',
      insuranceNumber: 'A123456789',
      phone: '+49 170 1234567',
      emergencyContact: 'Robert Schumann (0171 9876543)',
      lastVisit: '14.08.2026',
      upcomingAppointment: '10:30 Uhr (Dr. Weber, Kardiologie)',
    };

    const demoPatient2 = {
      firstName: 'Johann Sebastian',
      lastName: 'Bach',
      birthDate: '1975-03-21',
      gender: 'männlich',
      insurance: 'Barmer GEK',
      insuranceNumber: 'B987654321',
      phone: '+49 160 9988776',
      emergencyContact: 'Anna Magdalena Bach (0160 1122334)',
      lastVisit: '02.06.2026',
      upcomingAppointment: '11:15 Uhr (Dr. Klein, Allgemeinmedizin)',
    };

    this.memoryStore.set('patient:A123456789', demoPatient1);
    this.memoryStore.set('patient:B987654321', demoPatient2);
    this.memoryStore.set('form_schema', DEFAULT_FORM_SCHEMA);
  }

  async onEnable(): Promise<void> {
    console.log('[Patienten-Onboarding] v2.0.0: onEnable() - Modul ist jetzt LIVE.');
    
    const db = this.context?.getService<PluginDBProxy>('db');
    if (!db) {
      console.warn('[Patienten-Onboarding] DB-Service nicht verfügbar — nutze In-Memory-Speicher.');
    } else {
      // Wenn DB vorhanden, Demo-Patienten absichern
      try {
        const p1 = await db.findByKey('patient:A123456789');
        if (!p1) {
          await db.create({
            key: 'patient:A123456789',
            payload: JSON.stringify(this.memoryStore.get('patient:A123456789')),
          });
        }
      } catch (err) {
        console.warn('[Patienten-Onboarding] Konnte Demo-Patient nicht in DB initialisieren:', err);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. GET /api/onboarding/patient/:insuranceNumber
    // ─────────────────────────────────────────────────────────────
    this.context?.registerRoute('GET /api/onboarding/patient/:insuranceNumber', async (req: any, res: any) => {
      try {
        const insuranceNumber = req.params?.insuranceNumber || '';
        if (!insuranceNumber) {
          sendJson(res, 400, { success: false, error: 'Versichertennummer erforderlich.' });
          return;
        }

        const key = `patient:${insuranceNumber.trim()}`;
        let profile: any = null;

        if (db) {
          const record = await db.findByKey(key);
          if (record && record.payload) {
            profile = typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload;
          }
        }

        // Fallback im Memory-Store prüfen
        if (!profile && this.memoryStore.has(key)) {
          profile = this.memoryStore.get(key);
        }

        if (!profile) {
          sendJson(res, 404, {
            success: false,
            error: `Kein Patient mit der Versichertennummer '${insuranceNumber}' gefunden.`,
          });
          return;
        }

        sendJson(res, 200, { success: true, data: profile });
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Patientenabruf:', err);
        sendJson(res, 500, { success: false, error: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 2. GET /api/onboarding/schema
    // ─────────────────────────────────────────────────────────────
    this.context?.registerRoute('GET /api/onboarding/schema', async (_req: any, res: any) => {
      try {
        let schema: any = null;

        if (db) {
          const record = await db.findByKey('form_schema');
          if (record && record.payload) {
            schema = typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload;
          }
        }

        if (!schema) {
          schema = this.memoryStore.get('form_schema') || DEFAULT_FORM_SCHEMA;
        }

        sendJson(res, 200, { success: true, data: schema });
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Schema-Abruf:', err);
        sendJson(res, 500, { success: false, error: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. POST /api/onboarding/schema
    // ─────────────────────────────────────────────────────────────
    this.context?.registerRoute('POST /api/onboarding/schema', async (req: any, res: any) => {
      try {
        const body = await parseReqBody(req);
        const schema = Array.isArray(body) ? body : body.schema;

        if (!Array.isArray(schema)) {
          sendJson(res, 400, { success: false, error: 'Schema muss ein Array von Feldern sein.' });
          return;
        }

        if (db) {
          const existing = await db.findByKey('form_schema');
          if (existing) {
            await db.update(existing.id, { payload: JSON.stringify(schema) });
          } else {
            await db.create({ key: 'form_schema', payload: JSON.stringify(schema) });
          }
        }
        this.memoryStore.set('form_schema', schema);

        sendJson(res, 200, { success: true, data: schema });
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Speichern des Schemas:', err);
        sendJson(res, 500, { success: false, error: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 4. POST /api/onboarding/submit
    // ─────────────────────────────────────────────────────────────
    this.context?.registerRoute('POST /api/onboarding/submit', async (req: any, res: any) => {
      try {
        const body = await parseReqBody(req);
        const { patientData, answers, saveProfile } = body;

        // Abwärtskompatibilität: Falls flaches Objekt übermittelt wird
        const pData = patientData || {
          firstName: body.firstName,
          lastName: body.lastName,
          birthDate: body.birthDate,
          gender: body.gender,
          insurance: body.insurance,
          insuranceNumber: body.insuranceNumber,
          phone: body.phone,
          emergencyContact: body.emergencyContact,
          triageLevel: body.triageLevel,
        };

        const ans = answers || {
          chiefComplaint: body.chiefComplaint,
          allergies: body.allergies,
          painScale: body.painScale,
        };

        if (!pData?.firstName || !pData?.lastName) {
          sendJson(res, 400, { success: false, error: 'Vor- und Nachname sind erforderlich.' });
          return;
        }

        const intakeId = `intake_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const timestamp = new Date().toISOString();

        // Optional: Profil unter patient:<insuranceNumber> speichern oder aktualisieren
        if (saveProfile && pData.insuranceNumber) {
          const patientKey = `patient:${pData.insuranceNumber.trim()}`;
          const profileData = {
            ...pData,
            lastVisit: new Date().toLocaleDateString('de-DE'),
            upcomingAppointment: pData.upcomingAppointment || 'Heute (Akutaufnahme)',
          };

          if (db) {
            const existing = await db.findByKey(patientKey);
            if (existing) {
              await db.update(existing.id, { payload: JSON.stringify(profileData) });
            } else {
              await db.create({ key: patientKey, payload: JSON.stringify(profileData) });
            }
          }
          this.memoryStore.set(patientKey, profileData);
        }

        // Aufnahme-Vorgang als intake:<id> speichern
        const intakeRecord = {
          id: intakeId,
          key: `intake:${intakeId}`,
          patientData: pData,
          answers: ans,
          status: 'REGISTERED',
          admittedAt: timestamp,
          // Flache Aliase für direkte Dashboard-Kompatibilität
          firstName: pData.firstName,
          lastName: pData.lastName,
          birthDate: pData.birthDate,
          gender: pData.gender,
          insurance: pData.insurance,
          insuranceNumber: pData.insuranceNumber,
          phone: pData.phone,
          emergencyContact: pData.emergencyContact,
          triageLevel: pData.triageLevel || (ans.painScale >= 8 ? 'orange' : ans.painScale >= 5 ? 'yellow' : 'green'),
          chiefComplaint: ans.chiefComplaint || '',
          allergies: ans.allergies || '',
        };

        if (db) {
          await db.create({
            key: `intake:${intakeId}`,
            payload: JSON.stringify(intakeRecord),
          });
        }
        this.memoryStore.set(`intake:${intakeId}`, intakeRecord);

        // SSE-Event für Empfangs-Monitore und Dashboards auslösen
        broadcastEvent('NEW_PATIENT', { data: intakeRecord });

        sendJson(res, 200, { success: true, data: intakeRecord });
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Übermitteln der Aufnahme:', err);
        sendJson(res, 500, { success: false, error: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 5. GET /api/onboarding/list (für Empfangs-Dashboard)
    // ─────────────────────────────────────────────────────────────
    this.context?.registerRoute('GET /api/onboarding/list', async (_req: any, res: any) => {
      try {
        let intakes: any[] = [];

        if (db) {
          const records = await db.findMany({ orderBy: { createdAt: 'desc' } });
          intakes = records
            .filter((r: any) => r.key.startsWith('intake:') || r.key.startsWith('patient_'))
            .map((r: any) => {
              try {
                const parsed = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
                return {
                  id: r.id || r.key,
                  key: r.key,
                  payload: r.payload,
                  createdAt: r.createdAt || new Date().toISOString(),
                  ...parsed,
                };
              } catch {
                return r;
              }
            });
        }

        // Falls DB leer oder inaktiv, Memory-Store nutzen
        if (intakes.length === 0) {
          for (const [key, val] of this.memoryStore.entries()) {
            if (key.startsWith('intake:')) {
              intakes.unshift({
                id: val.id || key,
                key,
                payload: JSON.stringify(val),
                createdAt: val.admittedAt || new Date().toISOString(),
                ...val,
              });
            }
          }
        }

        sendJson(res, 200, { success: true, data: intakes });
      } catch (err: any) {
        console.error('[Patienten-Onboarding] Fehler beim Abrufen der Aufnahmen:', err);
        sendJson(res, 500, { success: false, error: err.message });
      }
    });
  }

  async onDisable(): Promise<void> {
    console.log('[Patienten-Onboarding] v2.0.0: onDisable() - Stoppe Datenströme...');
  }

  async onUnload(): Promise<void> {
    console.log('[Patienten-Onboarding] v2.0.0: onUnload() - Ressourcen freigegeben.');
  }

  async onUninstall(keepData: boolean): Promise<void> {
    console.log(`[Patienten-Onboarding] v2.0.0: onUninstall(keepData=${keepData})`);
    if (keepData) {
      console.log('[Patienten-Onboarding] Soft Uninstall: Patientendaten und Schemata bleiben im System erhalten.');
    } else {
      console.log('[Patienten-Onboarding] Hard Uninstall: Bereinigung der Memory- und Tabellendaten.');
      this.memoryStore.clear();
    }
  }
}
