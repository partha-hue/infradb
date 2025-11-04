const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
      // Check if running in development mode
      isDev: () => ipcRenderer.invoke('get-is-dev'),

      // File operations
      saveFile: (data, fileName) => ipcRenderer.invoke('save-file', data, fileName),
      openFile: () => ipcRenderer.invoke('open-file'),

      // Menu event listeners
      onNewQuery: (callback) => ipcRenderer.on('new-query', callback),
      onSaveQuery: (callback) => ipcRenderer.on('save-query', callback),

      // App info
      platform: process.platform,
      version: process.versions.electron
});

console.log('InfraDB Preload script loaded');
