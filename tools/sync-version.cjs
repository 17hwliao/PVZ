'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'..'),v=require('../release/version.json');
assert(/^\d+\.\d+\.\d+$/.test(v.version)&&Number.isSafeInteger(v.build)&&v.build>0&&v.build<2100000000);
assert.equal(v.channel,'stable');assert.equal(v.repository,'17hwliao/PVZ');
for(const file of ['package.json','desktop/package.json','package-lock.json']){
 const p=path.join(root,file),j=JSON.parse(fs.readFileSync(p,'utf8'));j.version=v.version;
 if(file==='desktop/package.json')j.build=v.build;
 if(file==='package-lock.json'&&j.packages?.[''])j.packages[''].version=v.version;
 fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
}
const manifest=path.join(root,'android/AndroidManifest.xml');fs.writeFileSync(manifest,fs.readFileSync(manifest,'utf8').replace(/android:versionName="[^"]+"/,'android:versionName="'+v.version+'"').replace(/android:versionCode="\d+"/,'android:versionCode="'+v.build+'"'));
fs.writeFileSync(path.join(root,'game/build-info.js'),'(function(root){\'use strict\';const info='+JSON.stringify(v)+';if(typeof module!==\'undefined\'&&module.exports)module.exports=info;else root.PVZ_BUILD=Object.freeze(info);})(typeof window!==\'undefined\'?window:globalThis);\n');
for(const file of ['index.html','rescue-design.html','terrain-campaign.html']){
 const p=path.join(root,'game',file);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/(build-info\.js|update-ui\.js|update-ui\.css)\?v=\d+/g,'$1?v='+v.build));
}
console.log('Version synchronized: '+v.version+' / '+v.build);
