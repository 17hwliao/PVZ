(function(root){
'use strict';
const geometry=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.PVZ;
const {FIELD,ROW_Y,ROW_FOOT,COLUMN_X}=geometry;
const FIELD_VIEW={plantScale:{pea:.98,snow:.98,wallnut:.9,sunflower:.94,cactus:.88,chomper:.84},zombieScale:{normal:.8,cone:.8,bucket:.8,balloon:.8,digger:.78},tombWidth:66,tombHeight:76};
// Visible root/sole offsets measured from the original animation anchors.
// A caller's foot now means the shared ground line, including in previews.
const plantGround={pea:[-3,2],snow:[-3,2],wallnut:[8,0],sunflower:[-3,3],cactus:[-3,-3],chomper:[-6,9],puff:[4,-12],sunshroom:[5,-11],fumeshroom:[9,3],plantern:[2,11],blover:[2,-5],coffee:[4,-5],cabbagepult:[0,-3]};
const zombieGround={normal:5,cone:5,bucket:5,balloon:17,digger:11};
const tombCrops=[[7,0,73,81],[91,9,78,73],[179,0,71,81],[267,1,73,83],[354,1,70,87],[7,115,73,55],[93,118,78,54],[191,127,50,40],[278,116,50,57],[362,114,59,58],[7,182,73,81],[91,191,78,73],[179,182,71,81],[267,183,73,83],[354,183,70,87],[11,283,66,73],[97,287,69,66],[175,280,74,73],[272,280,65,76],[361,280,63,78]];
function zombieState(z){
 const armored=z.type==='cone'||z.type==='bucket',armorMax=z.maxHp-210,armor=armored?Math.max(0,z.hp-210):0;
 const armorStage=!armored||armor===0?0:armor/armorMax>2/3?1:armor/armorMax>1/3?2:3;
 const ratio=Math.min(z.hp,armored?210:z.maxHp)/(armored?210:z.maxHp);
 return {armorStage,bodyStage:ratio<=.28?2:ratio<=.6?1:0,key:z.type==='balloon'?'balloon':z.type==='digger'?'digger':'zombie'};
}
function plantState(p){const ratio=p.hp/p.maxHp;return {stage:ratio<=.3?2:ratio<=.65?1:0,dead:p.hp<=0};}
function plantSamples(type,maxHp){
 const base={type,maxHp,hp:maxHp,row:0,x:220,id:0,hit:0,attack:0,windup:0,shot:2};
 return [['完好',{},'保持当前所选角色形象，沿用原版骨骼动作。'],['攻击预兆',{shot:.25,windup:type==='chomper'?.35:0},type==='wallnut'?'坚果没有主动攻击。':'攻击前显示蓄力；大嘴花的咬击有明确预警。'],['攻击',{attack:.5},type==='sunflower'?'补给光环支援同行植物。':type==='wallnut'?'坚果依靠身体阻挡。':'使用原版发射或咬击动画。'],['命中',{hit:.14},'短暂亮闪与后缩，没有新增植物血条。'],['受伤',{hp:maxHp*.55},type==='wallnut'?'更换对应画风的一级开裂贴图。':'前倾、叶片下垂与局部裂纹。'],['濒危',{hp:maxHp*.2},type==='wallnut'?'更换对应画风的二级开裂贴图。':'更明显的低垂与裂纹。'],['退场',{hp:0,age:0,duration:.65},'植物失去耐久后退出战斗判定，短暂倒伏并淡出。']].map(([name,patch,description])=>({name,description,plant:{...base,...patch}}));
}
function damageSamples(type,maxHp){
 const base={type,maxHp,hp:maxHp,row:0,x:0,age:0,slow:0,hit:0,pop:0,attacking:false,airborne:type==='balloon',underground:false,emerging:0};
 const armored=type==='cone'||type==='bucket',body=armored?210:maxHp;
 const items=[['完好',{},'正常行走，护具与身体保持完整。'],['命中',{hit:.18,hitKind:'pea'},'命中短暂亮闪和向后缩肩；不改变实际位置。']];
 if(armored)items.push(['护具凹损',{hp:210+(maxHp-210)*.6},'护具剩余三分之二以下，换用原版二级破损贴图。'],['护具将碎',{hp:210+(maxHp-210)*.2},'护具剩余三分之一以下，换用原版三级破损贴图。'],['护具脱落',{hp:210},'护具耗尽后露出普通僵尸，随后由身体承受伤害。']);
 if(type==='balloon')items.push(['气球爆裂',{airborne:false,pop:.72},'被仙人掌击中后播放一次爆裂动作，随后按地面单位推进。']);
 if(type==='digger')items.push(['出土',{emerging:1.2},'播放一次出土动作；出土停顿使用现有关卡规则。']);
 items.push(['攻击',{attacking:true,airborne:false},'接近植物时使用原版攻击动画。'],['受伤',{hp:body*.55,airborne:false},'身体略前倾，步态变沉，受击时缩肩更明显。'],['重伤',{hp:body*.24,airborne:false},'原版受损手臂与明显弯腰步态；仍使用原有移动和攻击数值。'],['寒冰命中',{hp:body*.55,hit:.18,hitKind:'snow',slow:2.5},'冷色覆盖与冰屑提示现有寒冰减速。'],['触电',{hp:body*.55,hit:.18,hitKind:'electric',airborne:false},'电网通电时出现短促电火花与后缩；不会额外眩晕。'],['倒地',{hp:0,source:'projectile',duration:3.8,airborne:false},'播放一次原版倒地动画并淡出；立即退出命中与阻挡计算。']);
 return items.map(([name,patch,description])=>({name,description,zombie:{...base,...patch}}));
}
function createRenderer(assets,pictures,tombImage){
 const font='PVZChinese,"Microsoft YaHei","Noto Sans CJK SC",sans-serif';
 let artStyle='story';
 const rasterParts=new Map(),plantPoses=new WeakMap(),zombiePoses=new WeakMap(),backgrounds=new Map();
 function surface(ctx,width,height){let canvas;try{canvas=ctx.canvas?.ownerDocument?.createElement('canvas');if(!canvas&&ctx.canvas&&typeof ctx.canvas.constructor==='function')canvas=new ctx.canvas.constructor(width,height);}catch{}if(!canvas||typeof canvas.getContext!=='function')return null;canvas.width=width;canvas.height=height;return canvas;}
 function rasterPart(ctx,name,frame,w,h){
  const box=assets.storyArt?.[name]?.bounds[frame],im=pictures['story:'+name];if(!box||!im)return null;
  const width=Math.max(1,Math.round(w)),height=Math.max(1,Math.round(h)),key=name+':'+frame+':'+width+'x'+height;
  if(rasterParts.has(key))return rasterParts.get(key);
  let surface;
  try{surface=ctx.canvas?.ownerDocument?.createElement('canvas');if(!surface&&ctx.canvas&&typeof ctx.canvas.constructor==='function')surface=new ctx.canvas.constructor(width,height);}catch{}
  if(!surface||typeof surface.getContext!=='function')return null;surface.width=width;surface.height=height;
  const pen=surface.getContext('2d');pen.imageSmoothingEnabled=true;pen.imageSmoothingQuality='high';const rootShift=name==='cactus-face-v2'?width*([0,5.5/73,16.5/73][frame]||0):0;pen.drawImage(im,...box,-rootShift,0,width,height);rasterParts.set(key,surface);return surface;
 }
 function cactusBase(ctx,frame,im,width,left,right){
  const key='cactus-base:'+frame+':'+im.width+'x'+im.height;if(rasterParts.has(key))return rasterParts.get(key);
  let base;try{base=ctx.canvas?.ownerDocument?.createElement('canvas');if(!base&&ctx.canvas&&typeof ctx.canvas.constructor==='function')base=new ctx.canvas.constructor(52,19);}catch{}
  const original=pictures.IMAGE_REANIM_CACTUS_BODY3;if(!base||typeof base.getContext!=='function'||!original)return null;base.width=52;base.height=19;
  const pen=base.getContext('2d');pen.drawImage(original,6,34,52,19,0,0,52,19);pen.globalCompositeOperation='source-in';
  // Keep the native rounded alpha silhouette, but continue this expression's ribs.
  const sx=(left-1)/width*im.width,sw=(right-left+6)/width*im.width;
  pen.drawImage(im,sx,Math.round(im.height*.79),sw,Math.max(1,im.height*.17),0,0,52,19);
  pen.globalCompositeOperation='multiply';pen.filter='grayscale(1) brightness(1.8)';pen.drawImage(original,6,34,52,19,0,0,52,19);pen.filter='none';pen.globalCompositeOperation='destination-in';pen.drawImage(im,sx,Math.round(im.height*.79),sw,Math.max(1,im.height*.17),0,0,52,19);pen.drawImage(original,6,34,52,19,0,0,52,19);pen.globalCompositeOperation='source-over';
  rasterParts.set(key,base);return base;
 }
 function part(ctx,name,frame,x,y,w,h){
  const raster=rasterPart(ctx,name,frame,w,h);if(raster){ctx.imageSmoothingEnabled=true;ctx.drawImage(raster,x,y,w,h);return true;}return sprite(ctx,name,frame,x,y,w,h);
 }
 function sprite(ctx,name,frame,x,y,w,h){
  const im=pictures['story:'+name],box=assets.storyArt?.[name]?.bounds[frame];
  if(!im||!box)return false;ctx.drawImage(im,...box,x,y,w,h);return true;
 }
 const available=name=>artStyle!=='classic'&&!!pictures['story:'+name]&&!!assets.storyArt?.[name]?.bounds?.length;
 const chomperReady=()=>available('chomper-jaws-v2')&&available('chomper-interior-v2');
 const headArt={zombie:'civilian-head-v2',balloon:'balloon-head-v2',digger:'digger-head-v2'};
 function characterPart(ctx,id,w,h,faceState=0,extension=0){
  if(artStyle==='classic')return false;
  if(/^IMAGE_REANIM_CHOMPER_(TOPJAW|UNDERJAW|INSIDEMOUTH|TONGUE)$/.test(id)&&!chomperReady())return false;
  if(id==='IMAGE_REANIM_PEASHOOTER_HEAD')return part(ctx,'pea-head-v2',faceState,-16,0,w+16,h);
  if(id==='IMAGE_REANIM_SNOWPEA_HEAD')return part(ctx,'snow-head-v2',faceState,-16,0,w+16,h);
  if(id==='IMAGE_REANIM_ZOMBIE_HEAD')return part(ctx,'civilian-head-v2',faceState,0,0,w,h*1.12);
  if(id==='IMAGE_REANIM_ZOMBIE_BALLOON_HEAD')return part(ctx,'balloon-head-v2',faceState,0,0,w,h*1.12);
  if(/^IMAGE_REANIM_ZOMBIE_DIGGER_HEAD2?$/.test(id))return part(ctx,'digger-head-v2',faceState,0,0,w,h*1.06);
  if(id==='IMAGE_REANIM_SUNFLOWER_HEAD')return part(ctx,'sunflower-face-v2',faceState,0,0,w,h);
  if(id==='IMAGE_REANIM_CACTUS_BODY1'&&available('cactus-face-v2')){
   const im=rasterPart(ctx,'cactus-face-v2',faceState,w*1.23,h);if(!im)return part(ctx,'cactus-face-v2',faceState,-2,0,w*1.23,h+extension);
   // One continuous painted trunk: only the lower ribbed section telescopes.
   // Mixing the new head with the old body2/body3 left a visible horizontal seam.
   const split=Math.round(im.height*.62),top=h*.62,width=w*1.23;
   ctx.drawImage(im,0,0,im.width,split,-2,0,width,top);
   const left=width*.123-2,right=width*.73-2,bottom=h+extension;
   ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-10-top);ctx.clip();
   ctx.drawImage(im,0,split,im.width,im.height-split-4,-2,top,width,h-top+extension-10);ctx.restore();
   ctx.strokeStyle='#23350d';ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom-12);ctx.moveTo(right,top);ctx.lineTo(right,bottom-12);ctx.stroke();
   const thorns=pictures.IMAGE_REANIM_CACTUS_BODY3;
   // Retain the native base's silhouette and shadow, with the current skin palette.
   const cap=cactusBase(ctx,faceState,im,width,left,right);
   if(cap)ctx.drawImage(cap,left-3,bottom-18,right-left+6,22);else if(thorns)ctx.drawImage(thorns,6,34,52,19,left-3,bottom-18,right-left+6,22);
   if(thorns&&extension>8)for(let y=top+12;y<bottom-12;y+=23){ctx.drawImage(thorns,0,18,12,7,left-9,y,12,7);if(y+11<bottom-10)ctx.drawImage(thorns,52,27,10,7,right-2,y+11,10,7);}
   return true;
  }
  if(id==='IMAGE_REANIM_CHOMPER_TOPJAW')return part(ctx,'chomper-jaws-v2',0,0,0,w,h);
  if(id==='IMAGE_REANIM_CHOMPER_UNDERJAW')return part(ctx,'chomper-jaws-v2',1,0,0,w,h);
  if(id==='IMAGE_REANIM_CHOMPER_INSIDEMOUTH')return part(ctx,'chomper-interior-v2',0,0,0,w,h);
  if(id==='IMAGE_REANIM_CHOMPER_TONGUE')return part(ctx,'chomper-interior-v2',1,0,0,w,h);
  if(id==='IMAGE_REANIM_WALLNUT_BODY'||/^IMAGE_REANIM_WALLNUT_CRACKED[12]$/.test(id))return part(ctx,'guard-wallnut',id.endsWith('1')?1:id.endsWith('2')?2:0,0,0,w,h);
  return false;
 }
 const shadow=(ctx,x,y,w=34)=>{ctx.save();ctx.fillStyle='#173b2940';ctx.beginPath();ctx.ellipse(x,y,w,8,0,0,Math.PI*2);ctx.fill();ctx.restore();};
 const visible=f=>f&&f.i&&f.f>=0&&f.a>0;
 const matrix=f=>{const x=f.kx*Math.PI/180,y=f.ky*Math.PI/180;return [Math.cos(x)*f.sx,Math.sin(x)*f.sx,-Math.sin(y)*f.sy,Math.cos(y)*f.sy,f.x,f.y];};
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 function inverse(m){const d=m[0]*m[3]-m[1]*m[2];return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
 function frameIndex(a,clip,time,once=false){const range=a.clips[clip]||a.clips.idle||{start:0,end:a.tracks[0].frames.length-1},offset=Math.max(0,Math.floor(time*a.fps));return range.start+(once?Math.min(offset,range.end-range.start):offset%(range.end-range.start+1));}
 function actor(ctx,key,clip,time,x,foot,scale=1,variant='normal',options={}){
  const a=assets.actors[key],index=frameIndex(a,clip,time,options.once);
  const origin=key==='zombie'||key==='balloon'||key==='digger'?[43,120]:key==='mower'?[36,48]:key==='boss'?[30,74]:[36,75];
  ctx.save();ctx.translate(x-origin[0]*scale,foot-origin[1]*scale);ctx.scale(scale,scale);
  for(const t of a.tracks){
   if(available('pea-head-v2')&&key==='pea'&&/headleaf|mouth|eyebrow|blink/i.test(t.name))continue;
   if(available('snow-head-v2')&&key==='snow'&&/crystals|mouth|blink/i.test(t.name))continue;
   if(available(headArt[key])&&(/anim_head2|anim_tongue|anim_hair|head_eye/.test(t.name)))continue;
   if(available('cactus-face-v2')&&key==='cactus'&&/mouth|lips|blink|body2|body3|body_overlay/i.test(t.name))continue;
   if(chomperReady()&&key==='chomper'&&/bottomlip/i.test(t.name))continue;
   if(key==='zombie'){
    if(/flaghand|whitewater|mustache/.test(t.name))continue;
    if(variant==='screen'&&/^Zombie_(innerarm|outerarm)_(upper|lower|hand)$/.test(t.name))continue;if(/screendoor/.test(t.name)&&variant!=='screen')continue;if(/duckytube/.test(t.name)&&!['ducky','snorkel'].includes(variant))continue;
    if(t.name==='anim_cone'&&variant!=='cone')continue;if(t.name==='anim_bucket'&&variant!=='bucket')continue;
   }
   if(key==='sunflower'&&/sing|wink|blink/.test(t.name.toLowerCase()))continue;
   if(key==='mower'&&/tricked|dice/.test(t.name.toLowerCase()))continue;
   if(!['puff','sunshroom','fumeshroom','plantern','blover','coffee','cabbagepult','flowerpot','lily'].includes(key)&&key!=='zombie'&&/blink|sleep/.test(t.name.toLowerCase()))continue;
   let f=t.frames[index]||t.frames.at(-1),transform=null;
   // Shooting contains head tracks only; the stem keeps its independent idle clock.
   if((key==='pea'||key==='snow')&&clip==='shooting'&&/^(backleaf|stalk|frontleaf)/.test(t.name)){
    const base=a.clips.full_idle;f=t.frames[base.start+Math.floor(Math.max(0,options.baseTime??time)*a.fps)%(base.end-base.start+1)];
   }
   // The original game launched a separate severed-head animation. Keep both
   // complete story faces and classic head/jaw parts attached to the body here.
   if(!visible(f)&&clip==='death'&&/^(anim_head[12]|anim_tongue|anim_hair)$/.test(t.name)){
    const anchor=a.tracks.find(t=>t.name===({zombie:'Zombie_neck',balloon:'Zombie_balloon_body2',digger:'Zombie_digger_body'})[key]);
    const ref=a.clips.walk.start,head=t.frames[ref],base=anchor.frames[ref],current=anchor.frames[index];
    if(visible(current)&&visible(head)&&visible(base)){f=head;transform=multiply(matrix(current),multiply(inverse(matrix(base)),matrix(head)));}
   }
   if(key==='cactus'&&options.cactusHeight!=null){
    const low=t.frames[a.clips.idle.start],top=t.frames[a.clips.idlehigh.start],lift=options.cactusHeight;
    if(lift>0&&lift<1){const rise=a.clips.rise,pose=rise.start+Math.round(lift*(rise.end-rise.start));f=t.frames[pose]||f;}
    else if(lift===0&&/high/.test(clip))f=low;
    else if(lift===1&&!/high/.test(clip))f=top;
   }
   if(!visible(f))continue;
   // Keep the last body pose, then bend into the death track.
   // Interpolate bones, not whole sprites: this never draws two faces at once.
   if(options.fromPose&&options.poseBlend<1){const from=t.frames[options.fromPose.index];if(visible(from)){const start=matrix(from),end=transform||matrix(f);transform=start.map((v,i)=>v+(end[i]-v)*options.poseBlend);}}
   let id=f.i;
   if(key==='wallnut'&&t.name==='anim_face'&&options.plantStage>0)id='IMAGE_REANIM_WALLNUT_CRACKED'+options.plantStage;
   if(options.injuredArm){
    if(/outerarm_(lower|hand)$/.test(t.name))continue;
    if(/outerarm_upper$/.test(t.name)&&assets.images[id+'2'])id+='2';
   }
   if((t.name==='anim_cone'||t.name==='anim_bucket')&&options.armorStage>1)id=id.replace(/1$/,String(options.armorStage));
   const info=assets.images[id],im=pictures[id];if(!im||!info)continue;
   ctx.save();ctx.globalAlpha*=f.a;ctx.transform(...(transform||matrix(f)));
   const w=im.width/info.cols,h=im.height/info.rows,frame=Math.max(0,Math.floor(f.f));
   if(!characterPart(ctx,id,w,h,options.faceState||0,key==='cactus'&&id==='IMAGE_REANIM_CACTUS_BODY1'?Math.max(0,(t.frames[a.clips.idle.start].y-f.y)/Math.abs(f.sy)):0))ctx.drawImage(im,(frame%info.cols)*w,Math.floor(frame/info.cols)*h,w,h,0,0,w,h);ctx.restore();
  }
  ctx.restore();
 }
 function drawPlant(ctx,p,{x=p.x,foot=ROW_FOOT(p.row),time=0,scale=FIELD_VIEW.plantScale[p.type]||.9,reducedMotion=false,dead=p.hp<=0,high=false}={}){
  const state=plantState(p),shoot=p.type==='wallnut'?false:p.type==='chomper'?p.windup>0||p.attack>0:p.attack>0||p.shot<=.35;
  const lastPose=dead?plantPoses.get(p.poseSource||p):null;
  let clip=p.type==='pea'||p.type==='snow'?(shoot?'shooting':'full_idle'):p.type==='chomper'?(p.windup>0||p.attack>0?'bite':'idle'):p.type==='cactus'?(shoot?(high?'shootinghigh':'shooting'):(high?'idlehigh':'idle')):'idle';
  if(['puff','fumeshroom','cabbagepult'].includes(p.type))clip=shoot?'shooting':'idle';if(p.type==='sunshroom')clip=(p.growth||0)>=120?'bigidle':'idle';if(p.sleeping)clip=p.type==='sunshroom'&&(p.growth||0)>=120?'bigsleep':'sleep';if(p.type==='blover'&&p.windStarted!=null)clip='blow';if(p.type==='coffee')clip='crumble';
  let cactusHeight;
  if(p.type==='cactus'){
   const target=high?1:0,previous=plantPoses.get(p);
   if(dead&&lastPose)cactusHeight=lastPose.height;
   else if(!previous||time<previous.time||reducedMotion)cactusHeight=target;
   else{const step=Math.max(0,time-previous.time)/.48;cactusHeight=previous.height<target?Math.min(target,previous.height+step):Math.max(target,previous.height-step);}
  }
  let animTime=reducedMotion?0:time;
  if(shoot&&['pea','snow','cactus'].includes(p.type)){const range=assets.actors[p.type].clips[clip];animTime=(p.attack>0?.35+(.55-p.attack):Math.max(0,.35-p.shot))/.9*(range.end-range.start)/assets.actors[p.type].fps;}
  if(p.type==='chomper'&&(p.windup>0||p.attack>0))animTime=(p.windup>0?.45-p.windup:.45+(.5-p.attack))/.95*2;
  if(reducedMotion)animTime=0;
  // Rescue specials supply their actual lifecycle clock (bite / chew / swallow).
  // Legacy callers continue using the original pose selection above.
  if(p.animation&&assets.actors[p.type].clips[p.animation.clip]){clip=p.animation.clip;animTime=p.animation.time;}
  if(lastPose){clip=lastPose.clip;animTime=lastPose.animTime;}
  if(!dead)plantPoses.set(p,{height:cactusHeight,time,clip,animTime,lean:state.stage*.035});
  ctx.save();ctx.translate(x,foot);
  const hit=Math.max(0,(p.hit||0)-(dead?time:0));
  if(hit>0&&!reducedMotion){ctx.translate(-3*hit/.14,0);ctx.filter=`brightness(${1+hit/.14*.45})`;}
  if(dead){ctx.globalAlpha*=Math.max(0,1-time/p.duration);if(!reducedMotion)ctx.rotate((lastPose?.lean||0)*Math.max(0,1-time/.18)-Math.min(1,time/p.duration)*.85);}
  else if(!reducedMotion)ctx.rotate(state.stage*.035);
  const [groundX,baseY]=plantGround[p.type]||[0,0],groundY=p.type==='cactus'&&available('cactus-face-v2')?-9:baseY;
  actor(ctx,p.type,clip,animTime,-groundX*scale,-groundY*scale,scale,'normal',{plantStage:state.stage,cactusHeight:p.cactusHeight??cactusHeight,once:p.animation?.once??shoot,baseTime:lastPose?.time??time,faceState:p.hit>0||state.stage>0||dead?2:shoot?1:0});
  const paintedDamage=available(({pea:'pea-head-v2',snow:'snow-head-v2',sunflower:'sunflower-face-v2',cactus:'cactus-face-v2'})[p.type]);
  if(state.stage>0&&p.type!=='wallnut'&&!dead&&!paintedDamage){ctx.strokeStyle='#485b35';ctx.lineWidth=1.7*scale;for(let i=0;i<state.stage+1;i++){const dx=(-8+i*12)*scale;ctx.beginPath();ctx.moveTo(dx,-47*scale);ctx.lineTo(dx+4*scale,-41*scale);ctx.lineTo(dx,-35*scale);ctx.stroke();}}
  if(p.type==='sunflower'&&p.attack>0&&!reducedMotion){ctx.strokeStyle='#e7d178';ctx.lineWidth=2;ctx.globalAlpha*=p.attack/.7;ctx.beginPath();ctx.ellipse(0,-15,38+(1-p.attack/.7)*22,13,0,0,Math.PI*2);ctx.stroke();}
  if(p.type==='chomper'&&p.windup>0){label(ctx,'!',0,-82*scale,20,'#ffda8c');}
  ctx.restore();
 }
 function drawZombie(ctx,z,{x=z.x,foot=ROW_FOOT(z.row),time=z.age,reducedMotion=false,scale=FIELD_VIEW.zombieScale[z.type]||.8,dead=false,stationary=false}={}){
  const state=zombieState(z),isDead=dead||z.hp<=0;
  const lastPose=isDead?zombiePoses.get(z.poseSource||z):null;
  const pop=z.type==='balloon'&&z.pop>0&&!isDead,emerge=z.emerging>0&&!isDead;
  const clip=isDead?'death':pop?'pop':emerge?'landing':z.airborne?'idle':z.attacking?'eat':stationary?'idle':'walk';
  const popRange=assets.actors[state.key].clips.pop;
  const clipTime=isDead?time*(z.source==='mower'?6:1):pop?(reducedMotion?.6:.72-z.pop)/.72*(popRange.end-popRange.start)/assets.actors[state.key].fps:emerge?1.2-z.emerging:reducedMotion?0:time;
  const hit=reducedMotion?0:Math.max(0,(z.hit||0)-(isDead?time:0))/.18;
  const settle=Math.max(0,1-time/.18);
  const lean=isDead?(lastPose?.lean||0)*settle:z.airborne?0:state.bodyStage===2?-.13:state.bodyStage===1?-.055:0;
  const bob=reducedMotion?0:isDead?(lastPose?.bob||0)*settle:z.airborne?0:state.bodyStage*Math.sin(time*5)*1.6;
  const poseBlend=Math.min(1,Math.max(0,time)/.18),blend=poseBlend*poseBlend*(3-2*poseBlend);
  const startLift=lastPose?.lift??(z.airborne?40:z.pop>0?40*z.pop/.72:0);
  const lift=isDead?(reducedMotion?0:startLift*Math.max(0,1-(time/.5)**2)):z.airborne?40:pop?40*Math.max(0,z.pop/.72):0;
  ctx.save();
  if(isDead){ctx.globalAlpha*=Math.min(1,Math.max(0,(z.duration-time)/.55));if(z.source==='mower')ctx.globalAlpha*=.65;}
  const filters=[];if(z.slow>0)filters.push('sepia(.35) hue-rotate(130deg) saturate(1.25)');if(hit>0)filters.push(`brightness(${1+hit*.9})`);if(filters.length)ctx.filter=filters.join(' ');
  ctx.translate(x+hit*(state.bodyStage?5:3),foot-lift+bob);
  if(!reducedMotion)ctx.rotate(lean+hit*.055);
  let groundY=z.type==='balloon'&&!isDead?(z.airborne?-2:pop?-2+19*Math.min(1,(.72-z.pop)/.16):17):(zombieGround[z.type]||0);
  if(lastPose&&!reducedMotion)groundY=lastPose.groundY+(groundY-lastPose.groundY)*blend;
  actor(ctx,state.key,clip,clipTime,0,-groundY*scale,scale,['screen','ducky','snorkel'].includes(z.unitKind)?z.unitKind:state.armorStage?z.type:'normal',{armorStage:state.armorStage,injuredArm:state.bodyStage===2,once:isDead||pop||emerge,fromPose:reducedMotion||z.source==='mower'?null:lastPose,poseBlend:blend,faceState:z.hit>0||state.bodyStage>0||isDead?2:z.attacking?1:0});
  if(!isDead)zombiePoses.set(z,{index:frameIndex(assets.actors[state.key],clip,clipTime,pop||emerge),groundY,lift,lean,bob});
  ctx.restore();
  if(z.attacking&&!isDead&&!reducedMotion&&Math.floor(time*5)%3===0){ctx.save();ctx.strokeStyle='#e8dba2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-48,foot-43);ctx.lineTo(x-57,foot-50);ctx.moveTo(x-46,foot-36);ctx.lineTo(x-57,foot-32);ctx.stroke();ctx.restore();}
 }
 function drawEffect(ctx,e,reducedMotion=false){
  if(reducedMotion)return;
  const t=e.age/e.duration,y=220+e.row*96-(e.airborne?40:0);
  ctx.save();ctx.globalAlpha=1-t;
  if(e.kind==='armor'){
   const im=pictures[e.unit==='cone'?'IMAGE_REANIM_ZOMBIE_CONE3':'IMAGE_REANIM_ZOMBIE_BUCKET3'];
   if(im){ctx.translate(e.x+35*t,y-74-42*Math.sin(t*Math.PI)+60*t);ctx.rotate(t*2.4);ctx.drawImage(im,-22,-22,44,44);}
  }else{ctx.strokeStyle=e.kind==='snow'||e.kind==='electric'?'#b9f2ff':e.kind==='metal'?'#ffe3a2':'#c0df65';ctx.lineWidth=2;for(let i=0;i<5;i++){const a=i*1.25+1.2,r=5+18*t;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*r,y-9+Math.sin(a)*r);ctx.lineTo(e.x+Math.cos(a)*(r+4),y-9+Math.sin(a)*(r+4));ctx.stroke();}}
  ctx.restore();
 }
 function bar(ctx,x,y,hp,max,w=52,color='#a4c66a'){
  ctx.fillStyle='#1c271de0';ctx.fillRect(x-w/2-1,y-1,w+2,7);ctx.fillStyle=color;ctx.fillRect(x-w/2,y,w*Math.max(0,hp/max),5);
 }
 function label(ctx,text,x,y,size=13,color='#f1e6ba',align='center'){
  ctx.font=`${size}px ${font}`;ctx.textAlign=align;ctx.fillStyle='#1d2d1a';ctx.fillText(text,x+1,y+2);ctx.fillStyle=color;ctx.fillText(text,x,y);
 }
 function drawProgress(ctx,b){
  const meter=pictures['ui:FlagMeter.png'],parts=pictures['ui:FlagMeterParts.png'];
  if(!meter||!parts)return;
  // These two flags track actual spent mower lanes, rather than elapsed time.
  const lanes=b.mowers.map(m=>m.state==='spent'?1:m.state==='running'?Math.max(0,Math.min(1,(m.x-145)/(1190-145))):0).sort((a,c)=>c-a);
  const progress=b.status==='won'?1:Math.min(1,(lanes[0]+lanes[1])/2);
  const x=988,y=686,w=190,h=32.5,frame=meter.height/2,part=parts.width/3;
  ctx.drawImage(meter,0,0,meter.width,frame,x,y,w,h);
  if(progress>0)ctx.drawImage(meter,meter.width*(1-progress),frame,meter.width*progress,frame,x+w*(1-progress),y,w*progress,h);
  for(let i=1;i<=2;i++){ctx.save();ctx.globalAlpha=b.clearedRows>=i?1:.4;actor(ctx,'mower','normal',0,x+w*(1-i/2)+5,y-1,.38);ctx.restore();}
  ctx.drawImage(parts,0,0,part,parts.height,x+w*(1-progress)-13,y+1,30,30);
  label(ctx,b.status==='won'?(b.winReason==='door'?'已进门 · 突破成功':'突破成功'):`小车 ${Math.min(2,b.clearedRows)} / 2 · 或直接进门`,1095,665,13,'#fff0bd');
 }
 function paintBackground(ctx,night=false){
  const bg=pictures[night?'ui:background2.jpg':'ui:background1.jpg'];
  // Native nine 80px cells keep their spacing. Extend just one additional cell,
  // rather than stretching nine painted columns across ten logical columns.
  if(bg){
   // Fence and paving remain continuous; only turf receives the extra column.
   for(const [sy,sh,dy,dh] of [[0,188/1.72,0,188],[572-16*28/68,28+16*28/68,636,84]])for(const [sx,sw,dx,dw] of [[100,160,0,180],[260,720,180,800],[980,320,980,320]])ctx.drawImage(bg,sx,sy,sw,sh,dx,dy,dw,dh);
   const columns=[[100,160,0,180],[260,720,180,720],[820,80,900,80],[980,320,980,320]],slice=(y,h,alpha)=>{ctx.save();ctx.globalAlpha=alpha;for(const [sx,sw,dx,dw]of columns)ctx.drawImage(bg,sx,100+(y-172)*472/480,sw,h*472/480,dx,y,dw,h);ctx.restore();};
   slice(188,448,1);
   // Feather the fence/grass and grass/paving joins; these strips are cached.
   for(let y=156;y<188;y+=2)slice(y,2,(y-155)/32);
   for(let y=636;y<668;y+=2)slice(y,2,(667-y)/32);
  }
  const refuge=pictures['story:refuge-strip'];
  if(refuge){ctx.save();ctx.beginPath();ctx.rect(884,FIELD.rowTop,112,FIELD.rows*FIELD.rowHeight);ctx.clip();ctx.drawImage(refuge,868,159,150,525);ctx.restore();}
 }
 function drawBackground(ctx,night=false){const key=night?'night':'day';let background=backgrounds.get(key);if(!background){background=surface(ctx,1200,720);if(background){paintBackground(background.getContext('2d'),night);backgrounds.set(key,background);}}if(background)ctx.drawImage(background,0,0);else paintBackground(ctx,night);}
 function drawGrid(ctx){
  ctx.save();ctx.lineWidth=1;ctx.strokeStyle='#f4e4a988';ctx.setLineDash([4,5]);
  for(let c=0;c<=FIELD.columns;c++){const x=FIELD.gridLeft+c*FIELD.columnWidth;ctx.beginPath();ctx.moveTo(x,FIELD.rowTop);ctx.lineTo(x,FIELD.rowTop+FIELD.rows*FIELD.rowHeight);ctx.stroke();}
  for(let r=0;r<=FIELD.rows;r++){const y=FIELD.rowTop+r*FIELD.rowHeight;ctx.beginPath();ctx.moveTo(FIELD.gridLeft,y);ctx.lineTo(FIELD.lawnRight,y);ctx.stroke();}
  ctx.setLineDash([]);for(let c=0;c<FIELD.columns;c++)label(ctx,`${c+1} · ${COLUMN_X(c)}`,COLUMN_X(c),164,11,c===9?'#ffdf97':'#f4e4a9');
  for(let r=0;r<FIELD.rows;r++){label(ctx,`${r+1}`,162,ROW_Y(r)+5,13);ctx.strokeStyle='#efc67999';ctx.beginPath();ctx.moveTo(FIELD.gridLeft,ROW_FOOT(r));ctx.lineTo(FIELD.lawnRight,ROW_FOOT(r));ctx.stroke();for(let c=0;c<FIELD.columns;c++){ctx.fillStyle='#f8e4a9';ctx.fillRect(COLUMN_X(c)-2,ROW_FOOT(r)-2,4,4);}}
  ctx.restore();
 }
 function drawTomb(ctx,t){
  const x=FIELD.tombX,foot=ROW_FOOT(t.row);shadow(ctx,x,foot+2,29);
  if(!tombImage)return;
  const damage=t.hp<=0?3:t.hp<t.maxHp*.35?2:t.hp<t.maxHp*.7?1:0,column=[0,1,4,2,3][t.row],base=tombCrops[column],crop=[...tombCrops[damage*5+column]];
  const scale=Math.min(FIELD_VIEW.tombWidth/base[2],FIELD_VIEW.tombHeight/base[3]);
  if(t.hp<=0){const height=Math.min(25,crop[3]);crop[1]+=crop[3]-height;crop[3]=height;}
  const w=crop[2]*scale,h=crop[3]*scale;ctx.drawImage(tombImage,...crop,x-w/2,foot-h,w,h);
 }
 function drawTombStatus(ctx,t,hi){
  const x=FIELD.tombX,y=ROW_FOOT(t.row);
  if(t.hp>0){bar(ctx,x,y+8,t.hp,t.maxHp,60);if(t.hp<t.maxHp||hi===t.row)label(ctx,`${Math.ceil(t.hp)}`,x-34,y+12,11,'#f4e8be','right');}else label(ctx,'已失守 · 0 / 1000',x,y+14,10,'#d8bb92');
 }
 function draw(ctx,b,{hoverRow=-1,selectedRow=2,reducedMotion=false,grid=false}={}){
  ctx.clearRect(0,0,1200,720);drawBackground(ctx,b.config.night);if(grid)drawGrid(ctx);
  const hi=hoverRow>=0?hoverRow:selectedRow;
  if(hi>=0&&b.status==='playing'){ctx.fillStyle='#e9dd6b18';ctx.fillRect(150,172+hi*96,830,96);ctx.strokeStyle='#fff2a975';ctx.setLineDash([7,9]);ctx.strokeRect(995,183+hi*96,61,75);ctx.setLineDash([]);}
  for(const h of b.hazards||[]){const y=220+h.row*96;ctx.save();ctx.fillStyle=h.state==='active'?'#8ddbe055':h.state==='warning'?'#f9d47855':'#273b373b';ctx.fillRect(h.x-h.width/2,y-43,h.width,83);ctx.strokeStyle=h.state==='active'?'#9fedff':h.state==='warning'?'#ffe28d':'#647d65';ctx.lineWidth=2;ctx.strokeRect(h.x-h.width/2,y-43,h.width,83);if(h.state==='active'&&!reducedMotion){ctx.beginPath();ctx.moveTo(h.x-12,y-38);ctx.lineTo(h.x+11,y-8);ctx.lineTo(h.x-9,y+10);ctx.lineTo(h.x+10,y+32);ctx.stroke();}label(ctx,h.state==='active'?'通电':h.state==='warning'?'预警':'电网',h.x,y+53,10);ctx.restore();}
  for(const s of b.supplies||[]){if(s.collected)continue;const y=220+s.row*96;if(!sprite(ctx,'story-props',2,s.x-27,y-19,54,54))label(ctx,'口粮箱',s.x,y+20,13);label(ctx,'口粮 +'+s.energy,s.x,y+50,12,'#fff0bd');}
  for(const action of b.storyActions||[]){
   const y=220+action.row*96,gate=action.kind==='cell';
   if(action.completed&&!gate)continue;
   const frame=gate?(action.completed?1:0):action.kind==='food'?2:3;
   const w=gate?64:50,h=gate?75:51;
   if(!sprite(ctx,'story-props',frame,action.x-w/2,y+33-h,w,h))label(ctx,action.title,action.x,y,12);
   label(ctx,action.completed?'已接应 · 胜利后撤离':action.progress>0?`接应 ${Math.ceil(action.progress/2*100)}%`:action.title,action.x,y+49,12,action.completed?'#ffe9a1':'#fff2ca');
  }
  const sorted=[...b.zombies].sort((a,c)=>a.row-c.row||a.x-c.x);
  // Back rows first. The stone is behind its own lane's moving characters;
  // Each lane's HP follows its characters, before the next lane's tall hats.
  for(let row=0;row<FIELD.rows;row++){
   const foot=ROW_FOOT(row),t=b.tombs.find(t=>t.row===row);if(t)drawTomb(ctx,t);
   for(const p of b.plants){if(p.row!==row||p.hp<=0)continue;shadow(ctx,p.x,foot+2,p.type==='cactus'?24:29);const high=p.type==='cactus'&&b.zombies.some(z=>z.hp>0&&z.row===row&&z.airborne&&z.x>p.x);drawPlant(ctx,p,{time:b.time+p.id*.4,reducedMotion,high});}
   for(const p of b.plantRemains||[])if(p.row===row)drawPlant(ctx,p,{time:p.age,reducedMotion,dead:true});
   for(const z of b.corpses||[])if(z.row===row)drawZombie(ctx,z,{dead:true,reducedMotion,time:reducedMotion?Math.max(0,z.duration-.65):z.age});
   for(const z of sorted){if(z.row!==row)continue;if(z.underground){ctx.fillStyle='#7a6442';ctx.beginPath();ctx.ellipse(z.x,foot+1,22,7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#aa9870';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(z.x-17,foot);ctx.lineTo(z.x-6,foot-7);ctx.lineTo(z.x+2,foot);ctx.lineTo(z.x+14,foot-5);ctx.stroke();continue;}shadow(ctx,z.x,foot+2,z.airborne?20:26);drawZombie(ctx,z,{reducedMotion});}
   for(const m of b.mowers){if(m.row!==row||m.state==='spent')continue;shadow(ctx,m.x,foot+2,25);actor(ctx,'mower','normal',m.state==='running'?m.age:0,m.x,foot,.84);}
   if(t)drawTombStatus(ctx,t,hi);
  }
  for(const e of b.effects||[])drawEffect(ctx,e,reducedMotion);
  for(const shot of b.bullets){const y=211+shot.row*96-(shot.air?56:0);ctx.fillStyle=shot.snow?'#9ce4f0':shot.antiAir?'#c9ac74':'#7faa25';ctx.strokeStyle=shot.snow?'#e2fbff':'#315d18';ctx.lineWidth=2;ctx.beginPath();ctx.arc(shot.x,y,shot.antiAir?5:7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#f1ffc9aa';ctx.beginPath();ctx.arc(shot.x-2,y-3,2.2,0,Math.PI*2);ctx.fill();}
  drawProgress(ctx,b);
 }
 return {draw,drawBackground,actor,drawZombie,drawEffect,drawPlant,setArtStyle(value){artStyle=value==='classic'?'classic':'story';}};
}
const api={createRenderer,zombieState,damageSamples,plantState,plantSamples,FIELD_VIEW};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_RENDER=api;
})(typeof window!=='undefined'?window:globalThis);
