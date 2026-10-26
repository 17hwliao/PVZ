'use strict';
const MANIFEST_URL='https://github.com/17hwliao/PVZ/releases/latest/download/update-manifest.json';
const PLATFORM='windows-x64',MAX_BYTES=64*1024,MAX_ASSET_SIZE=2*1024*1024*1024;
const HOSTS=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']);
class UpdateError extends Error{constructor(code,message){super(message);this.name='UpdateError';this.code=code;}}
const fail=(code,message)=>{throw new UpdateError(code,message);};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function semver(version){
 if(typeof version!=='string'||version.length>64||! /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))fail('manifest-invalid','更新版本号无效。');
 const parts=version.split('.').map(Number);if(!parts.every(Number.isSafeInteger))fail('manifest-invalid','更新版本号超出范围。');return parts;
}
function compareVersions(left,right){const a=semver(left),b=semver(right);for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]?1:-1;return 0;}
function networkURL(value){
 let url;try{url=new URL(value);}catch{fail('redirect-invalid','更新服务器返回了无效地址。');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!HOSTS.has(url.hostname)||url.hash)fail('redirect-invalid','更新地址不在允许的安全来源中。');return url;
}
function validateManifest(value){
 if(!object(value)||value.schemaVersion!==1||value.channel!=='stable')fail('manifest-invalid','更新清单格式或通道无效。');
 semver(value.version);if(!Number.isSafeInteger(value.build)||value.build<1)fail('manifest-invalid','更新构建号无效。');
 if(typeof value.notes!=='string'||value.notes.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.notes))fail('manifest-invalid','更新说明无效。');
 const releaseUrl='https://github.com/17hwliao/PVZ/releases/tag/v'+value.version;
 if(value.releaseUrl!==releaseUrl)fail('manifest-invalid','更新发布页与版本不匹配。');
 if(!object(value.platforms))fail('manifest-invalid','更新清单缺少平台资源。');
 const names={'windows-x64':'ZombossRise-'+value.version+'-windows-x64.zip',android:'ZombossRise-'+value.version+'-android.apk'},platforms={};
 for(const [platform,name]of Object.entries(names)){
  const asset=value.platforms[platform],url='https://github.com/17hwliao/PVZ/releases/download/v'+value.version+'/'+name;
  if(!object(asset)||asset.url!==url||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>MAX_ASSET_SIZE||typeof asset.sha256!=='string'||!/^[a-f\d]{64}$/i.test(asset.sha256))fail('manifest-invalid','更新资源的地址、大小或校验值无效。');
  platforms[platform]={url,size:asset.size,sha256:asset.sha256.toLowerCase()};
 }
 return{schemaVersion:1,version:value.version,build:value.build,channel:'stable',releaseUrl,notes:value.notes,platforms};
}
async function readBounded(response){
 const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))fail('manifest-too-large','更新清单过大。');
 if(!response.body?.getReader)fail('manifest-invalid','更新清单内容为空。');
 const reader=response.body.getReader(),chunks=[];let lengthRead=0;
 try{for(;;){const part=await reader.read();if(part.done)break;lengthRead+=part.value.byteLength;if(lengthRead>MAX_BYTES)fail('manifest-too-large','更新清单过大。');chunks.push(part.value);}}
 catch(error){Promise.resolve(reader.cancel()).catch(()=>{});throw error;}
 const bytes=new Uint8Array(lengthRead);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('manifest-invalid','更新清单不是有效的 JSON。');}
}
async function fetchManifest(fetch,{timeoutMs=8000,maxRedirects=5}={}){
 const controller=new AbortController();let timer;
 const timeout=new Promise((resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new UpdateError('timeout','更新检查超时，请稍后重试。'));},timeoutMs);});
 const request=(async()=>{let next=MANIFEST_URL;const visited=new Set();for(let redirects=0;;redirects++){
  const url=networkURL(next);if(visited.has(url.href))fail('redirect-invalid','更新地址发生循环跳转。');visited.add(url.href);
  const response=await fetch(url.href,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if([301,302,303,307,308].includes(response.status)){
   if(response.body)Promise.resolve(response.body.cancel()).catch(()=>{});
   if(redirects>=maxRedirects)fail('redirect-invalid','更新地址跳转次数过多。');const location=response.headers.get('location');if(!location)fail('redirect-invalid','更新地址缺少跳转目标。');
   try{next=new URL(location,url).href;}catch{fail('redirect-invalid','更新服务器返回了无效跳转。');}continue;
  }
  if(response.status===404)fail('not-published','尚未发现已发布的更新清单，请稍后重试。');
  if(response.status!==200)fail('network-error','更新服务器暂不可用，请稍后重试。');return validateManifest(await readBounded(response));
 }})();
 try{return await Promise.race([request,timeout]);}finally{clearTimeout(timer);}
}
function createUpdater({fetch,openExternal,installedVersion,installedBuild,timeoutMs=8000,maxRedirects=5,now=Date.now}){
 if(typeof fetch!=='function'||typeof openExternal!=='function')throw new TypeError('Native fetch and openExternal are required');
 let latest=null,pending=null;
 const base=()=>({platform:PLATFORM,installedVersion,installedBuild});
 const errorResult=error=>({...base(),status:'error',code:error instanceof UpdateError?error.code:'network-error',message:error instanceof UpdateError?error.message:'无法检查更新，请检查网络后重试。'});
 async function runCheck(){
  latest=null;try{
   semver(installedVersion);if(!Number.isSafeInteger(installedBuild)||installedBuild<1)fail('installed-invalid','本机版本信息不完整，请重新下载完整安装包。');
   const manifest=await fetchManifest(fetch,{timeoutMs,maxRedirects}),comparison=compareVersions(manifest.version,installedVersion);
   if(comparison<0||manifest.build<installedBuild||comparison>0&&manifest.build<=installedBuild)fail('downgrade-refused','更新清单版本或构建号低于本机，已拒绝降级。');
   const available=comparison>0||manifest.build>installedBuild,asset=manifest.platforms[PLATFORM];
   const result={...base(),status:available?'available':'current',version:manifest.version,build:manifest.build,message:available?'发现新版本，可下载完整安装包。':'当前已是最新版本。',notes:manifest.notes,downloadUrl:asset.url,releaseUrl:manifest.releaseUrl,sha256:asset.sha256,size:asset.size};
   if(available)latest={result:Object.freeze({...result}),checkedAt:now()};return result;
  }catch(error){return errorResult(error);}
 }
 return{
  check(){if(!pending)pending=runCheck().finally(()=>{pending=null;});return pending;},
  async openDownload(){
   if(!latest||pending||now()-latest.checkedAt>10*60*1000)return errorResult(new UpdateError('check-required','请先检查更新，再打开已验证的下载。'));
   const result=latest.result;
   try{await openExternal(result.downloadUrl);return{...result,message:'已打开 GitHub 下载页；下载完成后请退出游戏并解压新版本。'};}catch{return errorResult(new UpdateError('open-failed','无法打开下载页，请稍后重试。'));}
  }
 };
}
function trustedSender(event,window){
 if(!window||window.isDestroyed?.()||window.webContents?.isDestroyed?.()||event.sender!==window.webContents||!event.senderFrame||event.senderFrame!==window.webContents.mainFrame)return false;
 const allowed=value=>{try{const url=new URL(value);return url.protocol==='pvz:'&&url.hostname==='game'&&!url.port&&!url.username&&!url.password&&url.pathname.startsWith('/');}catch{return false;}};
 return allowed(event.senderFrame.url)&&allowed(window.webContents.getURL());
}
function registerUpdateIPC({ipcMain,window,updater}){
 const channels={'pvz:updates:check':()=>updater.check(),'pvz:updates:open-download':()=>updater.openDownload()};
 for(const[channel,run]of Object.entries(channels))ipcMain.handle(channel,(event,...args)=>{if(args.length||!trustedSender(event,window))throw new Error('Untrusted update request');return run();});
 return()=>{for(const channel of Object.keys(channels))ipcMain.removeHandler(channel);};
}
module.exports={MANIFEST_URL,PLATFORM,MAX_BYTES,MAX_ASSET_SIZE,compareVersions,validateManifest,fetchManifest,createUpdater,trustedSender,registerUpdateIPC};
