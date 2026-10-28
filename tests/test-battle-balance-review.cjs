'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),base=require('../game/rescue-design-data'),engine=require('../game/engine'),rules=require('../game/terrain-rules'),units=require('../game/terrain-unit-data'),campaign=require('../game/terrain-campaign-data'),setup=require('../game/terrain-campaign-setup').create(base,require('../game/rescue-story-data'),engine,require('../game/battle-map-data'),campaign,units),model=require('../game/rescue-design-model').createModel(setup.design,setup.stats,rules),painterApi=require('../game/rescue-design-renderer');
let passed=0;const check=(title,run)=>{run();passed++;console.log('PASS '+title);};
check('已实现角色按直射、阻挡、减速、近战、夜菇、水域、雾中克制、屋顶抛射依次教学',()=>{
 const first=type=>setup.design.levels.findIndex(l=>l.plantDeck.includes(type));
 assert(first('pea')<first('wallnut'));assert(first('wallnut')<first('snow'));assert(first('snow')<first('chomper'));assert(first('chomper')<first('puff'));assert(first('puff')<first('sunshroom'));assert(first('sunshroom')<first('fumeshroom'));assert(first('fumeshroom')<first('squash'));assert(first('squash')<first('plantern'));assert(first('plantern')<first('cactus'));assert(first('cactus')<first('blover'));assert(first('blover')<first('cabbagepult'));
 for(const l of setup.design.levels){assert.equal(l.budget.sun,500);if(l.terrainMap.id==='pool')assert(!l.plantDeck.includes('cactus'));if(l.terrainMap.theme==='roof')assert(l.plantDeck.includes('cabbagepult'));}
});
check('营救解锁仍在获胜之后，单位与预算逐步成长，不把本关囚犯提前加入编组',()=>{
 for(const [i,l]of setup.design.levels.entries()){if(l.unlock){assert(!l.units.includes(l.unlock));if(i+1<40)assert(setup.design.levels[i+1].units.includes(l.unlock));}if(i)assert(l.compositionBudget>=setup.design.levels[i-1].compositionBudget);assert.equal(model.createScene(i).economySunflowers.length,5);}
 assert(campaign.recruits.every((r,i,a)=>!i||r.stage>a[i-1].stage));
});
check('教程保留三株场内守军，后续逐步扩展到七株，场外经济不消耗500阳光',()=>{
 const caps=setup.design.levels.map(l=>l.budget.maxPlants);assert.equal(caps[0],3);assert.equal(caps.at(-1),7);assert(caps.every((v,i)=>v>=3&&v<=7&&(!i||v>=caps[i-1])));
 const s=model.createScene(10);assert.equal(s.economy.spent,0);model.chooseDoctor(s,2);for(let n=0;n<60;n++)model.step(s,1);assert(s.economy.spent<=500);assert.equal(s.economy.earned,0);assert(s.plants.filter(p=>p.hp>0).length<=caps[10]);
});
check('夜间短程菇只布置在当前可形成有效火力的射位',()=>{
 const s=model.createScene(7);model.chooseDoctor(s,4);for(let n=0;n<60;n++)model.step(s,1);const short=s.plants.filter(p=>['puff','fumeshroom'].includes(p.type));assert(short.length>0);for(const p of short){const range=setup.design.plantCombat[p.type].range;assert(s.teams.some(t=>Math.round(t.row)===p.row&&t.col>=p.col&&t.col-p.col<range)||s.fences[p.row].col-p.col<range);}
});
check('受墙阻挡的守门枪不再挤掉同排真正有效的前线射手',()=>{
 const s=model.createScene(15);model.chooseDoctor(s,4);model.start(s);s.economy.nextDeploy=Infinity;const front=s.teams[0].members[0];s.teams.forEach(t=>t.members=[]);Object.assign(s.teams[0],{row:1,col:8,members:[front]});const guard=model.placePlant(s,'snow',{row:1,col:2}),gun=model.placePlant(s,'pea',{row:1,col:6});assert(guard&&gun);guard.roomGuard=true;s.ai.next=0;
 for(let n=0;n<100;n++)model.step(s,.05);assert.equal(gun.row,1);assert.equal(gun.path.length,0);assert(front.hp<front.maxHp,'a working gun must actually damage the visible opponent in its lane');assert.equal(s.ai.fire.barrierImpacts,0);
});
check('坚果与近战守门组不会因远行佯攻自行离开囚室，开门后才恢复机动',()=>{
 const s=model.createScene(4);model.chooseDoctor(s,4);model.start(s);s.economy.nextDeploy=Infinity;s.teams.forEach(t=>{t.row=4;t.col=8;});assert(model.placePlant(s,'pea',{row:4,col:6}));const guard=model.placePlant(s,'wallnut',{row:2,col:2});assert(guard);guard.roomGuard=true;s.ai.next=0;for(let t=0;t<5;t+=.05)model.step(s,.05);assert.equal(guard.row,2);assert.equal(guard.path.length,0);assert(s.ai.groups.some(g=>g.id===guard.id&&g.target.includes('囚室')));s.goal.open=true;for(let t=0;t<8;t+=.05)model.step(s,.05);assert(guard.row>2||guard.path.length>0);
});
check('放大后仍使用原格脚点，待命和静止攻击不再伪装成柔和模式冻结',()=>{
 const s=model.createScene(0),calls=[],ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{}}),renderer={drawBackground(){},drawPlant(p,v,opts){calls.push({kind:'plant',v,opts});},drawZombie(p,v,opts){calls.push({kind:'zombie',v,opts});}},paint=painterApi.createPainter(renderer,{},setup.design,units.units);s.teams[0].attack=.4;paint.paint(ctx,s);
 const zombie=calls.find(c=>c.kind==='zombie'&&c.v.attacking);assert(zombie);assert.equal(zombie.opts.reducedMotion,false);assert.equal(zombie.opts.stationary,true);assert(zombie.opts.scale>=.85&&zombie.opts.scale<1);
 const point=paint.point(2,8);assert.equal(point.x,engine.FIELD.gridLeft+8.5*engine.FIELD.columnWidth);assert.equal(point.y,engine.FIELD.rowTop+3*engine.FIELD.rowHeight-engine.FIELD.footInset);const g=painterApi.teamLayout(s)[0];assert.equal(painterApi.pickTeam(s,g.x+48,g.foot-60),0);
 calls.length=0;paint.paint(ctx,s,{reducedMotion:true});assert(calls.filter(c=>c.kind==='zombie').every(c=>c.opts.reducedMotion));
});
check('屋顶倭瓜从盆口起跳，按确定目标落地，花盆前沿仍在身体之后绘制',()=>{
 const s=model.createScene(30),position={row:1,col:4};assert(model.placeSupport(s,'flowerpot',position));const p=model.placePlant(s,'squash',position);assert(p);
 const calls=[],pot={width:64,height:40},ctx=new Proxy({globalAlpha:1,drawImage(im){if(im===pot)calls.push({kind:'pot'});}},{get:(o,k)=>k in o?o[k]:()=>{}}),renderer={drawBackground(){},drawPlant(){},drawZombie(){},actor(c,type,clip,time,x,foot){calls.push({kind:type,x,foot});}},paint=painterApi.createPainter(renderer,{'support:flowerpot':pot},setup.design,units.units),floor=paint.point(1,4).y;
 const draw=(state,elapsed)=>{calls.length=0;p.ability={state,elapsed,origin:{...position},target:{row:1,col:5.3}};paint.paint(ctx,s);const body=calls.findIndex(c=>c.kind==='squash');assert(body>=0);if(s.supports.length&&['idle','look','crouch'].includes(state))assert(calls.slice(body+1).some(c=>c.kind==='pot'),'the planted body must stay behind the foreground rim');if(['rising','falling'].includes(state))assert(calls.slice(0,body).some(c=>c.kind==='pot'),'the jumping body must render above its now-empty pot');return calls[body];};
 for(const state of ['idle','look','crouch'])assert.equal(draw(state,.1).foot,floor-22);
 const mid=draw('rising',.15);assert.equal(mid.foot,floor-11-55);assert(Math.abs(mid.x-paint.point(1,4.65).x)<1e-8);
 assert.equal(draw('falling',.1).foot,floor);assert.equal(draw('spent',.1).foot,floor);
 s.supports=[];assert.equal(draw('idle',0).foot,floor,'an unsupported ground fixture must not inherit a pot offset');
});
check('屋顶子弹与盆上喷口共同抬高，离膛后不读取射手位置或盆的存活状态',()=>{
 const s=model.createScene(30),shots=[],ctx=new Proxy({globalAlpha:1,ellipse(x,y,rx,ry){if(rx===6&&ry===6)shots.push({x,y});}},{get:(o,k)=>k in o?o[k]:()=>{}}),renderer={drawBackground(){},drawPlant(){},drawZombie(){}},paint=painterApi.createPainter(renderer,{},setup.design,units.units);
 s.projectiles=[{type:'pea',sourceId:'removed-source',row:1,col:6.5,originCol:6}];paint.paint(ctx,s);assert.equal(shots.length,1);assert.equal(shots[0].y,paint.point(1,6.5).y-22-57);
 shots.length=0;s.terrain=null;paint.paint(ctx,s);assert.equal(shots[0].y,paint.point(1,6.5).y-57);
});
check('屋顶原版材质覆盖完整十列五行，所有采样都在图片内且不移动逻辑格',()=>{
 const env=require('../game/battle-environment'),maps=require('../game/battle-map-data'),img={width:1400,height:600};
 for(const id of ['roof','roof-night']){const calls=[],ctx=new Proxy({globalAlpha:1,drawImage(...args){calls.push(args);}},{get:(o,k)=>k in o?o[k]:()=>{}});env.draw(ctx,maps.getMap(id),{'env:roof':img,'env:roof-night':img});const strips=calls.filter(a=>a.length===9&&a[5]>=180&&a[5]<980&&a[6]===172&&a[7]===2&&a[8]===480);assert.equal(strips.length,400);for(let i=0;i<400;i++){const a=strips[i];assert.equal(a[5],180+i*2);assert(a[1]>=0&&a[1]+a[3]<=1400);assert(a[2]>=0&&a[2]+a[4]<=600);}assert.equal(env.field.left,engine.FIELD.gridLeft);assert.equal(env.field.top,engine.FIELD.rowTop);assert.equal(env.field.height,engine.FIELD.rows*engine.FIELD.rowHeight);}
});
check('队员倒地保留原来的编队位置，幸存者不会突然补位跳格',()=>{
 const s=model.createScene(0),calls=[],ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{}}),renderer={drawBackground(){},drawPlant(){},drawZombie(c,v,o){calls.push({id:v.id,x:o.x,foot:o.foot,dead:o.dead});}},paint=painterApi.createPainter(renderer,{},setup.design,units.units);paint.paint(ctx,s);const victim=s.teams[0].members[0],survivor=s.teams[0].members[1],oldVictim=calls.find(c=>c.id===victim.id),oldSurvivor=calls.find(c=>c.id===survivor.id);victim.hp=0;s.dead.push({actor:victim,kind:'zombie',type:victim.type,row:s.teams[0].row,col:s.teams[0].col,age:.05,id:victim.id});calls.length=0;paint.paint(ctx,s);const dead=calls.find(c=>c.id===victim.id&&c.dead),alive=calls.find(c=>c.id===survivor.id&&!c.dead);assert.deepEqual([dead.x,dead.foot],[oldVictim.x,oldVictim.foot]);assert.deepEqual([alive.x,alive.foot],[oldSurvivor.x,oldSurvivor.foot]);
});
check('实际原生骨骼在静止待命与静止攻击时继续变化，柔和模式明确冻结',()=>{
 const box={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../game/assets-data.js'),'utf8'),box);const a=box.window.PVZ_ASSETS,pictures=Object.fromEntries(Object.entries(a.images).map(([id,im])=>[id,{id,width:im.width,height:im.height}])),r=require('../game/renderer').createRenderer(a,pictures),z={type:'normal',row:1,x:800,hp:210,maxHp:210,age:2,hit:0};let output=[];
 const ctx=new Proxy({globalAlpha:1,transform(...v){output.push(['transform',...v]);},drawImage(im,...v){output.push([im.id,...v]);}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const pose=(time,attacking,reducedMotion)=>{output=[];r.drawZombie(ctx,{...z,attacking},{time,stationary:true,reducedMotion});return JSON.stringify(output);};
 assert.notEqual(pose(1,false,false),pose(1.3,false,false));assert.notEqual(pose(1,true,false),pose(1.3,true,false));assert.equal(pose(1,true,true),pose(1.3,true,true));assert.notEqual(pose(1,true,false),pose(1,false,false));
});
console.log(JSON.stringify({passed,scope:'classic-inspired teaching order, roster gates, paid gradual field capacity, effective short-range and guarded firing, enlarged geometry and native idle/attack animation; no claim of full original roster combat implementation'}));
