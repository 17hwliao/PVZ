(function(root){'use strict';
// Environment art is deliberately separate from pathfinding and visibility rules.
// The caller paints actors, their foot rings and HP after this module returns.
const resources={lawn:'assets/images/background1.jpg',night:'assets/images/background2.jpg',pool:'assets/environments/background3.jpg',fog:'assets/environments/background4.jpg',roof:'assets/environments/background5.jpg','roof-night':'assets/environments/background6boss.jpg',dirt:'assets/environments/background1unsodded.jpg',underground:'assets/environments/Background_MushroomGarden.jpg',water:'assets/environments/pool.jpg','water-night':'assets/environments/pool_night.jpg',mist:'assets/environments/fog_software.png'};
const field={left:180,top:172,width:800,height:480,cellWidth:80,cellHeight:96};
function image(images,id){return images['env:'+id];}
function draw(c,map,images,time=0){
 if(!map)return;
 const theme=typeof map==='string'?map:(map.theme||map.id),night=theme==='night'||theme==='fog'||theme==='roof-night'||map.time==='night',roof=theme==='roof'||theme==='roof-night',water=theme==='pool'||theme==='canal'||theme==='fog';
 const id=roof?(night?'roof-night':'roof'):theme==='underground'?'underground':water?(night?'fog':'pool'):(night?'night':'lawn');
 const bg=image(images,id)||image(images,night?'night':'lawn');if(!bg)return;
 c.save();
 // Match the same native source strips as the production ten-column lawn.
 // A whole-scene stretch would leave its right pavement underneath column nine.
 if(theme==='underground')c.drawImage(bg,0,0,bg.width,bg.height,0,0,1200,720);
 else for(const[sy,sh,dy,dh]of(roof?[[0,230,0,172],[230,325,172,480],[555,45,652,68]]:[[0,100,0,172],[100,472,172,480],[572,28,652,68]]))for(const[sx,sw,dx,dw]of[[100,160,0,180],[260,720,180,800],[980,320,980,220]])c.drawImage(bg,sx,sy,sw,sh,dx,dy,dw,dh);
 c.beginPath();c.rect(field.left,field.top,field.width,field.height);c.clip();
 function featherGround(paint,width=18){
  // Blend only the art join. Logical cells and actor foot positions never move.
  c.save();c.beginPath();c.rect(180+width,172+width,800-width*2,480-width*2);c.clip();paint();c.restore();
  for(let n=0;n<width;n+=2){c.save();c.globalAlpha=(n+1)/width;c.beginPath();c.rect(180+n,172+n,800-n*2,2);c.rect(180+n,650-n,800-n*2,2);c.rect(180+n,174+n,2,476-n*2);c.rect(978-n,174+n,2,476-n*2);c.clip();paint();c.restore();}
 }
 if(roof){
  // Crop below the ridge so all five logical rows stand on tiles, never on sky.
  // The ridge-to-floor mapping above already joins continuously to the margins.
 }else{
  const ground=theme==='underground'?image(images,'dirt'):image(images,night?'night':'lawn');
  if(ground){const paint=()=>{
   // Preserve the original 80px painted cell width and extend one extra column.
   c.drawImage(ground,260,100,720,472,180,172,720,480);
   c.drawImage(ground,820,100,80,472,900,172,80,480);
  };if(theme==='underground')featherGround(paint,32);else paint();}
  if(theme==='underground'){
   c.fillStyle='rgba(35,42,44,.39)';c.fillRect(180,172,800,480);
   const glow=c.createRadialGradient(580,410,70,580,410,500);glow.addColorStop(0,'rgba(209,171,98,.09)');glow.addColorStop(1,'rgba(17,25,35,.4)');c.fillStyle=glow;c.fillRect(180,172,800,480);
  }
 }
 if(water){
  const rows=[...new Set(map.terrain?.waterRows||[2,3])].filter(r=>Number.isInteger(r)&&r>=0&&r<5).sort((a,b)=>a-b),surface=image(images,night?'water-night':'water');
  if(surface){
   // The original game has six pool lanes; remap only the native water surface
   // to the requested logical water rows, keeping bank edges on row borders.
   const bands=[];for(const row of rows){const last=bands[bands.length-1];if(last&&last.end===row-1)last.end=row;else bands.push({start:row,end:row});}
   for(const band of bands)c.drawImage(surface,0,0,surface.width,surface.height,180,172+band.start*96,800,(band.end-band.start+1)*96);
  }
  // The fence line is a continuous dry promenade, never five posts in water.
  const bank=image(images,night?'night':'lawn');if(bank)c.drawImage(bank,998,100,48,472,900,172,80,480);
  const timber=image(images,'pool');if(timber)for(const p of map.terrain?.bridges||[]){
   if(!Number.isInteger(p.row)||!Number.isInteger(p.col)||p.row<0||p.row>4||p.col<0||p.col>8||!rows.includes(p.row))continue;
   const left=180+p.col*80,top=172+p.row*96;
   c.save();c.fillStyle='rgba(27,35,30,.42)';c.fillRect(left-2,top,84,96);
   // Lay the native fence cross-brace flat as six timber treads. Its grain,
   // weathering and nail heads remain original artwork rather than a ladder face.
   for(let i=0;i<6;i++)c.drawImage(timber,530+(i%2)*2,10,108,33,left,top+i*16,80,17);
   c.fillStyle='rgba(55,35,27,.36)';c.fillRect(left,top,3,96);c.fillRect(left+77,top,3,96);
   if(night){c.fillStyle='rgba(26,40,72,.36)';c.fillRect(left,top,80,96);}c.restore();
  }
 }
 if(theme==='fog'){
  const mist=image(images,'mist');if(mist){c.save();c.globalAlpha=.11;const drift=Number.isFinite(time)?Math.sin(time*.13)*14:0;for(let row=0;row<3;row++)c.drawImage(mist,180-70+drift*(row%2?1:-1),240+row*132,940,160);c.restore();}
  // Visual mist is not a substitute for a real fog-of-war implementation.
 }
 c.restore();
}
const api={draw,resources,field};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_BATTLE_ENV=api;
})(typeof window!=='undefined'?window:globalThis);
