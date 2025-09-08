import { showConfirm, showAlert } from '../utils/ui-utils.js';
import { parseSheetMeta } from '../utils/parser-utils.js';
import { loadCustomChordsFromText } from './custom-chords.js';
import { saveToHistory } from './history.js';

let currentFilename = null;

// 初始化：載入時從 sessionStorage 還原檔案名稱
function initIO() {
    const savedFilename = sessionStorage.getItem('currentFilename');
    if (savedFilename) {
        currentFilename = savedFilename;
    }
}
initIO();

// 設定檔案名稱同步到 sessionStorage
export function setCurrentFilename(filename) {
    currentFilename = filename;
    if (filename) {
        sessionStorage.setItem('currentFilename', filename);
    } else {
        sessionStorage.removeItem('currentFilename');
    }
}

// 新建文件
export async function newDocument() {
    if (await showConfirm("確定要新建文件嗎？未保存的內容將會丟失。")) {
        saveToHistory();
        const emptyContent = "#title: \n#artist: \n\n[verse]\n";
        document.getElementById("editorTextarea").value = emptyContent;
        sessionStorage.setItem("currentSheetContent", emptyContent);// 寫入空白內容到主要草稿
        sessionStorage.removeItem('sheetToEdit_content');// 清空跨頁傳遞的鍵
        sessionStorage.removeItem('sheetToEdit_filename');
        ["songTitle", "songArtist", "songTags", "songKey", "songBpm", "songCapo"].forEach(
            (id) => {
                document.getElementById(id).value = "";
            }
        );
        // 新建文件時，重設當前檔案名稱
        setCurrentFilename(null);
    }
}

// 匯出檔案
export async function exportDocument() {
    const content = document.getElementById("editorTextarea").value;
    if (!content.trim()) {
        await showAlert("沒有內容可以匯出");
        return;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const title = document.getElementById("songTitle").value || "未命名";
    const artist = document.getElementById("songArtist").value || "";
    a.download = title + (artist ? " by " + artist : "") + ".gtab";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 導入檔案
export function importDocument(text, filename) {
    saveToHistory();
    document.getElementById("editorTextarea").value = text;
    sessionStorage.setItem("currentSheetContent", text); // 更新暫存區
    setCurrentFilename(filename || null);
    sessionStorage.setItem('currentFilename', filename || "");

    // 清空所有欄位
    ["songTitle", "songArtist", "songTags", "songKey", "songBpm", "songCapo"].forEach(
        (id) => {
            document.getElementById(id).value = "";
        }
    );

    const meta = parseSheetMeta(text);

    // 填入新的 meta 資訊
    if (meta.title) document.getElementById("songTitle").value = meta.title;
    if (meta.artist) document.getElementById("songArtist").value = meta.artist;
    if (meta.tags) document.getElementById("songTags").value = meta.tags.join(", ");
    if (meta.key) document.getElementById("songKey").value = meta.key;
    if (meta.bpm) document.getElementById("songBpm").value = meta.bpm;
    if (meta.capo) document.getElementById("songCapo").value = meta.capo;

    // 載入自定義和弦
    loadCustomChordsFromText(text);
}

// 儲存檔案
export async function saveToSheetsFolder() {
    const content = document.getElementById("editorTextarea").value;
    if (!content.trim()) {
        return showAlert("請先輸入樂譜內容");
    }

    const songTitle = document.getElementById("songTitle").value.trim() || "未命名";

    let existingFiles = [];
    try {
        const response = await fetch("/api/sheets");
        if (!response.ok) throw new Error("無法獲取檔案列表");
        const data = await response.json();
        existingFiles = data.sheets.map(f => f.filename);
    } catch (error) {
        console.error("獲取檔案列表失敗，無法檢查檔名衝突。:", error);
        return showAlert("儲存失敗。");
    }

    const defaultValue = currentFilename || songTitle;
    const userInput = prompt("請輸入要儲存的檔名 (不含副檔名)：", defaultValue.replace(/\.gtab$|\.txt$/, ""));

    if (userInput === null) {
        return;
    }

    const isGtab = currentFilename ? currentFilename.includes(".gtab") : false;
    const filenameToSave = userInput.trim() + (isGtab ? ".gtab" : ".txt");
    const fileExists = existingFiles.includes(filenameToSave);

    if (fileExists) {
        if (!confirm(`檔案 "${filenameToSave}" 已存在，確定要覆蓋嗎？`)) {
            return;
        }
    }
    
    try {
        const response = await fetch("/api/save-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: filenameToSave, content: content }),
        });

        if (response.ok) {
            setCurrentFilename(filenameToSave);
        } else {
            const errData = await response.json();
            showAlert(`儲存失敗: ${errData.error || response.statusText}`);
        }
    } catch (error) {
        console.error("儲存錯誤:", error);
        showAlert(`儲存失敗: ${error.message}`);
    }
}


// 網址導入樂譜
export async function importFromUrl() {
    const urlText = document.getElementById("urlTextarea").value.trim();
    if (!urlText) {
        showAlert("請貼上網址");
        return;
    }

    // 以換行分割，過濾空白行
    const urls = urlText.split('\n').map(url => url.trim()).filter(url => url);

    if (urls.length === 0) {
        showAlert("請貼上有效的網址");
        return;
    }

    try {
        const response = await fetch("/api/import-from-url", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls: urls }), // 傳送網址陣列
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById("importUrlModal").classList.remove("visible");
            showAlert(`已成功轉換${result.processed} 個網址。請重新整理首頁。`);
        } else {
            showAlert(`導入失敗: ${result.error}`, "錯誤");
        }
    } catch (e) {
        console.error("導入失敗 :", e);
        showAlert("導入失敗，請查看控制台錯誤訊息。", "錯誤");
    }
}