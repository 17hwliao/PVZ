// Execute the actual QA fixture with a small DOM/canvas double. This checks
// repeated sample lifecycle events; visual quality is verified from real images.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const PVZ=require('../game/engine.js'),elements=new Map();
const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
function element(){return {disabled:false,hidden:false,value:'',checked:true,append(){},setAttribute(){},getContext:()=>ctx};}
for(const id of ['play','retry','reset','freeze','time','art','sampling','state','arrangement','seek','status','clock','plants','zombies','scene','grid'])elements.set(id,element());
for(const[id,value]of Object.entries({art:'story',sampling:'soft',state:'transition',arrangement:'contacts',seek:'1.15'}))elements.get(id).value=value;
let nextFrame,lastBattle,errors=[];
const assetsBox={window:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../game/assets-data.js'),'utf8'),assetsBox);
class ImageDouble{set src(value){queueMicrotask(()=>this.onload());}}
const sandbox={PVZ,PVZ_ASSETS:assetsBox.window.PVZ_ASSETS,PVZ_RENDER:{createRenderer:()=>({setArtStyle(){},drawPlant(){},drawZombie(){},draw(_ctx,b){lastBattle=b;}})},document:{getElementById:id=>elements.get(id),querySelectorAll:()=>[...elements.values()],createElement:element},Image:ImageDouble,requestAnimationFrame:fn=>nextFrame=fn,setTimeout,clearTimeout,console:{error:e=>errors.push(e)},location:{reload(){}}};
(async()=>{vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../tools/visual-qa/visual-qa.js'),'utf8'),sandbox);await new Promise(setImmediate);assert.equal(errors.length,0);assert.equal(typeof nextFrame,'function');
for(const style of ['story','classic'])for(const moment of ['1','1.15','1.3','1.5']){
 elements.get('art').value=style;elements.get('seek').value=moment;elements.get('freeze').onclick();
 for(let frame=0;frame<12;frame++){nextFrame(frame*16);assert.equal(lastBattle.corpses.length,8);assert.equal(lastBattle.plantRemains.length,8);for(const corpse of [...lastBattle.corpses,...lastBattle.plantRemains])assert(corpse.poseSource,`${style} ${moment}, frame ${frame}: previous death flag leaked into a fresh source`);}
}
assert.equal(errors.length,0);console.log('PASS 动态校对页两画风连续96帧退场保留真实死亡来源，不复用上一帧死亡标记');
})().catch(e=>{console.error(e);process.exitCode=1;});
