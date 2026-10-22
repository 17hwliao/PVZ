(async function(){
'use strict';
const $=id=>document.getElementById(id),story=PVZ_STORY,assets=PVZ_ASSETS,dialog=$('dialog');
const roster=story.roster,MAX_CARDS=5,LAST_LEVEL=PVZ.LEVELS.length-1;
const portrait=u=>`assets/portraits/${u}.png`,KEY='pvz-rise-slice-progress-v1';
let progress=PVZ_CAMPAIGN.normalize(null,PVZ.UNITS,PVZ.LEVELS,matchMedia('(prefers-reduced-motion: reduce)').matches),saveWarning='',allowSave=true;
try{const raw=localStorage.getItem(KEY);if(raw)progress=PVZ_CAMPAIGN.normalize(JSON.parse(raw),PVZ.UNITS,PVZ.LEVELS,progress.soft);}
catch{saveWarning='本机进度无法读取；本次暂存于窗口，不会覆盖已有存档';allowSave=false;}
let homeStatusTimer=null;
function homeMessage(message,error=false){clearTimeout(homeStatusTimer);const el=$('homeStatus');el.textContent=message;el.hidden=false;el.classList.toggle('save-error',error);if(!error)homeStatusTimer=setTimeout(()=>{el.hidden=true;},2200);}
function save(){if(!allowSave){$('saveStatus').textContent=saveWarning;homeMessage(saveWarning,true);return false;}try{localStorage.setItem(KEY,JSON.stringify(progress));$('saveStatus').textContent='同胞与关卡进度已保存到本机';homeMessage('旅途已记下');return true;}catch{$('saveStatus').textContent='本机暂时无法保存，进度仅保留本次窗口';homeMessage($('saveStatus').textContent,true);return false;}}
window.PVZ_UI?.init(progress.uiTheme);
let battle=new PVZ.Battle(0,progress.unlocked),phase='loading',pendingLevel=0,draft=[...progress.deck],inspected='normal',selected='normal',row=2,hover=-1,ready=false,renderer,pictures={},last=0,manualPause=false,soundOn=progress.sound||false,audio=null,noticeUntil=0,cinemaReturn=null,damagePreview=null,dialogReturnFocus=null,dialogCancelAction=null,rewardPreview=null,armed=false,pointerX=1030,pointerY=412,detailsFocus=null;
const ctx=$('battle').getContext('2d'),rows=[...document.querySelectorAll('[data-row]')];
function text(tag,content,cls){const e=document.createElement(tag);e.textContent=content;if(cls)e.className=cls;return e;}
function notify(s,seconds=4){$('notice').textContent=s;$('notice').style.opacity='1';noticeUntil=performance.now()+seconds*1000;}
function tone(freq=220,d=.08,type='triangle',gain=.035){if(!soundOn)return;try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{soundOn=false;syncSound();}}
function sceneSound(kind){if(kind==='electric'||kind==='static')tone(kind==='electric'?90:140,kind==='electric'?1.6:.35,'sawtooth',kind==='electric'?.018:.008);else tone(({switch:340,chain:460,impact:110,door:150,steps:180})[kind]||180,.2);}
function syncSound(){$('prologueSound').textContent=`声音：${soundOn?'开':'关'}`;$('prologueSound').setAttribute('aria-pressed',String(soundOn));}
function applyPause(){battle.paused=phase!=='battle'||manualPause||dialog.open; $('pausedStamp').hidden=!(phase==='battle'&&manualPause&&!dialog.open);$('pause').textContent=manualPause?'继续':'暂停';$('pause').setAttribute('aria-pressed',String(manualPause));$('pause').setAttribute('aria-label',manualPause?'继续战斗':'暂停战斗');}
function show(title,kicker,build,buttons){
 damagePreview=null;rewardPreview=null;if(!dialog.open)dialogReturnFocus=document.activeElement;
 dialog.className='';
 $('dialogTitle').textContent=title;$('dialogKicker').textContent=kicker;$('dialogBody').replaceChildren();$('dialogActions').replaceChildren();build($('dialogBody'));$('dialogBody').scrollTop=0;
 dialogCancelAction=buttons.find(([label])=>['返回','返回战场','返回菜单','合上信件'].includes(label))?.[1]||null;
 for(const [label,action,secondary]of buttons){const b=text('button',label,secondary?'secondary':'');b.onclick=action;$('dialogActions').append(b);}if(!dialog.open)dialog.showModal();applyPause();window.PVZ_UI?.refresh(dialog);
}
function hide(){damagePreview=null;rewardPreview=null;dialogCancelAction=null;dialog.close();applyPause();if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus();}
function lines(body,entries){for(const [speaker,line]of entries){const p=text('div','','line');p.append(text('span',speaker,'speaker'),document.createTextNode(line));body.append(p);}}
function card(unit,cls='unit-card'){
 const b=text('button','',cls);b.dataset.unit=unit;b.setAttribute('aria-label',PVZ.UNITS[unit].name);
 const im=document.createElement('img');im.src=portrait(unit);im.alt='';b.append(text('span',PVZ.UNITS[unit].name,'card-name'),im,text('span',String(PVZ.UNITS[unit].cost),'cost'));
 if(cls==='unit-card')b.append(document.createElement('i'),text('span','','card-state'));else b.append(text('span','','roster-status'));return b;
}
function bank(){
 $('cards').replaceChildren();const units=phase==='prepare'?draft:[...battle.deck];
 units.forEach((u,i)=>{const b=card(u);b.append(text('span',String(i+1),'card-key'));b.title=`${i+1} · ${PVZ.UNITS[u].name} · ${PVZ.UNITS[u].cost}能量 / 冷却${PVZ.UNITS[u].cooldown}秒`;b.onclick=()=>{if(dialog.open||phase==='prologue')return;if(phase==='prepare'){toggleDraft(u);return;}if(phase!=='battle')return;selected=u;armed=true;hover=row;pointerX=PVZ.FIELD.spawnX;pointerY=220+row*96;sfx('seedlift');sync();};$('cards').append(b);});
 for(let i=units.length;i<MAX_CARDS;i++)$('cards').append(text('span','—','slot-empty'));sync();
}
function toggleDraft(unit){
 if(!progress.unlocked.includes(unit))return;const adding=!draft.includes(unit),from=adding?rosterButtons[unit]?.getBoundingClientRect():null;
 if(draft.includes(unit))draft=draft.filter(u=>u!==unit);else if(draft.length<MAX_CARDS)draft.push(unit);else $('chooserHint').textContent='卡槽已满，先从上方移除一张卡。';
 inspected=unit;bank();renderRoster();if(adding&&draft.includes(unit)&&from)animateCard(unit,from);
}
const rosterButtons={};
for(const unit of Object.keys(PVZ.UNITS)){
 const b=card(unit,'roster-card');let timer=null,longPress=false;
 b.title=`${PVZ.UNITS[unit].name} · ${PVZ.UNITS[unit].cost}能量；点击加入，右键或长按看详情`;
 b.onclick=()=>{if(longPress){longPress=false;return;}inspected=unit;if(progress.unlocked.includes(unit)){if(!draft.includes(unit))toggleDraft(unit);else renderRoster();sfx('seedlift');}else openDossier(unit);};
 b.oncontextmenu=e=>{e.preventDefault();openDossier(unit);};
 b.onpointerdown=e=>{if(e.button!==0)return;longPress=false;timer=setTimeout(()=>{longPress=true;openDossier(unit);},550);};
 const cancelPress=()=>{clearTimeout(timer);timer=null;};for(const event of ['pointerup','pointercancel','pointerleave'])b.addEventListener(event,cancelPress);
 b.onfocus=()=>{inspected=unit;renderRoster();};$('rosterCards').append(b);rosterButtons[unit]=b;
}
function renderRoster(){
 $('rosterCount').textContent=`已解救 ${progress.unlocked.length} / ${MAX_CARDS}`;$('deckCount').textContent=`已选择 ${draft.length} / ${MAX_CARDS}`;$('startBattle').disabled=!draft.length;
 for(const [unit,b]of Object.entries(rosterButtons)){const owned=progress.unlocked.includes(unit);b.classList.toggle('locked',!owned);b.classList.toggle('chosen',draft.includes(unit));b.setAttribute('aria-pressed',String(draft.includes(unit)));b.querySelector('.roster-status').textContent=owned?(draft.includes(unit)?'已解救 · 已选':'已解救 · 可选'):'待解救 · '+roster[unit].room.split(' ')[0];}
 $('rescueList').replaceChildren();for(const u of Object.keys(PVZ.UNITS)){const owned=progress.unlocked.includes(u);$('rescueList').append(text('p',`${owned?'已解救':'待解救'}　${PVZ.UNITS[u].name} · ${roster[u].room}`,owned?'rescued':''));}
 const owned=progress.unlocked.includes(inspected),r=roster[inspected];$('dossierPortrait').src=portrait(inspected);$('dossierPortrait').alt=PVZ.UNITS[inspected].name;$('dossierName').textContent=PVZ.UNITS[inspected].name;
 $('dossierState').textContent=owned?'已解救 · 可以编入本关':'待解救 · 尚不能召唤';$('dossierState').classList.toggle('locked',!owned);$('dossierRole').textContent=r.role;$('dossierCost').textContent=`${PVZ.UNITS[inspected].cost} 能量 / ${PVZ.UNITS[inspected].cooldown} 秒冷却`;$('dossierOrigin').textContent=r.origin;$('dossierDescription').textContent=r.description;
 $('dossierToggle').disabled=!owned;$('dossierToggle').textContent=owned?(draft.includes(inspected)?'移出卡组':'编入卡组'):'先去房间解救';$('chooserHint').textContent=draft.length?'点击下方卡片编组；点击上方已选卡片可移除。':'至少选择一位已解救的同胞才能出发。';
}
$('dossierToggle').onclick=()=>{toggleDraft(inspected);closeDossier();};
$('openDossier').onclick=()=>openDossier(inspected);$('dossierClose').onclick=closeDossier;
$('previewLetter').onclick=()=>openLetter(pendingLevel,hide,false);
function titles(index){$('levelTag').textContent=PVZ.LEVELS[index].tag;$('levelName').textContent=PVZ.LEVELS[index].name;$('objective').textContent='任一僵尸进门，或耗掉至少两行小车';$('modeName').textContent=PVZ.MODES[PVZ.LEVELS[index].mode].name;}
function encounterBrief(body,index){
 const level=PVZ.LEVELS[index],mode=PVZ.MODES[level.mode],panel=text('section','','encounter-brief');panel.append(text('h3',mode.name),text('p',mode.brief));
 const types=[...new Set([...level.plants.map(p=>p[0]),...(level.reinforcements||[]).map(p=>p.type)])];
 const list=text('div','','plant-intel');for(const type of types){const stats=PVZ.PLANTS[type],item=text('div','');item.append(text('strong',stats.name+' · '+stats.role),text('span',stats.description));list.append(item);}panel.append(list);body.append(panel);
}
function prepare(index){
 if(!ready||!Number.isInteger(index)||index<0||index>progress.highest||index>LAST_LEVEL)return;dialog.close();$('home').hidden=true;$('battle').tabIndex=0;closeDossier(false);armed=false;phase='prepare';pendingLevel=index;progress.currentLevel=index;delete progress.pendingAfter;save();draft=[...progress.deck];if(!draft.length)draft=['normal'];battle=new PVZ.Battle(index,progress.unlocked,draft,{route:progress.route});battle.paused=true;manualPause=false;selected=draft[0];inspected=progress.unlocked.at(-1)||'normal';row=2;hover=-1;titles(index);$('preparation').hidden=false;$('pausedStamp').hidden=true;bank();renderRoster();updateDefenseSummary();applyPause();rosterButtons[inspected].focus();
 if(!progress.lettersSeen.includes(index)||story.levels[index].branch)openLetter(index,hide,true);
}
$('startBattle').onclick=()=>{
 if(phase!=='prepare'||dialog.open||!draft.length)return;progress.deck=[...draft];save();battle=new PVZ.Battle(pendingLevel,progress.unlocked,draft,{route:progress.route});selected=draft[0];phase='battle';manualPause=false;armed=false;$('preparation').hidden=true;closeDossier(false);bank();
 const s=story.levels[battle.level];playPanels(s.beforePanels||[],()=>show(s.title,PVZ.LEVELS[battle.level].tag,body=>{lines(body,s.before);body.append(text('p',s.hint,'aside'));encounterBrief(body,battle.level);},[['开始行动',()=>{hide();sfx('readysetplant');notify('选择僵尸卡，在右侧入口召唤。',5);}]]));
};
function openLetter(index,onDone=hide,editable=false){
 const s=story.levels[index],l=s.letter;
 show(l.subject,`${PVZ.LEVELS[index].tag} · 作战来信`,body=>{
  body.append(text('p','致乔治·埃德加博士：','letter-greeting'));
  for(const p of l.paragraphs)body.append(text('p',p));body.append(text('p',l.signature,'letter-signature'));encounterBrief(body,index);
  if(s.branch){const options=text('div','','route-options');for(const [key,b]of Object.entries(s.branch)){const button=text('button','', 'route-option');button.dataset.route=key;button.setAttribute('aria-pressed',String(progress.route===key));button.append(text('strong',b.name),text('span',b.description));button.disabled=!editable;button.onclick=()=>{progress.route=key;save();for(const b of options.children)b.setAttribute('aria-pressed',String(b.dataset.route===key));battle=new PVZ.Battle(index,progress.unlocked,draft.length?draft:['normal'],{route:key});applyPause();updateDefenseSummary();sync();};options.append(button);}body.append(options);}
 },[[editable?'收好来信，选择僵尸':'合上信件',()=>{if(editable&&!progress.lettersSeen.includes(index)){progress.lettersSeen.push(index);save();}hide();onDone();}]]);
 dialog.classList.add('letter-dialog');
}
function playPanels(panels,onDone,persist=false,start=0){
 if(start>=panels.length){onDone();return;}
 const p=panels[start],c=story.comics[p.comic];
 const advance=n=>{if(persist&&progress.pendingAfter){progress.pendingAfter.stage='panels';progress.pendingAfter.panelIndex=n;save();}playPanels(panels,onDone,persist,n);};
 show(p.title,`故事插页 · ${start+1} / ${panels.length}`,body=>{
  const panel=text('div','','story-panel'),media=text('div','','story-frame'),im=document.createElement('img'),copy=text('div','','story-panel-copy');im.src=c.file;im.alt=p.title;im.style.left=p.panel%2?'-100%':'0';im.style.top=p.panel>1?'-100%':'0';im.onerror=()=>{media.hidden=true;copy.prepend(text('p','插画暂未读取，故事文字仍可继续。','aside'));};media.append(im);copy.append(text('p',p.text));panel.append(media,copy);body.append(panel);
 },[['继续故事',()=>advance(start+1)],['跳过插页',()=>advance(panels.length),true]]);
 dialog.classList.add('story-dialog');
}
function book(ch=0){show(story.chapters[ch].name,'故事档案',body=>{
 const tabs=text('div','','book-tabs');for(const [name,fn]of [['第一章',()=>book(0)],['第二章',()=>book(1)],['第一章漫画',()=>comic(0)],['第二章漫画',()=>comic(1)]]){const b=text('button',name);b.onclick=fn;tabs.append(b);}body.append(tabs,text('p',story.chapters[ch].subtitle));for(const sc of story.chapters[ch].scenes){const s=text('section','','story-scene');s.append(text('h3',PVZ.LEVELS[sc.index].tag+' · '+sc.title));if(progress.completed.includes(sc.index))lines(s,sc.lines);else s.append(text('p','行动尚未完成，故事将在推进后收录。','aside'));if(progress.lettersSeen.includes(sc.index)){const b=text('button','重读来信');b.onclick=()=>openLetter(sc.index,()=>book(ch));s.append(b);}body.append(s);}
},[['返回菜单',menu]]);}
function returnToGame(){if(phase==='home'){hide();return;}if(phase==='ended'){if(progress.pendingAfter)resumeAfter();else prepare(progress.currentLevel);}else hide();}
function damageGallery(){
 if(!ready||phase==='prologue')return;
 let unit=progress.unlocked.includes(selected)?selected:'normal',kind='zombie';
 show('受击动作图鉴','植物与同胞 · 外观与动作',body=>{
  const tabs=text('div','','damage-unit-tabs'),stageButtons=text('div','','damage-stage-tabs'),layout=text('div','','damage-gallery'),stage=text('div','','damage-stage'),canvas=document.createElement('canvas'),copy=text('div','','damage-copy'),name=text('h3',''),description=text('p',''),replay=text('button','重播动作','stone-button'),soft=text('button',progress.soft?'柔和动作：开':'柔和动作：关','stone-button');
  canvas.width=440;canvas.height=310;canvas.id='damageCanvas';canvas.setAttribute('aria-label','僵尸受击阶段动作演示');
  const kinds=text('div','','damage-kind-tabs');stage.append(canvas,text('span','动作演示 · 不消耗能量','damage-stage-note'));copy.append(name,description,replay,soft,text('p','实战只显示墓碑耐久；以护具、裂纹、姿态和动作表现受伤。','aside'));layout.append(stage,copy);body.append(kinds,tabs,layout,stageButtons);
  const chooseStage=(sample,button)=>{for(const b of stageButtons.children)b.setAttribute('aria-pressed',String(b===button));name.textContent=sample.name;description.textContent=sample.description;damagePreview={canvas,sample,kind,time:0,playing:true};};
  const chooseUnit=u=>{unit=u;for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.unit===u));stageButtons.replaceChildren();const samples=kind==='plant'?PVZ_RENDER.plantSamples(u,PVZ.PLANTS[u].hp):PVZ_RENDER.damageSamples(u,PVZ.UNITS[u].hp);for(const sample of samples){const b=text('button',sample.name);b.onclick=()=>chooseStage(sample,b);stageButtons.append(b);if(stageButtons.children.length===1)chooseStage(sample,b);}};
  const chooseKind=k=>{kind=k;canvas.setAttribute('aria-label',k==='plant'?'植物受击阶段动作演示':'僵尸受击阶段动作演示');for(const b of kinds.children)b.setAttribute('aria-pressed',String(b.dataset.kind===k));tabs.replaceChildren();const types=k==='plant'?Object.keys(PVZ.PLANTS):progress.unlocked;for(const u of types){const b=text('button',(k==='plant'?PVZ.PLANTS:PVZ.UNITS)[u].name);b.dataset.unit=u;b.onclick=()=>chooseUnit(u);tabs.append(b);}chooseUnit(types.includes(unit)?unit:types[0]);};
  for(const [k,label]of [['zombie','僵尸动作'],['plant','植物动作']]){const b=text('button',label);b.dataset.kind=k;b.onclick=()=>chooseKind(k);kinds.append(b);}
  replay.onclick=()=>{if(damagePreview){damagePreview.time=0;damagePreview.playing=true;}};
  soft.setAttribute('aria-pressed',String(progress.soft));soft.onclick=()=>{progress.soft=!progress.soft;save();soft.textContent=progress.soft?'柔和动作：开':'柔和动作：关';soft.setAttribute('aria-pressed',String(progress.soft));};
  chooseKind(kind);
 },[['返回',returnToGame]]);
 dialog.classList.add('damage-dialog');
}
function drawDamagePreview(dt){
 if(!damagePreview||!dialog.open)return;
 const p=damagePreview;if(p.playing)p.time+=dt;
 if(p.kind==='plant'){
  const plant={...p.sample.plant},t=p.time,dead=plant.hp<=0,c=p.canvas.getContext('2d');c.clearRect(0,0,440,310);c.fillStyle='#203324';c.fillRect(0,0,440,310);
  if(plant.hit)plant.hit=Math.max(0,.14-t);if(plant.attack)plant.attack=Math.max(0,.5-t);if(plant.windup)plant.windup=Math.max(0,.35-t);
  if(dead){p.playing=t<.5;plant.duration=.65;}
  renderer.drawPlant(c,plant,{x:220,foot:255,time:dead?Math.min(t,.5):t,scale:1.8,reducedMotion:progress.soft,dead});return;
 }
 const z={...p.sample.zombie};
 const t=p.time,dead=z.hp<=0;
 if(z.hit)z.hit=Math.max(0,.18-t);
 if(z.pop)z.pop=Math.max(.001,.72-t);
 if(z.emerging)z.emerging=Math.max(.001,1.2-t);
 if(dead){z.duration=4;p.playing=t<3.3;}
 if(t>=.72&&p.sample.zombie.pop)z.pop=0;
 if(t>=1.2&&p.sample.zombie.emerging)z.emerging=0;
 const c=p.canvas.getContext('2d');c.clearRect(0,0,440,310);c.fillStyle='#203324';c.fillRect(0,0,440,310);c.fillStyle='#3e5131';c.beginPath();c.ellipse(220,265,112,20,0,0,Math.PI*2);c.fill();
 renderer.drawZombie(c,z,{x:220,foot:260,time:dead?Math.min(t,3.3):t,scale:1.6,reducedMotion:progress.soft,dead});
 if(t<.32&&p.sample.zombie.hit)renderer.drawEffect(c,{kind:p.sample.zombie.hitKind,row:0,x:200,airborne:z.airborne,age:t,duration:.32},progress.soft);
}
function comic(index){const c=story.comics[index];show(c.title,'章节插页',body=>{if(!progress.completed.includes(index===0?2:LAST_LEVEL)){body.append(text('p','章节完成后收录整页漫画。推进中会在对应故事节点展示分镜。'));return;}const im=document.createElement('img');im.src=c.file;im.alt=c.title;im.className='comic-page';im.onerror=()=>{im.hidden=true;body.prepend(text('p','画面未能读取，以下分镜文字仍可阅读。','aside'));};body.append(im);const captions=text('div','','comic-caption');for(const [title,line]of c.captions){const e=text('div','');e.append(text('b',title),document.createTextNode(line));captions.append(e);}body.append(captions);},[['返回故事',()=>book(index)],['返回战场',returnToGame,true]]);}
function finish(status,rescue){
 phase='ended';manualPause=false;applyPause();
 if(status!=='won'){show('最后一座防守碑倒下了','行动受挫',body=>{body.append(text('p','只有全部防守碑被击碎才会战败。已解救的同胞、来信与已完成关卡保留。'));body.append(text('p','飞行和潜行单位不能替墓碑挡住地面火力；给地面路线也留一些同胞。','aside'));},[['重新选卡',()=>prepare(battle.level)],['菜单',menu,true]]);return;}
 if(!progress.completed.includes(battle.level))progress.completed.push(battle.level);progress.highest=Math.max(progress.highest,Math.min(LAST_LEVEL,battle.level+1));
 if(rescue&&!progress.unlocked.includes(rescue.unit)){progress.unlocked.push(rescue.unit);if(progress.deck.length<MAX_CARDS)progress.deck.push(rescue.unit);}
 if(!progress.pendingAfter)progress.pendingAfter={level:battle.level,time:battle.time,casualties:battle.casualties,reason:battle.winReason,tombs:battle.tombs.map(t=>t.hp),rescue:rescue?.unit||null,stage:'rescue',panelIndex:0};save();
 const q=progress.pendingAfter,s=story.levels[battle.level];
 const ending=()=>{q.stage='result';save();show(battle.level===LAST_LEVEL?'门的另一边 · 前两章完':battle.level===2?'灯下的饭桌':'通道已打开',battle.winReason==='door'?'进门成功':'两行小车已经耗尽',body=>{if(s.branch)lines(body,s.branch[progress.route].after);lines(body,s.after);body.append(text('p',`防守碑剩余 ${q.tombs.filter(h=>h>0).length} 座 · 战损 ${q.casualties} · 用时 ${Math.floor(q.time)} 秒`,'aside'));if(battle.level===LAST_LEVEL)body.append(text('p','前两章已完成。已救同胞、分支和来信已保存，可回到章节选择重玩。后续城镇、机甲与最终结局不在本版范围。','aside'));},battle.level<LAST_LEVEL?[[`前往 ${PVZ.LEVELS[battle.level+1].tag.split('·')[1].trim()} 选卡`,()=>prepare(battle.level+1)],['重新选卡',()=>prepare(battle.level),true]]:[['返回章节选择',()=>{delete progress.pendingAfter;save();goHome();chapters();}],['重玩本关',()=>prepare(battle.level),true],['故事与漫画',()=>book(1),true]]);};
 const panels=()=>{q.stage='panels';save();playPanels(s.afterPanels||[],ending,true,q.panelIndex);};
 if(q.stage==='result'){ending();return;}if(q.stage==='panels'){panels();return;}
 const u=q.rescue;if(u){show(`解救成功：${PVZ.UNITS[u].name}`,'植物看守撤退 · 打开囚室',body=>{const panel=text('div','','rescue-reveal'),im=document.createElement('img');im.src=portrait(u);im.alt=PVZ.UNITS[u].name;const d=text('div','');d.append(text('strong',PVZ.UNITS[u].name),text('p',roster[u].role),text('p',roster[u].origin));panel.append(im,d);body.append(panel);attachRewardScene(body,u);lines(body,[[PVZ.UNITS[u].name,({cone:'饭盒里只有米饭……他们却说我是怪物。',bucket:'面包还在吗？我想回去看看那个孩子。',balloon:'绳索松开了。我能看见地窖入口。',digger:'把镐还给我。地下还有人需要空气。'})[u]],['乔治','欢迎回来。我们一起走。']]);body.append(text('p','已永久加入同胞名册，下一次编组可用。','aside'));},[['带同胞回去',panels]]);dialog.classList.add('rescue-dialog');}else{show('通道已打开',q.reason==='door'?'大门突破':'两路小车已离场',body=>{attachRewardScene(body,null);body.append(text('p','同胞已安全通过，避难所的路接通了。','award-message'),text('p',battle.level===0?'路障同胞将在 1-2 解救。':'本关行动已记录，继续查看战后故事。','aside'));},[['收好通行信',panels]]);dialog.classList.add('award-dialog');}
}
function resumeAfter(){$('home').hidden=true;const q=progress.pendingAfter;battle=new PVZ.Battle(q.level,progress.unlocked,progress.deck,{route:progress.route});battle.status='won';battle.winReason=q.reason;battle.time=q.time;battle.casualties=q.casualties;battle.tombs.forEach((t,i)=>t.hp=q.tombs[i]);pendingLevel=q.level;titles(q.level);$('preparation').hidden=true;bank();finish('won',q.rescue?{unit:q.rescue}:null);}
function menu(){
 if(!ready||phase==='prologue')return;
 if(phase==='home'){goHome();return;}
 show('菜单','僵王崛起',body=>{body.append(text('p',PVZ.LEVELS[battle.level].tag+' · '+PVZ.LEVELS[battle.level].name,'pause-level'),text('p','进门，或让两路小车离场；保住至少一座防守碑。','aside'));},[['返回',returnToGame],['重新选卡',()=>resetPrompt(battle.level),true],['设置与档案',()=>settings(menu),true],['返回主菜单',leaveHomePrompt,true]]);dialog.classList.add('menu-dialog','compact-menu');
}
function resetPrompt(index){show('重新集结？','战前编组',body=>body.append(text('p','本场战斗将重置。已解救的僵尸卡和关卡进度都会保留。')),[['前往选卡',()=>prepare(index)],['返回菜单',menu,true]]);}
const cinema=PVZ_CINEMA.createPrologue({data:PVZ_PROLOGUE,elements:{root:$('prologue'),frame:$('prologueFrame'),speaker:$('prologueSpeaker'),text:$('prologueText'),count:$('prologueCount'),play:$('prologuePlay'),back:$('prologueBack'),next:$('prologueNext'),progress:$('prologueProgress'),flash:$('prologueFlash'),skip:$('prologueSkip'),reduce:$('prologueReduce'),error:$('prologueImageError')},onSound:sceneSound,onExit:result=>{
 if(progress.prologue?.status!=='completed'||result.status==='completed')progress.prologue=result;save();
 if(cinemaReturn?.startup){if(progress.pendingAfter)resumeAfter();else prepare(progress.currentLevel);}else{phase=cinemaReturn.phase;if(phase==='home'){goHome();return;}if(phase==='ended'){if(progress.pendingAfter)resumeAfter();else finish('lost');return;}$('preparation').hidden=phase!=='prepare';bank();if(phase==='prepare')renderRoster();applyPause();}
}});
function startCinema(startup){
 cinemaReturn={startup,phase};dialog.close();$('home').hidden=true;closeDossier(false);phase='prologue';$('preparation').hidden=true;applyPause();cinema.start({soft:progress.soft});
}
$('prologueSound').onclick=()=>{soundOn=!soundOn;syncSound();if(soundOn)sceneSound('static');};
$('prologueReduce').addEventListener('click',()=>{progress.soft=$('prologueReduce').getAttribute('aria-pressed')==='true';save();});
function sync(){
 $('arena').dataset.phase=phase;$('arena').dataset.mechanics=String(!!(battle.hazards.length||battle.supplies.length||battle.reinforcements.some(r=>!r.arrived)));
 $('energy').textContent=Math.floor(battle.energy);$('tombCount').textContent=`${battle.tombs.filter(t=>t.hp>0).length} / 5`;
 const reinforcements=battle.reinforcements.filter(r=>!r.arrived),supplies=battle.supplies;
 $('modeStatus').textContent=battle.hazards.length?battle.hazards.map(h=>`第${h.row+1}行${h.state==='active'?'通电':h.state==='warning'?'预警':'电网休眠'}`).join(' · '):supplies.length?`口粮 ${supplies.filter(s=>s.collected).length} / ${supplies.length}`:reinforcements.length?`植物增援 ${Math.max(0,Math.ceil(reinforcements[0].at-battle.time))}秒`:'进门或两路小车离场获胜';
 for(const b of $('cards').querySelectorAll('.unit-card')){const u=b.dataset.unit,cd=battle.cooldowns[u],short=Math.max(0,Math.ceil(PVZ.UNITS[u].cost-battle.energy));const status=phase==='prepare'?'已编入':cd>0?`${cd.toFixed(1)}秒`:short?`缺 ${short}`:'可召唤';b.classList.toggle('selected',phase==='battle'&&armed&&u===selected);b.classList.toggle('no-energy',phase==='battle'&&short>0);b.classList.toggle('cooling',phase==='battle'&&cd>0);b.setAttribute('aria-pressed',String(phase==='prepare'||armed&&u===selected));b.setAttribute('aria-label',`${PVZ.UNITS[u].name}，${PVZ.UNITS[u].cost}能量，${status}`);b.querySelector('i').style.transform=`scaleY(${phase==='battle'?cd/PVZ.UNITS[u].cooldown:0})`;b.querySelector('.card-state').textContent=status;}
 const unit=phase==='prepare'?inspected:selected,stats=PVZ.UNITS[unit];
 if($('selectedPortrait').getAttribute('src')!==portrait(unit))$('selectedPortrait').src=portrait(unit);$('selectedName').textContent=stats.name;
 const cooldown=battle.cooldowns[unit],short=Math.max(0,Math.ceil(stats.cost-battle.energy));
 const canDeploy=phase==='battle'&&armed&&!battle.paused&&cooldown===0&&!short;
 $('selectedState').textContent=phase==='prepare'?`${stats.cost} 能量 · ${stats.cooldown}秒冷却`:phase==='ended'?'行动结束':manualPause?'战斗已暂停':cooldown>0?`冷却 ${cooldown.toFixed(1)} 秒`:short?`还需 ${short} 能量`:`${stats.cost} 能量 · 右侧召唤`;
 $('selectedLane').textContent=phase==='prepare'?'战前编组':`第 ${row+1} 行`;$('deploymentReadout').classList.toggle('ready',canDeploy);
 updateGhost();
 rows.forEach(b=>{b.classList.toggle('active',phase==='battle'&&+b.dataset.row===row);b.classList.toggle('deploy-ready',canDeploy);b.disabled=phase!=='battle';b.setAttribute('aria-label',`第 ${+b.dataset.row+1} 行召唤${stats.name}`);});$('pause').disabled=phase!=='battle';$('letterTool').disabled=!ready||phase==='prologue';$('damageTool').disabled=!ready||phase==='prologue';
}
function deploy(r){if(!ready||phase!=='battle'||dialog.open)return;row=r;if(!armed){notify('先选择一张僵尸卡。');return;}const result=battle.deploy(selected,r);if(result.ok){armed=false;sfx('plant');notify(`${PVZ.UNITS[selected].name}进入第 ${r+1} 行。`,2);}else notify(result.reason);sync();}
function pause(){if(phase!=='battle'||dialog.open)return;manualPause=!manualPause;applyPause();}
$('pause').onclick=pause;$('menu').onclick=menu;$('reload').onclick=()=>location.reload();rows.forEach(b=>b.onclick=()=>deploy(+b.dataset.row));
$('letterTool').onclick=()=>{if(ready&&phase!=='prologue')openLetter(phase==='home'?progress.currentLevel:phase==='prepare'?pendingLevel:battle.level,returnToGame,false);};$('damageTool').onclick=damageGallery;
document.querySelector('.app-footer a').onclick=e=>{e.preventDefault();if(ready&&phase!=='prologue')book(story.levels[battle.level].chapter);};
rows.forEach(b=>b.addEventListener('pointerdown',()=>{if(phase==='battle'&&armed){hover=+b.dataset.row;pointerX=PVZ.FIELD.spawnX;pointerY=220+hover*96;updateGhost();}}));
$('arena').addEventListener('pointermove',e=>{
 if(phase!=='battle'||dialog.open)return;
 if(e.target!==$('battle')&&!e.target.closest('#entrances')){hover=-1;updateGhost();return;}
 const r=$('battle').getBoundingClientRect();pointerX=(e.clientX-r.left)*1200/r.width;pointerY=(e.clientY-r.top)*720/r.height;
 hover=pointerY>=172&&pointerY<652?Math.floor((pointerY-172)/96):-1;updateGhost();
});$('arena').addEventListener('pointerleave',()=>{hover=-1;updateGhost();});
$('arena').addEventListener('contextmenu',e=>{e.preventDefault();armed=false;updateGhost();sync();});
$('battle').addEventListener('click',e=>{if(phase!=='battle'||dialog.open)return;const r=$('battle').getBoundingClientRect(),x=(e.clientX-r.left)*1200/r.width,y=(e.clientY-r.top)*720/r.height;if(x>=PVZ.FIELD.entryLeft&&x<=PVZ.FIELD.entryRight&&y>=172&&y<652)deploy(Math.floor((y-172)/96));else if(y>=172&&y<652)notify('从新增墓碑列右侧的入口召唤，不能直接投放到植物身后。');});
document.addEventListener('keydown',e=>{
 if(!ready||dialog.open)return;
 if(!$('unitDossier').hidden){if(e.key==='Escape'){e.preventDefault();closeDossier();}else if(e.key==='Tab'){e.preventDefault();const nodes=[$('dossierClose'),document.querySelector('.dossier-copy'),...(!$('dossierToggle').disabled?[$('dossierToggle')]:[])],i=nodes.indexOf(document.activeElement);nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length].focus();}return;}
 if(phase==='prologue'){if(e.key==='Tab'){e.preventDefault();const controls=[...$('prologue').querySelectorAll('button:not(:disabled)')],i=controls.indexOf(document.activeElement);controls[(i+(e.shiftKey?-1:1)+controls.length)%controls.length].focus();return;}if(e.key==='Enter'&&document.activeElement?.tagName==='BUTTON')return;cinema.key(e);return;}
 if(phase==='prepare'){
  if(e.key==='Tab'){e.preventDefault();const nodes=[...$('cards').querySelectorAll('button'),...['menu'].map($),...$('preparation').querySelectorAll('.chooser-window button:not(:disabled),.preview-tools button')],i=nodes.indexOf(document.activeElement);nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length].focus();}return;
 }
 if(phase!=='battle'||e.ctrlKey||e.altKey||e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 if(e.key==='Escape'){e.preventDefault();armed=false;sync();}else if(e.code==='Space'){e.preventDefault();pause();}else if(e.key==='ArrowUp'){e.preventDefault();row=Math.max(0,row-1);pointerX=PVZ.FIELD.spawnX;hover=row;pointerY=220+row*96;sync();}else if(e.key==='ArrowDown'){e.preventDefault();row=Math.min(4,row+1);pointerX=PVZ.FIELD.spawnX;hover=row;pointerY=220+row*96;sync();}else if(e.key==='Enter'&&document.activeElement?.tagName!=='BUTTON'){e.preventDefault();deploy(row);}else if(['1','2','3','4','5'].includes(e.key)){const u=[...battle.deck][+e.key-1];if(u){selected=u;armed=true;hover=row;pointerX=PVZ.FIELD.spawnX;pointerY=220+row*96;sync();}}
});
function pauseForHost(){stopEffects();if(phase==='prologue')cinema.pause();else if(phase==='battle'&&!manualPause){manualPause=true;applyPause();}}
window.addEventListener('pvz-native-pause',pauseForHost);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForHost();last=performance.now();});
dialog.addEventListener('cancel',e=>{e.preventDefault();if(dialogCancelAction)dialogCancelAction();else if(phase==='battle'||phase==='prepare')hide();});

const activeEffects=new Set();
function stopEffects(){for(const a of activeEffects)a.pause();activeEffects.clear();}
function sfx(name){
 if(!soundOn||!assets.sounds?.[name])return;
 try{const a=new Audio(assets.sounds[name]);a.volume=name==='lawnmower'?.22:.4;activeEffects.add(a);a.onended=a.onerror=()=>activeEffects.delete(a);const p=a.play();p?.catch(()=>activeEffects.delete(a));}catch{}
}
document.addEventListener('click',e=>{if(e.target.closest('button'))sfx('buttonclick');},true);
function animateCard(unit,from){
 if(progress.soft)return;const destination=$('cards').querySelector(`[data-unit="${unit}"]`);if(!destination||typeof destination.animate!=='function')return;
 const to=destination.getBoundingClientRect(),area=$('arena').getBoundingClientRect(),copy=rosterButtons[unit].cloneNode(true);copy.className='unit-card card-flight';copy.disabled=true;copy.setAttribute('aria-hidden','true');copy.tabIndex=-1;
 Object.assign(copy.style,{left:(from.left-area.left)+'px',top:(from.top-area.top)+'px',width:from.width+'px',height:from.height+'px'});$('arena').append(copy);
 const motion=copy.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width})`}],{duration:260,easing:'ease-out'});motion.onfinish=motion.oncancel=()=>copy.remove();
}
function closeDossier(restore=true){$('unitDossier').hidden=true;$('preparation').classList.remove('show-dossier');if(restore&&detailsFocus?.isConnected)detailsFocus.focus();}
function openDossier(unit=inspected){if(phase!=='prepare'||dialog.open)return;detailsFocus=document.activeElement;inspected=unit;renderRoster();$('unitDossier').hidden=false;$('preparation').classList.add('show-dossier');$('dossierClose').focus();}
function updateDefenseSummary(){
 const counts={};for(const p of battle.plants)counts[p.type]=(counts[p.type]||0)+1;
 $('defenseSummary').textContent=Object.entries(counts).map(([k,n])=>`${PVZ.PLANTS[k].name} ×${n}`).join('　');
}
function drawDefensePreview(time){
 const c=$('defenseCanvas').getContext('2d'),bg=pictures[battle.config.night?'ui:background2.jpg':'ui:background1.jpg'];c.clearRect(0,0,520,380);if(bg)c.drawImage(bg,250,72,750,500,0,0,520,380);
 for(const p of battle.plants)renderer.drawPlant(c,p,{x:38+(p.x-210)*.86,foot:70+p.row*72,time:progress.soft?0:time,scale:.57,reducedMotion:progress.soft});
}
function updateGhost(){
 const e=$('deployGhost');e.hidden=phase!=='battle'||dialog.open||manualPause||!armed||hover<0;
 if(e.hidden)return;const valid=pointerX>=PVZ.FIELD.entryLeft&&pointerX<=PVZ.FIELD.entryRight&&battle.cooldowns[selected]<=0&&battle.energy>=PVZ.UNITS[selected].cost;
 e.classList.toggle('invalid',!valid);if($('ghostPortrait').getAttribute('src')!==portrait(selected))$('ghostPortrait').src=portrait(selected);e.style.left=((valid?PVZ.FIELD.spawnX:pointerX)/12)+'%';e.style.top=((220+hover*96-93)/7.2)+'%';$('ghostLabel').textContent=valid?'点击召唤':pointerX<PVZ.FIELD.entryLeft||pointerX>PVZ.FIELD.entryRight?'只能在右侧入口召唤':'冷却或能量不足';
}
function flyEnergy(r,amount=500){const e=$('energyFlight');e.textContent='+'+amount;e.hidden=false;e.classList.remove('flying');e.style.setProperty('--from-y',((220+r*96)/12)+'cqw');e.classList.toggle('soft',progress.soft);void e.offsetWidth;e.classList.add('flying');}
$('energyFlight').addEventListener('animationend',()=>{$('energyFlight').hidden=true;});
function goHome(){
 stopEffects();$('battle').tabIndex=-1;hide();phase='home';manualPause=false;armed=false;closeDossier(false);$('preparation').hidden=true;$('home').hidden=false;
 $('homeActionCaption').textContent=progress.pendingAfter?'继续战后故事':progress.prologue?'继续营救':'开始营救';$('homeProgress').textContent=`${PVZ.LEVELS[progress.currentLevel].tag} · ${PVZ.LEVELS[progress.currentLevel].name}　已解救 ${progress.unlocked.length} / 5`;
 window.PVZ_UI?.updateRecord(PVZ.LEVELS[progress.currentLevel].tag.split('·')[1].trim(),progress.unlocked.length,$('homeProgress').textContent);if(saveWarning)homeMessage(saveWarning,true);applyPause();sync();$('homeContinue').focus();
}
function continueAdventure(){if(!ready)return;$('home').hidden=true;if(progress.pendingAfter)resumeAfter();else if(progress.prologue?.version===PVZ_PROLOGUE.version)prepare(progress.currentLevel);else startCinema(true);}
function leaveHomePrompt(){if(phase==='battle')show('返回主菜单？','进度已保留',body=>body.append(text('p','本场战斗会从本关开局重新开始。已解救同胞与章节进度保留。')),[['返回主菜单',goHome],['返回战场',hide,true]]);else goHome();}
function chapters(){
 show('营救行动','章节选择',body=>{const list=text('div','','menu-levels chapter-grid');for(let n=0;n<PVZ.LEVELS.length;n++){const b=text('button',`${PVZ.LEVELS[n].tag.split('·')[1].trim()} ${PVZ.LEVELS[n].name}`,'stone-button');b.disabled=n>progress.highest;b.onclick=()=>{hide();if(progress.prologue?.version!==PVZ_PROLOGUE.version){progress.currentLevel=n;save();startCinema(true);}else if(progress.pendingAfter){show('切换行动？','战后故事尚未读完',body=>body.append(text('p','继续当前战后故事，或切换到所选关卡。已解救同胞和完成进度保留。')),[['继续战后故事',()=>{hide();resumeAfter();}],['前往选卡',()=>prepare(n),true]]);}else prepare(n);};list.append(b);}body.append(list);},[['返回',()=>{if(phase==='home')goHome();else returnToGame();}],['故事与漫画',()=>book(0),true]]);dialog.classList.add('chapter-dialog');
}
function archives(){show('同胞与故事','避难所档案',body=>body.append(text('p','回看已经收录的来信、漫画与动作。未解救的同胞不会提前加入队伍。')),[['故事与漫画',()=>book(0)],['动作图鉴',damageGallery,true],['重看序章',()=>startCinema(false),true],['返回',goHome,true]]);}
function settings(back=returnToGame){
 show('设置与档案','僵王崛起',body=>{
  for(const [label,on,fn]of [['声音',soundOn,()=>{soundOn=!soundOn;if(!soundOn)stopEffects();progress.sound=soundOn;save();syncSound();if(soundOn)sfx('seedlift');settings(back);}],['柔和转场',progress.soft,()=>{progress.soft=!progress.soft;save();settings(back);}]]){const r=text('div','','settings-row'),b=text('button',on?'开':'关');b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',label+'：'+(on?'开':'关'));r.append(text('span',label),b);b.onclick=fn;body.append(r);}
  const field=text('fieldset','','theme-settings'),legend=text('legend','界面风格'),choices=text('div','','theme-choices'),status=text('p','当前：'+(window.PVZ_UI?.names[progress.uiTheme]||'经典木牌'),'theme-setting-status');status.id='themeSettingsStatus';field.append(legend,choices,status);
  for(const [key,label,family]of [['wood','经典木牌','cartoon'],['stone','僵族石刻','cutpaper'],['paper','旧纸来信','ink']]){const button=text('button','','theme-choice'),icon=text('span','','theme-choice-icon'),name=text('span',label);icon.setAttribute('aria-hidden','true');name.dataset.nativeFont='';name.dataset.fontFamily=family;button.dataset.theme=key;button.setAttribute('aria-pressed',String(progress.uiTheme===key));button.append(icon,name);button.onclick=()=>{progress.uiTheme=key;const saved=save();for(const b of choices.children)b.setAttribute('aria-pressed',String(b.dataset.theme===key));status.textContent='当前：'+label+(saved?' · 已保存':' · 仅本次窗口生效，未保存');window.PVZ_UI?.setTheme(key);};choices.append(button);}
  const fonts=text('p','','theme-setting-status');fonts.id='uiFontStatus';field.append(fonts);body.append(field);
 },[['返回',back],['作战来信',()=>openLetter(phase==='home'?progress.currentLevel:phase==='prepare'?pendingLevel:battle.level,()=>settings(back),false),true],['动作图鉴',damageGallery,true],['重看序章',()=>startCinema(false),true],['故事与漫画',()=>book(0),true]]);
 window.PVZ_UI?.setTheme(progress.uiTheme);
}
for(const el of document.querySelectorAll('.home-record'))el.onclick=chapters;
$('homeContinue').onclick=continueAdventure;$('homeChapters').onclick=chapters;$('homeArchives').onclick=archives;$('homeSettings').onclick=()=>settings(goHome);
function attachRewardScene(body,unit){
 const c=document.createElement('canvas');c.width=300;c.height=220;c.className='reward-canvas';c.setAttribute('aria-label',unit?'囚门打开，同胞走出':'同胞通过已打开的通道');body.prepend(c);rewardPreview={canvas:c,unit,time:0};
 if(unit){const reveal=card(unit,'unit-card reward-card');reveal.disabled=true;reveal.setAttribute('aria-label',PVZ.UNITS[unit].name+'已永久解救');body.append(reveal);}
}
function drawReward(dt){
 if(!rewardPreview||!dialog.open)return;const p=rewardPreview;p.time+=dt;const c=p.canvas.getContext('2d'),bg=pictures['ui:Almanac_GroundNight.jpg'];c.clearRect(0,0,300,220);if(bg)c.drawImage(bg,0,0,300,220);
 const t=progress.soft?1:Math.min(1,p.time/1.4),unit=p.unit||'normal';renderer.drawZombie(c,{type:unit,maxHp:PVZ.UNITS[unit].hp,hp:PVZ.UNITS[unit].hp,age:p.time,airborne:false,slow:0,hit:0},{x:110+t*55,foot:208,time:p.time,scale:1.4,reducedMotion:progress.soft});
 if(p.unit){const gate=pictures['ui:rescue-door.png'];if(gate){c.globalAlpha=1-t*.7;c.drawImage(gate,48+t*135,0,165,216);c.globalAlpha=1;}}
}

const load=src=>new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>reject(Error('读取素材超时：'+src)),15000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(Error('无法读取素材：'+src));};im.src=src;});
try{
 const jobs=[...Object.entries(assets.images).map(([id,v])=>[id,v.path]),...Object.entries(assets.ui).map(([name,url])=>['ui:'+name,url]),['tomb-alpha','assets/tombstones-alpha.png']];let loaded=0;
 await Promise.all(jobs.map(async([id,url])=>{pictures[id]=await load(url);$('loadingText').textContent=`读取原版素材 ${++loaded} / ${jobs.length}`;}));
 renderer=PVZ_RENDER.createRenderer(assets,pictures,pictures['tomb-alpha']);ready=true;$('loading').hidden=true;if(saveWarning)$('saveStatus').textContent=saveWarning;
 goHome();
 function frame(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;applyPause();if(phase==='prologue')cinema.step(dt);else battle.step(dt);
  const events=battle.drainEvents();let rescue=null,brokenRows=[];for(const e of events){if(e.type==='tombBroken'){notify(`第 ${e.row+1} 行防守碑失守，僵尸能量 +500！`,5);brokenRows.push(e.row);sfx('gravestone_rumble');}else if(e.type==='mowerTriggered'){notify(`第 ${e.row+1} 行小车发动！它会清掉同行僵尸，离场后这条路不再有小车。`,6);sfx('lawnmower');}else if(e.type==='mowerSpent')notify(`第 ${e.row+1} 行小车已驶离。已耗掉 ${battle.clearedRows} / 2 行。`,5);else if(e.type==='balloonPopped')notify(`第 ${e.row+1} 行气球被仙人掌击破，同胞落地推进。`,4);else if(e.type==='diggerEmerged')notify(`第 ${e.row+1} 行矿工正在出土，地下阶段不会保护墓碑。`,4);else if(e.type==='reinforcement')notify(`第 ${e.row+1} 行植物增援到达。`,4);else if(e.type==='supplyCollected')notify(`取回第 ${e.row+1} 行口粮，能量 +${e.energy}。`,4);else if(e.type==='rescue')rescue=e;else if(e.type==='end')finish(e.status,rescue);}
  if(brokenRows.length)flyEnergy(brokenRows.at(-1),brokenRows.length*500);
  if(phase!=='home')renderer.draw(ctx,battle,{hoverRow:phase==='battle'&&armed?hover:-1,selectedRow:phase==='battle'&&armed?row:-1,reducedMotion:progress.soft});if(phase==='prepare')drawDefensePreview(now/1000);drawReward(dt);drawDamagePreview(dt);sync();if(performance.now()>noticeUntil)$('notice').style.opacity='.12';requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
}catch(error){$('loadingText').textContent=error.message;$('reload').hidden=false;console.error(error);}
})();
