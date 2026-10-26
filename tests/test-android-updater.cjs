'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),home=os.homedir();
const jsonJar=process.env.ANDROID_JSON_JAR||path.join(home,'.m2/repository/com/vaadin/external/google/android-json/0.0.20131108.vaadin1/android-json-0.0.20131108.vaadin1.jar');
const jdk=process.env.UPDATER_TEST_JDK||'C:/Program Files/Android/Android Studio/jbr';
for(const file of [jsonJar,path.join(jdk,'bin/javac.exe'),path.join(jdk,'bin/java.exe')])assert(fs.existsSync(file),'Missing fixture input: '+file+'; set ANDROID_JSON_JAR / UPDATER_TEST_JDK. No dependencies are downloaded.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pvz-android-updater-'));
function run(exe,args){const p=spawnSync(exe,args,{encoding:'utf8'});if(p.status!==0)throw Error((p.stdout||'')+(p.stderr||'')+'\nexit '+p.status);if(p.stdout)process.stdout.write(p.stdout);}
try{
 run(path.join(jdk,'bin/javac.exe'),['--release','8','-encoding','UTF-8','-cp',jsonJar,'-d',temp,path.join(root,'android/src/cn/zombossrise/game/UpdateChecker.java'),path.join(root,'tests/android/UpdateCheckerFixture.java')]);
 run(path.join(jdk,'bin/java.exe'),['-cp',temp+path.delimiter+jsonJar,'cn.zombossrise.game.UpdateCheckerFixture']);
 const activity=fs.readFileSync(path.join(root,'android/src/cn/zombossrise/game/MainActivity.java'),'utf8'),manifest=fs.readFileSync(path.join(root,'android/AndroidManifest.xml'),'utf8');
 assert(activity.includes('getPackageInfo(getPackageName(),0)'));assert(activity.includes('getLongVersionCode()'));assert(activity.includes('@JavascriptInterface public String check()'));assert(activity.includes('@JavascriptInterface public boolean openDownload()'));assert(activity.includes('JSONObject.quote(result.toString())'));assert(activity.includes('window!==window.top'));assert(activity.includes('frame-src \'none\''));assert(activity.includes('worker.shutdownNow()'));assert(activity.includes('removeJavascriptInterface("PVZAndroidUpdates")'));
 const permissions=[...manifest.matchAll(/uses-permission[^>]+android:name="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(permissions,['android.permission.INTERNET']);
 console.log('Android bridge lifecycle/origin/permission source contracts: 10 checks passed (not device execution)');
}finally{
 const resolved=path.resolve(temp),parent=path.resolve(os.tmpdir());if(path.dirname(resolved)!==parent||!path.basename(resolved).startsWith('pvz-android-updater-'))throw Error('Refusing unexpected temp cleanup');fs.rmSync(resolved,{recursive:true,force:true});
}
