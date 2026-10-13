# MedOS Yeti Plugin-Entwicklerhandbuch & Architektur-Leitfaden

> **Status:** Stabil | **Kernel-Version:** 2.0+ | **Stand:** Oktober 2026

Willkommen im Entwicklerhandbuch für das **MedOS Yeti Pluginsystem**. Dieser Leitfaden erklärt die Architektur des Microkernels, wie neue klinische und operative Plugins erstellt werden, wie die Anbindung an Datenbank, Event-Bus und HTTP-APIs funktioniert, welche Stilvorgaben gelten und welche Sicherheitsmechanismen greifen.

---

## Inhaltsverzeichnis
1. [Architektur & Kernprinzipien](#1-architektur--kernprinzipien)
2. [Verzeichnisstruktur & Systemgrenzen](#2-verzeichnisstruktur--systemgrenzen)
3. [Das Manifest: `plugin.json`](#3-das-manifest-pluginjson)
4. [Der Plugin-Lebenszyklus (`IPlugin`)](#4-der-plugin-lebenszyklus-iplugin)
5. [Die Laufzeitumgebung (`PluginContext`)](#5-die-laufzeitumgebung-plugincontext)
6. [Datenbankzugriff & Scoped Storage (`PluginDBProxy`)](#6-datenbankzugriff--scoped-storage-plugindbproxy)
7. [Frontend-Anbindung & System-Topologie](#7-frontend-anbindung--system-topologie)
8. [Sicherheitsregeln & Stilvorgaben](#8-sicherheitsregeln--stilvorgaben)
9. [Schritt-für-Schritt-Tutorial: Neues Plugin anlegen](#9-schritt-für-schritt-tutorial-neues-plugin-anlegen)

---

## 1. Architektur & Kernprinzipien

MedOS Yeti basiert auf einem **dynamischen Microkernel-Entwurfsmuster**:
- **Minimaler Kern:** Der Kernel (`PluginLoader`, `KernelContext`, `EventStream`) stellt lediglich grundlegende Infrastrukturdienste bereit: HTTP-Routing, Server-Sent Events (SSE), einen internen Event-Bus und kontrollierten DB-Zugriff.
- **Hot-Swapping ohne Server-Neustart:** Plugins können zur Laufzeit im laufenden Klinikbetrieb hinzugefügt, aktualisiert oder deinstalliert werden. Der `PluginLoader` überwacht das Dateisystem und führt Lifecycle-Hooks isoliert aus.
- **Kernel Guard & Crash-Isolation:** Laufzeitfehler, Syntaxfehler oder Ausnahmen innerhalb eines Plugins werden vom Kernel abgefangen und isoliert protokolliert. Ein defektes Plugin kann niemals den gesamten MedOS-Kernel oder andere Fachmodule zum Absturz bringen.
- **Ressourcen-Garantie:** Beim Entladen (`unload`) eines Plugins werden alle registrierten API-Routen, bereitgestellten Services und Event-Subscriptions automatisch und rückstandslos aus dem Kernel deregistriert (keine Memory- oder Route-Leaks).

---

## 2. Verzeichnisstruktur & Systemgrenzen

Im Monorepo existieren zwei Plugin-Verzeichnisse:

```text
medos-yeti/
├── apps/
│   ├── backend/               # Microkernel & Infrastruktur
│   └── frontend/              # React 18 SPA (Terminals, Dashboard, Topologie)
├── plugins-available/         # STORE-TEMPLATES (Vorlagen für verfügbare Plugins)
│   ├── hl7-fhir-bridge/
│   ├── medication-safety/
│   ├── medos-engine-v2/       # Neuro-symbolische Planungs- & Simulations-Engine
│   ├── patient-onboarding/
│   └── predictive-scheduling/
└── plugins/                   # AKTIVE LAUFZEIT-PLUGINS (Live-Instanzen)
    ├── medos-engine-v2/       # Aktives Live-Plugin (v2.0.0)
    ├── patient-onboarding/
    └── predictive-scheduling/
```

- **`plugins-available/`**: Enthält ungebundene Modul-Vorlagen, die im MedOS Plugin-Store angezeigt werden.
- **`plugins/`**: Enthält die aktuell installierten und geladenen Plugins. Das Verzeichnis wird aktiv von Chokidar überwacht. Bei Installation via Plugin-Store wird der Ordner aus `plugins-available/` nach `plugins/` kopiert.

> **Wichtig:** Entwickeln Sie neue Plugins primär in `plugins-available/<ihr-plugin>/` oder direkt in `plugins/<ihr-plugin>/`. Für ein produktionsreifes Modul sollten beide Verzeichnisse synchron gehalten werden.
> **Referenz-Implementierung:** Eine vollständige neuro-symbolische Plugin-Architektur mit MILP-Solver, Digitalem Zwilling und ALNS-Metaheuristik finden Sie in [engine-v2-plugin.md](file:///C:/Users/nicoh/Documents/y2/docs/about/plugins/engine-v2-plugin.md).


---

## 3. Das Manifest: `plugin.json`

Jedes Plugin **muss** im Hauptordner eine gültige `plugin.json` besitzen. Sie definiert die Metadaten, Abhängigkeiten und Einstiegspunkte.

```json
{
  "name": "vital-signs-monitor",
  "version": "1.0.0",
  "description": "Echtzeit-Überwachung kardiovaskulärer Vitalparameter mit automatischer Schock-Index-Warnung.",
  "author": "Kardiologie & Notfallmedizin",
  "icon": "activity",
  "category": "Diagnostik & Monitoring",
  "entry": "index.ts",
  "dependencies": [
    {
      "id": "database-core",
      "name": "Zentrale Datenbank"
    }
  ],
  "routes": [
    {
      "name": "Vitaldaten-Monitor",
      "path": "/yeti/vital-signs"
    }
  ]
}
```

### Feldspezifikation

| Feld | Typ | Pflicht | Beschreibung & Stilvorgaben |
| :--- | :--- | :--- | :--- |
| `name` | `string` | **Ja** | Eindeutige ID im Kebab-Case (`^[a-zA-Z0-9_-]+$`), z.B. `vital-signs-monitor`. Entspricht dem Ordnernamen. |
| `version` | `string` | **Ja** | Semantische Versionierung nach SemVer, z.B. `1.0.0`. |
| `description` | `string` | Nein | Präzise medizinisch-funktionale Beschreibung (Einsatzzweck, Zielgruppe). |
| `author` | `string` | Nein | Entwicklerteam oder Fachabteilung. |
| `icon` | `string` | Nein | Icon-Bezeichner oder Kurzsymbol (z.B. `activity`, `hospital`, `calendar`, `pill`) zur visuellen Darstellung im Store und in der Topologie. |
| `category` | `string` | Nein | Fachbereich (z.B. `Patientenmanagement`, `Diagnostik & Monitoring`, `Ressourcen- & OP-Planung`). |
| `entry` | `string` | **Ja** | Relative Einstiegsdatei, standardmäßig `index.ts`. Muss innerhalb des Plugin-Ordners liegen. |
| `dependencies` | `Array` | Nein | Liste referenzierter Systemkomponenten (z.B. `database-core`). |
| `routes` | `Array` | Nein | Liste der zugehörigen Frontend-Routen für Navigation und Deep-Links. |

---

## 4. Der Plugin-Lebenszyklus (`IPlugin`)

Die Einstiegsdatei (`index.ts`) muss als `default export` eine Klasse exportieren, die das Interface `IPlugin` implementiert.

```typescript
import { 
  IPlugin, 
  PluginContext, 
  InstallProgressCallback 
} from '../../apps/backend/src/interfaces/core-interfaces';

export default class MyPlugin implements IPlugin {
  private context?: PluginContext;

  // 1. Installations-Routine (optional, einmalig beim Deployment aus dem Store)
  async onInstall?(reportProgress: InstallProgressCallback): Promise<void> {
    reportProgress('Erstelle Schemata...', 30);
    // Migrationen oder Seed-Daten vorbereiten...
    reportProgress('Bereit.', 100);
  }

  // 2. Lade-Phase (Initialisierung von Routen, DB, Services)
  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    // Routen und Listener registrieren
  }

  // 3. Aktivierungs-Phase (Bereitschaft für Anfragen)
  async onEnable(): Promise<void> {
    console.log('[MyPlugin] Aktiviert.');
  }

  // 4. Deaktivierungs-Phase (Stoppen von Hintergrundarbeiten)
  async onDisable(): Promise<void> {
    console.log('[MyPlugin] Deaktiviert.');
  }

  // 5. Entlade-Phase (Aufräumen von transienten Daten)
  async onUnload(): Promise<void> {
    console.log('[MyPlugin] Entladen.');
  }

  // 6. Deinstallations-Routine (optional, beim Entfernen aus dem System)
  async onUninstall?(keepData: boolean): Promise<void> {
    console.log(`[MyPlugin] Deinstalliert (keepData=${keepData}).`);
  }
}
```

### Phasen im Detail:
1. **`onInstall`**: Wird aufgerufen, wenn das Plugin über den Store installiert wird. Meldet über `reportProgress(message, percent)` Fortschritte per SSE an die Benutzeroberfläche.
2. **`onLoad`**: Erhält den gesandboxten `PluginContext`. Hier werden HTTP-Routen (`context.registerRoute`) und Services (`context.registerService`) registriert.
3. **`onEnable`**: Signalisiert dem Plugin, dass alle Abhängigkeiten bereit sind und Anfragen verarbeitet werden können.
4. **`onDisable`**: Wird beim Deaktivieren oder vor dem Hot-Reload aufgerufen. Pausiert zeitgesteuerte Aufgaben.
5. **`onUnload`**: Letzte Aufräumarbeiten. Routen und Services werden danach automatisch vom Kernel bereinigt.
6. **`onUninstall`**: Wird vor dem Löschen des Plugin-Ordners aufgerufen. Wenn `keepData === false`, können anwendungsbezogene Restdaten bereinigt werden.

---

## 5. Die Laufzeitumgebung (`PluginContext`)

Jedem Plugin wird eine isolierte Instanz von `PluginContext` injiziert:

```typescript
export interface PluginContext {
  /** Registriert einen Service für andere Plugins oder Kernel-Komponenten */
  registerService(name: string, service: unknown): void;

  /** Bezieht einen registrierten Service (z.B. 'db') */
  getService<T>(name: string): T | undefined;

  /** Registriert eine HTTP-API-Route (z.B. 'GET /api/vitals/current') */
  registerRoute(path: string, handler: unknown): void;

  /** Sendet ein SSE-Broadcast-Event an verbundene Frontend-Clients */
  broadcast(eventType: string, payload: any): void;

  /** Sendet ein internes Event im Kernel/Plugin-Bus */
  emitEvent(eventType: string, payload: any): void;

  /** Abonniert ein internes Event im Bus (automatisch beim Unload bereinigt) */
  onEvent(eventType: string, handler: (payload: any) => void): () => void;
}
```

### Routen-Registrierung (`registerRoute`)
- Syntax: `'<HTTP-METHODE> /api/<pfad>'`
- Parameterisierte Pfade werden voll unterstützt: `'GET /api/vitals/patient/:patientId'`
- **Geschützte Pfade:** System-Routen (`/api/system/*`) und der Event-Stream (`/api/events`) sind geschützt. Versuche, diese zu überschreiben, werden vom Kernel Guard mit einer Exception abgewiesen.

```typescript
context.registerRoute('GET /api/vitals/patient/:patientId', async (req: any, res: any) => {
  const patientId = req.params.patientId;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ patientId, heartRate: 72, spo2: 98 }));
});
```

### Echtzeit-Events (`broadcast`)
Plugins können Statusmeldungen, Vitaldaten-Updates oder Triage-Alarme direkt via Server-Sent Events (SSE) an das Frontend streamen:

```typescript
context.broadcast('VITALS_ALERT', {
  patientId: 'P-1042',
  priority: 'HIGH',
  message: 'SpO2 unter 90% gefallen.',
});
```

---

## 6. Datenbankzugriff & Scoped Storage (`PluginDBProxy`)

Plugins haben keinen unkontrollierten Zugriff auf den gesamten Prisma-Client oder Raw-SQL. Sie erhalten über `context.getService('db')` einen gehärteten **`PluginDBProxy`**.

### Scoped Data Partitioning
Alle Datensätze werden in der gemeinsamen Tabelle `PluginData` gespeichert, sind jedoch kryptografisch/logisch nach `pluginName` partitioniert:

```typescript
const db = context.getService<PluginDBProxy>('db');

if (db) {
  // 1. Einfacher Key-Value Upsert (verhindert Unique-Konflikte)
  await db.upsert('config', JSON.stringify({ threshold: 90 }));

  // 2. Komfortable JSON-Methoden (Automatische Serialisierung & Typisierung)
  await db.setJson('sensor-settings', { refreshRateMs: 1000, alertsEnabled: true });
  const settings = await db.getJson<{ refreshRateMs: number }>('sensor-settings');

  // 3. Nach Key suchen
  const record = await db.findByKey('config');

  // 4. Alle Einträge dieses Plugins auflisten
  const allRecords = await db.findMany();

  // 5. Nach Key löschen
  await db.deleteByKey('sensor-settings');
}
```

### Verfügbare Methoden des `PluginDBProxy`

| Methode | Beschreibung |
| :--- | :--- |
| `upsert(key, payload)` | Erstellt oder aktualisiert einen Datensatz atomar. |
| `getJson<T>(key)` | Liest und parst ein JSON-Objekt; gibt `null` bei Nichtexistenz zurück. |
| `setJson(key, data)` | Serialisiert und speichert ein Objekt als JSON. |
| `findByKey(key)` | Sucht einen Datensatz anhand des eindeutigen Plugin-Keys. |
| `findMany(options?)` | Gibt alle Datensätze des Plugins zurück (inkl. Sortierung). |
| `deleteByKey(key)` | Löscht Einträge anhand des Schlüssels. |
| `count()` | Liefert die Anzahl gespeicherter Datensätze des Plugins. |

---

## 7. Frontend-Anbindung & System-Topologie

Sobald ein Plugin installiert ist, wird es im Frontend automatisch eingebunden:
1. **Plugin-Store (`/yeti/plugins`):** Zeigt das Modul mit Name, Icon, Kategorie, Beschreibung und Aktions-Buttons (`Installieren` / `Deinstallieren`).
2. **System-Topologie (`/yeti/topology`):**
   - Das Plugin erscheint als Live-Knoten im hierarchischen 3-Spalten-Architekturgraph.
   - Per Klick oder Pfeiltasten (`Enter` / Leertaste) lässt sich der Knoten aufklappen und zeigt seine 4 Subkomponenten: **UI-Schicht**, **API-Endpunkte**, **Datenhaltung** und **Lifecycle**.
3. **Echtzeit-Aktualisierung:** Statusänderungen (`LOAD`, `UNLOAD`, `INSTALL_PROGRESS`, `INSTALL_COMPLETE`) werden per SSE übertragen.

---

## 8. Sicherheitsregeln & Stilvorgaben

### Vorgeschriebene Regeln:
1. **Keine internen relativen Backend-Imports:**
   - ❌ **Falsch:** `import { broadcastEvent } from '../../apps/backend/src/core/event-stream';`
   - ✅ **Richtig:** `context.broadcast('EVENT_TYPE', payload);`
   - Plugins dürfen ausschließlich Typen aus `core-interfaces.ts` importieren.
2. **Sichere Plugin-IDs:**
   - Plugin-IDs und Verzeichnisnamen dürfen nur Alphanumerik, Bindestriche und Unterstriche enthalten (`^[a-zA-Z0-9_-]+$`). Keine Leerzeichen, Punkte oder Pfadtrennzeichen (`/`, `\`).
3. **Response-Handling in API-Routen:**
   - Immer `res.writeHead(status, headers)` und `res.end(body)` verwenden.
   - Bei JSON immer `'Content-Type': 'application/json'` und optional `'Content-Length'` setzen.
4. **Fehlerbehandlung:**
   - Eigene Fehler in Route-Handlern mit `try/catch` abfangen. Nicht abgefangene Fehler werden zwar vom Kernel Guard gesichert und mit HTTP 500 beantwortet, sollten aber im Plugin sauber geloggt werden.
5. **Memory-Leak-Vermeidung:**
   - Wenn das Plugin `setInterval` oder Sockets öffnet, müssen diese in `onDisable()` bzw. `onUnload()` zwingend gestoppt werden.

---

## 9. Schritt-für-Schritt-Tutorial: Neues Plugin anlegen

Folgen Sie diesen Schritten, um ein neues Plugin `vital-signs-monitor` zu erstellen:

### Schritt 1: Verzeichnis anlegen
```bash
mkdir -p plugins-available/vital-signs-monitor
```

### Schritt 2: Manifest `plugin.json` anlegen
Erstellen Sie `plugins-available/vital-signs-monitor/plugin.json`:

```json
{
  "name": "vital-signs-monitor",
  "version": "1.0.0",
  "description": "Erfassung und Überwachung klinischer Vitalparameter mit Schock-Index-Berechnung.",
  "author": "Notfallzentrum & Kardiologie",
  "icon": "activity",
  "category": "Diagnostik & Monitoring",
  "entry": "index.ts",
  "dependencies": [
    {
      "id": "database-core",
      "name": "Zentrale Datenbank"
    }
  ],
  "routes": [
    {
      "name": "Vitaldaten-Monitor",
      "path": "/yeti/vital-signs"
    }
  ]
}
```

### Schritt 3: Einstiegscode `index.ts` implementieren
Erstellen Sie `plugins-available/vital-signs-monitor/index.ts`:

```typescript
import { 
  IPlugin, 
  PluginContext, 
  InstallProgressCallback 
} from '../../apps/backend/src/interfaces/core-interfaces';

function sendJson(res: any, statusCode: number, data: any) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Connection': 'keep-alive',
  });
  res.end(body);
}

export default class VitalSignsPlugin implements IPlugin {
  private context?: PluginContext;

  async onInstall(reportProgress?: InstallProgressCallback): Promise<void> {
    if (reportProgress) {
      reportProgress('Kalibriere Vitaldaten-Grenzwerte...', 30);
      reportProgress('Initialisiere Schock-Index-Formel...', 70);
      reportProgress('Vitaldaten-Monitor einsatzbereit.', 100);
    }
  }

  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;

    // Route: Aktuelle Vitalwerte abfragen
    context.registerRoute('GET /api/vitals/current', async (_req: any, res: any) => {
      sendJson(res, 200, {
        success: true,
        data: {
          heartRate: 74,
          bloodPressureSys: 122,
          bloodPressureDia: 78,
          spO2: 98,
          shockIndex: 0.61, // HF / RR_sys (< 0.7 = normal)
          status: 'STABIL',
        },
      });
    });

    // Route: Alarm auslösen & per SSE übertragen
    context.registerRoute('POST /api/vitals/simulate-alert', async (_req: any, res: any) => {
      context.broadcast('VITALS_ALERT', {
        type: 'TACHYCARDIA',
        heartRate: 135,
        timestamp: new Date().toISOString(),
      });

      sendJson(res, 200, { success: true, message: 'Alarm simuliert und übertragen.' });
    });
  }

  async onEnable(): Promise<void> {
    console.log('[VitalSigns] Modul aktiv.');
  }

  async onDisable(): Promise<void> {
    console.log('[VitalSigns] Modul pausiert.');
  }

  async onUnload(): Promise<void> {
    console.log('[VitalSigns] Modul entladen.');
  }
}
```

### Schritt 4: Testen & Aktivieren
1. Öffnen Sie die MedOS Yeti Benutzeroberfläche unter `/yeti/plugins`.
2. Das neue Plugin **Vitaldaten-Monitor** erscheint in den verfügbaren Modulen.
3. Klicken Sie auf **Installieren**.
4. Der Installationsbalken zeigt die gemeldeten Fortschritte an, das Plugin wechselt in den aktiven Zustand und wird automatisch in der Topologie (`/yeti/topology`) eingeblendet.
