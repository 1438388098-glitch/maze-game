import http from 'http';
import fs from 'fs';
import path from 'path';
const ct = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.ico':'image/x-icon','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((q,r)=>{
  const p = q.url === '/' ? '/index.html' : q.url;
  try {
    const f = '.' + p;
    if (!fs.existsSync(f)) { r.writeHead(404); r.end('Not found'); return; }
    r.writeHead(200,{'Content-Type':ct[path.extname(p)]||'text/plain'});
    r.end(fs.readFileSync(f));
  } catch(e) {
    r.writeHead(404); r.end('Not found');
  }
}).listen(8080, ()=>console.log('ready'));
