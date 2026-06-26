import { SECTION_TYPES } from '../config/section-config.js';
import { COMMON_CHORDS } from '../config/chord-config.js';
import { parseSheetMeta } from '../utils/parser-utils.js';
import { closeModal, openModal, showAlert, showConfirm } from '../utils/ui-utils.js';
import { saveToHistory, undo, redo } from './history.js';
import { insertChord, insertSection } from './textarea.js';
import { addCustomChord, loadCustomChords, loadCustomChordsFromText, initFingeringDiagram } from './custom-chords.js';
import { newDocument, exportDocument, importDocument, saveToSheetsFolder, importFromUrl, setCurrentFilename, getCurrentFilename, deleteSheetFromLibrary } from './io.js';

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

    // 擷取檔案開頭的 metadata / 自訂和弦區塊，避免更新歌曲資訊時洗掉 @Chord: ...
    let firstContentIndex = lines.findIndex((line) =>
        line.trim() !== '' &&
        !line.trim().startsWith('#') &&
        !line.trim().startsWith('@')
    );
    if (firstContentIndex === -1) firstContentIndex = lines.length;

    const headerLines = lines.slice(0, firstContentIndex);
    const preservedCustomChordLines = headerLines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('@')) return false;
        // @image 由歌曲資訊欄位統一重建，其它 @指令（特別是自訂和弦）保留
        return !/^@image[:=]/i.test(trimmed);
    });

    const contentBlock = lines.slice(firstContentIndex).join('\n').trim();
    const sections = [];
    const metaBlock = metaText.trimEnd();
    const customChordsBlock = preservedCustomChordLines.join('\n').trim();
    if (metaBlock) sections.push(metaBlock);
    if (customChordsBlock) sections.push(customChordsBlock);
    if (contentBlock) sections.push(contentBlock);
    const newContent = sections.join('\n\n');

    saveToHistory();
    textarea.value = newContent;
}

export function initEditor() {
    // 設置初始編輯模式
    document.body.classList.add("editor-mode");

    let initialContent = sessionStorage.getItem('currentSheetContent') || "";
    let initialFilename = sessionStorage.getItem('currentFilename');
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
    const importUrlModal = document.getElementById("importUrlModal");
    const editorMobileSettingsBtn = document.getElementById("editorMobileSettingsBtn");
    const editorMobileSettingsModal = document.getElementById("editorMobileSettingsModal");
    const editorMobileSettingsCancel = document.getElementById("editorMobileSettingsCancel");
    const modalImportUrlBtn = document.getElementById("modalImportUrlBtn");
    const modalImportBtn = document.getElementById("modalImportBtn");
    const modalExportBtn = document.getElementById("modalExportBtn");
    const modalSaveBtn = document.getElementById("modalSaveBtn");
    const closeOnOverlayClick = (modal, closeBtn) => {
        if (!modal) return;
        modal.addEventListener("click", (e) => {
            if (e.target !== modal) return;
            if (closeBtn) {
                closeBtn.click();
            } else {
                closeModal(modal);
            }
        });
    };
    if (importUrlBtn) {
        importUrlBtn.addEventListener("click", () => {
            openModal(importUrlModal);
        });
    }
    if (editorMobileSettingsBtn) {
        editorMobileSettingsBtn.addEventListener("click", () => openModal(editorMobileSettingsModal));
    }
    if (editorMobileSettingsCancel) {
        editorMobileSettingsCancel.addEventListener("click", () => closeModal(editorMobileSettingsModal));
    }
    if (modalImportUrlBtn) {
        modalImportUrlBtn.addEventListener("click", () => {
            closeModal(editorMobileSettingsModal);
            importUrlBtn?.click();
        });
    }
    if (modalImportBtn) {
        modalImportBtn.addEventListener("click", () => {
            closeModal(editorMobileSettingsModal);
            document.getElementById("importBtn")?.click();
        });
    }
    if (modalExportBtn) {
        modalExportBtn.addEventListener("click", () => {
            closeModal(editorMobileSettingsModal);
            document.getElementById("exportBtn")?.click();
        });
    }
    if (modalSaveBtn) {
        modalSaveBtn.addEventListener("click", () => {
            closeModal(editorMobileSettingsModal);
            document.getElementById("saveBtn")?.click();
        });
    }
    document.getElementById("undoBtn").onclick = undo;
    document.getElementById("redoBtn").onclick = redo;
    document.getElementById("clearBtn").onclick = async () => {
        const filename = getCurrentFilename();
        if (filename) {
            if (!(await showConfirm("確定要從樂譜庫刪除此樂譜嗎？檔案將永久刪除，且無法復原。"))) return;
            const result = await deleteSheetFromLibrary();
            if (result.success) {
                saveToHistory();
                document.getElementById("editorTextarea").value = "";
                sessionStorage.setItem("currentSheetContent", "");
                setCurrentFilename(null);
                sessionStorage.removeItem("currentFilename");
                window.location.href = "index.html";
                return;
            } else {
                await showAlert(`刪除失敗：${result.error}`);
            }
        } else {
            if (await showConfirm("確定要清空所有內容嗎？")) {
                saveToHistory();
                document.getElementById("editorTextarea").value = "";
                sessionStorage.setItem("currentSheetContent", "");
            }
        }
    };
    document.getElementById("updateMetaBtn").onclick = updateMetaInfo;

    // 自定義和弦功能
    document.getElementById("addCustomChordBtn").onclick = addCustomChord;

    // 載入已保存的自定義和弦
    loadCustomChords();
    initFingeringDiagram();

    // 儲存按鈕事件
    const saveBtn = document.getElementById("saveBtn");
    saveBtn.onclick = saveToSheetsFolder;
    saveBtn.title = "儲存（開啟系統儲存視窗）";

    // URL導入事件
    document.getElementById("importUrlConfirmBtn").onclick = importFromUrl;
    document.getElementById("importUrlCancelBtn").onclick = () => {
        closeModal(importUrlModal);
    };
    closeOnOverlayClick(importUrlModal, document.getElementById("importUrlCancelBtn"));
    closeOnOverlayClick(editorMobileSettingsModal, editorMobileSettingsCancel);

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
