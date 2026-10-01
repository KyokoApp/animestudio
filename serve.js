// server statis mini (tanpa dependensi) untuk pratinjau lokal / hosting apa pun
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = __dirname; const port = Number(process.env.PORT || 8899);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, {'content-type':'text/plain'}).end('404 ' + p); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control':'no-cache' });
    res.end(buf);
  });
}).listen(port, '0.0.0.0', () => console.log('AnimeExtract jalan di http://0.0.0.0:' + port));
