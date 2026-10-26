const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{JSDOM}=require('jsdom');
const data=require('../game/rescue-design-data.js'),m=require('../game/rescue-design-model.js'),old=require('../game/engine.js');
const advance=(s,seconds)=>{for(let t=0;t<seconds-1e-8;t+=.05)m.step(s,Math.min(.05,seconds-t));};
const preparedScene=(level=0)=>{const s=m.createScene(level);m.chooseDoctor(s,2);return s;};
const isolated=()=>{const s=preparedScene();m.start(s);s.plants=[];s.ai.next=Infinity;s.economy.nextDeploy=Infinity;return s;};
const p=(type,row,col,id=30)=>({id,type,row,col,hp:old.PLANTS[type].hp,maxHp:old.PLANTS[type].hp,path:[],moving:false,attack:0,hit:0,cooldown:0,lastMove:-10,facing:1,sunTimer:1});
(async()=>{let passed=0;const pass=text=>{passed++;console.log('PASS '+text);};
{
 const available=new Set(['normal']);assert.equal(data.levels.length,7);
 for(const [i,l]of data.levels.entries()){
  for(const type of l.units)assert(available.has(type));const occupied=new Set([l.prison,...l.caches].map(q=>q.row+':'+q.col));assert.equal(occupied.size,l.caches.length+1);assert(l.prison.col>0);assert(l.caches.every(c=>c.col>0));
  for(let row=0;row<5;row++)for(let col=0;col<10;col++){
   const q={row,col},route=m.route(data.camp,q,i);if(l.blocked.some(b=>m.distance(b,q)===0)){assert.equal(route.length,0);continue;}assert(route.length,'unreachable '+i+':'+row+':'+col);
   if(!m.walkable(q,i))assert.equal(m.distance(route.at(-1),q),1);
   for(let j=1;j<route.length;j++){const a=route[j-1],b=route[j];assert.equal(Math.abs(a.row-b.row)+Math.abs(a.col-b.col),1);if(a.row!==b.row)assert(l.corridors.includes(a.col));if(b.col===5)assert(l.gates.includes(b.row));}
  }if(old.LEVELS[i].rescue)available.add(old.LEVELS[i].rescue);
 }
 assert.equal(new Set(data.levels.map(l=>l.gates.join(','))).size,7);
}pass('七关缺口和接应路线可达；一列向日葵不与囚室或补给碑占位冲突，兵种遵守解救顺序');
{
 const s=preparedScene(6),fresh=preparedScene(6);assert.equal(s.economy.sun,500);assert.equal(s.plants.length,0);assert.equal(s.economySunflowers.length,5);assert(s.economySunflowers.every((p,row)=>p.type==='sunflower'&&p.col<0&&p.row===row&&p.invulnerable));assert.equal(s.teams.length,3);assert(s.teams.every(t=>t.members.length===3));assert.equal(s.fences[2].hp,600);assert(s.doctor.col>s.fences[2].col);assert(!m.command(s,'doctor',data.camp));s.fences[2].hp=1;s.economy.sun=0;s.economySunflowers[0].sunTimer=1;s.teams[0].members[0].hp=1;assert.equal(fresh.fences[2].hp,600);assert.equal(fresh.economy.sun,500);assert.equal(fresh.economySunflowers[0].sunTimer,12.5);assert.equal(fresh.doctor.hits,10);
}pass('每局独立刷新5株向日葵、500阳光、三队和栅栏，博士固定在掩体后');
{
 const s=preparedScene();m.command(s,0,{row:1,col:4});const before=JSON.stringify(s.teams);advance(s,10);assert.equal(s.status,'planning');assert.equal(JSON.stringify(s.teams),before);assert.equal(s.projectiles.length,0);assert.equal(s.time,0);assert(s.plants.length>0);assert.equal(s.economy.spent+s.economy.sun,500);assert.equal(s.economy.earned,0);s.paused=true;const paused=JSON.stringify(s);advance(s,5);assert.equal(JSON.stringify(s),paused);s.paused=false;advance(s,50.1);assert.equal(s.status,'battle');assert(s.time<.2);
}pass('60秒准备期冻结交战和队伍移动，机器人付费布阵且不产阳光；暂停冻结准备及种植');
{
 const s=preparedScene();s.economy.nextDeploy=Infinity;assert(m.placePlant(s,'pea',{row:0,col:3}));assert(m.placePlant(s,'pea',{row:1,col:3}));assert.equal(s.economy.sun,300);advance(s,2);assert(m.start(s));assert(!m.start(s));assert(Math.abs(s.economy.cooldowns.pea-5.5)<.001);assert(!m.placePlant(s,'pea',{row:3,col:3}));advance(s,5.4);assert(!m.placePlant(s,'pea',{row:3,col:3}));advance(s,.11);assert(m.placePlant(s,'pea',{row:3,col:3}));assert(!m.placePlant(s,'pea',{row:4,col:3}));assert.equal(s.economy.sun,200);
}pass('准备期同卡可连续种植但仍付费；提前开始承接剩余冷却，不能重置后再瞬种一轮');
{
 assert.deepEqual(Object.fromEntries(Object.entries(data.plantCards).map(([k,v])=>[k,[v.cost,v.recharge]])),{pea:[100,7.5],sunflower:[50,7.5],wallnut:[50,30],snow:[175,7.5],chomper:[150,7.5],cactus:[125,7.5],squash:[50,30]});
 const s=preparedScene(1);s.economy.nextDeploy=Infinity;assert(m.placePlant(s,'wallnut',{row:0,col:3}));m.start(s);assert(!m.placePlant(s,'wallnut',{row:4,col:3}));advance(s,29.9);assert(!m.placePlant(s,'wallnut',{row:4,col:3}));advance(s,.11);assert(m.placePlant(s,'wallnut',{row:4,col:3}));assert(!m.placePlant(s,'unknown',{row:4,col:4}));assert(!m.placePlant(s,'pea',{row:2,col:9}));
}pass('普通种植冷却7.5秒、坚果30秒及阳光费用明确；同卡共享冷却，非法部署不扣费');
{
 const s=preparedScene();s.economy.nextDeploy=Infinity;m.start(s);s.ai.next=Infinity;for(const f of s.economySunflowers)f.sunTimer=1;advance(s,1.1);assert.equal(s.economy.sun,625);assert.equal(s.plants.length,0);advance(s,25);assert.equal(s.economy.sun,750);assert.equal(s.economy.earned,250);
}pass('场外五株向日葵持续产阳光，不依赖场内守军，收支可核对');
{
 const s=preparedScene(6);advance(s,7);m.start(s);advance(s,60);const e=s.economy;assert.equal(e.sun,500+e.earned-e.spent);assert(e.sun>=0);assert.equal(e.spent,e.placements.reduce((sum,p)=>sum+p.cost,0));assert(e.placements.some(p=>p.phase==='battle'));
 for(const type of data.levels[6].plantDeck){const records=e.placements.filter(p=>p.type===type);for(let i=1;i<records.length;i++)if(records[i].phase==='battle')assert(records[i].clock-records[i-1].clock>=data.plantCards[type].recharge-1e-6);}
}pass('真实机器人持续部署遵守阳光预算与卡片冷却，战斗期不沿用免冷却布阵');
{
 const s=isolated(),gun=p('pea',1,6);s.plants=[gun];s.fences[2].hp=0;for(const t of s.teams){t.row=3;t.col=8;}const hp=s.teams[0].members[0].hp;advance(s,2);assert(s.projectiles.every(shot=>shot.lane===1));assert(s.fences[1].hp<600);assert.equal(s.teams[0].members[0].hp,hp);s.teams[0].row=1;advance(s,1);assert(s.teams[0].members[0].hp<hp);assert.equal(gun.facing,1);assert(s.projectiles.every(shot=>shot.dr===0&&shot.dc===1));
 const passive=isolated(),cache=passive.caches[0];cache.claimed=true;passive.plants=[p('wallnut',cache.row+1,cache.col)];advance(passive,2);assert.equal(cache.hp,180);passive.plants[0].row=cache.row;advance(passive,2);assert.equal(cache.hp,180,'Wallnuts must not gain passive melee damage');
}pass('植物只向当前行前方射击；相邻行目标不会被全局索敌或斜线攻击');
{
 const s=isolated(),gun=p('pea',1,6);s.fences[2].hp=0;s.plants=[gun];s.teams[0].row=1;s.teams[0].col=8;advance(s,.05);const shot=s.projectiles[0];assert(shot);const originalRow=shot.row;s.teams[0].row=2;const hp=s.teams[0].members[0].hp;advance(s,.8);assert.equal(shot.row,originalRow);assert.equal(shot.dr,0);assert.equal(s.teams[0].members[0].hp,hp);
 const moving=isolated(),plant=p('pea',.8,6);plant.path=[{row:1,col:6}];moving.plants=[plant];moving.fences[2].hp=0;moving.teams[0].row=1;moving.teams[0].col=7.5;advance(moving,.7);assert(plant.row>.8);assert(moving.teams[0].members[0].hp<old.UNITS.normal.hp);assert(moving.projectiles.every(shot=>shot.dr===0));
}pass('弹丸发射后保持水平轨迹，不跟随换行目标；植物换行中仍可向所在行正常发射');
{
 const s=isolated();s.plants=[p('pea',2,6)];const hp=s.fences[2].hp;advance(s,2);assert(s.fences[2].hp<hp);assert.equal(s.doctor.hits,10);s.fences[2].hp=1;advance(s,3);assert.equal(s.fences[2].hp,0);advance(s,4);assert(s.doctor.hits<10);
 const other=isolated();other.projectiles=[{id:'other-lane',row:1,lane:1,col:8.7,dr:0,dc:1,damage:999,life:3,type:'pea'}];advance(other,.2);assert.equal(other.fences[2].hp,600);assert.equal(other.fences[1].hp,0);assert.equal(other.doctor.hits,10);
}pass('五行栅栏各自拦截，非藏身行被击穿不伤博士；藏身行击穿后才扣命中计数');
{
 const s=isolated();for(let i=0;i<9;i++){assert(m.hitDoctor(s,'hit-'+i,9999));assert.equal(s.doctor.hits,9-i);assert(!m.hitDoctor(s,'hit-'+i));}assert(m.hitDoctor(s,'tenth'));assert.equal(s.status,'lost');const snapshot=JSON.stringify(s);advance(s,5);assert.equal(JSON.stringify(s),snapshot);assert(!m.command(s,0,data.camp));assert(!m.hitDoctor(s,'extra'));
}pass('博士仍只有10次独立命中计数，重复弹丸不重复扣除，结束后冻结');
{
 const s=preparedScene(6);assert(m.configure(s,0,0,'bucket'));assert(m.configure(s,0,1,'balloon'));assert(m.configure(s,0,2,'digger'));assert.deepEqual(s.teams[0].members.map(m=>m.type),['bucket','balloon','digger']);assert(!m.configure(s,0,3,'normal'));assert(m.configure(s,1,2,''));assert.equal(s.teams[1].members.length,2);assert(m.deployTeam(s,1,{row:0,col:8}));assert(!m.deployTeam(s,1,{row:0,col:7}));m.start(s);assert(!m.configure(s,0,0,'normal'));assert(!m.deployTeam(s,1,{row:4,col:8}));assert.equal(s.teams.length,3);
 const locked=preparedScene();assert(!m.configure(locked,0,0,'balloon'));assert.equal(locked.energy,150);
}pass('固定三队各有三个自由编组槽，允许空位和混搭；布阵限栅栏前一列，不能提前选择未解救者');
{
 const s=preparedScene(6);m.configure(s,1,2,'');const id=s.teams[0].members[2].id;s.teams[0].members[2].hp=111;assert(m.transfer(s,0,1,id));assert.equal(s.teams[1].members.find(x=>x.id===id).hp,111);assert.equal(new Set(s.teams.flatMap(t=>t.members.map(m=>m.id))).size,8);m.start(s);m.configure(s,0,2,'');assert(!m.transfer(s,1,0,id));s.teams[1].row=s.teams[0].row;s.teams[1].col=s.teams[0].col;assert(m.transfer(s,1,0,id));assert.equal(s.teams[0].members.find(x=>x.id===id).hp,111);assert.equal(s.teams.length,3);s.teams[1].members.pop();assert(m.reinforce(s,1,'balloon'));assert.equal(s.energy,25);
}pass('转队保留成员ID和伤势、每队最多三人；战斗转队需会合，补员按实际兵种付费');
{
 const s=isolated();for(let i=0;i<100;i++)assert(m.command(s,0,{row:i%5,col:8},'转线'));m.command(s,0,{row:3,col:1});advance(s,.6);const a={...s.teams[0]};assert(m.command(s,0,{row:0,col:1},'转线'));advance(s,.05);assert(m.distance(a,s.teams[0])<=.033);for(let i=0;i<2200&&s.teams[0].path.length;i++){const before={...s.teams[0]};m.step(s,.05);assert(m.distance(before,s.teams[0])<=.033);assert(m.walkable({row:Math.round(s.teams[0].row),col:Math.round(s.teams[0].col)},0));}assert.equal(s.teams[0].row,0);assert.equal(s.teams[0].col,1);
}pass('玩家可以连续无冷却调遣；移动中改令不瞬移或斜穿实体地形');
{
 const s=isolated(),cache=s.caches[0];Object.assign(s.teams[0],m.route(data.camp,cache).at(-1));s.teams[0].interaction=cache.id;advance(s,3.1);assert(cache.claimed);const energy=s.energy;advance(s,10);assert.equal(s.energy,energy);s.teams[0].row=4;s.teams[0].col=9;cache.hp=0;advance(s,.1);assert(cache.broken);assert.equal(s.energy,energy+500);advance(s,5);assert.equal(s.energy,energy+500);
 const r=s.caches.find(c=>c.kind==='repair');r.claimed=true;Object.assign(s.teams[0],m.route(data.camp,r).at(-1));s.teams[0].members[0].hp=50;assert(m.repair(s,0));assert.equal(s.teams[0].members[0].hp,140);
}pass('补给与破碑奖励不重复，整备确实修复存活成员，物资规则保持有效');
{
 const s=isolated();Object.assign(s.teams[0],m.route(data.camp,s.goal).at(-1));advance(s,5);assert(!s.goal.open);s.caches[0].claimed=true;s.claimed.push(s.caches[0].id);advance(s,4.1);assert(s.goal.open);assert(s.follower.wounded);assert(s.follower.hp/s.follower.maxHp<.2);assert.equal(s.follower.id,'rescued');m.command(s,0,null,'撤回');advance(s,65);assert.equal(s.status,'won');assert(m.distance(s.follower,data.camp)<.75);
}pass('获救者以独立重伤对象加入护送，必须开门并带回灯房才结算');
{
 const s=preparedScene(5);advance(s,6);m.start(s);const previous=new Map();for(let i=0;i<800&&s.status==='battle';i++){const before=new Map(s.plants.map(p=>[p.id,{...p}]));m.step(s,.05);for(const p of s.plants){const a=before.get(p.id);if(!a)continue;assert(m.distance(a,p)<=.01668);assert.equal(a.col,p.col);if(a.lastMove!==p.lastMove){if(previous.has(p.id))assert(p.lastMove-previous.get(p.id)>=3.49);previous.set(p.id,p.lastMove);}}}assert(s.ai.turns>3);assert(s.ai.groups.some(g=>g.squad==='守门组'));
 // Freeze physical movement in this observation fixture: different queued routes must not change AI choices when public positions are identical.
 const stationary=m.createModel(data,{...old,UNITS:{...old.UNITS,normal:{...old.UNITS.normal,speed:0}}}),a=stationary.createScene(),b=stationary.createScene();stationary.chooseDoctor(a,2);stationary.chooseDoctor(b,2);stationary.start(a);stationary.start(b);a.ai.next=b.ai.next=.05;a.teams[0].path=[{row:1,col:8},{row:1,col:7}];b.teams[0].path=[{row:1,col:8},{row:2,col:8}];stationary.step(a,.1);stationary.step(b,.1);assert.deepEqual(a.ai.history,b.ai.history);
}pass('植物只沿自身列慢速换行，调动相隔至少3.5秒；AI仍只观察站位，不读玩家指令终点');
{
 for(let level=0;level<7;level++){
  const s=preparedScene(level);advance(s,60.1);
  for(let tick=0;tick<6000&&s.status==='battle';tick++){
   if(tick%10===0){const teams=s.teams.filter(m.alive),foes=s.plants.filter(p=>p.hp>0).sort((a,b)=>Math.min(...teams.map(t=>m.distance(a,t)))-Math.min(...teams.map(t=>m.distance(b,t))));let home=s.goal.open,target=foes[0]?{row:Math.round(foes[0].row),col:Math.round(foes[0].col)}:s.caches.filter(c=>c.claimed&&!c.broken).length<data.levels[level].requiredCaches?s.caches.find(c=>!c.claimed&&!c.broken):s.goal;
    // The smarter paid AI punishes the old fixed detour. Use visible objective
    // guards and the normal repair/reinforcement actions instead of a long script.
    if(level===6){
     for(const t of s.teams){if(t.members.filter(z=>z.hp>0).length<3)m.reinforce(s,t.id,'normal');m.repair(s,t.id);}
     home=s.goal.open;if(home)target=data.camp;else{const nodes=s.caches.filter(c=>!c.claimed&&!c.broken);target=s.caches.filter(c=>c.claimed&&!c.broken).length<data.levels[level].requiredCaches?nodes.sort((a,b)=>Math.min(...teams.map(t=>m.distance(a,t)))-Math.min(...teams.map(t=>m.distance(b,t))))[0]:s.goal;target=target||s.goal;const guard=foes.find(p=>m.distance(p,target)<1.25);if(guard)target=guard;}target={row:Math.round(target.row),col:Math.round(target.col)};
    }
    for(const t of teams)m.command(s,t.id,target,home?'撤回':'推进');}m.step(s,.05);
  }assert.equal(s.status,'won','level '+level+' time '+s.time);assert(s.economy.spent>0);assert.equal(s.economy.sun,500+s.economy.earned-s.economy.spent);assert(s.follower);
 }
}pass('七关真实经济与守军可通关；末关普通队争两处补给、清目标守卫并实际完成护送');
const game=path.resolve(__dirname,'../game');
{
 const d=new JSDOM(fs.readFileSync(path.join(game,'rescue-design.html'),'utf8'),{url:'http://127.0.0.1/rescue-design.html',runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;try{let frame;w.matchMedia=()=>({matches:false});w.requestAnimationFrame=fn=>{frame=fn;return 1;};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.Image=class{set src(v){queueMicrotask(()=>this.onload?.());}};for(const file of ['assets-data.js','rescue-plant-assets.js','engine.js','renderer.js','rescue-design-data.js','rescue-story-data.js','rescue-story-ui.js','rescue-design-model.js','rescue-design-renderer.js'])w.eval(fs.readFileSync(path.join(game,file),'utf8'));let live;const start=w.PVZ_RESCUE_SCENE.start;w.PVZ_RESCUE_SCENE.start=(s,...args)=>{live=s;return start(s,...args);};await w.eval(fs.readFileSync(path.join(game,'rescue-design.js'),'utf8'));const doc=w.document;doc.getElementById('bookClose').click();assert(doc.getElementById('start').disabled);assert.equal(doc.getElementById('hideouts').children.length,5);doc.querySelector('[data-hideout="2"]').click();assert(!doc.getElementById('start').disabled);assert.equal(doc.getElementById('roster').children.length,3);assert.equal(doc.querySelectorAll('#roster select').length,9);assert.equal(doc.querySelectorAll('#teams [data-team]').length,4);doc.getElementById('level').value='6';doc.getElementById('level').dispatchEvent(new w.Event('change'));doc.getElementById('bookClose').click();assert(doc.getElementById('start').disabled);doc.querySelector('[data-hideout="2"]').click();const slot=doc.getElementById('slot-0-0');slot.value='bucket';slot.dispatchEvent(new w.Event('change'));doc.getElementById('start').click();assert.equal(live.teams[0].members[0].type,'bucket');assert(slot.disabled);assert(doc.getElementById('placement').hidden);assert.equal(live.economy.sun,500);doc.getElementById('play').click();assert.equal(doc.getElementById('play').textContent,'继续');doc.getElementById('play').click();frame(1000);live.status='won';live.result='test result';frame(2000);assert(doc.getElementById('bookBody').textContent.includes('护送对象已经'));doc.getElementById('bookClose').click();for(let i=1;i<=10;i++)frame(2000+i*1000);assert.equal(doc.getElementById('level').value,'6');assert.equal(doc.getElementById('clock').textContent,'接应成功');assert(doc.getElementById('slot-0-0').disabled);assert(doc.getElementById('bookBody').textContent.includes('尚不可进入战斗'));doc.getElementById('bookClose').click();for(let i=1;i<=10;i++)frame(12000+i*1000);assert.equal(doc.getElementById('level').value,'6');assert.equal(w.localStorage.length,0);}finally{w.close();}
}pass('九槽编组、准备布阵与提前出发可用；末关战后读信再看后续设计，不提前循环第一关；仍不读写原冒险存档');
{
 const provenance=JSON.parse(fs.readFileSync(path.join(game,'assets/rescue-design/provenance.json')));assert.equal(provenance.entries.length,5);for(const art of provenance.entries){const b=fs.readFileSync(path.join(game,art.file));assert.equal(b.toString('ascii',8,12),'WEBP');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),art.sha256);}
}pass('新增木栅栏与已有四份战场素材均具有来源记录和有效哈希');
console.log(JSON.stringify({passed,scope:'lane-only combat, plant economy and deployment, free three-team composition, protected doctor, escort and automatic new-round DOM flow; no browser screenshot acceptance'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
