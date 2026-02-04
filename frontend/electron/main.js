import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

async function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Make window frameless
    titleBarStyle: 'hidden', // On macOS, show traffic lights but hide title bar
    titleBarOverlay: {
      color: '#3c3c3c',
      symbolColor: '#969696',
      height: 35
    },
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
  });

  // Remove the default native menu
  Menu.setApplicationMenu(null);

  let startURL = '';
  if (isDev) {
    const net = await import('net');
    const urlsToTry = [process.env.ELECTRON_DEV_URL, process.env.VITE_DEV_SERVER_URL, 'http://localhost:5173', 'http://localhost:5174'].filter(Boolean);

    const tryUrl = async (url) => {
      try {
        const u = new URL(url);
        const host = u.hostname;
        const port = Number(u.port) || 80;
        return await new Promise((resolve) => {
          const sock = net.createConnection({ host, port, timeout: 300 }, () => {
            sock.destroy();
            resolve(true);
          });
          sock.on('error', () => resolve(false));
          sock.on('timeout', () => { sock.destroy(); resolve(false); });
        });
      } catch (e) { return false; }
    };

    for (const url of urlsToTry) {
      const ok = await tryUrl(url);
      if (ok) { startURL = url; break; }
    }
    if (!startURL) startURL = urlsToTry[0];
  } else {
    startURL = `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
  }

  await mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
