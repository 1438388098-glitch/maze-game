@echo off
cd /d "%~dp0"
echo Starting Maze Game Dev Server...
echo.

rem Kill any existing process on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
  taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Open http://localhost:8080 in your browser
echo Press Ctrl+C to stop
echo.

node -e "require('http').createServer((q,r)=>{var f=require('fs'),p=q.url=='/'?'/index.html':q.url;try{r.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[require('path').extname(p)]||'text/plain'});r.end(f.readFileSync(__dirname+p))}catch(e){r.writeHead(404);r.end('Not found')}}).on('error',e=>{if(e.code==='EADDRINUSE'){console.log('Port 8080 in use, trying 8081...');require('http').createServer((q2,r2)=>{var f2=require('fs'),p2=q2.url=='/'?'/index.html':q2.url;try{r2.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[require('path').extname(p2)]||'text/plain'});r2.end(f2.readFileSync(__dirname+p2))}catch(e2){r2.writeHead(404);r2.end('Not found')}}).listen(8081,()=>console.log('Server ready at http://localhost:8081'))}}).listen(8080,()=>console.log('Server ready at http://localhost:8080'))"
pause
