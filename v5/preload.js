const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // API status
    getApiStatus: () => ipcRenderer.invoke('get-api-status'),

    // System commands
    executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
    openApp: (appName) => ipcRenderer.invoke('open-app', appName),

    // File operations
    uploadFile: () => ipcRenderer.invoke('upload-file'),
    saveImage: (imageData) => ipcRenderer.invoke('save-image', imageData),

    // Tray updates
    updateTrayStatus: (status) => ipcRenderer.send('update-tray-status', status),

    // Listen for events from main process
    onToggleVoice: (callback) => {
        ipcRenderer.on('toggle-voice-mode', callback);
    },
    onAnalyzeScreen: (callback) => {
        ipcRenderer.on('analyze-screen', callback);
    },
    onCreateSession: (callback) => {
        ipcRenderer.on('create-new-session', callback);
    },

    // Remove listeners
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    }
});