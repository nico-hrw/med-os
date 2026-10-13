export interface UIComponentDetail {
  name: string;
  file?: string;
  role: string;
  details: string;
  routes?: string[];
}

export interface EndpointDetail {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: string;
  desc: string;
  params?: string;
  responseSnippet?: string;
}

export interface SchemaDetail {
  keyPattern: string;
  type: string;
  purpose: string;
  sample?: string;
}

export interface PluginArchitecture {
  pluginId: string;
  title: string;
  icon: string;
  tagline: string;
  ui: {
    title: string;
    summary: string;
    components: UIComponentDetail[];
    features: string[];
  };
  api: {
    title: string;
    summary: string;
    endpoints: EndpointDetail[];
    security: string;
  };
  data: {
    title: string;
    summary: string;
    storageType: string;
    schemas: SchemaDetail[];
    resilience: string;
  };
  lifecycle: {
    title: string;
    summary: string;
    eventsProduced: string[];
    hooks: string[];
    sandboxing: string;
  };
}

export const PLUGIN_ARCHITECTURES: Record<string, PluginArchitecture> = {
  'patient-onboarding': {
    pluginId: 'patient-onboarding',
    title: 'Patienten-Erstaufnahme & Triage',
    icon: '🏥',
    tagline: 'Digitale Erstaufnahme mit dynamischem Anamnese-Fragebogen & Manchester-Triage (MTS).',
    ui: {
      title: 'Frontend & Interaktionsschicht',
      summary: 'Self-Service Patienten-Terminal und Live-Cockpit für das Empfangspersonal.',
      components: [
        {
          name: 'PatientForm.tsx',
          file: 'apps/frontend/src/pages/PatientForm.tsx',
          role: 'Self-Service Aufnahme-Terminal',
          details: 'Mehrstufiger Onboarding-Wizard im Soft-UI Design. Unterstützt Versichertenkarten-Login, dynamische Fragebögen (Skala 1-10, Text, Toggles), biometrische Stammdaten und Manchester-Triage Vorab-Einstufung.',
          routes: ['/yeti/patient'],
        },
        {
          name: 'ReceptionDashboard.tsx',
          file: 'apps/frontend/src/pages/ReceptionDashboard.tsx',
          role: 'Empfangs- & Triage-Cockpit',
          details: 'Echtzeit-Monitor für MFA und Notaufnahme-Personal. Zeigt KPI-Kacheln, Manchester-Triage Dringlichkeitsfilter, sortierte Wartezeiten und Detail-Patientenmodal mit 1-Klick-Aufruf.',
          routes: ['/yeti/reception'],
        },
      ],
      features: [
        'Manchester-Triage System (MTS) 5 Dringlichkeitsstufen mit Farbcodes',
        'Dynamischer Fragebogen-Renderer für Schema-Typen (text, textarea, scale, boolean, select)',
        'Touch-optimierte Bedienelemente für Kiosksysteme und Tablets',
        'Mobile-First Responsivität ohne iOS-Auto-Zoom (16px Input Guard)',
      ],
    },
    api: {
      title: 'REST-Schnittstellen & Router',
      summary: 'Vollständig parametrisierte Microkernel-Routen mit strikter Input-Validierung.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/onboarding/patient/:insuranceNumber',
          desc: 'Profil-Lookup für Bestandspatienten mit Historie vergangener Besuche.',
          params: 'insuranceNumber (z.B. A123456780)',
          responseSnippet: '{ success: true, patient: { firstName, lastName, lastVisit, ... } }',
        },
        {
          method: 'GET',
          path: '/api/onboarding/schema',
          desc: 'Lädt das dynamische Anamnese-Fragebogen-Schema für das Empfangsterminal.',
          responseSnippet: '{ success: true, schema: [ { id: "chiefComplaint", type: "textarea", ... } ] }',
        },
        {
          method: 'POST',
          path: '/api/onboarding/submit',
          desc: 'Persistiert Aufnahmevorgänge, erzeugt Falldaten und triggert NEW_PATIENT Event.',
          params: 'JSON Body (patientData, answers, triageLevel, saveProfile)',
          responseSnippet: '{ success: true, intakeId: "intake:172864...", ticketNumber: "T-042" }',
        },
        {
          method: 'GET',
          path: '/api/onboarding/list',
          desc: 'Liefert alle angemeldeten Patientenfälle für das Rezeptions-Cockpit.',
          responseSnippet: '{ success: true, data: [ { id, patientData, triageLevel, admittedAt } ] }',
        },
      ],
      security: 'Dynamisches URL-Matching (matchRoute) im Microkernel mit unregisterPluginRoutes() bei Hot-Unload.',
    },
    data: {
      title: 'Datenmodell & Isolierte Persistenz',
      summary: 'Striktes Datenscoping über PluginDBProxy mit resilientem Memory-Store Fallback.',
      storageType: 'Prisma PluginData (Scoped Key-Value Partitionierung) + In-Memory Fallback Cache',
      schemas: [
        {
          keyPattern: 'intake:<timestamp>_<random>',
          type: 'IntakeRecord (Falldaten)',
          purpose: 'Speichert den konkreten Notaufnahmevorgang mit Antworten, Schmerzscore und MTS-Stufe.',
          sample: '{"chiefComplaint": "Brustenge", "painScale": 8, "triage": "ORANGE", "status": "REGISTERED"}',
        },
        {
          keyPattern: 'patient:<versichertennummer>',
          type: 'PatientProfile (Stammdaten)',
          purpose: 'Persistiert verifizierte Stammdaten für Bestandspatienten zur Beschleunigung von Folgebesuchen.',
          sample: '{"firstName": "Erika", "lastName": "Mustermann", "birthDate": "1984-05-12", "allergies": "Penicillin"}',
        },
        {
          keyPattern: 'form_schema',
          type: 'FormFieldSchema[]',
          purpose: 'Konfigurierbares Schema des Anamnese-Fragebogens für Fachabteilungen.',
        },
      ],
      resilience: 'Autonomer In-Memory Store fängt fehlende native Prisma-Binaries auf (z.B. ARM64 Windows).',
    },
    lifecycle: {
      title: 'Lifecycle-Hooks, Sandbox & Events',
      summary: 'Volle Integration in das MedOS Hot-Swapping ohne Server-Neustart.',
      eventsProduced: ['NEW_PATIENT', 'STATUS_CHANGED'],
      hooks: [
        'onLoad(context): Sandboxing & Registrierung aller REST-Routen',
        'onEnable(): Initialisierung der In-Memory Caches & DB-Bindung',
        'onDisable(): Stoppen aktiver Lese-/Schreibzyklen',
        'onUnload(): Deregistrierung aller Routen aus dem Microkernel',
        'onUninstall(keepData): Soft-Uninstall mit Erhalt von Patientenakten oder DSGVO-Hard-Delete',
      ],
      sandboxing: 'PluginContext ist via Object.freeze() gesichert; direkter DB-Zugriff wird über den PluginDBProxy auf das eigene Plugin-Scope beschränkt.',
    },
  },

  'predictive-scheduling': {
    pluginId: 'predictive-scheduling',
    title: 'Predictive Scheduling & OP-Planung',
    icon: '📅',
    tagline: 'KI-gestützte stochastische Dienst- und OP-Saal-Planung auf Basis von Markov-Entscheidungsprozessen.',
    ui: {
      title: 'Frontend & Interaktionsschicht',
      summary: 'Visuelle Schicht- und Saal-Belegungsmatrix mit vorausschauender Kapazitätsanalyse.',
      components: [
        {
          name: 'ShiftMatrix.tsx',
          file: 'apps/frontend/src/components/scheduling/ShiftMatrix.tsx',
          role: 'Dienstplan- & Belastungsmatrix',
          details: 'Visualisiert Schichtbesetzungen von Fachärzten und Pflegekräften mit Echtzeit-Risikoindikatoren.',
          routes: ['/yeti/scheduling'],
        },
        {
          name: 'OperatingRoomGantt.tsx',
          file: 'apps/frontend/src/components/scheduling/OperatingRoomGantt.tsx',
          role: 'OP-Saal Belegungsplaner',
          details: 'Gantt-Diagramm zur kollisionsfreien Einplanung von Notfall- und Routine-Eingriffen mit Pufferzeiten.',
        },
      ],
      features: [
        'Automatische Warnung bei drohender Schichtüberlastung (Burnout-Index)',
        'Echtzeit-Kopplung an aktuelle Notaufnahme-Zahlen aus patient-onboarding',
        'Stochastische Bedarfsprognose nach Tageszeit und Wochentag',
      ],
    },
    api: {
      title: 'REST-Schnittstellen & Algorithmus-Engine',
      summary: 'Rechenendpunkte zur Lösung der Bellman-Optimalitätsgleichung.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/scheduling/shifts',
          desc: 'Ruft aktuelle Schichtbesetzungen und den aktiven MDP-Zustandsraum ab.',
          responseSnippet: '{ success: true, data: [...], model: { type: "MDP", discountFactor: 0.95 } }',
        },
        {
          method: 'POST',
          path: '/api/scheduling/optimize',
          desc: 'Führt den Bellman-Optimierungsalgorithmus aus und liefert Personal-Empfehlungen.',
          responseSnippet: '{ success: true, optimalAllocation: { recommendedStaff: 2, waitReductionMin: 18.5 } }',
        },
        {
          method: 'GET',
          path: '/api/scheduling/capacity',
          desc: 'Liefert aktuelle Auslastungsquoten aller Betten und OP-Säle.',
        },
      ],
      security: 'Isolierte Rechen-Engine blockiert keine Event-Loop-Zyklen des Microkernel-Kerns.',
    },
    data: {
      title: 'Mathematisches Modell & Persistenz',
      summary: 'Markov-Entscheidungsprozess (MDP) mit Bellman-Optimalitätsgleichung.',
      storageType: 'PluginData (Scoped Key-Value Store) für Schichtmodelle und Dienstpläne',
      schemas: [
        {
          keyPattern: 'shift_plan:<date>',
          type: 'ShiftAllocation',
          purpose: 'Dienstplan-Zuweisungen pro Abteilung mit Risikokoeffizienten.',
        },
        {
          keyPattern: 'mdp_state',
          type: 'MDPState (P_t, M_t)',
          purpose: 'Aktueller Systemzustand: Wartende Patienten (P) vs. aktives Personal (M).',
          sample: '{"waitingPatients": 14, "activeStaff": 8, "alpha": 0.6, "beta": 0.4}',
        },
      ],
      resilience: 'Fallback auf Standard-Besetzungspläne bei Ausfall externer Prognose-Feeds.',
    },
    lifecycle: {
      title: 'Lifecycle & System-Integration',
      summary: 'Abonniert Patienten-Events und passt Schichtpläne dynamisch an.',
      eventsProduced: ['SCHEDULE_OPTIMIZED', 'STAFFING_ALERT'],
      hooks: [
        'onInstall(reportProgress): Kalibrierung der Kostenkoeffizienten',
        'onLoad(context): Registrierung der Rechenrouten',
        'onEnable(): Start der periodischen Kapazitätsprüfung',
      ],
      sandboxing: 'Volle Kapselung im PluginDBProxy; Abhängigkeit zur Zentralen Datenbank aufgelöst.',
    },
  },

  'medos-engine-v2': {
    pluginId: 'medos-engine-v2',
    title: 'Neuro-Symbolic Planning & Simulation Engine',
    icon: 'M',
    tagline: 'Hybride Planungs- & Vorhersage-Engine: MILP Hard-Constraints, Event-Heap Stresstests, Spillover-Memory und ALNS-Feinoptimierung.',
    ui: {
      title: 'Frontend & Interaktionsschicht',
      summary: 'Klinisches Dienstplan-Cockpit, Richtlinien-Manager und Stresstest-Simulator.',
      components: [
        {
          name: 'EnginePlanner.tsx',
          file: 'apps/frontend/src/pages/engine/EnginePlanner.tsx',
          role: 'Planungsmatrix & Dienstplan-Cockpit',
          details: 'Visuelle Schichtbelegung von Fachärzten und MFA im Gantt-Format, Zero-Violation Garantie, MILP-Baseline und ALNS-Metaheuristik mit Simulated Annealing.',
          routes: ['/yeti/engine/planner'],
        },
        {
          name: 'EngineConstraints.tsx',
          file: 'apps/frontend/src/pages/engine/EngineConstraints.tsx',
          role: 'Richtlinien- & Constraint-Manager',
          details: 'Verwaltung von Regeln über alle 5 Domänen (Arbeitsrecht, Medizin, Ergonomie, Datenschutz, Wirtschaftlichkeit) mit Schiebereglern für Penalty-Gewichte.',
          routes: ['/yeti/engine/constraints'],
        },
        {
          name: 'EngineSimulation.tsx',
          file: 'apps/frontend/src/pages/engine/EngineSimulation.tsx',
          role: 'Stresstest & Digitaler Zwilling',
          details: 'Diskrete Ereignissimulation (DES) mit binärem Min-Heap, Schock-Injektion (Notfallwellen, Ausfälle) und Multi-Day Spillover Backlog-Monitoring.',
          routes: ['/yeti/engine/simulation'],
        },
      ],
      features: [
        '100% Zero-Violation Garantie für ArbZG Mindestruhezeiten (>=11h) und Schichtgrenzen',
        'Morning-Rush Nachfrageprognose (1.85x Peak 08:00 - 10:30 Uhr) und No-Show Modellierung',
        'Multi-Day Memory: Automatische Übernahme von Praxisrückstaus auf Folgetage mit Prioritäts-Boost',
        'ALNS Metaheuristik: 60% Penalty-Reduktion in unter 25 Millisekunden',
      ],
    },
    api: {
      title: 'REST-Schnittstellen & Rechen-Engine',
      summary: 'Microkernel-Routen für Baseline-Solver, Vorhersage, Simulation und Optimierung.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/engine/constraints',
          desc: 'Lädt alle aktiven Hard- und Soft-Constraints aus der scoped SQLite-Datenbank.',
          responseSnippet: '{ success: true, data: [ { id: "LABOR-001", type: "Hard_Must_Not", ... } ] }',
        },
        {
          method: 'POST',
          path: '/api/engine/solve-baseline',
          desc: 'Startet den deterministischen MILP-Controller für das unanfechtbare Basisskelett.',
          params: 'JSON Body (startDate, endDate, staffPool)',
          responseSnippet: '{ isFeasible: true, shiftSkeleton: [...], computationTimeMs: 12 }',
        },
        {
          method: 'POST',
          path: '/api/engine/predict-demand',
          desc: 'Berechnet die stochastische Patientenankunft und Peak-Zeiten für einen Tag.',
          params: 'JSON Body (date, baseDailyVolume)',
          responseSnippet: '{ success: true, profile: { totalExpectedPatients: 98, ... } }',
        },
        {
          method: 'POST',
          path: '/api/engine/stress-test',
          desc: 'Führt diskrete Ereignissimulation mit Event-Heap und Schockszenarien aus.',
          params: 'JSON Body (dayId, nextDayId, shocks, staffPool)',
          responseSnippet: '{ success: true, result: { metrics: { resilienceScore: 78, spilloverCount: 0 } } }',
        },
        {
          method: 'POST',
          path: '/api/engine/optimize',
          desc: 'Feinoptimiert Schichtpausen und -verteilung via ALNS Metaheuristik.',
          params: 'JSON Body (shifts, maxIterations, initialTemperature, coolingRate)',
          responseSnippet: '{ success: true, optimization: { improvementPercent: 60, ... } }',
        },
        {
          method: 'GET',
          path: '/api/engine/audit-log',
          desc: 'Liefert den revisionssicheren Audit-Trail mit Prüfsummen.',
          params: 'limit (Standard: 50)',
          responseSnippet: '{ success: true, logs: [ { eventType, summary, hash, ... } ] }',
        },
      ],
      security: 'Deterministische Absicherung: Solver blockiert fehlerhafte Pläne (HTTP 409); Audit-Logger protokolliert alle Aufrufe.',
    },
    data: {
      title: 'Datenmodell & Isolierte Persistenz',
      summary: 'Prisma Scoped Partitionierung über PluginDBProxy mit revisionssicherem Audit.',
      storageType: 'SQLite PluginData (Scoped Partitionierung für medos-engine-v2)',
      schemas: [
        {
          keyPattern: 'constraints:definitions',
          type: 'ConstraintDefinition[]',
          purpose: 'Persistiert Standard- und angepasste Richtlinien über alle 5 Domänen.',
          sample: '[{"id": "LABOR-001", "name": "Mindestruhezeit", "type": "Hard_Must_Not"}]',
        },
        {
          keyPattern: 'schedules:current',
          type: 'ShiftAssignment[]',
          purpose: 'Aktiver und verifizierter Schicht- und Ressourcenplan der Abteilung.',
        },
        {
          keyPattern: 'audit:log:<datum>',
          type: 'AuditEntry[]',
          purpose: 'Revisionssichere Protokollierung aller Berechnungs- und Optimierungsschritte mit SHA256.',
        },
      ],
      resilience: 'Automatische Seed-Initialisierung aus config/default-constraints.json bei Erststart.',
    },
    lifecycle: {
      title: 'Lifecycle & Microkernel Event-Bus',
      summary: 'Nahtloses Hot-Swapping und Echtzeit-Streaming über Server-Sent Events (SSE).',
      eventsProduced: ['ENGINE_STAGE_CHANGED', 'SIMULATION_SPILLOVER_ALERT', 'OPTIMIZATION_RESULT'],
      hooks: [
        'onLoad(context): Sandboxing, DB-Bindung & Registrierung der 6 REST-Routen',
        'onEnable(): Initialisierung der Registry & Bereitschaftsmeldung',
        'onDisable(): Stoppen aktiver Rechenschleifen',
        'onUnload(): Restlose Deregistrierung aller Routen und Services',
      ],
      sandboxing: 'Vollständige Kapselung im PluginDBProxy; Zero-Violation Guard Rail verhindert illegale Dienstpläne.',
    },
  },

  'hl7-fhir-bridge': {
    pluginId: 'hl7-fhir-bridge',
    title: 'HL7 & FHIR Interoperabilitäts-Gateway',
    icon: '🔌',
    tagline: 'Bidirektionale Schnittstelle für KIS, Radiologie-PACS und medizintechnische Großgeräte.',
    ui: {
      title: 'Frontend & Protokoll-Monitor',
      summary: 'Klinischer Nachrichten-Inspektor und FHIR-Ressourcen-Explorer.',
      components: [
        {
          name: 'HL7MessageInspector.tsx',
          file: 'apps/frontend/src/components/hl7/HL7MessageInspector.tsx',
          role: 'Live MSH/PID/OBR Segment-Viewer',
          details: 'Echtzeit-Analyse eingehender HL7 v2 Nachrichten von Laborautomaten und Modalitäten.',
          routes: ['/yeti/hl7'],
        },
        {
          name: 'FHIRResourceExplorer.tsx',
          file: 'apps/frontend/src/components/hl7/FHIRResourceExplorer.tsx',
          role: 'FHIR R4 JSON Studio',
          details: 'Strukturierte Gegenüberstellung von Patient-, Encounter- und Observation-Ressourcen.',
        },
      ],
      features: [
        'Hex- und Segment-Inspektor für MSH, PID, PV1, OBR und OBX Segmente',
        'HL7 v2.x zu FHIR R4 Konvertierungs-Vorschau in Echtzeit',
        'Audit-Trail und TLS 1.3 Verbindungsprotokolle',
      ],
    },
    api: {
      title: 'REST & MLLP Endpunkte',
      summary: 'Bidirektionaler Protokoll-Hub für moderne und klassische Kliniksysteme.',
      endpoints: [
        {
          method: 'GET',
          path: '/api/hl7/status',
          desc: 'Liefert den Verbindungsstatus aller angebundenen KIS- und Geräteschnittstellen.',
          responseSnippet: '{ success: true, protocol: "HL7 v2.5 / FHIR R4", connectedModalities: [...] }',
        },
        {
          method: 'POST',
          path: '/api/hl7/message',
          desc: 'Nimmt rohe HL7 v2 Segmente entgegen und übersetzt sie in MedOS-Falldaten.',
        },
        {
          method: 'GET',
          path: '/api/fhir/Patient/:id',
          desc: 'Standardisierter FHIR R4 Patient-Ressourcenendpunkt.',
        },
      ],
      security: 'Strikte Trennung von Netzwerk-Sockets (MLLP/TCP) und HTTP/2 Kernel-Routen.',
    },
    data: {
      title: 'Datenmodell & Mapping-Registry',
      summary: 'Standardisierte Schemamappings zwischen HL7 v2 Datentypen und FHIR JSON.',
      storageType: 'PluginData (Scoped Key-Value Store) für Schnittstellenkonfiguration & Zertifikate',
      schemas: [
        {
          keyPattern: 'hl7_modality:<id>',
          type: 'ModalityConfig',
          purpose: 'Verbindungsdaten und IP-Whitelists für Modalitäten (CT, MRT, Labor).',
        },
        {
          keyPattern: 'audit_log:<msgId>',
          type: 'AuditTrailEntry',
          purpose: 'Revisionssichere Protokollierung aller übermittelten Befunde (DSGVO Art. 30).',
        },
      ],
      resilience: 'Lokaler Nachrichtenpuffer bei vorübergehender Nichterreichbarkeit des KIS.',
    },
    lifecycle: {
      title: 'Lifecycle & Socket-Management',
      summary: 'Verwaltet asynchrone Kommunikationskanäle zu externen Geräten.',
      eventsProduced: ['HL7_MESSAGE_RECEIVED', 'INTEROP_SYNC_COMPLETED'],
      hooks: [
        'onInstall(progress): Initialisierung der Socket-Listener und Schemadefinitionen',
        'onLoad(context): Einhängen der Gateway-Endpunkte in den Microkernel',
        'onDisable(): Schließen aller offenen TCP-Sockets',
      ],
      sandboxing: 'Externe Netzwerkkommunikation läuft isoliert über definierte Port-Bereiche.',
    },
  },

  'medication-safety': {
    pluginId: 'medication-safety',
    title: 'Arzneimitteltherapiesicherheit (AMTS)',
    icon: '💊',
    tagline: 'Echtzeit-Prüfung von Medikationsplänen auf Wechselwirkungen, Kontraindikationen und Dosierfehler.',
    ui: {
      title: 'Frontend & Sicherheits-Monitor',
      summary: 'Klinischer Interaktions-Check mit visueller Risiko-Matrix.',
      components: [
        {
          name: 'InteractionMatrix.tsx',
          file: 'apps/frontend/src/components/medication/InteractionMatrix.tsx',
          role: 'Wechselwirkungs-Ampel',
          details: 'Visuelle Einstufung von Wirkstoff-Kombinationen in Schweregrade (1 = gering bis 4 = kontraindiziert).',
          routes: ['/yeti/medication'],
        },
        {
          name: 'DosageGuard.tsx',
          file: 'apps/frontend/src/components/medication/DosageGuard.tsx',
          role: 'Pädiatrie- & Nierenfunktions-Rechner',
          details: 'Prüft Maximaldosen anhand von Körpergewicht, Alter und GFR-Laborwerten.',
        },
      ],
      features: [
        'Echtzeit-Abgleich gegen Patientenallergien aus dem Onboarding-Modul',
        'Doppelmedikations-Erkennung (z.B. zwei unterschiedliche NSAR)',
        'Black-Box-Warnungen und Dosisanpassungsempfehlungen',
      ],
    },
    api: {
      title: 'REST-Schnittstellen & Prüfengine',
      summary: 'Hochperformante Prüfendpunkte zur Validierung vor jeder Verordnung.',
      endpoints: [
        {
          method: 'POST',
          path: '/api/medication/check',
          desc: 'Prüft eine Wirkstoffliste auf Wechselwirkungen, Allergien und Kontraindikationen.',
          responseSnippet: '{ success: true, alerts: [], riskLevel: "LOW", checkedSubstances: 3 }',
        },
        {
          method: 'GET',
          path: '/api/medication/allergies/validate',
          desc: 'Validiert verordnete Wirkstoffe gegen im Patientendossier hinterlegte Allergien.',
        },
      ],
      security: 'Deterministische Regelverarbeitung ohne externe Cloud-Abhängigkeit für Patientenschutz.',
    },
    data: {
      title: 'Datenmodell & Wirkstoff-Ontologie',
      summary: 'Lokale AMTS-Wissensbasis mit ATC-Klassifikation und Kontraindikations-Graph.',
      storageType: 'PluginData (Scoped Key-Value Store) für AMTS-Regeln & Verordnungs-Audit',
      schemas: [
        {
          keyPattern: 'interaction_rule:<atc_pair>',
          type: 'InteractionRule',
          purpose: 'Regelsatz für spezifische Wirkstoffpaare mit Evidenzlevel und Handlungsempfehlung.',
        },
        {
          keyPattern: 'prescription_audit:<caseId>',
          type: 'PrescriptionAudit',
          purpose: 'Revisionssichere Aufzeichnung ignorierter oder bestätigter Warnhinweise.',
        },
      ],
      resilience: 'Vollständig offline-fähige Datenbank garantiert Schutz auch bei Netzwerkstörung.',
    },
    lifecycle: {
      title: 'Lifecycle & Verordnungs-Wächter',
      summary: 'Klinkt sich als Wächter in den gesamten Verordnungsprozess ein.',
      eventsProduced: ['DRUG_INTERACTION_ALERT', 'DOSAGE_WARNING'],
      hooks: [
        'onInstall(progress): Indizierung des lokalen Kontraindikations-Graphen',
        'onLoad(context): Bereitstellung der Prüf-Endpunkte',
        'onUninstall(): Sichere Bereinigung temporärer Prüf-Caches',
      ],
      sandboxing: 'Arbeitet ausschließlich mit anonymisierten Wirkstoffcodes (ATC) im isolierten Scope.',
    },
  },
};

/**
 * Erzeugt dynamische Fallback-Architekturdaten für neu installierte oder benutzerdefinierte Plugins.
 */
export function getPluginArchitecture(pluginId: string, fallbackName?: string, routes?: { name: string; path: string }[]): PluginArchitecture {
  if (PLUGIN_ARCHITECTURES[pluginId]) {
    return PLUGIN_ARCHITECTURES[pluginId];
  }

  const name = fallbackName || pluginId;
  const routeList = routes || [];

  return {
    pluginId,
    title: name,
    icon: '🧩',
    tagline: `Dynamisch geladenes Systemmodul '${name}' im MedOS Microkernel.`,
    ui: {
      title: 'Frontend & Interaktionsschicht',
      summary: `Benutzeroberflächen und Screens des Moduls '${name}'.`,
      components: routeList.map((r, i) => ({
        name: `${r.name}.tsx`,
        role: `Klinischer Screen / Modulansicht`,
        details: `Bereitgestellte Ansicht für '${r.name}' mit Pfad ${r.path}.`,
        routes: [r.path],
      })),
      features: [
        `Dynamische Einbindung in die MedOS-Shell über React-Router`,
        `Routen-Schutz durch PluginRouteGuard bei Unload-Zuständen`,
        `Responsive Anpassung an Desktop- und Mobilgeräte`,
      ],
    },
    api: {
      title: 'REST-Schnittstellen & Router',
      summary: `Vom Modul im Microkernel registrierte Endpunkte.`,
      endpoints: [
        {
          method: 'GET',
          path: `/api/${pluginId}/status`,
          desc: `Status- und Healthcheck-Endpunkt für '${name}'.`,
        },
      ],
      security: 'Dynamische Registrierung via context.registerRoute() mit automatischer Bereinigung bei Unload.',
    },
    data: {
      title: 'Datenmodell & Isolierte Persistenz',
      summary: `Isolierter Datenbereich über PluginDBProxy.`,
      storageType: 'Prisma PluginData (Scoped Storage)',
      schemas: [
        {
          keyPattern: `${pluginId}:*`,
          type: 'PluginScopedData',
          purpose: `Persistierung modulspezifischer Daten im gesicherten Namespace '${pluginId}'.`,
        },
      ],
      resilience: 'Vollständige Kapselung verhindert unbefugten Zugriff auf fremde Tabellen.',
    },
    lifecycle: {
      title: 'Lifecycle & Event-Bus',
      summary: `Standardisierter MedOS Plugin-Lebenszyklus.`,
      eventsProduced: [`${pluginId.toUpperCase()}_UPDATE`],
      hooks: [
        'onLoad(context): Sandboxing & Route-Setup',
        'onEnable(): Initialisierung aktiver Dienste',
        'onDisable(): Graceful Shutdown',
        'onUnload(): Bereinigung aller Kernel-Referenzen',
      ],
      sandboxing: 'Eingefrorener PluginContext garantiert Schutz des Kern-Systems.',
    },
  };
}
