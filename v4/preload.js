const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getApiStatus: () => ipcRenderer.invoke('get-api-status')
});