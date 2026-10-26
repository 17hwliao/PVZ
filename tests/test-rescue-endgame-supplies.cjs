'use strict';
const assert=require('node:assert/strict');
const base=require('../game/rescue-design-data.js'),story=require('../game/rescue-story-data.js'),engine=require('../game/engine.js'),maps=require('../game/battle-map-data.js'),campaign=require('../game/terrain-campaign-data.js'),catalog=require('../game/terrain-unit-data.js'),rules=require('../game/terrain-rules.js'),factory=require('../game/rescue-design-model.js');
const setup=require('../game/terrain-campaign-setup.js').create(base,story,engine,maps,campaign,catalog),m=factory.createModel(setup.design,setup.stats,rules);
const advance=(model,s,seconds)=>{for(let i=0;i<seconds/.05;i++)model.step(s,.05);};
const scene=(index=10)=>{const s=m.createScene(index);assert(m.chooseDoctor(s,2));assert(m.start(s));return s;};
const position=(t,p)=>Object.assign(t,{row:p.row,col:p.col,path:[],moving:false,edgeStart:{row:p.row,col:p.col}});
function atNode(kind){const s=scene(),node=s.caches.find(c=>c.kind===kind);Object.assign(node,{claimed:true,progress:3,paid:true});const t=s.teams[0],route=m.route(setup.design.camp,node,s.levelIndex,s,t);assert(route.length);position(t,route.at(-1));return{s,node,t};}
function waterScene(){const s=m.createScene(18);assert(m.chooseDoctor(s,2));assert(m.configure(s,0,0,'ducky'));assert(m.configure(s,0,1,'ducky'));assert(m.configure(s,0,2,''));for(const id of [0,1])assert(m.deployTeam(s,id,{row:2,col:8}));assert(m.start(s));return s;}
let passed=0;function pass(name){passed++;console.log('PASS '+name);}

// Boundary fixtures represent damage/arrival states; AI remains enabled.
for(const [model,data,index]of [[m,setup.design,10],[factory,base,6]]){
 const s=model.createScene(index);model.chooseDoctor(s,2);model.start(s);const keep=data.levels[index].requiredCaches-1;
 for(const c of s.caches.slice(keep))Object.assign(c,{hp:0,claimed:true,broken:true,paid:true,breakPaid:true});model.step(s,.05);
 assert.equal(s.status,'lost');assert.match(s.result,/补给碑不足|无法打开/);const ended=JSON.stringify(s);model.step(s,5);assert.equal(JSON.stringify(s),ended,'terminal state must freeze');
}
pass('尚未开门且完好碑已不足门槛时立即失败，旧七关和长线都不会永久等候');

{
 const s=scene();for(const c of s.caches.slice(1))Object.assign(c,{hp:0,claimed:true,broken:true,paid:true,breakPaid:true});s.goal.open=true;
 const t=s.teams[0];s.follower={id:'rescued-test',row:t.row,col:t.col,type:'normal',kind:'zombie',hp:35,maxHp:210,path:[],escort:t.id,wounded:true};m.step(s,.05);assert.equal(s.status,'battle','already-open door does not reapply its old supply threshold');
 s.caches[0].hp=0;s.caches[0].claimed=true;m.step(s,.05);assert.equal(s.status,'lost');assert.match(s.result,/所有补给碑/);
}
pass('开门后尚有碑不误判门槛失败，全部补给断绝仍正常结算');

for(const kind of ['relay','repair','food']){
 const {s,node,t}=atNode(kind);t.members[0].hp=50;t.members[1].hp=180;t.members[2].hp=0;const ids=t.members.map(z=>z.id),before=s.energy,status=m.supplyStatus(s,t.id);
 assert.equal(status.node.id,node.id);assert.equal(status.living,2);assert.equal(status.slotsFree,1);assert.equal(status.missingHealth,190);assert(status.canHeal&&status.canRecruit);assert(status.allowedRecruitTypes.includes('normal'));
 assert(m.repair(s,t.id));assert.equal(s.energy,before-30);assert.deepEqual(t.members.map(z=>z.hp),[140,210,0],'heal each living member, cap at max, never revive corpse');
 const recruitBefore=s.energy;assert(m.reinforce(s,t.id,'normal'));assert.equal(s.energy,recruitBefore-50);assert.equal(t.members.length,3);assert.equal(t.members.filter(z=>z.hp>0).length,3);assert.equal(t.members[0].id,ids[0]);assert.equal(t.members[1].id,ids[1]);assert(!t.members.some(z=>z.id===ids[2]));assert.equal(new Set(t.members.map(z=>z.slot)).size,3);
 const fullCost=s.energy;assert(!m.reinforce(s,t.id,'normal'));assert.equal(s.energy,fullCost,'full squad never charged');
 assert(m.repair(s,t.id));const healed=s.energy;assert(!m.repair(s,t.id));assert.equal(s.energy,healed,'healthy squad never charged');
 t.members[2].hp=0;t.members[0].hp-=30;position(t,{row:(node.row+2)%5,col:6});const far=m.supplyStatus(s,t.id);assert(!far.nearby&&!far.atCamp&&!far.canHeal&&!far.canRecruit);const farCost=s.energy;assert(!m.repair(s,t.id));assert(!m.reinforce(s,t.id,'normal'));assert.equal(s.energy,farCost);
}
pass('三种已接通完好碑均可治疗补员，核对每人回血、总费用、距离、死亡槽位与三人上限');

{
 const {s,t}=atNode('food');t.members[0].hp=50;s.energy=29;assert(!m.supplyStatus(s,t.id).canHeal);assert(!m.repair(s,t.id));assert.equal(s.energy,29);s.energy=30;assert(m.repair(s,t.id));assert.equal(s.energy,0);
 t.members[2].hp=0;s.energy=49;assert(m.supplyStatus(s,t.id).canRecruit,'location/slot eligibility is separate from selected-card price');assert(!m.reinforce(s,t.id,'normal'));assert.equal(s.energy,49);s.energy=50;assert(m.reinforce(s,t.id,'normal'));assert.equal(s.energy,0);
 const dead=scene(),a=dead.teams[0];for(const member of a.members)member.hp=0;position(a,{row:0,col:2});dead.energy=50;assert(m.reinforce(dead,a.id,'normal'));assert.equal(a.row,setup.design.camp.row);assert.equal(a.col,setup.design.camp.col);assert.equal(a.members.length,1);assert.equal(a.members[0].hp,setup.stats.UNITS.normal.hp);assert.equal(dead.energy,0);
}
pass('治疗与补员费用边界准确，整队倒下后按卡费回营补员，不免费复活原成员');

for(const kind of ['relay','repair','food']){
 const s=scene(),c=s.caches.find(c=>c.kind===kind),t=s.teams[0];position(t,m.route(setup.design.camp,c,s.levelIndex,s,t).at(-1));c.progress=2.99;assert(m.command(s,t.id,c));const energy=s.energy;m.step(s,.05);assert(c.claimed);assert.equal(s.energy,energy+c.reward);advance(m,s,.5);assert.equal(s.energy,energy+c.reward);
 c.hp=0;m.step(s,.05);assert(c.broken);assert.equal(s.energy,energy+c.reward+500);advance(m,s,.5);assert.equal(s.energy,energy+c.reward+500,'broken cache emergency reward exactly once');
}
pass('三类碑接通奖励及破碑500物资均只发一次，治疗补员不会重新触发奖励');

{
 const s=waterScene(),t=s.teams[0],donor=s.teams[1].members[0];assert(m.command(s,0,{row:2,col:7}));advance(m,s,2);assert.equal(t.row,2);assert.equal(t.col,7);const node=s.caches.find(c=>c.row===3&&c.col===7);assert(node);Object.assign(node,{claimed:true,progress:3,paid:true});assert(m.supplyStatus(s,0).nearby);
 const snapshot=JSON.stringify([s.teams,s.energy,s.nextMember]);assert(!m.transfer(s,1,0,donor.id));assert.equal(JSON.stringify([s.teams,s.energy,s.nextMember]),snapshot,'illegal water transfer must be atomic');assert(!m.reinforce(s,0,'normal'));assert.equal(JSON.stringify([s.teams,s.energy,s.nextMember]),snapshot);assert(!m.supplyStatus(s,0).allowedRecruitTypes.includes('normal'));assert(m.supplyStatus(s,0).allowedRecruitTypes.includes('ducky'));
 const cost=s.energy;assert(m.reinforce(s,0,'ducky'));assert.equal(s.energy,cost-catalog.units.ducky.cost);assert(t.members.every(z=>z.type==='ducky'));assert(m.command(s,0,{row:2,col:8}),'valid swimmers can return to bridge');advance(m,s,2);assert.equal(t.col,8);
}
pass('水中拒绝转入与补入普通单位且不扣费不变更成员，允许按真实费用补泳圈并返回');

{
 const s=waterScene(),t=s.teams[0],donor=s.teams[1].members[0];assert(m.command(s,0,{row:2,col:7}));advance(m,s,2);assert(m.command(s,0,{row:2,col:8}));advance(m,s,1.2);assert(t.col>7.5&&t.col<8);assert.equal(Math.round(t.col),8,'rounded current cell is already bridge');assert.equal(t.edgeStart.col,7,'unfinished edge still begins in open water');
 assert(!m.transfer(s,1,0,donor.id),'must validate water edge, not just rounded current cell');assert(!m.supplyStatus(s,0).allowedRecruitTypes.includes('normal'));assert(m.command(s,0,null,'驻守'));advance(m,s,1);assert.equal(t.col,8);assert.equal(t.path.length,0);assert(m.transfer(s,1,0,donor.id),'after genuinely reaching bridge, ordinary transfer is legal');
}
pass('由水面上桥途中仍保留水路能力约束，真正抵桥停稳后才允许普通成员加入');

{
 const s=waterScene(),donor=s.teams[1].members[0];assert(m.command(s,0,{row:2,col:7}));assert(!m.transfer(s,1,0,donor.id),'shore squad with pending water route cannot accept ground member');assert(!m.reinforce(s,0,'normal'));
 assert(m.command(s,0,null,'驻守'));assert.equal(s.teams[0].path.length,0,'hold at a bridge vertex must cancel the unstarted water edge');assert(m.supplyStatus(s,0).allowedRecruitTypes.includes('normal'));assert(m.transfer(s,1,0,donor.id));assert(m.walkable({row:2,col:8},18,s,s.teams[0]));
}
pass('岸桥预订水路时拒绝普通成员，格点驻守取消水路后正常接收');

{
 const s=m.createScene(18);m.chooseDoctor(s,2);for(const [id,types]of [[0,['ducky','ducky','']],[2,['ducky','','']]])for(let slot=0;slot<3;slot++)assert(m.configure(s,id,slot,types[slot]));for(const t of s.teams)assert(m.deployTeam(s,t.id,{row:2,col:8}));assert(m.mergeTeams(s,0,2));assert(m.start(s));assert(m.command(s,0,{row:2,col:7}));const donor=s.teams[1].members[0],before=JSON.stringify(s.teams);
 assert(!m.transfer(s,1,2,donor.id),'recipient must preserve the whole linked party water route');assert.equal(JSON.stringify(s.teams),before);assert(!m.supplyStatus(s,2).allowedRecruitTypes.includes('normal'));assert(m.command(s,0,null,'驻守'));assert(s.teams.filter(t=>t.group!=null).every(t=>!t.path.length));assert(m.transfer(s,1,2,donor.id));assert(!m.command(s,0,{row:2,col:7}),'new linked ground member constrains the whole party');
}
pass('联队成员变更检查整支联队的预订水路，取消后可接地面成员且不会继续非法入水');

for(const levelIndex of [0,17]){
 const s=m.createScene(levelIndex);m.chooseDoctor(s,2);for(const t of s.teams)assert(m.deployTeam(s,t.id,{row:2,col:8}));assert(m.mergeTeams(s,0,1));assert(m.mergeTeams(s,0,2));m.start(s);for(const t of s.teams)position(t,{row:2,col:6});s.goal.open=true;s.follower={id:'rescued-linked',kind:'zombie',type:'normal',row:2,col:6,hp:35,maxHp:210,path:[],escort:0,wounded:true};assert(m.command(s,0,setup.design.camp,'撤回'));advance(m,s,12);assert.equal(s.status,'won');assert(m.distance(s.follower,setup.design.camp)<.75);assert(s.teams.every(t=>t.members.length<=3));
}
pass('联队护送仍可真实回营，泳池地面伤员沿桥绕水，不以队伍先到代替目标到达');

console.log(JSON.stringify({passed,scope:'endgame objective impossibility, all-cache healing/recruitment, terrain-safe membership, legal linked escort; state-boundary fixtures, not a whole-campaign difficulty review'}));
