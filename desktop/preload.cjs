'use strict';
const{contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('PVZUpdates',Object.freeze({
 check:()=>ipcRenderer.invoke('pvz:updates:check'),
 openDownload:()=>ipcRenderer.invoke('pvz:updates:open-download')
}));
