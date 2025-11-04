const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
      mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1000,
            minHeight: 600,
            webPreferences: {
                  nodeIntegration: false,
                  contextIsolation: true,
                  preload: path.join(__dirname, 'preload.cjs')
            },
            frame: true,
            backgroundColor: '#1e1e1e',
            show: false,
            title: 'InfraDB - Database Management System'
      });

      // Create application menu
      const menuTemplate = [
            {
                  label: 'File',
                  submenu: [
                        {
                              label: 'New Query',
                              accelerator: 'CmdOrCtrl+N',
                              click: () => mainWindow.webContents.send('new-query')
                        },
                        {
                              label: 'Save Query',
                              accelerator: 'CmdOrCtrl+S',
                              click: () => mainWindow.webContents.send('save-query')
                        },
                        { type: 'separator' },
                        {
                              label: 'Exit',
                              accelerator: 'CmdOrCtrl+Q',
                              click: () => app.quit()
                        }
                  ]
            },
            {
                  label: 'Edit',
                  submenu: [
                        { role: 'undo' },
                        { role: 'redo' },
                        { type: 'separator' },
                        { role: 'cut' },
                        { role: 'copy' },
                        { role: 'paste' }
                  ]
            },
            {
                  label: 'View',
                  submenu: [
                        { role: 'reload' },
                        { role: 'forceReload' },
                        { role: 'toggleDevTools' },
                        { type: 'separator' },
                        { role: 'resetZoom' },
                        { role: 'zoomIn' },
                        { role: 'zoomOut' },
                        { type: 'separator' },
                        { role: 'togglefullscreen' }
                  ]
            },
            {
                  label: 'Help',
                  submenu: [
                        {
                              label: 'About InfraDB',
                              click: () => {
                                    dialog.showMessageBox(mainWindow, {
                                          type: 'info',
                                          title: 'About InfraDB',
                                          message: 'InfraDB v1.0.0',
                                          detail: 'Multi-cloud Database Management System\n\nBuilt with React, Django, and Electron'
                                    });
                              }
                        }
                  ]
            }
      ];

      const menu = Menu.buildFromTemplate(menuTemplate);
      Menu.setApplicationMenu(menu);

      // Load app
      if (isDev) {
            mainWindow.loadURL('http://localhost:5173');
            mainWindow.webContents.openDevTools();
      } else {
            mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }

      mainWindow.once('ready-to-show', () => {
            mainWindow.show();
      });

      mainWindow.on('closed', () => {
            mainWindow = null;
      });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
            app.quit();
      }
});

app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
      }
});

// IPC Handlers
ipcMain.handle('save-file', async (event, data, fileName = 'query.sql') => {
      const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Save SQL File',
            defaultPath: fileName,
            filters: [
                  { name: 'SQL Files', extensions: ['sql'] },
                  { name: 'CSV Files', extensions: ['csv'] },
                  { name: 'JSON Files', extensions: ['json'] },
                  { name: 'All Files', extensions: ['*'] }
            ]
      });

      if (!result.canceled) {
            const fs = require('fs');
            try {
                  fs.writeFileSync(result.filePath, data);
                  return { success: true, path: result.filePath };
            } catch (error) {
                  return { success: false, error: error.message };
            }
      }
      return { success: false, canceled: true };
});

ipcMain.handle('open-file', async (event) => {
      const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Open SQL File',
            filters: [
                  { name: 'SQL Files', extensions: ['sql'] },
                  { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
            const fs = require('fs');
            try {
                  const content = fs.readFileSync(result.filePaths[0], 'utf-8');
                  return { success: true, content, path: result.filePaths[0] };
            } catch (error) {
                  return { success: false, error: error.message };
            }
      }
      return { success: false, canceled: true };
});

ipcMain.handle('get-is-dev', () => isDev);

console.log('InfraDB Electron starting...');
console.log('Development mode:', isDev);
