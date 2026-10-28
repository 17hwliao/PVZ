(function(root){'use strict';
const data=typeof module!=='undefined'&&module.exports?require('./rescue-story-data.js'):root.PVZ_RESCUE_STORY;
function aftermath(scene){
 const record=scene.record||{},lost=record.casualties||0,broken=scene.caches.filter(c=>c.broken),fences=scene.fences.filter(f=>f.hp<=0),paragraphs=[];
 if(scene.status==='won'){
  paragraphs.push('护送对象已经随接应队返回营地。'+(lost===0?'参加行动的小队没有新增阵亡；受伤的同胞仍需要修整。':'有'+lost+'名同胞没能回来。灯房先把他们记进名单，再安排下一次接应。'));
  paragraphs.push('本次接通'+scene.caches.filter(c=>c.claimed).length+'座补给碑；'+(broken.length?'其中'+broken.length+'座已破损，返程后的补给需要重新整理。':'补给碑没有被打碎，回程联络仍在。')+(fences.length?' 第'+fences.map(f=>f.row+1).join('、')+'行后方栅栏失去掩护。':' 后方五段栅栏仍有掩护。'));
 }else if(scene.status==='lost')paragraphs.push('这次接应没有完成。'+scene.result+' 灯房暂不写“大家已经回来”，先重新确认队伍和接应路线。');
 else paragraphs.push('本关仍在行动中，回营后的回应尚未发生。先把同胞带回来，再打开这封回信。');
 return paragraphs;
}
function createBook(doc,onSelect){
 const title=doc.getElementById('bookTitle'),eyebrow=doc.getElementById('bookEyebrow'),nav=doc.getElementById('bookNav'),body=doc.getElementById('bookBody');
 const element=(tag,text,className)=>{const e=doc.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;};
 const paragraph=text=>body.append(element('p',text));
 function section(name,lines){body.append(element('h3',name));const list=element('ul');for(const line of lines)list.append(element('li',line));body.append(list);}
 function routeMap(plan){const figure=element('figure',null,'plan-map'),grid=element('div',null,'plan-grid');grid.setAttribute('role','img');grid.setAttribute('aria-label',plan.title+'路线草图：五行十列，第10列为栅栏，第9列为营地；中央缺口在第'+plan.layout.gates.map(r=>r+1).join('、')+'行。');
  for(let row=0;row<5;row++)for(let col=0;col<10;col++){const cell=element('div',null,'plan-cell'),point=plan.layout.points.find(p=>p.row===row&&p.col===col),blocked=plan.layout.blocked.some(p=>p.row===row&&p.col===col),kind=col===9?'fence':blocked?'hedge':point?.kind;const file=kind==='fence'?'assets/rescue-design/refuge-fence.webp':kind==='hedge'?'assets/rescue-design/route-hedge.webp':kind==='door'?'assets/ui/rescue-door.png':kind==='cache'?'assets/rescue-design/route-cache.webp':null;
   if(file){const image=element('img');image.src=file;image.alt='';cell.append(image);}if(point)cell.append(element('span',point.name));if(row===2&&col===8)cell.append(element('span','营地'));if(kind==='heavy')cell.classList.add('plan-heavy');if(kind==='reserve')cell.classList.add('plan-reserve');cell.title='第'+(row+1)+'行第'+(col+1)+'列'+(point?' · '+point.name:'');grid.append(cell);}
  figure.append(grid,element('figcaption','路线草图 · 暂避屋／账柜／会合点为拟定位置；正式对局尚未开放。'));body.append(figure);
 }
 function render(scene,mode='letter',index=scene.levelIndex){
  const future=mode==='future',mission=data.missions[scene.levelIndex],item=future?data.plans[index]||data.plans[0]:mission,navFocus=nav.contains(doc.activeElement),navLeft=nav.scrollLeft,navTop=nav.scrollTop;nav.replaceChildren();body.replaceChildren();body.classList.remove('play-guide');body.scrollTop=0;const scrollBox=doc.querySelector('.book-layout');if(scrollBox)scrollBox.scrollTop=0;
  for(const tab of doc.querySelectorAll('#bookTabs [data-story-page]')){tab.setAttribute('aria-pressed',String(tab.dataset.storyPage===mode));tab.hidden=tab.dataset.storyPage==='rescue'&&!scene.goal.open;}
  if(mode==='guide'&&root.PVZ_PLAY_GUIDE){root.PVZ_PLAY_GUIDE.render(doc,scene,index,onSelect);if(navFocus)nav.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});return;}
  if(future){
   let selected;for(const [i,plan]of data.plans.entries()){const button=element('button',plan.tag+' · '+plan.title);button.type='button';button.setAttribute('aria-pressed',String(plan===item));button.onclick=()=>onSelect('future',i);nav.append(button);if(plan===item)selected=button;}
   nav.scrollLeft=navLeft;nav.scrollTop=navTop;if(navFocus&&selected){selected.focus({preventScroll:true});if(typeof selected.scrollIntoView==='function')selected.scrollIntoView({block:'nearest',inline:'nearest'});}
   eyebrow.textContent=item.chapter+' · '+item.kind;title.textContent=item.tag+' · '+item.title;body.append(element('p','设计中 · 尚不可进入战斗','design-stamp'));const atlas=element('a','查看八种场地与完整战役路线','classic-button');atlas.href='battle-atlas.html';body.append(atlas);routeMap(item);paragraph(item.letter);section('为什么要去',item.beats);section('对局目标',[item.objective]);section('路线与分工',item.rows);section('三队各做什么',item.teams);section('这一关的新难题',[item.challenge]);section('植物会怎样应对',[item.ai,item.telegraph]);section('受挫后如何接应',[item.recovery]);section('沿用的规则',data.common);section('体验重点',[item.focus]);paragraph('故事接续：'+item.next);return;
  }
  for(const [value,label]of [['letter','战前来信'],['rescue','门后的交谈'],['camp','灯房回信']]){if(value==='rescue'&&!scene.goal.open)continue;const b=element('button',label);b.type='button';b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>onSelect(value);nav.append(b);}
  if(mode==='rescue'&&scene.goal.open){eyebrow.textContent=mission.tag+' · 门已经打开';title.textContent='门后的人';for(const [speaker,line]of mission.rescued){const p=element('p',null,'story-dialogue');p.append(element('strong',speaker+'：'),doc.createTextNode(line));body.append(p);}paragraph('接下来：带着护送标识的同胞返回第9列营地。护送队会等候较慢的同胞；原护送队倒下后，附近另一队可以接手。');}
  else if(mode==='camp'){eyebrow.textContent=mission.tag+' · 灯房';title.textContent=scene.status==='won'?'回来以后':'还没有写完的回信';for(const line of aftermath(scene))paragraph(line);if(scene.status==='won'){for(const line of mission.camp)paragraph(line);body.append(element('p',mission.next,'story-next'));}}
  else{eyebrow.textContent=mission.tag+' · '+mission.place;title.textContent=mission.title;for(const line of mission.letter)paragraph(line);body.append(element('p','—— '+mission.sender,'story-signature'));}
 }
 return{render};
}
const api={createBook,aftermath};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_RESCUE_STORY_UI=api;
})(typeof window!=='undefined'?window:globalThis);
