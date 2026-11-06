const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const game=path.resolve(__dirname,'../../game');
async function boot(file='terrain-campaign.html',query='?trial=1&level=0',saved={}){
 const html=fs.readFileSync(path.join(game,file),'utf8'),dom=new JSDOM(html,{url:'http://localhost/'+file+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;let scene,frame,lastPaint,now=0;
 for(const[k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
 w.structuredClone=structuredClone;w.matchMedia=()=>({matches:false});w.requestAnimationFrame=f=>(frame=f,1);w.HTMLCanvasElement.prototype.getContext=()=>({});w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:17,top:-61,width:600,height:360});w.Image=class{set src(v){queueMicrotask(()=>this.onload?.());}};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 for(const f of [...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]).filter(f=>f!=='rescue-design.js'))w.eval(fs.readFileSync(path.join(game,f),'utf8'));
 const m=w.PVZ_RESCUE_SCENE,create=m.createScene;m.createScene=(...args)=>(scene=create(...args));w.PVZ_RENDER.createRenderer=()=>({});w.PVZ_RESCUE_PAINTER.createPainter=()=>({paint(_ctx,_scene,options){lastPaint=options;}});await w.eval(fs.readFileSync(path.join(game,'rescue-design.js'),'utf8'));
 const $=id=>w.document.getElementById(id);
 return{dom,w,$,m,get s(){return scene;},get paint(){return lastPaint;},tick(ms=200){now+=ms;frame(now);},click(row,col){const g=w.PVZ.FIELD;this.clickPixel(g.gridLeft+(col+.5)*g.columnWidth,g.rowTop+(row+.75)*g.rowHeight);},clickPixel(x,y){const r=$('scene').getBoundingClientRect();$('scene').dispatchEvent(new w.MouseEvent('click',{clientX:r.left+x*r.width/1200,clientY:r.top+y*r.height/720,bubbles:true}));},select(id=0){w.document.querySelector('[data-team="'+id+'"]').click();},action(text){if($('actionPlaque').hidden){const open=[...$('squadControls').querySelectorAll('button')].find(b=>b.textContent==='行动');if(open)open.click();}const b=[...$('actionPlaque').querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('Missing action '+text);b.click();},key(key){$('scene').dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));},storage(){return Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]));}};
}
module.exports={boot};
