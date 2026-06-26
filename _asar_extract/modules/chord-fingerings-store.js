/** 預設和弦指法（由外部 chords.json 載入，非內建於程式邏輯） */
let defaultChordFingerings = Object.create(null);

export function setDefaultChordFingerings(obj) {
  defaultChordFingerings =
    obj && typeof obj === "object" && !Array.isArray(obj) ? obj : Object.create(null);
}

export function getDefaultChordFingerings() {
  return defaultChordFingerings;
}
