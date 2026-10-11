import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = import.meta.dirname;
const port = Number(process.env.PORT || 8943);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.zip': 'application/zip' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.slice(root.length + 1);
    if (!path.startsWith(root + sep) || relative.split(sep).some(part => part.startsWith('.')) || !mime[extname(path)]) {
      response.writeHead(404).end('Not found');
      return;
    }
    const content = await readFile(path);
    const extension = extname(path);
    const headers = { 'Content-Type': mime[extension], 'Cache-Control': 'no-store' };
    if (extension === '.zip') headers['Content-Disposition'] = `attachment; filename="${path.split(sep).at(-1)}"`;
    response.writeHead(200, headers);
    response.end(content);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`weirdos → http://localhost:${port}`));
