(function(root){'use strict';
const key='pvz-terrain-campaign-v1';function create(storage,trial=false){let completed=[],saved=true;try{const value=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(value))completed=[...new Set(value.filter(v=>Number.isInteger(v)&&v>=0&&v<40))].sort((a,b)=>a-b);}catch{saved=false;}
 const maxOpen=()=>{let n=0;while(n<39&&completed.includes(n))n++;return n;};
 return{trial,canEnter:n=>Number.isInteger(n)&&n>=0&&n<40&&(trial||n<=maxOpen()),initial:n=>Number.isInteger(n)&&n>=0&&n<40?trial?n:Math.min(n,maxOpen()):maxOpen(),complete(n){if(trial)return false;if(!Number.isInteger(n)||n<0||n>maxOpen()||n>=40)return false;if(!completed.includes(n))completed.push(n);try{storage.setItem(key,JSON.stringify(completed));saved=true;}catch{saved=false;}return saved;},status:()=>({trial,saved,maxOpen:maxOpen(),completed:[...completed]})};
}
const api={create,key};if(typeof module!=='undefined'&&module.exports)module.exports=api;else{root.PVZ_TERRAIN_PROGRESS_API=api;let storage;try{storage=root.localStorage;}catch{storage={getItem(){throw Error('存档不可用');},setItem(){throw Error('存档不可用');}};}root.PVZ_TERRAIN_PROGRESS=create(storage,new URLSearchParams(root.location.search).get('trial')==='1');}
})(typeof window!=='undefined'?window:globalThis);
