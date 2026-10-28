(function(root){'use strict';
const key='pvz-terrain-intro-v1';
function create(doc,{onExit}){
 const dialog=doc.createElement('dialog');dialog.className='adventure-intro';dialog.setAttribute('aria-label','序章 · 门外的声音');
 const element=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 const heading=element('h2',null,'序章 · 门外的声音'),view=element('div','intro-view'),frame=element('img','intro-frame'),flash=element('div','intro-flash'),caption=element('div','intro-caption'),speaker=element('strong'),text=element('p'),error=element('p',null,'漫画暂未读到，仍可继续阅读对白。'),track=element('div','intro-progress'),progress=element('i'),controls=element('div','intro-controls'),count=element('span');
 error.hidden=true;view.append(frame,flash);caption.append(speaker,text,error);track.append(progress);controls.append(count);
 const button=label=>{const b=element('button',null,label);b.type='button';controls.append(b);return b;},back=button('上一句'),play=button('暂停播放'),next=button('下一句'),reduce=button('柔和转场'),skip=button('跳过序章');
 dialog.append(heading,view,caption,track,controls);doc.body.append(dialog);
 let status=null;try{status=JSON.parse(root.localStorage.getItem(key)||'null');}catch{}
 const player=root.PVZ_CINEMA.createPrologue({data:root.PVZ_PROLOGUE,elements:{root:dialog,frame,speaker,text,error,progress,flash,count,back,play,next,reduce,skip},onSound(){},onExit(result){if(dialog.open){if(dialog.close)dialog.close();else dialog.removeAttribute('open');}if(status?.status!=='completed'||result.status==='completed'){try{root.localStorage.setItem(key,JSON.stringify(result));status=result;}catch{}}onExit(result);}});
 dialog.addEventListener('cancel',e=>{e.preventDefault();skip.click();});
 dialog.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Escape'||e.target.tagName==='BUTTON'&&['Enter',' '].includes(e.key))return;player.key(e);});
 return{get active(){return player.active;},get seen(){return status?.version===root.PVZ_PROLOGUE.version;},start(){dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}player.start({soft:root.matchMedia('(prefers-reduced-motion: reduce)').matches});},step:dt=>player.step(dt),pause:()=>player.pause()};
}
root.PVZ_ADVENTURE_INTRO={create};
})(typeof window!=='undefined'?window:globalThis);
