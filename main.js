'use strict';
/* Electron-Hülle für PUCK ROCKET — Mini Arena.
   Das Spiel selbst ist eine einzige Datei (index.html) und läuft unverändert auch
   im Browser; hier bekommt es nur ein eigenes Fenster, ein Menü und Vollbild. */

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const GAME_PAGE = path.join(__dirname, 'index.html');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#05070f',
    title: 'PUCK ROCKET — Mini Arena',
    show: false,
    webPreferences: {
      // Das Spiel braucht weder Node noch einen Preload -> maximal abgeschottet
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Erst anzeigen, wenn der erste Frame steht (kein weißes Aufblitzen)
  win.once('ready-to-show', () => win.show());

  // Falls je ein externer Link im Spiel landet: im Systembrowser öffnen, nie im App-Fenster
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(GAME_PAGE);
  return win;
}

function buildMenu() {
  const template = [
    {
      label: 'Spiel',
      submenu: [
        { label: 'Neustart', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Vollbild', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Entwicklerwerkzeuge', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Beenden', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Zoom zurücksetzen', role: 'resetZoom' },
        { label: 'Vergrößern', role: 'zoomIn' },
        { label: 'Verkleinern', role: 'zoomOut' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // saubere Gruppierung in der Windows-Taskleiste
  app.setAppUserModelId('com.puckrocket.arena');
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
