(function(root){'use strict';
// Text is built from the same level/roster definitions used by the battle.
function render(doc,scene,index,onSelect){
 const data=root.PVZ_RESCUE_DESIGN,levels=data.levels,body=doc.getElementById('bookBody'),nav=doc.getElementById('bookNav');
 const names=['第一次出发','调遣与协同','补给与胜负','八境地图','战役与同胞','故事与玩法册'],page=Math.max(0,Math.min(names.length-1,Number(index)||0));
 const el=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;},p=text=>body.append(el('p',text));
 const list=(title,items)=>{body.append(el('h3',title));const ul=el('ol');for(const text of items)ul.append(el('li',text));body.append(ul);};
 for(const[i,name]of names.entries()){const b=el('button',name);b.type='button';b.setAttribute('aria-pressed',String(i===page));b.onclick=()=>onSelect('guide',i);nav.append(b);}
 doc.getElementById('bookEyebrow').textContent='乔治的行动手册 · '+(page+1)+' / '+names.length;
 doc.getElementById('bookTitle').textContent=names[page];body.classList.add('play-guide');
 if(page===0){
  const figure=el('figure'),img=el('img');img.src='prologue/escape-c.png';img.alt='同胞搀扶乔治离开囚室，奔向地下通道';figure.append(img,el('figcaption','先把还被关着的人，救出来。'));body.append(figure);
  p('你指挥的是三支僵尸小队。目标不是清空植物，而是接通补给、救出同胞，再把他真正带回营地。');
  list('第一局照着这五步做',['先收好来信，再点最右侧任一段栅栏，指定博士藏身处。博士只有10次承受命中的机会。','在“出发编组”里给三队配人，每队最多3人；准备布阵只放在第9列。60秒准备可提前结束。','点场上僵尸或脚圈选队，再点墓碑下令。队伍会沿合法路线推进，遇到植物就攻击。','先清掉碑旁守军，在相邻格停留3秒。前十关接通一座完好墓碑，之后需要两座；具体数量看战场上方。','点房门，在旁边清场并驻留4秒接人。读完门后交谈，再点“护送回营”；同胞抵达第3行第9列才算成功。']);
  p('战场上方的“当前一步”会随实际进度改变。不确定做什么时先看这里；可随时暂停、重看这本手册。');
 }else if(page===1){
  list('下令很简单',['鼠标或触屏：点一支队伍，再点目标格。再次点击人物只选队；想与另一队汇合，先点“推进”，再点对方脚圈。','键盘：先聚焦战场，1—3选队，方向键选格，Enter确认；D查看博士。调遣没有冷却。','准备期点“准备布阵”可调整第9列起点；开战后走真实路线，不能传送。篱墙与地图边界限制通路，植物不参与绕路。','两队在同一格会出现队伍木牌、合并和分开。停稳后合并为联队，一次下令共同行动；分开后分别调遣。','“成员转队”保留伤势；目标队必须有空位，交战时两队还要靠近。水面与已经下达的路线也要适合该兵种。']);
  list('三队先这样分工',['开路队清掉补给与房门附近守军。','接应队留在回程路口，等待较慢的获救同胞。','后援队看住补给和被消耗的栅栏；不必三队始终挤在一起。']);
  p('植物实体会换行，但移动调度有至少3秒间隔；射手只向当下所在行直线开火，豌豆不会追着换行的你拐弯。倭瓜、食人花、仙人掌等仍按各自机制应对。');
 }else if(page===2){
  list('墓碑是路上的补给',['接通完好墓碑后，靠近1.15格内，选择该队再点“回血”。每次花30物资，为存活伤员各恢复最多90生命；不会复活阵亡者。','缺人时在已接通完好墓碑或营地补员，最多3人；费用看兵种选择旁的按钮。联队中的每支队分别补给。','碑被打碎就不能服务，开门前仍需保持足够数量的已接通完好墓碑；破碎补偿是一次性的，不要把它当无限物资。']);
  list('输赢看什么',['成功：护送对象实际返回第3行第9列营地。打开门、快队先到、杀光眼前植物都不等于完成。','失散：护送队倒下时，派另一支存活队靠近标识接手，再护送回营。','失败：博士累计承受10次命中，或护送对象遇害等明确失败条件。栅栏各自承受伤害，击穿空行不会直接算博士受伤。','结算后可看回信、手动下一关或8秒自动接续；暂停、来信和指南都会冻结自动接续。']);
  p('左侧植物牌是敌方情报：阳光余额、种植费用和冷却秒数。不是你的种植按钮。敌方开局500阳光，场外5株免费无敌向日葵持续生产；准备期落种免CD限制，提前开战会承接剩余冷却。');
 }else if(page===3){
  const rules={lawn:'白天基础战场：学习选队、夺碑、开门与返程。',night:'夜晚蘑菇保持清醒；留意短程喷射，别把视线昏暗当成没有敌人。',underground:'地下同胞移动速度提高20%；通道仍受障碍限制，快队要等伤员。',pool:'水面植物需要睡莲，桥面可直接种；地面队沿桥往返，游泳圈与潜水队有额外水路。',fog:'浓雾影响双方观察；路灯花照亮附近，三叶草预警后吹走气球并驱雾30秒。桥位和目标保持可辨。',canal:'水路和石桥交错；混编队里每位存活成员及护送对象都需满足水域条件。',roof:'屋顶植物需要花盆；直射受屋脊限制，卷心菜投手能抛射越过低障碍。白天蘑菇睡觉，咖啡豆可唤醒。','roof-night':'夜间屋顶同时需要花盆；蘑菇清醒，高压组合更完整，先保留返程与后方掩护。'};
  for(const id of [...new Set(levels.map(l=>l.mapId).filter(Boolean))]){const l=levels.find(l=>l.mapId===id);body.append(el('h3',l.routeName||id));p(rules[id]||'沿本关公开规则行动。');}
  if(!data.terrainCampaign)p('此入口是七关小队营救；完整八境地形机制请从主菜单进入“四十关冒险”。');
 }else if(page===4){
  p(data.terrainCampaign?'八个区域各五关，按顺序解锁。胜利回营后才开放新兵种；本关关押的同胞不能提前编组。':'七关小队行动有独立故事与兵种表；四十关冒险另有自己的长线存档。');
  for(const[i,l]of levels.entries()){const item=el('details'),summary=el('summary',l.tag+' · '+l.title),unlock=l.unlock?root.PVZ?.UNITS[l.unlock]?.name:null;item.append(summary,el('p',(l.routeName?l.routeName+' · ':'')+(l.goal||l.mission||'营救与护送')));item.append(el('p','接通'+l.requiredCaches+'座完好补给碑 → 开门 → 护送回营。'+(unlock?'本关成功后开放：'+unlock+'。':'本关重点是接应与返程。')));item.dataset.guideLevel=i;body.append(item);}
  p('行动列表只用于查看任务，不会解锁未完成关卡，也不会更改已解救记录。');
 }else{
  p('乔治与同胞吃普通食物；他们的日常工具、饭盒和往来名单被改写成袭击证据。每次来信解释为什么出发，门后交谈让你认识被救的人，灯房回信把这次救援接向下一关。');
  list('已经可以游玩的内容',['主冒险：八境四十关，三队调遣、编组与转队、补给回血补员、营救护送、植物阳光与冷却、地形和长线解锁。','经典对线：保留前两章选僵尸卡的反向塔防，任一僵尸进门或消耗两行小车获胜；五座防守碑全毁才失败。它与小队营救规则不同，存档也独立。','七关小队行动：早期独立营救关卡，保留原入口与故事。角色图鉴、文化版博士和地图设计册可从“同胞与故事”查看。']);
  list('后续设计册，不是已开放的战斗',['双点交接、取证运输、架桥、分批撤离、打捞、闸门驳船、灯路维修、吊篮接力。','经典巨大僵王机甲、冰火对消与最终后院决战，仍需后续制作。四十关完结不会伪装成机甲终战。']);
  for(const mode of root.PVZ_BATTLE_MAPS?.modes||[]){if(mode.status!=='design')continue;const item=el('details');item.dataset.guideDesign=mode.id;item.append(el('summary',mode.name+' · 设计中'),el('p',mode.question),el('p',mode.rule));body.append(item);}
  p('首次开始冒险会播放现有重绘序章漫画，可暂停、逐句或跳过；从来信面板可重看序章。从“同胞与故事”还可回看旧章节漫画。手册只介绍当前旅途，不提前揭晓最终故事。');
 }
 const foot=el('p','翻阅期间战斗和倒计时暂停；合上后保持打开前的暂停状态。');foot.className='guide-foot';body.append(foot);
 const controls=el('div');controls.className='guide-pages';for(const[i,label]of [[page-1,'上一页'],[page+1,'下一页']]){const b=el('button',label);b.type='button';b.disabled=i<0||i>=names.length;b.onclick=()=>onSelect('guide',i);controls.append(b);}body.append(controls);
}
root.PVZ_PLAY_GUIDE={render};
})(typeof window!=='undefined'?window:globalThis);
