const { app, BrowserWindow, ipcMain, protocol, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const api = require('../modules/server/api.js');

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

// 開發時用專案內 sheets；安裝版用 userData，避免寫入安裝目錄（唯讀或權限不足）導致無法儲存
function getSheetsDir() {
  const root = app.isPackaged ? app.getPath('userData') : projectRoot;
  const sheetsDir = path.join(root, 'sheets');
  if (!fs.existsSync(sheetsDir)) {
    fs.mkdirSync(sheetsDir, { recursive: true });
  }
  return sheetsDir;
}

function getLibraryPrefsPath(userData) {
  return path.join(userData, 'library-prefs.json');
}

function readLibraryPrefs(userData) {
  const prefsPath = getLibraryPrefsPath(userData);
  if (!fs.existsSync(prefsPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch (error) {
    console.error('讀取 library-prefs.json 失敗:', error);
    return {};
  }
}

function writeLibraryPrefs(userData, prefs) {
  const prefsPath = getLibraryPrefsPath(userData);
  try {
    fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
  } catch (error) {
    console.error('寫入 library-prefs.json 失敗:', error);
  }
}

function resolveSheetsDir(userData) {
  const prefs = readLibraryPrefs(userData);
  const preferredDir = typeof prefs.sheetsDir === 'string' ? prefs.sheetsDir.trim() : '';
  const sheetsDir = preferredDir || getSheetsDir();
  if (!fs.existsSync(sheetsDir)) {
    fs.mkdirSync(sheetsDir, { recursive: true });
  }
  return sheetsDir;
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
  let sheetsDir = resolveSheetsDir(userData);
  const bookmarksPath = path.join(userData, 'bookmarks.json');

  ipcMain.handle('api:getSheets', () => {
    return api.getSheetsData(sheetsDir, bookmarksPath);
  });

  ipcMain.handle('api:getSheetsPath', () => sheetsDir);
  ipcMain.handle('api:openSheetsFolder', () => shell.openPath(sheetsDir).then(() => sheetsDir));
  ipcMain.handle('api:selectSheetsFolder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '選擇樂譜資料夾',
        defaultPath: sheetsDir,
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true, path: sheetsDir };
      }
      const selectedDir = result.filePaths[0];
      fs.mkdirSync(selectedDir, { recursive: true });
      sheetsDir = selectedDir;
      writeLibraryPrefs(userData, { sheetsDir });
      return { success: true, canceled: false, path: sheetsDir };
    } catch (error) {
      console.error('selectSheetsFolder error:', error);
      return { success: false, canceled: false, error: error.message || String(error), path: sheetsDir };
    }
  });

  ipcMain.handle('api:saveSheet', (_, filename, content) => {
    const fullPath = path.join(sheetsDir, path.basename(filename));
    try {
      if (!fs.existsSync(sheetsDir)) {
        fs.mkdirSync(sheetsDir, { recursive: true });
      }
      const testFile = path.join(sheetsDir, '.write-test');
      try {
        fs.writeFileSync(testFile, 'ok', 'utf8');
        fs.unlinkSync(testFile);
      } catch (testErr) {
        return { success: false, error: '無法寫入樂譜資料夾：' + (testErr.message || testErr), path: sheetsDir };
      }
      api.saveSheet(sheetsDir, filename, content);
      return { success: true, message: '檔案儲存成功', path: fullPath };
    } catch (err) {
      console.error('saveSheet error:', err);
      return { success: false, error: err.message || String(err), path: sheetsDir };
    }
  });

  ipcMain.handle('api:saveSheetAs', async (_, suggestedFilename, content) => {
    try {
      const trimmedName = typeof suggestedFilename === 'string' ? suggestedFilename.trim() : '';
      const safeBase = path.basename(trimmedName || '未命名.txt');
      const hasValidExt = /\.(txt|gtab)$/i.test(safeBase);
      const defaultName = hasValidExt ? safeBase : `${safeBase}.txt`;
      const saveResult = await dialog.showSaveDialog({
        title: '儲存樂譜',
        defaultPath: path.join(sheetsDir, defaultName),
        filters: [
          { name: '吉他譜檔案', extensions: ['gtab', 'txt'] },
          { name: '所有檔案', extensions: ['*'] }
        ],
        showOverwriteConfirmation: true
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, canceled: true };
      }

      let filePath = saveResult.filePath;
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.txt' && ext !== '.gtab') {
        filePath += '.txt';
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
      return { success: true, path: filePath, filename: path.basename(filePath) };
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
    api.deleteSheet(sheetsDir, filename);
    return { success: true, message: '已從樂譜庫刪除' };
  });

  ipcMain.handle('api:getBookmarks', () => {
    return api.getBookmarks(bookmarksPath);
  });

  ipcMain.handle('api:setBookmark', (_, filename, bookmarked) => {
    api.setBookmark(bookmarksPath, filename, bookmarked);
    return { success: true, message: '書籤更新成功' };
  });

  ipcMain.handle('api:importFromUrl', (_, urls) => {
    return api.importFromUrl(sheetsDir, urls);
  });

  ipcMain.handle('api:getChordFingerings', () => readChordFingeringsFromDisk(userData));

  ipcMain.handle('api:getChordsFilePath', () => getChordsUserPath(userData));

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
