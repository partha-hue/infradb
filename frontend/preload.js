const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose safe APIs to the renderer process (React app)
 * This runs in a trusted context and provides secure access to Electron APIs
 */

contextBridge.exposeInMainWorld('electronAPI', {
      // App Information
      getAppVersion: () => ipcRenderer.invoke('get-app-version'),
      getAppPath: () => ipcRenderer.invoke('get-app-path'),
      getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

      // File Dialogs
      openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
      saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),

      // Example: Send message to main process
      send: (channel, data) => {
            // Whitelist of allowed channels
            const validChannels = [
                  'query-results',
                  'connection-status',
                  'app-notification',
            ];
            if (validChannels.includes(channel)) {
                  ipcRenderer.send(channel, data);
            }
      },

      // Example: Listen to messages from main process
      on: (channel, func) => {
            const validChannels = [
                  'query-results',
                  'connection-status',
                  'app-notification',
            ];
            if (validChannels.includes(channel)) {
                  ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
      },

      // Remove listener
      removeListener: (channel) => {
            ipcRenderer.removeAllListeners(channel);
      },
});

/**
 * Usage in React component:
 * 
 * // Get app version
 * const version = await window.electronAPI.getAppVersion();
 * 
 * // Open file dialog
 * const result = await window.electronAPI.openFileDialog({
 *   properties: ['openFile'],
 *   filters: [
 *     { name: 'All Files', extensions: ['*'] },
 *     { name: 'Text Files', extensions: ['txt'] }
 *   ]
 * });
 * 
 * // Listen for messages
 * window.electronAPI.on('connection-status', (data) => {
 *   console.log('Connection status:', data);
 * });
 */