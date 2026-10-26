(function(root){'use strict';
// Rescue-terrain roster only. Armor is the portion of hp above the body, not
// an extra pool to add on top. Traits require model support to have an effect.
const units={
 normal:{name:'普通同胞',cost:50,hp:210,speed:21,damage:46,cooldown:3,armor:0,water:false,role:'低成本接应',trait:{kind:'none'},actor:'zombie',visualType:'normal',portrait:'assets/almanac/normal.webp',unlockMap:'lawn',unlockStage:0,powerTier:1},
 cone:{name:'路障同胞',cost:100,hp:430,speed:19,damage:46,cooldown:6,armor:220,water:false,role:'基础前排',trait:{kind:'armor'},actor:'zombie',visualType:'cone',portrait:'assets/almanac/cone.webp',unlockMap:'lawn',unlockStage:3,powerTier:2},
 screen:{name:'纱门同胞',cost:110,hp:380,speed:18,damage:42,cooldown:7,armor:170,water:false,role:'正面直射掩护',trait:{kind:'screen',projectileReduction:.35},actor:'zombie',visualType:'normal',portrait:'assets/almanac/screen.webp',unlockMap:'night',unlockStage:8,powerTier:3},
 bucket:{name:'铁桶同胞',cost:150,hp:650,speed:17,damage:46,cooldown:9,armor:440,water:false,role:'重装返程接应',trait:{kind:'armor'},actor:'zombie',visualType:'bucket',portrait:'assets/almanac/bucket.webp',unlockMap:'underground',unlockStage:13,powerTier:4},
 ducky:{name:'游泳圈同胞',cost:120,hp:310,speed:20,damage:42,cooldown:8,armor:100,water:true,role:'水面机动接应',trait:{kind:'waterMove'},actor:'zombie',visualType:'normal',portrait:'assets/almanac/ducky.webp',unlockMap:'pool',unlockStage:17,powerTier:4},
 snorkel:{name:'潜水同胞',cost:155,hp:270,speed:18,damage:44,cooldown:10,armor:60,water:true,role:'水下侦察与侧路',trait:{kind:'snorkel',waterReduction:.35,revealRange:.8},actor:'zombie',visualType:'normal',portrait:'assets/almanac/snorkel.webp',unlockMap:'pool',unlockStage:19,powerTier:5},
 balloon:{name:'气球同胞',cost:125,hp:180,speed:22,damage:46,cooldown:10,armor:0,water:false,role:'越障侦察',trait:{kind:'air'},actor:'balloon',visualType:'balloon',portrait:'assets/almanac/balloon.webp',unlockMap:'fog',unlockStage:23,powerTier:5},
 digger:{name:'矿工同胞',cost:175,hp:320,speed:24,damage:60,cooldown:12,armor:110,water:false,role:'快速轻装攻坚',trait:{kind:'skirmisher',burrowImplemented:false},actor:'digger',visualType:'digger',portrait:'assets/almanac/digger.webp',unlockMap:'canal',unlockStage:28,powerTier:6},
 ladder:{name:'扶梯同胞',cost:195,hp:480,speed:15,damage:74,cooldown:12,armor:270,water:false,role:'慢速攻坚与障碍协作',trait:{kind:'ladder',climbImplemented:false},actor:'zombie',visualType:'normal',portrait:'assets/almanac/ladder.webp',unlockMap:'roof',unlockStage:33,powerTier:7},
 football:{name:'橄榄球队员',cost:275,hp:740,speed:26,damage:68,cooldown:16,armor:530,water:false,role:'高成本快速重装',trait:{kind:'charge',bonusImplemented:false},actor:'zombie',visualType:'normal',portrait:'assets/almanac/football.webp',unlockMap:'roof-night',unlockStage:38,powerTier:8}
};
const order=['normal','cone','screen','bucket','ducky','snorkel','balloon','digger','ladder','football'];
function portraitOf(type){return(units[type]||units.normal).portrait;}
function actorOf(type){return(units[type]||units.normal).actor;}
const api={units,order,portraitOf,actorOf};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_TERRAIN_UNITS=api;
})(typeof window!=='undefined'?window:globalThis);
