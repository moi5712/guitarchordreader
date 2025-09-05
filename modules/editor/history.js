let editorHistory = [];
let historyIndex = -1;

export function saveToHistory() {
  const content = document.getElementById("editorTextarea").value;
  if (historyIndex < editorHistory.length - 1) {
    editorHistory = editorHistory.slice(0, historyIndex + 1);
  }
  editorHistory.push(content);
  if (editorHistory.length > 50) {
    editorHistory.shift();
  } else {
    historyIndex++;
  }
}

export function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    document.getElementById("editorTextarea").value =
      editorHistory[historyIndex];
  }
}

export function redo() {
  if (historyIndex < editorHistory.length - 1) {
    historyIndex++;
    document.getElementById("editorTextarea").value =
      editorHistory[historyIndex];
  }
}

export function getHistory() {
    return {
        editorHistory,
        historyIndex
    }
}
