(async function(){
'use strict';
const $=id=>document.getElementById(id),assets=PVZ_ASSETS,pictures={},root='../../game/';
const controls=[...document.querySelectorAll('button,input,select')];controls.forEach(el=>el.disabled=true);$('retry').onclick=()=>location.reload();
const load=src=>new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>reject(Error('读取素材超时：'+src)),15000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(Error('素材未能读取：'+src));};im.src=root+src;});
try{
 await Promise.all([...Object.entries(assets.images).map(async([id,v])=>pictures[id]=await load(v.path)),...Object.entries(assets.ui).map(async([id,v])=>pictures['ui:'+id]=await load(v)),...Object.entries(assets.storyArt).map(async([id,v])=>pictures['story:'+id]=await load(v.file)),(async()=>{pictures.tomb=await load('assets/tombstones-alpha.png');})()]);
 const renderer=PVZ_RENDER.createRenderer(assets,pictures,pictures.tomb),items=[],poses=new Map();
 function add(type,kind,info){const fig=document.createElement('figure');fig.className='actor';const title=document.createElement('figcaption');title.textContent=info.name;const canvas=document.createElement('canvas');canvas.width=200;canvas.height=270;canvas.setAttribute('aria-label',info.name+'动态预览');const caption=document.createElement('small');fig.append(title,canvas,caption);$(kind==='plant'?'plants':'zombies').append(fig);items.push({type,kind,info,canvas,caption});}
 for(const [id,p]of Object.entries(PVZ.PLANTS))add(id,'plant',p);
 for(const [id,z]of Object.entries(PVZ.UNITS))add(id,'zombie',z);
 const stage=$('scene'),sceneCtx=stage.getContext('2d'),buffer=document.createElement('canvas');buffer.width=960;buffer.height=576;const small=buffer.getContext('2d');
 const battle=new PVZ.Battle(6,Object.keys(PVZ.UNITS)),formation=battle.plants.map(p=>({...p}));
 const eventBattle=new PVZ.Battle(6,Object.keys(PVZ.UNITS)),warm=document.createElement('canvas');warm.width=240;warm.height=320;const warmCtx=warm.getContext('2d');
 let playing=true,time=0,last=0;
 $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'暂停动作':'继续动作';};
 $('reset').onclick=()=>{time=0;};
 $('freeze').onclick=()=>{const value=Number($('seek').value);time=Number.isFinite(value)?Math.max(0,Math.min(12,value)):0;playing=false;$('play').textContent='继续动作';};
 $('time').oninput=()=>{time=Number($('time').value)/100;playing=false;$('play').textContent='继续动作';};
 $('art').onchange=()=>renderer.setArtStyle($('art').value);
 $('status').textContent='素材已就绪；可暂停并拖动时间，检查叶片、面部、护具、抬升与倒地衔接。';
 controls.forEach(el=>el.disabled=false);
 const names={idle:'待机 / 行走',attack:'攻击',hit:'命中',hurt:'受伤',critical:'濒危',death:'退场 / 倒地',special:'特殊动作'};
 function pose(type,kind,info,t,state,identity='gallery'){
  const local=t%12,mode=state==='transition'?(t%5<1?'special':'death'):state==='cycle'?(local<2?'idle':local<4?'attack':local<4.3?'hit':local<6?'hurt':local<8?'critical':local<10?'special':'death'):state;
  const bodyHp=kind==='zombie'&&(type==='cone'||type==='bucket')?210:info.hp;
  const hp=mode==='death'?0:mode==='hurt'?bodyHp*.55:mode==='critical'?bodyHp*.2:info.hp,deathAge=state==='transition'?Math.max(0,t%5-1):state==='cycle'?Math.max(0,local-10):t%3.8;
  const key=identity+':'+kind+':'+type,base=poses.get(key)||{};poses.set(key,base);Object.assign(base,{type,x:100,row:0,id:0,hp,maxHp:info.hp,age:mode==='death'?deathAge:t,hit:mode==='hit'?.14:0,attack:mode==='attack'?.55-((t%0.9)/.9)*.55:0,windup:mode==='attack'&&type==='chomper'?Math.max(0,.45-t%1):0,shot:mode==='attack'?.2:2,slow:0,attacking:mode==='attack',airborne:type==='balloon'&&(mode==='idle'||mode==='special'&&t%3<1),pop:type==='balloon'&&mode==='special'&&t%3>=1&&t%3<1.72?1.72-t%3:0,emerging:type==='digger'&&mode==='special'?Math.max(0,1.2-t%3):0,duration:kind==='plant'?.65:3.8,source:'projectile'});
  const animTime=mode==='death'?deathAge:t,high=type==='cactus'&&(state==='transition'||mode==='special'&&t%6<3);
  base.poseSource=undefined;
  if(state==='transition'&&mode==='death'){
   // Build a fresh living unit; a reused corpse carries deathRecorded/exited.
   const source={type,x:100,row:0,id:0,hp:info.hp,maxHp:info.hp,hit:0,age:.9,attack:0,windup:0,shot:2,slow:0,airborne:type==='balloon',pop:0,emerging:0};warmCtx.clearRect(0,0,240,320);
   if(kind==='plant'){renderer.drawPlant(warmCtx,source,{x:120,foot:290,time:.9,high});eventBattle.plantRemains=[];eventBattle.damagePlant(source,info.hp);Object.assign(base,eventBattle.plantRemains[0],{age:deathAge});}
   else{renderer.drawZombie(warmCtx,source,{x:120,foot:290,time:.9});eventBattle.corpses=[];eventBattle.effects=[];eventBattle.damageZombie(source,info.hp,{antiAir:true});Object.assign(base,eventBattle.corpses[0],{age:deathAge});}
   eventBattle.events=[];
  }
  return {base,mode,animTime,high};
 }
 function frame(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(playing)time=(time+dt)%12;const state=$('state').value;renderer.setArtStyle($('art').value);$('clock').textContent=time.toFixed(2)+' 秒';$('time').value=String(Math.round(time*100));
  for(const item of items){const {type,kind,info,canvas,caption}=item,c=canvas.getContext('2d'),p=pose(type,kind,info,time,state);c.clearRect(0,0,200,270);c.fillStyle='#344b2c';c.fillRect(0,0,200,270);c.fillStyle='#2b4026';c.beginPath();c.ellipse(type==='cactus'?120:type==='chomper'?76:type==='balloon'?75:kind==='zombie'?107:100,245,type==='balloon'?40:65,12,0,0,Math.PI*2);c.fill();
   // One fixed framing per character for every state, including live-to-dead.
   if(kind==='plant')renderer.drawPlant(c,p.base,{x:type==='cactus'?120:type==='chomper'?76:100,foot:244,scale:type==='cactus'?1.1:type==='chomper'?1.35:1.65,time:p.animTime,high:p.high,dead:p.mode==='death'});else renderer.drawZombie(c,p.base,{x:type==='balloon'?75:107,foot:244,scale:type==='balloon'?.85:1.48,time:p.animTime,dead:p.mode==='death'});
   caption.textContent=names[p.mode]+(p.high?' · 抬高':'');
  }
  battle.time=time;battle.status='playing';
  const contacts=$('arrangement').value==='contacts';
  if(contacts){battle.plants=['cactus','chomper','cactus','sunflower','cactus'].map((type,row)=>Object.assign(pose(type,'plant',PVZ.PLANTS[type],time,state,'contact-'+row).base,{x:PVZ.COLUMN_X(8),row,id:row}));for(const [row,type]of [[0,'pea'],[1,'snow'],[2,'wallnut']])battle.plants.push(Object.assign(pose(type,'plant',PVZ.PLANTS[type],time,state,'contact-extra-'+row).base,{x:PVZ.COLUMN_X(7),row,id:row+5}));}
  else if($('arrangement').value==='formation')battle.plants=formation.map(p=>Object.assign(pose(p.type,'plant',PVZ.PLANTS[p.type],time,state,'field-'+p.id).base,{x:p.x,row:p.row,id:p.id}));
  else battle.plants=Array.from({length:PVZ.FIELD.rows},(_,row)=>Object.entries(PVZ.PLANTS).map(([type,info],column)=>Object.assign(pose(type,'plant',info,time,state,'field-'+row).base,{x:PVZ.COLUMN_X(column),row,id:row*6+column}))).flat();
  // Include an airborne target beside cactus only while special pose is raised.
  battle.zombies=Object.entries(PVZ.UNITS).map(([type,info],i)=>Object.assign(pose(type,'zombie',info,time,state,'field').base,{x:contacts||$('arrangement').value==='crossing'?PVZ.FIELD.tombX:PVZ.COLUMN_X(7),row:i}));
  if(contacts&&state!=='death'||state==='special'||state==='cycle'&&time>=8&&time<10)for(const targetRow of contacts?[0,2,4]:[0,2])battle.zombies.push({...pose('balloon','zombie',PVZ.UNITS.balloon,time,state==='transition'?'transition':'idle','target-'+targetRow).base,x:contacts?1030:PVZ.COLUMN_X(8),row:targetRow,airborne:state==='transition'?time%5<1:time%6<3});
  battle.corpses=battle.zombies.filter(z=>z.hp<=0);battle.zombies=battle.zombies.filter(z=>z.hp>0);battle.plantRemains=battle.plants.filter(p=>p.hp<=0);battle.plants=battle.plants.filter(p=>p.hp>0);battle.bullets=[];battle.effects=[];battle.storyActions=[];battle.supplies=[];battle.hazards=[];
  if($('sampling').value==='soft'){small.setTransform(.8,0,0,.8,0,0);renderer.draw(small,battle,{selectedRow:-1,grid:$('grid').checked});sceneCtx.clearRect(0,0,1200,720);sceneCtx.imageSmoothingEnabled=true;sceneCtx.imageSmoothingQuality='medium';sceneCtx.drawImage(buffer,0,0,1200,720);}else renderer.draw(sceneCtx,battle,{selectedRow:-1,grid:$('grid').checked});
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}catch(e){$('status').textContent=e.message;$('retry').hidden=false;$('retry').disabled=false;console.error(e);}
})();
