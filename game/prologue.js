(function(root){
'use strict';
function createPrologue({data,elements,onSound,onExit}){
 let active=false,index=0,elapsed=0,playing=true,reduce=false,lastShot='',completed=false;
 const e=elements;
 function render(){
  const b=data.beats[index],shot=b.shot+':'+b.panel;
  if(shot!==lastShot){e.frame.hidden=!!(data.nativePrison&&b.shot==='prison');e.error.hidden=true;if(!e.frame.hidden)e.frame.src=`prologue/${b.shot}.png`;e.frame.style.setProperty('--panel-x',b.panel%2?'100%':'0%');e.frame.style.setProperty('--panel-y',b.panel>1?'100%':'0%');e.frame.dataset.panel=String(b.panel);lastShot=shot;}
  e.frame.alt=`序章画面：${index<9?'囚室与观察窗':'逃生通道'}`;
  e.root.dataset.tone=b.shot;e.root.dataset.effect=reduce?'soft':(b.effect||'none');e.root.classList.toggle('reduce-flash',reduce);
  e.speaker.textContent=b.speaker;e.text.textContent=b.text;e.count.textContent=`${index+1} / ${data.beats.length}`;
  e.play.textContent=playing?'暂停播放':'自动播放';e.play.setAttribute('aria-pressed',String(playing));
  e.back.disabled=index===0;e.next.textContent=index===data.beats.length-1?'进入第一章':'下一句 ›';e.progress.style.width=`${(index+1)/data.beats.length*100}%`;
  e.flash.classList.remove('pulse');void e.flash.offsetWidth;if(b.effect)e.flash.classList.add('pulse');
  if(b.sound)onSound(b.sound);
 }
 function finish(skip=false){if(!active)return;active=false;completed=!skip;e.root.hidden=true;onExit({version:data.version,status:skip?'skipped':'completed'});}
 function next(){if(!active)return;if(index===data.beats.length-1){finish();return;}index++;elapsed=0;render();}
 e.next.onclick=next;e.back.onclick=()=>{if(active&&index>0){index--;elapsed=0;render();}};
 e.play.onclick=()=>{playing=!playing;e.play.textContent=playing?'暂停播放':'自动播放';e.play.setAttribute('aria-pressed',String(playing));};
 e.skip.onclick=()=>finish(true);e.reduce.onclick=()=>{reduce=!reduce;e.reduce.textContent=reduce?'柔和转场：开':'柔和转场：关';e.reduce.setAttribute('aria-pressed',String(reduce));e.root.classList.toggle('reduce-flash',reduce);};
 e.frame.onerror=()=>{e.error.hidden=false;e.error.textContent=data.beats[index].shot==='prison'?'插画未能读取，已切换经典角色场景演出。':'画面未能读取，仍可继续阅读完整剧情。';e.frame.style.opacity='0';};e.frame.onload=()=>{e.error.hidden=true;e.frame.style.opacity='1';};
 return {
  get active(){return active;},get index(){return index;},get completed(){return completed;},
  start({soft=false}={}){active=true;index=0;elapsed=0;playing=true;reduce=soft;lastShot='';completed=false;e.root.hidden=false;e.reduce.textContent=reduce?'柔和转场：开':'柔和转场：关';e.reduce.setAttribute('aria-pressed',String(reduce));render();e.next.focus();},
  step(dt){if(!active||!playing)return;elapsed+=dt;if(elapsed>=data.beats[index].duration)next();},
  key(event){if(!active)return false;if(event.key==='ArrowRight'||event.key==='Enter'){event.preventDefault();next();}else if(event.key==='ArrowLeft'){event.preventDefault();e.back.click();}else if(event.code==='Space'){event.preventDefault();e.play.click();}return true;},
  pause(){if(active&&playing)e.play.click();}
 };
}
const api={createPrologue};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_CINEMA=api;
})(typeof window!=='undefined'?window:globalThis);
