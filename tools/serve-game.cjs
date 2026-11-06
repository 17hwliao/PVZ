'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=fs.realpathSync(path.resolve(__dirname,'../game')),host='127.0.0.1',port=8793;
const identity=crypto.createHash('sha256').update(root).digest('hex'),url=`http://${host}:${port}/index.html`,open=!process.argv.includes('--no-open');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ogg':'audio/ogg','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
function openGame(){
 if(!open)return;
 const command=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
 const child=spawn(command[0],command[1],{stdio:'ignore',windowsHide:true});child.on('error',()=>console.log('Open this address in your browser: '+url));
}
function reply(res,status,message){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(message);}
const server=http.createServer((req,res)=>{
 if(req.headers.host!==`${host}:${port}`){reply(res,403,'Invalid host');return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,'GET or HEAD only');return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,`http://${host}:${port}`).pathname);}catch{reply(res,400,'Invalid path');return;}
 if(pathname==='/__pvz_launcher'){const body=JSON.stringify({app:'zomboss-rise-source',identity});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);return;}
 if(pathname==='/' )pathname='/index.html';
 if(pathname.includes('\\')||pathname.includes('\0')){reply(res,403,'Invalid path');return;}
 const candidate=path.resolve(root,'.'+pathname);
 if(!candidate.startsWith(root+path.sep)){reply(res,403,'Outside game folder');return;}
 fs.realpath(candidate,(error,file)=>{
  if(error){reply(res,404,'Game asset not found');return;}
  if(!file.startsWith(root+path.sep)){reply(res,403,'Outside game folder');return;}
  fs.stat(file,(error,stat)=>{
   if(error||!stat.isFile()){reply(res,404,'Game asset not found');return;}
   const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent)reply(res,404,'Game asset unavailable');else res.destroy();});
   stream.on('open',()=>{res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD'){stream.destroy();res.end();}else stream.pipe(res);});res.on('close',()=>stream.destroy());
  });
 });
});
server.on('error',error=>{
 if(error.code!=='EADDRINUSE'){console.error(error.message);process.exitCode=1;return;}
 const request=http.get(`http://${host}:${port}/__pvz_launcher`,{timeout:2000},res=>{
  let body='';res.on('data',chunk=>{body+=chunk;if(body.length>2048)res.destroy();});res.on('end',()=>{let own=false;try{const info=JSON.parse(body);own=info.app==='zomboss-rise-source'&&info.identity===identity;}catch{}if(own){console.log('Game is already running: '+url);openGame();}else{console.error(`Port ${port} is occupied by another program. Close it before starting this game.`);process.exitCode=1;}});
 });request.on('timeout',()=>request.destroy(Error('Port check timed out')));request.on('error',()=>{console.error(`Port ${port} is occupied. Close the other program and try again.`);process.exitCode=1;});
});
server.listen(port,host,()=>{console.log('ZombossRise source game: '+url);console.log('Keep this window open while playing. Press Ctrl+C to stop.');openGame();});
