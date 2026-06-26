# 桌面應用程式（Electron）

本專案以 **Electron** 打包為桌面應用，在本地啟動既有 Node 後端並用 BrowserWindow 載入前端。

---

## 啟動流程

1. **Electron main**（`electron/main.js`）在 `app.whenReady()` 後：
   - 取得 `app.getPath('userData')` 作為資料目錄。
   - 在 userData 下建立 `sheets` 資料夾（若不存在）。
   - 設定環境變數：`SHEETS_DIR`、`BOOKMARKS_FILE`（userData 內路徑）、`PORT`（預設 3001）。
   - 以 `child_process.spawn('node', ['modules/server.js'])` 在專案根目錄啟動現有 Node 伺服器。
2. 約 1.5 秒後建立 **BrowserWindow**，載入 `http://localhost:PORT/`（即樂譜庫首頁）。
3. 關閉視窗或結束應用時，main 會終止子行程並退出。

樂譜與書籤皆存放在 **Electron userData**，不與開發時的專案 `sheets/`、`bookmarks.json` 共用。

---

## 目錄結構（與 Electron 相關）

```
專案根目錄/
├── electron/
│   └── main.js          # Electron 主進程：啟動 server、建立視窗
├── modules/
│   ├── server.js        # HTTP 伺服器入口
│   └── server/
│       ├── routes.js     # 路由與 API（讀取 BOOKMARKS_FILE）
│       └── sheet-service.js  # 掃描 SHEETS_DIR
├── index.html
├── reader.html
├── editor.html
├── styles.css
├── modules/             # 前端模組
└── package.json         # main 指向 electron/main.js，含 electron / electron-builder
```

執行桌面版時，**樂譜目錄**與**書籤檔**由環境變數決定：

| 環境變數 | 說明 | 桌面版預設 |
|----------|------|------------|
| `SHEETS_DIR` | 樂譜檔案目錄 | `userData/sheets` |
| `BOOKMARKS_FILE` | 書籤 JSON 檔路徑 | `userData/bookmarks.json` |
| `PORT` | 後端埠號 | 3001 |

userData 依平台約為：
- Windows: `%APPDATA%/guitar-sheet-reader-editor`
- macOS: `~/Library/Application Support/guitar-sheet-reader-editor`
- Linux: `~/.config/guitar-sheet-reader-editor`

---

## 打包指令與產物

需先安裝依賴（含 Electron）：

```bash
npm install
```

- **開發執行桌面版**  
  ```bash
  npm run electron
  ```
  會啟動 Electron 並開啟本機後端與視窗。

- **打包成安裝檔 / 可執行檔**  
  ```bash
  npm run build        # 依目前平台打包
  npm run build:win    # Windows
  npm run build:mac    # macOS
  ```
  使用 **electron-builder**，產物輸出至 `dist/`。

- **各平台產物**  
  - **Windows**：`dist/` 內為 NSIS 安裝程式（.exe）或 portable。
  - **macOS**：`dist/` 內為 .dmg（或 .app）。
  - **Linux**：可依 electron-builder 設定產出 AppImage、deb 等。

打包時會將前端靜態檔、`modules/`（含後端）、`electron/main.js` 一併納入；執行檔內會帶 **Node 執行檔**，由 main 以 `spawn('node', [serverPath], ...)` 啟動後端，故不需使用者在系統另行安裝 Node。

---

## 注意事項

- 桌面版與「用瀏覽器開本機 server」行為一致，僅資料目錄改為 userData，適合離線使用與本機樂譜管理。
- 若需改埠號，可在 `electron/main.js` 中調整 `PORT` 或使用環境變數 `ELECTRON_API_PORT`。
- PWA 為可選方案，僅靜態站「安裝到桌面」；完整 API 與儲存仍以 Electron 桌面版為準。靜態部署見 `docs/DEPLOY.md`。
