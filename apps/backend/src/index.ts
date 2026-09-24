import * as path from 'path';
import * as http from 'http';
import { PluginLoader } from './core/plugin-loader';
import { startEventServer, registerApiRoute } from './core/event-stream';
import { DatabaseService } from './core/db';

/**
 * Liest den Body eines HTTP-Requests als JSON.
 */
function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

/**
 * Sendet eine standardisierte JSON-Antwort mit explizitem Content-Length Header.
 * Verhindert das Schließen von Keep-Alive Sockets im HTTP/1.1 Stack.
 */
function sendJsonResponse(res: any, statusCode: number, data: any) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Connection': 'keep-alive',
  });
  res.end(body);
}

async function bootstrap() {
  console.log('🏔️  MedOS Yeti Kernel initialisiert...');
  
  startEventServer(4000);
  
  // Der /plugins Ordner liegt im Root des Monorepos (3 Ebenen höher: src <- backend <- apps <- medos-yeti)
  const pluginsDir = path.resolve(__dirname, '../../../plugins');
  
  const loader = new PluginLoader(pluginsDir);
  
  // Register database service (may be null on ARM64 Windows where Prisma engine isn't available)
  const dbClient = await DatabaseService.getClient();
  if (dbClient) {
    loader.registerService('db', dbClient);
  } else {
    console.warn('[Kernel] DB-Service nicht verfügbar — Plugins ohne Datenbankzugriff.');
  }

  // ─────────────────────────────────────────────────────────────
  //  System-API: Plugin-Store Routen
  // ─────────────────────────────────────────────────────────────

  registerApiRoute('GET /api/system/plugins/available', async (_req: any, res: any) => {
    try {
      const available = await loader.getAvailablePlugins();
      sendJsonResponse(res, 200, { success: true, data: available });
    } catch (err: any) {
      sendJsonResponse(res, 500, { error: err.message });
    }
  });

  registerApiRoute('GET /api/system/plugins/active', async (_req: any, res: any) => {
    try {
      const loaded = loader.getLoadedPlugins();
      const active = Array.from(loaded.entries()).map(([name, p]) => ({
        name,
        version: p.manifest.version,
        description: p.manifest.description,
        author: p.manifest.author,
        icon: p.manifest.icon,
        category: p.manifest.category,
        dependencies: p.manifest.dependencies || [],
        routes: p.manifest.routes || [],
      }));
      sendJsonResponse(res, 200, { success: true, data: active });
    } catch (err: any) {
      sendJsonResponse(res, 500, { error: err.message });
    }
  });

  registerApiRoute('POST /api/system/plugins/install', async (req: any, res: any) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const queryPluginId = url.searchParams.get('pluginId');

      let body: any = {};
      try {
        body = await parseJsonBody(req);
      } catch { /* optionaler Body */ }

      const pluginId = body.pluginId || queryPluginId;

      if (!pluginId || typeof pluginId !== 'string') {
        sendJsonResponse(res, 400, { error: 'pluginId ist erforderlich.' });
        return;
      }

      // Sofortige Antwort — die eigentliche Installation läuft asynchron mit SSE-Feedback
      sendJsonResponse(res, 202, { success: true, message: `Installation von '${pluginId}' gestartet.` });

      // Installation im Hintergrund starten (Fehler werden via SSE gemeldet)
      loader.installPlugin(pluginId).catch(err => {
        console.error(`[Kernel] Unerwarteter Fehler in installPlugin:`, err);
      });

    } catch (err: any) {
      sendJsonResponse(res, 500, { error: err.message });
    }
  });

  registerApiRoute('DELETE /api/system/plugins/uninstall', async (req: any, res: any) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const queryPluginId = url.searchParams.get('pluginId');
      const queryKeepData = url.searchParams.get('keepData');

      let body: any = {};
      try {
        body = await parseJsonBody(req);
      } catch { /* optionaler Body */ }

      const pluginId = body.pluginId || queryPluginId;
      const keepData = body.keepData !== undefined 
        ? Boolean(body.keepData) 
        : (queryKeepData !== null ? queryKeepData !== 'false' : true);

      if (!pluginId || typeof pluginId !== 'string') {
        sendJsonResponse(res, 400, { error: 'pluginId ist erforderlich.' });
        return;
      }

      await loader.uninstallPlugin(pluginId, keepData);

      sendJsonResponse(res, 200, { 
        success: true, 
        message: `Plugin '${pluginId}' erfolgreich deinstalliert (keepData=${keepData}).` 
      });
    } catch (err: any) {
      console.error(`[Kernel] Fehler beim Deinstallieren von Plugin:`, err.message);
      sendJsonResponse(res, 500, { error: err.message });
    }
  });

  // Watcher starten (überwacht nur plugins/, nicht plugins-available/)
  loader.watch();

  console.log('🏔️  MedOS Yeti Kernel aktiv. Warte auf Modul-Ereignisse...');
  
  // Hält den Node.js Prozess am Leben, da der Watcher im Hintergrund asynchron läuft
  setInterval(() => {}, 1000 * 60 * 60);
}

bootstrap().catch((err) => {
  console.error('Kritischer Kernel Fehler:', err);
  process.exit(1);
});
