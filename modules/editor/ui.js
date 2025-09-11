import { SECTION_TYPES } from '../config/section-config.js';
import { COMMON_CHORDS } from '../config/chord-config.js';
import { parseSheetMeta } from '../utils/parser-utils.js';
import { showAlert, showConfirm } from '../utils/ui-utils.js';
import { saveToHistory, undo, redo } from './history.js';
import { insertChord, insertSection } from './textarea.js';
import { addCustomChord, loadCustomChords, loadCustomChordsFromText } from './custom-chords.js';
import { newDocument, exportDocument, importDocument, saveToSheetsFolder, importFromUrl, setCurrentFilename } from './io.js';

async function updateMetaInfo() {
    const title = document.getElementById("songTitle").value;
    const artist = document.getElementById("songArtist").value;
    const tags = document.getElementById("songTags").value;
    const key = document.getElementById("songKey").value;
    const bpm = document.getElementById("songBpm").value;
    const capo = document.getElementById("songCapo").value;
    const image = document.getElementById("songImg").value;

    let metaText = "";
    if (title) metaText += `#title: ${title}\n`;
    if (artist) metaText += `#artist: ${artist}\n`;
    if (tags) metaText += `#tags: ${tags}\n`;
    if (key) metaText += `#key: ${key}\n`;
    if (bpm) metaText += `#bpm: ${bpm}\n`;
    if (capo) metaText += `#capo: ${capo}\n`;
    if (image) metaText += `@image: ${image}\n`;

    const textarea = document.getElementById("editorTextarea");
    const currentContent = textarea.value;
    const lines = currentContent.split('\n');

    // Find the index of the first line that is NOT a meta tag or empty.
    let firstContentIndex = lines.findIndex(line => 
        line.trim() !== '' && 
        !line.trim().startsWith('#') && 
        !line.trim().startsWith('@')
    );

    // If no content lines are found, it means the whole file is meta/empty.
    if (firstContentIndex === -1) {
        // Just write the new meta. Add a couple of newlines for future content.
        const newContent = metaText.trimEnd() + '\n\n';
        textarea.value = newContent;
        saveToHistory();
        return;
    }

    // Get all the lines from the first content line onwards.
    const contentBlock = lines.slice(firstContentIndex).join('\n');

    // Add a separator. If meta is empty, no separator. Otherwise, two newlines.
    const separator = metaText ? '\n\n' : '';

    const newContent = metaText.trimEnd() + separator + contentBlock;

    saveToHistory();
    textarea.value = newContent;
}

export function initEditor() {
    // 設置初始編輯模式
    document.body.classList.add("editor-mode");

    let initialContent = '';
    let initialFilename = null;

    // 讀取統一鍵：currentSheetContent / currentFilename
    initialContent = sessionStorage.getItem('currentSheetContent') || "";
    initialFilename = sessionStorage.getItem('currentFilename');
    setCurrentFilename(initialFilename || null);

    // 更新文本區和暫存區
    document.getElementById("editorTextarea").value = initialContent;
    sessionStorage.setItem("currentSheetContent", initialContent);

    // 從載入的內容更新歌曲資訊
    if (initialContent) {
        const meta = parseSheetMeta(initialContent);
        if (meta.title) document.getElementById("songTitle").value = meta.title;
        if (meta.artist) document.getElementById("songArtist").value = meta.artist;
        if (meta.tags) document.getElementById("songTags").value = meta.tags;
        if (meta.key) document.getElementById("songKey").value = meta.key;
        if (meta.bpm) document.getElementById("songBpm").value = meta.bpm;
        if (meta.capo) document.getElementById("songCapo").value = meta.capo;
        if (meta.image) document.getElementById("songImg").value = meta.image;
        loadCustomChordsFromText(initialContent);
    }

    // 清理舊的URL參數（以防萬一）
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    if (window.location.href !== cleanUrl) {
        window.history.replaceState({}, document.title, cleanUrl);
    }

    // 生成段落按鈕
    const sectionGrid = document.getElementById("sectionGrid");
    SECTION_TYPES.forEach((section) => {
        const btn = document.createElement("button");
        btn.className = `section-btn ${section.class}`;
        btn.textContent = section.name;
        btn.onclick = () => insertSection(section.key);
        sectionGrid.appendChild(btn);
    });

    // 生成和弦按鈕
    const chordGrid = document.getElementById("chordGrid");
    COMMON_CHORDS.forEach((chord) => {
        const btn = document.createElement("button");
        btn.className = "chord-btn";
        btn.textContent = chord;
        btn.onclick = () => insertChord(chord);
        chordGrid.appendChild(btn);
    });

    saveToHistory();


    document.getElementById("playBtn").onclick = () => {
        // 前往閱讀器前，確保最新的內容已存入暫存區
        const currentContent = document.getElementById("editorTextarea").value;
        sessionStorage.setItem("currentSheetContent", currentContent);
        window.location.href = 'reader.html';
    };

    document.getElementById("newBtn").onclick = newDocument;
    document.getElementById("exportBtn").onclick = exportDocument;
    document.getElementById("importBtn").onclick = () =>
        document.getElementById("importFile").click();

    const importUrlBtn = document.getElementById("importUrlBtn");
    if (importUrlBtn) {
        importUrlBtn.addEventListener("click", () => {
            document.getElementById("importUrlModal").classList.add("visible");
        });
    }
    document.getElementById("undoBtn").onclick = undo;
    document.getElementById("redoBtn").onclick = redo;
    document.getElementById("clearBtn").onclick = async () => {
        if (await showConfirm("確定要清空所有內容嗎？")) {
            saveToHistory();
            document.getElementById("editorTextarea").value = "";
            sessionStorage.setItem("currentSheetContent", ""); // 同步清空暫存
        }
    };
    document.getElementById("updateMetaBtn").onclick = updateMetaInfo;

    // 自定義和弦功能
    document.getElementById("addCustomChordBtn").onclick = addCustomChord;

    // 載入已保存的自定義和弦
    loadCustomChords();

    // 儲存按鈕事件
    document.getElementById("saveBtn").onclick = saveToSheetsFolder;

    // URL導入事件
    document.getElementById("importUrlConfirmBtn").onclick = importFromUrl;
    document.getElementById("importUrlCancelBtn").onclick = () => {
        document.getElementById("importUrlModal").classList.remove("visible");
    };

    document
        .getElementById("importFile")
        .addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                // Pass both content and filename
                importDocument(evt.target.result, file.name);
            };
            reader.readAsText(file, "utf-8");
        });

    // 自動儲存到 sessionStorage
    let saveTimeout;
    document.getElementById("editorTextarea").addEventListener("input", () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const content = document.getElementById("editorTextarea").value;
            sessionStorage.setItem("currentSheetContent", content);
        }, 300);
    });

    // 在離開編輯器或快速返回時，保證最新內容已寫回 sessionStorage
    window.addEventListener('beforeunload', () => {
        const content = document.getElementById("editorTextarea").value;
        sessionStorage.setItem("currentSheetContent", content);
    });


    // 鍵盤快捷鍵
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
                e.preventDefault();
                redo();
            } else if (e.key === "s") {
                e.preventDefault();
                exportDocument();
            } else if (e.key === "n") {
                e.preventDefault();
                newDocument();
            }
        }
    });
}
