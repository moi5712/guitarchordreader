import { showConfirm } from '../utils/ui-utils.js';

function showAddChordError(message) {
  const el = document.getElementById("addChordError");
  if (el) {
    el.textContent = message;
  }
}

function clearAddChordError() {
  const el = document.getElementById("addChordError");
  if (el) el.textContent = "";
}
import { insertChord } from './textarea.js';

let customChords = {};

// --- 指法圖狀態（6 弦：index 0 = 第 6 弦）---
// diagramFingering 存「相對」：0=空弦, -1=不彈, 1~5=圖上第 1~5 格（不隨起始品格變）
const NUM_STRINGS = 6;
const NUM_FRETS = 5;
let diagramFingering = [0, 0, 0, 0, 0, 0]; // 0 | -1 | 1..5
let diagramStartFret = 1; // 僅在「新增自訂和弦」時用來換算實際品格

function clearDiagram() {
  diagramFingering = [0, 0, 0, 0, 0, 0];
  diagramStartFret = 1;
}

// 依當前起始品格，將相對指法換算成絕對品格（給樂譜用）
function getAbsoluteFingering() {
  return diagramFingering.map((rel) => {
    if (rel === 0 || rel === -1) return rel;
    if (rel >= 1 && rel <= NUM_FRETS) return diagramStartFret + (rel - 1);
    return 0;
  });
}

// --- 指法圖 UI：弦在欄位中央、圓點對齊弦線，格線為藍線 ---
function renderFingeringDiagram() {
  const container = document.getElementById("fingeringDiagram");
  if (!container) return;

  container.innerHTML = "";

  for (let stringIndex = 0; stringIndex < NUM_STRINGS; stringIndex++) {
    const column = document.createElement("div");
    column.className = "fingering-string-column";

    // 每弦最上方：點一下切換不彈(×)
    const muteCell = document.createElement("div");
    muteCell.className = "fingering-cell fingering-cell-mute";
    muteCell.dataset.stringIndex = String(stringIndex);
    const isMute = diagramFingering[stringIndex] === -1;
    if (isMute) {
      const x = document.createElement("span");
      x.className = "fingering-x";
      x.textContent = "×";
      muteCell.appendChild(x);
    }
    muteCell.addEventListener("click", () => {
      diagramFingering[stringIndex] = diagramFingering[stringIndex] === -1 ? 0 : -1;
      renderFingeringDiagram();
    });
    column.appendChild(muteCell);

    // 該弦的 5 格（相對 1~5）
    for (let fretRow = 0; fretRow < NUM_FRETS; fretRow++) {
      const relativeFret = fretRow + 1; // 1..5
      const cell = document.createElement("div");
      cell.className = "fingering-cell";
      cell.dataset.stringIndex = String(stringIndex);
      cell.dataset.relativeFret = String(relativeFret);
      const isActive = diagramFingering[stringIndex] === relativeFret;
      if (isActive) {
        const dot = document.createElement("span");
        dot.className = "fingering-dot";
        cell.appendChild(dot);
      }
      cell.addEventListener("click", () => {
        if (diagramFingering[stringIndex] === relativeFret) {
          diagramFingering[stringIndex] = 0;
        } else {
          diagramFingering[stringIndex] = relativeFret;
        }
        renderFingeringDiagram();
      });
      column.appendChild(cell);
    }
    container.appendChild(column);
  }
}

function updateStartFretDisplay() {
  const startFretEl = document.getElementById("startFretValue");
  if (startFretEl) startFretEl.textContent = diagramStartFret;
}

// --- 指法圖初始化：起始品格只改數字，不重繪圖 ---
export function initFingeringDiagram() {
  renderFingeringDiagram();
  updateStartFretDisplay();

  const upBtn = document.getElementById("startFretUp");
  const downBtn = document.getElementById("startFretDown");
  if (upBtn) {
    upBtn.onclick = () => {
      diagramStartFret = Math.max(1, diagramStartFret - 1);
      updateStartFretDisplay();
    };
  }
  if (downBtn) {
    downBtn.onclick = () => {
      diagramStartFret = Math.min(24, diagramStartFret + 1);
      updateStartFretDisplay();
    };
  }
}

// --- 新增自定義和弦 ---
export function addCustomChord() {
  const chordName = document
    .getElementById("customChordName")
    .value.trim();

  if (!chordName) {
    showAddChordError("請輸入和弦名稱");
    return;
  }

  const fingering = getAbsoluteFingering();
  const isAllNegativeOne = fingering.every((f) => f === -1);
  const isAllInRange = fingering.every((f) => f >= -1 && f <= 24);

  if (!isAllInRange || isAllNegativeOne) {
    showAddChordError("指法無效");
    return;
  }

  clearAddChordError();
  customChords[chordName] = fingering;
  sessionStorage.setItem("customChords", JSON.stringify(customChords));

  // --- 添加到樂譜中 ---
  const textarea = document.getElementById("editorTextarea");
  const currentContent = textarea.value;
  const customChordLine = `@${chordName}: ${fingering.join(",")}`;
  const lines = currentContent.split("\n");
  const existingIndex = lines.findIndex((line) =>
    line.trim().startsWith(`@${chordName}:`)
  );

  if (existingIndex >= 0) {
    lines[existingIndex] = customChordLine;
  } else {
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() && !lines[i].trim().startsWith("#")) {
        insertIndex = i;
        break;
      }
    }
    lines.splice(insertIndex, 0, customChordLine);
  }

  textarea.value = lines.join("\n");

  document.getElementById("customChordName").value = "";
  clearDiagram();
  renderFingeringDiagram();
  updateStartFretDisplay();

  renderCustomChords();
}

// --- 移除自定義和弦 ---
export async function deleteCustomChord(chordName) {
  if (await showConfirm(`確定要刪除 ${chordName} 和弦嗎？`)) {
    delete customChords[chordName];
    sessionStorage.setItem("customChords", JSON.stringify(customChords));


    const textarea = document.getElementById("editorTextarea");
    const currentContent = textarea.value;
    const lines = currentContent.split("\n");
    const filteredLines = lines.filter(
      (line) => !line.trim().startsWith(`@${chordName}:`)
    );

    textarea.value = filteredLines.join("\n");

    renderCustomChords();
  }
}

// --- 自定義和弦面板 ---
export function renderCustomChords() {
  const customChordGrid = document.getElementById("customChordGrid");
  customChordGrid.innerHTML = "";

  Object.keys(customChords).forEach((chordName) => {
    const btn = document.createElement("button");
    btn.className = "custom-chord-btn";
    btn.textContent = chordName;

    // 刪除按鈕
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      await deleteCustomChord(chordName);
    };
    btn.appendChild(deleteBtn);

    // 和弦按鈕
    btn.onclick = () => insertChord(chordName);
    customChordGrid.appendChild(btn);
  });
}

// --- 載入自定義和弦 ---
export function loadCustomChords() {
  const saved = sessionStorage.getItem("customChords");
  if (saved) {
    try {
      customChords = JSON.parse(saved);
      renderCustomChords();
    } catch (e) {
      console.log("自定義和弦載入失敗");
    }
  }
}

// --- 從樂譜解析自定義和弦 ---
export function loadCustomChordsFromText(text) {
  const lines = text.split("\n");
  const newCustomChords = {};

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("@")) {
      const match = trimmedLine.match(/^@([^:]+):\s*(.*)$/);
      if (match) {
        const chordName = match[1].trim();
        const fingeringStr = match[2].trim();
        try {
          const fingering = fingeringStr.split(",").map((s) => {
            const val = s.trim();
            return val === "-1" ? -1 : parseInt(val);
          });

          if (
            fingering.length === 6 &&
            fingering.every(
              (f) => Number.isInteger(f) && f >= -1 && f <= 12
            )
          ) {
            newCustomChords[chordName] = fingering;
          }
        } catch (e) {
          console.log(`解析指法失敗: ${line}`);
        }
      }
    }
  });

  
  customChords = { ...customChords, ...newCustomChords };// 寫入新和弦
  sessionStorage.setItem("customChords", JSON.stringify(customChords)); // 儲存到 sessionStorage
  renderCustomChords(); // 重新渲染按鈕
}
