import { importScore, saveSettings, getCurrentSheetContent } from './data.js';
import { render } from './ui.js';
import { togglePlay, collectTargets, initPlayback } from './playback.js';
import { setCurrentSettings, playing, countingDown, song, currentSettings } from './state.js';
import { initTuner } from './tuner.js';
import { initRecordings } from './recordings.js';
import { loadDockState } from './dock-state.js';
import { initMetronome } from './metronome.js';
import { loadChordFingerings } from '../load-chord-fingerings.js';
import { observeTopbarHeight } from '../utils/ui-utils.js';

let recordingsController = null;

function makeSheetKey(content, filename) {
  if (filename) return `file:${filename}`;
  const text = content || "";
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return `content:${hash}`;
}

function bindNumericStepper(input, minusBtn, plusBtn, { onChange } = {}) {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const clamp = (v) => {
    let n = Math.round(Number(v));
    if (!Number.isFinite(n)) n = min;
    if (Number.isFinite(min)) n = Math.max(min, n);
    if (Number.isFinite(max)) n = Math.min(max, n);
    return n;
  };
  const apply = () => {
    input.value = clamp(input.value);
    onChange?.();
  };
  minusBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    input.value = clamp(Number(input.value) - 1);
    onChange?.();
  });
  plusBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    input.value = clamp(Number(input.value) + 1);
    onChange?.();
  });
  input.addEventListener("input", onChange);
  input.addEventListener("change", apply);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
  });
}

function mirrorStepper(sourceMinus, sourcePlus, mirrorMinus, mirrorPlus, onAfter) {
  mirrorMinus?.addEventListener("click", (e) => {
    e.stopPropagation();
    sourceMinus?.click();
    onAfter?.();
  });
  mirrorPlus?.addEventListener("click", (e) => {
    e.stopPropagation();
    sourcePlus?.click();
    onAfter?.();
  });
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}

function debugShortcutLog(hypothesisId, message, data = {}, runId = "run7") {
  // #region agent log
  fetch('http://127.0.0.1:7422/ingest/8503027e-a49c-4ba5-9428-bb732a7f335b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1dc22e'},body:JSON.stringify({sessionId:'1dc22e',runId,hypothesisId,location:'modules/reader/main.js:debugShortcutLog',message,data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

function init() {
  // Cache DOM elements
  const editBtn = document.getElementById("editBtn");
  const playBtn = document.getElementById("playBtn");
  const scoreEl = document.getElementById("score");
  const homeBtn = document.getElementById("homeBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");
  const fontPxInput = document.getElementById("fontPx");
  const fontPxMinus = document.getElementById("fontPxMinus");
  const fontPxPlus = document.getElementById("fontPxPlus");
  const lineGapInput = document.getElementById("lineGap");
  const lineGapMinus = document.getElementById("lineGapMinus");
  const lineGapPlus = document.getElementById("lineGapPlus");
  const transposeInput = document.getElementById("transpose");
  const transposeMinus = document.getElementById("transposeMinus");
  const transposePlus = document.getElementById("transposePlus");
  const transposeResetBtn = document.getElementById("transposeResetBtn");
  const showFingeringCheckbox = document.getElementById("showFingering");
  const countdownEnabledCheckbox = document.getElementById("countdownEnabled");
  const speedInput = document.getElementById("speed");
  const mobileSettingsBtn = document.getElementById("mobileSettingsBtn");
  const mobileSettingsSheet = document.getElementById("mobileSettingsSheet");
  const mobileSettingsBackdrop = document.getElementById("mobileSettingsBackdrop");
  const mobileSettingsClose = document.getElementById("mobileSettingsClose");
  const mobileSheetFontPx = document.getElementById("mobileSheetFontPx");
  const mobileSheetLineGap = document.getElementById("mobileSheetLineGap");
  const mobileSheetTranspose = document.getElementById("mobileSheetTranspose");
  const mobileSheetBpm = document.getElementById("mobileSheetBpm");
  const mobileMetronomeToggle = document.getElementById("mobileMetronomeToggle");
  const tunerBtn = document.getElementById("tunerBtn");
  const tunerBtnMobile = document.getElementById("tunerBtnMobile");
  const tunerPanel = document.getElementById("tunerPanel");
  const recordingsBtn = document.getElementById("recordingsBtn");
  const recordingsBtnMobile = document.getElementById("recordingsBtnMobile");
  const recordingsPanel = document.getElementById("recordingsPanel");
  const metronomeBtn = document.getElementById("metronomeBtn");
  const metronomeBpmMinus = document.getElementById("metronomeBpmMinus");
  const metronomeBpmPlus = document.getElementById("metronomeBpmPlus");
  const metronomeBpmDisplay = document.getElementById("metronomeBpmDisplay");
  const metronomeResetBtn = document.getElementById("metronomeResetBtn");
  let lastShortcutAction = null;

  editBtn.onclick = function () {
    const currentContent = getCurrentSheetContent();
    const currentFilename = song.filename;
    sessionStorage.setItem('currentSheetContent', currentContent || "");
    if (currentFilename) sessionStorage.setItem('currentFilename', currentFilename); else sessionStorage.removeItem('currentFilename');
    window.location.href = 'editor.html';
  };

  playBtn.onclick = togglePlay;
  scoreEl.onclick = togglePlay;

  const scrollTopBtn = document.getElementById("scrollTopBtn");
  scrollTopBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  importBtn.onclick = function () {
    importFile.click();
  };

  importFile.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        importScore(evt.target.result, file.name);
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

  const onReaderSettingChange = () => {
    debouncedRender();
    saveSettings();
    syncMobileSheetDisplays();
    syncMobileSheetToggles();
  };

  function syncMobileSheetDisplays() {
    if (mobileSheetFontPx) mobileSheetFontPx.textContent = fontPxInput.value;
    if (mobileSheetLineGap) mobileSheetLineGap.textContent = lineGapInput.value;
    if (mobileSheetTranspose) mobileSheetTranspose.textContent = transposeInput.value;
    if (mobileSheetBpm && metronomeBpmDisplay) mobileSheetBpm.textContent = metronomeBpmDisplay.value;
  }

  function syncMobileSheetToggles() {
    document.querySelectorAll(".mobile-sheet-toggle[for]").forEach((label) => {
      const input = document.getElementById(label.getAttribute("for"));
      label.classList.toggle("is-on", !!input?.checked);
    });
  }

  function openMobileSheet() {
    syncMobileSheetDisplays();
    syncMobileSheetToggles();
    mobileSettingsSheet?.classList.add("is-open");
    mobileSettingsSheet?.setAttribute("aria-hidden", "false");
    mobileSettingsBtn?.setAttribute("aria-expanded", "true");
  }

  function closeMobileSheet() {
    mobileSettingsSheet?.classList.remove("is-open");
    mobileSettingsSheet?.setAttribute("aria-hidden", "true");
    mobileSettingsBtn?.setAttribute("aria-expanded", "false");
  }

  bindNumericStepper(fontPxInput, fontPxMinus, fontPxPlus, { onChange: onReaderSettingChange });
  bindNumericStepper(lineGapInput, lineGapMinus, lineGapPlus, { onChange: onReaderSettingChange });
  bindNumericStepper(transposeInput, transposeMinus, transposePlus, { onChange: onReaderSettingChange });

  function getSheetDefaultTranspose() {
    const capo = song.meta?.capo;
    if (capo !== undefined && capo !== null && capo !== "") {
      const capoValue = Number(capo);
      if (!Number.isNaN(capoValue)) return -capoValue;
    }
    return 0;
  }

  transposeResetBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    transposeInput.value = getSheetDefaultTranspose();
    transposeInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  showFingeringCheckbox.addEventListener("change", () => {
    render();
    collectTargets();
    saveSettings();
    syncMobileSheetToggles();
  });

  countdownEnabledCheckbox.addEventListener("change", () => {
    if (!playing && !countingDown) playBtn.disabled = false;
    saveSettings();
    syncMobileSheetToggles();
  });

  function updateSpeedSliderUi() {
    const min = Number(speedInput.min || 0);
    const max = Number(speedInput.max || 100);
    const val = Number(speedInput.value || 0);
    const denom = Math.max(1, max - min);
    const pct = Math.min(100, Math.max(0, ((val - min) / denom) * 100));
    speedInput.style.background = `linear-gradient(to right, var(--brand) 0%, var(--brand) ${pct}%, var(--floating-slider-bg) ${pct}%, var(--floating-slider-bg) 100%)`;
  }

  speedInput.addEventListener("input", () => {
    updateSpeedSliderUi();
    saveSettings();
  });

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
      updateSpeedSliderUi();

      setCurrentSettings({ ...currentSettings, ...settings });
    } catch (e) {
      console.log("解析保存設置失敗");
    }
  }
  updateSpeedSliderUi();

  mirrorStepper(fontPxMinus, fontPxPlus, document.getElementById("mobileFontPxMinus"), document.getElementById("mobileFontPxPlus"));
  mirrorStepper(lineGapMinus, lineGapPlus, document.getElementById("mobileLineGapMinus"), document.getElementById("mobileLineGapPlus"));
  mirrorStepper(transposeMinus, transposePlus, document.getElementById("mobileTransposeMinus"), document.getElementById("mobileTransposePlus"));
  mirrorStepper(metronomeBpmMinus, metronomeBpmPlus, document.getElementById("mobileBpmMinus"), document.getElementById("mobileBpmPlus"), syncMobileSheetDisplays);

  fontPxInput.addEventListener("change", syncMobileSheetDisplays);
  lineGapInput.addEventListener("change", syncMobileSheetDisplays);
  transposeInput.addEventListener("change", syncMobileSheetDisplays);
  metronomeBpmDisplay?.addEventListener("change", syncMobileSheetDisplays);

  mobileSettingsBtn?.addEventListener("click", openMobileSheet);
  mobileSettingsBackdrop?.addEventListener("click", closeMobileSheet);
  mobileSettingsClose?.addEventListener("click", closeMobileSheet);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.code === "Space" || e.isComposing || e.keyCode === 229) {
      debugShortcutLog("H18", "keydown edge captured", {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        isComposing: !!e.isComposing,
        targetTag: e.target?.tagName || null,
        activeTag: document.activeElement?.tagName || null,
      });
    }
    if (e.key === "Escape" && mobileSettingsSheet?.classList.contains("is-open")) {
      closeMobileSheet();
      return;
    }
    if (isTypingTarget(e.target) || e.isComposing || e.keyCode === 229) return;

    if (e.key === " " || e.code === "Space") {
      const recMainBtn = recordingsPanel?.querySelector("[data-rec-main]");
      if (recMainBtn) {
        e.preventDefault();
        lastShortcutAction = { type: "space-record", ts: Date.now() };
        debugShortcutLog("H19", "space triggered record click", {
          panelVisible: recordingsPanel?.classList?.contains("visible") || false,
        });
        recMainBtn.click();
      }
      return;
    }

    if (e.key === "Enter") {
      if (playBtn) {
        e.preventDefault();
        lastShortcutAction = { type: "enter-play", ts: Date.now() };
        debugShortcutLog("H19", "enter triggered play click", {
          disabled: !!playBtn.disabled,
        });
        playBtn.click();
      }
    }
  });
  const tuner = initTuner(tunerBtn, tunerPanel, {
    extraTriggerBtns: [tunerBtnMobile].filter(Boolean),
  });
  const metronome = initMetronome({
    bpmMinusBtn: metronomeBpmMinus,
    bpmPlusBtn: metronomeBpmPlus,
    bpmDisplayEl: metronomeBpmDisplay,
    resetBtn: metronomeResetBtn,
    toggleBtn: metronomeBtn,
    extraToggleBtns: [mobileMetronomeToggle].filter(Boolean),
    getSheetBpm: () => song.meta?.bpm,
  });
  initPlayback(metronome);
  window.__onSheetLoaded = () => {
    metronome.onSheetLoaded();
    syncMobileSheetDisplays();
  };

  syncMobileSheetDisplays();
  syncMobileSheetToggles();

  recordingsController = initRecordings(recordingsBtn, recordingsPanel, () => {
    const content = getCurrentSheetContent();
    return {
      key: makeSheetKey(content, song.filename),
      label: song.meta?.title || song.filename || "未命名樂譜",
    };
  }, {
    onBeforeRecord: () => {
      if (tuner.isOpen()) tuner.close();
    },
    extraTriggerBtns: [recordingsBtnMobile].filter(Boolean),
  });
  window.addEventListener("beforeunload", () => {
    debugShortcutLog("H20", "beforeunload observed", {
      lastShortcutAction,
      activeTag: document.activeElement?.tagName || null,
      href: window.location.href,
    });
    recordingsController?.destroy();
    metronome.destroy();
  });
  window.addEventListener("pagehide", (e) => {
    debugShortcutLog("H20", "pagehide observed", {
      persisted: !!e.persisted,
      lastShortcutAction,
      visibilityState: document.visibilityState,
    });
  });

  const dockState = loadDockState();
  if (dockState.tuner) tuner.open();
  if (dockState.recordings) void recordingsController?.open();

  render();
  collectTargets();
  observeTopbarHeight();
}

window.addEventListener('load', () => {
    loadChordFingerings().then(() => {
    init();

    const contentToLoad = sessionStorage.getItem('currentSheetContent');
    const filenameToLoad = sessionStorage.getItem('currentFilename');

    if (contentToLoad) {
        importScore(contentToLoad, filenameToLoad);
        render();
        collectTargets();
        if (recordingsController?.isOpen?.()) {
          void recordingsController.open();
        }
    }
    
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    if (window.location.href !== cleanUrl) {
        window.history.replaceState({}, document.title, cleanUrl);
    }
    });
});

// When the user navigates back and forth, ensure the content is up-to-date
function reloadIfSessionChanged() {
    const latestContent = getCurrentSheetContent();
    if (latestContent && latestContent !== song.originalContent) {
        importScore(latestContent, song.filename);
        render();
        collectTargets();
    }
}

window.addEventListener('pageshow', (e) => {
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
          importScore(evt.target.result, file.name);
          render();
          collectTargets();
      };
      reader.readAsText(file, "utf-8");
    } else {
      alert("點選或拖放 .txt 或 .gtab 格式的檔案");
    }
  }
});