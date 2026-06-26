# u-chord｜吉他譜閱讀器・編輯器

支援 **ChordPro** 格式的吉他譜管理、閱讀與編輯工具。可透過瀏覽器（本機伺服器）或 **Electron 桌面版**（免安裝 / 安裝版）使用，樂譜可儲存於本機、支援書籤、標籤篩選與網址導入（ufret.jp）。

---

## 功能概覽

| 功能 | 說明 |
|------|------|
| **樂譜庫** | 列表、搜尋、依標籤/演出者篩選、書籤、排序 |
| **閱讀器** | 單首樂譜閱讀、變調、指法圖、調音器、播放與預備拍 |
| **編輯器** | ChordPro 文字編輯、儲存至樂譜庫、刪除、網址導入、復原/重做 |
| **網址導入** | 從 ufret.jp 網址抓取並轉成 ChordPro 存入樂譜庫 |

---

## 使用方式

### 方式一：瀏覽器（本機 Node 伺服器）

1. 安裝依賴：`npm install`
2. 啟動伺服器：`npm start` 或 `npm run dev`
3. 在瀏覽器開啟：`http://localhost:3001`

樂譜與書籤存放於專案根目錄的 `sheets/`、`bookmarks.json`。

### 方式二：桌面版（Electron，不佔用連接埠）

- **開發時**：`npm run electron` → 開啟桌面視窗，樂譜讀寫專案內 `sheets/`。
- **免安裝**：建置後執行 `dist/win-unpacked/吉他譜閱讀器編輯器.exe`，樂譜存於 `%APPDATA%\guitar-sheet-reader-editor\sheets`。
- **安裝版**：建置後執行 `dist` 內的安裝程式，安裝至任意路徑（如 `E:\`），從開始選單或桌面捷徑開啟；樂譜同樣存於上述 userData 目錄。

桌面版**不啟動 HTTP 伺服器**，所有 API 改由 Electron 主行程透過 IPC 處理，因此不佔用本機連接埠；網址導入由主行程代為請求並寫檔。

---

## 建置桌面版（Windows）

1. 安裝依賴：`npm install`
2. 建議使用專案提供的建置腳本（會解除 `app-builder.exe` 封鎖並停用簽署）：
   ```bash
   npm run build:win-safe
   ```
3. 產物在 `dist/`：
   - **免安裝**：`dist/win-unpacked/吉他譜閱讀器編輯器.exe`
   - **安裝檔**：`dist` 內之 `.exe` 安裝程式

若出現 `spawn EPERM`，可對 `node_modules\app-builder-bin\win\x64\app-builder.exe` 右鍵 → 內容 → 勾選「解除封鎖」後再執行 `npm run build:win-safe`。

---

## 專案結構（摘要）

```
專案根目錄/
├── index.html          # 樂譜庫首頁
├── reader.html         # 閱讀器
├── editor.html         # 編輯器
├── styles.css          # 全站樣式
├── manifest.webmanifest
├── electron/
│   ├── main.js         # Electron 主行程：自訂 protocol、IPC、不啟動 HTTP
│   └── preload.js      # 暴露 electronAPI 給渲染行程
├── modules/
│   ├── config/         # 設定與常數（API、段落、和弦、樂譜庫等）
│   ├── utils/          # 共用工具（和弦、解析、UI）
│   ├── library/        # 樂譜庫邏輯與 UI
│   ├── reader/         # 閱讀器邏輯與 UI
│   ├── editor/         # 編輯器邏輯與 UI
│   ├── server/         # 後端 API（api.js、sheet-service）與 routes（HTTP 模式用）
│   ├── importer/       # 網址導入（url-importer）
│   ├── components/
│   └── ...
├── assets/             # 圖示、圖片
├── scripts/
│   └── build-win.js    # 建置前解除 app-builder 封鎖並執行 electron-builder
├── docs/               # 說明文件
└── package.json
```

- **瀏覽器模式**：由 `modules/server.js` 啟動 HTTP 伺服器，`routes.js` 提供靜態檔與 `/api/*`。
- **桌面版**：不執行 server，由 `electron/main.js` 以自訂 `app://` protocol 提供前端，並以 IPC 呼叫 `modules/server/api.js` 讀寫樂譜與書籤。

---

## 技術與依賴

- **前端**：原生 HTML / CSS / JavaScript（ES modules），無框架。
- **後端（HTTP 模式）**：Node.js，`node-fetch`。
- **桌面**：Electron 28，electron-builder；建置時不簽署、不佔 port。

---

## 文件索引

| 文件 | 內容 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 入口與模組職責、config/utils 規則、新功能應放位置 |
| [DESKTOP.md](DESKTOP.md) | 桌面版流程與目錄、環境變數、打包指令（部分為舊版「啟動 server」描述，實際現行為 IPC 無 server） |
| [DEPLOY.md](DEPLOY.md) | 靜態部署與含後端部署、環境變數、API 基底 |
| [DESIGN-STYLE-GUIDE.md](DESIGN-STYLE-GUIDE.md) | 視覺設計原則、色彩、字體、間距與元件樣式 |

---

## 授權

MIT.
