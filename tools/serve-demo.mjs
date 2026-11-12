/**
 * 本地演示服务器：用于在 http:// 下打开 demo 表单（扩展在 file:// 下需要额外授权）。
 *
 *   node tools/serve-demo.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 8787;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const relative = decodeURIComponent(url.pathname === '/' ? '/demo/application-form.html' : url.pathname);
    const filePath = path.resolve(ROOT, '.' + relative);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const stat = fs.statSync(filePath);
    const target = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const data = fs.readFileSync(target);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch (error) {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`演示页已启动：http://127.0.0.1:${PORT}/demo/application-form.html`);
  console.log(`结构变体页：  http://127.0.0.1:${PORT}/demo/form-variants.html`);
  console.log('按 Ctrl+C 停止');
});
