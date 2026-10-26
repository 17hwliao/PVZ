(function(root){'use strict';
const mushrooms=new Set(['puff','sunshroom','fumeshroom']);
const dist=(a,b)=>Math.hypot(a.row-b.row,a.col-b.col),alive=t=>t.members?.some(m=>m.hp>0);
function water(s,p){return !!s.terrain?.terrain.waterRows.includes(Math.round(p.row))&&Math.round(p.col)<9;}
function bridge(s,p){return !!s.terrain?.terrain.bridges.some(b=>b.row===Math.round(p.row)&&b.col===Math.round(p.col));}
function swimmer(s,actor,units){if(!actor)return false;const members=actor.members?.filter(m=>m.hp>0)||[actor];const can=members.length&&members.every(m=>units[m.type]?.water||(m.type==='balloon'&&m.airborne!==false));const escort=s.follower?.escort===actor.id?s.follower:null;return !!can&&(!escort||units[escort.type]?.water);}
function canWalk(s,p,actor,units){return !water(s,p)||bridge(s,p)||swimmer(s,actor,units);}
function supportType(s,p){if(s.terrain?.theme==='roof')return'flowerpot';if(water(s,p)&&!bridge(s,p))return'lily';return null;}
function supportAt(s,p){return s.supports?.find(b=>b.hp>0&&b.row===Math.round(p.row)&&b.col===Math.round(p.col));}
function hasSurface(s,p){const need=supportType(s,p);return !need||supportAt(s,p)?.type===need;}
function asleep(s,type){return mushrooms.has(type)&&s.terrain?.time!=='night';}
function visible(s,p,side='player'){
 if(s.terrain?.id!=='fog'||s.status==='planning'||s.weather.clearUntil>s.time||p.col>=7.5)return true;
 if(s.plants.some(q=>q.hp>0&&q.type==='plantern'&&dist(q,p)<=2.5))return true;
 const observers=side==='player'?s.teams.filter(alive):s.plants.filter(q=>q.hp>0&&!q.sleeping);return observers.some(q=>dist(q,p)<=2.1);
}
function speed(s,actor,units){let factor=s.terrain?.id==='underground'?1.2:1;if(water(s,actor)&&swimmer(s,actor,units))factor*=1.08;return factor;}
function reduction(s,t,m,shot,units){const trait=units[m.type]?.trait;if(!trait||shot.type==='fumeshroom'||shot.lobbed)return 1;if(trait.kind==='screen'&&['pea','snow','puff'].includes(shot.type))return 1-trait.projectileReduction;if(trait.kind==='snorkel'&&water(s,t)&&!bridge(s,t)&&!s.plants.some(p=>p.hp>0&&dist(p,t)<=trait.revealRange))return 1-trait.waterReduction;return 1;}
function initialize(s,level){s.terrain=level.terrainMap;s.supports=[];s.weather={clearUntil:0,windUntil:0,skyAt:25};s.nextSupport=0;}
const api={mushrooms,water,bridge,canWalk,supportType,supportAt,hasSurface,asleep,visible,speed,reduction,initialize};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_TERRAIN_RULES=api;
})(typeof window!=='undefined'?window:globalThis);
