import { song, currentSettings, customChordFingerings, setCurrentSettings } from './state.js';
import { createChordDiagram, transposeChord } from '../utils/chord-utils.js';
import { SCORE_CONFIG } from '../config/score-config.js';
import { importScore } from './data.js';

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

export function render() {
  const newSettings = {
    fontSize: +document.getElementById("fontPx").value || 15,
    lineGap: +document.getElementById("lineGap").value || 14,
    transpose: +document.getElementById("transpose").value || 0,
    showFingering: document.getElementById("showFingering").checked,
    countdownEnabled: document.getElementById("countdownEnabled").checked,
    speed: +document.getElementById("speed").value || 30
  };

  setCurrentSettings(newSettings);

  const titleElement = document.getElementById("title");
  if (song.meta.artist) {
    titleElement.innerHTML = `
            <div style="font-size: 0.9em; font-weight: bold; margin-bottom: 4px;">${song.meta.title || ""}</div>
            <div style="font-size: 0.7em; font-weight: normal; color: #666;">${song.meta.artist}</div>
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

    const hasExplicitSections = /^\[(verse|chorus|intro|bridge|outro|solo|pre-chorus|interlude|tag|coda)\]/im.test(song.originalContent || '');

    song.sections.forEach((sec) => {
      if (hasExplicitSections) {
        const h = document.createElement("div");
        h.className = "sec";
        h.style.borderLeftColor = sec.color;
        h.textContent = sec.label;
        score.appendChild(h);
      }

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
          chordFingerings: {}, // This was empty in the original code
          transposeChord,
        });

        wrap.appendChild(lineContentSpan);
        score.appendChild(wrap);
      });
    });
  }
}
