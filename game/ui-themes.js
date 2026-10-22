(function(root){
'use strict';
const families={wood:'cartoon',stone:'cutpaper',paper:'ink'},names={wood:'经典木牌',stone:'僵族石刻',paper:'旧纸来信'};
const fonts=root.PVZ_NATIVE_FONTS||{},images={},cache=new WeakMap();
let theme='wood',loading=true,initialized=false,observer=null,queued=false,fallbackReady=false;
const selectors='[data-native-font],#dialogTitle,.dialog-actions button,.book-tabs button,.damage-kind-tabs button,.damage-unit-tabs button,.damage-stage-tabs button,.story-scene>button,.settings-row button,.theme-settings legend,#chooserTitle,.defense-preview h2,.dossier-title';
function render(el){
 if(el.matches('button')&&el.children.length&&!el.querySelector(':scope > .native-type'))return;
 const value=el.textContent,family=el.dataset.fontFamily||families[theme],font=fonts[family],image=images[family];
 if(!value||!font||!image)return;
 const ink=getComputedStyle(el).color,signature=family+'|'+ink+'|'+value;
 if(cache.get(el)===signature)return;
 const canvas=document.createElement('canvas'),c=canvas.getContext('2d');if(!c)return;
 c.font='28px PVZChinese';let pen=0,minX=0,minY=0,maxX=0,maxY=0;const entries=[];
 for(const ch of value){
  const g=font.glyphs[ch];
  if(g){const [,,w,h,advance,dx,dy]=g;entries.push({g,x:pen});if(w&&h){minX=Math.min(minX,pen+dx);minY=Math.min(minY,dy);maxX=Math.max(maxX,pen+dx+w);maxY=Math.max(maxY,dy+h);}pen+=advance;}
  else{const m=c.measureText(ch);if(!m||!Number.isFinite(m.width))return;entries.push({ch,x:pen});minY=Math.min(minY,28-m.actualBoundingBoxAscent);maxY=Math.max(maxY,28+m.actualBoundingBoxDescent);maxX=Math.max(maxX,pen+m.width);pen+=m.width;}
 }
 const pad=3;canvas.width=Math.ceil(Math.max(maxX,pen)-minX+pad*2);canvas.height=Math.max(1,Math.ceil(maxY-minY+pad*2));
 c.font='28px PVZChinese';c.textBaseline='alphabetic';c.fillStyle='#fff';
 for(const e of entries){if(e.g){const [x,y,w,h,,dx,dy]=e.g;if(w&&h)c.drawImage(image,x,y,w,h,e.x+dx-minX+pad,dy-minY+pad,w,h);}else c.fillText(e.ch,e.x-minX+pad,28-minY+pad);}
 c.globalCompositeOperation='source-in';c.fillStyle=ink;c.fillRect(0,0,canvas.width,canvas.height);canvas.setAttribute('aria-hidden','true');
 const wrap=document.createElement('span'),label=document.createElement('span');wrap.className='native-type';label.className='native-label';label.textContent=value;wrap.append(canvas,label);el.replaceChildren(wrap);cache.set(el,signature);
}
function observe(){const dialog=document.getElementById('dialog');if(observer&&dialog)observer.observe(dialog,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','aria-pressed']});}
function refresh(scope=document){
 observer?.disconnect();
 try{if(scope.matches?.(selectors))render(scope);scope.querySelectorAll(selectors).forEach(render);}finally{observe();}
}
function updateFontNotice(){
 const el=document.getElementById('uiFontNotice');if(!el)return;
 el.hidden=loading||!!images[families[theme]]&&fallbackReady;
 el.textContent=el.hidden?'':'原版字形未完整载入，当前使用备用字体，仍可继续游戏。';
 const settings=document.getElementById('uiFontStatus');if(settings)settings.textContent=loading?'正在读取原版字形……':el.hidden?'原版字形已载入':'部分字形未载入，使用备用字体。';
 document.body.dataset.nativeFonts=loading?'loading':el.hidden?'ready':'fallback';
}
function setTheme(next){
 theme=Object.hasOwn(families,next)?next:'wood';document.body.dataset.uiTheme=theme;
 for(const el of document.querySelectorAll('.home-record'))el.hidden=!el.classList.contains('record-'+theme);
 refresh();updateFontNotice();
}
function updateRecord(action,count,description){
 const value=`行动${action}　同胞${count}/5`;
 for(const el of document.querySelectorAll('[data-record-progress]'))if(el.textContent!==value)el.textContent=value;
 for(const el of document.querySelectorAll('.home-record')){el.setAttribute('aria-label',description+'；查看章节选择');el.title=description+'；查看章节选择';}
 refresh(document.getElementById('home'));
}
function loadImage(file){return new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>reject(Error('字体读取超时')),10000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(Error('字体读取失败'));};im.src=file;});}
async function init(next){
 setTheme(next);if(initialized)return;initialized=true;
 if(typeof MutationObserver==='function'){observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh(document.getElementById('dialog'));});});observe();}
 // Optional visual resources never block the battle or its loading/retry path.
 const tasks=Object.entries(fonts).map(async([key,f])=>{images[key]=await loadImage(f.file);});
 tasks.push((async()=>{if(!document.fonts)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('补字字体读取超时')),10000);document.fonts.load('28px PVZChinese').then(()=>{clearTimeout(timer);resolve();},error=>{clearTimeout(timer);reject(error);});});fallbackReady=document.fonts.check('28px PVZChinese');})());
 await Promise.allSettled(tasks);loading=false;refresh();updateFontNotice();
}
root.PVZ_UI={init,setTheme,refresh,updateRecord,names};
})(window);
