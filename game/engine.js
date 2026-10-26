(function(root){
'use strict';
const BALANCE_VERSION='0.4.0';
const UNITS={normal:{name:'普通僵尸',cost:50,hp:210,speed:21,damage:46,cooldown:3},cone:{name:'路障僵尸',cost:100,hp:430,speed:19,damage:46,cooldown:6},bucket:{name:'铁桶僵尸',cost:150,hp:650,speed:17,damage:46,cooldown:9},balloon:{name:'气球僵尸',cost:125,hp:180,speed:22,damage:46,cooldown:10},digger:{name:'矿工僵尸',cost:175,hp:240,speed:22,damage:46,cooldown:12}};
const PLANTS={
 pea:{name:'豌豆射手',role:'远程压制',hp:180,damage:25,interval:2.35,description:'喷口蓄力后发射豌豆；由同行地面同胞挡弹。'},
 snow:{name:'寒冰射手',role:'减速控制',hp:180,damage:22,interval:2.9,description:'寒冰命中刷新减速，不叠乘；护具不能免除减速。'},
 wallnut:{name:'坚果守卫',role:'阻路掩护',hp:480,damage:0,interval:0,description:'没有远程火力；受伤后逐级开裂，为后排争取时间。'},
 sunflower:{name:'补给向日葵',role:'植物支援',hp:130,damage:0,interval:6,description:'每6秒恢复同行180范围内其他存活植物18耐久，不能复活或修复自身。'},
 cactus:{name:'仙人掌哨兵',role:'地空切换',hp:180,damage:20,interval:2.6,description:'优先瞄准同行空中目标；一次对空命中使气球落地。'},
 chomper:{name:'大嘴花看守',role:'近身伏击',hp:240,damage:90,interval:4.5,description:'地面同胞进入前方95范围后蓄力0.45秒咬击，随后休息；不能攻击空中或地下。'}
};
const MODES={
 breakthrough:{name:'正面突破',brief:'稀疏射手，学习前排挡弹与两路推进。'},
 rescue:{name:'囚室救援',brief:'坚果掩护后排，向日葵支援同路守卫；获胜后打开路障囚室。'},
 evacuation:{name:'撤离掩护',brief:'18秒和32秒各有一名植物增援；选择先破一路或分兵消耗小车。'},
 supply:{name:'补给争夺',brief:'地面同胞到达第一、五行的口粮箱各获60能量；每箱仅一次。'},
 airDefense:{name:'对空封锁',brief:'仙人掌分区警戒，大嘴花守住中路；先解救气球，再在下一关使用。'},
 tunnel:{name:'地窖潜入',brief:'第二、四行电网每10秒预警1秒、通电2秒；空中和地下单位免疫。'},
 citadel:{name:'综合突围',brief:'支援、近战与地空火力混编；来信选择侧门，或以75能量强攻。'}
};
const COMBAT={tombHp:1000,tombReward:500,slowFactor:.65,slowDuration:2.5,projectileSpeed:230};
const LEVELS=[
 {name:'裂缝下的同胞',tag:'第一章 · 1-1',energy:200,regen:4.5,rescue:null,plants:[['pea',0,380],['pea',1,380],['pea',2,460],['pea',3,300],['pea',4,380]]},
 {name:'废墟通道',tag:'第一章 · 1-2',rescue:'cone',energy:225,regen:4.5,plants:[['pea',0,460],['wallnut',0,610],['pea',1,360],['wallnut',1,580],['pea',2,430],['snow',3,350],['pea',4,360],['pea',2,270]]},
 {name:'最后一批幸存者',tag:'第一章 · 1-3',rescue:'bucket',energy:250,regen:4.5,plants:[['snow',0,300],['pea',0,450],['pea',1,350],['wallnut',1,570],['pea',2,310],['wallnut',2,580],['pea',3,400],['snow',4,340],['pea',1,250],['pea',3,250]]},
 {name:'地下工坊',tag:'第二章 · 2-1',energy:275,regen:4.5,rescue:null,plants:[['pea',0,400],['wallnut',0,580],['snow',1,320],['pea',1,500],['pea',2,380],['wallnut',2,600],['pea',3,430],['snow',4,340],['pea',4,500]]},
 {name:'屋顶囚室',tag:'第二章 · 2-2 上',energy:300,regen:4.5,rescue:'balloon',plants:[['cactus',0,320],['wallnut',0,600],['pea',1,400],['snow',1,260],['wallnut',2,580],['pea',2,320],['cactus',3,340],['pea',3,500],['pea',4,360]]},
 {name:'地窖工具间',tag:'第二章 · 2-2 下',energy:275,regen:4.5,rescue:'digger',plants:[['cactus',0,380],['wallnut',0,620],['pea',1,400],['snow',1,260],['cactus',2,300],['pea',2,480],['snow',3,340],['wallnut',3,590],['cactus',4,360]]},
 {name:'被俘的声音',tag:'第二章 · 2-3',energy:250,regen:4.5,rescue:null,branch:true,plants:[['cactus',0,300],['pea',0,460],['cactus',1,350],['wallnut',1,600],['cactus',2,300],['wallnut',2,620],['snow',2,440],['cactus',3,320],['pea',3,500],['cactus',4,360],['pea',4,230]]}
];
const ENCOUNTERS=[
 {mode:'breakthrough'},
 {mode:'rescue',extra:[['sunflower',2,240]]},
 {mode:'evacuation',extra:[['chomper',2,650]],reinforcements:[{at:18,type:'pea',row:2,x:230},{at:32,type:'pea',row:3,x:310}]},
 {mode:'supply',extra:[['sunflower',2,240],['chomper',1,640]],supplies:[{row:0,x:740,energy:60},{row:4,x:740,energy:60}]},
 {mode:'airDefense',extra:[['chomper',2,660]]},
 {mode:'tunnel',night:true,hazards:[{row:1,x:760,width:54,period:10,offset:0},{row:3,x:760,width:54,period:10,offset:5}]},
 {mode:'citadel',extra:[['sunflower',1,260],['chomper',3,660]],supplies:[{row:2,x:730,energy:50}]}
];
LEVELS.forEach((level,i)=>{Object.assign(level,ENCOUNTERS[i]);if(level.extra)level.plants.push(...level.extra);});
const FIELD={rows:5,columns:10,columnWidth:80,gridLeft:180,rowTop:172,rowHeight:96,footInset:16,lawnLeft:150,lawnRight:980,tombX:940,spawnX:1030,entryLeft:990,entryRight:1080};
const ROW_Y=r=>FIELD.rowTop+(r+.5)*FIELD.rowHeight;
const ROW_FOOT=r=>FIELD.rowTop+(r+1)*FIELD.rowHeight-FIELD.footInset;
const COLUMN_X=column=>FIELD.gridLeft+(column+.5)*FIELD.columnWidth;
const snapPlantX=x=>COLUMN_X(Math.max(0,Math.min(FIELD.columns-2,Math.round((x-COLUMN_X(0))/FIELD.columnWidth))));
// Static formations use real cell centers; walking units keep continuous x.
// Normalize the authored positions, rather than shifting art away from hitboxes.
for(const level of LEVELS){
 const occupied=new Set(),place=(row,x)=>{let aligned=snapPlantX(x);if(occupied.has(row+':'+aligned)){aligned=Array.from({length:FIELD.columns-1},(_,c)=>COLUMN_X(c)).filter(cx=>!occupied.has(row+':'+cx)).sort((a,b)=>Math.abs(a-x)-Math.abs(b-x)||b-a)[0];if(aligned===undefined)throw Error('Plant formation exceeds nine columns');}occupied.add(row+':'+aligned);return aligned;};
 level.plants=level.plants.map(([type,row,x])=>[type,row,place(row,x)]);if(level.reinforcements)level.reinforcements=level.reinforcements.map(p=>({...p,x:place(p.row,p.x)}));
}
// Optional field actions connect the letters to movement; victory still extracts every captive.
const STORY_ACTIONS=[
 [{kind:'food',row:2,x:740,energy:40,title:'取回饭盒',line:'阿朴：饭盒里只有面包和米饭。把口粮带回避难所。'}],
 [{kind:'cell',row:1,x:730,energy:50,title:'接应囚室',line:'门后传来敲击声：饭还热着吗？接应已完成，胜利后带同胞回家。'}],
 [{kind:'cell',row:2,x:750,energy:50,title:'接应幸存者',line:'老周：孩子先走。留一条路，等看守撤退我们就跟上。'}],
 [],
 [{kind:'cell',row:2,x:760,energy:50,title:'松开屋顶绳索',line:'囚室里的声音：绳扣松了！先打开通道，获胜后我就能离开。'}],
 [{kind:'cell',row:3,x:720,energy:50,title:'打开工具间',line:'囚室里的声音：镐和工具都还在。胜利后带我去地下救人。'}],
 [{kind:'evidence',row:2,x:810,energy:40,title:'取回造谣档案',line:'乔治：告发信上的“证据”，竟然是被改写的口粮转运单。把原件带走。'}]
];
class Battle{
 constructor(level=0,unlocked=['normal'],deck,options={}){
  this.level=level;this.config=LEVELS[level];if(!this.config)throw Error('Unknown level');
  this.unlocked=new Set(['normal',...unlocked.filter(u=>typeof u==='string'&&Object.hasOwn(UNITS,u))]);
  this.deck=new Set((deck||[...this.unlocked]).filter(u=>this.unlocked.has(u)&&Object.hasOwn(UNITS,u)));
  if(!this.deck.size||this.deck.size>5)throw Error('Choose 1–5 rescued units');
  this.route=options.route==='assault'?'assault':'peace';
  this.energy=this.config.energy+(this.config.branch&&this.route==='assault'?75:0);this.cooldowns=Object.fromEntries(Object.keys(UNITS).map(k=>[k,0]));this.time=0;this.entered=0;this.casualties=0;this.status='playing';this.paused=false;this.events=[];this.nextId=1;this.zombies=[];this.bullets=[];this.rescued=false;this.winReason=null;
  this.corpses=[];this.effects=[];this.plantRemains=[];
  this.storyActions=STORY_ACTIONS[level].map((s,id)=>({...s,id,progress:0,completed:false,early:false}));
  this.supplies=(this.config.supplies||[]).map((s,id)=>({...s,id,collected:false}));
  this.reinforcements=(this.config.reinforcements||[]).map(r=>({...r,arrived:false}));
  this.hazards=(this.config.hazards||[]).map(h=>({...h,state:'off'}));this.nextPlantId=0;
  this.tombs=Array.from({length:5},(_,row)=>({id:row,row,hp:COMBAT.tombHp,maxHp:COMBAT.tombHp,rewarded:false}));
  this.mowers=Array.from({length:5},(_,row)=>({row,state:'ready',x:145,age:0}));
  this.plants=this.config.plants.filter(([type,row])=>!(this.config.branch&&this.route==='peace'&&type==='wallnut'&&row===2)).map(([type,row,x])=>this.createPlant(type,row,x));
 }
 createPlant(type,row,x){const id=this.nextPlantId++;return {id,type,row,x,hp:PLANTS[type].hp,maxHp:PLANTS[type].hp,shot:type==='sunflower'?6:PLANTS[type].interval?1.1+(id%3)*.4:0,hit:0,attack:0,windup:0,biteTarget:null};}
 get clearedRows(){return this.mowers.filter(m=>m.state==='spent').length;}
 get triggeredRows(){return this.mowers.filter(m=>m.state!=='ready').length;}
 emit(type,data={}){this.events.push({type,...data});}
 drainEvents(){return this.events.splice(0);}
 deploy(type,row){
  if(this.status!=='playing'||this.paused)return {ok:false,reason:'战斗已暂停或结束'};
  const unit=UNITS[type];if(typeof type!=='string'||!Object.hasOwn(UNITS,type)||!Number.isInteger(row)||row<0||row>4)return {ok:false,reason:'请选择有效单位和行'};
  if(!this.unlocked.has(type))return {ok:false,reason:'需要先从植物房间解救这位同胞'};
  if(!this.deck.has(type))return {ok:false,reason:'这个兵种没有编入本关卡组，请在战前选择'};
  if(this.cooldowns[type]>0)return {ok:false,reason:'这张单位卡正在冷却'};
  if(this.energy<unit.cost)return {ok:false,reason:'僵尸能量不足，稍候恢复或等待破碑反攻机会'};
  this.energy-=unit.cost;this.cooldowns[type]=unit.cooldown;
  this.zombies.push({id:this.nextId++,type,row,x:FIELD.spawnX,hp:unit.hp,maxHp:unit.hp,age:0,slow:0,attacking:false,hit:0,hitKind:'pea',pop:0,airborne:type==='balloon',underground:type==='digger',emerging:0});
  this.emit('deploy',{unit:type,row});return {ok:true};
 }
 damageTomb(row,damage){const t=this.tombs[row];if(!t||t.hp<=0)return;t.hp=Math.max(0,t.hp-damage);if(t.hp===0&&!t.rewarded){t.rewarded=true;this.energy+=COMBAT.tombReward;this.emit('tombBroken',{row,energy:COMBAT.tombReward});}}
 damagePlant(p,damage){
  if(p.hp<=0)return;p.hp=Math.max(0,p.hp-damage);if(p.hit<=0)p.hit=.14;
  if(p.hp===0){this.plantRemains.push({...p,poseSource:p,age:0,duration:.65});this.emit('plantDefeated',{plant:p.type,row:p.row});}
 }
 damageZombie(z,damage,{snow=false,antiAir=false,source='projectile'}={}){
  if(z.hp<=0)return;
  const before=z.hp,armored=z.type==='cone'||z.type==='bucket';
  z.hp=Math.max(0,z.hp-damage);const impact=damage>=5||z.hit<=0;if(impact)z.hit=.18;z.hitKind=snow?'snow':source==='electric'?'electric':armored&&before>210?'metal':'pea';
  if(snow)z.slow=COMBAT.slowDuration;
  if(impact)this.effects.push({kind:z.hitKind,row:z.row,x:z.x-20,airborne:z.airborne,age:0,duration:.32});
  if(armored&&before>210&&z.hp<=210){this.effects.push({kind:'armor',unit:z.type,row:z.row,x:z.x,age:0,duration:.65});this.emit('armorBroken',{unit:z.type,row:z.row});}
  if(antiAir&&z.airborne){z.airborne=false;z.pop=.72;this.emit('balloonPopped',{row:z.row});}
  if(z.hp<=0)this.killZombie(z,source);
 }
 killZombie(z,source){
  if(z.deathRecorded||z.exited)return;
  z.hp=0;z.deathRecorded=true;this.casualties++;
  this.corpses.push({...z,poseSource:z,age:0,source,duration:source==='mower'?.55:3.8,attacking:false});
  this.emit('casualty',{row:z.row,source});
 }
 evaluate(){
  if(this.status!=='playing')return;
  if(this.tombs.every(t=>t.hp<=0)){this.status='lost';this.emit('end',{status:'lost'});return;}
  if(this.entered<1&&this.clearedRows<2)return;
  this.winReason=this.entered>0?'door':'mowers';this.status='won';
  for(const action of this.storyActions)if(action.kind==='cell')action.completed=true;
  if(this.config.rescue&&!this.rescued){this.rescued=true;const unit=this.config.rescue,fresh=!this.unlocked.has(unit);this.unlocked.add(unit);this.emit('rescue',{unit,fresh});}
  this.emit('end',{status:'won',reason:this.winReason});
 }
 step(dt){
  if(this.paused||this.status!=='playing')return;
  if(!Number.isFinite(dt)||dt<0||dt>.1)throw Error('Step must be between 0 and 0.1 seconds');
  this.time+=dt;this.energy+=this.config.regen*dt;
  for(const list of [this.effects,this.corpses,this.plantRemains])for(const item of list)item.age+=dt;
  this.effects=this.effects.filter(e=>e.age<e.duration);this.corpses=this.corpses.filter(z=>z.age<z.duration);this.plantRemains=this.plantRemains.filter(p=>p.age<p.duration);
  for(const k of Object.keys(this.cooldowns))this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
  for(const r of this.reinforcements)if(!r.arrived&&this.time>=r.at){r.arrived=true;this.plants.push(this.createPlant(r.type,r.row,r.x));this.emit('reinforcement',{row:r.row,plant:r.type});}
  for(const p of this.plants){
   p.hit=Math.max(0,p.hit-dt);p.attack=Math.max(0,p.attack-dt);
   const stats=PLANTS[p.type];if(p.hp<=0||!stats.interval)continue;
   p.shot=Math.max(0,p.shot-dt);
   if(p.type==='sunflower'){
    if(p.shot===0){p.shot=stats.interval;p.attack=.7;for(const ally of this.plants)if(ally!==p&&ally.hp>0&&ally.row===p.row&&Math.abs(ally.x-p.x)<=180)ally.hp=Math.min(ally.maxHp,ally.hp+18);}
    continue;
   }
   if(p.type==='chomper'){
    if(p.windup>0){p.windup=Math.max(0,p.windup-dt);if(p.windup===0){const z=this.zombies.find(z=>z.id===p.biteTarget&&z.hp>0&&!z.airborne&&!z.underground&&z.row===p.row&&z.x>=p.x-10&&z.x<=p.x+95);if(z)this.damageZombie(z,stats.damage,{source:'bite'});p.attack=.5;p.shot=stats.interval;p.biteTarget=null;}}
    else if(p.shot===0){const z=this.zombies.filter(z=>z.hp>0&&!z.airborne&&!z.underground&&z.row===p.row&&z.x>=p.x-10&&z.x<=p.x+95).sort((a,b)=>a.x-b.x)[0];if(z){p.biteTarget=z.id;p.windup=.45;}}
    continue;
   }
   if(p.shot===0){p.shot=stats.interval;p.attack=.55;this.bullets.push({row:p.row,x:p.x+38,prevX:p.x+38,damage:stats.damage,snow:p.type==='snow',antiAir:p.type==='cactus',air:p.type==='cactus'&&this.zombies.some(z=>z.hp>0&&z.row===p.row&&z.airborne&&z.x>p.x)});}
  }
  for(const z of this.zombies){
   if(z.hp<=0)continue;z.age+=dt;z.slow=Math.max(0,z.slow-dt);z.hit=Math.max(0,z.hit-dt);z.pop=Math.max(0,z.pop-dt);
   if(z.underground){z.x=Math.max(520,z.x-55*dt);if(z.x===520){z.underground=false;z.emerging=1.2;this.emit('diggerEmerged',{row:z.row});}continue;}
   if(z.emerging>0){z.emerging=Math.max(0,z.emerging-dt);continue;}
   if(z.airborne){z.attacking=false;z.x-=UNITS[z.type].speed*dt;continue;}
   const target=this.plants.filter(p=>p.hp>0&&p.row===z.row&&p.x<=z.x+10).sort((a,b)=>b.x-a.x)[0];
   z.attacking=!!target&&z.x-target.x<57;
   if(z.attacking)this.damagePlant(target,UNITS[z.type].damage*dt);
   else z.x-=UNITS[z.type].speed*(z.slow>0?COMBAT.slowFactor:1)*dt;
  }
  for(const action of this.storyActions){
   if(action.completed)continue;
   const helper=this.zombies.some(z=>z.hp>0&&!z.airborne&&!z.underground&&!(z.emerging>0)&&!z.attacking&&z.row===action.row&&Math.abs(z.x-action.x)<=48);
   if(helper)action.progress=Math.min(2,action.progress+dt);
   if(action.progress>=2){action.completed=true;action.early=true;this.energy+=action.energy;this.emit('storyAction',{id:action.id,kind:action.kind,row:action.row,energy:action.energy,line:action.line});}
  }
  for(const supply of this.supplies)if(!supply.collected&&this.zombies.some(z=>z.hp>0&&!z.airborne&&!z.underground&&z.row===supply.row&&z.x<=supply.x&&z.x>=supply.x-80)){supply.collected=true;this.energy+=supply.energy;this.emit('supplyCollected',{row:supply.row,energy:supply.energy});}
  for(const h of this.hazards){const t=(this.time+h.offset)%h.period;h.state=t>=7&&t<8?'warning':t>=8?'active':'off';if(h.state==='active')for(const z of this.zombies)if(z.hp>0&&!z.airborne&&!z.underground&&z.row===h.row&&Math.abs(z.x-h.x)<=h.width/2)this.damageZombie(z,28*dt,{source:'electric'});}
  for(const m of this.mowers){
   if(m.state==='ready'&&this.zombies.some(z=>z.hp>0&&!z.airborne&&!z.underground&&z.row===m.row&&z.x<=181)){m.state='running';this.emit('mowerTriggered',{row:m.row});}
   if(m.state!=='running')continue;
   const oldX=m.x;m.x+=470*dt;m.age+=dt;
   for(const z of this.zombies){if(z.hp>0&&!z.airborne&&!z.underground&&z.row===m.row&&z.x+22>=oldX-32&&z.x-22<=m.x+43)this.killZombie(z,'mower');}
   if(m.x>1190){m.state='spent';this.emit('mowerSpent',{row:m.row});}
  }
  for(const z of this.zombies){if(z.hp>0&&!z.underground&&z.x<104&&(z.airborne||this.mowers[z.row].state!=='ready')){z.hp=0;z.exited=true;this.entered++;this.emit('doorEntered',{row:z.row});}}
  for(const b of this.bullets){
   b.prevX=b.x;b.x+=COMBAT.projectileSpeed*dt;
   const targets=this.zombies.filter(z=>z.hp>0&&!z.underground&&!!z.airborne===!!b.air&&z.row===b.row&&z.x+24>=b.prevX&&z.x-22<=b.x&&(b.air||z.x-22<=FIELD.tombX)).sort((a,b)=>a.x-b.x);
   if(targets.length){this.damageZombie(targets[0],b.damage,{snow:b.snow,antiAir:b.antiAir});b.dead=true;}
   else if(b.x>=FIELD.tombX){if(!b.air)this.damageTomb(b.row,b.damage);b.dead=true;}
  }
  this.zombies=this.zombies.filter(z=>z.hp>0);this.bullets=this.bullets.filter(b=>!b.dead);this.evaluate();
 }
}
const api={Battle,UNITS,LEVELS,PLANTS,MODES,COMBAT,BALANCE_VERSION,ROW_Y,ROW_FOOT,COLUMN_X,FIELD,STORY_ACTIONS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ=api;
})(typeof window!=='undefined'?window:globalThis);
