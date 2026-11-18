// Local preview with search: serves mco.dev/static on http://localhost:4175 and
// answers /api/sheet with mco.dev's Netlify function, which lives two folders up
// when this repo is checked out as mco.dev's static/sheet submodule.
//   node dev.mjs        then open http://localhost:4175/sheet/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const { default: sheet } = await import(join(here, '../../netlify/functions/sheet.mjs'));
const PORT = Number(process.env.PORT ?? 4175);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/api/sheet') {
    const reply = await sheet(new Request(url));
    res.writeHead(reply.status, { 'Content-Type': 'application/json' });
    return res.end(await reply.text());
  }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Sheet: http://localhost:${PORT}/sheet/`));
