const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRenderer,plantSamples,damageSamples}=require('../game/renderer.js'),{PLANTS,UNITS}=require('../game/engine.js');
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
console.log(JSON.stringify({passed,scope:'real animation tracks and complete frame cycles, drawing calls inspected'}));
