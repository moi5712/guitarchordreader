/**
 * capacitor-bridge.js
 * 為 Android (Capacitor) 與靜態網頁（GitHub Pages）提供 window.electronAPI。
 * 以 IndexedDB 取代 Node.js 檔案系統，以 localStorage 儲存書籤與設定。
 *
 * 若 window.electronAPI 已存在（Electron 桌面版），此腳本不做任何事。
 * localhost 上的 Node 伺服器不要啟用，以免蓋掉 HTTP / SQLite 樂譜庫。
 */
(function () {
  if (typeof window === 'undefined' || window.electronAPI) return;

  var cap = window.Capacitor;
  var isNative = !!(cap && (
    typeof cap.isNativePlatform === 'function'
      ? cap.isNativePlatform()
      : cap.isNative
  ));
  var isGithubPages = /\.github\.io$/i.test(location.hostname);
  var isFile = location.protocol === 'file:';
  var isStaticWeb = isGithubPages || isFile;
  if (!isNative && !isStaticWeb) return;

  function getBasePath() {
    if (isGithubPages) {
      var segs = location.pathname.split('/').filter(Boolean);
      if (segs[0] && !/\.html?$/i.test(segs[0])) return '/' + segs[0];
    }
    return '';
  }

  // ─── IndexedDB 初始化 ───────────────────────────────────────────────────────
  const DB_NAME = 'uchord-db';
  const DB_VERSION = 1;
  const SHEETS_STORE = 'sheets';
  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(SHEETS_STORE)) {
          db.createObjectStore(SHEETS_STORE, { keyPath: 'filename' });
        }
      };
    });
  }

  function dbGetAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(SHEETS_STORE, 'readonly').objectStore(SHEETS_STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function dbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(SHEETS_STORE, 'readonly').objectStore(SHEETS_STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function dbPut(record) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(SHEETS_STORE, 'readwrite').objectStore(SHEETS_STORE).put(record);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function dbDelete(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(SHEETS_STORE, 'readwrite').objectStore(SHEETS_STORE).delete(key);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  // ─── 解析樂譜 Meta（與伺服器端邏輯相同）────────────────────────────────────
  function parseSheetMeta(content) {
    var meta = {};
    var lines = (content || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) continue;
      if (!t.startsWith('#') && !t.startsWith('@')) break;
      if (t.startsWith('#')) {
        var m = t.match(/^#(\w+):\s*(.*)$/);
        if (m) {
          if (m[1] === 'tags') {
            meta.tags = m[2].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          } else {
            meta[m[1]] = m[2];
          }
        }
      } else if (t.startsWith('@image:') || t.startsWith('@image=')) {
        var im = t.match(/^@image[:=]\s*(.*)$/);
        if (im) meta.image = im[1].trim();
      }
    }
    return meta;
  }

  // ─── 書籤（localStorage）───────────────────────────────────────────────────
  var BOOKMARKS_KEY = 'uchord_bookmarks';

  function getBookmarkList() {
    try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function saveBookmarkList(list) {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  }

  // ─── 計算位元組長度 ─────────────────────────────────────────────────────────
  var didTrySeed = false;

  function byteLength(str) {
    try { return new TextEncoder().encode(str).length; }
    catch (e) { return str.length; }
  }

  // ─── 橋接 API ───────────────────────────────────────────────────────────────
  window.electronAPI = {

    /** 取得所有樂譜列表 */
    getSheets: async function () {
      try {
        await seedWelcomeIfEmpty();
        var sheets = await dbGetAll();
        var bookmarks = getBookmarkList();
        sheets = sheets.map(function (s) {
          return Object.assign({}, s, { bookmarked: bookmarks.indexOf(s.filename) !== -1 });
        });
        sheets.sort(function (a, b) {
          return (a.filename || '').localeCompare(b.filename || '');
        });
        return { success: true, count: sheets.length, sheets: sheets };
      } catch (e) {
        console.error('[Bridge] getSheets 失敗:', e);
        return { success: false, error: e.message, sheets: [] };
      }
    },

    /** 回傳樂譜儲存位置 */
    getSheetsPath: async function () {
      return isNative ? '裝置內部儲存（App 私有空間）' : '瀏覽器本機儲存';
    },

    /** 靜態站／Android 不支援從資料夾匯入 */
    selectSheetsFolder: async function () {
      alert(isNative
        ? 'Android 版不支援從資料夾匯入。\n樂譜儲存於 App 私有空間，以保護資料安全。'
        : '線上網頁版不支援從資料夾匯入。\n請改用「載入樂譜」選擇 .gtab / .txt 檔。');
      return { success: false, canceled: true, path: isNative ? '裝置內部儲存' : '瀏覽器本機儲存' };
    },

    /** 靜態站／Android 不支援開啟資料夾 */
    openSheetsFolder: async function () {
      alert(isNative ? 'Android 版不支援開啟資料夾。' : '線上網頁版不支援開啟資料夾。');
      return isNative ? '裝置內部儲存' : '瀏覽器本機儲存';
    },

    /** Android 不支援在資料夾中顯示 */
    showItemInFolder: async function () {
      return false;
    },

    /** 儲存樂譜（覆蓋同名檔案） */
    saveSheet: async function (filename, content) {
      try {
        var meta = parseSheetMeta(content);
        var existing = await dbGet(filename);
        var now = Date.now();
        var record = {
          filename: filename,
          content: content,
          title: meta.title || filename.replace(/\.(txt|gtab)$/i, ''),
          artist: meta.artist || '',
          key: meta.key || '',
          bpm: meta.bpm || '',
          capo: meta.capo || '',
          tags: meta.tags || [],
          image: meta.image || '',
          lastModified: now,
          addedDate: (existing && existing.addedDate) ? existing.addedDate : now,
          size: byteLength(content),
        };
        await dbPut(record);
        return { success: true, message: '儲存成功', path: filename };
      } catch (e) {
        console.error('[Bridge] saveSheet 失敗:', e);
        return { success: false, error: e.message };
      }
    },

    /** 另存新檔（彈出輸入框讓使用者輸入檔名） */
    saveSheetAs: async function (suggestedFilename, content) {
      var name = window.prompt('請輸入樂譜檔案名稱（.gtab 或 .txt）：', suggestedFilename || '未命名.gtab');
      if (name === null) return { success: false, canceled: true };
      var trimmed = name.trim();
      if (!trimmed) return { success: false, canceled: true };
      var finalName = /\.(txt|gtab)$/i.test(trimmed) ? trimmed : trimmed + '.gtab';
      var result = await window.electronAPI.saveSheet(finalName, content);
      if (result.success) return { success: true, path: finalName, filename: finalName };
      return result;
    },

    /** 刪除樂譜 */
    deleteSheet: async function (filename) {
      try {
        await dbDelete(filename);
        return { success: true, message: '已刪除' };
      } catch (e) {
        console.error('[Bridge] deleteSheet 失敗:', e);
        return { success: false, error: e.message };
      }
    },

    /** 取得書籤清單 */
    getBookmarks: async function () {
      return getBookmarkList();
    },

    /** 更新書籤 */
    setBookmark: async function (filename, bookmarked) {
      var list = getBookmarkList();
      if (bookmarked) {
        if (list.indexOf(filename) === -1) list.push(filename);
      } else {
        list = list.filter(function (b) { return b !== filename; });
      }
      saveBookmarkList(list);
      return { success: true };
    },

    /** 從 URL 導入（靜態站受 CORS 限制） */
    importFromUrl: async function () {
      alert(isNative
        ? '從網址導入功能在 Android 版暫不支援。\n請改用「載入樂譜」從裝置上的 .gtab / .txt 檔案導入。'
        : '從網址導入需要後端代抓，線上網頁版無法使用。\n請改用「載入樂譜」選擇 .gtab / .txt 檔。');
      return { success: false, error: '此版本不支援從網址導入' };
    },

    /** 取得和弦指法資料 */
    getChordFingerings: async function () {
      try {
        var resp = await fetch(getBasePath() + '/chords.json');
        if (resp.ok) return await resp.json();
      } catch (e) {
        console.warn('[Bridge] 載入 chords.json 失敗:', e);
      }
      return {};
    },

    /** 取得和弦檔路徑 */
    getChordsFilePath: async function () {
      return isNative ? 'Android 內建 (chords.json)' : 'chords.json';
    },
  };

  async function seedWelcomeIfEmpty() {
    if (didTrySeed) return;
    didTrySeed = true;
    try {
      var existing = await dbGetAll();
      if (existing.length) return;
      var resp = await fetch(getBasePath() + '/examples/welcome.gtab');
      if (!resp.ok) return;
      var text = await resp.text();
      var meta = parseSheetMeta(text);
      var now = Date.now();
      await dbPut({
        filename: 'welcome.gtab',
        content: text,
        title: meta.title || '歡迎使用',
        artist: meta.artist || '',
        key: meta.key || '',
        bpm: meta.bpm || '',
        capo: meta.capo || '',
        tags: meta.tags || [],
        image: meta.image || '',
        lastModified: now,
        addedDate: now,
        size: byteLength(text),
      });
    } catch (e) {
      console.warn('[Bridge] 種入範例樂譜失敗:', e);
    }
  }

  console.log(isNative ? '[u-chord] Android 橋接層已載入' : '[u-chord] 瀏覽器樂譜庫橋接層已載入');
})();
