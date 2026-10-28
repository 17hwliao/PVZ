(function(root){'use strict';
// This desk observes the model; it never advances cooldowns or buys plants.
function create(doc,data){
 const $=id=>doc.getElementById(id),cards=new Map(),art={fumeshroom:'fume',cabbagepult:'cabbage',flowerpot:'pot'},supportNames={flowerpot:'花盆',lily:'睡莲'};let deckKey='',currentScene;
 const el=(tag,className,text)=>{const e=doc.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;};
 function rebuild(types){
  cards.clear();$('plantSeedCards').replaceChildren();
  for(const type of types){const card=el('li','plant-seed-card'),packet=el('div','plant-seed-packet'),image=el('img','plant-seed-image'),name=el('span','plant-seed-name',data.plantCombat[type]?.name||supportNames[type]||type),price=el('span','plant-seed-price',String(data.plantCards[type].cost)),shade=el('span','plant-seed-shade'),state=el('span','plant-seed-state'),detail=el('span','plant-seed-detail'),meter=el('span','plant-seed-meter'),clock=el('span','plant-seed-clock');
   card.dataset.plantCard=type;image.src='assets/almanac/'+(art[type]||type)+'.webp';image.alt='';image.width=64;image.height=60;shade.setAttribute('aria-hidden','true');meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',name.textContent+'种植冷却完成度');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');clock.setAttribute('aria-hidden','true');packet.append(image,name,price,shade,clock);card.append(packet,state,detail,meter);$('plantSeedCards').append(card);cards.set(type,{card,shade,state,detail,meter,clock,name:name.textContent});
  }
 }
 function refresh(scene){
  // A new round starts at the sun bank; model ticks must preserve manual scrolling.
  if(scene!==currentScene){currentScene=scene;$('plantEconomy').scrollTop=0;}
  const level=data.levels[scene.levelIndex],planning=scene.status==='planning',active=planning||scene.status==='battle',count=scene.plants.filter(p=>p.hp>0).length,cap=level.budget?.maxPlants??Infinity,full=count>=cap,types=[...level.plantDeck];
  if(scene.terrain?.theme==='roof')types.push('flowerpot');if(scene.terrain?.terrain.waterRows.length)types.push('lily');
  const unique=[...new Set(types)].filter(t=>data.plantCards[t]),key=unique.join('|');if(key!==deckKey){deckKey=key;rebuild(unique);}
  $('plantSunValue').textContent=String(scene.economy.sun);$('plantSunValue').setAttribute('aria-label','植物当前阳光 '+scene.economy.sun);
  const countLabel='场内 '+count+'/'+(Number.isFinite(cap)?cap:'不限')+(full?' · 已达上限':'');$('plantFieldCount').textContent=count+'/'+(Number.isFinite(cap)?cap:'不限');$('plantFieldCount').title=countLabel;$('plantFieldCount').setAttribute('aria-label',countLabel);$('plantFieldCount').dataset.full=String(full);
  $('plantEconomyPhase').textContent=!active?'行动结束':scene.paused?(planning?'准备已暂停 · 计时冻结':'已暂停 · 冷却冻结'):planning?'准备期 · 种植免CD':'交战中 · 正常种植CD';
  $('plantEconomyNote').textContent='植物人机的种植情报，不是己方操作卡。场外5株免费向日葵不计上限；支架和咖啡豆另计条件。'+(planning?'准备期落种仍会记下冷却，提前出发将承接剩余秒数。':'卡片就绪后，人机仍需选择合法落点。');
  for(const[type,v]of cards){
   const def=data.plantCards[type],remaining=Math.max(0,scene.economy.cooldowns[type]||0),ratio=def.recharge>0?Math.min(1,remaining/def.recharge):0,shortage=Math.max(0,def.cost-scene.economy.sun),special=type==='coffee'||type==='flowerpot'||type==='lily',blockedByCap=full&&!special;
   let state,detail,kind;
   if(!active){state='行动结束';detail='本局不再落种';kind='ended';}
   else if(!planning&&remaining>1e-6){state='冷却 '+remaining.toFixed(1)+'秒';detail=shortage?'还缺'+shortage+'阳光':blockedByCap?'场内数量已满':'费用 '+def.cost+'阳光';kind='cooling';}
   else if(shortage){state='缺'+shortage+'阳光';detail=planning?'准备免CD · 阳光不足':'费用 '+def.cost+'阳光';kind='poor';}
   else if(blockedByCap){state='场内数量已满';detail=planning?'准备免CD · 等待空位':'费用 '+def.cost+'阳光';kind='full';}
   else if(type==='coffee'&&!scene.plants.some(p=>p.hp>0&&p.sleeping)){state='等待睡眠菇';detail=planning?'准备免CD':'卡片已就绪';kind='waiting';}
   else{state=planning?'准备免CD':'可种植';detail=(planning&&remaining>1e-6?'开战带入 '+remaining.toFixed(1)+'秒 · ':'')+(type==='flowerpot'||type==='lily'?'支架 · 不占场内数量':type==='coffee'?'唤醒 · 不占场内数量':'人机选择合法落点');kind='ready';}
   v.clock.textContent=active&&!planning&&remaining>1e-6?remaining.toFixed(1)+'s':'';v.card.dataset.state=kind;v.state.textContent=state;v.detail.textContent=detail;v.card.title=v.name+' · '+def.cost+'阳光 · 标准种植冷却'+def.recharge+'秒。'+state+'；'+detail+'。'+(data.plantCombat[type]?.mechanic||'为对应地形提供种植支架。');v.card.setAttribute('aria-label',v.card.title);
   // Preparation bypasses the mask, but still exposes the actual carry-over timer.
   v.shade.style.height=(active&&!planning?ratio*100:0).toFixed(2)+'%';v.meter.setAttribute('aria-valuenow',String(Math.round((1-ratio)*100)));v.meter.setAttribute('aria-valuetext',planning?'准备免冷却；开战承接'+remaining.toFixed(1)+'秒':remaining>1e-6?'剩余'+remaining.toFixed(1)+'秒':'种植冷却已完成');
  }
 }
 return{refresh};
}
root.PVZ_PLANT_ECONOMY_UI={create};
})(typeof window!=='undefined'?window:globalThis);
