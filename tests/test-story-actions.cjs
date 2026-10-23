const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Battle,STORY_ACTIONS}=require('../game/engine.js');
const {boot,enter}=require('./test-campaign-ui.cjs');
const {createRenderer}=require('../game/renderer.js');
let passed=0;function check(name,fn){fn();passed++;console.log('PASS '+name);}
function near(b,type,row,x){b.energy=1000;b.cooldowns[type]=0;assert(b.deploy(type,row).ok);const z=b.zombies.at(-1);z.x=x;return z;}
check('战地行动要求同路地面接应，空中、地下、出土和交战单位不能远程完成',()=>{
 const b=new Battle(1,['normal','balloon','digger']);b.plants=[];const a=b.storyActions[0];
 near(b,'balloon',a.row,a.x);near(b,'digger',a.row,a.x);near(b,'normal',0,a.x);
 for(let i=0;i<20;i++)b.step(.05);assert.equal(a.progress,0);
 const z=near(b,'normal',a.row,a.x);b.plants=[b.createPlant('wallnut',a.row,a.x-30)];b.step(.1);assert(z.attacking);assert.equal(a.progress,0);
 b.plants=[];z.emerging=1.2;b.step(.1);assert.equal(a.progress,0);
});
check('接应累计2秒只奖一次，暂停冻结；接应囚室不提前解锁，获胜后正式带走',()=>{
 const b=new Battle(1);b.plants=[];const a=b.storyActions[0];near(b,'normal',a.row,a.x+30);
 for(let i=0;i<10;i++)b.step(.1);const before=a.progress;b.paused=true;b.step(.1);assert.equal(a.progress,before);b.paused=false;
 const energy=b.energy;for(let i=0;i<11;i++)b.step(.1);assert(a.completed);assert(a.early);assert(!b.unlocked.has('cone'));assert(Math.abs(b.energy-energy-50-4.95)<1e-6);
 for(let i=0;i<10;i++)b.step(.1);assert.equal(b.drainEvents().filter(e=>e.type==='storyAction').length,1);
 b.entered=1;b.evaluate();assert(b.unlocked.has('cone'));assert.equal(b.status,'won');
});
check('保留原胜负契约，其他路线获胜也完成战后救援，不额外发提前接应奖励',()=>{
 const b=new Battle(4);const energy=b.energy;b.mowers[0].state='spent';b.mowers[4].state='spent';b.evaluate();assert.equal(b.status,'won');assert(b.unlocked.has('balloon'));assert(b.storyActions[0].completed);assert(!b.storyActions[0].early);assert.equal(b.energy,energy);
 const c=new Battle(1);for(const t of c.tombs)c.damageTomb(t.row,1000);c.entered=1;c.evaluate();assert.equal(c.status,'lost');assert(!c.unlocked.has('cone'));
});
check('食物与造谣档案有实际一次性奖励，各关实例不共享行动状态',()=>{
 for(const level of [0,6]){const b=new Battle(level);b.plants=[];const a=b.storyActions[0];near(b,'normal',a.row,a.x+30);for(let i=0;i<21;i++)b.step(.1);assert(a.completed);assert(b.drainEvents().some(e=>e.type==='storyAction'&&e.energy===40));assert(!new Battle(level).storyActions[0].completed);assert(!STORY_ACTIONS[level][0].completed);}
});
check('新增美术是可用透明PNG，裁图区域不越界；原版动画绑定保留',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game/assets-data.js'),'utf8'),c);const a=c.window.PVZ_ASSETS;assert.equal(Object.keys(a.storyArt).length,12);
 for(const spec of Object.values(a.storyArt)){const p=fs.readFileSync(path.join(__dirname,'../game',spec.file));assert.equal(p.subarray(1,4).toString(),'PNG');assert.equal(p[25],6);const w=p.readUInt32BE(16),h=p.readUInt32BE(20);for(const [x,y,cw,ch]of spec.bounds)assert(x>=0&&y>=0&&cw>0&&ch>0&&x+cw<=w&&y+ch<=h);}
 for(const key of ['zombie','pea','snow','wallnut','balloon','digger'])assert(a.actors[key].tracks.length>0);
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../game/assets/story-art/provenance.json'),'utf8'));for(const spec of Object.values(a.storyArt)){const record=manifest.assets.find(r=>r.file===spec.file);assert(record,'Missing art provenance');assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../game',spec.file))).digest('hex'),record.sha256);if(/head-v2|face-v2/.test(spec.file))assert.equal(spec.bounds.length,3);}
});
check('新头部沿原动画变换绘制，坚果按伤势换图，切回原版与缺图回退都可用',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game/assets-data.js'),'utf8'),c);const a=c.window.PVZ_ASSETS,pictures={};
 for(const [id,info]of Object.entries(a.images)){const png=fs.readFileSync(path.join(__dirname,'../game',info.path));pictures[id]={id,width:png.readUInt32BE(16),height:png.readUInt32BE(20)};}
 for(const [id,info]of Object.entries(a.storyArt)){const png=fs.readFileSync(path.join(__dirname,'../game',info.file));pictures['story:'+id]={id,width:png.readUInt32BE(16),height:png.readUInt32BE(20)};}
 const calls=[],ctx=new Proxy({globalAlpha:1,drawImage(...args){calls.push(args);}},{get:(o,k)=>k in o?o[k]:()=>{}}),r=createRenderer(a,pictures,null),p={type:'wallnut',row:0,x:220,maxHp:480,hp:80,hit:0,attack:0,shot:0};
 r.drawPlant(ctx,p,{time:1});assert(calls.some(x=>x[0].id==='guard-wallnut'&&x[1]===1515));
 calls.length=0;r.setArtStyle('classic');r.drawPlant(ctx,p,{time:1});assert(calls.some(x=>x[0].id==='IMAGE_REANIM_WALLNUT_CRACKED2'));assert(!calls.some(x=>x[0].id==='guard-wallnut'));
 calls.length=0;r.setArtStyle('story');delete pictures['story:guard-wallnut'];r.drawPlant(ctx,p,{time:1});assert(calls.some(x=>x[0].id==='IMAGE_REANIM_WALLNUT_CRACKED2'));
});
(async()=>{let t;try{
 t=await boot({saved:{version:2,unlocked:['normal'],completed:[],highest:0,prologue:{version:2,status:'completed'}}});assert(t.$('dialogBody').textContent.includes('战地行动：第 3 行取回饭盒'));enter(t);t.$('menu').click();t.click('设置与档案');const energy=t.$('energy').textContent;
 for(const key of ['classic','story']){const button=t.$('dialogBody').querySelector(`[data-character-art=${key}]`);button.click();for(let i=0;i<10;i++)t.frame();assert.equal(t.$('energy').textContent,energy);assert.equal(t.stored().characterArt,key);assert.equal(button.getAttribute('aria-pressed'),'true');}
 passed++;console.log('PASS 战前说明展示真实行动，角色画风可保存且切换期间实战保持暂停');
 assert.equal(t.$('arena').dataset.mechanics,'true');assert(t.$('fieldStatus').textContent.includes('取回饭盒'));
 t.d.window.close();t=await boot({failStoryArt:true,autoStart:false});assert(t.$('loading').hidden);t.$('homeSettings').click();assert(t.$('dialogBody').textContent.includes('部分角色素材未载入'));t.click('返回');t.$('homeContinue').click();t.$('prologueSkip').click();enter(t);assert.equal(t.$('arena').dataset.phase,'battle');passed++;console.log('PASS 试绘资源失败明确提示并回退，仍能完成选卡和开战');
 console.log(JSON.stringify({passed}));
}finally{t?.d.window.close();}})();
