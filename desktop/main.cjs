const {app,BrowserWindow,protocol,net,session,ipcMain,shell}=require('electron'),path=require('node:path'),{pathToFileURL}=require('node:url'),fs=require('node:fs'),{createUpdater,registerUpdateIPC}=require('./updater.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'pvz',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
app.setName('僵王崛起');app.setPath('userData',path.join(app.getPath('appData'),'ZombossRise'));app.setAppUserModelId('cn.zombossrise.desktop');
if(!app.requestSingleInstanceLock()){app.quit();}else{
 let win;
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(()=>{
  const root=path.resolve(__dirname,'game');
  protocol.handle('pvz',request=>{try{const url=new URL(request.url);if(url.hostname!=='game')return new Response('Not found',{status:404});const file=path.resolve(root,decodeURIComponent(url.pathname).replace(/^\//,''));if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});return net.fetch(pathToFileURL(file).toString());}catch{return new Response('Not found',{status:404});}});
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','ftp://*/*']},(_details,callback)=>callback({cancel:true}));
  const updateSession=session.fromPartition('pvz-updater-v1',{cache:false}),installed=require('./package.json');
  const updater=createUpdater({fetch:(url,options)=>updateSession.fetch(url,options),openExternal:url=>shell.openExternal(url),installedVersion:app.getVersion(),installedBuild:installed.build});
  win=new BrowserWindow({title:'僵王崛起 · 八境营救',width:1280,height:850,minWidth:880,minHeight:570,backgroundColor:'#18251b',icon:path.join(root,'assets/portraits/zomboss-head.png'),autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:false,preload:path.join(__dirname,'preload.cjs')}});
  const removeUpdateIPC=registerUpdateIPC({ipcMain,window:win,updater});
  win.removeMenu();win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('pvz://game/'))event.preventDefault();});
  win.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}if(input.type==='keyDown'&&input.key==='Escape'&&win.isFullScreen()){win.setFullScreen(false);}});
  win.on('blur',()=>{if(win&&!win.webContents.isDestroyed())win.webContents.executeJavaScript("window.dispatchEvent(new Event('pvz-native-pause'))").catch(()=>{});});
  win.loadURL('pvz://game/index.html');win.on('closed',()=>{removeUpdateIPC();win=null;});
 });
 app.on('window-all-closed',()=>app.quit());
}
