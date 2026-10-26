(function(root){'use strict';
const caches=[{id:'relay',name:'前进补给碑',kind:'relay',row:1,col:6,benefit:'接应后可从这里补充队员。',reward:80},{id:'food',name:'口粮补给碑',kind:'food',row:3,col:7,benefit:'取回一次口粮补给，不持续产出。',reward:120},{id:'repair',name:'整备补给碑',kind:'repair',row:3,col:3,benefit:'撤回同胞在此消耗物资修补护具。',reward:0},{id:'west',name:'隐蔽补给碑',kind:'food',row:0,col:2,benefit:'绕行可取回另一批封存补给。',reward:100},{id:'rear',name:'后路接应碑',kind:'relay',row:4,col:8,benefit:'留给返程队伍的接应位置。',reward:60}];
const levels=[
 {tag:'1-1',title:'裂缝下的同胞',goal:'取回饭盒，接通回灯房的路',chapter:'第一章 · 地下残民',people:'阿朴送过早餐，饭盒布上缝着他的名字。',unlock:null,prison:{row:2,col:1,name:'存粮小屋'},units:['normal'],plants:[['pea',1,4],['pea',2,2],['pea',4,5]],teach:'先接应路边补给碑，再在两条联络道之间选择回程。',counter:{row:1,col:5,type:'pea',line:'看守准备补位，原来的主路将受到夹击。'},opening:'先把饭盒带回来。别让取粮的人独自走最后一段。'},
 {tag:'1-2',title:'废墟通道',goal:'接回被关押的修灯人',chapter:'第一章 · 地下残民',people:'他接好了最后一盏路灯，才去讨回被没收的午饭。',unlock:'cone',prison:{row:1,col:1,name:'看守房间'},units:['normal'],plants:[['wallnut',1,3],['pea',1,2],['pea',2,4],['sunflower',3,1]],teach:'前哨补兵与绕后开门；驻守队要保护返程联络口。',counter:{row:2,col:5,type:'wallnut',line:'植物尝试堵住中段联络口，转线可走另一处通道。'},opening:'留一队看住路口。房门打开以后，我们还要一起走回来。'},
 {tag:'1-3',title:'最后一批幸存者',goal:'营救粮仓里的老周',chapter:'第一章 · 地下残民',people:'小鬼把半块面包包了三层，等他回去一起吃。',unlock:'bucket',prison:{row:2,col:0,name:'粮仓囚室'},units:['normal','cone'],plants:[['snow',0,2],['wallnut',2,4],['pea',2,2],['chomper',3,4],['pea',4,3]],teach:'路障掩护开门；关闭小车的计划比牺牲整队更有价值。',counter:{row:1,col:5,type:'pea',line:'后备射手准备封锁前进碑，选择守点还是先接人。'},opening:'老周认得回灯房的路。给他留一个有人等着的路口。'},
 {tag:'2-1',title:'地下工坊',goal:'运回床架、木板和工具',chapter:'第二章 · 集结与研发',people:'路障要接灯，老周已经把空床位留好了。',unlock:null,prison:{row:3,col:1,name:'材料仓房'},units:['normal','cone','bucket'],plants:[['pea',0,3],['chomper',1,4],['wallnut',2,3],['sunflower',3,2],['snow',4,3]],teach:'分队取补给；受伤成员回整备碑，材料队需要接应。',counter:{row:3,col:5,type:'pea',line:'看守准备切断材料返程路，整备队需要重新驻守。'},opening:'桌子不用做得漂亮。先让大家能坐在同一处吃饭。'},
 {tag:'2-2 上',title:'屋顶囚室',goal:'接下被锁在高处的送药人',chapter:'第二章 · 集结与研发',people:'药袋上写的是服药时辰，看守把它当成了暗号。',unlock:'balloon',prison:{row:0,col:1,name:'屋顶绳索'},units:['normal','cone','bucket'],plants:[['cactus',0,3],['wallnut',1,3],['chomper',2,4],['pea',3,2],['cactus',4,4]],teach:'上路开门、中路接应；本关不能先用尚被囚禁的气球。',counter:{row:1,col:5,type:'cactus',line:'仙人掌准备封锁上侧联络口，地面掩护仍然重要。'},opening:'先解开绳索。能飞，也不该被要求一个人逃走。'},
 {tag:'2-2 下',title:'地窖工具间',goal:'接回矿工与通风图',chapter:'第二章 · 集结与研发',people:'图上的箭头原本画给住户，看守却把它涂成袭击路线。',unlock:'digger',prison:{row:4,col:1,name:'地窖工具间'},units:['normal','cone','bucket','balloon'],plants:[['cactus',0,3],['snow',1,3],['wallnut',2,4],['pea',3,2],['cactus',4,3]],teach:'空中侦察地面接应，返程不能只顾飞得快的人。',counter:{row:3,col:5,type:'cactus',line:'对空哨兵准备补位，飞行队可以转线，地面队继续照应。'},opening:'图和镐头都带上。先回去把工坊的通风口挖开。'},
 {tag:'2-3',title:'被俘的声音',goal:'带走证人与造谣原稿',chapter:'第二章 · 集结与研发',people:'向日葵承认签过登记，也想把改过的那一页带出去。',unlock:null,prison:{row:2,col:1,name:'宣传所档案室'},units:['normal','cone','bucket','balloon','digger'],plants:[['cactus',0,3],['wallnut',1,3],['snow',2,3],['cactus',3,2],['sunflower',4,1]],teach:'三队分工：取证、看住前哨、接应撤离；不以清空全图为目标。',counter:{row:2,col:5,type:'pea',line:'植物试图夺回前进碑，证人与原稿需要另一条回程路。'},opening:'把原稿和写过它的人一起带回来。桌子旁还有位置。'}
];
const layouts=[[[1,6],[3,7],[4,3]],[[0,6],[3,7],[4,3],[4,8]],[[1,6],[3,7],[3,3],[0,5]],[[1,6],[4,7],[3,4],[0,7]],[[2,6],[4,7],[3,3],[0,5]],[[3,6],[1,7],[0,6],[4,7]],[[1,6],[3,7],[4,4],[0,6],[4,8]]];
const gates=[[1,3],[2],[0,3],[2,4],[0,2],[1,4],[1,2,3]];
const routeNames=['双岔篱门','中央窄口','粮仓侧廊','工坊折返道','屋顶北门','地窖南道','宣传所三岔口'];
// Introduce the one-use ambush in the grain-store chapter, then reuse it selectively.
for(const [level,row,col] of [[2,0,4],[3,3,4],[6,2,4]])levels[level].plants.push(['squash',row,col]);
levels.forEach((level,i)=>{
 if(level.prison.col===0)level.prison.col=1;level.plantDeck=[...new Set(['sunflower','pea',...level.plants.map(p=>p[0])])];level.requiredCaches=i<3?1:2;level.corridors=[0,2,3,4,6,8];level.gates=gates[i];level.routeName=routeNames[i];
 level.blocked=Array.from({length:5},(_,row)=>({row,col:5})).filter(p=>!gates[i].includes(p.row));
 const blocked=(row,col)=>level.blocked.some(p=>p.row===row&&p.col===col);
 level.plants=level.plants.map(([type,row,col])=>[type,row,blocked(row,col)?col-1:col]);
 level.caches=layouts[i].map(([row,col],n)=>({...caches[n],row,col:col===3?1:col===5?4:col===6||col===8?7:col}));
 // The same cell must never contain a cache, a defender and the prison.
 const occupied=new Set([...level.plants.map(([,r,c])=>r+':'+c),level.prison.row+':'+level.prison.col]);
 for(const node of level.caches){if(occupied.has(node.row+':'+node.col)){for(const c of [7,4,1,2])if(!blocked(node.row,c)&&!occupied.has(node.row+':'+c)){node.col=c;break;}}occupied.add(node.row+':'+node.col);}
 for(const node of level.caches)node.benefit=(node.reward?'首次接通领取'+node.reward+'物资；':'')+'接通后附近队伍可消耗物资回血、补员。';
 level.teach=routeNames[i]+'：篱墙只在标记缺口可通过；先接通'+(level.requiredCaches===1?'一':'两')+'座补给碑，再开门并护送返回。';
});
const phases=[{name:'侦察路线',line:'观察两条联络通道，先决定一处要争取的补给碑。'},{name:'夺取补给碑',line:'前进碑提供接应位置；物资碑领取一批补给；整备碑帮助同胞回来。'},{name:'植物反扑',line:'落种点提前标明。改变行军路线，或留下小队接战。'},{name:'打开房门',line:'攻坚队接到目标后，另两队开始保护返程联络口。'},{name:'接应撤离',line:'放弃不再必要的阵地，带着同胞和物资回到营地。'}];
const plantCards={pea:{cost:100,recharge:7.5},sunflower:{cost:50,recharge:7.5},wallnut:{cost:50,recharge:30},snow:{cost:175,recharge:7.5},chomper:{cost:150,recharge:7.5},cactus:{cost:125,recharge:7.5},squash:{cost:50,recharge:30}};
// Attack identities and launch rhythms follow classic plants. Durability remains
// the rescue-mode balance; it is deliberately separate from the legacy campaign.
const plantCombat={
 pea:{name:'豌豆射手',hp:180,damage:20,interval:1.5,mechanic:'同行直射，无法打中空中气球。'},
 snow:{name:'寒冰射手',hp:180,damage:20,interval:1.5,mechanic:'同行冰豌豆，命中地面目标后减速。'},
 sunflower:{name:'向日葵',hp:130,damage:0,interval:0,mechanic:'只生产阳光，不攻击或治疗植物。'},
 wallnut:{name:'坚果',hp:480,damage:0,interval:0,mechanic:'阻挡地面队伍，不主动攻击。'},
 cactus:{name:'仙人掌',hp:180,damage:20,interval:1.5,mechanic:'地面直刺；升高后刺破同行气球。'},
 chomper:{name:'大嘴花',hp:240,damage:0,interval:0,mechanic:'张嘴吞下一名地面同胞，再咀嚼40秒。'},
 squash:{name:'倭瓜',hp:300,damage:1800,interval:0,mechanic:'察看、蓄力后跳砸一次；落点确定后可扑空。'}
};
levels[6].escort={kind:'plant',type:'sunflower',name:'登记员',hp:20,maxHp:130};
levels[2].opening+=' 粮仓口有倭瓜。看清它的落点，及早调遣，别把三队挤在一起。';
const api={version:5,plantCards,plantCombat,plantRuleSource:'https://github.com/ruslan831/PlantsVsZombies-decompilation/blob/master/Lawn/Plant.cpp',rows:5,columns:10,corridors:[3,6,8],backline:{fenceColumn:9,rearColumn:10.8,fenceHp:600},camp:{row:2,col:8},caches,levels,phases,art:{command:'assets/rescue-design/doctor-command.webp',walk:'assets/rescue-design/doctor-walk.webp',cache:'assets/rescue-design/route-cache.webp',hedge:'assets/rescue-design/route-hedge.webp',fence:'assets/rescue-design/refuge-fence.webp'}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PVZ_RESCUE_DESIGN=api;
})(typeof window!=='undefined'?window:globalThis);
