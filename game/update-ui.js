(function(root){'use strict';
const RELEASES='https://github.com/17hwliao/PVZ/releases/latest',TIMEOUT=30000,controllers=new WeakMap();
function mount(host){
 if(controllers.has(host))return controllers.get(host);
 const doc=host.ownerDocument,build=root.PVZ_BUILD||{},version=typeof build.version==='string'?build.version:'未读取',installedBuild=Number.isSafeInteger(build.build)?build.build:0;
 const desktop=root.PVZUpdates,android=root.PVZAndroidUpdates,bridge=desktop||android||null,platform=desktop?'windows-x64':android?'android':null;
 let serial=0,downloadSerial=0,pending=null,result=null,phase='idle',message='',downloadBusy=false,downloadTimer=null,lastDownloadId=null,disposed=false;
 const make=(tag,text,cls)=>{const e=doc.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 const trigger=make('button','版本 '+version+' · 检查更新','pvz-update-trigger');trigger.type='button';
 const dialog=make('dialog',null,'pvz-update-dialog'),paper=make('div',null,'pvz-update-paper'),head=make('header'),title=make('h2','版本与更新'),close=make('button','收好木牌');close.type='button';close.className='pvz-update-close';head.append(title,close);
 const installed=make('p','当前版本 '+version+' · 构建 '+installedBuild,'pvz-update-installed'),status=make('p','','pvz-update-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const release=make('p','','pvz-update-release'),notes=make('p','','pvz-update-notes'),actions=make('div',null,'pvz-update-actions'),check=make('button','检查更新'),download=make('button',platform==='android'?'下载安卓新版':'下载PC新版'),webLink=make('a','浏览器版：前往官方仓库下载');
 check.type=download.type='button';download.hidden=true;webLink.href=RELEASES;webLink.target='_blank';webLink.rel='noopener noreferrer';webLink.hidden=!!bridge;actions.append(check,download,webLink);paper.append(head,installed,status,release,notes,actions);dialog.append(paper);host.replaceChildren(trigger,dialog);
 const dialogId='pvz-update-'+(doc.querySelectorAll('[data-pvz-update]').length===1?'dialog':Math.random().toString(36).slice(2));dialog.id=dialogId;title.id=dialogId+'-title';dialog.setAttribute('aria-labelledby',title.id);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialogId);
 function render(){
  if(disposed)return;const checking=!!pending;trigger.disabled=checking;check.disabled=checking||downloadBusy;check.hidden=!bridge;check.textContent=checking?'正在检查……':phase==='error'?'重新检查':'检查更新';
  trigger.textContent='版本 '+version+' · '+(checking?'正在检查……':phase==='available'?'发现新版':phase==='current'?'已是最新版':phase==='error'?'更新检查失败':'检查更新');
  status.textContent=message||(bridge?'点击检查，只查询版本；下载需要你另行点击。':'浏览器版不支持原生版本检查，请从官方仓库下载PC或安卓安装包。');
  release.hidden=phase!=='available';release.textContent=result&&phase==='available'?'可下载 '+result.version+' · 构建 '+result.build+(Number.isFinite(result.size)&&result.size>0?' · '+(result.size/1048576).toFixed(1)+' MB':''):'';
  download.hidden=phase!=='available';download.disabled=downloadBusy||checking;
  notes.textContent=(phase==='available'?'打开已核验的安装包下载链接；下载后手动安装，不会自动替换当前游戏。':bridge?'本机网络不可用时可稍后重试，游戏仍可离线运行。':'此入口固定指向 17hwliao/PVZ 的最新发行页。')+' 对局中打开此面板会暂停，收好后请主动继续。';
  dialog.setAttribute('aria-busy',String(checking||downloadBusy));
 }
 function open(){if(dialog.open)return;root.dispatchEvent(new root.CustomEvent('pvz-native-pause',{detail:{reason:'updates'}}));if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
 function shut(){if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');root.dispatchEvent(new root.CustomEvent('pvz-update-closed',{detail:{reason:'updates'}}));trigger.focus({preventScroll:true});}
 function clearPending(){if(pending?.timer!=null)root.clearTimeout(pending.timer);pending=null;}
 function fail(text){clearPending();result=null;phase='error';message=text||'检查失败，请稍后重试。';render();}
 function receive(token,value){
  if(disposed||!pending||pending.token!==token)return;
  if(!value||!['current','available','error'].includes(value.status)||value.platform!==platform){fail('更新信息不完整，请重新检查。');return;}
  clearPending();
  if(value.status==='error'){phase='error';result=null;message=typeof value.message==='string'&&value.message?value.message:'检查失败，请稍后重试。';render();return;}
  if(value.status==='available'&&(!Number.isSafeInteger(value.build)||value.build<=installedBuild||typeof value.version!=='string'||!value.version.trim())){fail('新版信息不高于本机版本或格式不完整，已停止下载。');return;}
  result=value;phase=value.status;message=value.status==='available'?'发现新版，可以选择下载安装包。':'当前已是最新版。';render();
 }
 function begin(){
  if(disposed||pending||downloadBusy)return;open();if(!bridge){phase='web';message='当前运行浏览器版。请从官方仓库下载PC或安卓安装包。';render();return;}
  if(typeof bridge.check!=='function'){fail('本机更新接口不可用，请稍后重试。');return;}
  if(downloadTimer!=null){root.clearTimeout(downloadTimer);downloadTimer=null;}downloadSerial++;downloadBusy=false;lastDownloadId=null;result=null;phase='checking';message='正在检查更新，请稍候……';
  const token=++serial;pending={token,requestId:null,timer:root.setTimeout(()=>{if(pending?.token===token)fail('检查超过30秒，请检查网络后重试。');},TIMEOUT)};render();
  try{
   if(desktop)Promise.resolve(bridge.check()).then(value=>receive(token,value),()=>{if(pending?.token===token)fail('检查失败，请确认网络后重试。');});
   else{const id=bridge.check();if(typeof id!=='string'||!id){fail('本机更新请求未能启动，请重试。');return;}if(pending?.token===token)pending.requestId=id;}
  }catch{if(pending?.token===token)fail('本机更新检查失败，请稍后重试。');}
 }
 function eventResult(event){
  if(!android||desktop||disposed)return;const value=event.detail;
  if(pending?.requestId&&value?.requestId===pending.requestId){receive(pending.token,value);return;}
  if(lastDownloadId&&value?.requestId===lastDownloadId&&value.status==='error'){downloadSerial++;downloadBusy=false;if(downloadTimer!=null)root.clearTimeout(downloadTimer);downloadTimer=null;message='下载链接未能打开：'+(typeof value.message==='string'&&value.message?value.message:'请重试。');render();}
 }
 async function openDownload(){
  if(disposed||downloadBusy||pending||phase!=='available'||!result||!bridge)return;
  if(typeof bridge.openDownload!=='function'){message='本机下载接口不可用，请重新检查。';render();return;}
  const token=serial,attempt=++downloadSerial;downloadBusy=true;lastDownloadId=typeof result.requestId==='string'?result.requestId:null;message='正在打开安装包下载……';render();
  downloadTimer=root.setTimeout(()=>{if(token!==serial||attempt!==downloadSerial||disposed)return;downloadSerial++;downloadBusy=false;downloadTimer=null;message='打开下载超过30秒，可以重试。';render();},TIMEOUT);
  try{const outcome=await Promise.resolve(bridge.openDownload());if(disposed||token!==serial||attempt!==downloadSerial)return;if(outcome===false||outcome?.ok===false||outcome?.status==='error'||(android&&!desktop&&outcome!==true))throw Error(typeof outcome?.message==='string'&&outcome.message?outcome.message:'请重新检查更新后重试。');if(downloadTimer!=null)root.clearTimeout(downloadTimer);message='已请求打开下载，请在系统浏览器查看；尚未自动安装。';downloadTimer=root.setTimeout(()=>{downloadBusy=false;downloadTimer=null;render();},1000);render();}
  catch(error){if(disposed||token!==serial||attempt!==downloadSerial)return;if(downloadTimer!=null)root.clearTimeout(downloadTimer);downloadTimer=null;downloadBusy=false;message='下载链接未能打开：'+(error?.message||'请重试。');render();}
 }
 trigger.onclick=()=>{open();if(phase==='idle'||phase==='error'||phase==='web')begin();};check.onclick=begin;download.onclick=openDownload;close.onclick=shut;dialog.addEventListener('cancel',e=>{e.preventDefault();shut();});root.addEventListener('pvz-update-result',eventResult);
 const api={destroy(){disposed=true;clearPending();if(downloadTimer!=null)root.clearTimeout(downloadTimer);root.removeEventListener('pvz-update-result',eventResult);controllers.delete(host);},check:begin};controllers.set(host,api);render();return api;
}
const api={mount};root.PVZ_UPDATE_UI=api;for(const e of root.document.querySelectorAll('[data-pvz-current-version]'))e.textContent='僵王崛起 · '+(root.PVZ_BUILD?.version||'版本未读取');for(const host of root.document.querySelectorAll('[data-pvz-update]'))mount(host);
})(typeof window!=='undefined'?window:globalThis);
