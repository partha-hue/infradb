import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

async function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    }
  });

  // Load the app
  // In development, try to detect a reachable Vite dev server URL. Preference order:
  // 1. ELECTRON_DEV_URL, 2. VITE_DEV_SERVER_URL, 3. common localhost ports
  let startURL = '';
  if (isDev) {
    const net = await import('net');
    const urlsToTry = [process.env.ELECTRON_DEV_URL, process.env.VITE_DEV_SERVER_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'].filter(Boolean);

    const tryUrl = async (url) => {
      try {
        const u = new URL(url);
        const host = u.hostname;
        const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);

        // Return a promise that resolves if port is reachable
        return await new Promise((resolve) => {
          const sock = net.createConnection({ host, port, timeout: 300 }, () => {
            sock.destroy();
            resolve(true);
          });
          sock.on('error', () => resolve(false));
          sock.on('timeout', () => { sock.destroy(); resolve(false); });
        });
      } catch (e) {
        return false;
      }
    };

    for (const url of urlsToTry) {
      // If url is already a path (file://) use it directly
      if (url.startsWith('file://')) {
        startURL = url;
        break;
      }
      // try TCP connection to host:port
      // eslint-disable-next-line no-await-in-loop
      const ok = await tryUrl(url);
      if (ok) {
        startURL = url;
        break;
      }
    }

    // fallback to the first candidate if none detected
    if (!startURL) startURL = urlsToTry[0];
  } else {
    startURL = `file://${path.join(__dirname, '../dist/index.html')}`;
  }

  console.log(`Loading startURL: ${startURL}`);
  mainWindow.loadURL(startURL);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create Application Menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
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
            // Create about window if needed
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // On macOS, app stays open until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for desktop-specific features
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('save-file-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});