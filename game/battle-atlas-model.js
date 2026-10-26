(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports,maps=node?require('./battle-map-data.js'):root.PVZ_BATTLE_MAPS,model=node?require('./rescue-design-model.js'):root.PVZ_RESCUE_SCENE,data=node?require('./rescue-design-data.js'):root.PVZ_RESCUE_DESIGN;
function createPreview(mapId){
 const map=maps.getMap(mapId),s=model.createScene(6),blocked=map.terrain.blocked.length?map.terrain.blocked:map.gates?Array.from({length:5},(_,row)=>({row,col:5})).filter(p=>!map.gates.includes(p.row)):[];
 s.paused=true;s.preview=true;s.previewLevel={...data.levels[6],tag:'场地',title:map.name,routeName:'场地视觉试演 · 地形与专属目标待接入',corridors:map.terrain.corridors,blocked,requiredCaches:2};
 s.previewHasDoor=map.landmarks.some(p=>p.kind==='door');s.goal={...s.goal,...map.landmarks.find(p=>p.kind==='door')};
 const occupied=new Set([...blocked,...map.landmarks].map(p=>p.row+':'+p.col));
 const dry=p=>!map.terrain.waterRows.includes(p.row)||map.terrain.bridges.some(b=>b.row===p.row&&b.col===p.col);
 const take=(row,columns)=>{for(const col of columns){const p={row,col},key=row+':'+col;if(!occupied.has(key)&&dry(p)){occupied.add(key);return p;}}return null;};
 s.caches=map.landmarks.filter(p=>p.kind==='cache').map((p,i)=>({...s.caches[i%s.caches.length],...p,name:p.label,progress:0,claimed:i===0}));
 s.previewLandmarks=map.landmarks.filter(p=>p.kind!=='cache'&&(p.kind!=='door'||p!==map.landmarks.find(p=>p.kind==='door')));
 s.plants=[];let serial=1;
 for(const [row,type]of [[0,'sunflower'],[1,'pea'],[2,'wallnut'],[3,'cactus'],[4,'snow']]){const p=take(row,[2,3,4,6,0,1,7]);if(p)s.plants.push({id:serial++,type,...p,hp:data.plantCombat[type].hp,maxHp:data.plantCombat[type].hp,path:[],moving:false,facing:1,attack:0,hit:0,cooldown:0,cactusHigh:false,ability:{state:'idle',elapsed:0}});}
 for(const [i,t]of s.teams.entries()){let p;for(const row of [[0,1,4,3,2],[3,4,0,1,2],[4,0,3,1,2]][i]){p=take(row,[8,7,6]);if(p)break;}if(p)Object.assign(t,p);}
 model.chooseDoctor(s,2);return s;
}
function visibleBeats(campaign,spoilers=false){return campaign.beats.filter(b=>spoilers||!campaign.truth.protectedIds.includes(b.id));}
function traceRoute(mapId,start,end){
 const map=maps.getMap(mapId),blocked=map.terrain.blocked.length?map.terrain.blocked:Array.from({length:5},(_,row)=>({row,col:5})).filter(p=>!map.gates.includes(p.row)),solid=[...blocked,...map.landmarks.filter(p=>p.kind!=='meet')],valid=p=>p.row>=0&&p.row<5&&p.col>=0&&p.col<9&&!solid.some(b=>b.row===p.row&&b.col===p.col)&&(!map.terrain.waterRows.includes(p.row)||map.terrain.bridges.some(b=>b.row===p.row&&b.col===p.col)),key=p=>p.row+':'+p.col;
 const queue=[start],seen=new Map([[key(start),null]]);let finish;for(let i=0;i<queue.length;i++){const p=queue[i];if(Math.abs(p.row-end.row)+Math.abs(p.col-end.col)<=1){finish=p;break;}for(const q of [{row:p.row,col:p.col-1},{row:p.row,col:p.col+1},...(map.terrain.corridors.includes(p.col)?[{row:p.row-1,col:p.col},{row:p.row+1,col:p.col}]:[])])if(valid(q)&&!seen.has(key(q))){queue.push(q);seen.set(key(q),p);}}
 if(!finish)return[];const points=[];for(let p=finish;p;p=seen.get(key(p)))points.unshift(p);return points;
}
const api={createPreview,visibleBeats,traceRoute};if(node)module.exports=api;else root.PVZ_BATTLE_ATLAS_MODEL=api;
})(typeof window!=='undefined'?window:globalThis);
