(async function(){'use strict';
const $=id=>document.getElementById(id),catalog=PVZ_BATTLE_MAPS,campaign=PVZ_BATTLE_CAMPAIGN,preview=PVZ_BATTLE_ATLAS_MODEL,assets=PVZ_ASSETS,pictures={},canvas=$('mapScene'),ctx=canvas.getContext('2d'),nav=$('atlasNav'),body=$('atlasBody');
let view='maps',selected='lawn',currentMap=catalog.getMap('lawn'),scene=preview.createPreview('lawn'),ready=false,painter,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,clock=0;
Object.assign(assets.actors,PVZ_RESCUE_PLANT_ASSETS.actors);Object.assign(assets.images,PVZ_RESCUE_PLANT_ASSETS.images);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
function paragraph(text,cls){body.append(el('p',text,cls));}function section(title,lines){body.append(el('h3',title));const list=el('ul');for(const line of lines)list.append(el('li',line));body.append(list);}
function mapLinks(ids){const row=el('div',null,'map-links');for(const id of ids){const map=catalog.getMap(id),b=el('button',map.name);b.type='button';b.onclick=()=>select('maps',id);row.append(b);}body.append(row);}
function setPreview(id){currentMap=catalog.getMap(id);scene=preview.createPreview(currentMap.id);clock=0;updateRoute();canvas.setAttribute('aria-label',currentMap.name+'场地视觉试演，五行十列，右侧五段栅栏。此处只预览布局；另有八境营救入口运行地形机制。');$('previewCaption').textContent=currentMap.name+' · 原版场景与现有角色实绘。水域、底座、昼夜和雾区机制已接入独立八境营救；本预览不运行对局，吊篮等进阶交互仍待制作。';paint();}
function updateRoute(){scene.teams[0].path=$('showRoute').checked?preview.traceRoute(currentMap.id,{row:scene.teams[0].row,col:scene.teams[0].col},currentMap.landmarks[0]):[];}
function paint(){if(ready)painter.paint(ctx,scene,{environment:currentMap,reducedMotion:!playing});}
function link(label,url){const a=el('a',label,'classic-button');a.href=url;$('atlasLinks').append(a);}
function navButton(label,id,nextView,status){const b=el('button',label);b.type='button';b.dataset.item=id;b.setAttribute('aria-pressed',String(view===nextView&&selected===id));if(status)b.append(el('small',status==='playable'?'现有玩法':'制作方案'));b.onclick=()=>select(nextView,id,true);nav.append(b);}
function renderNav(focus=false){const scrollLeft=nav.scrollLeft,scrollTop=nav.scrollTop;nav.replaceChildren();nav.setAttribute('aria-label',view==='maps'?'场地列表':view==='modes'?'玩法列表':'战役节点');
 if(view==='maps')for(const map of catalog.maps)navButton(map.name,map.id,'maps');
 else if(view==='modes')for(const mode of catalog.modes)navButton(mode.name,mode.id,'modes',mode.status);
 else{const visible=preview.visibleBeats(campaign,$('spoilers').checked);for(const chapter of campaign.chapters){if(chapter.id==='ending'&&!$('spoilers').checked)continue;nav.append(el('h2',chapter.title));for(const beat of visible.filter(b=>b.chapter===chapter.id))navButton(beat.id+' · '+beat.title,beat.id,'campaign',beat.status);}}
 nav.scrollLeft=scrollLeft;nav.scrollTop=scrollTop;if(focus){const b=[...nav.querySelectorAll('button')].find(b=>b.dataset.item===selected);if(b){b.focus({preventScroll:true});b.scrollIntoView?.({block:'nearest',inline:'nearest'});}}
}
function select(nextView,id,focus=false){view=nextView;selected=id;for(const b of document.querySelectorAll('#atlasTabs button'))b.setAttribute('aria-pressed',String(b.dataset.view===view));$('spoilerControl').hidden=view!=='campaign';body.replaceChildren();$('atlasLinks').replaceChildren();
 if(view==='maps'){
  const map=catalog.getMap(id);selected=map.id;setPreview(map.id);$('atlasEyebrow').textContent='场地布局预览 · 基础护送实战另有入口';$('atlasTitle').textContent=map.name;$('atlasSummary').textContent=map.summary;
  link('试玩本图地形营救（不保存）','terrain-campaign.html?trial=1&level='+(['lawn','night','underground','pool','fog','canal','roof','roof-night'].indexOf(map.id)*5));paragraph('本页仍是场地与路线方案，下述进阶目标尚未进入实战；八境营救另有40关基础护送与地形机制，不在这里提前解锁同胞。','design-note');section(map.title,map.briefing);section('这一场怎样玩',map.rules);section('三支队伍的分工',map.roles);section('危险如何预告',[map.telegraph]);section('受挫后怎样回来',[map.recovery]);section('正式实战前需要完成',map.prerequisites);
  const related=campaign.beats.filter(b=>b.mapId===map.id&&!campaign.truth.protectedIds.includes(b.id));section('战役中的用途',related.map(b=>b.id+' · '+b.title+'：'+b.goal));
  paragraph('现有共同规则：三队各最多三人；60秒准备可提前出发；末列五段栅栏各600耐久；博士位置由玩家指定且对人机隐藏，命中按10次计数。','continuity');
 }else if(view==='modes'){
  const mode=catalog.modes.find(m=>m.id===id)||catalog.modes[0];selected=mode.id;setPreview(mode.maps[0]);$('atlasEyebrow').textContent=mode.status==='playable'?'七关与八境营救共有的基础玩法':'玩法制作方案 · 尚未加入实战';$('atlasTitle').textContent=mode.name;$('atlasSummary').textContent=mode.question;
  paragraph(mode.status==='playable'?'现有七关与独立八境营救四十关都采用接通补给、开门和护送返营。八境营救另有水域、底座、昼夜与迷雾机制；其他进阶目标仍为设计。':'这是一种后续玩法方案，场地可预览，目标状态机和胜负规则尚未加入实战。','design-note');section('规则',[mode.rule]);section('与现有对局的差异',[mode.difference]);section('实现状态',[mode.dependency]);body.append(el('h3','适用场地'));mapLinks(mode.maps);if(mode.status==='playable'){link('进入现有七关营救','rescue-design.html');link('进入八境营救四十关','terrain-campaign.html');}
 }else{
  const available=preview.visibleBeats(campaign,$('spoilers').checked),beat=available.find(b=>b.id===id)||available[0];selected=beat.id;setPreview(beat.mapId);const chapter=campaign.chapters.find(c=>c.id===beat.chapter);$('atlasEyebrow').textContent=chapter.title+' · '+(beat.status==='playable'?'现有营救玩法':'后续制作稿');$('atlasTitle').textContent=beat.id+' · '+beat.title;$('atlasSummary').textContent=beat.goal;
  paragraph(beat.status==='playable'?'这一节点已有营救实战；这里显示的是规划场地与故事衔接，水域、屋顶等专属地形并未因此自动加入原关卡。':'此节点是完整战役制作稿，当前不能直接进入这场新对局。','design-note');section('为什么来到这里',beat.entry);section('这一次的转折',[beat.turn]);section('离开以后',[beat.exit]);section('让人物有自己的选择',[beat.humaneChoice]);if(beat.nextId){const next=campaign.beats.find(b=>b.id===beat.nextId);paragraph('下一段：'+(!$('spoilers').checked&&campaign.truth.protectedIds.includes(next.id)?'终章收束（剧透已隐藏）':next.id+' · '+next.title),'continuity');}
  if(beat.rescueTag){const level=PVZ_RESCUE_DESIGN.levels.findIndex(l=>l.tag===beat.rescueTag);link('进入这关现有营救玩法','rescue-design.html?level='+level);}
  if(beat.mode==='classic-zombot'||beat.mode==='mech-trial'){const img=el('img',null,'boss-art');img.src='assets/almanac/boss.webp';img.alt='经典巨大僵王机甲造型，终局机制尚待制作';body.append(img);section('巨大机甲的定位',['保留经典巨大体量、冰火对消、投放与踩压的战斗身份；第四章先教学，第五章再汇合。文化机甲外观共用这套规则，小鬼仍是独立同胞。']);}
  if($('spoilers').checked){section('伏笔与创作说明',[beat.foreshadow]);if(beat.chapter==='ending')section('结局不可改变的边界',[campaign.truth.reality,campaign.truth.invariant,campaign.truth.branchRule]);}
 }
 renderNav(focus);
}
for(const b of document.querySelectorAll('#atlasTabs button'))b.onclick=()=>select(b.dataset.view,b.dataset.view==='maps'?'lawn':b.dataset.view==='modes'?'rescue':'1-1');
$('spoilers').onchange=()=>select('campaign',!$('spoilers').checked&&campaign.truth.protectedIds.includes(selected)?'5-3':selected);
$('showRoute').onchange=()=>{updateRoute();paint();};$('animate').onclick=()=>{playing=!playing;syncAnimation();paint();};function syncAnimation(){$('animate').setAttribute('aria-pressed',String(playing));$('animate').textContent=playing?'暂停角色动作':'播放角色动作';}
$('retryAssets').onclick=()=>location.reload();select('maps','lawn');syncAnimation();
function load(file){return new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>reject(Error('素材读取超时：'+file)),15000);image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(Error('素材读取失败：'+file));};image.src=file;});}
try{await Promise.all([...Object.entries(assets.images).map(async([id,v])=>pictures[id]=await load(v.path)),...Object.entries(assets.ui).map(async([id,file])=>pictures['ui:'+id]=await load(file)),...Object.entries(assets.storyArt).filter(([id])=>id!=='refuge-strip').map(async([id,v])=>pictures['story:'+id]=await load(v.file)),...Object.entries(PVZ_RESCUE_DESIGN.art).map(async([id,file])=>pictures[id]=await load(file)),...Object.entries(PVZ_BATTLE_ENV.resources).map(async([id,file])=>pictures['env:'+id]=await load(file)),(async()=>pictures.door=await load('assets/ui/rescue-door.png'))(),(async()=>pictures.energyHead=await load('assets/portraits/zomboss-head.png'))()]);painter=PVZ_RESCUE_PAINTER.createPainter(PVZ_RENDER.createRenderer(assets,pictures,null),pictures);ready=true;$('animate').disabled=false;paint();
 function frame(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(playing&&!document.hidden){clock+=dt;scene.economy.clock=clock;paint();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(error){$('assetError').hidden=false;$('assetErrorText').textContent=error.message;$('previewCaption').textContent='场地素材未就绪，可重试；文字设计仍可翻阅。';}
})();
