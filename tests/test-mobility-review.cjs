'use strict';
const assert=require('node:assert/strict');
const base=require('../game/rescue-design-data'),story=require('../game/rescue-story-data'),engine=require('../game/engine'),maps=require('../game/battle-map-data'),campaign=require('../game/terrain-campaign-data'),catalog=require('../game/terrain-unit-data'),rules=require('../game/terrain-rules'),factory=require('../game/rescue-design-model');
const setup=require('../game/terrain-campaign-setup').create(base,story,engine,maps,campaign,catalog),model=factory.createModel(setup.design,setup.stats,rules),index=23;
const advance=(s,seconds)=>{for(let t=0;t<seconds-1e-8;t+=.05)model.step(s,Math.min(.05,seconds-t));};
let passed=0;const check=(label,fn)=>{fn();passed++;console.log('PASS '+label);};
function scene(linked=false){
 const s=model.createScene(index);assert(model.chooseDoctor(s,4));
 for(const t of s.teams)for(let slot=0;slot<3;slot++)assert(model.configure(s,t.id,slot,''));
 for(const id of linked?[0,1]:[0]){assert(model.configure(s,id,0,'balloon'));assert(model.deployTeam(s,id,{row:2,col:8}));}
 if(linked)assert(model.mergeTeams(s,0,1));assert(model.start(s));return s;
}
function shootAt(s,t){
 // A real high cactus projectile already in flight: only launch/collision state
 // is arranged. Normal collision, airborne loss, casualties and AI still run.
 s.projectiles.push({id:'fixture-cactus-'+s.nextShot++,sourceId:'fixture-cactus',row:Math.round(t.row),lane:Math.round(t.row),col:t.col-.05,originCol:1,dr:0,dc:1,damage:20,type:'cactus',airborne:true,lobbed:false,range:12,life:4.5});
 model.step(s,.05);
}
check('WR1: bridge landing stops every linked squad before its pending non-bridge water path',()=>{
 const s=scene(true);assert(model.command(s,0,{row:2,col:6}));assert(s.teams.slice(0,2).every(t=>t.path.some(p=>rules.water(s,p)&&!rules.bridge(s,p))));
 assert(model.landTeam(s,0));advance(s,2.5);
 const teams=s.teams.slice(0,2);assert(teams.every(t=>t.row===2&&t.col===8&&!t.path.length&&!t.moving));assert.equal(teams[0].group,teams[1].group);assert.equal(teams[0].members[0].airborne,false);assert.equal(teams[1].members[0].airborne,true,'landing one squad does not silently pop a different squad');
});
check('WR1: landing while departing bridge settles back on a legal vertex, never hangs at a fractional water edge',()=>{
 const s=scene(),t=s.teams[0];assert(model.command(s,0,{row:2,col:6}));advance(s,.3);assert(t.col>7.5&&t.col<8);assert.equal(t.edgeStart.col,8);
 assert(model.landTeam(s,0));advance(s,2);assert.equal(t.col,8);assert.equal(t.row,2);assert.equal(t.path.length,0);assert(!t.moving);assert.equal(t.members[0].airborne,false);assert(model.walkable({row:2,col:8},index,s,t));
});
check('WR1: voluntarily landing in real unbridged water is rejected atomically',()=>{
 const s=scene(),t=s.teams[0];assert(model.command(s,0,{row:2,col:6}));advance(s,2.3);assert(rules.water(s,t)&&!rules.bridge(s,t));const snapshot=JSON.stringify(t);
 assert.equal(model.landTeam(s,0),false);assert.equal(JSON.stringify(t),snapshot);assert(t.members[0].hp>0&&t.members[0].airborne);
});
check('WR2: cactus popping on a bridge cancels the obsolete air route before grounded movement can enter water',()=>{
 const s=scene(),t=s.teams[0];assert(model.command(s,0,{row:2,col:6}));shootAt(s,t);assert.equal(t.members[0].airborne,false);assert.equal(t.members[0].hp,160);
 advance(s,2.6);assert.equal(t.col,8);assert.equal(t.row,2);assert.equal(t.path.length,0);assert(t.members[0].hp>0);assert(model.walkable({row:2,col:8},index,s,t));
});
check('WR2: cactus popping over actual unbridged water still loses the fallen balloon, with no safe-cell teleport',()=>{
 const s=scene(),t=s.teams[0];assert(model.command(s,0,{row:2,col:6}));advance(s,2.3);assert(rules.water(s,t)&&!rules.bridge(s,t));const before={row:t.row,col:t.col};shootAt(s,t);
 assert.equal(t.members[0].airborne,false);assert.equal(t.members[0].hp,0);assert.equal(s.record.casualties,1);assert(model.distance(before,t)<.04,'normal motion only; never teleport a falling unit onto a bridge');assert(s.events.some(e=>e.text.includes('落水')));
});
check('WR3: a pea fired during row transfer hits the firing lane instead of passing between grid rows',()=>{
 const s=factory.createScene(0);assert(factory.chooseDoctor(s,4));assert(factory.start(s));const p=factory.placePlant(s,'pea',{row:0,col:6});assert(p);
 Object.assign(p,{row:.4,path:[{row:1,col:6}],moving:true,cooldown:0,lastMove:0});Object.assign(s.teams[0],{row:0,col:8});const before=s.teams[0].members[0].hp;factory.step(s,.05);
 const shot=s.projectiles.find(q=>q.sourceId===p.id);assert(shot);assert.equal(shot.lane,0);assert.equal(shot.row,0);assert.equal(shot.dr,0);for(let t=0;t<.65;t+=.05)factory.step(s,.05);
 assert(p.row>.4);assert.equal(s.teams[0].members[0].hp,before-20,'the intended row receives one normal pea hit');
});
check('WR3: an already fired projectile retains its original row after its source arrives on the next row',()=>{
 const s=factory.createScene(6);assert(factory.chooseDoctor(s,4));assert(factory.start(s));const p=factory.placePlant(s,'pea',{row:3,col:1});assert(p);
 Object.assign(p,{row:3.4,path:[{row:4,col:1}],moving:true,cooldown:0,lastMove:0});Object.assign(s.teams[0],{row:3,col:8});Object.assign(s.teams[1],{row:4,col:8});const hp0=s.teams[0].members[0].hp,hp1=s.teams[1].members[0].hp;factory.step(s,.05);
 const shot=s.projectiles.find(q=>q.sourceId===p.id);assert(shot);for(let t=0;t<1.8;t+=.05)factory.step(s,.05);
 assert.equal(p.row,4);assert.equal(shot.lane,3);assert.equal(shot.row,3);assert(shot.col<8&&shot.life>0);for(let t=0;t<.4;t+=.05)factory.step(s,.05);
 assert.equal(s.teams[0].members[0].hp,hp0-20);assert.equal(s.teams[1].members[0].hp,hp1,'source row change must not redirect an old projectile to another row');
});
check('WR4: changing a prepared water squad to ground composition cancels its stale water route',()=>{
 const s=model.createScene(18);for(const t of s.teams)for(let slot=0;slot<3;slot++)assert(model.configure(s,t.id,slot,''));assert(model.configure(s,0,0,'ducky'));assert(model.deployTeam(s,0,{row:2,col:8}));assert(model.command(s,0,{row:2,col:7}));assert(s.teams[0].path.some(q=>rules.water(s,q)&&!rules.bridge(s,q)));assert(model.configure(s,0,0,'normal'));assert.equal(s.teams[0].path.length,0);assert(model.chooseDoctor(s,4));assert(model.start(s));advance(s,2);assert.equal(s.teams[0].col,8);assert(model.walkable({row:2,col:8},18,s,s.teams[0]));
});
check('WR4: prepared linked squads redeploy together and incompatible reconfiguration stops the shared plan',()=>{
 const s=model.createScene(18);for(const t of s.teams)for(let slot=0;slot<3;slot++)assert(model.configure(s,t.id,slot,''));for(const id of [0,1]){assert(model.configure(s,id,0,'ducky'));assert(model.deployTeam(s,id,{row:2,col:8}));}assert(model.mergeTeams(s,0,1));assert(model.deployTeam(s,0,{row:1,col:8}));assert.equal(s.teams[1].row,1);assert.equal(s.teams[0].group,s.teams[1].group);assert(model.command(s,0,{row:1,col:7}));assert(model.configure(s,0,0,'normal'));assert(s.teams.slice(0,2).every(t=>t.path.length===0&&t.col===8));
});
console.log(JSON.stringify({passed,scope:'WR1/WR2 airborne-state terrain and linked-party boundaries; WR3 fixed horizontal firing lanes; WR4 prepared compositions and linked deployment; AI remains enabled; not campaign playability or visual acceptance'}));
