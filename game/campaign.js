(function(root){
'use strict';
function normalize(v,units,levels,soft=false,storyActions=[]){
 if(v===null)v={version:2,unlocked:['normal'],completed:[],highest:0};
 if(!v||![1,2].includes(v.version)||!Array.isArray(v.unlocked)||!Array.isArray(v.completed)||!Number.isInteger(v.highest)||v.highest<0||v.highest>=levels.length)throw Error('Invalid campaign save');
 const index=x=>Number.isInteger(x)&&x>=0&&x<levels.length;
 const completed=[...new Set(v.completed.filter(index))],unlocked=[...new Set(['normal',...v.unlocked.filter(u=>typeof u==='string'&&Object.hasOwn(units,u)),...completed.map(i=>levels[i].rescue).filter(Boolean)])];
 const highest=Math.max(v.highest,...completed.map(i=>Math.min(levels.length-1,i+1)));
 const deck=Array.isArray(v.deck)?[...new Set(v.deck.filter(u=>unlocked.includes(u)))].slice(0,5):['normal'];
 const p={version:2,unlocked,completed,highest,currentLevel:index(v.currentLevel)&&v.currentLevel<=highest?v.currentLevel:highest,deck:deck.length?deck:['normal'],soft:typeof v.soft==='boolean'?v.soft:soft,sound:v.sound===true,uiTheme:['wood','stone','paper'].includes(v.uiTheme)?v.uiTheme:'wood',lettersSeen:Array.isArray(v.lettersSeen)?[...new Set(v.lettersSeen.filter(index))]:[],route:v.route==='assault'?'assault':'peace'};
 p.characterArt=v.characterArt==='classic'?'classic':'story';
 if(v.prologue?.version===2&&['completed','skipped'].includes(v.prologue.status))p.prologue=v.prologue;
 const q=v.pendingAfter;if(q&&index(q.level)&&completed.includes(q.level)&&Number.isFinite(q.time)&&q.time>=0&&Number.isInteger(q.casualties)&&q.casualties>=0&&['door','mowers'].includes(q.reason)&&Array.isArray(q.tombs)&&q.tombs.length===5&&q.tombs.every(h=>Number.isFinite(h)&&h>=0&&h<=1000))p.pendingAfter={level:q.level,time:q.time,casualties:q.casualties,reason:q.reason,tombs:q.tombs,rescue:levels[q.level].rescue,stage:['rescue','panels','result'].includes(q.stage)?q.stage:'rescue',panelIndex:Number.isInteger(q.panelIndex)&&q.panelIndex>=0?q.panelIndex:0};
 if(p.pendingAfter)p.pendingAfter.earlyActions=Array.isArray(q.earlyActions)?[...new Set(q.earlyActions.filter(id=>Number.isInteger(id)&&id>=0&&id<(storyActions[q.level]||[]).length))]:[];
 return p;
}
const api={normalize};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_CAMPAIGN=api;
})(typeof window!=='undefined'?window:globalThis);
