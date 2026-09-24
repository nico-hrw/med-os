# Changelog

Alle relevanten Änderungen am medOS Yeti Projekt werden in dieser Datei dokumentiert.

## [Unreleased] - 2026-09-24

### Behoben
- **Weiße Seiten bei Patienten-Onboarding und Empfangs-Dashboard behoben**:
  - `PatientOnboarding.tsx`: Neues Frontend-Formular für strukturierte Patienten-Erstaufnahme und Manchester-Triage-System (MTS) mit 5 Dringlichkeitsstufen, biometrischer Datenerfassung und Sofort-Übermittlung an den Kernel (`/yeti/api/onboarding/submit`).
  - `ReceptionDashboard.tsx`: Neues Live-Dashboard für das Empfangspersonal mit KPI-Kacheln, Triage-Filter, Patientensuche, Detail-Modal und nativer Echtzeit-Aktualisierung über SSE (`NEW_PATIENT`).
  - Routen `/patient` und `/reception` in `App.tsx` registriert sowie ein `<Route path="*" element={<Navigate to="/" replace />} />` Fallback eingerichtet, um ungemountete weiße Seiten künftig prinzipiell auszuschließen.
  - In-Memory Fallback im `patient-onboarding` Plugin implementiert, damit Aufnahme- und Abfrage-Routen auch auf Systemen ohne aktiven Prisma-DB-Client stets einsatzbereit sind.
- **Zentraler EventProvider & Beseitigung des HTTP/1.1 Socket-Exhaustion-Bugs (Freeze nach ~7 Klicks)**:
  - `EventContext.tsx` & `EventProvider`: Zentraler SSE-Provider auf App-Ebene (`App.tsx`) eingeführt. Hält genau eine einzige persistente SSE-Verbindung für die gesamte Anwendungslebensdauer offen. Unterseiten (`Dashboard`, `PluginManager`, `TopologyMap`, `ReceptionDashboard`) abonnieren Kernel-Events über den `useKernelEvents`-Hook, anstatt bei jeder Navigation eine eigene `EventSource` auf- und abzubauen.
  - Verhindert das Erreichen des browserseitigen HTTP/1.1-Connection-Limits (max. 6 TCP-Sockets pro Host), wodurch `fetch()`-Requests im Plugin-Manager und in der System-Topologie nie wieder blockiert/gestallt werden.
  - Backend `event-stream.ts`: Explizites `res.end()` bei Verbindungsabbruch (`req.on('close')`) und Hinzufügen von `X-Accel-Buffering: no` für Nginx-Reverse-Proxies implementiert, um serverseitige hängende Sockets zu eliminieren.
- **Kritischer Fehler: React App wurde nicht in den DOM gemountet**:
  - `src/main.tsx` als React-Entrypoint mit `ReactDOM.createRoot(document.getElementById('root')!).render(<App />)` erstellt.
  - `index.html` auf `/src/main.tsx` umgestellt (zuvor wurde lediglich `App.tsx` geladen, welches keine DOM-Montage durchführte und somit eine weiße Seite hinterließ).
  - Defensive Mindesthöhen (`min-h-[600px]` und `min-h-[500px]`) in `TopologyMap.tsx` definiert, um Canvas-Kollabieren unter allen Umständen auszuschließen.
  - Explizite `react` & `react-dom` Einträge in `dependencies` abgesichert.

### Hinzugefügt
- **Einheitliche Plugin-Karten & Von rechts einfliegender Detail-Drawer**:
  - `PluginManager.tsx`: Wechsel auf gleich große Kästchen (`h-[260px]`, 3 Spalten) mit kompakter 2-zeiliger Beschreibung, um Textüberfrachtung zu vermeiden.
  - Neuer seitlicher Slide-over Drawer im Plugin Store: Klick auf ein beliebiges Plugin öffnet ein von rechts einfliegendes Detail-Panel mit vollständiger Beschreibung, Versionshistorie, Abhängigkeiten, direkt klickbaren Routen-Links und Installationssteuerungen.
  - `CustomNode.tsx` & `layout.ts`: System-Topologie-Knoten auf einheitliche feste Maße (280x140px) und 2-zeilige Kurztexte umgestellt. Details und Routen werden bei Klick im `InfoPanel` von rechts präsentiert.
  - `Sidebar.tsx`: Navigation um die Sektion "Klinische Module" mit Direktlinks zu "Patientenaufnahme" und "Empfangs-Dashboard" erweitert.
- **Vite Subpfad-Konfiguration (`/yeti/`)**:
  - `apps/frontend/vite.config.ts` mit `base: '/yeti/'`, `allowedHosts: true`, React-Plugin und Server-Port 5173 angelegt.
  - `apps/frontend/tsconfig.json` und `apps/frontend/src/vite-env.d.ts` für vollständige TypeScript-Unterstützung und Typüberprüfung erstellt.
- **Server Deployment & Automatisierung**:
  - `yeti.sh`: Linux PM2 Management-Skript auf dem Server für automatisches Pulling, Node 20 Environment, Build und Service-Management (`-a`, `-b`, `-f`, `-s`, `-k`, `status`, `logs`).
  - `deploy.bat`: Windows One-Click Deploy Skript für Commit, Push und Remote-Deployment via SSH.
  - Nginx Reverse-Proxy auf `go-tide.app` eingerichtet (`/yeti/` -> Vite Dev Server :5173, `/yeti/api/` -> SSE Kernel :4000).
- **.gitignore**: Monorepo-weite Git-Ausschlussregeln im Projektstamm hinzugefügt (`node_modules`, `dist`, `build`, `.env*`, `.DS_Store`, Cache- und Editor-Dateien).
- **medOS.bat**: Zentrales lokales Startskript im Root-Verzeichnis zur Steuerung der Services (`-a`, `-b`, `-f`, `-h`).

### Geändert
- **React Router Basename**: `<Router basename="/yeti">` in `App.tsx` konfiguriert.
- **EventSource (SSE) Endpunkte**: SSE-Verbindungsaufrufe in `Dashboard.tsx` und `TopologyMap.tsx` auf `/yeti/api/events` umgestellt.
