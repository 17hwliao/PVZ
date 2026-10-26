const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const m=require('../game/rescue-design-model.js'),d=require('../game/rescue-design-data.js'),extra=require('../game/rescue-plant-assets.js');
const advance=(s,time)=>{for(let n=0;n<time-1e-8;n+=.05)m.step(s,Math.min(.05,time-n));};
const preparedScene=(level=0)=>{const s=m.createScene(level);m.chooseDoctor(s,2);return s;};
const isolated=()=>{const s=preparedScene(6);m.start(s);s.ai.next=s.economy.nextDeploy=Infinity;s.plants=[];for(const t of s.teams){t.row=4;t.col=9;}return s;};
const plant=(type,row=2,col=4)=>({id:30,type,row,col,hp:d.plantCombat[type].hp,maxHp:d.plantCombat[type].hp,path:[],moving:false,facing:1,attack:0,hit:0,cooldown:0,lastMove:0,ability:{state:'idle',elapsed:0},cactusHeight:0});
const unit=(type,id)=>({id,type,hp:type==='bucket'?650:type==='balloon'?180:210,maxHp:type==='bucket'?650:type==='balloon'?180:210,hit:0,airborne:type==='balloon',pop:0});
const team=(s,row=2,col=5.2,members)=>{Object.assign(s.teams[0],{row,col,path:[],moving:false});if(members)s.teams[0].members=members;return s.teams[0];};
const until=(s,condition,limit=5)=>{for(let t=0;t<limit&&!condition();t+=.025)m.step(s,.025);assert(condition(),'Timed out waiting for an ability phase');};
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
check('原生倭瓜资源完整、有来源哈希，六种动作片段和四组图层可用',()=>{
 const provenance=require('../game/assets/rescue-plants/provenance.json');assert.equal(provenance.entries.length,4);
 for(const item of provenance.entries)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../game',item.file))).digest('hex'),item.sha256);
 for(const clip of ['idle','lookleft','lookright','jumpup','jumpdown','blink'])assert(extra.actors.squash.clips[clip]);assert.equal(extra.actors.squash.tracks.length,4);
 for(const track of extra.actors.squash.tracks)for(const frame of track.frames)if(frame.i)assert(extra.images[frame.i]);
});
check('倭瓜50阳光、30秒种植冷却，进入三处关卡卡组；准备期真实付费而非免费生成',()=>{
 assert.deepEqual(d.plantCards.squash,{cost:50,recharge:30});assert.deepEqual(d.levels.flatMap((l,i)=>l.plantDeck.includes('squash')?[i]:[]),[2,3,6]);
 const s=preparedScene(2);s.economy.nextDeploy=Infinity;assert(m.placePlant(s,'squash',{row:0,col:4}));assert.equal(s.economy.sun,450);m.start(s);assert(!m.placePlant(s,'squash',{row:4,col:4}));assert.equal(s.economy.cooldowns.squash,30);
 const fresh=preparedScene(2);assert.equal(fresh.economy.cooldowns.squash,0);assert(!fresh.plants.some(p=>p.type==='squash'));
});
check('倭瓜依次察看、蓄力、升空、落砸、压扁退场；伤害只在落砸结算一次',()=>{
 const s=isolated(),p=plant('squash'),t=team(s);s.plants=[p];const states=[],hp=t.members.map(m=>m.hp);
 for(let i=0;i<180;i++){m.step(s,.025);const state=p.ability.state;if(states.at(-1)!==state)states.push(state);if(!p.ability.struck)assert.deepEqual(t.members.map(m=>m.hp),hp);}
 assert.deepEqual(states,['look','crouch','rising','falling','spent']);assert(t.members.every(m=>m.hp===0));assert.equal(s.dead.filter(z=>z.kind==='zombie').length,0); // Corpse lifetime has elapsed.
 assert.equal(s.events.filter(e=>e.text.includes('只结算这一次')).length,1);assert.equal(p.hp,0);assert(p.consumed);assert.equal(s.projectiles.length,0);assert(!s.dead.some(z=>z.kind==='plant'));
});
check('一次砸击覆盖同一落点的所有地面成员，不误伤邻行、空中气球、墓碑或博士',()=>{
 const s=isolated(),p=plant('squash'),t=team(s,2,5.2,[unit('bucket',20),unit('normal',21),unit('balloon',22)]);s.plants=[p];Object.assign(s.teams[1],{row:3,col:5.2});const other=s.teams[1].members.map(m=>m.hp),cache=s.caches[0];Object.assign(cache,{row:2,col:5.2,claimed:true});const hp=cache.hp;
 until(s,()=>p.ability.struck);assert.equal(t.members[0].hp,0);assert.equal(t.members[1].hp,0);assert.equal(t.members[2].hp,180);assert.deepEqual(s.teams[1].members.map(m=>m.hp),other);assert.equal(cache.hp,hp);assert.equal(s.doctor.hits,10);assert.equal(s.dead.length,2);assert(s.dead.every(z=>z.crushed));
});
check('倭瓜不因气球、邻行队伍或补给碑单独起跳；也不产生任何追踪弹',()=>{
 for(const mode of ['air','other-lane','cache']){const s=isolated(),p=plant('squash');s.plants=[p];if(mode==='air')team(s,2,5,[unit('balloon',20)]);if(mode==='other-lane')team(s,3,4);if(mode==='cache')Object.assign(s.caches[0],{row:2,col:5,claimed:true});advance(s,3);assert.equal(p.ability.state,'idle');assert.equal(s.projectiles.length,0);assert.equal(s.caches[0].hp,180);}
});
check('倭瓜起跳后落点锁定；收到察看预兆立即撤离可令它扑空，不能无限重新锁人',()=>{
 const s=isolated(),p=plant('squash'),t=team(s,2,5);s.plants=[p];advance(s,.05);assert.equal(p.ability.state,'look');assert(m.command(s,t.id,null,'撤回'));
 until(s,()=>p.ability.state==='rising');const target={...p.ability.target};until(s,()=>p.ability.struck);assert.deepEqual(p.ability.target,target);assert(t.members.every(m=>m.hp===210));assert(t.col>target.col+.42);
});
check('倭瓜升空期间离开地面阻挡和近战判定，AI不会把一次性伏击调成换行追兵',()=>{
 const s=isolated(),p=plant('squash');s.plants=[p];team(s);until(s,()=>p.ability.state==='rising');const hp=p.hp;s.teams[0].row=2;s.teams[0].col=4;s.teams[0].attackTimer=0;m.step(s,.025);assert.equal(p.hp,hp);
 s.ai.next=s.time;advance(s,.05);assert.equal(p.row,2);assert.equal(p.col,4);assert.equal(p.path.length,0);
});
check('大嘴花有0.7秒咬合预兆，吞掉一名完整铁桶成员后咀嚼40秒，不按周期反复扣血',()=>{
 const s=isolated(),p=plant('chomper'),t=team(s,2,5.1,[unit('bucket',20),unit('normal',21),unit('normal',22)]);s.plants=[p];advance(s,.6);assert(t.members.every(m=>m.hp===m.maxHp));assert(p.windup>0);
 until(s,()=>p.ability.state==='digest');assert.equal(t.members[0].hp,0);assert(t.members[0].swallowed);assert.equal(s.dead.length,0);assert.equal(p.animation.clip,'chew');advance(s,39.9);assert.equal(p.ability.state,'digest');assert.equal(t.members[1].hp,210);assert.equal(t.members[2].hp,210);advance(s,.15);assert.equal(p.ability.state,'swallow');assert.equal(p.animation.clip,'swallow');
});
check('大嘴花咬合瞬间重新检查同行近身目标，目标撤出会空咬；空中气球不会触发吞食',()=>{
 const boundary=isolated(),edge=plant('chomper');boundary.plants=[edge];team(boundary,2,5.2);advance(boundary,.05);assert.equal(edge.ability.state,'bite','1.2-cell boundary must be inclusive despite floating-point subtraction');
 const s=isolated(),p=plant('chomper'),t=team(s,2,5.1);s.plants=[p];advance(s,.05);m.command(s,t.id,null,'撤回');advance(s,1.2);assert(t.members.every(m=>m.hp===210));assert.equal(p.ability.state,'idle');
 const air=isolated(),jaw=plant('chomper');air.plants=[jaw];team(air,2,5.1,[unit('balloon',20)]);advance(air,3);assert.equal(jaw.ability.state,'idle');assert.equal(air.teams[0].members[0].hp,180);
});
check('普通豌豆与冰豌豆按经典单发方式直射，跳过飞行成员且不跨行寻敌',()=>{
 for(const type of ['pea','snow']){const s=isolated(),p=plant(type,1,6),t=team(s,1,8,[unit('balloon',20),unit('normal',21)]);s.plants=[p];advance(s,1);assert.equal(t.members[0].hp,180);assert.equal(t.members[1].hp,190);assert.equal(p.cooldown>0,true);assert.equal(t.slow>0,type==='snow');}
 const s=isolated();s.plants=[plant('pea',1,6)];team(s,1,8,[unit('balloon',20)]);advance(s,3);assert(s.projectiles.every(shot=>!shot.airborne&&shot.lane===1));assert(s.fences[1].hp<600);assert.equal(s.teams[0].members[0].hp,180);
});
check('仙人掌先升高再发对空尖刺，尖刺穿过地面队员刺破气球，落地后再受地面火力',()=>{
 const s=isolated(),p=plant('cactus',1,6),t=team(s,1,7.5,[unit('normal',20),unit('balloon',21)]);s.plants=[p];advance(s,.3);assert.equal(s.projectiles.length,0);assert(p.cactusHeight>0&&p.cactusHeight<1);advance(s,1.4);
 assert.equal(t.members[0].hp,210);assert.equal(t.members[1].hp,160);assert.equal(t.members[1].airborne,false);assert(t.members[1].pop>0);advance(s,1.7);assert.equal(p.cactusHeight,0);assert.equal(p.cactusHigh,false);assert(t.members[0].hp<210);assert.equal(t.members[1].pop,0);
});
check('向日葵与坚果保持非攻击职责；特殊动作在暂停、准备期和结算后不会偷跑',()=>{
 for(const type of ['sunflower','wallnut']){const s=isolated(),p=plant(type),t=team(s,2,5.1);s.plants=[p];const hp=t.members.map(m=>m.hp);advance(s,4);assert.deepEqual(t.members.map(m=>m.hp),hp);assert.equal(s.projectiles.length,0);}
 const s=isolated(),p=plant('squash');s.plants=[p];team(s);advance(s,.5);s.paused=true;const snapshot=JSON.stringify(s);advance(s,3);assert.equal(JSON.stringify(s),snapshot);s.paused=false;s.status='won';advance(s,3);assert.equal(JSON.stringify(s),snapshot.replace('"paused":true','"paused":false').replace('"status":"battle"','"status":"won"'));
});
check('生产渲染器识别真实咀嚼和吞咽动画，不把整个消化期画成重复张嘴',()=>{
 const box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game/assets-data.js'),'utf8'),box);const assets=box.window.PVZ_ASSETS,pictures={};Object.assign(assets.actors,extra.actors);Object.assign(assets.images,extra.images);
 for(const [id,info]of Object.entries(assets.images)){const bytes=fs.readFileSync(path.join(__dirname,'../game',info.path));pictures[id]={id,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};}
 let transforms=[];const c=new Proxy({globalAlpha:1,transform(...values){assert(values.every(Number.isFinite));transforms.push(values);}},{get:(o,k)=>k in o?o[k]:(...args)=>{assert(args.every(v=>typeof v!=='number'||Number.isFinite(v)));}}),renderer=require('../game/renderer.js').createRenderer(assets,pictures,null);renderer.setArtStyle('classic');
 const pose=clip=>{transforms=[];renderer.drawPlant(c,{type:'chomper',hp:240,maxHp:240,row:2,x:300,shot:2,attack:0,animation:{clip,time:.3,once:clip!=='chew'}},{time:1});return JSON.stringify(transforms);};assert.notEqual(pose('chew'),pose('bite'));assert.notEqual(pose('swallow'),pose('chew'));
 for(const clip of ['idle','lookleft','lookright','jumpup','jumpdown'])for(let i=0;i<30;i++)renderer.actor(c,'squash',clip,i/30,400,400,.93,'normal',{once:clip!=='idle'});
});
console.log(JSON.stringify({passed,scope:'classic rescue plant attacks and native animation lifecycle; not all 49 almanac combat mechanics'}));
