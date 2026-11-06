/* The board uses one camera and one scale. Logical battle coordinates never change. */
(function(root){'use strict';
 const doc=root.document,main=doc.querySelector('.single-game-window'),cameraTop=72;if(!main)return;doc.documentElement.style.setProperty('--battle-camera-top',String(cameraTop));
 function fit(){const width=root.innerWidth||1440,height=root.innerHeight||800,scale=Math.min(width/1440,height/800);main.style.transform='scale('+scale+')';main.style.left=(width-1440*scale)/2+'px';main.style.top=(height-800*scale)/2+'px';doc.documentElement.style.setProperty('--play-scale',String(scale));doc.documentElement.style.setProperty('--game-window-width',1440*scale+'px');doc.documentElement.style.setProperty('--game-window-height',800*scale+'px');}
 root.addEventListener('resize',fit);root.visualViewport?.addEventListener('resize',fit);fit();
 root.PVZ_GAME_WINDOW={cameraTop,stageWidth:1200,stageHeight:600,fit};
})(window);
