import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { handleRequest } from './http.js';
import { initializeAccountStore } from './members.js';

export function startServer(port = Number(process.env.PORT ?? 3456)): Server {
  initializeAccountStore();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    let body: unknown;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim()) {
        try {
          body = JSON.parse(raw) as unknown;
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_json' }));
          return;
        }
      }
    }

    const result = handleRequest(req.method ?? 'GET', url.pathname, body, req.headers);
    const headers = {
      'content-type': 'application/json',
      ...result.headers,
    };
    res.writeHead(result.status, headers);
    if (typeof result.body === 'string') {
      res.end(result.body);
      return;
    }
    res.end(JSON.stringify(result.body));
  });

  server.listen(port, () => {
    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : port;
    process.stdout.write(`library listening on http://localhost:${boundPort}\n`);
  });
  return server;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMainModule()) {
  startServer();
}
