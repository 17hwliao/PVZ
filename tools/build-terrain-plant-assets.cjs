// Extract original plant animation tracks and PNG parts, without altering artwork.
// Usage: node tools/build-terrain-plant-assets.cjs <extracted classic resources>
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(process.argv[2]||''),game=path.resolve(__dirname,'../game');
if(!process.argv[2]||!fs.existsSync(path.join(source,'reanim/PuffShroom.reanim')))throw Error('Provide an extracted classic resource directory');
const specifications={puff:'PuffShroom',sunshroom:'SunShroom',fumeshroom:'FumeShroom',plantern:'Plantern',blover:'Blover',coffee:'Coffeebean',cabbagepult:'Cabbagepult',flowerpot:'Pot',lily:'LilyPad'},actors={},images={},entries=[],animations=[],sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const nativeFiles=fs.readdirSync(path.join(source,'reanim')),imageIndex=new Map(nativeFiles.filter(n=>n.toLowerCase().endsWith('.png')).map(n=>['IMAGE_REANIM_'+path.basename(n,'.png').toUpperCase(),n]));
for(const[key,name]of Object.entries(specifications)){
 const relativeSource='reanim/'+name+'.reanim',bytes=fs.readFileSync(path.join(source,relativeSource)),text=bytes.toString('utf8'),tracks=[],clips={};
 for(const match of text.matchAll(/<track>([\s\S]*?)<\/track>/g)){
  const trackName=match[1].match(/<name>([^<]*)<\/name>/)?.[1]||'',frames=[];let state={x:0,y:0,kx:0,ky:0,sx:1,sy:1,f:0,a:1,i:''};
  for(const frame of match[1].matchAll(/<t>([\s\S]*?)<\/t>/g)){
   state={...state};for(const v of frame[1].matchAll(/<(x|y|kx|ky|sx|sy|f|a|i)>([^<]*)<\/\1>/g))state[v[1]]=v[1]==='i'?v[2]:Number(v[2]);frames.push({...state});
  }
  if(frames.some(f=>f.i))tracks.push({name:trackName,frames});
  else if(trackName.startsWith('anim_')){const visible=frames.flatMap((f,i)=>f.f>=0?[i]:[]);if(visible.length)clips[trackName.slice(5)]={start:visible[0],end:visible.at(-1)};}
 }
 // LilyPad's image-bearing anim_idle and blink tracks are one-frame base and
 // separate eyelid poses. Looping their combined timeline would erase its body.
 if(key==='lily'){clips.idle={start:0,end:0};clips.blink={start:1,end:3};}
 else if(!clips.idle)clips.idle={start:0,end:Math.max(...tracks.map(t=>t.frames.length))-1};
 const attack=({puff:'shooting',fumeshroom:'shooting',cabbagepult:'shooting',blover:'blow',coffee:'crumble'})[key];if(attack)clips.attack={...clips[attack]};
 if(key==='blover')clips.shooting={...clips.blow};
 if(key==='coffee')clips.shooting={...clips.crumble};
 actors[key]={fps:Number(text.match(/<fps>([^<]+)/)?.[1]||12),tracks,clips};
 animations.push({actor:key,source:relativeSource,sha256:sha(bytes),clips});
 for(const id of new Set(tracks.flatMap(t=>t.frames.map(f=>f.i)).filter(Boolean))){
  if(images[id])continue;const file=imageIndex.get(id);if(!file)throw Error('Missing original PNG '+id);
  const relative='assets/terrain-plants/'+file,imageBytes=fs.readFileSync(path.join(source,'reanim',file));fs.mkdirSync(path.dirname(path.join(game,relative)),{recursive:true});fs.writeFileSync(path.join(game,relative),imageBytes);
  images[id]={path:relative,cols:1,rows:1};entries.push({file:relative,source:'reanim/'+file,sha256:sha(imageBytes),unchanged:true});
 }
}
const supports={flowerpot:images.IMAGE_REANIM_POT_TOP.path,lily:images.IMAGE_REANIM_LILYPAD_BODY.path};
const portraits=Object.fromEntries(Object.entries({puff:'puff',sunshroom:'sunshroom',fumeshroom:'fume',plantern:'plantern',blover:'blover',coffee:'coffee',cabbagepult:'cabbage',flowerpot:'pot',lily:'lily'}).map(([type,name])=>{const relative='assets/almanac/'+name+'.webp';if(!fs.existsSync(path.join(game,relative)))throw Error('Missing existing portrait '+relative);return[type,relative];}));
const payload={actors,images,supports,portraits};
fs.writeFileSync(path.join(game,'terrain-plant-assets.js'),"(function(root){'use strict';const assets="+JSON.stringify(payload)+";if(typeof module!=='undefined'&&module.exports)module.exports=assets;else root.PVZ_TERRAIN_PLANT_ASSETS=assets;})(typeof window!=='undefined'?window:globalThis);\n");
fs.writeFileSync(path.join(game,'assets/terrain-plants/provenance.json'),JSON.stringify({description:'Native classic plant animation tracks and unchanged PNG parts from locally supplied 1.2.0.1073 resources; support images are native transparent parts, not almanac portraits. Existing almanac pictures remain UI-only.',animations,entries},null,2)+'\n');
console.log(JSON.stringify({actors:Object.fromEntries(Object.entries(actors).map(([k,v])=>[k,{tracks:v.tracks.length,clips:v.clips}])),images:entries.length,supports,portraits},null,2));
