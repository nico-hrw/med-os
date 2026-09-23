import * as path from 'path';
import { PluginLoader } from './core/plugin-loader';
import { startEventServer } from './core/event-stream';

async function bootstrap() {
  console.log('🏔️  MedOS Yeti Kernel initialisiert...');
  
  startEventServer(4000);
  
  // Der /plugins Ordner liegt im Root des Monorepos (3 Ebenen höher: src <- backend <- apps <- medos-yeti)
  const pluginsDir = path.resolve(__dirname, '../../../plugins');
  
  const loader = new PluginLoader(pluginsDir);
  loader.watch();

  console.log('🏔️  MedOS Yeti Kernel aktiv. Warte auf Modul-Ereignisse...');
  
  // Hält den Node.js Prozess am Leben, da der Watcher im Hintergrund asynchron läuft
  setInterval(() => {}, 1000 * 60 * 60);
}

bootstrap().catch((err) => {
  console.error('Kritischer Kernel Fehler:', err);
  process.exit(1);
});
