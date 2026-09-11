# 部署說明

本專案有三種執行方式：**線上版（Cloudflare Workers + D1）**、**本機 Node 伺服器**、**Electron 桌面版**。
三者的前端完全相同，差別只在樂譜存在哪裡。

| 方式 | 樂譜儲存位置 | 跨裝置同步 |
|------|--------------|------------|
| Cloudflare Workers | D1（雲端 SQLite） | ✅ |
| 本機 Node 伺服器 | `data/sheets.db` | ❌ |
| Electron 桌面版 | `%APPDATA%\guitar-sheet-reader-editor\sheets.db` | ❌ |

---

## 模式 A：Cloudflare Workers + D1（線上版）

網址：**https://guitar-chord-reader.fish205712.workers.dev**

一個 Worker 同時提供靜態網站與 `/api/*`，所以前端的 `API_BASE` 維持空字串即可，不需要處理 CORS。

### 架構

```
cloudflare/
├── worker.js              # /api/* 路由，以 D1 取代 better-sqlite3
├── ufret.js               # 網址導入（由 modules/importer/url-importer.js 移植）
└── migrations/
    └── 0001_init.sql      # sheets / bookmarks 資料表
wrangler.jsonc             # Worker 名稱、assets 目錄、D1 綁定
scripts/build-cf-dist.js   # 收集前端靜態檔到 .cf-dist
scripts/export-sheets-sql.js  # 把本機 sheets.db 匯出成 D1 可匯入的 SQL
```

`worker.js` 提供的端點與本機 `modules/server/routes.js` 完全一致：
`GET /api/sheets`、`POST /api/save-sheet`、`POST /api/delete-sheet`、`POST /api/bookmark`、`POST /api/import-from-url`。

### 首次建置

```bash
npm install
npx wrangler login
npx wrangler d1 create guitar-sheets          # 把回傳的 database_id 填進 wrangler.jsonc
npx wrangler d1 migrations apply guitar-sheets --remote
```

### 部署

```bash
npm run cf:deploy      # 建置 .cf-dist 並 wrangler deploy
```

本機預覽（`wrangler dev` 預設使用本地 D1，不會動到線上資料）：

```bash
npm run cf:dev
```

### 把本機樂譜搬上去

```bash
npm run cf:seed        # 讀 data/sheets.db，產生 cloudflare/seed.sql
npx wrangler d1 execute guitar-sheets --remote --file cloudflare/seed.sql
```

`seed.sql` 開頭會先 `DELETE FROM sheets`，等於用本機那份覆蓋線上，因此可重複執行。
檔案含個人樂譜內容，已列入 `.gitignore`。

### 注意

- **API 沒有身分驗證**，知道網址的人都能讀寫樂譜。如需限制，可在 `worker.js` 的 `handleApi` 前加上共用密鑰檢查，或改用 Cloudflare Access。
- 靜態檔只打包前端會用到的部分（見 `scripts/build-cf-dist.js`）：`modules/server`、`modules/importer` 與未被 `styles.css` 引用的字型都不會上傳。

---

## 模式 B：本機 Node 伺服器

```bash
npm install
npm start              # 等同 node modules/server.js
```

瀏覽器開 `http://localhost:3001`。根路徑會導向 `index.html`，靜態檔與 `/api/*` 由同一個伺服器提供。

| 變數 | 說明 | 預設 |
|------|------|------|
| `PORT` | HTTP 埠號 | 3001 |
| `SHEETS_DB` | SQLite 檔案路徑 | `data/sheets.db` |

同一份程式碼也能丟到 Render、Fly.io、VPS 等可跑 Node 的環境，但需要注意 `better-sqlite3` 是原生模組，且免費方案的磁碟通常不持久。

---

## 模式 C：Electron 桌面版

不啟動 HTTP 伺服器，API 由主行程透過 IPC 呼叫 `modules/server/api.js`。詳見 [DESKTOP.md](DESKTOP.md)。

---

## API 基底（前端）

前端透過 `modules/config/api.js` 的 `API_BASE` 發送請求。同源部署時為空字串；
若要讓前端指向另一個網域的 API（例如 Android 版連線上樂譜庫），在載入頁面前設定：

```js
sessionStorage.setItem('apiBase', 'https://guitar-chord-reader.fish205712.workers.dev');
```
