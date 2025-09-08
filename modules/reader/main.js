import { importScore, saveSettings, getCurrentSheetContent } from './data.js';
import { render } from './ui.js';
import { togglePlay, collectTargets } from './playback.js';
import { setCurrentSettings, playing, song } from './state.js';

function init() {
  // Cache DOM elements
  const editBtn = document.getElementById("editBtn");
  const playBtn = document.getElementById("playBtn");
  const homeBtn = document.getElementById("homeBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");
  const fontPxInput = document.getElementById("fontPx");
  const lineGapInput = document.getElementById("lineGap");
  const transposeInput = document.getElementById("transpose");
  const showFingeringCheckbox = document.getElementById("showFingering");
  const countdownEnabledCheckbox = document.getElementById("countdownEnabled");
  const speedInput = document.getElementById("speed");
  const mobileFontPxInput = document.getElementById("mobileFontPx");
  const mobileLineGapInput = document.getElementById("mobileLineGap");
  const mobileTransposeInput = document.getElementById("mobileTranspose");
  const mobileShowFingeringCheckbox = document.getElementById("mobileShowFingering");
  const mobileCountdownEnabledCheckbox = document.getElementById("mobileCountdownEnabled");
  const mobileSettingsBtn = document.getElementById("mobileSettingsBtn");
  const mobileSettingsConfirmBtn = document.getElementById("mobileSettingsConfirm");
  const mobileSettingsCancelBtn = document.getElementById("mobileSettingsCancel");
  const mobileSettingsModal = document.getElementById("mobileSettingsModal");

  editBtn.onclick = function () {
    // Save current sheet content and filename to sessionStorage before navigating
    const currentContent = getCurrentSheetContent(); // Get content from reader's state
    const currentFilename = song.filename; // Get filename from reader's state (assuming 'song' is available)

    if (currentContent) {
      sessionStorage.setItem('sheetToEdit_content', currentContent);
      if (currentFilename) {
        sessionStorage.setItem('sheetToEdit_filename', currentFilename);
      } else {
        sessionStorage.removeItem('sheetToEdit_filename'); // Clear if no filename
      }
    } else {
      sessionStorage.removeItem('sheetToEdit_content');
      sessionStorage.removeItem('sheetToEdit_filename');
    }
    window.location.href = "editor.html";
  };

  playBtn.onclick = togglePlay;
  homeBtn.onclick = function () {
    window.location.href = "library.html";
  };
  importBtn.onclick = function () {
    importFile.click();
  };

  importFile.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        importScore(evt.target.result);
        render();
        collectTargets();
    };
    reader.readAsText(file, "utf-8");
  });

  let renderTimeout = null;
  const debouncedRender = () => {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        render();
        collectTargets();
    }, 100);
  };

  [fontPxInput, lineGapInput, transposeInput].forEach((input) => {
    input.addEventListener("input", () => {
      debouncedRender();
      saveSettings();
    });
  });

  showFingeringCheckbox.addEventListener("change", () => {
    render();
    collectTargets();
    saveSettings();
  });

  countdownEnabledCheckbox.addEventListener("change", () => {
    if (!playing) playBtn.disabled = false;
    saveSettings();
  });

  speedInput.addEventListener("input", saveSettings);

  const savedSettings = localStorage.getItem("readerSettings");
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      fontPxInput.value = settings.fontSize || 18;
      lineGapInput.value = settings.lineGap || 14;
      transposeInput.value = settings.transpose || 0;
      showFingeringCheckbox.checked = settings.showFingering || false;
      countdownEnabledCheckbox.checked = settings.countdownEnabled || false;
      speedInput.value = settings.speed || 30;

      mobileFontPxInput.value = settings.fontSize || 18;
      mobileLineGapInput.value = settings.lineGap || 14;
      mobileTransposeInput.value = settings.transpose || 0;
      mobileShowFingeringCheckbox.checked = settings.showFingering || false;
      mobileCountdownEnabledCheckbox.checked = settings.countdownEnabled || false;

      setCurrentSettings({ ...currentSettings, ...settings });
    } catch (e) {
      console.log("無法解析保存的設置");
    }
  }

  mobileSettingsBtn.onclick = function () {
    mobileFontPxInput.value = fontPxInput.value;
    mobileLineGapInput.value = lineGapInput.value;
    mobileTransposeInput.value = transposeInput.value;
    mobileShowFingeringCheckbox.checked = showFingeringCheckbox.checked;
    mobileCountdownEnabledCheckbox.checked = countdownEnabledCheckbox.checked;
    mobileSettingsModal.classList.add("visible");
  };

  mobileSettingsConfirmBtn.onclick = function () {
    fontPxInput.value = mobileFontPxInput.value;
    lineGapInput.value = mobileLineGapInput.value;
    transposeInput.value = mobileTransposeInput.value;
    showFingeringCheckbox.checked = mobileShowFingeringCheckbox.checked;
    countdownEnabledCheckbox.checked = mobileCountdownEnabledCheckbox.checked;
    render();
    collectTargets();
    saveSettings();
    mobileSettingsModal.classList.remove("visible");
  };

  mobileSettingsCancelBtn.onclick = () => mobileSettingsModal.classList.remove("visible");
  mobileSettingsModal.onclick = function (e) {
    if (e.target === this) this.classList.remove("visible");
  };

  render();
  collectTargets();
}

window.addEventListener('load', () => {
    init();

    let contentToLoad = null;
    let filenameToLoad = null; // New variable for filename
    const urlParams = new URLSearchParams(window.location.search);
    const contentParam = urlParams.get("content");

    // --- Robust Loading Logic ---
    if (contentParam) {
        contentToLoad = decodeURIComponent(contentParam);
        // If content comes from URL, filename is not directly available,
        // but it's usually a temporary view. We can try to extract from URL if needed,
        // or leave it null for now. For now, we'll leave it null.
    } else {
        // Try to load from sessionStorage (used when coming from library.html)
        contentToLoad = sessionStorage.getItem('sheetToEdit_content');
        filenameToLoad = sessionStorage.getItem('sheetToEdit_filename');

        // If not from sessionStorage, fallback to auto-saved draft
        if (!contentToLoad) {
            contentToLoad = getCurrentSheetContent();
            // Filename won't be available here either, as it's a draft
        }
    }

    if (contentToLoad) {
        importScore(contentToLoad, filenameToLoad); // Pass filenameToLoad
        render();
        collectTargets();
    }

    // Clean up sessionStorage items immediately after reading
    sessionStorage.removeItem('sheetToEdit_content');
    sessionStorage.removeItem('sheetToEdit_filename');

    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
});

// 當使用者透過瀏覽器返回（可能啟用 BFCache）或頁面重新可見時，
// 檢查 sessionStorage 是否有較新的內容，必要時重新載入與渲染。
function reloadIfSessionChanged() {
    const latest = getCurrentSheetContent();
    if (latest && latest !== song.originalContent) {
        importScore(latest);
        render();
        collectTargets();
    }
}

window.addEventListener('pageshow', (e) => {
    // 無論是否從 BFCache 還原，都做一次比對
    reloadIfSessionChanged();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        reloadIfSessionChanged();
    }
});


document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.name.endsWith(".txt") || file.name.endsWith(".gtab")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
          importScore(evt.target.result);
          render();
          collectTargets();
      };
      reader.readAsText(file, "utf-8");
    } else {
      alert("點選或拖放 .txt 或 .gtab 格式的檔案");
    }
  }
});
