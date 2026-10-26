(function(root){
'use strict';
const data=root.PVZ_ALMANAC;
function el(tag,content,cls){const node=document.createElement(tag);if(content!=null)node.textContent=content;if(cls)node.className=cls;return node;}
function mount(host,{unlocked=[]}={}){
 const book=el('section',null,'almanac-book'),owned=new Set(unlocked);book.setAttribute('aria-label','完整角色图鉴');
 const header=el('header',null,'almanac-heading'),title=el('h2','乔治的战地手记'),subtitle=el('p','植物与同胞 · 49 / 26');title.dataset.nativeFont='';header.append(title,subtitle);
 const tools=el('div',null,'almanac-toolbar'),tabs=el('div',null,'almanac-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','角色类别');
 const plants=el('button','植物 · 49'),zombies=el('button','僵尸 · 26');for(const b of [plants,zombies]){b.type='button';b.setAttribute('role','tab');b.dataset.nativeFont='';tabs.append(b);}
 const searchLabel=el('label',null,'almanac-search'),search=el('input');search.type='search';search.maxLength=40;search.placeholder='查找角色';search.setAttribute('aria-label','查找角色');searchLabel.append(el('span','查找'),search);
 const count=el('span',null,'almanac-count');count.setAttribute('role','status');tools.append(tabs,searchLabel,count);
 const pages=el('div',null,'almanac-pages'),list=el('div',null,'almanac-cards'),detail=el('article',null,'almanac-detail');list.setAttribute('aria-label','植物角色');detail.setAttribute('aria-label','角色详情');
 const portraitStage=el('div',null,'almanac-stage'),portrait=el('img'),failure=el('div','画像未能载入','almanac-art-error'),retry=el('button','重新读取画像');portrait.decoding='async';portrait.draggable=false;failure.hidden=true;failure.append(retry);portraitStage.append(portrait,failure);
 const styles=el('div',null,'almanac-boss-styles'),styleTitle=el('p','机甲造型'),styleButtons=el('div'),mechanics=el('p','巨型机甲 · 砸击 / 冰火球 / 投放同胞\n造型预览，机甲战斗关卡尚未开放。','almanac-boss-mechanics');styles.setAttribute('role','group');styles.setAttribute('aria-label','僵王机甲造型');styles.append(styleTitle,styleButtons);styles.hidden=true;mechanics.hidden=true;
 const name=el('h3'),tag=el('p',null,'almanac-entry-tag'),role=el('p',null,'almanac-role'),note=el('p',null,'almanac-note'),number=el('p',null,'almanac-number'),turn=el('div',null,'almanac-turn'),previous=el('button','‹ 上一位'),next=el('button','下一位 ›');name.dataset.nativeFont='';turn.append(previous,next);detail.append(styles,portraitStage,name,tag,role,note,mechanics,number,turn);pages.append(list,detail);book.append(header,tools,pages);host.append(book);
 let faction='plant',selected={plant:'pea',zombie:'normal'},visible=[],request=0,bossStyle='classic';
 function source(){return faction==='plant'?data.plants:data.zombies;}
 function state(item){if(item.id==='boss')return '乔治·埃德加 · 机甲尚未登场';return item.current?(item.faction==='plant'?'前线植物守卫':owned.has(item.id)?'已解救的同胞':'等待营救的同胞'):'手记中的远方身影 · 尚未登场';}
 function select(id,focus=false){const item=source().find(x=>x.id===id);if(!item)return;selected[faction]=id;for(const b of list.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.id===id));
  const isBoss=item.id==='boss',variant=isBoss?data.bossStyles?.find(x=>x.id===bossStyle):null;styles.hidden=!isBoss;mechanics.hidden=!isBoss;detail.classList.toggle('is-boss',isBoss);for(const b of styleButtons.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.bossStyle===bossStyle));
  const token=++request;failure.hidden=true;portrait.hidden=false;portrait.alt=item.name+(variant?' · '+variant.name:'')+'完整形象';portrait.onload=()=>{if(token!==request)return;failure.hidden=true;portrait.hidden=false;};portrait.onerror=()=>{if(token!==request)return;portrait.hidden=true;failure.hidden=false;};portrait.src=variant?.file||item.file;
  name.textContent=item.name;tag.textContent=state(item);tag.classList.toggle('is-owned',owned.has(item.id)&&item.faction==='zombie');role.textContent=variant?variant.name+' · '+variant.culture:item.role;note.textContent=variant?.note||item.note;number.textContent=(item.faction==='plant'?'植物':'僵尸')+'手记 · '+String(item.index+1).padStart(2,'0')+' / '+source().length;
  const n=visible.findIndex(x=>x.id===id);previous.disabled=n<=0;next.disabled=n<0||n>=visible.length-1;root.PVZ_UI?.refresh(name);if(focus){const b=list.querySelector('[data-id="'+id+'"]');b?.focus();}
 }
 function filter(){const term=search.value.trim().toLowerCase();visible=source().filter(x=>(x.name+' '+x.role+' '+x.id).toLowerCase().includes(term));list.replaceChildren();count.textContent=visible.length+' / '+source().length;
  if(!visible.length){list.append(el('p','手记里还没有这个名字，换个名字找找吧。','almanac-empty'));detail.hidden=true;return;}detail.hidden=false;
  for(const item of visible){const b=el('button',null,'almanac-card'),image=el('img'),label=el('span',item.name),badge=el('small',item.current?(item.faction==='plant'?'前线守卫':owned.has(item.id)?'已解救':'待解救'):(item.id==='boss'?'机甲未登场':'未登场'));b.type='button';b.dataset.id=item.id;b.setAttribute('aria-label',item.name+'，'+state(item));image.alt='';image.loading='lazy';image.decoding='async';image.src=item.file;image.onerror=()=>{image.hidden=true;b.classList.add('art-unavailable');};b.append(image,label,badge);b.onclick=()=>select(item.id);b.onkeydown=e=>{const step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!step)return;e.preventDefault();const i=visible.findIndex(x=>x.id===item.id),target=visible[i+step];if(target)select(target.id,true);};list.append(b);}
  select(visible.some(x=>x.id===selected[faction])?selected[faction]:visible[0].id);
 }
 function category(value){faction=value;book.dataset.faction=value;plants.setAttribute('aria-selected',String(value==='plant'));zombies.setAttribute('aria-selected',String(value==='zombie'));plants.tabIndex=value==='plant'?0:-1;zombies.tabIndex=value==='zombie'?0:-1;list.setAttribute('aria-label',value==='plant'?'植物角色':'僵尸角色');list.scrollTop=0;filter();}
 for(const variant of data.bossStyles||[]){const b=el('button',variant.name);b.type='button';b.dataset.bossStyle=variant.id;b.onclick=()=>{bossStyle=variant.id;select('boss');};styleButtons.append(b);}
 plants.onclick=()=>category('plant');zombies.onclick=()=>category('zombie');tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();category(faction==='plant'?'zombie':'plant');(faction==='plant'?plants:zombies).focus();};search.oninput=filter;retry.onclick=()=>{portrait.removeAttribute('src');select(selected[faction]);};previous.onclick=()=>select(visible[visible.findIndex(x=>x.id===selected[faction])-1]?.id);next.onclick=()=>select(visible[visible.findIndex(x=>x.id===selected[faction])+1]?.id);category('plant');root.PVZ_UI?.refresh(header);root.PVZ_UI?.refresh(tabs);return {book,select,category};
}
root.PVZ_ALMANAC_UI={mount};
if(document.body.dataset.page==='almanac'){
 let unlocked=['normal'];try{const saved=JSON.parse(localStorage.getItem('pvz-rise-slice-progress-v1')||'null');if(Array.isArray(saved?.unlocked))unlocked=[...new Set(['normal',...saved.unlocked])];}catch{}
 const view=mount(document.getElementById('almanacRoot'),{unlocked});if(location.hash==='#boss'){view.category('zombie');view.select('boss');}root.PVZ_UI?.init('wood');
}
})(window);
