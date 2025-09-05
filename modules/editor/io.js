import { showConfirm, showAlert } from '../utils/ui-utils.js';
import { parseSheetMeta } from '../utils/parser-utils.js';
import { loadCustomChordsFromText } from './custom-chords.js';
import { saveToHistory } from './history.js';

let currentFilename = null;

// Initialization logic to restore filename from sessionStorage on page load
function initIO() {
    const savedFilename = sessionStorage.getItem('currentFilename');
    if (savedFilename) {
        currentFilename = savedFilename;
    }
}
initIO();

export function setCurrentFilename(filename) {
    currentFilename = filename;
    if (filename) {
        sessionStorage.setItem('currentFilename', filename);
    } else {
        sessionStorage.removeItem('currentFilename');
    }
}

export async function newDocument() {
    if (await showConfirm("確定要新建文件嗎？未保存的內容將會丟失。")) {
        saveToHistory();
        const emptyContent = "#title: \n#artist: \n\n[verse]\n";
        document.getElementById("editorTextarea").value = emptyContent;
        sessionStorage.setItem("currentSheetContent", emptyContent);
        ["songTitle", "songArtist", "songTags", "songKey", "songBpm", "songCapo"].forEach(
            (id) => {
                document.getElementById(id).value = "";
            }
        );
        // When creating a new document, reset the current filename
        setCurrentFilename(null);
    }
}

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

export function importDocument(text, filename) {
    saveToHistory();
    document.getElementById("editorTextarea").value = text;
    sessionStorage.setItem("currentSheetContent", text); // 更新暫存區

    setCurrentFilename(filename || null);

    // First, clear all existing meta info fields to prevent old data from persisting
    ["songTitle", "songArtist", "songTags", "songKey", "songBpm", "songCapo"].forEach(
        (id) => {
            document.getElementById(id).value = "";
        }
    );

    const meta = parseSheetMeta(text);

    // Then, fill in the new meta info
    if (meta.title) document.getElementById("songTitle").value = meta.title;
    if (meta.artist)
        document.getElementById("songArtist").value = meta.artist;
    if (meta.tags) document.getElementById("songTags").value = meta.tags.join(", "); // Join tags back to string for input
    if (meta.key) document.getElementById("songKey").value = meta.key;
    if (meta.bpm) document.getElementById("songBpm").value = meta.bpm;
    if (meta.capo) document.getElementById("songCapo").value = meta.capo;

    // 載入文件中的自定義和弦
    loadCustomChordsFromText(text);
}

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
        console.error("獲取檔案列表失敗:", error);
        return showAlert("獲取檔案列表失敗，無法檢查檔名衝突。");
    }

    const defaultValue = currentFilename || songTitle;
    const userInput = prompt("請輸入要儲存的檔名 (不含副檔名)：", defaultValue.replace(/\.gtab$|\.txt$/, ""));

    if (userInput === null) {
        return; // User clicked Cancel
    }

    const isGtab = currentFilename ? currentFilename.includes(".gtab") : false;
    const filenameToSave = userInput.trim() + (isGtab ? ".gtab" : ".txt");
    const fileExists = existingFiles.includes(filenameToSave);

    if (fileExists) {
        if (!confirm(`檔案 "${filenameToSave}" 已存在，確定要覆蓋嗎？`)) {
            return; // User cancelled overwrite
        }
    }
    
    try {
        const response = await fetch("/api/save-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: filenameToSave, content: content }),
        });

        if (response.ok) {
            showAlert(`檔案已儲存：${filenameToSave}`);
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



export async function importFromUrl() {
    const urls = document.getElementById("urlTextarea").value.trim();
    if (!urls) {
        showAlert("請貼上網址");
        return;
    }

    try {
        const response = await fetch("/api/import-from-url", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls }),
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById("importUrlModal").classList.remove("visible");
            showAlert("導入已開始，請稍候。完成後請重新整理首頁。","導入已開始");
        } else {
            showAlert(`導入失敗: ${result.error}`, "錯誤");
        }
    } catch (e) {
        console.error("導入失敗:", e);
        showAlert("導入失敗，請查看控制台錯誤訊息。", "錯誤");
    }
}