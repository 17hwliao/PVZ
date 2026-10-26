'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),v=require('../release/version.json');
const dir=path.resolve(process.argv[2]||'dist/'+v.version),releaseUrl='https://github.com/'+v.repository+'/releases/tag/v'+v.version,platforms={};
for(const [platform,suffix]of [['windows-x64','windows-x64.zip'],['android','android.apk']]){
 const name='ZombossRise-'+v.version+'-'+suffix,file=path.join(dir,name),stat=fs.statSync(file);
 assert(stat.isFile()&&stat.size>0);platforms[platform]={url:'https://github.com/'+v.repository+'/releases/download/v'+v.version+'/'+name,size:stat.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
}
const manifest={schemaVersion:1,...v,releaseUrl,notes:'八地图四十关营救、植物换路与部署、墓碑回血补员、结算修复及跨端版本检查。',platforms};
fs.writeFileSync(path.join(dir,'update-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
const rows=fs.readdirSync(dir).filter(n=>/\.(?:zip|apk|json)$/.test(n)).sort().map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex')+'  '+n);
fs.writeFileSync(path.join(dir,'SHA256SUMS.txt'),rows.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({version:v.version,build:v.build,platforms}));
