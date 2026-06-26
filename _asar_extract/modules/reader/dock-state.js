const KEY = "readerDockState";

/** @returns {{ tuner: boolean, recordings: boolean }} */
export function loadDockState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { tuner: false, recordings: false };
    const p = JSON.parse(raw);
    return {
      tuner: p.tuner === true,
      recordings: p.recordings === true,
    };
  } catch {
    return { tuner: false, recordings: false };
  }
}

/** @param {"tuner" | "recordings"} panel */
export function setDockPanelOpen(panel, isOpen) {
  const state = loadDockState();
  state[panel] = isOpen;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("無法寫入 dock 面板狀態：", e);
  }
}
