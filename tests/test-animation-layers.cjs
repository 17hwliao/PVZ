const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRenderer,plantSamples,damageSamples}=require('../game/renderer.js'),{Battle,PLANTS,UNITS}=require('../game/engine.js');
const root=path.resolve(__dirname,'../game'),box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'assets-data.js'),'utf8'),box);const assets=box.window.PVZ_ASSETS,pictures={};
for(const [id,info]of Object.entries(assets.images)){const p=fs.readFileSync(path.join(root,info.path));pictures[id]={id,width:p.readUInt32BE(16),height:p.readUInt32BE(20)};}
for(const [id,info]of Object.entries(assets.storyArt)){const p=fs.readFileSync(path.join(root,info.file));pictures['story:'+id]={id,width:p.readUInt32BE(16),height:p.readUInt32BE(20)};}
let calls=[],transforms=[];const ctx=new Proxy({globalAlpha:1,transform(...args){assert(args.every(Number.isFinite));transforms.push(args);},drawImage(...args){assert(args.slice(1).every(Number.isFinite),'Non-finite sprite rectangle');calls.push(args);}},{get:(o,k)=>k in o?o[k]:(...args)=>{assert(args.every(x=>typeof x!=='number'||Number.isFinite(x)),'Non-finite transform');}}),r=createRenderer(assets,pictures,null);
function drawPlant(p,options){calls=[];r.drawPlant(ctx,p,options);return calls;}
let passed=0;function check(name,fn){fn();passed++;console.log('PASS '+name);}
check('豌豆与寒冰完整攻击周期、预兆和受击中始终存在茎与前后叶，原版和新画风均修复',()=>{
 for(const style of ['classic','story']){r.setArtStyle(style);for(const type of ['pea','snow'])for(let i=0;i<=60;i++){
  const p={type,row:0,x:200,hp:180,maxHp:180,shot:0,attack:.55*(1-i/60),hit:i%2?.14:0};const seen=drawPlant(p,{time:i/60});for(const part of ['STALK_BOTTOM','STALK_TOP','BACKLEAF','FRONTLEAF'])assert(seen.some(c=>c[0].id==='IMAGE_REANIM_PEASHOOTER_'+part),`${style} ${type} lost ${part} at ${i}`);
 }}
});
check('向日葵整个idle循环跳过控制帧，头部与茎叶不会周期性消失',()=>{
 for(const style of ['classic','story']){r.setArtStyle(style);for(let i=0;i<90;i++){const seen=drawPlant({type:'sunflower',row:0,x:200,hp:130,maxHp:130,shot:6,attack:0},{time:i/12});assert(seen.some(c=>c[0].id==='IMAGE_REANIM_PEASHOOTER_STALK_BOTTOM'));assert(seen.some(c=>c[0].id==='sunflower-face-v2'||c[0].id==='IMAGE_REANIM_SUNFLOWER_HEAD'));}}
});
check('试绘面部每次只绘制一组完整贴图，不叠旧嘴、眉、冰晶、下巴、眼睛和头发',()=>{
 r.setArtStyle('story');for(const type of Object.keys(PLANTS)){const p={type,row:0,x:200,hp:PLANTS[type].hp,maxHp:PLANTS[type].hp,shot:0,attack:.3,hit:0};const seen=drawPlant(p,{time:.2,high:true});
  const forbidden=type==='pea'?/PEASHOOTER_(HEAD|MOUTH|EYEBROW|HEADLEAF|BLINK)/:type==='snow'?/SNOWPEA_(HEAD|MOUTH|CRYSTALS|BLINK)/:type==='cactus'?/CACTUS_(BODY1|MOUTH|LIPS|BLINK)/:type==='sunflower'?/SUNFLOWER_(HEAD|BLINK)/:type==='chomper'?/CHOMPER_(TOPJAW|UNDERJAW|BOTTOMLIP|INSIDEMOUTH|TONGUE)/:/WALLNUT_(BODY|CRACKED)/;
  assert(!seen.some(c=>forbidden.test(c[0].id)),type+' old face layer remains');
 }
 for(const type of Object.keys(UNITS)){calls=[];r.drawZombie(ctx,{type,maxHp:UNITS[type].hp,hp:UNITS[type].hp,row:0,x:200,age:.3,attacking:true,hit:0},{time:.3});assert.equal(calls.filter(c=>/-head-v2$/.test(c[0].id)).length,1,type+' full face count');assert(!calls.some(c=>/ZOMBIE_(?:BALLOON_|DIGGER_)?(?:HEAD|JAW|TONGUE|HAIR)/.test(c[0].id)),type+' old face remains');}
});
check('缺失新图时保留完整原版面部，不因清理重影而留下无脸角色',()=>{
 r.setArtStyle('story');for(const name of ['snow-head-v2','pea-head-v2','civilian-head-v2','balloon-head-v2','digger-head-v2','sunflower-face-v2','cactus-face-v2','chomper-jaws-v2']){const im=pictures['story:'+name];delete pictures['story:'+name];
  if(name==='snow-head-v2'){const seen=drawPlant({type:'snow',row:0,x:200,hp:180,maxHp:180,shot:0,attack:.3},{time:.2});assert(seen.some(c=>c[0].id==='IMAGE_REANIM_SNOWPEA_MOUTH'));}
  if(name==='civilian-head-v2'){calls=[];r.drawZombie(ctx,{type:'normal',hp:210,maxHp:210,row:0,x:200,age:.2},{time:.2});assert(calls.some(c=>c[0].id==='IMAGE_REANIM_ZOMBIE_HEAD'));assert(calls.some(c=>c[0].id==='IMAGE_REANIM_ZOMBIE_JAW'));}
  pictures['story:'+name]=im;
 }
});
check('大嘴花任一面部图缺失时整组回退，不混用两套牙齿和口腔',()=>{
 r.setArtStyle('story');for(const missing of ['chomper-jaws-v2','chomper-interior-v2']){const im=pictures['story:'+missing];delete pictures['story:'+missing];const seen=drawPlant({type:'chomper',row:0,x:200,hp:240,maxHp:240,shot:0,attack:.3,windup:0},{time:.2});assert(!seen.some(c=>/^chomper-/.test(c[0].id)));for(const id of ['TOPJAW','UNDERJAW','INSIDEMOUTH','TONGUE'])assert(seen.some(c=>c[0].id==='IMAGE_REANIM_CHOMPER_'+id));pictures['story:'+missing]=im;}
});
check('坚果和等待目标的大嘴花不会被冷却值0误判成攻击并冻结空闲动作',()=>{
 for(const type of ['wallnut','chomper']){const p={type,row:0,x:200,hp:PLANTS[type].hp,maxHp:PLANTS[type].hp,shot:0,attack:0,windup:0};transforms=[];drawPlant(p,{time:5});const first=JSON.stringify(transforms);transforms=[];drawPlant(p,{time:6});assert.notEqual(JSON.stringify(transforms),first,type+' idle frozen');}
});
check('六种植物与五种僵尸的攻击、受伤、爆裂、出土、退场全周期均输出有效绘制',()=>{
 for(const style of ['classic','story']){r.setArtStyle(style);for(const [type,p]of Object.entries(PLANTS))for(const sample of plantSamples(type,p.hp))for(let i=0;i<=40;i++){const time=i/12,dead=sample.plant.hp<=0;if(dead&&time>=.65)break;const plant={...sample.plant};if(plant.attack>0)plant.attack=Math.max(0,plant.attack-time);if(plant.windup>0)plant.windup=Math.max(0,plant.windup-time);assert(drawPlant(plant,{time,dead}).length>0,style+' '+type+' '+sample.name);}
 for(const [type,z]of Object.entries(UNITS))for(const sample of damageSamples(type,z.hp))for(let i=0;i<=80;i++){const time=i/16,zombie={...sample.zombie},dead=zombie.hp<=0;if(dead&&time>3.3)break;if(zombie.pop>0)zombie.pop=Math.max(0,.72-time);if(zombie.emerging>0)zombie.emerging=Math.max(0,1.2-time);calls=[];r.drawZombie(ctx,zombie,{time,dead});assert(calls.length>0,style+' '+type+' '+sample.name);}}
});
check('仙人掌追踪空中目标时在原版rise轨道内逐步抬升并平稳收回，剧情躯干不混用旧的拼接段',()=>{
 for(const style of ['classic','story']){r.setArtStyle(style);const p={type:'cactus',row:0,x:200,hp:180,maxHp:180,shot:2,attack:0,hit:0};let heights=[];
  for(const [time,high]of [[0,false],[.01,true],[.25,true],[.5,true],[.51,false],[.75,false],[1,false]]){transforms=[];const seen=drawPlant(p,{time,high});const face=seen.findIndex(c=>c[0].id===(style==='story'?'cactus-face-v2':'IMAGE_REANIM_CACTUS_BODY1'));assert(face>=0);if(style==='story')assert(!seen.some(c=>/CACTUS_(BODY2|BODY_OVERLAY)/.test(c[0].id)||c[0].id==='IMAGE_REANIM_CACTUS_BODY3'&&c[3]>12&&!(c[1]===6&&c[2]===34&&c[3]===52&&c[4]===19)),'old cactus trunk leaked');heights.push(Math.min(...transforms.map(m=>m[5])));}
  assert(heights[1]>heights[3],'height must not instantly jump to tall pose');assert(heights[2]<heights[1]&&heights[2]>heights[3],'rise must contain intermediate poses');assert(heights[5]>heights[4]&&heights[5]<heights[6],'lower must contain intermediate poses');
 }
});
check('实战死亡承接高仙人掌与射手的最后骨骼姿态，独立茎叶时钟不重置',()=>{
 for(const style of ['classic','story']){r.setArtStyle(style);for(const type of ['cactus','pea','snow']){const b=new Battle(),p=b.createPlant(type,0,220);p.attack=.3;p.shot=.2;
  transforms=[];r.drawPlant(ctx,p,{time:5,high:true});const before=structuredClone(transforms);b.damagePlant(p,9999);assert.equal(b.plantRemains.length,1);assert.equal(b.plantRemains[0].poseSource,p);
  transforms=[];r.drawPlant(ctx,b.plantRemains[0],{time:0,dead:true});assert.deepEqual(transforms,before,style+' '+type+' reset on death');
 }}
});
check('气球空中及爆裂途中死亡承接可见高度和骨骼，半秒内落地且仅一张脸',()=>{
 for(const style of ['classic','story'])for(const pop of [0,.65,.4,.1]){r.setArtStyle(style);const b=new Battle(0,['balloon']);b.energy=1000;b.deploy('balloon',4);const z=b.zombies[0];z.airborne=pop===0;z.pop=pop;z.age=4;
  const moves=[];ctx.translate=(...args)=>moves.push(args);transforms=[];calls=[];r.drawZombie(ctx,z,{time:4});const beforeRoot=moves[0],beforeActor=moves[1];b.damageZombie(z,9999,{antiAir:true});const corpse=b.corpses[0];assert.equal(corpse.poseSource,z);
  moves.length=0;calls=[];r.drawZombie(ctx,corpse,{time:0,dead:true});assert.equal(moves[0][1],beforeRoot[1]);assert.equal(moves[1][1],beforeActor[1]);
  if(style==='story')assert.equal(calls.filter(c=>c[0].id==='balloon-head-v2').length,1);
  moves.length=0;r.drawZombie(ctx,corpse,{time:.5,dead:true});assert.equal(moves[0][1],636,'fifth-lane corpse must settle onto its own ground line');
 }
 delete ctx.translate;
});
check('退场后的受击亮闪会消退；无绘制缓存和小车退场也输出有效坐标',()=>{
 const b=new Battle(),p=b.createPlant('cactus',0,220);b.damagePlant(p,9999);ctx.filter='none';r.drawPlant(ctx,b.plantRemains[0],{time:.2,dead:true});assert.equal(ctx.filter,'none');
 for(const type of Object.keys(UNITS)){const z={type,row:4,x:940,hp:0,maxHp:UNITS[type].hp,age:0,hit:.18,duration:.55,source:'mower',airborne:type==='balloon'};calls=[];ctx.filter='none';r.drawZombie(ctx,z,{time:.2,dead:true});assert(calls.length>0);assert.equal(ctx.filter,'none');}
});
check('全部兵种重伤退场承接外层倾斜和起伏，不在死亡首帧突然扶正',()=>{
 for(const type of Object.keys(UNITS)){const b=new Battle(0,Object.keys(UNITS));b.energy=1000;b.deploy(type,2);const z=b.zombies[0];Object.assign(z,{hp:42,age:4.2,airborne:false,underground:false,emerging:0,pop:0,hit:.18,attacking:true});const roots=[],rotations=[];ctx.translate=(...args)=>roots.push(args);ctx.rotate=value=>rotations.push(value);
  r.drawZombie(ctx,z,{time:z.age});const before=[...roots[0]],lean=rotations[0];b.damageZombie(z,9999);roots.length=0;rotations.length=0;r.drawZombie(ctx,b.corpses[0],{time:0,dead:true});assert.deepEqual(roots[0],before,type+' root reset');assert.equal(rotations[0],lean,type+' lean reset');
 }
 delete ctx.translate;delete ctx.rotate;
});
check('原版角色模式倒地时头部和下颌随躯干完整落下，不丢失外部分离头轨道',()=>{
 r.setArtStyle('classic');for(const [type,info]of Object.entries(UNITS))for(const time of [0,.15,.5,1.4,2.5]){calls=[];r.drawZombie(ctx,{type,row:0,x:200,hp:0,maxHp:info.hp,age:time,duration:3.8},{time,dead:true});const prefix=type==='balloon'?'IMAGE_REANIM_ZOMBIE_BALLOON':type==='digger'?'IMAGE_REANIM_ZOMBIE_DIGGER':'IMAGE_REANIM_ZOMBIE';assert(calls.some(c=>c[0].id===prefix+'_HEAD'),type+' classic head missing');assert(calls.some(c=>c[0].id===prefix+'_JAW'),type+' classic jaw missing');}
});
console.log(JSON.stringify({passed,scope:'real animation tracks and complete frame cycles, drawing calls inspected'}));
