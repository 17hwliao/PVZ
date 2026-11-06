'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const project=path.resolve(__dirname,'..');
function runtime(){
 if(process.env.PVZ_ELECTRON_PATH)return process.env.PVZ_ELECTRON_PATH;
 const local=path.join(project,'.private/electron-runtime.json');
 if(fs.existsSync(local)){const config=JSON.parse(fs.readFileSync(local,'utf8'));if(typeof config.executable==='string')return config.executable;throw Error('Local Electron configuration has no executable.');}
 try{return require('electron');}catch{throw Error('Electron runtime not configured. Set PVZ_ELECTRON_PATH to an existing Electron executable, or install the electron development dependency.');}
}
try{
 const executable=runtime();if(typeof executable!=='string'||!path.isAbsolute(executable)||!fs.existsSync(executable))throw Error('Electron executable was not found: '+executable);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(executable,[path.join(project,'desktop'),'--pvz-dev'],{cwd:project,env,windowsHide:false,stdio:'inherit'});
 child.on('error',error=>{console.error('Unable to start Electron: '+error.message);process.exitCode=1;});child.on('exit',(code,signal)=>{if(code)process.exitCode=code;else if(signal)process.exitCode=1;});
}catch(error){console.error(error.message);process.exitCode=1;}
