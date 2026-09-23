import * as http from 'http';

// Set für alle aktuell verbundenen SSE-Clients
const clients = new Set<http.ServerResponse>();

/**
 * Startet einen rudimentären HTTP-Server exklusiv für Server-Sent Events.
 */
export function startEventServer(port: number = 4000) {
  const server = http.createServer((req, res) => {
    // Erlaube Cross-Origin-Requests, da das Vite-Frontend meist auf Port 5173 läuft
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.url === '/api/events') {
      // Setze zwingende SSE-Header
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Sende ein initiales CONNECTED-Event
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

      // Client im Speicher registrieren
      clients.add(res);

      req.on('close', () => {
        clients.delete(res);
      });
    } else {
      res.writeHead(404);
      res.end();
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
  for (const client of clients) {
    client.write(payload);
  }
}
