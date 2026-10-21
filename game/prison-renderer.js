(function(root){
'use strict';
function createPrisonRenderer(renderer,pictures){
 function chain(ctx,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);ctx.save();ctx.translate(x1,y1);ctx.rotate(angle);for(let x=0;x<len;x+=12){ctx.strokeStyle='#10191c';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(x,0,9,5,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#879393';ctx.lineWidth=2;ctx.stroke();}ctx.restore();}
 function draw(ctx,{panel=0,time=0,soft=false}={}){
  ctx.save();ctx.clearRect(0,0,1200,720);ctx.fillStyle='#15252b';ctx.fillRect(0,0,1200,720);
  const views=[[1,0,0],[2.3,690,65],[2.1,130,380],[1.6,180,250]],[zoom,vx,vy]=views[panel]||views[0];ctx.scale(zoom,zoom);ctx.translate(-vx,-vy);
  const wall=ctx.createLinearGradient(0,80,1200,680);wall.addColorStop(0,'#33474b');wall.addColorStop(1,'#18292e');ctx.fillStyle=wall;ctx.fillRect(0,0,1200,720);
  for(let r=0;r<10;r++)for(let c=0;c<15;c++){ctx.fillStyle=['#314348','#293b41','#36494c'][(r+c)%3];ctx.fillRect(c*90-(r%2)*45,r*59,87,56);ctx.strokeStyle='#111f2466';ctx.strokeRect(c*90-(r%2)*45,r*59,87,56);}
  ctx.fillStyle='#172126';ctx.beginPath();ctx.moveTo(0,610);ctx.lineTo(1200,585);ctx.lineTo(1200,800);ctx.lineTo(0,800);ctx.fill();ctx.strokeStyle='#67818833';for(let n=0;n<10;n++){ctx.beginPath();ctx.moveTo(n*140-100,730);ctx.lineTo(500+n*30,590);ctx.stroke();}
  ctx.fillStyle='#0b171b';ctx.strokeStyle='#56666a';ctx.lineWidth=12;ctx.fillRect(75,195,160,425);ctx.strokeRect(75,195,160,425);ctx.strokeStyle='#667575';ctx.lineWidth=5;for(let i=95;i<235;i+=30){ctx.beginPath();ctx.moveTo(i,200);ctx.lineTo(i,610);ctx.stroke();}
  // The room and chair use code-native geometry; the characters use the supplied original game resources.
  ctx.fillStyle='#112018';ctx.strokeStyle='#6e7975';ctx.lineWidth=13;ctx.fillRect(740,98,350,225);ctx.strokeRect(740,98,350,225);
  renderer.actor(ctx,'wallnut','idle',time*.3,817,292,1.12);ctx.fillStyle='#647344';for(const [x,y]of [[785,188],[807,177],[825,182]]){ctx.beginPath();ctx.ellipse(x,y,9,19,-.5,0,Math.PI*2);ctx.fill();}
  const dave=pictures['ui:CrazyDave_head.png'];ctx.fillStyle='#dfddd0';ctx.fillRect(944,238,78,72);if(dave)ctx.drawImage(dave,930,166,103,111);ctx.fillStyle='#8c9594';ctx.strokeStyle='#303c3c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(944,172);ctx.lineTo(950,140);ctx.lineTo(1002,140);ctx.lineTo(1008,173);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeRect(1007,148,15,12);
  ctx.fillStyle='#c3dfcf15';ctx.fillRect(745,105,340,210);ctx.strokeStyle='#b1d7cf33';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(765,112);ctx.lineTo(845,301);ctx.moveTo(800,112);ctx.lineTo(880,301);ctx.stroke();
  renderer.actor(ctx,'snow','full_idle',time*.25,1060,566,1.4);renderer.actor(ctx,'wallnut','idle',time*.2,304,630,1.3);
  ctx.fillStyle='#3f4c4f';ctx.strokeStyle='#111c20';ctx.lineWidth=7;ctx.fillRect(439,335,143,255);ctx.strokeRect(439,335,143,255);ctx.strokeStyle='#7a8787';ctx.lineWidth=5;for(let i=455;i<580;i+=25){ctx.beginPath();ctx.moveTo(i,350);ctx.lineTo(i,580);ctx.stroke();}
  ctx.fillStyle='#647074';ctx.fillRect(421,550,180,35);ctx.fillRect(431,580,19,76);ctx.fillRect(570,580,19,76);
  renderer.actor(ctx,'boss','idle',soft?0:time*.35,500,565,2.2);
  ctx.fillStyle='#263239';ctx.beginPath();ctx.ellipse(465,619,28,17,-.2,0,Math.PI*2);ctx.ellipse(555,620,28,17,.2,0,Math.PI*2);ctx.fill();
  chain(ctx,445,550,485,548);chain(ctx,579,552,544,546);chain(ctx,447,597,467,615);chain(ctx,580,594,551,616);
  ctx.strokeStyle='#0e171a';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(491,449);ctx.bezierCurveTo(375,370,355,450,313,553);ctx.moveTo(513,528);ctx.bezierCurveTo(390,500,400,580,321,587);ctx.stroke();
  for(const [x,y]of [[491,449],[513,528]]){ctx.fillStyle='#7c9294';ctx.strokeStyle='#b4cbd0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,10,7,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.fillStyle='#46535a';ctx.strokeStyle='#0b171c';ctx.lineWidth=7;ctx.fillRect(177,548,204,118);ctx.strokeRect(177,548,204,118);ctx.fillStyle='#75848b';ctx.beginPath();ctx.moveTo(177,548);ctx.lineTo(210,514);ctx.lineTo(395,514);ctx.lineTo(381,548);ctx.closePath();ctx.fill();ctx.stroke();
  for(let i=0;i<3;i++){ctx.fillStyle=['#8b3834','#b6aa5d','#7aaca4'][i];ctx.beginPath();ctx.arc(220+i*39,537,8,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#222e32';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(332,531);ctx.lineTo(345,panel===2?505:493);ctx.stroke();
  if(panel===2){const hand=pictures.IMAGE_REANIM_ZOMBIE_OUTERARM_HAND;if(hand)ctx.drawImage(hand,321,464,56,62);}
  if(panel===3){const glow=ctx.createRadialGradient(500,445,20,500,445,210);glow.addColorStop(0,'#cce9ed66');glow.addColorStop(1,'#78b9e000');ctx.fillStyle=glow;ctx.fillRect(280,220,450,450);ctx.strokeStyle='#98d9ea';ctx.lineWidth=3;for(const ox of [-1,1]){ctx.beginPath();ctx.moveTo(500+ox*20,448);ctx.lineTo(500+ox*44,420);ctx.lineTo(500+ox*34,401);ctx.lineTo(500+ox*60,382);ctx.stroke();}}
  ctx.restore();
 }
 return{draw};
}
const api={createPrisonRenderer};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_PRISON=api;
})(typeof window!=='undefined'?window:globalThis);
