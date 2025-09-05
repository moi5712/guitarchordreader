import { importScore, saveSettings, getCurrentSheetContent } from './data.js';
import { render } from './ui.js';
import { togglePlay, collectTargets } from './playback.js';
import { setCurrentSettings, playing } from './state.js';

function init() {
  document.getElementById("editBtn").onclick = function () {
    window.location.href = "editor.html";
  };

  document.getElementById("playBtn").onclick = togglePlay;
  document.getElementById("homeBtn").onclick = function () {
    window.location.href = "library.html";
  };
  document.getElementById("importBtn").onclick = function () {
    document.getElementById("importFile").click();
  };

  document.getElementById("importFile").addEventListener("change", function (e) {
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

  ["fontPx", "lineGap", "transpose"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      debouncedRender();
      saveSettings();
    });
  });

  document.getElementById("showFingering").addEventListener("change", () => {
    render();
    collectTargets();
    saveSettings();
  });

  const countdownEnabledCheckbox = document.getElementById("countdownEnabled");
  countdownEnabledCheckbox.addEventListener("change", () => {
    if (!playing) document.getElementById("playBtn").disabled = false;
    saveSettings();
  });

  document.getElementById("speed").addEventListener("input", saveSettings);

  const savedSettings = localStorage.getItem("readerSettings");
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      document.getElementById("fontPx").value = settings.fontSize || 18;
      document.getElementById("lineGap").value = settings.lineGap || 14;
      document.getElementById("transpose").value = settings.transpose || 0;
      document.getElementById("showFingering").checked = settings.showFingering || false;
      document.getElementById("countdownEnabled").checked = settings.countdownEnabled || false;
      document.getElementById("speed").value = settings.speed || 30;

      document.getElementById("mobileFontPx").value = settings.fontSize || 18;
      document.getElementById("mobileLineGap").value = settings.lineGap || 14;
      document.getElementById("mobileTranspose").value = settings.transpose || 0;
      document.getElementById("mobileShowFingering").checked = settings.showFingering || false;
      document.getElementById("mobileCountdownEnabled").checked = settings.countdownEnabled || false;

      setCurrentSettings({ ...currentSettings, ...settings });
    } catch (e) {
      console.log("無法解析保存的設置");
    }
  }

  document.getElementById("mobileSettingsBtn").onclick = function () {
    document.getElementById("mobileFontPx").value = document.getElementById("fontPx").value;
    document.getElementById("mobileLineGap").value = document.getElementById("lineGap").value;
    document.getElementById("mobileTranspose").value = document.getElementById("transpose").value;
    document.getElementById("mobileShowFingering").checked = document.getElementById("showFingering").checked;
    document.getElementById("mobileCountdownEnabled").checked = document.getElementById("countdownEnabled").checked;
    document.getElementById("mobileSettingsModal").classList.add("visible");
  };

  document.getElementById("mobileSettingsConfirm").onclick = function () {
    document.getElementById("fontPx").value = document.getElementById("mobileFontPx").value;
    document.getElementById("lineGap").value = document.getElementById("mobileLineGap").value;
    document.getElementById("transpose").value = document.getElementById("mobileTranspose").value;
    document.getElementById("showFingering").checked = document.getElementById("mobileShowFingering").checked;
    document.getElementById("countdownEnabled").checked = document.getElementById("mobileCountdownEnabled").checked;
    render();
    collectTargets();
    saveSettings();
    document.getElementById("mobileSettingsModal").classList.remove("visible");
  };

  document.getElementById("mobileSettingsCancel").onclick = () => document.getElementById("mobileSettingsModal").classList.remove("visible");
  document.getElementById("mobileSettingsModal").onclick = function (e) {
    if (e.target === this) this.classList.remove("visible");
  };

  render();
  collectTargets();
}

window.addEventListener('load', () => {
    init();

    let contentToLoad = null;
    const urlParams = new URLSearchParams(window.location.search);
    const contentParam = urlParams.get("content");

    // --- Robust Loading Logic ---
    if (contentParam) {
        contentToLoad = decodeURIComponent(contentParam);
    } else {
        contentToLoad = getCurrentSheetContent();
    }

    if (contentToLoad) {
        importScore(contentToLoad);
        render();
        collectTargets();
    }

    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
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
