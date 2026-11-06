(async function(){'use strict';
const $=id=>document.getElementById(id),data=PVZ_RESCUE_DESIGN,model=PVZ_RESCUE_SCENE,assets=PVZ_ASSETS,canvas=$('scene'),ctx=canvas.getContext('2d'),pictures={};
Object.assign(assets.actors,PVZ_RESCUE_PLANT_ASSETS.actors);Object.assign(assets.images,PVZ_RESCUE_PLANT_ASSETS.images);
const cameraTop=globalThis.PVZ_GAME_WINDOW?.cameraTop??72;
const progress=globalThis.PVZ_TERRAIN_PROGRESS,params=new URLSearchParams(location.search),requested=Number(params.get('level')||0);
const initial=progress?progress.initial(progress.trial?requested:null):Number.isInteger(requested)&&data.levels[requested]?requested:0;
let scene=model.createScene(initial),ready=false,painter,last=0,refreshAt=0,panel=null,resumePaused=false,storyMode='letter',storyReturn=null,introPaused=false;
let hoverTarget=null,pointerCell=null,selectionVisible=false;
let draft=null,draftTeam=0,draftSlot=null,cardType='normal',plaque=null,feedbackUntil=0,targetMarker=null,roundRemaining=8,doorStoryShown=false,campStoryShown=false,resultShown=false;
const level=()=>data.levels[scene.levelIndex],team=()=>scene.teams.find(t=>t.id===scene.selected),living=t=>t?.members.filter(m=>m.hp>0)||[];
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,attrs={})=>{const b=el('button',text);b.type='button';Object.assign(b,attrs);b.onclick=fn;return b;};
const portrait=type=>globalThis.PVZ_TERRAIN_UNITS?.portraitOf(type)||'assets/portraits/'+type+'.png';
const point=p=>({x:PVZ.FIELD.gridLeft+(p.col+.5)*PVZ.FIELD.columnWidth,y:PVZ.FIELD.rowTop+(p.row+1)*PVZ.FIELD.rowHeight-PVZ.FIELD.footInset-cameraTop});
const book=PVZ_RESCUE_STORY_UI.createBook(document,mode=>openStory(mode));
const economy=PVZ_PLANT_ECONOMY_UI.create(document,data);
function active(){return ready&&['planning','battle'].includes(scene.status)&&!panel&&!intro?.active;}
function focusBattle(){if(ready)canvas.focus({preventScroll:true});}
function closeDialog(restore=true){const old=panel;if(!old)return;panel=null;const d=$(old);if(d.open){if(d.close)d.close();else d.removeAttribute('open');}if(restore){scene.paused=resumePaused;last=0;focusBattle();}refresh();}
function openDialog(id){if(!ready)return;hoverTarget=null;if(panel!==id){if(!panel)resumePaused=scene.paused;else closeDialog(false);panel=id;scene.paused=true;const d=$(id);if(!d.open){if(d.showModal)d.showModal();else d.setAttribute('open','');}}hidePlaques();last=0;refresh();}
function finishPanel(){if(panel==='storyBook'){const mode=storyMode,back=storyReturn;storyReturn=null;closeDialog();if(back==='gameOptions'){openDialog('gameOptions');return;}if(mode==='letter'&&progress?.status().readFailed)feedback('旧存档无法读取，本次不会覆盖原档',data.camp);if(mode==='rescue')sendHome();if(['won','lost'].includes(scene.status))showResult();}else if(panel==='formation'){draft=null;closeDialog();}else if(['settings','levelPicker'].includes(panel))openDialog('gameOptions');else if(panel==='outcome'){}else if(panel==='gameOptions'){resumePaused=false;closeDialog();}}
for(const id of ['formation','gameOptions','settings','levelPicker','storyBook','outcome']){
 $(id).addEventListener('cancel',e=>{e.preventDefault();finishPanel();});
 $(id).addEventListener('close',()=>{if(panel===id)finishPanel();});
}
function openStory(mode='letter',back=null){if(!ready||!['letter','rescue','camp'].includes(mode))return;storyMode=mode;storyReturn=back;book.render(scene,mode);$('bookClose').textContent=mode==='rescue'?'一起回去':mode==='camp'?'收好回信':'收好来信';openDialog('storyBook');}
const intro=globalThis.PVZ_ADVENTURE_INTRO?.create(document,{persist:!progress?.trial,onExit(){scene.paused=introPaused;last=0;openStory('letter');}});
function replayIntro(){if(!ready||!intro)return;if(panel)closeDialog();introPaused=scene.paused;scene.paused=true;intro.start();last=0;}
$('replayIntro').onclick=replayIntro;$('bookClose').onclick=finishPanel;
for(const tab of document.querySelectorAll('[data-story-page]'))tab.onclick=()=>{const back=storyReturn;openStory(tab.dataset.storyPage,back);};
function feedback(text,anchor){const node=$('feedback');node.textContent=text;node.hidden=false;feedbackUntil=performance.now()+3000;positionPlaque(node,anchor||team()||data.camp);}
function hidePlaques(){plaque=null;selectionVisible=false;$('actionPlaque').dataset.signature='';$('actionPlaque').hidden=true;$('squadControls').hidden=true;}
function positionPlaque(node,anchor){const p=point(anchor),w=node.offsetWidth||280,h=node.offsetHeight||65;
 const occupied=(PVZ_RESCUE_PAINTER.teamLayout?.(scene)||[]).map(g=>({...g.bounds,top:g.bounds.top-cameraTop,bottom:g.bounds.bottom-cameraTop}));
 for(const a of [...(scene.economySunflowers||[]),...scene.plants.filter(p=>p.hp>0),...scene.caches,scene.goal,...scene.fences,...(scene.follower?[scene.follower]:[])]){const q=point(a);occupied.push({left:q.x-45,right:q.x+45,top:q.y-(a.type==='cactus'?150:105),bottom:q.y+16});}
 if(Number.isInteger(scene.doctor.row)){const d=point(scene.doctor);occupied.push({left:d.x-62,right:d.x+62,top:d.y-145,bottom:d.y+18});}
 if(node===$('feedback'))for(const id of ['actionPlaque','squadControls']){const other=$(id);if(!other.hidden){const left=parseFloat(other.style.left),top=parseFloat(other.style.top);if(Number.isFinite(left)&&Number.isFinite(top))occupied.push({left,right:left+other.offsetWidth,top,bottom:top+other.offsetHeight});}}
 if(pointerCell){const q=point(pointerCell);occupied.push({left:q.x-43,right:q.x+43,top:q.y-85,bottom:q.y+16});}
 // The target tile is reserved too; prefer above the actors, then either flank.
 occupied.push({left:p.x-42,right:p.x+42,top:p.y-85,bottom:p.y+14});
 const candidates=[{x:p.x-w/2,y:p.y-185-h},{x:p.x+78,y:p.y-h-30},{x:p.x-78-w,y:p.y-h-30},{x:p.x-w/2,y:p.y+24},...Array.from({length:96},(_,i)=>({x:8+(i%12)*(1184-w)/11,y:8+Math.floor(i/12)*(584-h)/7}))].map((a,i)=>{const left=Math.max(8,Math.min(1192-w,a.x)),top=Math.max(8,Math.min(592-h,a.y)),right=left+w,bottom=top+h;return{left,top,score:occupied.reduce((sum,b)=>sum+Math.max(0,Math.min(right,b.right)-Math.max(left,b.left))*Math.max(0,Math.min(bottom,b.bottom)-Math.max(top,b.top)),0)*100+Math.hypot(left+w/2-p.x,top+h/2-p.y)*.1+i*2};}).sort((a,b)=>a.score-b.score);
 node.style.left=candidates[0].left+'px';node.style.top=candidates[0].top+'px';
}
function mark(target){targetMarker={...target,until:performance.now()+1500};}
function chooseTeam(id,showActions=false){if(!active())return;scene.selected=id;hidePlaques();selectionVisible=true;if(showActions)plaque={kind:'commands',id};refresh();}
for(let id=0;id<3;id++){const b=button('',()=>chooseTeam(id));b.dataset.team=id;b.setAttribute('aria-label','选择队伍'+(id+1));$('teams').append(b);}
function command(target,order='推进'){
 if(!active()||!model.valid(target))return false;
 const ok=model.command(scene,scene.selected,target,order);if(ok){mark(order==='撤回'?data.camp:target);hidePlaques();feedback(order==='撤回'?'正在回营':order==='驻守'?'原地驻守':'收到',target);}else feedback(living(team()).length?'目标不可达':'先选一支有队员的小队',target);refresh();return ok;
}
function sendHome(){const escort=scene.teams.find(t=>t.id===scene.follower?.escort);if(!escort||!living(escort).length)return;scene.selected=escort.id;command(data.camp,'撤回');}
function groupForSelected(){const selected=team();if(!selected)return null;const group=(PVZ_RESCUE_PAINTER.teamLayout?.(scene)||[]).find(g=>g.teams.some(t=>t.id===scene.selected));if(!group)return null;const teams=group.teams.filter(t=>Math.round(t.row)===Math.round(selected.row)&&Math.round(t.col)===Math.round(selected.col));return teams.length>1?{...group,teams,row:selected.row,col:selected.col}:null;}
function updateSquadControls(){const node=$('squadControls'),group=groupForSelected()||(selectionVisible&&team()?{teams:[team()],row:team().row,col:team().col}:null);node.hidden=!active()||!group||plaque?.kind==='supply'||plaque?.kind==='transfer'||plaque?.kind==='commands'||plaque?.kind==='deploy'||plaque?.kind==='meet';if(node.hidden)return;node.setAttribute('aria-label',group.teams.length>1?'同格队伍':'小队行动');
 const signature=group.teams.map(t=>t.id+':'+t.group+':'+!!t.moving+':'+t.path.length).join('|')+':'+scene.selected;
 if(node.dataset.signature!==signature){node.dataset.signature=signature;const tray=$('squadControlButtons');tray.replaceChildren();if(group.teams.length>1){for(const t of group.teams){const b=button('队伍'+(t.id+1),()=>chooseTeam(t.id));b.dataset.squadSelect=t.id;b.setAttribute('aria-pressed',String(t.id===scene.selected));tray.append(b);}
 const still=group.teams.every(t=>!t.moving&&!t.path.length),canMerge=group.teams.some(t=>t.group==null||t.group!==group.teams[0].group);
 const merge=button('合并',()=>{let ok=false;for(const t of group.teams)if(t.id!==scene.selected)ok=model.mergeTeams(scene,scene.selected,t.id)||ok;feedback(ok?'已合并':'队伍停稳后可合并',team());refresh();},{disabled:!still||!canMerge});merge.dataset.squadAction='merge';tray.append(merge);
 const split=button('分开',()=>{const t=team()?.group!=null?team():group.teams.find(t=>t.group!=null);feedback(t&&model.splitTeams(scene,t.id)?'已分开':'没有联队',team());refresh();},{disabled:!group.teams.some(t=>t.group!=null)});split.dataset.squadAction='split';tray.append(split);}const more=button('行动',()=>{plaque={kind:'commands',id:scene.selected};refresh();});tray.append(more);
 }
 positionPlaque(node,{row:group.row,col:group.col});
}
function supplyReason(state,type,node){const t=team(),cost=PVZ.UNITS[type]?.cost;
 if(!t)return'先选择队伍';if(node&&(!node.claimed||node.broken||node.hp<=0))return node.broken?'墓碑已损坏':'墓碑尚未接通';
 if(node&&model.distance(t,node)>=state.radius)return'靠近墓碑后补给';if(!node&&!state.atCamp&&!state.nearby)return'需要靠近补给碑';
 if(living(t).length>=3)return'队伍已满';if(!state.allowedRecruitTypes.includes(type))return'该兵种无法通过当前路线';if(scene.energy<cost)return'物资不足';return'';
}
function renderPlaque(){const node=$('actionPlaque');node.hidden=!active()||!plaque||plaque.kind==='team'&&!!groupForSelected();if(node.hidden)return;const t=team();if(!t){hidePlaques();return;}
 let anchor=plaque.kind==='supply'?(scene.caches.find(n=>n.id===plaque.node)||data.camp):t;
 const signature=JSON.stringify([plaque,scene.selected,scene.status,scene.energy,t.group,living(t).map(m=>[m.id,m.type,m.airborne]),model.supplyStatus(scene,t.id).atCamp,model.supplyStatus(scene,t.id).nearby]);
 if(node.dataset.signature===signature){positionPlaque(node,anchor);return;}node.dataset.signature=signature;node.dataset.kind=plaque.kind;node.replaceChildren();
 const actions=el('div');
 if(plaque.kind==='supply'){
  const cache=scene.caches.find(n=>n.id===plaque.node);anchor=cache||data.camp;const s=model.supplyStatus(scene,t.id),type=plaque.type&&level().units.includes(plaque.type)?plaque.type:level().units[0];plaque.type=type;
  node.append(el('p',cache?'补给碑 · 队伍'+(t.id+1):'营地 · 队伍'+(t.id+1)));
  const heal=button('回血 · '+s.healCost,()=>{const s=model.supplyStatus(scene,t.id);let reason=cache&&(cache.broken||cache.hp<=0)?'墓碑已损坏':cache&&!cache.claimed?'墓碑尚未接通':cache&&model.distance(t,cache)>=s.radius?'靠近墓碑后回血':!s.nearby?'回血需靠近补给碑':!s.injured?'没有存活伤员':scene.energy<s.healCost?'物资不足':'';if(!reason&&!model.repair(scene,t.id))reason='当前无法回血';feedback(reason||'已回血',anchor);refresh();});
  const recruit=button('补员 · '+PVZ.UNITS[type].cost,()=>{const reason=supplyReason(model.supplyStatus(scene,t.id),type,cache);feedback(reason||(!model.reinforce(scene,t.id,type)?'当前无法补员':'已补员'),anchor);refresh();});
  actions.append(heal,recruit);node.append(actions);const cards=el('div',null,'mini-cards'),pages=Math.ceil(level().units.length/4),page=Math.min(pages-1,plaque.page||0);if(pages>1){const prev=button('‹',()=>{plaque.page=page-1;plaque.type=level().units[(page-1)*4];refresh();},{disabled:page===0});prev.className='pager-button';prev.setAttribute('aria-label','补员兵种上一页');cards.append(prev);}for(const type of level().units.slice(page*4,page*4+4)){const b=button('',()=>{plaque.type=type;refresh();});b.dataset.recruitType=type;b.setAttribute('aria-label',PVZ.UNITS[type].name+'，'+PVZ.UNITS[type].cost+'物资');b.setAttribute('aria-pressed',String(plaque.type===type));const img=el('img');img.src=portrait(type);img.alt='';b.append(img,el('span',String(PVZ.UNITS[type].cost)));cards.append(b);}if(pages>1){const next=button('›',()=>{plaque.page=page+1;plaque.type=level().units[(page+1)*4];refresh();},{disabled:page===pages-1});next.className='pager-button';next.setAttribute('aria-label','补员兵种下一页');cards.append(next);}node.append(cards);
 }else if(plaque.kind==='transfer'){
  node.append(el('p','选择转队成员'));const members=el('div',null,'mini-cards');for(const m of living(t)){const b=button('',()=>{plaque.member=m.id;refresh();});b.setAttribute('aria-label','转移'+PVZ.UNITS[m.type].name);b.setAttribute('aria-pressed',String(plaque.member===m.id));const img=el('img');img.src=portrait(m.type);img.alt='';b.append(img);members.append(b);}node.append(members);
  for(const other of scene.teams.filter(a=>a.id!==t.id))actions.append(button('调入队伍'+(other.id+1),()=>{feedback(model.transfer(scene,t.id,other.id,plaque.member)?'已转队':'需要空位、相邻队伍及合法通路',t);refresh();}));node.append(actions);
 }else{
  node.append(el('p','队伍'+(t.id+1)));actions.append(button('驻守',()=>command({row:Math.round(t.row),col:Math.round(t.col)},'驻守')),button(scene.follower?.escort===t.id?'护送回营':'回营',()=>command(data.camp,'撤回')));
  actions.append(button('汇合',()=>{plaque={kind:'meet',id:t.id};feedback('点击要会合的小队',t);refresh();}));
  if(t.group!=null)actions.append(button('分开',()=>{model.splitTeams(scene,t.id);refresh();}));
  if(scene.status==='planning')actions.append(button('布阵',()=>{plaque={kind:'deploy',id:t.id};feedback('点击栅栏前的起点',t);renderPlaque();}));
  const state=model.supplyStatus(scene,t.id);if(state.atCamp||state.nearby)actions.append(button('补员',()=>{plaque={kind:'supply',node:state.nearby?state.node.id:null};refresh();}));
  if(typeof model.landTeam==='function'&&living(t).some(m=>m.type==='balloon'&&m.airborne))actions.append(button('落地',()=>{feedback(model.landTeam(scene,t.id)?'已落地':'需要桥面或岸上',t);refresh();}));
  if(living(t).length)actions.append(button('转队',()=>{plaque={kind:'transfer',member:living(t)[0].id};refresh();}));node.append(actions);
 }
 const close=button('收起',()=>{hidePlaques();refresh();});close.dataset.closePlaque='';close.setAttribute('aria-label','收起');close.title='收起操作牌';node.append(close);positionPlaque(node,anchor);
}
function showFormation(){if(!ready||scene.status!=='planning')return;draft=structuredClone(scene);draftTeam=Number.isInteger(scene.selected)?scene.selected:0;draftSlot=null;cardType=level().units[0];$('formationFeedback').textContent='';renderFormation();openDialog('formation');}
function renderFormation(){if(!draft)return;$('formation').dataset.deckSize=level().units.length<=5?'small':'large';const tray=$('roster');tray.replaceChildren();for(let id=0;id<3;id++){const card=el('section',null,'formation-team');card.setAttribute('aria-current',String(draftTeam===id));card.append(button('队伍'+(id+1)+' · '+living(draft.teams[id]).length+'/3',()=>{draftTeam=id;draftSlot=null;renderFormation();}));const slots=el('div',null,'member-slots');for(let slot=0;slot<3;slot++){const member=draft.teams[id].members.find(m=>m.slot===slot&&m.hp>0),b=button('',()=>{draftTeam=id;draftSlot=slot;if(member)model.configure(draft,id,slot,'');$('formationFeedback').textContent='';renderFormation();});b.dataset.memberSlot=id+'-'+slot;b.setAttribute('aria-label','队伍'+(id+1)+'成员'+(slot+1)+(member?'，'+PVZ.UNITS[member.type].name+'，点击移除':'，空位'));b.setAttribute('aria-pressed',String(draftTeam===id&&draftSlot===slot));if(member){const img=el('img');img.src=portrait(member.type);img.alt='';b.append(img,el('span',String(PVZ.UNITS[member.type].cost),'slot-price'));}else b.append(el('span','＋','empty-slot'));slots.append(b);}card.append(slots);tray.append(card);}
 const cards=$('zombieCards');cards.replaceChildren();for(const type of level().units){const unit=PVZ.UNITS[type],b=button('',()=>{cardType=type;const slot=draftSlot??[0,1,2].find(slot=>!draft.teams[draftTeam].members.some(m=>m.slot===slot&&m.hp>0));if(slot==null)$('formationFeedback').textContent='本队已满，先移除一个成员';else if(!model.configure(draft,draftTeam,slot,type))$('formationFeedback').textContent='预算不足，或当前落点不支持该兵种';else{$('formationFeedback').textContent='';draftSlot=null;}renderFormation();});b.dataset.zombieCard=type;b.setAttribute('aria-label',unit.name+'，'+unit.cost+'预算');b.setAttribute('aria-pressed',String(cardType===type));const img=el('img');img.src=portrait(type);img.alt='';b.append(img,el('span',String(unit.cost),'zombie-price'));cards.append(b);}
 const unit=PVZ.UNITS[cardType],info=$('cardInfo');info.replaceChildren(el('h3',unit.name),el('p','费用 '+unit.cost),el('p',unit.role||({normal:'基础接应',cone:'路障护甲',bucket:'铁桶重装',balloon:'空中侦察，无法在空中开门',digger:'快速地面攻坚'})[cardType]||'协同接应'));
 const limits=unit.trait?.burrowImplemented===false?'当前为地面行动':unit.trait?.climbImplemented===false?'当前不具备架梯能力':cardType==='balloon'?'开门需地面队员':unit.water?'可进入水面':'水路需要桥面';info.append(el('p',limits));const cost=model.compositionCost(draft),budget=level().compositionBudget; $('compositionInfo').textContent='总费用 '+cost+(Number.isFinite(budget)?' · 剩余 '+(budget-cost):'');
}
$('formationOpen').onclick=showFormation;$('formationCancel').onclick=()=>{draft=null;closeDialog();};$('formationConfirm').onclick=()=>{if(!draft||scene.status!=='planning')return;scene.teams=draft.teams;scene.nextMember=draft.nextMember;draft=null;closeDialog();};
$('menuOpen').onclick=()=>openDialog('gameOptions');$('continueGame').onclick=()=>{resumePaused=false;closeDialog();};$('restart').onclick=()=>reset(scene.levelIndex);$('returnHome').onclick=$('resultHome').onclick=()=>{location.href='index.html';};
$('replayLetters').onclick=()=>openStory('letter','gameOptions');$('settingsOpen').onclick=()=>openDialog('settings');$('settingsClose').onclick=$('levelClose').onclick=()=>openDialog('gameOptions');
$('chooseLevel').onclick=()=>{const buttons=$('levelButtons');buttons.replaceChildren();for(const[i,l]of data.levels.entries()){const b=button(l.tag,()=>reset(i),{disabled:!!progress&&!progress.canEnter(i)});b.title=l.title;b.dataset.level=i;b.setAttribute('aria-current',String(scene.levelIndex===i));b.setAttribute('aria-label',l.tag+' '+l.title+(b.disabled?'，未解锁':''));buttons.append(b);}openDialog('levelPicker');};
$('fullscreen').disabled=typeof document.documentElement.requestFullscreen!=='function';$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('fullscreen').textContent='无法切换全屏';}};
$('soft').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('start').onclick=()=>{if(!active()||scene.status!=='planning')return;if(!model.start(scene)){feedback(Number.isInteger(scene.doctor.row)?'至少编入一名同胞':'先选择一段藏身栅栏',{row:2,col:9});targetMarker={row:2,col:9,until:performance.now()+2200,fences:true};}else{scene.paused=false;hidePlaques();feedback('出发',team());}refresh();};
function showResult(){if(!ready||!['won','lost'].includes(scene.status))return;resultShown=true;const won=scene.status==='won',final=scene.levelIndex===data.levels.length-1;$('outcomeTitle').textContent=won?'接应成功':'接应未完成';$('outcomeText').textContent=won?'已接回'+(level().escort?.name||'同胞')+' · 阵亡 '+(scene.record?.casualties||0)+' 人':scene.result;$('next').hidden=!won||final;$('retryRound').textContent=won?'重玩':'重试';$('autoRoundBox').hidden=!won||final;roundRemaining=8;openDialog('outcome');}
$('retryRound').onclick=()=>reset(scene.levelIndex);$('next').onclick=()=>reset(scene.levelIndex+1);$('autoRound').onchange=()=>{roundRemaining=8;if($('autoRound').checked)resumePaused=false;refresh();};
function reset(index){if(!data.levels[index]||progress&&!progress.canEnter(index))return;closeDialog();scene=model.createScene(index);draft=null;hidePlaques();targetMarker=null;hoverTarget=pointerCell=null;$('feedback').hidden=true;last=0;roundRemaining=8;doorStoryShown=campStoryShown=resultShown=false;refresh();openStory();}
function fieldClick(target){if(!active()||!model.valid(target))return;
 if(scene.status==='planning'&&target.col===data.backline.fenceColumn){model.chooseDoctor(scene,target.row);hidePlaques();mark(target);feedback('博士已藏好',target);refresh();return;}
 if(scene.status==='planning'&&(plaque?.kind==='deploy'||target.col===data.camp.col)){const ok=model.deployTeam(scene,scene.selected,target);hidePlaques();feedback(ok?'布阵完成':'选择栅栏前的合法起点',target);if(ok)mark(target);refresh();return;}
 const cache=scene.caches.find(n=>n.row===target.row&&n.col===target.col);
 if(cache){if(cache.broken){feedback('墓碑已损坏',target);return;}if(cache.claimed&&team()&&model.distance(team(),cache)<1.15){plaque={kind:'supply',node:cache.id};refresh();return;}command(target);if(cache.claimed)feedback('靠近墓碑后可补给',target);return;}
 if(target.row===data.camp.row&&target.col===data.camp.col&&team()&&model.distance(team(),data.camp)<.75&&model.supplyStatus(scene,scene.selected).atCamp){plaque={kind:'supply',node:null};refresh();return;}
 const accepted=command(target);if(accepted&&!scene.goal.open&&target.row===scene.goal.row&&target.col===scene.goal.col){const claimed=scene.caches.filter(n=>n.claimed&&!n.broken).length;if(claimed<level().requiredCaches)feedback('需接通补给碑 '+claimed+'/'+level().requiredCaches,target);}
}
function mouseTarget(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*1200/r.width,y=(e.clientY-r.top)*720/r.height;const target={row:Math.floor((y-PVZ.FIELD.rowTop)/PVZ.FIELD.rowHeight),col:Math.floor((x-PVZ.FIELD.gridLeft)/PVZ.FIELD.columnWidth)};return model.valid(target)?target:null;}
canvas.onpointermove=e=>{hoverTarget=active()?mouseTarget(e):null;};canvas.onpointerleave=()=>{hoverTarget=null;};
canvas.onclick=e=>{pointerCell=mouseTarget(e);if(!active())return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*1200/rect.width,y=(e.clientY-rect.top)*720/rect.height;focusBattle();const target={row:Math.floor((y-PVZ.FIELD.rowTop)/PVZ.FIELD.rowHeight),col:Math.floor((x-PVZ.FIELD.gridLeft)/PVZ.FIELD.columnWidth)};
 if(plaque?.kind==='deploy'){fieldClick(target);return;}
 if(plaque?.kind==='meet'){const id=PVZ_RESCUE_PAINTER.pickTeam?.(scene,x,y,{preferFeet:true}),other=scene.teams.find(t=>t.id===id);command(other?{row:Math.round(other.row),col:Math.round(other.col)}:target);return;}
 const picked=PVZ_RESCUE_PAINTER.pickTeam?.(scene,x,y);if(picked!=null){chooseTeam(picked);return;}fieldClick(target);
};
let cursor={row:2,col:8};canvas.onkeydown=e=>{if(!active())return;const moves={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};if(moves[e.key]){e.preventDefault();const[drow,dcol]=moves[e.key];cursor={row:Math.max(0,Math.min(4,cursor.row+drow)),col:Math.max(0,Math.min(9,cursor.col+dcol))};mark(cursor);}else if(e.key==='Enter'){e.preventDefault();fieldClick(cursor);}else if(/^[1-3]$/.test(e.key)){e.preventDefault();chooseTeam(Number(e.key)-1);}else if(e.key==='Escape'){e.preventDefault();openDialog('gameOptions');}};
for(const id of ['actionPlaque','squadControls']){$(id).addEventListener('click',e=>e.stopPropagation());$(id).addEventListener('pointerdown',e=>e.stopPropagation());}
function refresh(){const planning=scene.status==='planning';$('missionName').textContent=level().tag+' · '+level().title;$('missionName').title=level().title;$('energy').textContent='物资 '+scene.energy;$('doctorStatus').textContent='博士 '+scene.doctor.hits+'/10';$('clock').textContent=scene.paused?'已暂停':planning?scene.planning>0?'准备 '+Math.ceil(Math.max(0,scene.planning-1e-8))+'秒':'等待藏身':scene.status==='battle'?'行动 '+Math.floor(scene.time)+'秒':scene.status==='won'?'成功':'结束';
 $('start').hidden=$('formationOpen').hidden=!planning;$('start').disabled=$('formationOpen').disabled=$('menuOpen').disabled=!ready;
 for(const b of $('teams').children){const t=scene.teams[Number(b.dataset.team)];b.replaceChildren();const img=el('img');img.src=portrait(living(t)[0]?.type||'normal');img.alt='';b.append(img,el('span',String(t.id+1)),el('br'),el('span',living(t).length+'/3'));b.setAttribute('aria-label','队伍'+(t.id+1)+'，'+living(t).length+'/3人');b.setAttribute('aria-pressed',String(scene.selected===t.id));b.disabled=!ready;}
 economy.refresh(scene);renderPlaque();updateSquadControls();
 $('roundStatus').textContent=!$('autoRound').checked?'自动接续已取消':resumePaused?'接续已暂停，重新勾选可继续':Math.ceil(Math.max(0,roundRemaining))+'秒后下一关 · 取消勾选可停止';
 canvas.setAttribute('aria-label','营救战场，'+level().title+'。'+$('clock').textContent+'，博士剩余'+scene.doctor.hits+'次命中。');
}
function nativePause(){scene.paused=true;if(panel)resumePaused=true;if(intro?.active){introPaused=true;intro.pause();}last=0;refresh();}
window.addEventListener('pvz-native-pause',nativePause);document.addEventListener('visibilitychange',()=>{if(document.hidden)nativePause();last=0;});
$('retry').onclick=()=>location.reload();
function load(src){return new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>reject(Error('素材读取超时，请重试')),15000);image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(Error('素材读取失败：'+src));};image.src=src;});}
refresh();
try{
 await Promise.all([...Object.entries(assets.images).map(async([id,v])=>pictures[id]=await load(v.path)),...Object.entries(assets.ui).map(async([id,v])=>pictures['ui:'+id]=await load(v)),...Object.entries(assets.storyArt).filter(([id])=>id!=='refuge-strip').map(async([id,v])=>pictures['story:'+id]=await load(v.file)),...Object.entries(globalThis.PVZ_BATTLE_ENV?.resources||{}).map(async([id,file])=>pictures['env:'+id]=await load(file)),...Object.entries(globalThis.PVZ_TERRAIN_PLANT_ASSETS?.supports||{}).map(async([id,file])=>pictures['support:'+id]=await load(file)),...Object.entries(data.art).map(async([id,file])=>pictures[id]=await load(file)),(async()=>pictures.door=await load('assets/ui/rescue-door.png'))(),(async()=>pictures.energyHead=await load('assets/portraits/zomboss-head.png'))()]);
 painter=PVZ_RESCUE_PAINTER.createPainter(PVZ_RENDER.createRenderer(assets,pictures,null),pictures);ready=true;$('loading').textContent='';refresh();
 if(intro&&params.get('adventure')==='1'&&!progress?.trial&&scene.levelIndex===0&&!intro.seen)replayIntro();else openStory();
 function frame(now){const dt=last?Math.min(5,(now-last)/1000):0;last=now;if(intro?.active&&!document.hidden)intro.step(Math.min(dt,.1));model.step(scene,dt);
  if(scene.goal.open&&!doorStoryShown&&scene.status==='battle'&&!panel&&!intro?.active){doorStoryShown=true;openStory('rescue');}
  if(scene.status==='won'&&!campStoryShown&&!panel){campStoryShown=true;if(progress&&!progress.complete(scene.levelIndex)&&!progress.trial)feedback('本次进度未保存',data.camp);openStory('camp');}
  if(scene.status==='lost'&&!resultShown&&!panel)showResult();
  if(panel==='outcome'&&scene.status==='won'&&scene.levelIndex<data.levels.length-1&&$('autoRound').checked&&!document.hidden&&!resumePaused){roundRemaining-=dt;if(roundRemaining<=0)reset(scene.levelIndex+1);}
  if(feedbackUntil<now)$('feedback').hidden=true;if(targetMarker?.until<now)targetMarker=null;
  painter.paint(ctx,scene,{reducedMotion:$('soft').checked,cleanUI:true,cursor:active()?hoverTarget:null,target:plaque?.kind==='supply'?(scene.caches.find(n=>n.id===plaque.node)||targetMarker):targetMarker});updateSquadControls();if(now-refreshAt>150){refresh();refreshAt=now;}requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
}catch(error){$('loading').textContent=error.message;$('retry').hidden=false;console.error(error);}
})();
