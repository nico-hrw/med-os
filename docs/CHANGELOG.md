# Changelog

Alle relevanten Änderungen am medOS Yeti Projekt werden in dieser Datei dokumentiert.

## [Unreleased] - 2026-09-24

### Hinzugefügt
- **Vite Subpfad-Konfiguration (`/yeti/`)**:
  - `apps/frontend/vite.config.ts` mit `base: '/yeti/'`, React-Plugin und Server-Konfiguration angelegt.
  - `apps/frontend/tsconfig.json` und `apps/frontend/src/vite-env.d.ts` für vollständige TypeScript-Unterstützung und Typüberprüfung erstellt.
- **.gitignore**: Monorepo-weite Git-Ausschlussregeln im Projektstamm hinzugefügt (`node_modules`, `dist`, `build`, `.env*`, `.DS_Store`, Cache- und Editor-Dateien).
- **medOS.bat**: Zentrales Startskript im Root-Verzeichnis zur Steuerung der Services (`-a`, `-b`, `-f`, `-h`).

### Geändert
- **React Router Basename**: `<Router basename="/yeti">` in `App.tsx` konfiguriert.
- **EventSource (SSE) Endpunkte**: SSE-Verbindungsaufrufe in `Dashboard.tsx` und `TopologyMap.tsx` auf `/yeti/api/events` umgestellt.

### Behoben
- **/topology Route Render-Bug**: 
  - CSS-Import `reactflow/dist/style.css` und `w-full h-full` Parent-Container für React Flow sichergestellt.
  - `<main>`-Layout in `App.tsx` mit `h-full` versehen.
  - Typisierungsfehler in `layout.ts` durch Nutzung des `Position`-Enums behoben.
