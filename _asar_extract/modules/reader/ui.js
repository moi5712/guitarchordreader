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
    const chordSlot = showFingering
      ? `<div class="chord-block-inner flex-wrap-end" style="height: ${blockChordHeight}">${chordContent}</div>`
      : chordContent;
    return `<div class="flex-col-start">
      ${chordSlot}
      <div class="${lyricClass}">${lyricContent || "&nbsp;"}</div>
    </div>`;
  };

  const wrapContainer = (content) =>
    `<div class="flex-wrap-end mb-1">${content}</div>`;

  // 無和弦情況
  if (chords.length === 0) {
    return lyrics.trim()
      ? wrapContainer(createBlock("", lyrics, chordBlockHeight))
      : "<div></div>";
  }

  const sortedChords = [...chords].sort((a, b) => a.pos - b.pos);

  // 只有和弦沒有歌詞
  if (!lyrics.trim()) {
    return `<div class="flex-wrap-end mb-1 gap-2">
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
            <div class="title-main">${song.meta.title || ""}</div>
            <div class="title-artist">${song.meta.artist}</div>
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

  score.classList.toggle("has-content", hasContent);

  const fontSize = Math.max(10, Math.min(30, newSettings.fontSize));
  score.style.fontSize = fontSize + "px";
  const gap = Math.max(0, Math.min(100, newSettings.lineGap));

  const headerEl = document.querySelector(".card > .meta, .card > header.meta, .card > header");
  const cardEl = document.querySelector(".card");

  if (headerEl) {
    const imageUrl = song.meta.image || '/assets/guitar4.jpg';
    headerEl.style.backgroundImage = `url('${imageUrl}')`;
    headerEl.style.backgroundSize = 'cover';
    headerEl.style.backgroundPosition = 'center';
  }

  if (!hasContent) {
    if (headerEl) headerEl.style.display = "none";
    if (cardEl) cardEl.style.padding = "0";

    document.getElementById("title").textContent = "";
    document.getElementById("subtitle").textContent = "";
    const tip = document.createElement("div");
    tip.className = "score-empty-tip";
    tip.innerHTML = `
            <div class="score-empty-tip-title">點擊或拖放以載入</div>
            <div class="score-empty-tip-subtitle">僅限 .txt 和 .gtab 格式</div>
          `;

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      tip.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    tip.addEventListener("click", () => document.getElementById("importFile").click());
    tip.addEventListener("dragenter", () => tip.classList.add("is-dragging"));
    tip.addEventListener("dragover", () => tip.classList.add("is-dragging"));
    tip.addEventListener("dragleave", () => tip.classList.remove("is-dragging"));
    tip.addEventListener("drop", function (e) {
      this.classList.remove("is-dragging");
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".txt") || file.name.endsWith(".gtab"))) {
        const reader = new FileReader();
        reader.onload = (e) => {
          importScore(e.target.result);
          render();
          collectTargets();
        };
        reader.readAsText(file, "utf-8");
      } else {
        alert("請選擇 .txt 或 .gtab 格式的檔案");
      }
    });

    score.appendChild(tip);
  } else {
    if (headerEl) headerEl.style.display = "";
    if (cardEl) cardEl.style.padding = "";

    const hasExplicitSections = /^\[(verse|chorus|intro|bridge|outro|solo|pre-chorus|interlude|tag|coda)\]/im.test(song.originalContent || '');

    const fragment = document.createDocumentFragment();

    song.sections.forEach((sec) => {
      if (hasExplicitSections) {
        const h = document.createElement("div");
        h.className = "sec";
        h.style.borderLeftColor = sec.color;
        h.textContent = sec.label;
        fragment.appendChild(h);
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
        fragment.appendChild(wrap);
      });
    });
    score.appendChild(fragment);
  }
}