(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports,geo=node?require('./engine.js'):root.PVZ,data=node?require('./rescue-design-data.js'):root.PVZ_RESCUE_DESIGN,environmentArt=node?require('./battle-environment.js'):root.PVZ_BATTLE_ENV,terrainRules=node?require('./terrain-rules.js'):root.PVZ_TERRAIN_RULES;
const x=col=>geo.FIELD.gridLeft+(col+.5)*geo.FIELD.columnWidth,y=row=>geo.FIELD.rowTop+(row+1)*geo.FIELD.rowHeight-geo.FIELD.footInset;
const formationX=[-25,23,0],formationY=[-5,5,-13];
function formationMembers(s,group){return group.teams.flatMap(team=>team.members.filter(m=>m.hp>0).map(member=>({member,team}))).sort((a,b)=>(b.team.id===s.selected)-(a.team.id===s.selected));}
function formationEntries(s,group){const used=new Set();return formationMembers(s,group).slice(0,3).map(entry=>{const slot=[0,1,2].includes(entry.member.slot)&&!used.has(entry.member.slot)?entry.member.slot:[0,1,2].find(i=>!used.has(i));used.add(slot);return{...entry,slot};});}
function memberHeight(m){return m.type==='balloon'&&m.airborne!==false?160:({cone:130,bucket:122,football:134,ladder:126,digger:112})[m.type]||108;}
function teamLayout(s){
 const groups=[];
 for(const team of s.teams){if(!team.members.some(m=>m.hp>0))continue;const group=groups.find(g=>Math.hypot(g.row-team.row,g.col-team.col)<.65);if(group)group.teams.push(team);else groups.push({row:team.row,col:team.col,teams:[team]});}
 return groups.map(group=>{const main=group.teams.find(t=>t.id===s.selected)||group.teams[0],px=x(main.col),foot=y(main.row),bodies=formationEntries(s,group).map(({member:m,slot:i})=>({left:px+formationX[i]-33,right:px+formationX[i]+33,top:foot+formationY[i]-memberHeight(m),bottom:foot+formationY[i]+8})),top=Math.min(...bodies.map(b=>b.top));return{...group,row:main.row,col:main.col,x:px,foot,top,bodies,bounds:{left:px-64,right:px+64,top,bottom:foot+18}};});
}
function pickTeam(s,px,py,{preferFeet=false}={}){
 // The lower row is painted last. Its visible head must not select the feet
 // behind it in the previous row after enlarging the actors.
 const onRing=g=>((px-g.x)/37)**2+((py-g.foot-3)/10)**2<=1;
 const hits=teamLayout(s).filter(g=>g.bodies.some(b=>px>=b.left&&px<=b.right&&py>=b.top&&py<=b.bottom)||onRing(g)).sort((a,b)=>(preferFeet?Number(onRing(b))-Number(onRing(a)):0)||b.foot-a.foot);
 const group=hits[0];if(!group)return null;return(group.teams.find(t=>t.id===s.selected)||group.teams.slice().sort((a,b)=>a.id-b.id)[0]).id;
}
function createPainter(renderer,images,design=data,units=geo.UNITS){
 const data=design;
 const plantViews=new WeakMap(),zombieViews=new WeakMap(),footprints=new WeakMap(),deathOrigins=new WeakMap();
 function view(cache,source,values){let v=cache.get(source);if(!v){v={};cache.set(source,v);}Object.assign(v,values);if(source.actor)v.poseSource=cache.get(source.actor);return v;}

 function label(c,value,px,py,size=15,color='#fff2c9',align='center'){c.save();c.font=size+'px PVZChinese,"Microsoft YaHei",sans-serif';c.textAlign=align;c.lineJoin='round';c.strokeStyle='#28351e';c.lineWidth=3;c.strokeText(value,px,py);c.fillStyle=color;c.fillText(value,px,py);c.restore();}
 function asset(c,key,px,foot,w,h,flip=false){const image=images[key];if(!image)return;c.save();if(flip){c.translate(px*2,0);c.scale(-1,1);}c.drawImage(image,px-w/2,foot-h,w,h);c.restore();}
 function ring(c,px,foot,selected,r=30){c.save();c.strokeStyle=selected?'#ffe9a2':'#23391b70';c.lineWidth=selected?3:1;c.fillStyle='#1d301d35';c.beginPath();c.ellipse(px,foot+3,r,9,0,0,Math.PI*2);c.fill();c.stroke();c.restore();}
 function paint(c,s,{reducedMotion=false,cursor=null,environment=null}={}){
  environment=environment||s.terrain;const level=s.previewLevel||data.levels[s.levelIndex],t=s.economy?.clock??s.time;c.clearRect(0,0,1200,720);renderer.drawBackground(c,false);if(environment&&environmentArt)environmentArt.draw(c,environment,images,t);
  // Intersections and hard map borders use the same coordinates as movement and collision.
  c.save();c.fillStyle='#b7ad7e45';
  for(const col of level.corridors)for(let py=y(0)-12;py<y(4);py+=25){c.beginPath();c.ellipse(x(col)+Math.sin(py*.09)*2,py,3,2,0,0,Math.PI*2);c.fill();}
  c.strokeStyle='#4d692f6b';c.lineWidth=2;c.strokeRect(180,172,800,480);
  for(const b of level.blocked){const px=x(b.col),py=y(b.row);c.fillStyle='#374b253d';c.fillRect(px-38,py-78,76,90);asset(c,'hedge',px,py+8,96,100);}
  c.restore();
  // Opening economy occupies the original mower-side passage, outside combat.
  // Its separate model collection prevents targeting; the pose stays healthy.
  if(s.economySunflowers?.length){const night=environment?.time==='night',pavement=images[night?'env:night':'env:lawn']||images[night?'ui:background2.jpg':'ui:background1.jpg'];if(pavement){const center=x(Number.isFinite(s.economySunflowers[0].col)?s.economySunflowers[0].col:-1.15);c.drawImage(pavement,998,100,48,472,center-32,172,64,480);for(let edge=0;edge<4;edge++){c.save();c.globalAlpha=(edge+1)/5;c.drawImage(pavement,998,100,2,472,center-36+edge,172,1,480);c.drawImage(pavement,1044,100,2,472,center+35-edge,172,1,480);c.restore();}}}
  for(const p of s.economySunflowers||[]){
   const px=x(Number.isFinite(p.col)?p.col:-1.15),foot=y(p.row),pulse=Math.max(0,p.attack||p.sunFlash||0);
   renderer.drawPlant(c,view(plantViews,p,{...p,type:'sunflower',hp:130,maxHp:130,x:px,attack:pulse,shot:2,hit:0}),{x:px,foot,time:reducedMotion?0:t+p.row*.36,scale:.94,reducedMotion,dead:false});
  }
  for(let row=0;row<5;row++)label(c,String(row+1),164,y(row)-20,16,'#d9e0aa');
  for(let col=0;col<10;col++)label(c,String(col+1),x(col),162,12,'#d9e0aa');
  const bank=images['ui:SeedBank.png'];if(bank){c.drawImage(bank,180,12,800,76);c.drawImage(bank,bank.width*.65,10,bank.width*.12,bank.height*.6,204,19,85,56);}asset(c,'energyHead',246,73,60,60);
  label(c,s.preview?level.title:level.tag+' · '+level.title,310,45,s.preview?18:21,'#fff0bc','left');label(c,s.preview?'专属地形规则待接入':level.routeName,310,72,14,'#ddd2ad','left');
  label(c,String(s.energy),246,78,19);label(c,'植物阳光 '+s.economy.sun,594,75,14,'#f1dda0');label(c,s.preview?'场地视觉试演':s.status==='planning'?'准备 '+Math.ceil(Math.max(0,s.planning-1e-8))+'秒':s.status==='won'?'接应成功':s.status==='lost'?'行动结束':'行动 '+Math.floor(s.time+1e-8)+'秒',594,48,15);
  label(c,'博士 · 剩余命中 '+s.doctor.hits+'/10',787,45,16);
  for(let i=0;i<10;i++){c.fillStyle=i<s.doctor.hits?'#b6c977':'#45513b';c.strokeStyle='#26391b';c.lineWidth=2;c.beginPath();c.arc(705+i*19,70,6,0,Math.PI*2);c.fill();c.stroke();}
  const selected=s.selected==='doctor'?s.doctor:s.teams.find(a=>a.id===s.selected);
  if(selected?.path.length){c.save();c.strokeStyle='#ffedaa';c.lineWidth=3;c.setLineDash([6,7]);c.beginPath();c.moveTo(x(selected.col),y(selected.row));for(const p of selected.path)c.lineTo(x(p.col),y(p.row));c.stroke();c.restore();}
  if(cursor){c.save();c.strokeStyle=level.blocked.some(b=>b.row===cursor.row&&b.col===cursor.col)?'#dd856b':'#fff0a4';c.lineWidth=2;c.setLineDash([4,4]);c.strokeRect(x(cursor.col)-37,y(cursor.row)-76,74,88);c.restore();}
  const objects=[];
  if(s.terrain?.id==='fog'&&s.status!=='planning'&&s.time>=s.weather.clearUntil){c.save();c.beginPath();for(let row=0;row<5;row++)for(let col=0;col<8;col++)if(!terrainRules.visible(s,{row,col},'player'))c.rect(x(col)-40,y(row)-80,80,96);c.clip();c.fillStyle='#142735c0';c.fillRect(180,172,640,480);const mist=images['env:mist'];if(mist){c.globalAlpha=.3;c.drawImage(mist,160,172,740,480);}c.restore();}
  for(const b of s.supports||[])if(b.hp>0&&(!s.terrain||terrainRules.visible(s,b,'player'))){objects.push({foot:y(b.row)-2,draw(){asset(c,'support:'+b.type,x(b.col),y(b.row)+11,b.type==='lily'?76:62,b.type==='lily'?29:39);}});if(b.type==='flowerpot')objects.push({foot:y(b.row)+.5,draw(){const image=images['support:flowerpot'];if(image){c.save();c.beginPath();c.rect(x(b.col)-31,y(b.row)-9,62,20);c.clip();asset(c,'support:flowerpot',x(b.col),y(b.row)+11,62,39);c.restore();}}});}
  for(const p of s.previewLandmarks||[])objects.push({foot:y(p.row)-3,draw(){if(p.kind==='door')asset(c,'door',x(p.col),y(p.row)+3,66,90);else{ring(c,x(p.col),y(p.row),true,25);}label(c,p.label,x(p.col),y(p.row)-38,12,'#ffe7a6');}});
  for(const n of s.caches){objects.push({foot:y(n.row),draw(){const px=x(n.col),foot=y(n.row);c.save();if(n.broken)c.globalAlpha=.33;ring(c,px,foot,n.claimed&&!n.broken,29);asset(c,'cache',px,foot+3,92,92);c.restore();
   if(!n.broken){c.fillStyle='#26371d';c.fillRect(px-22,foot+9,44,6);c.fillStyle=n.claimed?'#bcd66c':'#93a16a';c.fillRect(px-21,foot+10,42*n.hp/n.maxHp,4);
    if(!n.claimed&&n.progress>0){c.strokeStyle='#ffde86';c.lineWidth=3;c.beginPath();c.arc(px,foot-30,25,-Math.PI/2,-Math.PI/2+Math.PI*2*n.progress/3);c.stroke();}}
   label(c,n.kind==='relay'?'援':n.kind==='repair'?'修':'粮',px,foot-21,13,n.claimed?'#ffe599':'#e0d4b0');}});}
  if(!s.preview||s.previewHasDoor)objects.push({foot:y(s.goal.row)-2,draw(){asset(c,'door',x(s.goal.col),y(s.goal.row)+3,66,90);label(c,s.goal.open?'已开':'房门',x(s.goal.col),y(s.goal.row)-34,13,'#ffe4a0');if(!s.goal.open&&s.goal.progress>0){c.fillStyle='#26371d';c.fillRect(x(s.goal.col)-24,y(s.goal.row)+9,48,5);c.fillStyle='#e6c472';c.fillRect(x(s.goal.col)-24,y(s.goal.row)+9,48*s.goal.progress/4,5);}}});
  function plant(p,dead=false){
   const support=s.supports?.find(b=>b.hp>0&&b.row===Math.round(p.row)&&b.col===Math.round(p.col)),foot=y(p.row)-(support?.type==='flowerpot'?22:0);
   if(p.type==='squash'){
    const a=(dead?p.actor:p).ability||{state:'idle',elapsed:0},air=['rising','falling'].includes(a.state),target=a.target||p,origin=a.origin||p;
    const u=a.state==='rising'?Math.min(1,a.elapsed/.3):a.state==='falling'||a.state==='spent'?1:0,e=u*u*(3-2*u),px=x(origin.col+(target.col-origin.col)*e),originSupport=s.supports?.find(b=>b.hp>0&&b.row===Math.round(origin.row)&&b.col===Math.round(origin.col)),originFoot=y(origin.row)-(originSupport?.type==='flowerpot'?22:0),landingFoot=y(target.row),ground=originFoot+(landingFoot-originFoot)*e,lift=a.state==='rising'?110*e:a.state==='falling'?110*(1-Math.min(1,a.elapsed/.1)):0;
    if(air)objects.push({foot:landingFoot-1,draw(){c.save();c.strokeStyle='#8a613f';c.fillStyle='#342a1c40';c.lineWidth=2;c.beginPath();c.ellipse(x(target.col),landingFoot+2,34,10,0,0,Math.PI*2);c.fill();c.stroke();c.restore();}});
    // Sort the planted body against the pot at ground level, not at its raised pivot.
    objects.push({foot:y(origin.row)+(air?86:0),draw(){c.save();if(dead){c.globalAlpha=Math.max(0,1-p.age/.9);c.translate(px,ground);c.rotate(-p.age);c.translate(-px,-ground);}else if(a.state==='spent')c.globalAlpha=Math.min(1,(1-a.elapsed)/.4);if(p.hit>0)c.filter='brightness(1.35)';if(!air)ring(c,px,ground,false,24);
     const anim=(dead?p.actor:p).animation;renderer.actor(c,'squash',anim?.clip||'idle',anim?.time??(reducedMotion?0:t),px,ground-lift,1.3,'normal',{once:anim?.once??false});
     if(a.state==='look')label(c,'!',px,ground-83,21,'#f0d49a');
     if(a.state==='spent'&&a.elapsed<.5){c.globalAlpha*=1-a.elapsed/.5;c.fillStyle='#c3b68b';for(let i=0;i<6;i++){c.beginPath();c.ellipse(px+Math.cos(i*1.1)*(10+a.elapsed*52),ground+3-Math.sin(i*1.1)**2*a.elapsed*30,5+a.elapsed*10,3+a.elapsed*5,0,0,Math.PI*2);c.fill();}}
     c.restore();}});return;
   }
   objects.push({foot:y(p.row),draw(){c.save();if(dead)c.globalAlpha=Math.max(0,1-p.age/.9);if(p.facing<0){c.translate(x(p.col)*2,0);c.scale(-1,1);}ring(c,x(p.col),foot,false,23);renderer.drawPlant(c,view(plantViews,p,{...p,x:x(p.col),maxHp:p.maxHp||data.plantCombat[p.type].hp,hp:dead?0:p.hp,duration:.9,shot:p.attack>0?.1:2,hit:p.hit||0}),{x:x(p.col),foot,time:dead?p.age:t+p.id*.3,scale:p.type==='cactus'?1.02:1.18,reducedMotion,dead,high:p.cactusHigh===true});if(p.sleeping)label(c,'Z z',x(p.col)+17,foot-51,15,'#ddd9ee');if(p.type==='blover'&&p.windStarted!=null)label(c,'吹风 '+Math.max(0,2.5-(s.time-p.windStarted)).toFixed(1),x(p.col),foot-78,14,'#ffdda2');if(p.coffee>0)renderer.drawPlant(c,{type:'coffee',hp:1,maxHp:1,row:p.row,attack:1},{x:x(p.col),foot:foot-33,time:.9-p.coffee,scale:.5,reducedMotion});c.restore();}});
  }
  for(const p of s.plants)if(p.hp>0&&(!s.terrain||terrainRules.visible(s,p,'player')))plant(p);
  function zombie(z,position,options={}){if(!options.dead)footprints.set(z,{...position,flip:options.flip});objects.push({foot:position.foot,draw(){c.save();if(options.dead)c.globalAlpha=Math.max(0,1-z.age/.9);if(options.dead&&z.crushed){c.translate(0,position.foot);c.scale(1,.22);c.translate(0,-position.foot);}if(options.flip){c.translate(position.x*2,0);c.scale(-1,1);}renderer.drawZombie(c,view(zombieViews,z,{...z,type:z.visualType||units[z.type]?.visualType||z.type,unitKind:z.type,inWater:s.terrain&&terrainRules.water(s,{row:position.row,col:(position.x-geo.FIELD.gridLeft)/geo.FIELD.columnWidth-.5}),row:Math.round(position.row),x:position.x,maxHp:z.maxHp||units[z.type].hp,age:t,duration:.9,hit:z.hit||0,slow:options.slow||0,airborne:z.type==='balloon'&&z.airborne!==false&&!options.grounded,attacking:!!options.attack}),{x:position.x,foot:position.foot,time:options.dead?z.age:t,scale:z.type==='balloon'?.72:.88,reducedMotion,stationary:!options.moving,dead:!!options.dead});if(!['normal','cone','bucket','balloon','digger'].includes(z.type))label(c,({screen:'纱门',ducky:'泳',snorkel:'潜',ladder:'梯',football:'橄'})[z.type]||'',position.x,position.foot-108,11,'#f0dda0');c.restore();}});}
  // Co-located squads share a formation instead of painting nine bodies on top of one another.
  const formations=teamLayout(s);
  for(const group of formations){const main=group.teams.find(a=>a.id===s.selected)||group.teams[0],members=formationMembers(s,group),px=x(main.col),foot=y(main.row),selected=group.teams.some(a=>a.id===s.selected);objects.push({foot:foot-10,draw(){ring(c,px,foot,selected,37);}});
   formationEntries(s,group).forEach(({member:m,team,slot:i})=>zombie(m,{x:px+formationX[i],foot:foot+formationY[i],row:main.row},{moving:team.moving,attack:team.attack>0&&!(m.type==='balloon'&&m.airborne!==false),slow:team.slow,flip:team.facing>0}));
   objects.push({foot:foot+20,draw(){const ids=group.teams.map(a=>a.id+1).join('/'),linked=group.teams.some(a=>a.group!=null);label(c,(linked?'联队 ':'队 ')+ids+(members.length>3?' · '+members.length+'人':''),px,foot+23,12,selected?'#ffeca1':'#ded6af');}});
  }
  if(s.follower){const f=s.follower,px=x(f.col)-16,foot=y(f.row)+8;if(f.kind==='plant')objects.push({foot,draw(){renderer.drawPlant(c,view(plantViews,f,{...f,x:px,attack:0,shot:2,hit:0}),{x:px,foot,time:t,scale:1.18,reducedMotion});}});else zombie(f,{x:px,foot,row:f.row},{moving:f.moving,flip:f.facing>0,grounded:true});objects.push({foot:foot+16,draw(){c.save();c.strokeStyle='#ffe28b';c.lineWidth=3;c.setLineDash([4,3]);c.beginPath();c.ellipse(px,foot+2,22,8,0,0,Math.PI*2);c.stroke();c.restore();const tag=images['ui:SeedChooser_Button.png'];if(tag)c.drawImage(tag,px-27,foot-135,54,22);label(c,f.escort==null?'接应':'护送',px,foot-120,13,'#ffe296');}});}
  for(const d of s.dead){if(d.kind==='plant')plant(d,true);else{let origin=deathOrigins.get(d);if(!origin){origin=footprints.get(d.actor)||{x:x(d.col),foot:y(d.row),row:d.row};deathOrigins.set(d,origin);}zombie({...d,hp:0},origin,{dead:true,flip:origin.flip});}}
  if(Number.isInteger(s.doctor.row))objects.push({foot:y(s.doctor.row),draw(){const d=s.doctor;ring(c,x(d.col),y(d.row),s.selected==='doctor',26);c.save();if(d.hit>0)c.globalAlpha=.6;asset(c,'command',x(d.col),y(d.row),122,122);c.restore();label(c,'博士 · 己方可见',x(d.col),y(d.row)-133,15,'#ffe5a0');}});
  for(const f of s.fences)objects.push({foot:y(f.row)+9,draw(){const px=x(f.col),foot=y(f.row),chosen=s.doctor.row===f.row;
   c.save();if(s.status==='planning'&&chosen){c.strokeStyle='#e3c77a';c.lineWidth=3;c.setLineDash([5,5]);c.strokeRect(px-37,foot-80,74,84);}if(f.hp===0){c.beginPath();c.rect(px-40,foot-23,80,31);c.clip();c.globalAlpha=.65;}if(f.hit>0)c.filter='brightness(1.45)';asset(c,'fence',px,foot+6,76,90);c.restore();
   c.fillStyle='#28371e';c.fillRect(px-26,foot+3,52,6);c.fillStyle=f.hp>200?'#bdd17a':'#d7a063';c.fillRect(px-25,foot+4,50*f.hp/f.maxHp,4);label(c,f.hp>0?Math.ceil(f.hp)+'/600':'已破损',px+45,foot+8,11,f.hp>0?'#e9deb2':'#dfb38a','left');
  }});
  objects.sort((a,b)=>a.foot-b.foot);for(const item of objects)item.draw();
  for(const p of s.projectiles){if(s.terrain&&!terrainRules.visible(s,p,'player'))continue;c.save();const launchLift=s.terrain?.theme==='roof'?22:0,px=x(p.col),py=y(p.row)-launchLift-(p.airborne?117:p.lobbed?57+Math.sin(Math.min(1,(p.col-p.originCol)/7)*Math.PI)*70:57),cabbage=images.IMAGE_REANIM_CABBAGEPULT_CABBAGE;
   if(p.lobbed&&cabbage){c.translate(px,py);c.rotate((p.col-p.originCol)*1.5);c.drawImage(cabbage,-10,-10,20,20);}else{c.shadowColor='#22330b';c.shadowBlur=3;c.fillStyle=p.type==='snow'?'#b7e7f1':['puff','fumeshroom'].includes(p.type)?'#c9b2e2':p.type==='cactus'?'#e8d38c':'#93d33d';c.strokeStyle='#375a23';c.lineWidth=2;c.beginPath();c.ellipse(px,py,p.type==='cactus'?9:p.type==='fumeshroom'?13:6,p.type==='cactus'?2:p.type==='fumeshroom'?7:6,0,0,Math.PI*2);c.fill();c.stroke();}c.restore();}
  label(c,s.preview?'← 目标与地标':s.economySunflowers?.length?'场外供阳 · 无敌':'← 房门与目标',s.economySunflowers?.length?102:92,s.economySunflowers?.length?173:205,s.economySunflowers?.length?12:15);if(!Number.isInteger(s.doctor.row)){label(c,'选择藏身栅栏',1084,355,16,'#ffe5a0');label(c,'点击最右侧任一行',1084,382,13,'#e6d7b2');}label(c,'第9列 · 接应点',x(data.camp.col),677,13);if(environment?.theme==='roof')label(c,'屋脊 · 左侧直射受阻',460,677,12,'#e9d4ad');
  label(c,s.preview?'原版场景素材与现有角色实绘 · 场地机制仍在设计中':s.status==='planning'?'先点最右侧栅栏选择博士藏身处；小队在栅栏前一列布阵。':'接通'+level.requiredCaches+'座补给碑 → 开门 → 护送同胞回到右侧灯房',600,702,16,'#e9dfb1');
 }
 return{paint,point:(row,col)=>({x:x(col),y:y(row)} )};
}
const api={createPainter,teamLayout,pickTeam};if(node)module.exports=api;else root.PVZ_RESCUE_PAINTER=api;
})(typeof window!=='undefined'?window:globalThis);
