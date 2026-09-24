import * as http from 'http';

// Set für alle aktuell verbundenen SSE-Clients
const clients = new Set<http.ServerResponse>();

// Speichert alle registrierten API-Routen (Methode + Pfad)
export const apiRoutes = new Map<string, Function>();

export function registerApiRoute(methodAndPath: string, handler: Function) {
  apiRoutes.set(methodAndPath, handler);
}

export function unregisterApiRoute(methodAndPath: string) {
  apiRoutes.delete(methodAndPath);
}

// Heartbeat-Intervall alle 15 Sekunden: Erkennt verwaiste Sockets (z.B. nach Reloads oder Netzwerkabbrüchen)
// und bereinigt sie sofort, sodass der HTTP-Connection-Pool niemals erschöpft.
setInterval(() => {
  for (const client of Array.from(clients)) {
    try {
      client.write(': ping\n\n');
    } catch {
      clients.delete(client);
      try { client.end(); } catch {}
    }
  }
}, 15000);

interface RouteMatch {
  handler: Function;
  params: Record<string, string>;
}

function matchRoute(method: string, urlPath: string): RouteMatch | null {
  const directKey = `${method} ${urlPath}`;
  if (apiRoutes.has(directKey)) {
    return { handler: apiRoutes.get(directKey)!, params: {} };
  }

  // Parameterisierte Routen testen (z.B. GET /api/onboarding/patient/:insuranceNumber)
  const incomingParts = urlPath.split('/').filter(Boolean);

  for (const [routePattern, handler] of apiRoutes.entries()) {
    const spaceIndex = routePattern.indexOf(' ');
    if (spaceIndex === -1) continue;
    const routeMethod = routePattern.substring(0, spaceIndex);
    const routePath = routePattern.substring(spaceIndex + 1);

    if (routeMethod !== method) continue;

    const patternParts = routePath.split('/').filter(Boolean);
    if (patternParts.length !== incomingParts.length) continue;

    const params: Record<string, string> = {};
    let matches = true;

    for (let i = 0; i < patternParts.length; i++) {
      const pPart = patternParts[i];
      const inPart = incomingParts[i];

      if (pPart.startsWith(':')) {
        const paramName = pPart.slice(1);
        params[paramName] = decodeURIComponent(inPart);
      } else if (pPart !== inPart) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { handler, params };
    }
  }

  return null;
}

/**
 * Startet einen rudimentären HTTP-Server exklusiv für Server-Sent Events und dynamische API-Routen.
 */
export function startEventServer(port: number = 4000) {
  const server = http.createServer((req, res) => {
    // Erlaube Cross-Origin-Requests, da das Vite-Frontend meist auf Port 5173 läuft
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Content-Length': '0',
        'Connection': 'keep-alive',
      });
      res.end();
      return;
    }

    const urlPath = req.url?.split('?')[0];
    const methodAndPath = `${req.method} ${urlPath}`;

    if (urlPath === '/api/events') {
      // Setze zwingende SSE-Header
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Sende ein initiales CONNECTED-Event
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

      // Client im Speicher registrieren
      clients.add(res);

      const cleanup = () => {
        clients.delete(res);
        try {
          res.end();
        } catch {
          // Verbindung bereits geschlossen
        }
      };

      req.on('close', cleanup);
      req.on('error', cleanup);
      res.on('error', cleanup);
    } else {
      const routeMatch = matchRoute(req.method || 'GET', urlPath || '/');
      if (routeMatch) {
        (req as any).params = routeMatch.params;
        routeMatch.handler(req, res);
      } else {
        const notFoundBody = JSON.stringify({ error: 'Not Found', path: urlPath });
        res.writeHead(404, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(notFoundBody),
          'Connection': 'keep-alive',
        });
        res.end(notFoundBody);
      }
    }
  });

  server.listen(port, () => {
    console.log(`[EventStream] SSE Server aktiv auf Port ${port}`);
  });
}

/**
 * Sendet ein standardisiertes Event an alle verbundenen Clients.
 */
export function broadcastEvent(type: string, data: any) {
  const payload = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const client of Array.from(clients)) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}
