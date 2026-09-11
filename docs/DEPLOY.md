# 部署說明

本專案可依需求以**靜態站**或**含後端**兩種方式部署。

---

## 模式 A：GitHub Pages（靜態、瀏覽器內存樂譜）

推送到 `main` 後，GitHub Actions 會自動部署。網址：

**https://moi5712.github.io/guitarchordreader/**

樂譜存在瀏覽器 IndexedDB，可閱讀、編輯、新增、載入檔案與書籤。從網址導入（ufret）需要後端代抓，靜態站無法使用。

本機預覽：

```bash
npm run build:pages
npx --yes serve .pages-dist
```

手動觸發部署：GitHub → Actions → Deploy GitHub Pages → Run workflow。

---

## 模式 B：其他靜態託管（Vercel、Netlify）

1. 將專案根目錄內**靜態資源**部署至託管平台（不執行 Node）。
   - 必須包含：`index.html`、`reader.html`、`editor.html`、`styles.css`、`assets/`、`modules/`（前端 JS）、`fonts/`、`chords.json`、`examples/`。
   - 也可執行 `npm run build:pages`，改部署 `.pages-dist`。
2. 首頁設為 `index.html`。
3. 不需設定環境變數。
4. 若託管在子路徑（例如 `/guitarchordreader/`），頁面必須用相對路徑（本專案 HTML 已改為相對路徑）。`modules/config/paths.js` 會在 `*.github.io` 自動加上 repo 名稱。

### 功能差異（無後端時）

| 功能 | GitHub Pages / 靜態站 |
|------|------------------------|
| 樂譜庫列表 | ✅ 瀏覽器 IndexedDB（空庫會種入範例譜） |
| 閱讀器 / 編輯器 | ✅ |
| 儲存／刪除樂譜 | ✅ 存在本機瀏覽器 |
| 書籤 | ✅ localStorage |
| 載入 .gtab / .txt | ✅ |
| **網址導入**（後端代抓 ufret） | ❌ 瀏覽器 CORS 限制 |

---

## 模式 C：含後端部署（Node 伺服器）

適用：Railway、Render、Fly.io、VPS、任何可跑 Node 的環境。

### 步驟

1. **環境需求**：Node.js 12.0+，依賴見 `package.json`（含 `node-fetch`、`better-sqlite3`）。
2. **環境變數**（建議）：
   - `PORT`：HTTP 埠號（預設 3001）。若平台自動注入（如 Railway、Render），可不設。
3. **啟動方式**：
   - 建置／啟動指令使用：`node modules/server.js` 或 `npm start`。
   - 根路徑 `/` 會導向 `index.html`；靜態檔與 API 由同一伺服器提供。
4. **目錄與檔案**：
   - 專案根目錄需包含：`modules/server.js`、`modules/server/`、`modules/importer/url-importer.js` 等後端依賴。
   - 樂譜庫：SQLite（見 `modules/server/sheet-store.js`）。
   - 書籤：預設為專案根目錄下 `bookmarks.json`（由 `routes.js` 決定）。

### 功能（含後端時）

- 樂譜庫列表：由後端 SQLite 提供。
- 儲存 / 刪除樂譜：寫入資料庫。
- 網址導入：後端代為抓取。
- 書籤：讀寫 `bookmarks.json`。

### 環境變數整理

| 變數 | 說明 | 預設 |
|------|------|------|
| `PORT` | HTTP 埠號 | 3001 |

---

## API 基底（前端）

前端透過 `modules/config/api.js` 的 `API_BASE` 發送請求。同源部署時 `API_BASE` 為空字串；若前後端分離（例如前端在 CDN、API 在另一網域），需在載入頁面前設定：

```js
sessionStorage.setItem('apiBase', 'https://your-api-domain.com');
```

部署或桌面版僅需設定 `API_BASE` 即可讓前端指向實際後端。桌面版說明見 `docs/DESKTOP.md`。
