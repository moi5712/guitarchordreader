// 閱讀器狀態
let song = {
  meta: { title: "", artist: "", key: "", bpm: "", time: "", capo: "" },
  sections: [],
};

let customChordFingerings = {};
let playing = false,
  rafId = null,
  targets = [],
  lastTs = null;
let countdownTimeoutId = null,
  accumulatedScroll = 0;

// 添加設定追蹤變數
let currentSettings = {
  fontSize: 18,
  lineGap: 14,
  transpose: 0,
  showFingering: false,
  countdownEnabled: false,
  speed: 30
};

const countdownDisplay = document.getElementById("countdownDisplay");
const playBtn = document.getElementById("playBtn");
const countdownEnabledCheckbox = document.getElementById("countdownEnabled");

// 和弦變調
// 從 functions.js 引用

// 樂譜建立
function buildChordLine(lyrics, chords, options = {}) {
  const {
    showFingering = false,
    transposeValue = 0,
    customChordFingerings = {},
    chordFingerings = {},
  } = options;

  const getChordContent = (chord) => {
    if (showFingering) {
      return createChordDiagram(chord, {
        transposeValue,
        customChordFingerings,
        chordFingerings,
      });
    }

    const displayChord = transposeChord(chord, transposeValue);
    return `<span class="${SCORE_CONFIG.cssClasses.chordName}">${displayChord}</span>`;
  };

  const chordBlockHeight = showFingering ? "75px" : "1.5em";

  const createBlock = (
    chordContent,
    lyricContent,
    blockChordHeight = chordBlockHeight
  ) => {
    const lyricClass = showFingering
      ? "lyric-content with-fingering"
      : "lyric-content";
    return `<div style="display: flex; flex-direction: column; align-items: flex-start;">
      <div style="height: ${blockChordHeight}; margin-bottom: 2px; display: flex; align-items: flex-end;">${chordContent}</div>
      <div class="${lyricClass}">${lyricContent || "&nbsp;"}</div>
    </div>`;
  };

  const wrapContainer = (content) =>
    `<div style="display: flex; flex-wrap: wrap; align-items: flex-end; margin-bottom: 5px;">${content}</div>`;

  // 無和弦情況
  if (chords.length === 0) {
    return lyrics.trim()
      ? wrapContainer(createBlock("", lyrics, chordBlockHeight))
      : "<div></div>";
  }

  const sortedChords = [...chords].sort((a, b) => a.pos - b.pos);

  // 只有和弦沒有歌詞
  if (!lyrics.trim()) {
    return `<div style="display: flex; flex-wrap: wrap; align-items: flex-end; margin-bottom: 5px; gap: 8px;">
      ${sortedChords
        .map((chord) => createBlock(getChordContent(chord.chord), "&nbsp;"))
        .join("")}
    </div>`;
  }

  // 正常情況：有和弦也有歌詞
  let blocks = [];

  if (sortedChords[0]?.pos > 0) {
    const initialLyrics = lyrics
      .slice(0, sortedChords[0].pos)
      .replace(/^\s+/, "");
    if (initialLyrics) {
      blocks.push(createBlock("", initialLyrics, chordBlockHeight));
    }
  }

  sortedChords.forEach((chord, index) => {
    const nextPos = sortedChords[index + 1]?.pos || lyrics.length;
    let lyricPart = lyrics.slice(chord.pos, nextPos).replace(/^\s+/, "");

    const currentPos = chord.pos;
    const isLastChordAtThisPosition =
      index === sortedChords.length - 1 ||
      sortedChords[index + 1].pos !== currentPos;

    if (!isLastChordAtThisPosition) {
      lyricPart = "";
    }

    const displayLyrics = lyricPart || "&nbsp;";
    blocks.push(createBlock(getChordContent(chord.chord), displayLyrics));
  });

  return wrapContainer(blocks.join(""));
}

// 獲取當前樂譜內容
function getCurrentSheetContent() {
  return sessionStorage.getItem("currentSheetContent") || "";
}

// 載入樂譜
function importScore(text) {
  // --- 資料大掃除與統一 ---
  // 1. 將當前內容設定為唯一的真相來源
  sessionStorage.setItem("currentSheetContent", text);
  // 2. 清理舊的、可能衝突的暫存
  localStorage.removeItem("currentSheetContent");
  localStorage.removeItem("editorContent");
  sessionStorage.removeItem("currentSheet"); // 清理舊的key

  customChordFingerings = {};
  const meta = {};
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (!line.startsWith("#") && !line.startsWith("@")) {
      break;
    }

    if (line.startsWith("#")) {
      const m = line.match(/^#(\w+):\s*(.*)$/);
      if (m) {
        meta[m[1]] = m[2];
      }
    } else if (line.startsWith("@")) {
      const m = line.match(/^@([^:]+):\s*(.*)$/);
      if (m) {
        const chordName = m[1].trim();
        const fingeringStr = m[2].trim();
        try {
          const fingering = fingeringStr.split(",").map((s) => {
            const val = s.trim();
            return val === "-1" ? -1 : parseInt(val);
          });

          if (
            fingering.length === 6 &&
            fingering.every((f) => Number.isInteger(f) && f >= -1 && f <= 12)
          ) {
            customChordFingerings[chordName] = fingering;
          } else {
            console.warn(`無效的指法格式: ${lines[i]}`);
          }
        } catch (e) {
          console.warn(`解析指法失敗: ${lines[i]}`);
        }
      }
    }
    i++;
  }

  while (i < lines.length && !lines[i].trim()) {
    i++;
  }
  const scoreText = lines.slice(i).join("\n");

  song.originalContent = text; // 保存原始內容
  song.sections = parseInput(scoreText);

  song.meta.title = meta.title || song.meta.title;
  song.meta.artist = meta.artist || song.meta.artist;
  song.meta.key = meta.key || song.meta.key;
  song.meta.bpm = meta.bpm ? Number(meta.bpm) : song.meta.bpm;
  song.meta.time = meta.time || song.meta.time;
  song.meta.capo = meta.capo ? Number(meta.capo) : song.meta.capo;
  render();
}

function render() {
  const newSettings = {
    fontSize: +document.getElementById("fontPx").value || 15,
    lineGap: +document.getElementById("lineGap").value || 14,
    transpose: +document.getElementById("transpose").value || 0,
    showFingering: document.getElementById("showFingering").checked,
    countdownEnabled: document.getElementById("countdownEnabled").checked,
    speed: +document.getElementById("speed").value || 30
  };

  currentSettings = newSettings;

  const titleElement = document.getElementById("title");
  if (song.meta.artist) {
    titleElement.innerHTML = `
            <div style="font-size: 1em; font-weight: bold; margin-bottom: 4px;">${song.meta.title || ""}</div>
            <div style="font-size: 0.75em; font-weight: normal; color: #666;">${song.meta.artist}</div>
          `;
  } else {
    titleElement.textContent = song.meta.title || "";
  }

  const subtitle = [
    song.meta.key ? `Key ${song.meta.key}` : "",
    song.meta.capo ? `Capo ${song.meta.capo}` : "",
    song.meta.bpm ? `BPM ${song.meta.bpm}` : "",
    song.meta.time ? song.meta.time : "",
  ]
    .filter(Boolean)
    .join(" · ");
  document.getElementById("subtitle").textContent = subtitle;

  const score = document.getElementById("score");
  score.innerHTML = "";

  const hasContent = song.sections.length > 0 && song.sections.some((sec) => sec.lines.length > 0);

  if (hasContent) {
    score.classList.add("has-content");
  } else {
    score.classList.remove("has-content");
  }

  const fontSize = Math.max(10, Math.min(30, newSettings.fontSize));
  score.style.fontSize = fontSize + "px";
  const gap = Math.max(0, Math.min(100, newSettings.lineGap));

  if (!hasContent) {
    const headerEl = document.querySelector(".card > .meta, .card > header.meta, .card > header");
    if (headerEl) headerEl.style.display = "none";
    const cardEl = document.querySelector(".card");
    if (cardEl) cardEl.style.padding = "0";

    document.getElementById("title").textContent = "";
    document.getElementById("subtitle").textContent = "";
    const tip = document.createElement("div");
    tip.style.textAlign = "center";
    tip.style.color = "#9aa4c4";
    tip.style.padding = "48px 0";
    tip.style.cursor = "pointer";
    tip.style.borderRadius = "12px";
    tip.style.transition = "all 0.2s ease";
    tip.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 4px;">點擊或拖放以載入</div>
            <div style="font-size: 14px;">僅限 .txt 和 .gtab 格式</div>
          `;

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      tip.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    tip.addEventListener("mouseenter", function () { this.style.backgroundColor = "#f8f9fa"; this.style.color = "#495057"; });
    tip.addEventListener("mouseleave", function () { this.style.backgroundColor = "transparent"; this.style.color = "#9aa4c4"; });
    tip.addEventListener("click", () => document.getElementById("importFile").click());
    tip.addEventListener("dragenter", function () { this.style.backgroundColor = "#e3f2fd"; this.style.border = "2px dashed #2196f3"; });
    tip.addEventListener("dragleave", function () { this.style.backgroundColor = "transparent"; this.style.border = "none"; });
    tip.addEventListener("drop", function (e) {
      this.style.backgroundColor = "transparent";
      this.style.border = "none";
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".txt") || file.name.endsWith(".gtab"))) {
        const reader = new FileReader();
        reader.onload = (e) => importScore(e.target.result);
        reader.readAsText(file, "utf-8");
      } else {
        alert("請選擇 .txt 或 .gtab 格式的檔案");
      }
    });

    score.appendChild(tip);
  } else {
    const headerEl = document.querySelector(".card > .meta, .card > header.meta, .card > header");
    if (headerEl) headerEl.style.display = "";
    const cardEl = document.querySelector(".card");
    if (cardEl) cardEl.style.padding = "";

    song.sections.forEach((sec) => {
      const h = document.createElement("div");
      h.className = "sec";
      h.style.borderLeftColor = sec.color;
      h.textContent = sec.label;
      score.appendChild(h);

      sec.lines.forEach((ln, i) => {
        const wrap = document.createElement("div");
        wrap.className = "line";
        wrap.dataset.section = sec.id;
        wrap.dataset.line = i;
        wrap.style.marginBottom = gap + "px";

        const lineContentSpan = document.createElement("span");
        lineContentSpan.className = "chords-and-lyrics";

        lineContentSpan.innerHTML = buildChordLine(ln.lyrics, ln.chords, {
          showFingering: newSettings.showFingering,
          transposeValue: newSettings.transpose,
          customChordFingerings,
          chordFingerings,
          transposeChord,
        });

        wrap.appendChild(lineContentSpan);
        score.appendChild(wrap);
      });
    });
  }
  collectTargets();
}

// 自動捲動功能
function collectTargets() {
  const scoreEl = document.getElementById("score");
  const scoreTop = scoreEl.getBoundingClientRect().top;
  targets = [...scoreEl.querySelectorAll(".line[data-section]")].map((el) => {
    const rect = el.getBoundingClientRect();
    return { el, top: rect.top - scoreTop + window.scrollY };
  });
}

function startScroll() {
  playing = true;
  collectTargets();
  lastTs = null;
  rafId = requestAnimationFrame(loop);
  playBtn.textContent = "⏹ 停止";
  playBtn.classList.remove("primary");
}

function togglePlay() {
  if (playing) {
    playing = false;
    cancelAnimationFrame(rafId);
    clearTimeout(countdownTimeoutId);
    countdownDisplay.style.display = "none";
    accumulatedScroll = 0;
    playBtn.textContent = "▶︎ 開始";
    playBtn.classList.add("primary");
    playBtn.disabled = false;
  } else {
    const isCountdownEnabled = countdownEnabledCheckbox.checked;
    const bpm = song.meta.bpm || 120;
    const beatDuration = 60000 / bpm;

    if (isCountdownEnabled) {
      let count = 4;
      playBtn.disabled = true;
      countdownDisplay.style.display = "block";

      function doCountdown() {
        if (count > 0) {
          countdownDisplay.textContent = count;
          count--;
          countdownTimeoutId = setTimeout(doCountdown, beatDuration);
        } else {
          countdownDisplay.style.display = "none";
          playBtn.disabled = false;
          startScroll();
        }
      }
      doCountdown();
    } else {
      startScroll();
    }
  }
}

function loop(ts) {
  if (!playing) return;
  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs;
  lastTs = ts;

  const speed = +document.getElementById("speed").value;
  const scrollDist = (speed * dt) / 1000;
  accumulatedScroll += scrollDist;

  if (accumulatedScroll >= 1) {
    const pixelsToScroll = Math.floor(accumulatedScroll);
    window.scrollBy({ top: pixelsToScroll, behavior: "auto" });
    accumulatedScroll -= pixelsToScroll;
  }

  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  const currentScrollY = window.scrollY;
  const scrollThreshold = 20;

  if (currentScrollY + clientHeight >= scrollHeight - scrollThreshold) {
    togglePlay();
    window.scrollTo({ top: scrollHeight, behavior: "smooth" });
    return;
  }

  rafId = requestAnimationFrame(loop);
}

// 儲存設定
function saveSettings() {
  const settings = {
    fontSize: document.getElementById("fontPx").value,
    lineGap: document.getElementById("lineGap").value,
    transpose: document.getElementById("transpose").value,
    showFingering: document.getElementById("showFingering").checked,
    countdownEnabled: document.getElementById("countdownEnabled").checked,
    speed: document.getElementById("speed").value,
  };
  localStorage.setItem("readerSettings", JSON.stringify(settings));
}

// 事件綁定
function init() {
  document.getElementById("editBtn").onclick = function () {
    window.location.href = "editor.html";
  };

  playBtn.onclick = togglePlay;
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
    reader.onload = (evt) => importScore(evt.target.result);
    reader.readAsText(file, "utf-8");
  });

  let renderTimeout = null;
  const debouncedRender = () => {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(render, 100);
  };

  ["fontPx", "lineGap", "transpose"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      debouncedRender();
      saveSettings();
    });
  });

  document.getElementById("showFingering").addEventListener("change", () => {
    render();
    saveSettings();
  });

  countdownEnabledCheckbox.addEventListener("change", () => {
    if (!playing) playBtn.disabled = false;
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

      currentSettings = { ...currentSettings, ...settings };
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
    saveSettings();
    document.getElementById("mobileSettingsModal").classList.remove("visible");
  };

  document.getElementById("mobileSettingsCancel").onclick = () => document.getElementById("mobileSettingsModal").classList.remove("visible");
  document.getElementById("mobileSettingsModal").onclick = function (e) {
    if (e.target === this) this.classList.remove("visible");
  };

  song.sections = [];
  render();
}

window.onload = function () {
  init();

  let contentToLoad = null;
  const urlParams = new URLSearchParams(window.location.search);
  const contentParam = urlParams.get("content");

  // --- Robust Loading Logic ---
  if (contentParam) {
    contentToLoad = decodeURIComponent(contentParam);
  } else {
    const sessionContent = sessionStorage.getItem("currentSheetContent");
    if (sessionContent) {
      contentToLoad = sessionContent;
    } else {
      const localContent = localStorage.getItem("currentSheetContent");
      if (localContent) {
        contentToLoad = localContent;
      }
    }
  }

  if (contentToLoad) {
    importScore(contentToLoad);
  }

  const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
};


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
      reader.onload = (evt) => importScore(evt.target.result);
      reader.readAsText(file, "utf-8");
    } else {
      alert("請拖放 .txt 或 .gtab 格式的檔案");
    }
  }
});