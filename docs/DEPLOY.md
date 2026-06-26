# 部署說明

本專案可依需求以**靜態站**或**含後端**兩種方式部署。

---

## 模式 A：靜態部署（無後端）

適用：GitHub Pages、Vercel、Netlify、任一靜態託管。

### 步驟

1. 將專案根目錄內**靜態資源**部署至託管平台（不執行 Node）。
   - 必須包含：`index.html`、`reader.html`、`editor.html`、`styles.css`、`assets/`（圖示與圖片，含 favicon.svg）、`modules/`（前端 JS）、`fonts/` 等前端依賴。
   - 若使用 GitHub Pages，可將 `sheets/` 一併推送，樂譜庫會透過 **GitHub API** 讀取 `sheets` 資料夾內檔案（見 `modules/library/data.js`）。
2. 首頁設為 `index.html`（或根路徑 `/` 對應到 `index.html`）。
3. 不需設定環境變數。

### 功能差異（無後端時）

| 功能 | 可用與否 |
|------|----------|
| 樂譜庫列表 | ✅ 可用（GitHub Pages 時由 GitHub API 讀取 `sheets/`；其他靜態站則需自行提供靜態列表或僅能手動載入） |
| 閱讀器 / 編輯器 | ✅ 可用（手動載入檔案） |
| **儲存樂譜到伺服器** | ❌ 不可用 |
| **從樂譜庫刪除樂譜** | ❌ 不可用 |
| **網址導入**（後端代抓） | ❌ 不可用 |
| **書籤**（寫入後端） | ❌ 不可用 |

建議在 **readme** 或 **UI** 註明：靜態部署時儲存、刪除、網址導入、書籤功能不可用，僅能瀏覽與手動載入樂譜。

---

## 模式 B：含後端部署（Node 伺服器）

適用：Railway、Render、Fly.io、VPS、任何可跑 Node 的環境。

### 步驟

1. **環境需求**：Node.js 12.0+，依賴見 `package.json`（含 `node-fetch`）。
2. **環境變數**（建議）：
   - `PORT`：HTTP 埠號（預設 3001）。若平台自動注入（如 Railway、Render），可不設。
3. **啟動方式**：
   - 建置／啟動指令使用：`node modules/server.js` 或 `npm start`。
   - 根路徑 `/` 會導向 `index.html`；靜態檔與 API 由同一伺服器提供。
4. **目錄與檔案**：
   - 專案根目錄需包含：`modules/server.js`、`modules/server/routes.js`、`modules/server/sheet-service.js`、`modules/importer/url-importer.js` 等後端依賴。
   - 樂譜實體檔目錄：預設為專案根目錄下 `sheets/`（由 `sheet-service.js` 路徑決定）。
   - 書籤：預設為專案根目錄下 `bookmarks.json`（由 `routes.js` 決定）。部署時可依需求改為環境變數或絕對路徑。

### 功能（含後端時）

- 樂譜庫列表：由後端掃描 `sheets/` 目錄。
- 儲存 / 刪除樂譜：寫入 / 刪除 `sheets/` 內檔案。
- 網址導入：後端代為抓取並寫入 `sheets/`。
- 書籤：讀寫 `bookmarks.json`。

### 環境變數整理

| 變數 | 說明 | 預設 |
|------|------|------|
| `PORT` | HTTP 埠號 | 3001 |

其餘路徑（如 `sheets/`、`bookmarks.json`）目前寫在程式內，若要改為可配置，需在 `sheet-service.js` / `routes.js` 中改為讀取環境變數或參數。

---

## API 基底（前端）

前端透過 `modules/config/api.js` 的 `API_BASE` 發送請求。同源部署時 `API_BASE` 為空字串；若前後端分離（例如前端在 CDN、API 在另一網域），需在載入頁面前設定：

```js
sessionStorage.setItem('apiBase', 'https://your-api-domain.com');
```

部署或桌面版僅需設定 `API_BASE` 即可讓前端指向實際後端。桌面版說明見 `docs/DESKTOP.md`。
