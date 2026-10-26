'use strict';
const assert=require('node:assert/strict'),base=require('../game/rescue-design-data'),engine=require('../game/engine'),rules=require('../game/terrain-rules'),factory=require('../game/rescue-design-model');
// Authored tactical fixtures use real paid placement, normal cards and actual
// simulation ticks. No projectile/doctor damage is injected to obtain a pass.
function fixture({wall=false,trapped=false,roof=false,hideout=4,col=6}={}){
 const data=structuredClone(base),level=data.levels[0];data.terrainCampaign=true;
 Object.assign(level,{plantDeck:['pea'],plants:[],prison:{row:0,col:1},requiredCaches:1,corridors:[0,2,4,6,8],gates:[1,3],budget:{sun:500,energy:150,maxPlants:1},blocked:wall?[{row:0,col:5},{row:2,col:5},{row:4,col:5}]:[],caches:[{id:'middle',kind:'food',row:trapped?1:3,col:trapped?4:7,name:'中段碑',reward:0},{id:'far',kind:'food',row:4,col:2,name:'后方碑',reward:0}],terrainMap:{id:roof?'roof':'lawn',theme:roof?'roof':'lawn',time:'day',terrain:{waterRows:[],bridges:[]}}});
 if(roof)data.plantCards.flowerpot={cost:25,recharge:7.5};
 const m=factory.createModel(data,engine,rules),s=m.createScene();m.chooseDoctor(s,hideout);
 // Leave one real player member on the distant fourth return lane. The old
 // firing post has no nearby responder; other squads are genuinely unassigned.
 for(let id=0;id<3;id++)for(let slot=0;slot<3;slot++)if(id!==0||slot!==0)assert(m.configure(s,id,slot,''));
 Object.assign(s.teams[0],{row:4,col:8});
 if(roof)assert(m.placeSupport(s,'flowerpot',{row:0,col}));const p=m.placePlant(s,'pea',{row:0,col});assert(p);
 assert.equal(s.economy.sun,500-100-(roof?25:0));assert(m.start(s));return{m,s,p,data};
}
function advance(f,time,inspect){for(let t=0;t<time-1e-8;t+=.05){const dt=Math.min(.05,time-t);f.m.step(f.s,dt);inspect?.(f.s,f.p,dt);}}
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};

check('静态栅栏线无人回应达到观察窗口后，植物改换进攻行而非一直重复原线',()=>{
 const f=fixture();f.s.economy.nextDeploy=Infinity;advance(f,13);assert.equal(f.p.row,0);assert(!f.s.ai.redirects?.length);assert(f.s.ai.fire.fenceDamage>0,'the original line must have real fence progress');
 advance(f,5);assert(f.s.ai.redirects?.some(r=>r.id===f.p.id&&r.reason==='诱饵线路无人回应'));assert.notEqual(f.p.row,0);assert.equal(f.p.col,6);assert(f.p.hp>0&&!f.p.withdrawn);
});

check('近处真实接战刷新回应观察，不把正在挨打的守军误判无人回应并付费撤下',()=>{
 const f=fixture({col:4});Object.assign(f.s.teams[0],{row:0,col:4.4});advance(f,6);
 assert(f.p.hp>0&&f.p.hp<f.p.maxHp,'real melee must reach this plant');assert(f.p.tactic.responseAt>=f.s.time-3.6);assert(!f.p.tactic.redirect);assert(!f.p.withdrawn);assert(!f.s.ai.redeployments?.length);assert.equal(f.s.economy.spent,100);
});

check('有可用同列侧翼时，静态篱墙前的射手慢速换行且不向不可破坏墙发弹',()=>{
 const f=fixture({wall:true,col:4});f.s.economy.nextDeploy=Infinity;advance(f,8);assert(f.p.row>0);assert.equal(f.p.col,4);assert.equal(f.s.ai.fire?.barrierImpacts||0,0);assert.equal(f.s.ai.fire?.ridgeImpacts||0,0);assert((f.s.ai.fire?.prevented||0)>0);assert(f.s.ai.fire.launched>0);
});

check('同列被补给碑堵住时，安全撤下旧射位并真实付费在新列部署，未移动旧体穿墙',()=>{
 const f=fixture({wall:true,trapped:true,col:4});advance(f,11.2);const record=f.s.ai.redeployments?.[0];assert(record);assert(record.time>=10.5);assert.equal(record.cost,100);assert.equal(f.p.row,0);assert.equal(f.p.col,4);assert(f.p.withdrawn&&f.p.hp===0);const fresh=f.s.plants.find(p=>p.id===record.to);assert(fresh&&fresh.col===6);assert.equal(f.s.economy.spent,200);assert.equal(f.s.economy.sun,300);assert(f.s.economy.cooldowns.pea>6);assert.equal(f.s.ai.nextRedeploy,record.time+15);
});

check('付费重新部署遵守上层卡冷却，冷却未到时旧体仍留在原位',()=>{
 const f=fixture({wall:true,trapped:true,col:4});f.s.economy.cooldowns.pea=30;advance(f,20);assert(!f.s.ai.redeployments?.length);assert(f.p.hp>0&&!f.p.withdrawn);assert.equal(f.p.col,4);assert.equal(f.s.economy.spent,100);assert(f.s.economy.cooldowns.pea>9.9);
});

check('屋顶重布射位先付花盆再付本体，没有免费生成底座或复用另一格支架',()=>{
 const f=fixture({wall:true,trapped:true,roof:true,col:4});advance(f,11.2);const record=f.s.ai.redeployments?.[0];assert(record);assert.equal(record.cost,125);assert.equal(f.s.economy.spent,250);assert.equal(f.s.economy.sun,250);const fresh=f.s.plants.find(p=>p.id===record.to),support=rules.supportAt(f.s,fresh);assert(support&&support.type==='flowerpot');assert.notEqual(support.col,4);assert.equal(f.s.supports.length,2);
});

check('换路始终保留原列，每格至少三秒，决策迟滞不造成瞬移或来回抖动',()=>{
 const f=fixture();f.s.economy.nextDeploy=Infinity;let previous=0,firstStart=null,firstFinish=null,firstReturn=null,previousMove=f.p.lastMove;const starts=[];
 advance(f,25,(s,p,dt)=>{assert.equal(p.col,6);assert(Math.abs(p.row-previous)<=dt/3+1e-7);previous=p.row;if(p.lastMove!==previousMove){starts.push(p.lastMove);previousMove=p.lastMove;if(firstStart==null)firstStart=s.time;}if(firstStart!=null&&firstFinish==null&&p.row===1&&!p.moving)firstFinish=s.time;if(firstFinish!=null&&firstReturn==null&&p.row<1-1e-7)firstReturn=s.time;});
 assert(firstStart!=null&&firstFinish!=null);assert(firstFinish-firstStart>=2.95);for(let i=1;i<starts.length;i++)assert(starts[i]-starts[i-1]>=3.5-1e-7);assert(f.s.ai.redirects.length<=2,'one unanswered interval must not cause rapid repeated redirects');assert(firstReturn==null||firstReturn-firstFinish>=7-1e-7,'new firing lane must hold at least 7s after arrival before returning; '+JSON.stringify({firstStart,firstFinish,firstReturn,starts}));
});

check('五种博士藏身行不改变无人回应换路、付费部署、植物位置或射击节奏',()=>{
 const signatures=[];for(let hideout=0;hideout<5;hideout++){const f=fixture({wall:true,trapped:true,col:4,hideout});advance(f,20);assert.equal(f.s.doctor.hits,10);assert(!Object.hasOwn(f.m.observeAI(f.s),'doctor'));signatures.push(JSON.stringify({view:f.m.observeAI(f.s),plants:f.s.plants,economy:f.s.economy,redirects:f.s.ai.redirects,redeployments:f.s.ai.redeployments,fire:f.s.ai.fire}));}for(const signature of signatures.slice(1))assert.equal(signature,signatures[0]);
});
console.log(JSON.stringify({passed,scope:'public unanswered-response observation, effective lane changes, safe paid redeployment, cooldown/support costs, same-column slow movement and hidden-doctor independence; authored tactical fixtures, not full campaign difficulty acceptance'}));
