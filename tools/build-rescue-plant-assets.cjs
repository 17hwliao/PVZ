// Extract native tracks and images without changing the original resource files.
// Usage: node tools/build-rescue-plant-assets.cjs <extracted resource directory>
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(process.argv[2]||''),game=path.resolve(__dirname,'../game');
if(!process.argv[2]||!fs.existsSync(path.join(source,'reanim/Squash.reanim')))throw Error('Provide an extracted classic resource directory');
const text=fs.readFileSync(path.join(source,'reanim/Squash.reanim'),'utf8'),tracks=[],clips={},images={},entries=[];
for(const match of text.matchAll(/<track>([\s\S]*?)<\/track>/g)){
 const name=match[1].match(/<name>([^<]*)<\/name>/)?.[1]||'',frames=[];let state={x:0,y:0,kx:0,ky:0,sx:1,sy:1,f:0,a:1,i:''};
 for(const frame of match[1].matchAll(/<t>([\s\S]*?)<\/t>/g)){
  state={...state};for(const v of frame[1].matchAll(/<(x|y|kx|ky|sx|sy|f|a|i)>([^<]*)<\/\1>/g))state[v[1]]=v[1]==='i'?v[2]:Number(v[2]);frames.push({...state});
 }
 if(frames.some(f=>f.i))tracks.push({name,frames});
 else if(name.startsWith('anim_')){const visible=frames.flatMap((f,i)=>f.f>=0?[i]:[]);if(visible.length)clips[name.slice(5)]={start:visible[0],end:visible.at(-1)};}
}
const nativeFiles=fs.readdirSync(path.join(source,'reanim'));
for(const id of new Set(tracks.flatMap(t=>t.frames.map(f=>f.i)).filter(Boolean))){
 const file=nativeFiles.find(f=>'IMAGE_REANIM_'+path.basename(f,'.png').toUpperCase()===id&&f.endsWith('.png'));if(!file)throw Error('Missing native image '+id);
 const relative='assets/rescue-plants/'+file,bytes=fs.readFileSync(path.join(source,'reanim',file));fs.mkdirSync(path.dirname(path.join(game,relative)),{recursive:true});fs.writeFileSync(path.join(game,relative),bytes);
 images[id]={path:relative,cols:1,rows:1};entries.push({file:relative,source:'reanim/'+file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
const payload={actors:{squash:{fps:Number(text.match(/<fps>([^<]+)/)[1]),tracks,clips}},images};
fs.writeFileSync(path.join(game,'rescue-plant-assets.js'),"(function(root){'use strict';const assets="+JSON.stringify(payload)+";if(typeof module!=='undefined'&&module.exports)module.exports=assets;else root.PVZ_RESCUE_PLANT_ASSETS=assets;})(typeof window!=='undefined'?window:globalThis);\n");
fs.writeFileSync(path.join(game,'assets/rescue-plants/provenance.json'),JSON.stringify({description:'Native Squash animation and original image parts from the locally supplied classic game. No generated replacement artwork.',animation:{source:'reanim/Squash.reanim',sha256:crypto.createHash('sha256').update(text).digest('hex')},entries},null,2)+'\n');
console.log(JSON.stringify({actor:'squash',images:entries.length,clips}));
