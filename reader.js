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
  // 如果沒有載入任何樂譜，返回空字符串
  if (
    !song.sections.length ||
    song.sections.every((sec) => !sec.lines.length)
  ) {
    return "";
  }

  // 如果有保存的原始內容，直接返回（最準確）
  if (song.originalContent) {
    return song.originalContent;
  }

  // 否則重建內容
  let content = "";

  // 添加 meta 信息
  if (song.meta.title) content += `#title: ${song.meta.title}\n`;
  if (song.meta.artist) content += `#artist: ${song.meta.artist}\n`;
  if (song.meta.key) content += `#key: ${song.meta.key}\n`;
  if (song.meta.bpm) content += `#bpm: ${song.meta.bpm}\n`;
  if (song.meta.time) content += `#time: ${song.meta.time}\n`;
  if (song.meta.capo) content += `#capo: ${song.meta.capo}\n`;

  // 添加自定義和弦指法
  Object.keys(customChordFingerings).forEach((chordName) => {
    const fingering = customChordFingerings[chordName];
    content += `@${chordName}: ${fingering.join(",")}\n`;
  });

  if (content) content += "\n";

  // 重建樂譜內容
  song.sections.forEach((section, sectionIndex) => {
    // 添加段落標記
    const sectionKey = section.type || "verse";
    content += `[${sectionKey}]\n`;

    // 添加段落內容
    section.lines.forEach((line) => {
      if (line.raw) {
        // 如果有原始內容，直接使用
        content += line.raw + "\n";
      } else {
        // 否則重建內容
        let lineContent = "";
        let lastPos = 0;

        // 按位置排序和弦
        const sortedChords = [...line.chords].sort((a, b) => a.pos - b.pos);

        sortedChords.forEach((chord) => {
          // 添加和弦前的歌詞
          lineContent += line.lyrics.slice(lastPos, chord.pos);
          // 添加和弦
          lineContent += `[${chord.chord}]`;
          lastPos = chord.pos;
        });

        // 添加剩餘的歌詞
        lineContent += line.lyrics.slice(lastPos);
        content += lineContent + "\n";
      }
    });

    // 段落間添加空行（除了最後一個段落）
    if (sectionIndex < song.sections.length - 1) {
      content += "\n";
    }
  });

  return content;
}

// 載入樂譜
function importScore(text) {
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
            console.log(
              `載入自定義指法: ${chordName} = [${fingering.join(", ")}]`
            );
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

  // 保存原始內容以便重建
  const originalContent = text;
  song.originalContent = originalContent;

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
  // 檢查設定是否真的改變了
  const newSettings = {
    fontSize: +document.getElementById("fontPx").value || 15,
    lineGap: +document.getElementById("lineGap").value || 14,
    transpose: +document.getElementById("transpose").value || 0,
    showFingering: document.getElementById("showFingering").checked,
    countdownEnabled: document.getElementById("countdownEnabled").checked,
    speed: +document.getElementById("speed").value || 30
  };

  // 更新當前設定
  currentSettings = newSettings;

  const titleElement = document.getElementById("title");
  if (song.meta.artist) {
    titleElement.innerHTML = `
            <div style="font-size: 1em; font-weight: bold; margin-bottom: 4px;">${
              song.meta.title || ""
            }</div>
            <div style="font-size: 0.75em; font-weight: normal; color: #666;">${
              song.meta.artist
            }</div>
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
  score.innerHTML = ""; // 在渲染前清空容器

  // 檢查是否有內容
  const hasContent =
    song.sections.length > 0 &&
    song.sections.some((sec) => sec.lines.length > 0);

  if (hasContent) {
    score.classList.add("has-content");
  } else {
    score.classList.remove("has-content");
  }

  const fontSize = Math.max(
    10,
    Math.min(30, newSettings.fontSize)
  );
  score.style.fontSize = fontSize + "px";
  const gap = Math.max(
    0,
    Math.min(100, newSettings.lineGap)
  );

  if (
    !song.sections.length ||
    song.sections.every((sec) => !sec.lines.length)
  ) {
    const headerEl = document.querySelector(
      ".card > .meta, .card > header.meta, .card > header"
    );
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

    // 防止預設拖曳行為
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      tip.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    tip.addEventListener("mouseenter", function () {
      this.style.backgroundColor = "#f8f9fa";
      this.style.color = "#495057";
    });

    tip.addEventListener("mouseleave", function () {
      this.style.backgroundColor = "transparent";
      this.style.color = "#9aa4c4";
    });

    tip.addEventListener("click", function () {
      document.getElementById("importFile").click();
    });

    // 拖曳視覺回饋
    tip.addEventListener("dragenter", function () {
      this.style.backgroundColor = "#e3f2fd";
      this.style.border = "2px dashed #2196f3";
    });

    tip.addEventListener("dragleave", function () {
      this.style.backgroundColor = "transparent";
      this.style.border = "none";
    });

    tip.addEventListener("drop", function (e) {
      this.style.backgroundColor = "transparent";
      this.style.border = "none";

      const dt = e.dataTransfer;
      const files = dt.files;

      if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith(".txt") || file.name.endsWith(".gtab")) {
          const reader = new FileReader();
          reader.onload = function (e) {
            importScore(e.target.result);
          };
          reader.readAsText(file, "utf-8");
        } else {
          alert("請選擇 .txt 或 .gtab 格式的檔案");
        }
      }
    });

    score.appendChild(tip);
  } else {
    // 清空 score 區域，準備渲染樂譜內容
    const headerEl = document.querySelector(
      ".card > .meta, .card > header.meta, .card > header"
    );
    if (headerEl) headerEl.style.display = "";
    const cardEl = document.querySelector(".card");
    if (cardEl) cardEl.style.padding = ""; //恢復樂譜卡片樣式

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

        const showFingering = newSettings.showFingering;
        const transposeValue = newSettings.transpose;

        lineContentSpan.innerHTML = buildChordLine(ln.lyrics, ln.chords, {
          showFingering,
          transposeValue,
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
    return {
      el,
      top: rect.top - scoreTop + window.scrollY,
    };
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
    window.scrollBy({
      top: pixelsToScroll,
      behavior: "auto",
    });
    accumulatedScroll -= pixelsToScroll;
  }

  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  const currentScrollY = window.scrollY;
  const scrollThreshold = 20;

  if (currentScrollY + clientHeight >= scrollHeight - scrollThreshold) {
    togglePlay();
    window.scrollTo({ top: scrollHeight, behavior: "smooth" });
    console.log("捲動到底部，自動停止。");
    return;
  }

  rafId = requestAnimationFrame(loop);
}

// 事件綁定
function init() {
  document.getElementById("editBtn").onclick = function () {
    // 保存當前閱讀器設置到 localStorage
    const settings = {
      fontSize: document.getElementById("fontPx").value,
      lineGap: document.getElementById("lineGap").value,
      transpose: document.getElementById("transpose").value,
      showFingering: document.getElementById("showFingering").checked,
      countdownEnabled: document.getElementById("countdownEnabled").checked,
      speed: document.getElementById("speed").value,
    };
    localStorage.setItem("readerSettings", JSON.stringify(settings));

    // 獲取當前樂譜內容
    const currentContent = getCurrentSheetContent();

    // 如果有內容，將其編碼到 URL 中傳遞給編輯器
    let url = "editor.html";
    if (currentContent && currentContent.trim()) {
      const encodedContent = encodeURIComponent(currentContent);
      url += `?content=${encodedContent}`;
    }

    window.location.href = url;
  };

  playBtn.onclick = togglePlay;
  document.getElementById("homeBtn").onclick = function () {
    window.location.href = "library.html";
  };
  document.getElementById("importBtn").onclick = function () {
    document.getElementById("importFile").click();
  };

  document
    .getElementById("importFile")
    .addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        importScore(evt.target.result);
      };
      reader.readAsText(file, "utf-8");
    });

  // 使用防抖來避免頻繁重新渲染
  let renderTimeout = null;
  const debouncedRender = () => {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(render, 100);
  };

  ["fontPx", "lineGap", "transpose"].forEach((id) =>
    document.getElementById(id).addEventListener("input", debouncedRender)
  );

  document.getElementById("showFingering").addEventListener("change", render);
  countdownEnabledCheckbox.addEventListener("change", () => {
    if (!playing) {
      playBtn.disabled = false;
    }
  });

  // 恢復之前保存的設置
  const savedSettings = localStorage.getItem("readerSettings");
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      document.getElementById("fontPx").value = settings.fontSize || 18;
      document.getElementById("lineGap").value = settings.lineGap || 14;
      document.getElementById("transpose").value = settings.transpose || 0;
      document.getElementById("showFingering").checked =
        settings.showFingering || false;
      document.getElementById("countdownEnabled").checked =
        settings.countdownEnabled || false;
      document.getElementById("speed").value = settings.speed || 30;

      // 同步手機版設定值
      document.getElementById("mobileFontPx").value = settings.fontSize || 18;
      document.getElementById("mobileLineGap").value = settings.lineGap || 14;
      document.getElementById("mobileTranspose").value =
        settings.transpose || 0;
      document.getElementById("mobileShowFingering").checked =
        settings.showFingering || false;
      document.getElementById("mobileCountdownEnabled").checked =
        settings.countdownEnabled || false;

      // 更新當前設定
      currentSettings = {
        fontSize: settings.fontSize || 18,
        lineGap: settings.lineGap || 14,
        transpose: settings.transpose || 0,
        showFingering: settings.showFingering || false,
        countdownEnabled: settings.countdownEnabled || false,
        speed: settings.speed || 30
      };
    } catch (e) {
      console.log("無法解析保存的設置");
    }
  }

  // 手機版設定按鈕事件
  document.getElementById("mobileSettingsBtn").onclick = function () {
    // 同步當前設定值到手機版彈窗
    document.getElementById("mobileFontPx").value =
      document.getElementById("fontPx").value;
    document.getElementById("mobileLineGap").value =
      document.getElementById("lineGap").value;
    document.getElementById("mobileTranspose").value =
      document.getElementById("transpose").value;
    document.getElementById("mobileShowFingering").checked =
      document.getElementById("showFingering").checked;
    document.getElementById("mobileCountdownEnabled").checked =
      document.getElementById("countdownEnabled").checked;

    // 顯示彈窗
    document.getElementById("mobileSettingsModal").classList.add("visible");
  };

  // 手機版設定彈窗確定按鈕
  document.getElementById("mobileSettingsConfirm").onclick = function () {
    // 將手機版設定值同步到主設定
    document.getElementById("fontPx").value =
      document.getElementById("mobileFontPx").value;
    document.getElementById("lineGap").value =
      document.getElementById("mobileLineGap").value;
    document.getElementById("transpose").value =
      document.getElementById("mobileTranspose").value;
    document.getElementById("showFingering").checked = document.getElementById(
      "mobileShowFingering"
    ).checked;
    document.getElementById("countdownEnabled").checked =
      document.getElementById("mobileCountdownEnabled").checked;

    // 觸發重新渲染
    render();

    // 關閉彈窗
    document.getElementById("mobileSettingsModal").classList.remove("visible");
  };

  // 手機版設定彈窗取消按鈕
  document.getElementById("mobileSettingsCancel").onclick = function () {
    document.getElementById("mobileSettingsModal").classList.remove("visible");
  };

  // 點擊彈窗背景關閉
  document.getElementById("mobileSettingsModal").onclick = function (e) {
    if (e.target === this) {
      this.classList.remove("visible");
    }
  };

  song.sections = [];
  render();
}

window.onload = function () {
  init();

  // 優先從 localStorage 讀取內容，否則兼容舊的 content，再 fallback 空內容
  const urlParams = new URLSearchParams(window.location.search);
  const contentFromStorage = localStorage.getItem("currentSheetContent");
  const contentParam = urlParams.get("content");
  const titleParam = urlParams.get("title");

  let contentToLoad = null;
  if (contentFromStorage && contentFromStorage.trim()) {
    contentToLoad = contentFromStorage;
  } else if (contentParam) {
    contentToLoad = decodeURIComponent(contentParam);
  }

  if (contentToLoad) {
    importScore(contentToLoad);
  }

  // 清除一次性內容，避免舊內容殘留
  localStorage.removeItem("currentSheetContent");

  // 清理網址，只保留簡短的標題參數（若存在）
  const finalTitle =
    titleParam || parseSheetMeta(contentToLoad || "").title || "";
  const newUrl = finalTitle
    ? `reader.html?${encodeURIComponent(finalTitle)}`
    : "reader.html";
  window.history.replaceState({}, "", newUrl);
};
