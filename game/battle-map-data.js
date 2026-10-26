(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports,land=node?require('./battle-map-land.js'):root.PVZ_MAP_LAND,water=node?require('./battle-map-water-roof.js'):root.PVZ_MAP_WATER_ROOF;
const order=['lawn','night','pool','fog','roof','roof-night','canal','underground'],maps=order.map(id=>[...land,...water].find(m=>m.id===id));
const modes=[
 {id:'rescue',name:'开门与接应',status:'playable',maps:['lawn'],question:'什么时候停止推进，开始保护回程？',rule:'接通补给、开门，再把一名重伤同胞送回营地。',difference:'现有七关的实际玩法；后续目标以此为基础扩展。',dependency:'已接入七关，不等于七关的规划场景都已实现。'},
 {id:'dual-handoff',name:'双点营救与交接',status:'design',maps:['lawn','night','pool'],question:'先送第一人回来，还是分队开第二扇门？',rule:'每名目标独立跟随、交接与抵达，两人都返回才成功。',difference:'牵制与接应必须分工，快队不能代替慢目标完成撤离。',dependency:'多护送对象、交接权限与逐人结算。'},
 {id:'evidence-carry',name:'取证与运输',status:'design',maps:['fog','underground'],question:'带着证据继续深入，还是交付后再出发？',rule:'两份记录分批取得；队伍倒下在原地留下可拾回物件。',difference:'已交付与运输中分别记录，避免全队只追敌人。',dependency:'实际携带者、掉落物与重复交付保护。'},
 {id:'finite-counterattack',name:'有限反扑突围',status:'design',maps:['lawn','night'],question:'应对公开预告的反扑，还是争取另一条返回线？',rule:'增援次数有限，支付真实阳光，遵守卡片冷却与合法落点。',difference:'不是无限刷怪；危险行锁定后不暗追玩家转线。',dependency:'有限增援调度与预告、预算预留。'},
 {id:'bridge-open',name:'开路与架桥',status:'design',maps:['canal','pool'],question:'沿原有长路护送，还是争取更安全的返程桥？',rule:'先救搬运巨人，才可搬开指定木料；最初旁道始终保留。',difference:'角色能力改变地图连接，不只增加伤害。',dependency:'地形通行、桥架交互、巨人搬运及倒地动作。'},
 {id:'batch-evacuation',name:'分批撤离',status:'design',maps:['night','roof-night','fog'],question:'哪一队接下一批，哪一队照顾最后一人？',rule:'行动前公布有限批次，批次之间可整备，所有人抵达再结算。',difference:'每批路线不同，不能永远驻守一格；不暗加最后一波。',dependency:'多批目标与暂停安全的统一结算。'},
 {id:'component-salvage',name:'水面打捞与补给',status:'design',maps:['pool'],question:'先回收近处组件，还是护住远岸整备点？',rule:'岸上队保护工人，固定桥保证普通队能到达；水下零件只由交互取得。',difference:'气球越水不等于运走组件，游泳与地面护送边界清楚。',dependency:'水域、底座、打捞进度和组件交付。'},
 {id:'barge-escort',name:'水闸运箱与驳船护送',status:'design',maps:['canal'],question:'先开哪道闸，物资在哪一岸交接？',rule:'闸门先预告再改变通路，驳船停靠后才能换队接运。',difference:'环境改变运输顺序；货物不会因快速单位到岸而瞬移。',dependency:'闸门状态、船路、回退停靠与载货记录。'},
 {id:'beacon-repair',name:'灯路与信号修复',status:'design',maps:['night','roof-night','underground'],question:'牵制火力还是护住修灯队，先亮哪段路？',rule:'维修需要队伍驻留；危险变化提前标明，不靠看不见的倒计时判负。',difference:'保护交互者和恢复路线，而非击杀数竞赛。',dependency:'可中断维修、信标状态和清楚的光照范围。'},
 {id:'recon',name:'迷雾分区侦察',status:'design',maps:['fog'],question:'先花时间探路，还是沿已知返回线稳妥取证？',rule:'目标、地图边界和危险预告一直可读；侦察信息对双方观察都有明确限制。',difference:'雾是信息与路线判断，不能把AI读全图当作难度。',dependency:'双方观测裁剪、已知区记录与可访问预兆。'},
 {id:'roof-lift',name:'屋脊吊篮接力',status:'design',maps:['roof','roof-night'],question:'谁留在落点接运，谁为较慢的队伍清路？',rule:'吊篮到位再交接，花盆与坡面弹道分开实现；敌方落点提前标明。',difference:'高处路线依赖接手顺序，不能从画面边缘绕开。',dependency:'屋面支撑、坡面弹道、吊篮与交接动作。'},
 {id:'classic-zombot',name:'经典巨大僵王决战',status:'design',maps:['lawn','roof'],question:'机甲压制火力时，三队如何完成支援与撤离？',rule:'保留巨大机甲、冰火弹对消、投放与踩压的经典身份，逐项给出预兆和应对窗口。',difference:'第四章先学组件和能力，第五章才汇合为终局；小鬼不作消耗性弹药。',dependency:'巨大机甲完整动作、场地碰撞、冰火判定及三队协同。'}
];
function getMap(id){return maps.find(m=>m.id===id)||maps[0];}
const api={maps,modes,getMap,version:1};if(node)module.exports=api;else root.PVZ_BATTLE_MAPS=api;
})(typeof window!=='undefined'?window:globalThis);
