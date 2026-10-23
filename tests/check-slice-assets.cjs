const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../game'),box={window:{}};let count=0;
for(const f of fs.readdirSync(out).filter(f=>f.endsWith('.js'))){new vm.Script(fs.readFileSync(path.join(out,f),'utf8'),{filename:f});count++;}
for(const f of ['assets-data.js','prologue-data.js','story-data.js','ui-font-data.js'])vm.runInNewContext(fs.readFileSync(path.join(out,f),'utf8'),box);
const engine=require('../game/engine.js'),story=box.window.PVZ_STORY;
const assets=box.window.PVZ_ASSETS,refs=[...Object.values(assets.images).map(x=>x.path),...Object.values(assets.ui),...Object.values(assets.storyArt||{}).map(x=>x.file),...Object.values(assets.sounds||{}),'assets/tombstones-alpha.png',...[...Object.keys(engine.UNITS),'zomboss-head'].map(x=>'assets/portraits/'+x+'.png'),...story.comics.map(c=>c.file)];
for(const type of Object.keys(engine.PLANTS))assert(assets.actors[type],'Missing plant actor '+type);
for(const [name,actor]of Object.entries(assets.actors)){assert(actor.fps>0);for(const track of actor.tracks)for(const f of track.frames){if(f.i)assert(assets.images[f.i],'Missing animation binding '+name+':'+f.i);for(const key of ['x','y','kx','ky','sx','sy','a','f'])assert(Number.isFinite(f[key]),'Nonfinite animation transform');}}
for(const name of ['CONE2','CONE3','BUCKET2','BUCKET3'])assert(assets.images['IMAGE_REANIM_ZOMBIE_'+name]);
for(const n of [1,2])assert(assets.images['IMAGE_REANIM_WALLNUT_CRACKED'+n]);
for(const chapter of story.chapters)for(const scene of chapter.scenes){assert.equal(scene.title,story.levels[scene.index].title);assert.equal(scene.beat,story.levels[scene.index].hint);assert.deepEqual(scene.lines,story.levels[scene.index].after);}
assert.equal(story.levels.length,engine.LEVELS.length);let panels=0;for(const [i,l]of story.levels.entries()){assert.equal(l.title,engine.LEVELS[i].name);assert(l.letter?.paragraphs.length>=2);for(const p of [...l.beforePanels||[],...l.afterPanels||[]]){assert(story.comics[p.comic]);assert(Number.isInteger(p.panel)&&p.panel>=0&&p.panel<4);panels++;}}
for(const f of ['index.html','comics.html','style.css','original-ui.css','classic-flow.css','ui-themes.css']){const text=fs.readFileSync(path.join(out,f),'utf8');for(const m of text.matchAll(/(?:src|href)=["']([^"'#]+)["']|url\(["']?([^\)'"#]+)/g)){const r=m[1]||m[2];if(!/^(?:https?:|data:)/.test(r))refs.push(r);}}
for(const b of box.window.PVZ_PROLOGUE.beats)if(!(box.window.PVZ_PROLOGUE.nativePrison&&b.shot==='prison'))refs.push('prologue/'+b.shot+'.png');
for(const f of Object.values(assets.sounds||{}))assert.equal(fs.readFileSync(path.join(out,f)).subarray(0,4).toString(),'OggS','Invalid sound '+f);

for(const font of Object.values(box.window.PVZ_NATIVE_FONTS)){refs.push(font.file);assert.equal(Object.keys(font.glyphs).length,1514);const p=fs.readFileSync(path.join(out,font.file)),w=p.readUInt32BE(16),h=p.readUInt32BE(20);for(const g of Object.values(font.glyphs)){assert(g.every(Number.isFinite));assert(g[0]>=0&&g[1]>=0&&g[0]+g[2]<=w&&g[1]+g[3]<=h);}}
refs.push('assets/fonts/OFL.txt','assets/fonts/provenance.json');
assert.equal(fs.readFileSync(path.join(out,'assets/fonts/ZCOOLKuaiLe-Regular.ttf')).subarray(0,4).toString('hex'),'00010000');
for(const f of new Set(refs))assert(fs.existsSync(path.join(out,f)),'Missing '+f);
assert.equal(box.window.PVZ_PROLOGUE.beats.length,20);assert.equal(box.window.PVZ_PROLOGUE.beats.reduce((s,b)=>s+b.duration,0),163);
console.log(JSON.stringify({syntaxFiles:count,localReferences:new Set(refs).size,levels:story.levels.length,letters:story.levels.length,comicPlacements:panels,prologueBeats:20,durationSeconds:163,missingReferences:0}));
