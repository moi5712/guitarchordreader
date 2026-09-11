const { app, BrowserWindow, ipcMain, protocol, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const api = require('../modules/server/api.js');
const store = require('../modules/server/sheet-store.js');
const { migrateIfEmpty } = require('../modules/server/migrate.js');

// 與 package.json build.appId 一致；Windows 工作列／捷徑才不會被當成泛用「Electron」
if (process.platform === 'win32') {
  app.setAppUserModelId('com.guitar-sheet-reader.editor');
}

const projectRoot = path.join(__dirname, '..');

function normalizeChordFingerings(raw) {
  const out = Object.create(null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [name, v] of Object.entries(raw)) {
    if (
      Array.isArray(v) &&
      v.length === 6 &&
      v.every((x) => Number.isInteger(x) && x >= -1 && x <= 12)
    ) {
      out[name] = v;
    }
  }
  return out;
}

function getChordsUserPath(userData) {
  return path.join(userData, 'chords.json');
}

function ensureChordsFile(userData) {
  const userChords = getChordsUserPath(userData);
  if (fs.existsSync(userChords)) return userChords;
  const seed = path.join(projectRoot, 'chords.json');
  if (fs.existsSync(seed)) {
    try {
      fs.mkdirSync(userData, { recursive: true });
      fs.copyFileSync(seed, userChords);
    } catch (e) {
      console.error('複製和弦種子檔失敗:', e);
    }
  }
  return userChords;
}

function readChordFingeringsFromDisk(userData) {
  const userChords = ensureChordsFile(userData);
  if (!fs.existsSync(userChords)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(userChords, 'utf8'));
    return normalizeChordFingerings(raw);
  } catch (e) {
    console.error('讀取 chords.json 失敗:', e);
    return {};
  }
}

// 自訂 scheme 須在 app ready 前註冊
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function getDbFilePath() {
  const root = app.isPackaged ? app.getPath('userData') : path.join(projectRoot, 'data');
  return path.join(root, 'sheets.db');
}

// 自訂 protocol：以專案根目錄提供檔案，使 /styles.css、/modules/... 等路徑可用
function registerAppProtocol() {
  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const u = new URL(request.url);
      let p = u.pathname || '/';
      if (p === '/' || p === '') p = '/index.html';
      const relative = decodeURIComponent(p).replace(/^\/+/, '').replace(/\/$/, '');
      const full = path.join(projectRoot, relative);
      const normalized = path.normalize(full);
      if (!normalized.startsWith(projectRoot)) {
        callback({ error: -2 });
        return;
      }
      callback({ path: normalized });
    } catch (e) {
      callback({ error: -2 });
    }
  });
}

function getWindowIconPath() {
  if (process.platform === 'win32') {
    const devIco = path.join(projectRoot, 'build', 'icon.ico');
    if (fs.existsSync(devIco)) return devIco;
    if (app.isPackaged) {
      const bundledIco = path.join(process.resourcesPath, 'app-icon.ico');
      if (fs.existsSync(bundledIco)) return bundledIco;
    }
  }
  const devPng = path.join(projectRoot, 'build', 'icon.png');
  if (fs.existsSync(devPng)) return devPng;
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'app-icon.png');
    if (fs.existsSync(bundled)) return bundled;
  }
  return undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getWindowIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.webContents.on('context-menu', (_, params) => {
    if (!params.isEditable) return;
    const menu = Menu.buildFromTemplate([
      { role: 'cut', label: '剪下' },
      { role: 'copy', label: '複製' },
      { role: 'paste', label: '貼上' },
      { role: 'selectAll', label: '全選' }
    ]);
    menu.popup({ window: win });
  });
  win.loadURL('app://./index.html');
}

app.whenReady().then(() => {
  registerAppProtocol();

  const userData = app.getPath('userData');
  const dbFilePath = getDbFilePath();
  store.openDatabase(dbFilePath);
  const extraSources = [];
  const userSheets = path.join(userData, 'sheets');
  const userBookmarks = path.join(userData, 'bookmarks.json');
  if (fs.existsSync(userSheets) || fs.existsSync(userBookmarks)) {
    extraSources.push({ sheetsDir: userSheets, bookmarksFile: userBookmarks });
  }
  const migrated = migrateIfEmpty({ dbPath: dbFilePath, extraSources });
  if (migrated && !migrated.skipped && migrated.imported > 0) {
    console.log(`Migrated ${migrated.imported} sheets into ${dbFilePath}`);
  }

  ipcMain.handle('api:getSheets', () => {
    return api.getSheetsData();
  });

  ipcMain.handle('api:getSheetsPath', () => store.getDbPath());
  ipcMain.handle('api:openSheetsFolder', () => {
    const dir = path.dirname(store.getDbPath());
    return shell.openPath(dir).then(() => dir);
  });
  ipcMain.handle('api:selectSheetsFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '從資料夾匯入樂譜',
        properties: ['openDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true, path: store.getDbPath() };
      }
      const selectedDir = result.filePaths[0];
      const imported = api.importFolder(selectedDir);
      return {
        success: true,
        canceled: false,
        path: store.getDbPath(),
        imported: imported.imported,
        bookmarks: imported.bookmarks
      };
    } catch (error) {
      console.error('selectSheetsFolder error:', error);
      return { success: false, canceled: false, error: error.message || String(error), path: store.getDbPath() };
    }
  });

  ipcMain.handle('api:saveSheet', (_, filename, content) => {
    try {
      const saved = api.saveSheet(filename, content);
      return { success: true, message: '檔案儲存成功', filename: saved, path: saved };
    } catch (err) {
      console.error('saveSheet error:', err);
      return { success: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('api:saveSheetAs', (_, suggestedFilename, content) => {
    try {
      const trimmedName = typeof suggestedFilename === 'string' ? suggestedFilename.trim() : '';
      const safeBase = path.basename(trimmedName || '未命名.gtab');
      const filename = /\.(txt|gtab)$/i.test(safeBase) ? safeBase : `${safeBase}.gtab`;
      const saved = api.saveSheet(filename, content);
      return { success: true, filename: saved, path: saved };
    } catch (err) {
      console.error('saveSheetAs error:', err);
      return { success: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('api:showItemInFolder', (_, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') return false;
      shell.showItemInFolder(filePath);
      return true;
    } catch (e) {
      console.error('showItemInFolder error:', e);
      return false;
    }
  });

  ipcMain.handle('api:deleteSheet', (_, filename) => {
    api.deleteSheet(filename);
    return { success: true, message: '已從樂譜庫刪除' };
  });

  ipcMain.handle('api:getBookmarks', () => {
    return api.getBookmarks();
  });

  ipcMain.handle('api:setBookmark', (_, filename, bookmarked) => {
    api.setBookmark(filename, bookmarked);
    return { success: true, message: '書籤更新成功' };
  });

  ipcMain.handle('api:importFromUrl', (_, urls) => {
    return api.importFromUrl(urls);
  });

  ipcMain.handle('api:getChordFingerings', () => readChordFingeringsFromDisk(userData));

  ipcMain.handle('api:getChordsFilePath', () => getChordsUserPath(userData));

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
