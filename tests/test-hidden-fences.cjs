const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const m=require('../game/rescue-design-model'),data=require('../game/rescue-design-data');
const advance=(s,t)=>{for(let n=0;n<t-1e-8;n+=.05)m.step(s,Math.min(.05,t-n));};
const isolated=(row=2)=>{const s=m.createScene();m.chooseDoctor(s,row);m.start(s);s.ai.next=s.economy.nextDeploy=Infinity;s.plants=[];s.teams.forEach(t=>{t.row=4;t.col=0;});return s;};
const shot=(id,row,col=8.6,damage=20)=>({id,row,lane:row,col,dr:0,dc:1,damage,life:4.5,type:'pea',airborne:false});
const pea=row=>({id:40,type:'pea',row,col:6,hp:180,maxHp:180,path:[],moving:false,attack:0,hit:0,cooldown:0,lastMove:-10});
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
(async()=>{
check('每局生成占满第10列的五段独立600耐久栅栏，博士初始没有藏身行',()=>{
 const s=m.createScene(),fresh=m.createScene();assert.equal(s.fences.length,5);assert(s.fences.every((f,row)=>f.row===row&&f.col===9&&f.hp===600&&f.maxHp===600));assert.equal(s.doctor.row,null);assert.equal(s.doctor.hits,10);s.fences[0].hp=1;assert.equal(s.fences[1].hp,600);assert.equal(fresh.fences[0].hp,600);
});
check('玩家必须明确指定一处栅栏，允许准备期重选，开战后锁定且不泄漏到公开观测',()=>{
 const s=m.createScene(),visible=m.observeAI(s);assert(!m.start(s));for(const row of [-1,5,1.5,'2',null,NaN])assert(!m.chooseDoctor(s,row));for(let row=0;row<5;row++){assert(m.chooseDoctor(s,row));assert.equal(s.doctor.row,row);assert.deepEqual(m.observeAI(s),visible);}assert(m.start(s));assert(!m.chooseDoctor(s,1));assert(!m.command(s,'doctor',{row:1,col:8}));assert.equal(s.doctor.row,4);
});
check('60秒结束未选择时冻结准备经济与战场，既不替玩家猜位置也不无限刷冷却',()=>{
 const s=m.createScene();advance(s,60);assert.equal(s.status,'planning');assert.equal(s.planning,0);assert(Math.abs(s.prepTime-60)<1e-8);assert.equal(s.doctor.row,null);assert.equal(s.time,0);const snapshot=JSON.stringify(s);advance(s,10);assert.equal(JSON.stringify(s),snapshot);assert(!m.start(s,true));assert(m.chooseDoctor(s,3));advance(s,.05);assert.equal(s.status,'battle');assert(Math.abs(s.economy.clock-60)<1e-8);assert.equal(s.doctor.row,3);
});
check('五个藏身位置下，人机布阵、换行决策和经济消耗相同，不按隐藏博士行改策略',()=>{
 const scenes=Array.from({length:5},(_,row)=>{const s=m.createScene(6);m.chooseDoctor(s,row);advance(s,60);advance(s,12);return s;});
 const strategy=s=>({view:m.observeAI(s),economy:s.economy,history:s.ai.history,groups:s.ai.groups,plants:s.plants.map(p=>({type:p.type,row:p.row,col:p.col,path:p.path,cooldown:p.cooldown})),shots:s.nextShot});
 for(const s of scenes.slice(1))assert.deepEqual(strategy(s),strategy(scenes[0]));assert(!JSON.stringify(m.observeAI(scenes[0])).includes('doctor'));
});
check('五行来弹分别消耗本行栅栏，不互相扣耐久，也不穿透完整栅栏伤到博士',()=>{
 const s=isolated(3);s.projectiles=Array.from({length:5},(_,row)=>shot('lane-'+row,row));advance(s,.3);assert(s.fences.every(f=>f.hp===580));assert.equal(s.doctor.hits,10);assert.equal(s.projectiles.length,0);
});
check('击穿的一发止于栅栏，不同一发再次伤博士；后续命中仍只扣一次计数',()=>{
 const s=isolated(1);s.fences[1].hp=1;s.projectiles=[shot('break',1,8.6,9999)];advance(s,1);assert.equal(s.fences[1].hp,0);assert.equal(s.doctor.hits,10);s.projectiles=[shot('after',1,9.4,9999)];advance(s,.6);assert.equal(s.doctor.hits,9);assert(!m.hitDoctor(s,'after'));assert.equal(s.doctor.hits,9);assert(s.fences.filter(f=>f.row!==1).every(f=>f.hp===600));
});
check('空藏身行被击穿不扣博士计数；空行和藏身行都持续同样的正常直射',()=>{
 const empty=isolated(4),occupied=isolated(0);for(const s of [empty,occupied]){s.fences.forEach(f=>f.hp=0);s.plants=[pea(0)];}advance(empty,4);advance(occupied,4);assert.equal(empty.doctor.hits,10);assert(occupied.doctor.hits<10);assert.equal(empty.nextShot,occupied.nextShot);assert.equal(empty.plants[0].cooldown,occupied.plants[0].cooldown);assert.deepEqual(empty.ai.history,occupied.ai.history);assert(empty.projectiles.every(p=>p.lane===0&&p.dr===0));
});
check('本行小队仍可自然挡弹，栅栏有耐久不会绕过队伍直接挨打',()=>{
 const s=isolated();s.teams[0].row=1;s.teams[0].col=8.1;const hp=s.teams[0].members[0].hp;s.projectiles=[shot('screen',1,7.5)];advance(s,.5);assert.equal(s.teams[0].members[0].hp,hp-20);assert.equal(s.fences[1].hp,600);
});
check('小队布置与接应点位于栅栏前，寻路可到栅栏相邻格而不会走进藏身区域',()=>{
 const s=m.createScene();assert.equal(data.camp.col,8);for(let row=0;row<5;row++){assert(!m.walkable({row,col:9}));const route=m.route(data.camp,{row,col:9});assert(route.length);assert.deepEqual(route.at(-1),{row,col:8});assert(!m.deployTeam(s,0,{row,col:9}));assert(m.deployTeam(s,0,{row,col:8}));}
});
check('生产画布绘制五段栅栏，未选位置不画博士，选择后只画一位并使用真实行坐标',()=>{
 let calls=[];const ctx=new Proxy({globalAlpha:1,drawImage(...args){assert(args.slice(1).every(Number.isFinite));calls.push(args);}},{get:(o,k)=>k in o?o[k]:(...args)=>{assert(args.every(v=>typeof v!=='number'||Number.isFinite(v)));}}),renderer={drawBackground(){},drawPlant(){},drawZombie(){},actor(){}};
 const painter=require('../game/rescue-design-renderer').createPainter(renderer,{fence:{id:'fence'},command:{id:'doctor'}}),s=m.createScene();painter.paint(ctx,s);assert.equal(calls.filter(c=>c[0].id==='fence').length,5);assert(!calls.some(c=>c[0].id==='doctor'));calls=[];m.chooseDoctor(s,4);painter.paint(ctx,s);assert.equal(calls.filter(c=>c[0].id==='fence').length,5);const doctor=calls.filter(c=>c[0].id==='doctor');assert.equal(doctor.length,1);assert.equal(doctor[0][2],painter.point(4,10.8).y-122);
});
{
 const game=path.resolve(__dirname,'../game'),dom=new JSDOM(fs.readFileSync(path.join(game,'rescue-design.html'),'utf8'),{url:'http://127.0.0.1/rescue-design.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;try{
  w.matchMedia=()=>({matches:false});w.requestAnimationFrame=()=>1;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:720});w.Image=class{set src(value){queueMicrotask(()=>this.onload?.());}};
  for(const file of ['assets-data.js','rescue-plant-assets.js','engine.js','renderer.js','rescue-design-data.js','rescue-story-data.js','rescue-story-ui.js','rescue-design-model.js','rescue-design-renderer.js','plant-economy-ui.js'])w.eval(fs.readFileSync(path.join(game,file),'utf8'));
  let live;const choose=w.PVZ_RESCUE_SCENE.chooseDoctor;w.PVZ_RESCUE_SCENE.chooseDoctor=(s,row)=>{live=s;return choose(s,row);};await w.eval(fs.readFileSync(path.join(game,'rescue-design.js'),'utf8'));const doc=w.document;doc.getElementById('bookClose').click();assert(doc.getElementById('start').disabled);assert.equal(doc.querySelectorAll('#hideouts button').length,5);
  doc.querySelector('[data-hideout="4"]').click();assert.equal(live.doctor.row,4);live.planning=52.0000000000004;doc.querySelector('[data-hideout="4"]').click();assert.equal(doc.getElementById('clock').textContent,'准备 52秒');live.planning=60;assert(!doc.getElementById('start').disabled);doc.getElementById('scene').dispatchEvent(new w.MouseEvent('click',{clientX:940,clientY:316,bubbles:true}));assert.equal(live.doctor.row,1);assert.equal(doc.querySelector('[data-hideout="1"]').getAttribute('aria-pressed'),'true');doc.getElementById('start').click();assert.equal(live.status,'battle');assert([...doc.querySelectorAll('#hideouts button')].every(b=>b.disabled));doc.getElementById('restart').click();assert(doc.getElementById('start').disabled);assert(!doc.querySelector('#hideouts button[aria-pressed="true"]'));
 }finally{w.close();}
 passed++;console.log('PASS 木牌按钮与画布栅栏都可选择藏身行；开战锁定，重开强制重新指定');
}
console.log(JSON.stringify({passed,scope:'five independent fences, explicit player hideout, AI without secret location, normal lane fire and DOM deployment'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
