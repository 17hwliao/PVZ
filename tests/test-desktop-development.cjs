'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const project=path.resolve(__dirname,'..');
let passed=0;
function check(name,fn){return Promise.resolve().then(fn).then(()=>{passed++;console.log('PASS '+name);});}
async function boot(development,packaged){
 const settings={},routes=new Map();let window,fetched;
 const app={setName(){},setPath:(k,v)=>settings[k]=v,getPath:()=>path.join(project,'fake-app-data'),setAppUserModelId(){},requestSingleInstanceLock:()=>true,on(){},whenReady:()=>Promise.resolve(),getVersion:()=> '0.8.0',quit(){}};
 const electron={app,protocol:{registerSchemesAsPrivileged(){},handle:(k,v)=>routes.set(k,v)},net:{fetch:url=>{fetched=url;return Promise.resolve({status:200});}},session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){}}},fromPartition:()=>({fetch(){}})},ipcMain:{},shell:{},BrowserWindow:class{constructor(options){this.options=options;this.webContents={setWindowOpenHandler(){},on(){}};window=this;}removeMenu(){}on(){}loadURL(url){this.url=url;}}};
 const dirname=path.join(project,'desktop');
 vm.runInNewContext(fs.readFileSync(path.join(dirname,'main.cjs'),'utf8'),{__dirname:dirname,process:{argv:development?['electron','app','--pvz-dev']:['electron','app']},URL,Response,require:name=>name==='electron'?electron:name==='node:fs'?{existsSync:()=>packaged,statSync:()=>({isFile:()=>true})}:name==='./package.json'?{build:800}:name==='./updater.cjs'?{createUpdater:()=>({}),registerUpdateIPC:()=>()=>{}}:require(name)});
 await Promise.resolve();await Promise.resolve();
 const response=await routes.get('pvz')({url:'pvz://game/index.html'});
 assert.equal(response.status,200);
 assert.equal(fetched,require('node:url').pathToFileURL(path.join(project,packaged?'desktop/game':'game','index.html')).toString());
 assert.equal(settings.userData,path.join(app.getPath(),development?'ZombossRise-Dev':'ZombossRise'));
 assert.equal(window.url,'pvz://game/index.html');assert.equal(window.options.webPreferences.devTools,development);
 assert.equal(window.options.webPreferences.nodeIntegration,false);assert.equal(window.options.webPreferences.contextIsolation,true);assert.equal(window.options.webPreferences.sandbox,true);
 assert.equal((await routes.get('pvz')({url:'pvz://evil/index.html'})).status,404);
}
function launch(env,config){
 const calls=[],messages=[],fakeProcess={env:{...env},exitCode:0},events={};
 const executable=path.join(project,'fake-runtime','electron.exe');
 vm.runInNewContext(fs.readFileSync(path.join(project,'tools/start-electron.cjs'),'utf8'),{__dirname:path.join(project,'tools'),process:fakeProcess,console:{error:m=>messages.push(m)},require:name=>name==='node:fs'?{existsSync:p=>p===executable||config&&p.endsWith('electron-runtime.json'),readFileSync:()=>JSON.stringify(config)}:name==='node:child_process'?{spawn:(...args)=>{calls.push(args);return{on:(event,fn)=>events[event]=fn};}}:name==='electron'?(()=>{throw Error('not installed');})():require(name)});
 return{calls,messages,process:fakeProcess,executable,events};
}
(async()=>{
 await check('源码 Electron 使用 game 根目录、开发存档和沙箱',()=>boot(true,false));
 await check('打包布局仍使用 desktop/game、正式存档和禁用开发工具',()=>boot(false,true));
 await check('启动器清除 Node 模式、显示交互窗口并传播子进程退出码',()=>{const executable=path.join(project,'fake-runtime','electron.exe'),t=launch({PVZ_ELECTRON_PATH:executable,ELECTRON_RUN_AS_NODE:'1'});assert.equal(t.calls.length,1);const[exe,args,options]=t.calls[0];assert.equal(exe,executable);assert.equal(args[1],'--pvz-dev');assert.equal(options.env.ELECTRON_RUN_AS_NODE,undefined);assert.equal(options.windowsHide,false);assert.equal(options.cwd,project);t.events.exit(7);assert.equal(t.process.exitCode,7);});
 await check('本地配置可启动，缺失运行库明确失败而不启动浏览器',()=>{const t=launch({}, {executable:path.join(project,'fake-runtime','electron.exe')});assert.equal(t.calls.length,1);const absent=launch({});assert.equal(absent.calls.length,0);assert.equal(absent.process.exitCode,1);assert.match(absent.messages[0],/Electron runtime not configured/);});
 console.log(JSON.stringify({passed,scope:'source/packaged roots, isolated profiles and launcher behavior; mocked process tests'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
