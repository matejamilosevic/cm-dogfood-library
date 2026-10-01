import { createServer } from 'node:http';
import { handleRequest } from './http.js';

const port = Number(process.env.PORT ?? 3456);

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

  const result = handleRequest(req.method ?? 'GET', url.pathname, body);
  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result.body));
});

server.listen(port, () => {
  process.stdout.write(`library listening on http://localhost:${port}\n`);
});
