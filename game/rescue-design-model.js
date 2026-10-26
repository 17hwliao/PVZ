(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports,defaultData=node?require('./rescue-design-data.js'):root.PVZ_RESCUE_DESIGN,defaultStats=node?require('./engine.js'):root.PVZ;
function createModel(data,stats,rules=null){
const distance=(a,b)=>Math.hypot(a.row-b.row,a.col-b.col),cell=p=>({row:Math.round(p.row),col:Math.round(p.col)});
const valid=p=>!!p&&Number.isInteger(p.row)&&Number.isInteger(p.col)&&p.row>=0&&p.row<5&&p.col>=0&&p.col<10;
const solid=(p,levelIndex)=>p.col===data.backline.fenceColumn||[...data.levels[levelIndex].caches,data.levels[levelIndex].prison].some(b=>b.row===p.row&&b.col===p.col);
const walkable=(p,levelIndex=0,scene=null,actor=null)=>valid(p)&&!data.levels[levelIndex].blocked.some(b=>b.row===p.row&&b.col===p.col)&&!solid(p,levelIndex)&&(!rules||!scene||rules.canWalk(scene,p,actor,stats.UNITS));
function route(start,end,levelIndex=0,scene=null,actor=null){
 const pass=p=>walkable(p,levelIndex,scene,actor);
 if(!pass(start)||!valid(end))return[];
 const interact=solid(end,levelIndex),destinations=interact?[{row:end.row,col:end.col-1},{row:end.row,col:end.col+1},{row:end.row-1,col:end.col},{row:end.row+1,col:end.col}].filter(p=>pass(p)):[end];
 if(!destinations.some(p=>pass(p)))return[];
 const key=p=>p.row+':'+p.col,queue=[{...start}],seen=new Map([[key(start),null]]),level=data.levels[levelIndex];let destination=null;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(destinations.some(q=>key(q)===key(p))){destination=p;break;}
  const choices=[{row:p.row,col:p.col-1},{row:p.row,col:p.col+1},...(level.corridors.includes(p.col)?[{row:p.row-1,col:p.col},{row:p.row+1,col:p.col}]:[])];
  for(const q of choices)if(pass(q)&&!seen.has(key(q))){seen.set(key(q),p);queue.push(q);}}
 if(!destination)return[];const points=[];for(let p=destination;p;p=seen.get(key(p)))points.unshift({...p});return points;
}
const airborne=m=>m.type==='balloon'&&m.airborne!==false;
const groundMembers=t=>t.members.filter(m=>m.hp>0&&!airborne(m));
const plantBlocking=p=>p.hp>0&&!(p.type==='squash'&&['rising','falling','spent'].includes(p.ability?.state));
function member(type,id){return{id,type,hp:stats.UNITS[type].hp,maxHp:stats.UNITS[type].hp,visualType:stats.UNITS[type].visualType||type,hit:0,airborne:type==='balloon',pop:0};}
const alive=t=>t.members.some(m=>m.hp>0);
function event(s,text){s.events.unshift({time:s.time,text});s.events.length=Math.min(6,s.events.length);}
function plant(type,id,row,col,opening=false){return{id,type,row,col,hp:data.plantCombat[type].hp,maxHp:data.plantCombat[type].hp,path:[],moving:false,attack:0,hit:0,cooldown:1,lastMove:-10,squad:'守门组',order:'警戒',facing:1,opening,sunTimer:12.5,ability:{state:'idle',elapsed:0},cactusHeight:0};}
function createScene(levelIndex=0){
 if(!Number.isInteger(levelIndex)||!data.levels[levelIndex])throw Error('Unknown rescue level');
 const level=data.levels[levelIndex];let serial=0;
 const teams=[1,3,4].map((row,id)=>({id,name:['开路队','接应队','后援队'][id],row,col:data.camp.col,path:[],facing:-1,moving:false,order:'驻守',attack:0,attackTimer:0,slow:0,members:[0,1,2].map(slot=>({...member('normal',serial++),slot}))}));
 const s={levelIndex,phase:0,time:0,prepTime:0,planning:60,status:'planning',paused:false,selected:0,teams,plants:Array.from({length:5},(_,row)=>plant('sunflower',row,row,0,true)),energy:level.budget?.energy??150,nextMember:serial,nextPlant:5,nextShot:1,projectiles:[],dead:[],claimed:[],caches:level.caches.map(c=>({...c,hp:180,maxHp:180,progress:0,claimed:false,broken:false,paid:false,breakPaid:false})),doctor:{id:'doctor',row:null,col:data.backline.rearColumn,hits:10,maxHits:10,path:[],moving:false,facing:-1,hit:0,seenHits:new Set()},fences:Array.from({length:5},(_,row)=>({id:'fence-'+row,row,col:data.backline.fenceColumn,hp:data.backline.fenceHp,maxHp:data.backline.fenceHp,hit:0})),goal:{...level.prison,open:false,progress:0},follower:null,economy:{sun:level.budget?.sun??500,earned:0,spent:0,clock:0,cooldowns:Object.fromEntries(Object.keys(data.plantCards).map(k=>[k,0])),nextDeploy:.8,placements:[]},ai:{next:3.5,focus:'布置防线',previous:null,previousPressure:0,feints:0,turns:0,history:[],observations:[],groups:[]},record:{casualties:0,swallowed:0,crushed:0,reinforcements:0},events:[{time:0,text:level.opening}],result:''};
 // The five opening producers belong to the off-board economy, never combat.
 s.economySunflowers=s.plants.map((p,row)=>({...p,id:'economy-'+row,col:-1.15,invulnerable:true,outsideBattle:true,squad:'场外供给',order:'生产阳光'}));s.plants=[];
 s.teams.forEach(t=>t.group=null);if(rules)rules.initialize(s,level);return s;
}
// Initial composition is free within unlocked types; reinforcements still consume supplies in battle.
function configure(s,id,slot,type){
 if(s.status!=='planning'||!Number.isInteger(slot)||slot<0||slot>2||!s.teams[id]||(type!==''&&!data.levels[s.levelIndex].units.includes(type)))return false;
 const t=s.teams[id],old=t.members.find(m=>m.slot===slot);if(type&&compositionCost(s)-(old?stats.UNITS[old.type].cost:0)+stats.UNITS[type].cost>(data.levels[s.levelIndex].compositionBudget??Infinity))return false;t.members=t.members.filter(m=>m.slot!==slot);
 if(type)t.members.push({...member(type,old?.id??s.nextMember++),slot});t.members.sort((a,b)=>a.slot-b.slot);if(!alive(t)){t.path=[];t.moving=false;}return true;
}
function deployTeam(s,id,target){if(s.status!=='planning'||!s.teams[id]||!walkable(target,s.levelIndex,s,s.teams[id])||target.col!==data.camp.col)return false;Object.assign(s.teams[id],target,{path:[],moving:false,order:'驻守',interaction:null});return true;}
function canJoin(s,t,m){
 if(!rules)return true;const members=[...t.members.filter(a=>a.hp>0),m],linked=[{...t,members},...party(s,t).filter(a=>a!==t)],traveler=partyTraveler(s,linked);
 return linked.every(a=>[cell(a),...(a.path.length?[a.edgeStart||cell(a),...a.path]:[])].every(q=>walkable(q,s.levelIndex,s,traveler)));
}
function transfer(s,from,to,memberId){
 if(!['planning','battle'].includes(s.status)||from===to)return false;const a=s.teams[from],b=s.teams[to];if(!a||!b||b.members.filter(m=>m.hp>0).length>=3||(s.status==='battle'&&distance(a,b)>1.2))return false;
 const m=a.members.find(m=>m.id===memberId&&m.hp>0);if(!m||!canJoin(s,b,m))return false;a.members=a.members.filter(v=>v!==m);b.members=b.members.filter(v=>v.hp>0);m.slot=[0,1,2].find(n=>!b.members.some(v=>v.slot===n));b.members.push(m);if(!alive(a)){a.path=[];a.moving=false;}event(s,'一名同胞从'+a.name+'调入'+b.name+'。');return true;
}
function chooseDoctor(s,row){if(s.status!=='planning'||!Number.isInteger(row)||row<0||row>=data.rows)return false;s.doctor.row=row;return true;}
function start(s,auto=false){
 if(s.status!=='planning'||!Number.isInteger(s.doctor.row))return false;
 if(!s.teams.some(alive)){if(!auto)return false;configure(s,0,0,'normal');event(s,'空编组自动补入一名普通同胞，开始行动。');}
 s.planning=0;s.status='battle';event(s,'行动开始。植物种植启用正常冷却，承接准备期剩余计时。');return true;
}
function compositionCost(s){return s.teams.reduce((sum,t)=>sum+t.members.filter(m=>m.hp>0).reduce((n,m)=>n+stats.UNITS[m.type].cost,0),0);}
const connectedCell=(s,target)=>!rules||route(data.camp,target,s.levelIndex).length>0;
function plantCell(s,target){return valid(target)&&!data.levels[s.levelIndex].blocked.some(b=>b.row===target.row&&b.col===target.col)&&!solid(target,s.levelIndex)&&target.col>=1&&target.col<=6&&connectedCell(s,target)&&!s.plants.some(p=>p.hp>0&&(distance(p,target)<.9||p.path.some(q=>distance(q,target)<.2)))&&!s.teams.some(t=>alive(t)&&distance(t,target)<.9);}
function canPlant(s,type,target){return ['planning','battle'].includes(s.status)&&data.levels[s.levelIndex].plantDeck.includes(type)&&plantCell(s,target)&&(!rules||rules.hasSurface(s,target))&&s.economy.sun>=data.plantCards[type].cost&&(s.status==='planning'||s.economy.cooldowns[type]<=1e-6)&&s.plants.filter(p=>p.hp>0).length<(data.levels[s.levelIndex].budget?.maxPlants??Infinity);}
function placeSupport(s,type,target){
 if(!rules||!['planning','battle'].includes(s.status)||!plantCell(s,target)||rules.supportType(s,target)!==type||rules.supportAt(s,target))return false;
 const card=data.plantCards[type];if(!card||s.economy.sun<card.cost||(s.status==='battle'&&s.economy.cooldowns[type]>1e-6))return false;
 s.economy.sun-=card.cost;s.economy.spent+=card.cost;s.economy.cooldowns[type]=card.recharge;const support={id:'support-'+s.nextSupport++,type,row:target.row,col:target.col,hp:180,maxHp:180};s.supports.push(support);return support;
}
function useCoffee(s,id){const p=s.plants.find(p=>p.id===id&&p.hp>0&&p.sleeping);const card=data.plantCards.coffee;if(!rules||!['planning','battle'].includes(s.status)||!p||!card||s.economy.sun<card.cost||(s.status==='battle'&&s.economy.cooldowns.coffee>0))return false;s.economy.sun-=card.cost;s.economy.spent+=card.cost;s.economy.cooldowns.coffee=card.recharge;p.sleeping=false;p.awakened=true;p.coffee=.9;event(s,'咖啡豆唤醒了'+data.plantCombat[p.type].name+'。');return true;}
function landTeam(s,id){const t=s.teams.find(t=>t.id===id);if(!rules||s.status!=='battle'||!t||!t.members.some(m=>m.hp>0&&m.type==='balloon'&&m.airborne)||!rules.canWalk(s,t,null,stats.UNITS))return false;for(const m of t.members)if(m.type==='balloon'&&m.airborne){m.airborne=false;m.pop=.72;}t.path=[];t.moving=false;return true;}
function placePlant(s,type,target){
 if(!canPlant(s,type,target))return false;const card=data.plantCards[type];s.economy.sun-=card.cost;s.economy.spent+=card.cost;s.economy.cooldowns[type]=card.recharge;
 const p=plant(type,s.nextPlant++,target.row,target.col);p.createdAt=s.economy.clock;if(rules){p.sleeping=rules.asleep(s,type);p.growth=0;}s.plants.push(p);s.economy.placements.push({id:p.id,type,row:p.row,col:p.col,clock:s.economy.clock,phase:s.status,cost:card.cost});return p;
}
function rowPressure(s){return Array.from({length:5},(_,row)=>s.teams.filter(t=>alive(t)&&Math.round(t.row)===row).reduce((n,t)=>n+t.members.filter(m=>m.hp>0).length*Math.max(.5,1+(7-t.col)*.15),0)+(s.goal.row===row?1.5:0)+(s.follower&&Math.round(s.follower.row)===row?2:0));}
const rangedTypes=new Set(['pea','snow','cactus','puff','fumeshroom','cabbagepult']);
function fireBlocker(s,p,targetCol,lobbed=p.type==='cabbagepult'){
 if(lobbed)return null;
 const blocks=data.levels[s.levelIndex].blocked.filter(b=>sameLane(p,b)&&b.col-.45>p.col+.01&&b.col-.45<targetCol).map(b=>({kind:'barrier',col:b.col-.45}));
 if(rules&&s.terrain.theme==='roof'&&p.col<3.5&&targetCol>=3.5)blocks.push({kind:'ridge',col:3.5});
 return blocks.sort((a,b)=>a.col-b.col)[0]||null;
}
function publicFireTarget(s,p,high=false,visible=observeAI(s)){
 const range=data.plantCombat[p.type].range??12,targets=visible.teams.filter(t=>sameLane(p,t)&&t.col>=p.col-.05&&t.members.some(m=>m.airborne===high)).map(t=>({kind:'team',actor:t}));
 if(!high){targets.push(...visible.caches.filter(c=>c.claimed&&!c.broken&&sameLane(p,c)).map(c=>({kind:'cache',actor:c})),...visible.fences.filter(f=>f.hp>0&&sameLane(p,f)).map(f=>({kind:'fence',actor:f})));if(range>=12)targets.push({kind:'exit',actor:{row:Math.round(p.row),col:data.backline.rearColumn}});}
 return targets.filter(t=>t.actor.col>=p.col-.05&&t.actor.col-p.col<range).sort((a,b)=>a.actor.col-b.actor.col)[0]||null;
}
function firingPosition(s,visible,type,q){
 if(!rangedTypes.has(type))return 0;
 const p={...q,type},air=type==='cactus'&&visible.teams.some(t=>sameLane(q,t)&&t.col>=q.col&&t.members.some(m=>m.airborne)),target=publicFireTarget(s,p,air,visible);
 return !target?-1.5:fireBlocker(s,p,target.actor.col)?-4:2;
}
// Remember only public fire targets and damage to our own plants. An idle
// player is no reason to keep every gun shooting the same distraction.
function updateTactics(s,visible){
 for(const p of s.plants.filter(p=>p.hp>0&&rangedTypes.has(p.type))){
  const target=publicFireTarget(s,p,false,visible),key=target?target.kind+':'+(target.actor.id??target.actor.row):'none',t=p.tactic||(p.tactic={key,since:s.time,responseAt:s.time,hp:p.hp});
  if(t.hp>p.hp||visible.teams.some(a=>distance(a,p)<2&&sameLane(a,p)))t.responseAt=s.time;
  t.hp=p.hp;if(t.key!==key||t.row!==Math.round(p.row)){t.key=key;t.row=Math.round(p.row);t.since=s.time;t.responseAt=s.time;t.redirect=false;}
  const blocked=target&&fireBlocker(s,p,target.actor.col),staticTarget=target&&['cache','fence'].includes(target.kind),age=s.time-t.since;
  const exposed=target?.kind==='exit'&&age>=18,stalled=(!target||blocked)&&age>=7,ignored=staticTarget&&age>=10.5&&s.time-t.responseAt>=10.5;
  t.redirect=!p.moving&&!p.sleeping&&(exposed||stalled||ignored);t.reason=blocked?'射线被地形阻挡':exposed?'破口压制后轮换':ignored?'诱饵线路无人回应':'原射位没有有效目标';
 }
}
function redeployAI(s,visible){
 if(!rules||s.status!=='battle'||s.time<10.5||s.time<(s.ai.nextRedeploy||0))return false;
 const level=data.levels[s.levelIndex],standing=s.plants.filter(p=>p.hp>0),long=p=>rangedTypes.has(p.type)&&(data.plantCombat[p.type].range??12)>=12;
 const exposed=visible.fences.filter(f=>!standing.some(p=>long(p)&&!p.sleeping&&sameLane(p,f)&&!fireBlocker(s,p,f.col))).sort((a,b)=>(a.hp>0?0:1)-(b.hp>0?0:1)||(a.hp>0?a.hp-b.hp:(s.ai.redeployRows?.[a.row]||0)-(s.ai.redeployRows?.[b.row]||0))||a.row-b.row);
 for(const f of exposed)for(const old of standing){
  if(old.moving||old.path.length||old.sleeping||!rangedTypes.has(old.type)&&old.type!=='sunshroom'||s.economy.clock-old.createdAt<10.5||visible.teams.some(t=>distance(old,t)<2))continue;
  const current=publicFireTarget(s,old),completed=s.fences[Math.round(old.row)].hp<=0&&s.time-(s.fences[Math.round(old.row)].breachedAt??s.time)>=18;
  if(long(old)&&current&&!fireBlocker(s,old,current.actor.col)&&!completed&&!old.tactic?.redirect)continue;
  const without={...s,plants:s.plants.filter(p=>p!==old)};
  const types=(s.terrain.theme==='roof'?['cabbagepult','cactus','pea']:['pea','cactus','snow']).filter(type=>level.plantDeck.includes(type));
  for(const type of types)for(const col of [6,4,3,2,1]){const q={row:f.row,col},card=data.plantCards[type],need=rules.supportType(s,q),missing=need&&!rules.supportAt(s,q),total=card.cost+(missing?data.plantCards[need].cost:0);
   if(!plantCell(without,q)||fireBlocker(s,{...q,type},f.col)||s.economy.sun<total||s.economy.cooldowns[type]>1e-6||(missing&&s.economy.cooldowns[need]>1e-6))continue;
   if(missing&&!placeSupport(s,need,q))continue;const hp=old.hp;old.hp=0;old.withdrawn=true;old.path=[];const fresh=placePlant(s,type,q);if(!fresh){old.hp=hp;old.withdrawn=false;continue;}
   s.ai.nextRedeploy=s.time+15;s.ai.redeployRows=s.ai.redeployRows||{};s.ai.redeployRows[q.row]=s.time;s.ai.redeployments=s.ai.redeployments||[];s.ai.redeployments.push({time:s.time,from:old.id,to:fresh.id,row:q.row,col:q.col,cost:total});if(s.ai.redeployments.length>30)s.ai.redeployments.shift();event(s,'看守撤下旧射位，按卡片费用在第'+(q.row+1)+'行重新布防。');return true;
  }
 }return false;
}
function deployAI(s){
 const visible=observeAI(s),pressure=rowPressure(visible),candidates=[],level=data.levels[s.levelIndex];
 if(rules){const sleepy=s.plants.find(p=>p.hp>0&&p.sleeping&&s.economy.clock-p.createdAt>3);if(sleepy&&level.plantDeck.includes('coffee')&&useCoffee(s,sleepy.id))return;}
 if(s.plants.filter(p=>p.hp>0).length>=(level.budget?.maxPlants??Infinity)){redeployAI(s,visible);return;}
 const longTypes=rules?(s.terrain.theme==='roof'?['cabbagepult']:['pea','snow','cactus']):[],longQuota=rules&&s.terrain.time==='night'?Math.max(1,Math.floor((level.budget?.maxPlants??3)/3)):0;
 const longDeficit=s.plants.filter(p=>p.hp>0&&!p.sleeping&&longTypes.includes(p.type)).length<longQuota;
 for(let row=0;row<5;row++){
  const guns=visible.plants.filter(p=>p.hp>0&&['pea','snow','cactus','puff','fumeshroom','cabbagepult'].includes(p.type)&&Math.round(p.row)===row).length;
  const threat=pressure[row]+(guns?0:2.5);
  const air=visible.teams.some(t=>Math.round(t.row)===row&&t.members.some(m=>m.airborne));
  let types=air&&level.plantDeck.includes('cactus')?['cactus','pea','snow','wallnut']:guns?['wallnut','snow','chomper','pea','cactus']:['pea','cactus','snow','chomper','wallnut'];
  if(rules){types=[...new Set([...(air?['cactus']:[]),...(longDeficit?longTypes:[]),...(s.terrain.time==='night'?['puff','fumeshroom','sunshroom']:s.terrain.theme==='roof'?['cabbagepult']:[]),...(s.terrain.id==='fog'?['plantern',...(s.time>s.weather.clearUntil?['blover']:[])]:[]),...types,...level.plantDeck.filter(t=>!['coffee','sunflower','squash'].includes(t))])].filter(t=>level.plantDeck.includes(t));}
  for(const [rank,type]of types.entries())for(const col of [4,3,2,6,1]){
   const q={row,col},need=rules?.supportType(s,q),missing=need&&!rules.supportAt(s,q),card=data.plantCards[type],wakeCost=rules&&rules.asleep(s,type)?data.plantCards.coffee.cost:0,totalCost=card.cost+(missing?data.plantCards[need].cost:0)+wakeCost;
   if(s.economy.sun<totalCost||(s.status==='battle'&&s.economy.cooldowns[type]>1e-6))continue;if(missing){if(!plantCell(s,q)||(s.status==='battle'&&s.economy.cooldowns[need]>0))continue;}else if(!canPlant(s,type,q))continue;
   const templated=level.plants.some(([kind,r])=>kind===type&&r===row);
   const count=s.plants.filter(p=>p.hp>0&&p.type===type).length,utility=['sunshroom','plantern','blover'].includes(type);if(utility&&count>=(type==='sunshroom'?2:1))continue;if(rules&&['puff','fumeshroom'].includes(type)&&s.plants.some(p=>p.hp>0&&p.type===type&&Math.round(p.row)===row))continue;if(type==='blover'&&!air&&(s.time<15||s.time<s.weather.clearUntil))continue;
   const line=firingPosition(s,visible,type,q);if(rangedTypes.has(type)&&line===-4)continue;
   candidates.push({type,q,score:threat-rank*.3+(templated?.4:0)-(col===6?.8:0)-(type==='wallnut'&&!guns?3:0)-(s.plants.filter(p=>p.hp>0&&Math.round(p.row)===row).length-1)*1.5+(rules?.supportAt(s,q)?2:0)+(type==='plantern'&&!count?4:0)+(type==='sunshroom'&&!count?2:0)+(longDeficit&&longTypes.includes(type)?2.2:0)+(rules&&air&&type==='cactus'?3:0)+line});
  }
 }
 // A planted ambush is paid for and uses the same seed cooldown as other cards.
 // One prepared Squash leaves room in the 500-sun budget for a ranged defence.
 if(level.plantDeck.includes('squash')&&!s.plants.some(p=>p.hp>0&&p.type==='squash'))for(const [type,row,col]of level.plants.filter(([type])=>type==='squash')){
  const q={row,col};if(canPlant(s,type,q))candidates.push({type,q,score:6+pressure[row]});
 }
 candidates.sort((a,b)=>b.score-a.score||a.q.row-b.q.row);if(candidates[0]){const {type,q}=candidates[0],need=rules?.supportType(s,q);if(need&&!rules.supportAt(s,q))placeSupport(s,need,q);else placePlant(s,type,q);}
}
function economyStep(s,dt){
 const e=s.economy;e.clock+=dt;for(const p of s.economySunflowers)p.attack=Math.max(0,p.attack-dt);for(const type of Object.keys(e.cooldowns))e.cooldowns[type]=Math.max(0,e.cooldowns[type]-dt);
 if(s.status==='battle')for(const p of [...s.economySunflowers,...s.plants]){if(p.hp<=0||p.sleeping||!['sunflower','sunshroom'].includes(p.type))continue;p.sunTimer-=dt;if(p.sunTimer<=0){p.sunTimer+=25;const sun=p.type==='sunshroom'&&(p.growth||0)<120?15:25;e.sun+=sun;e.earned+=sun;p.attack=.7;}}
 if(rules&&s.status==='battle'&&s.terrain.time!=='night'&&s.terrain.id!=='underground'&&s.time>=s.weather.skyAt){s.weather.skyAt=s.time+25;e.sun+=25;e.earned+=25;}
 if(e.clock>=e.nextDeploy){deployAI(s);e.nextDeploy=e.clock+.8;}
}

// Finish the current cell edge on reordering; rounding a moving actor would cut corners.
function planPath(s,actor,target,traveler=actor){
 const next=actor.path[0],atNode=distance(actor,cell(actor))<1e-7;let anchors;
 if(!atNode&&next){const from=actor.edgeStart||{row:next.row+(Math.abs(actor.row-next.row)>1e-7?Math.sign(actor.row-next.row):0),col:next.col+(Math.abs(actor.col-next.col)>1e-7?Math.sign(actor.col-next.col):0)};anchors=[{point:next,from},{point:from,from:next}];}
 else anchors=[{point:cell(actor),from:cell(actor)}];
 let best=null;for(const a of anchors){if(!valid(a.point)||!walkable(a.point,s.levelIndex,s,traveler))continue;const points=route(a.point,target,s.levelIndex,s,traveler);if(!points.length)continue;const cost=distance(actor,a.point)+points.length-1;if(!best||cost<best.cost-1e-7)best={cost,path:[...(distance(actor,a.point)>1e-7?[{...a.point}]:[]),...points.slice(1)],edgeStart:{...a.from}};}return best;
}
function assignPath(s,actor,target,traveler=actor){const plan=planPath(s,actor,target,traveler);if(!plan)return false;actor.path=plan.path;actor.edgeStart=plan.edgeStart;actor.moving=actor.path.length>0;return true;}
function party(s,t){return t.group==null?[t]:s.teams.filter(a=>alive(a)&&a.group===t.group);}
function partyTraveler(s,teams){return{id:teams.some(t=>t.id===s.follower?.escort)?s.follower.escort:teams[0].id,members:teams.flatMap(t=>t.members.filter(m=>m.hp>0))};}
function stopActor(a,clearInteraction=false){a.path=a.path.length&&distance(a,cell(a))>1e-7?[a.path[0]]:[];a.moving=!!a.path.length;a.order='驻守';if(clearInteraction)a.interaction=null;}
function mergeTeams(s,first,second){
 if(!['planning','battle'].includes(s.status)||first===second)return false;const a=s.teams.find(t=>t.id===first),b=s.teams.find(t=>t.id===second);if(!a||!b||!alive(a)||!alive(b))return false;
 const members=[...new Set([...party(s,a),...party(s,b)])];if(members.length<2||members.every(t=>t.group!=null&&t.group===a.group)||members.some(t=>t.moving||t.path.length||distance(t,a)>.5||cell(t).row!==cell(a).row||cell(t).col!==cell(a).col))return false;
 const group='linked-'+Math.min(...members.map(t=>t.id));for(const t of members){t.group=group;t.order='驻守';}event(s,'队伍'+members.map(t=>t.id+1).join('、')+'组成联队，共同接战与调遣，各队成员和伤势保留。');return true;
}
function splitTeams(s,id){const t=s.teams.find(t=>t.id===id);if(!['planning','battle'].includes(s.status)||!t||t.group==null)return false;const members=s.teams.filter(a=>a.group===t.group);for(const a of members){a.group=null;stopActor(a,true);}event(s,'联队已分开，各队原地待命。');return true;}
function command(s,id,target,order='推进'){
 if(!['planning','battle'].includes(s.status)||!['推进','转线','驻守','撤回'].includes(order))return false;
 if(id==='doctor')return false;const t=s.teams.find(x=>x.id===id);if(!t||!alive(t))return false;
 const members=party(s,t);if(order==='驻守'){for(const a of members)stopActor(a);return true;}
 const traveler=partyTraveler(s,members),plans=members.map(a=>planPath(s,a,order==='撤回'?data.camp:target,traveler));if(plans.some(p=>!p))return false;
 members.forEach((a,i)=>{a.path=plans[i].path;a.edgeStart=plans[i].edgeStart;a.moving=!!a.path.length;a.interaction=order==='撤回'?null:s.caches.find(c=>c.row===target.row&&c.col===target.col)?.id||null;a.order=order;});return true;
}
function supplyStatus(s,id){
 const t=s.teams.find(t=>t.id===id),available=!!t&&['planning','battle'].includes(s.status),nodes=s.caches.filter(c=>c.claimed&&!c.broken&&c.hp>0).sort((a,b)=>t?distance(a,t)-distance(b,t):0),nearestNode=nodes[0]||null,node=t&&nearestNode&&distance(t,nearestNode)<1.15?nearestNode:null,living=t?t.members.filter(m=>m.hp>0):[],missingHealth=living.reduce((n,m)=>n+Math.max(0,m.maxHp-m.hp),0),atCamp=!!t&&(!alive(t)||t.col>=data.camp.col-.4);
 const allowedRecruitTypes=t?data.levels[s.levelIndex].units.filter(type=>!alive(t)||canJoin(s,t,{type,hp:1,airborne:type==='balloon'})):[];
 return{available,nearby:!!node,node,nearestNode,atCamp,allowedRecruitTypes,distance:t&&nearestNode?distance(t,nearestNode):null,living:living.length,slotsFree:3-living.length,injured:living.some(m=>m.hp<m.maxHp),missingHealth,healCost:30,healAmount:90,radius:1.15,canHeal:available&&!!node&&missingHealth>0&&s.energy>=30,canRecruit:available&&(atCamp||!!node)&&living.length<3};
}
function reinforce(s,id,type='normal'){
 const cost=stats.UNITS[type]?.cost;if(!data.levels[s.levelIndex].units.includes(type)||!Number.isFinite(cost)||!['planning','battle'].includes(s.status)||s.energy<cost)return false;const t=s.teams.find(t=>t.id===id);if(!t||t.members.filter(m=>m.hp>0).length>=3)return false;
 if(!alive(t)){t.group=null;if(s.follower?.escort===t.id){s.follower.escort=null;s.follower.path=[];s.follower.moving=false;}t.row=data.camp.row;t.col=data.camp.col;t.path=[];t.moving=false;}
 const supply=supplyStatus(s,id);if(!supply.canRecruit||!supply.allowedRecruitTypes.includes(type))return false;
 t.members=t.members.filter(m=>m.hp>0);t.members.push({...member(type,s.nextMember++),slot:[0,1,2].find(slot=>!t.members.some(m=>m.slot===slot))});s.energy-=cost;s.record.reinforcements++;event(s,t.name+'接到一名'+stats.UNITS[type].name+'，消耗'+cost+'物资。');return true;
}
function repair(s,id){
 if(!supplyStatus(s,id).canHeal)return false;const t=s.teams.find(t=>t.id===id);
 t.members.forEach(m=>{if(m.hp>0)m.hp=Math.min(m.maxHp,m.hp+90);});s.energy-=30;event(s,t.name+'在补给碑治疗，每名存活队员恢复至多90生命，消耗30物资。');return true;
}
function finish(s,status,message){if(s.status!=='battle')return;s.status=status;s.result=message;event(s,message);s.projectiles=[];}
function hitDoctor(s,hitId){
 if(s.status!=='battle'||!Number.isInteger(s.doctor.row)||!hitId||s.doctor.seenHits.has(hitId)||s.doctor.hits<=0)return false;
 s.doctor.seenHits.add(hitId);s.doctor.hits--;s.doctor.hit=.3;if(s.doctor.hits===0)finish(s,'lost','博士承受了10次命中。撤回灯房，再想一条路。');return true;
}
function move(s,a,dt,speed){let travel=dt*speed;while(a.path.length&&travel>1e-9){const p=a.path[0],d=distance(a,p);if(!a.edgeStart)a.edgeStart=cell(a);a.facing=p.col<a.col?-1:p.col>a.col?1:a.facing;
  if(d<=travel+1e-9){a.row=p.row;a.col=p.col;a.path.shift();travel=Math.max(0,travel-d);a.edgeStart={row:a.row,col:a.col};}else{a.row+=(p.row-a.row)/d*travel;a.col+=(p.col-a.col)/d*travel;travel=0;}}a.moving=!!a.path.length;
}
function damageTeam(s,t,damage,member=groundMembers(t)[0],swallowed=false,crushed=false){const m=member;if(!m||m.hp<=0)return;m.hp=Math.max(0,m.hp-damage);m.hit=.28;
 if(m.hp===0){s.record.casualties++;if(swallowed)s.record.swallowed++;if(crushed)s.record.crushed++;m.swallowed=swallowed;if(!swallowed)s.dead.push({actor:m,kind:'zombie',type:m.type,row:t.row,col:t.col,age:0,id:m.id,crushed});if(!alive(t)){t.path=[];t.moving=false;if(s.follower?.escort===t.id){s.follower.escort=null;s.follower.path=[];s.follower.moving=false;event(s,'护送小队倒下，同胞留在原地等待接应；派存活小队靠近，或补员后返回接人。');}event(s,t.name+'已倒下，仍可在补给位置补充队员。');}}
}
// Public targets drive attack decisions. A broken lane remains an ordinary
// firing lane even when nobody is hidden behind it; it is not a secret sensor.
const targetList=s=>[...s.caches.filter(c=>c.claimed&&!c.broken).map(c=>({kind:'cache',actor:c})),...s.teams.filter(alive).map(t=>({kind:'team',actor:t})),...s.fences.filter(f=>f.hp>0).map(f=>({kind:'fence',actor:f}))];
function observeAI(s){return{teams:s.teams.filter(t=>alive(t)&&(!rules||rules.visible(s,t,'ai'))).map(t=>({id:t.id,row:t.row,col:t.col,members:t.members.filter(m=>m.hp>0).map(m=>({type:m.type,hp:m.hp,airborne:airborne(m)}))})),plants:s.plants.filter(p=>p.hp>0).map(p=>({id:p.id,type:p.type,row:p.row,col:p.col,hp:p.hp})),caches:s.caches.map(c=>({id:c.id,row:c.row,col:c.col,hp:c.hp,claimed:c.claimed,broken:c.broken})),fences:s.fences.map(f=>({id:f.id,row:f.row,col:f.col,hp:f.hp})),goal:{row:s.goal.row,col:s.goal.col,open:s.goal.open},follower:s.follower&&(!rules||rules.visible(s,s.follower,'ai'))?{row:s.follower.row,col:s.follower.col}:null};}
// Only collision resolution may inspect the private hideout, after the fence
// on that lane is broken. No AI scoring, deployment or aiming reads it.
function collisionTargets(s){const targets=targetList(s);if(Number.isInteger(s.doctor.row)&&s.fences[s.doctor.row].hp<=0)targets.push({kind:'doctor',actor:s.doctor});return targets;}
function fireRecord(s,kind,shot,amount=0){const log=s.ai.fire||(s.ai.fire={launched:0,prevented:0,barrierImpacts:0,ridgeImpacts:0,fenceHits:0,fenceDamage:0,doctorHits:0,events:[]});if(kind==='fence'){log.fenceHits++;log.fenceDamage+=amount;}else if(kind==='doctor')log.doctorHits++;else log[kind]++;log.events.push({time:s.time,kind,id:shot.id??shot.sourceId,row:Math.round(shot.row),type:shot.type,col:shot.col,amount});if(log.events.length>80)log.events.shift();}
function projectile(s,p,high=false){const shot={id:'shot-'+s.nextShot++,sourceId:p.id,row:p.row,lane:Math.round(p.row),col:p.col,originCol:p.col,dr:0,dc:1,damage:data.plantCombat[p.type].damage,type:p.type,airborne:high,lobbed:p.type==='cabbagepult',range:data.plantCombat[p.type].range??12,life:4.5};s.projectiles.push(shot);fireRecord(s,'launched',shot);p.attack=.45;}
const sameLane=(a,b)=>Math.round(a.row)===Math.round(b.row);
const guards=(s,objective,team,radius)=>s.plants.some(p=>p.hp>0&&distance(p,objective)<radius&&(!rules||(!p.sleeping&&sameLane(p,team)&&!['sunflower','sunshroom','plantern','blover'].includes(p.type))));
const elapsed=(a,seconds)=>a.elapsed+1e-8>=seconds;
const groundTargets=(s,p,range,behind=0)=>s.teams.filter(t=>alive(t)&&groundMembers(t).length&&sameLane(p,t)&&t.col-p.col>=-behind-1e-8&&t.col-p.col<=range+1e-8).sort((a,b)=>distance(p,a)-distance(p,b));
function abilityState(p,state,clip){p.ability.state=state;p.ability.elapsed=0;p.animation=clip?{clip,time:0,once:true}:null;}
function squashStep(s,p,dt){
 const a=p.ability||(p.ability={state:'idle',elapsed:0});a.elapsed+=dt;
 const target=()=>groundTargets(s,p,1.45,.75)[0];
 if(a.state==='idle'){
  const t=target();if(!t)return;a.origin={row:p.row,col:p.col};a.target={row:Math.round(p.row),col:t.col};a.targetId=t.id;p.facing=t.col<p.col?-1:1;p.path=[];p.moving=false;abilityState(p,'look',p.facing<0?'lookleft':'lookright');event(s,'倭瓜正在察看'+t.name+'，散开队伍，留意落点。');
 }else if(a.state==='look'&&elapsed(a,.8)){abilityState(p,'crouch','jumpup');}
 else if(a.state==='crouch'&&elapsed(a,.45)){
  const t=target();if(t){const next=t.path[0],d=next?distance(t,next):0,speed=.64*Math.min(...t.members.filter(m=>m.hp>0).map(m=>stats.UNITS[m.type].speed))/21*(t.slow>0?.65:1);a.target={row:Math.round(p.row),col:Math.max(0,Math.min(9,t.col+(d?(next.col-t.col)/d*Math.min(d,speed*.3):0)))};}
  abilityState(p,'rising','jumpup');
 }else if(a.state==='rising'&&elapsed(a,.5)){abilityState(p,'falling','jumpdown');}
 else if(a.state==='falling'){
  if(elapsed(a,.05)&&!a.struck){a.struck=true;for(const t of s.teams.filter(t=>alive(t)&&sameLane(a.target,t)&&Math.abs(t.col-a.target.col)<.42))for(const m of [...groundMembers(t)])damageTeam(s,t,1800,m,false,true);event(s,'倭瓜砸向了确定的落点，只结算这一次砸击。');}
  if(elapsed(a,.1))abilityState(p,'spent','jumpdown');
 }else if(a.state==='spent'&&elapsed(a,1)){p.hp=0;p.consumed=true;}
 if(p.animation){p.animation.time=a.state==='spent'?10:a.state==='rising'?(.45+a.elapsed)*2:a.state==='falling'?a.elapsed*5:a.elapsed*2;}
}
function chomperStep(s,p,dt){
 const a=p.ability||(p.ability={state:'idle',elapsed:0});a.elapsed+=dt;
 if(a.state==='idle'){
  if(!groundTargets(s,p,1.2)[0])return;p.path=[];p.moving=false;p.facing=1;abilityState(p,'bite','bite');p.windup=.7;
 }else if(a.state==='bite'){
  p.windup=Math.max(0,.7-a.elapsed);p.attack=.3;
  if(elapsed(a,.7)){const t=groundTargets(s,p,1.2)[0];if(t){const m=groundMembers(t)[0];damageTeam(s,t,m.hp,m,true);abilityState(p,'got-one','bite');event(s,'大嘴花吞下一名同胞，随后进入40秒的咀嚼期。');}else abilityState(p,'miss','bite');p.windup=0;}
 }else if(a.state==='got-one'&&elapsed(a,.35)){abilityState(p,'digest','chew');
 }else if(a.state==='digest'&&elapsed(a,40))abilityState(p,'swallow','swallow');
 else if((a.state==='swallow'&&elapsed(a,7/3))||(a.state==='miss'&&elapsed(a,.35)))abilityState(p,'idle');
 if(p.animation){p.animation.once=a.state!=='digest';p.animation.time=a.state==='digest'?a.elapsed*1.25:['miss','got-one'].includes(a.state)?(.7+a.elapsed)*2:a.state==='bite'?a.elapsed*2:a.elapsed;}
}
function segmentDistance(a,b,p){const dx=b.col-a.col,dy=b.row-a.row,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.col-a.col)*dx+(p.row-a.row)*dy)/l)):0;return Math.hypot(p.col-a.col-dx*t,p.row-a.row-dy*t);}
// Plant transfers stay in their own column. New columns require a paid card.
function firingRoute(s,p,end){
 const start=cell(p),key=q=>q.row+':'+q.col,queue=[start],seen=new Map([[key(start),null]]);let found=null;
 for(let i=0;i<queue.length;i++){const q=queue[i];if(q.row===end.row&&q.col===end.col){found=q;break;}for(const next of [{row:q.row-1,col:q.col},{row:q.row+1,col:q.col}]){if(seen.has(key(next))||!plantCell(s,next))continue;seen.set(key(next),q);queue.push(next);}}
 if(!found)return[];const result=[];for(let q=found;q;q=seen.get(key(q)))result.unshift(q);return result;
}
// Decisions use observed positions and completed captures, never queued player orders.
function decide(s){
 const visible=observeAI(s),a=s.ai,observed=visible.teams.map(t=>({id:t.id,row:t.row,col:t.col,count:t.members.filter(m=>m.hp>0).length}));a.turns++;a.observations=observed.map(t=>({...t}));
 updateTactics(s,visible);const pressure=rowPressure(visible),focus=pressure.indexOf(Math.max(...pressure));
 if(a.previous!==null&&a.previous!==focus&&a.previousPressure>3){a.feints++;event(s,'看守观察到行间压力转向，调整种植与换行。');}
 a.previous=focus;a.previousPressure=pressure[focus];a.focus='第'+(focus+1)+'行压力较高';a.groups=[];
 const defenders=s.plants.filter(p=>p.hp>0&&!['sunflower','sunshroom','plantern','blover'].includes(p.type));
 defenders.forEach((p,i)=>{
  if(rangedTypes.has(p.type)){
   p.squad=i===0?'守门组':i%2?'机动组':'分遣组';
   if(p.sleeping||p.moving||s.time-p.lastMove<3.5)return;
   const current=cell(p),long=(data.plantCombat[p.type].range??12)>=12;
   const tactic=p.tactic;if(tactic?.destinationRow===current.row){if(tactic.holdUntil==null)tactic.holdUntil=s.time+7;if(s.time<tactic.holdUntil&&firingPosition(s,visible,p.type,current)>=0){a.groups.push({id:p.id,squad:p.squad,target:'第'+(current.row+1)+'行换线后持续压制'});return;}delete tactic.destinationRow;delete tactic.holdUntil;}
   const value=q=>{const line=firingPosition(s,visible,p.type,q);if(line<0)return line*3;const row=Math.round(q.row),f=visible.fences[row],working=f?.hp>0?1.3:s.time-(s.fences[row].breachedAt??-Infinity)<18?1.5:-.8,overlap=defenders.filter(o=>o!==p&&!o.sleeping&&Math.round(o.path.at(-1)?.row??o.row)===row&&rangedTypes.has(o.type)&&(data.plantCombat[o.type].range??12)>=12).length;return line+pressure[row]*.6+(visible.goal.row===row?.6:0)+(visible.follower&&Math.round(visible.follower.row)===row?1:0)+(long?working-overlap*2.7:0)-(p.tactic?.redirect&&row===current.row?5:0);};
   let best={q:current,score:value(current),path:[]};
   for(let row=0;row<5;row++){const q={row,col:current.col};if(!plantCell(s,q))continue;const path=firingRoute(s,p,q);if(path.length<2)continue;const score=value(q)-(path.length-1)*.17;if(score>best.score+1.1)best={q,score,path};}
   if(tactic?.destinationRow!=null){const q={row:tactic.destinationRow,col:current.col},path=firingRoute(s,p,q);if(path.length>1&&firingPosition(s,visible,p.type,q)>=0)best={q,path,score:value(q)};else{delete tactic.destinationRow;delete tactic.holdUntil;}}
   a.groups.push({id:p.id,squad:p.squad,target:'第'+(best.q.row+1)+'行有效火线'});
   if(!best.path.length)return;const next=best.path[1];
   if(!plantCell(s,next))return;if(rules&&!rules.hasSurface(s,next)){placeSupport(s,rules.supportType(s,next),next);return;}
   if(p.tactic?.redirect){p.tactic.destinationRow=best.q.row;delete p.tactic.holdUntil;a.redirects=a.redirects||[];a.redirects.push({time:s.time,id:p.id,from:current.row,to:best.q.row,reason:p.tactic.reason});if(a.redirects.length>40)a.redirects.shift();a.focus=p.tactic.reason+'，转向第'+(best.q.row+1)+'行';}
   p.path=[next];p.lastMove=s.time;p.moving=true;return;
  }
  const current=Math.round(p.row),row=i===0?s.goal.row:focus;p.squad=i===0?'守门组':i%2?'机动组':'分遣组';a.groups.push({id:p.id,squad:p.squad,target:'第'+(row+1)+'行'});
  if(p.sleeping||['sunshroom','plantern','blover'].includes(p.type)||p.type==='squash'||['bite','got-one','swallow'].includes(p.ability?.state)||p.moving||s.time-p.lastMove<3.5||current===row||(i!==0&&pressure[row]-pressure[current]<1.25))return;
  const next={row:current+Math.sign(row-current),col:Math.round(p.col)};
  if(!valid(next)||solid(next,s.levelIndex)||!connectedCell(s,next)||data.levels[s.levelIndex].blocked.some(b=>distance(b,next)<.01)||s.plants.some(o=>o!==p&&o.hp>0&&(distance(o,next)<.85||o.path.some(w=>distance(w,next)<.2)))||s.teams.some(t=>alive(t)&&distance(t,next)<.75))return;
  if(rules&&!rules.hasSurface(s,next)){placeSupport(s,rules.supportType(s,next),next);return;}
  p.path=[next];p.lastMove=s.time;p.moving=true;
 });
 a.history.push({time:s.time,focus,observations:observed});if(a.history.length>20)a.history.shift();
}

function tick(s,dt){
 if(s.paused||!['planning','battle'].includes(s.status))return;
 if(s.status==='planning'){const remaining=Math.min(dt,s.planning);if(remaining>0){economyStep(s,remaining);s.prepTime+=remaining;s.planning=Math.max(0,s.planning-remaining);}if(s.planning<=.00001){s.planning=0;start(s,true);}return;}
 economyStep(s,dt);
 s.time+=dt;s.doctor.hit=Math.max(0,s.doctor.hit-dt);for(const d of s.dead)d.age+=dt;s.dead=s.dead.filter(d=>d.age<.9);
 for(const t of s.teams)if(t.group!=null){const linked=party(s,t);if(!alive(t))t.group=null;else if(linked.length<2)linked.forEach(a=>a.group=null);}
 const movement=new Map(s.teams.filter(alive).map(t=>{const members=party(s,t),traveler=partyTraveler(s,members),engaged=members.some(a=>groundMembers(a).length&&s.plants.some(p=>plantBlocking(p)&&distance(a,p)<.72)),waiting=members.some(a=>s.follower?.escort===a.id&&distance(a,s.follower)>1.5),speed=.64*Math.min(...traveler.members.map(m=>stats.UNITS[m.type].speed))/21*(members.some(a=>a.slow>0)?.65:1)*(rules?rules.speed(s,{...traveler,row:t.row,col:t.col},stats.UNITS):1);return[t.id,{engaged,waiting,speed}];}));
 for(const t of s.teams){t.attack=Math.max(0,t.attack-dt);t.attackTimer=Math.max(0,t.attackTimer-dt);t.members.forEach(m=>{m.hit=Math.max(0,m.hit-dt);m.pop=Math.max(0,(m.pop||0)-dt);});t.slow=Math.max(0,(t.slow||0)-dt);const motion=movement.get(t.id);if(motion&&!motion.waiting){if(!motion.engaged||t.order==='撤回')move(s,t,dt,motion.speed);else t.moving=false;}}
 for(const f of s.fences)f.hit=Math.max(0,f.hit-dt);
 for(const p of s.plants){if(p.hp<=0)continue;if(rules&&!rules.hasSurface(s,p)){p.hp=0;s.dead.push({actor:p,kind:'plant',type:p.type,row:p.row,col:p.col,id:p.id,age:0});continue;}p.hit=Math.max(0,p.hit-dt);p.attack=Math.max(0,p.attack-dt);p.coffee=Math.max(0,(p.coffee||0)-dt);if(!p.sleeping)p.growth=(p.growth||0)+dt;if(!p.sleeping){const wasMoving=p.moving;move(s,p,dt,1/3);if(wasMoving&&!p.moving&&p.tactic?.destinationRow===Math.round(p.row))p.tactic.holdUntil=s.time+7;}p.cooldown-=dt;}
 if(s.time>=s.ai.next){decide(s);s.ai.next=s.time+3.5;}
 for(const t of s.teams.filter(alive)){
  const enemy=s.plants.filter(p=>plantBlocking(p)&&distance(t,p)<.86).sort((p,q)=>distance(t,p)-distance(t,q))[0]||(rules?s.supports.filter(b=>b.hp>0&&distance(t,b)<.86&&!s.plants.some(p=>p.hp>0&&distance(p,b)<.2)).sort((a,b)=>distance(t,a)-distance(t,b))[0]:null);
  if(enemy&&groundMembers(t).length&&t.attackTimer<=0){const strength=rules?groundMembers(t).reduce((v,m)=>v+stats.UNITS[m.type].damage/46,0):groundMembers(t).length;enemy.hp=Math.max(0,enemy.hp-24*strength);enemy.hit=.25;t.attack=.5;t.attackTimer=1.15;if(enemy.hp===0&&data.plantCombat[enemy.type])s.dead.push({actor:enemy,kind:'plant',type:enemy.type,row:enemy.row,col:enemy.col,id:enemy.id,age:0});}
 }
 for(const p of s.plants){
  if(s.status!=='battle')break;if(p.hp<=0||p.sleeping||['sunflower','wallnut','sunshroom','plantern'].includes(p.type))continue;
  if(p.type==='blover'){if(p.windStarted==null){p.windStarted=s.time;event(s,'三叶草将在2.5秒后吹散雾气和空中气球，可在岸上指令气球落地。');}if(s.time-p.windStarted>=2.5){s.weather.clearUntil=s.time+30;s.weather.windUntil=s.time+1.5;for(const t of s.teams)for(const m of t.members.filter(m=>m.hp>0&&airborne(m)))damageTeam(s,t,m.hp,m);p.hp=0;p.consumed=true;}continue;}
  if(p.type==='squash'){squashStep(s,p,dt);continue;}
  if(p.type==='chomper'){chomperStep(s,p,dt);continue;}
  const air=s.teams.some(t=>alive(t)&&(!rules||rules.visible(s,t,'ai'))&&sameLane(p,t)&&t.col>=p.col&&t.col-p.col<12&&t.members.some(m=>m.hp>0&&airborne(m)));
  if(p.type==='cactus'){const height=p.cactusHeight||0;p.cactusHigh=air;p.cactusHeight=air?Math.min(1,height+dt/1.25):Math.max(0,height-dt/(13/12));if((air&&p.cactusHeight<1-1e-8)||(!air&&p.cactusHeight>1e-8))continue;}
  if(p.cooldown>0)continue;const high=p.type==='cactus'&&air;
  const target=publicFireTarget(s,p,high);if(!target)continue;const block=fireBlocker(s,p,target.actor.col);
  if(block){p.blockedBy=block.kind;fireRecord(s,'prevented',p);p.cooldown=.3;continue;}p.blockedBy=null;p.facing=1;
  projectile(s,p,high);p.cooldown=data.plantCombat[p.type].interval;
 }
 for(const shot of s.projectiles){
  if(s.status!=='battle')break;const old={row:shot.row,col:shot.col};shot.col+=shot.dc*3.2*dt;shot.life-=dt;
  if(shot.col-shot.originCol>(shot.range??12)){shot.life=0;continue;}if(rules&&s.terrain.theme==='roof'&&!shot.lobbed&&shot.originCol<3.5&&shot.col>=3.5){shot.life=0;fireRecord(s,'ridgeImpacts',shot);continue;}
  const high=!!shot.airborne,contacts=collisionTargets(s).filter(t=>!shot.hitIds?.includes(t.kind+':'+(t.actor.id??t.actor.row))&&Math.round(t.actor.row)===shot.lane&&(t.kind==='team'?t.actor.members.some(m=>m.hp>0&&airborne(m)===high):!high)&&segmentDistance(old,shot,t.actor)<(t.kind==='doctor'?.24:.33));
  if(!high){const f=s.fences[shot.lane];if(f&&f.hp>0&&old.col<=f.col&&shot.col>=f.col)contacts.push({kind:'fence',actor:f});}
  const barrier=!shot.lobbed&&data.levels[s.levelIndex].blocked.find(b=>Math.abs(b.row-shot.row)<.48&&old.col<b.col+.45&&shot.col>=b.col-.45);
  if(barrier)contacts.push({kind:'barrier',actor:{row:shot.row,col:barrier.col-.45}});
  contacts.sort((a,b)=>a.actor.col-b.actor.col);const target=contacts[0];
  if(target){
   if(target.kind==='doctor'){if(hitDoctor(s,shot.id))fireRecord(s,'doctor',shot,1);}
   else if(target.kind==='fence'){const f=target.actor,before=f.hp;f.hp=Math.max(0,f.hp-shot.damage);f.hit=.25;fireRecord(s,'fence',shot,before-f.hp);if(f.hp===0){f.breachedAt=s.time;event(s,'第'+(f.row+1)+'行栅栏被击穿，后方失去这一段掩护。');}}
   else if(target.kind==='barrier')fireRecord(s,'barrierImpacts',shot);
   else if(target.kind==='cache')target.actor.hp=Math.max(0,target.actor.hp-shot.damage);
   else if(target.kind==='team'){const m=target.actor.members.find(m=>m.hp>0&&airborne(m)===high);if(shot.type==='fumeshroom'){for(const member of [...groundMembers(target.actor)])damageTeam(s,target.actor,shot.damage,member);}else damageTeam(s,target.actor,shot.damage*(rules?rules.reduction(s,target.actor,m,shot,stats.UNITS):1),m);if(high&&m&&m.hp>0){m.airborne=false;m.pop=.72;if(rules&&rules.water(s,target.actor)&&!rules.bridge(s,target.actor)){damageTeam(s,target.actor,m.hp,m);event(s,'气球在无桥水域破裂，落水的同胞未能回来。');}event(s,'仙人掌刺破了气球，同胞落地后会受到地面火力。');}if(shot.type==='snow')target.actor.slow=2.5;}
   if(shot.type==='fumeshroom'&&target.kind==='team'){shot.hitIds=shot.hitIds||[];shot.hitIds.push(target.kind+':'+(target.actor.id??target.actor.row));}else shot.life=0;
  }
 }
 s.projectiles=s.projectiles.filter(p=>p.life>0&&p.row>-.5&&p.row<4.5&&p.col>-.5&&p.col<11.2);if(s.status!=='battle')return;
 for(const c of s.caches){if(c.broken)continue;
  if(!c.claimed){const capturing=s.teams.some(t=>alive(t)&&t.interaction===c.id&&distance(t,c)<1.15&&!guards(s,c,t,1.15));c.progress=Math.max(0,Math.min(3,c.progress+(capturing?dt:-dt*.5)));if(c.progress>=3){c.claimed=true;s.claimed.push(c.id);if(!c.paid){s.energy+=c.reward;c.paid=true;}event(s,c.name+'已接通。'+(c.reward?'获得'+c.reward+'物资。':'可以在此整备。'));}}
  else{if(c.hp<=0){c.broken=true;if(!c.breakPaid){s.energy+=500;c.breakPaid=true;}event(s,c.name+'被打碎，封存的500应急物资交给了队伍。');}}}
 if(s.caches.every(c=>c.broken)){finish(s,'lost','所有补给碑都被打碎，接应路线中断。');return;}
 if(!s.goal.open&&s.caches.filter(c=>!c.broken).length<data.levels[s.levelIndex].requiredCaches){finish(s,'lost','完好的补给碑不足'+data.levels[s.levelIndex].requiredCaches+'座，已无法打开囚室。接应失败，请重新部署。');return;}
 const nearby=s.teams.filter(t=>alive(t)&&distance(t,s.goal)<1.15),captiveType=data.levels[s.levelIndex].escort?.type||data.levels[s.levelIndex].unlock||'normal';
 const eligible=nearby.filter(t=>!rules||rules.canWalk(s,cell(t),{type:captiveType,airborne:false},stats.UNITS)).sort((a,b)=>a.id-b.id),escort=eligible.find(t=>!guards(s,s.goal,t,1.25)),contested=!escort;
 if(rules&&!s.goal.open&&nearby.length&&!eligible.length&&!s.goal.shoreWarning){s.goal.shoreWarning=true;event(s,'获救者不能在无桥水面站立。请让开门小队先到岸上或桥面的相邻接应格。');}
 if(!s.goal.open&&s.caches.filter(c=>c.claimed&&!c.broken).length>=data.levels[s.levelIndex].requiredCaches&&escort&&!contested){s.goal.progress+=dt;if(s.goal.progress>=4){s.goal.open=true;s.follower={id:'rescued',row:escort.row+(s.goal.row-escort.row)*.4,col:escort.col+(s.goal.col-escort.col)*.4,kind:data.levels[s.levelIndex].escort?.kind||'zombie',type:captiveType,name:data.levels[s.levelIndex].escort?.name||'获救同胞',hp:data.levels[s.levelIndex].escort?.hp||35,maxHp:data.levels[s.levelIndex].escort?.maxHp||210,path:[],escort:escort.id,moving:false,facing:1,wounded:true};if(rules){escort.path=[];escort.moving=false;escort.order='驻守';}event(s,'房门打开了。获救同胞跟随开门的小队，请将他们护送回营地。');}}
 if(s.follower){const f=s.follower;let lead=s.teams.find(t=>t.id===f.escort&&alive(t));
  if(!lead){f.escort=null;f.path=[];f.moving=false;lead=s.teams.filter(t=>{if(!alive(t)||distance(t,f)>=1.5||(rules&&!rules.canWalk(s,cell(t),f,stats.UNITS)))return false;const approach=route(cell(f),cell(t),s.levelIndex,s,f);return approach.length>0&&approach.length<=3;}).sort((a,b)=>distance(a,f)-distance(b,f))[0];if(lead){f.escort=lead.id;if(rules){lead.path=[];lead.moving=false;lead.order='驻守';}event(s,lead.name+'接过了护送任务。');}else lead=null;}
  // A valid escort may have to walk away briefly to go around a solid tile.
  // Keep following its legal path while the leader waits; distance is no wall.
  if(lead){if(!f.path.length&&distance(lead,f)>.65)assignPath(s,f,cell(lead));move(s,f,dt,.58*(rules?rules.speed(s,f,stats.UNITS):1));}
  if(distance(f,data.camp)<.75&&lead&&distance(lead,data.camp)<1.25)finish(s,'won','大家都回到了灯房。'+data.levels[s.levelIndex].people);}
 s.phase=s.follower?4:s.goal.progress>0?3:s.ai.turns?2:s.claimed.length?1:0;
 if(!s.teams.some(alive)&&s.energy<50)finish(s,'lost','没有可以继续接应的小队，也没有足够物资补充队员。');
}
function step(s,dt){if(!Number.isFinite(dt)||dt<=0||s.paused)return;let remaining=Math.min(dt,5);while(remaining>1e-8){const slice=Math.min(.05,remaining);tick(s,slice);remaining-=slice;}}
const api={valid,walkable,route,createScene,command,step,start,chooseDoctor,observeAI,configure,deployTeam,transfer,mergeTeams,splitTeams,canPlant,placePlant,placeSupport,useCoffee,landTeam,compositionCost,supplyStatus,reinforce,repair,hitDoctor,alive,distance};return api;
}
const api=createModel(defaultData,defaultStats,node?null:root.PVZ_TERRAIN_RULES||null);api.createModel=createModel;if(node)module.exports=api;else root.PVZ_RESCUE_SCENE=api;
})(typeof window!=='undefined'?window:globalThis);
