# Changelog

Alle relevanten Änderungen am medOS Yeti Projekt werden in dieser Datei dokumentiert.

## [Unreleased] - 2026-10-11

### Hinzugefügt
- **Revamp der System-Topologie & Aufklappbare Modul-Architektur (`TopologyMap.tsx`)**:
  - **Reale System-Infrastruktur statt Dummy-Knoten**:
    - Der bisherige Test-Knoten `database-core` ("⚠️ Fehlt") wurde vollständig durch den tatsächlichen Infrastruktur-Knoten `Zentrale Datenbank (Prisma Layer)` abgelöst.
    - Vollständige Einbindung der MedOS System-Infrastruktur: `Microkernel Core` (Event-Bus, Port 4000), `Zentrale Datenbank` (Prisma ORM Scoped Data Partitioning), `Nginx Gateway & Proxy` (SSL/TLS 1.3, HTTP/2, SSE Stream Bypass) und `Klinische Terminals & SPA` (React 18, persistenter EventContext).
  - **Schmales vertikales Mehrspalten-Layout & Lesbarkeits-Optimierung (`layout.ts`)**:
    - Das bisherige horizontale Ausufern über mehrere Bildschirmbreiten wurde durch eine deterministische 2-Spalten-Architektur ("schmal nach unten") abgelöst: Linke Spalte für die vertikal gestapelte Infrastruktur (`database-core`, `nginx-gateway`, `frontend-spa`), rechte Spalte für klinische Plugins und deren hierarchisch darunter eingerückte Sub-Komponenten.
    - Maximale Gesamtbreite des Graphen auf ~680px begrenzt. Dadurch entfällt das unleserliche Herauszoomen vollständig.
    - **Großes, zentriertes Fokus-Zooming**: Die Topologie startet nun direkt lesbar herangezoomt (`zoom: 0.95`). Klicks oder Tastatur-Fokussierungen zentrieren den Zielknoten weich (`setCenter()`) bei optimaler Lesbarkeit.
  - **Interaktive Pfeiltasten-Navigation (`↑`, `↓`, `←`, `→`)**:
    - Nutzer können den Verbindungen und hierarchischen Relationen des Graphen direkt über die Pfeiltasten folgen:
      - `↓` (Pfeil nach unten): Folgt ausgehenden Kanten zu Kind-Knoten (z.B. vom Plugin zu den Subkomponenten `UI` -> `API` -> `Data` -> `Lifecycle`) oder wechselt zum nächsten Knoten darunter.
      - `↑` (Pfeil nach oben): Folgt eingehenden Kanten zu Elternknoten (z.B. von Subkomponente zurück zum Plugin oder zum Microkernel).
      - `→` / `←` (Pfeil rechts/links): Springt horizontal zwischen der Infrastruktur- und der Plugin-Spalte hin und her.
      - `Enter` / `Leertaste`: Klappt den Aufbau des aktuell fokussierten Plugins auf oder zu.
      - Sichtbarer Tastatur-Hinweis (`⌨️ Pfeiltasten ↑ ↓ ← →`) in der Kopfleiste integriert.
  - **Interaktives Plugin-Aufklappen ("Aufbau erklären")**:
    - Jedes Plugin (sowohl aktive Module als auch Store-Erweiterungen) besitzt nun einen direkten Toggle-Button `[ 🔍 Aufbau aufklappen ]` / `[ ▲ Aufbau einklappen ]`.
    - Beim Aufklappen entfaltet sich das Plugin im ReactFlow-Graphen hierarchisch in 4 dedizierte Architektur-Subkomponenten:
      1. `[UI-Schicht]` (Indigo `#6366f1`): Screens & Views (z.B. `PatientForm.tsx`, `ReceptionDashboard.tsx`), MTS Triage Flow, Touch-Optimierung.
      2. `[REST-API]` (Sky `#0284c7`): Registrierte Microkernel-Endpunkte mit Parametern, HTTP-Methoden und Antwort-Snippets.
      3. `[Datenmodell]` (Amber `#d97706`): Scoped Storage über `PluginDBProxy`, Key-Patterns (`intake:*`, `patient:*`), In-Memory Resilienz.
      4. `[Lifecycle]` (Emerald `#059669`): Broadcast SSE-Events (`NEW_PATIENT`, etc.), Lifecycle-Hooks (`onLoad`, `onEnable`, `onUninstall`), Context-Sandboxing (`Object.freeze`).
    - Animierte, farbcodierte Kanten verbinden das Plugin mit seinen Sub-Komponenten.
  - **Erweiterte Werkzeugleiste & Filter**:
    - Filter-Tabs: `Alle Komponenten`, `Klinische Module`, `Nur Aktive`, `Infrastruktur & Core`.
    - Globale Schnellsteuerungen: `[ Alle Plugins aufklappen ]`, `[ Alle einklappen ]`, `[ Ansicht zentrieren ]`.
    - Live-Suche zur sofortigen Hervorhebung passender Knoten.
    - Übersichtliche Farb-Legende für alle Knotentypen und Architektur-Schichten.
  - **Interaktiver InfoPanel Architektur-Explorator (`InfoPanel.tsx`)**:
    - Klick auf einen Plugin-Knoten öffnet eine tabulierte Übersicht mit Direktzugriff auf UI, API, Datenmodell und Lifecycle sowie einen Button zum synchronen Aufklappen im Graphen.
    - Klick auf einen Komponenten-Subknoten öffnet einen tiefgehenden Drilldown mit Source-Dateien, Endpunkten, Schemadefinitionen und Sicherheitsaspekten.
  - **Reales Plugin-Ökosystem**:
    - `predictive-scheduling`: Stochastische Dienst- und OP-Planung mit Bellman/MDP-Modell als aktives Plugin integriert.
    - `hl7-fhir-bridge`: Interoperabilitäts-Gateway (HL7 v2 / FHIR R4) im Plugin-Store bereitgestellt.
    - `medication-safety`: AMTS-Prüfmodul für Wechselwirkungen und Patientensicherheit im Plugin-Store bereitgestellt.

## [Unreleased] - 2026-09-24

### Hinzugefügt
- **Patient Onboarding Revamp & Dynamischer Anamnese-Fragebogen (`patient-onboarding`)**:
  - `event-stream.ts`: Dynamische Routen-Erkennung (`matchRoute()`) im Microkernel implementiert. Parameter wie `:insuranceNumber` werden automatisch extrahiert und als `req.params` an Plugin-Routen übergeben.
  - `plugins/patient-onboarding/index.ts`:
    - `GET /api/onboarding/patient/:insuranceNumber`: Profil-Lookup für Bestandspatienten nach `patient:<insuranceNumber>` mit Historie (`lastVisit`, `upcomingAppointment`) und 404-Fallback.
    - `GET /api/onboarding/schema` & `POST /api/onboarding/schema`: Dynamische Verwaltung und Speicherung des Formular-Schemas in `PluginData` (`key = 'form_schema'`) mit Fallback auf Standardfelder (Beschwerden [textarea], Schmerzskala [scale 1-10], Allergien, Dauermedikation, Schwangerschaft).
    - `POST /api/onboarding/submit`: Persistiert Aufnahmevorgänge (`intake:<id>`) mit Status `REGISTERED`, speichert bei `saveProfile === true` das Patientenprofil für Folgebesuche und triggert das Kernel-SSE-Event `NEW_PATIENT`.
  - `PatientForm.tsx` (`PatientOnboarding.tsx`):
    - Mehrstufiger Self-Service-Flow im Soft-UI-Design (`bg-[#FAFAF9]`, Glassmorphism, Weichzeichner).
    - Willkommens-Screen mit zwei Wegen: [A] Bestandspatienten-Login per Versichertennummer mit automatischer Begrüßungskarte und Überspringen der Stammdaten sowie [B] Neuanmeldung.
    - Dynamischer Fragebogen-Renderer für Schema-Typen `text`, `textarea`, `scale` (1-10 mit Farbcodes), `boolean` (Touch-Toggles) und `select`.
    - Abschluss-Bildschirm mit "Daten merken"-Checkbox (`saveProfile`) und animiertem Erfolgs-Screen samt Aufruf-Ticket.
  - `ReceptionDashboard.tsx`: Adapter zur nahtlosen Anzeige strukturierter Formularantworten im Empfangs-Dashboard.

### Behoben
- **Dynamisches Plugin-Lifecycle & Route-Guarding bei deinstallierten Modulen**:
  - `plugin-loader.ts` & `event-stream.ts`: `KernelContext` deregistriert beim Unload oder Deinstallieren eines Plugins nun automatisch alle registrierten API-Routen (`unregisterPluginRoutes(name)`). Aufrufe an Endpunkte deinstallierter Module (z.B. `/api/onboarding/submit`, `/api/onboarding/list`) laufen künftig ins reguläre 404 mit standardisiertem JSON-Body und `Content-Length`.
  - `PluginRouteGuard.tsx`: Neuer Routen-Wächter für dynamische Plugin-Oberflächen (`/patient`, `/reception`). Verhindert das Aufrufen ungemounteter Inhalte nach einer Modul-Deinstallation und präsentiert dem Nutzer stattdessen eine elegante Status-Meldung ("Modul nicht aktiv") mit 1-Klick-Link zur Reinstallation im Plugin-Store.
  - `Sidebar.tsx`: Zeigt Links zu klinischen Modulen unter "Klinische Module" nur noch dann dynamisch an, wenn das zugehörige Plugin geladen und aktiv ist.
- **Dauerhafte Beseitigung des Verbindungs-Freeze (Socket-Exhaustion & SSE-Orphans)**:
  - `event-stream.ts`: 15-Sekunden Ping-Heartbeat (`: ping\n\n`) für alle aktiven SSE-Clients implementiert. Erkennt verwaiste TCP-Sockets nach Browser-Reloads oder Tab-Schließungen sofort und bereinigt sie zuverlässig aus dem Client-Pool.
  - Standardisierte HTTP-Response-Header mit expliziter `Content-Length` und `Connection: keep-alive` auf allen API-Routen, 404- und OPTIONS-Preflight-Antworten ergänzt, um vorzeitige Schließungen von Keep-Alive-Sockets im Reverse-Proxy zu verhindern.
  - Nginx auf `go-tide.app` auf `listen 443 ssl http2;` umgestellt und SSE-Streaming isoliert auf `/yeti/api/events` geführt.
- **Weiße Seiten bei Patienten-Onboarding und Empfangs-Dashboard behoben**:
  - `PatientOnboarding.tsx`: Neues Frontend-Formular für strukturierte Patienten-Erstaufnahme und Manchester-Triage-System (MTS) mit 5 Dringlichkeitsstufen, biometrischer Datenerfassung und Sofort-Übermittlung an den Kernel (`/yeti/api/onboarding/submit`).
  - `ReceptionDashboard.tsx`: Neues Live-Dashboard für das Empfangspersonal mit KPI-Kacheln, Triage-Filter, Patientensuche, Detail-Modal und nativer Echtzeit-Aktualisierung über SSE (`NEW_PATIENT`).
  - Routen `/patient` und `/reception` in `App.tsx` registriert sowie ein `<Route path="*" element={<Navigate to="/" replace />} />` Fallback eingerichtet, um ungemountete weiße Seiten künftig prinzipiell auszuschließen.
  - In-Memory Fallback im `patient-onboarding` Plugin implementiert, damit Aufnahme- und Abfrage-Routen auch auf Systemen ohne aktiven Prisma-DB-Client stets einsatzbereit sind.
- **Zentraler EventProvider & Beseitigung des HTTP/1.1 Socket-Exhaustion-Bugs**:
  - `EventContext.tsx` & `EventProvider`: Zentraler SSE-Provider auf App-Ebene (`App.tsx`) eingeführt. Hält genau eine einzige persistente SSE-Verbindung für die gesamte Anwendungslebensdauer offen. Unterseiten (`Dashboard`, `PluginManager`, `TopologyMap`, `ReceptionDashboard`) abonnieren Kernel-Events über den `useKernelEvents`-Hook, anstatt bei jeder Navigation eine eigene `EventSource` auf- und abzubauen.

### Hinzugefügt
- **Mobile-First App-Shell & Responsives Seiten-Gerüst**:
  - `App.tsx`: Mobiler Sticky-Header (`md:hidden`) mit Logo, System-Status und Hamburger-Button (`☰` / `✕`) sowie ein leichtgängig einfliegender Drawer mit Weichzeichner-Backdrop für kleine Bildschirme integriert.
  - `PatientOnboarding.tsx`: Responsives Gerüst mit touch-optimierten Triage-Karten (`grid-cols-2 sm:grid-cols-3 md:grid-cols-5`), adaptiven Abständen (`p-5 sm:p-8`) und nativer 16px-Schriftart zur Vermeidung des automatischen iOS-Safari-Zooms.
  - `ReceptionDashboard.tsx`: Vollständig responsive Überwachung mit stapelbaren Filtern und Aktions-Buttons.
- **Plugin Store: Vertikale Listenansicht statt Collage**:
  - `PluginManager.tsx`: Wechsel vom 3-Spalten-Würfel-Raster zu einer geordneten, vertikal gestapelten Liste einheitlicher Modul-Einträge. Bietet Direktübersicht über Icon, Version, Kategorie, 2-zeilige Beschreibung, Routen-Badges und Schnell-Aktionen; Klick öffnet das Detail-Drawer.
- **System-Topologie: Dynamische Verschiebung der Graph-Struktur nach links**:
  - `TopologyMap.tsx`: Klick auf einen Knoten löst eine weiche CSS-Margintransformation (`mr-0 lg:mr-[30rem]`) des ReactFlow-Canvas aus und zentriert den Graphen via animiertem `fitView({ duration: 500 })` automatisch im sichtbaren linken Bereich, sodass die Struktur nicht mehr vom InfoPanel verdeckt wird.
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
