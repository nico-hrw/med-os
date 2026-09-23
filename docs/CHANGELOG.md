# Changelog

Alle relevanten Änderungen am medOS Yeti Projekt werden in dieser Datei dokumentiert.

## [Unreleased] - 2026-09-23

### Hinzugefügt
- **.gitignore**: Monorepo-weite Git-Ausschlussregeln im Projektstamm (`medos-yeti/` und Workspace-Root) hinzugefügt (`node_modules`, `dist`, `build`, `.env*`, `.DS_Store`, Cache- und Editor-Dateien).
- **medOS.bat**: Zentrales Startskript im Root-Verzeichnis zur Steuerung der Services (`-a`, `-b`, `-f`, `-h`).

### Behoben
- **/topology Route Render-Bug**: 
  - Sichergestellt, dass `reactflow/dist/style.css` importiert ist.
  - Das übergeordnete Wrapper-Element um `<ReactFlow>` zwingend mit `w-full h-full` versehen.
  - Dem `<main>`-Layout in `App.tsx` die Klasse `h-full` zugewiesen, um ein Kollabieren des Canvas-Containers bei relativen Höhenangaben zu verhindern.
  - Tailwind CDN in `index.html` eingebunden, um korrekte Utility-Styles im Browser zu gewährleisten.
