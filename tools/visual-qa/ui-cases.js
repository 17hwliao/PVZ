// A separate visual fixture. Campaign saves live only in this closure; the
// real localStorage is never read, changed, cleared or replaced on disk.
(()=>{
 const saved={version:2,unlocked:['normal','cone','bucket','balloon','digger'],completed:[0,1,2,3,4,5],highest:6,currentLevel:6,deck:['normal','cone','bucket','balloon','digger'],lettersSeen:[0,1,2,3,4,5],uiTheme:'wood',characterArt:'story',prologue:{version:2,status:'completed'}};
 const memory=new Map([['pvz-rise-slice-progress-v1',JSON.stringify(saved)]]);
 Object.defineProperty(window,'localStorage',{value:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key),clear:()=>memory.clear()}});
 document.title='临时 UI 校对 · 不写冒险存档';
 const label=document.createElement('p');label.textContent='视觉校对专用 · 临时进度 · 不写冒险存档';label.style.cssText='position:fixed;z-index:1000;bottom:0;left:0;right:0;margin:0;padding:3px;text-align:center;background:#273b25;color:#eee0aa;font:12px sans-serif;pointer-events:none';document.body.append(label);
})();
