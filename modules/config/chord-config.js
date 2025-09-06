export const COMMON_CHORDS = [
    "C", "D", "E", "F", "G", "A", "B",
    "Am", "Bm", "Cm", "Dm", "Em", "Fm", "Gm",
    "C7", "D7", "E7", "F7", "G7", "A7", "B7",
    "Cmaj7", "Dmaj7", "Emaj7", "Fmaj7", "Gmaj7", "Amaj7", "Bmaj7",
    "Am7", "Bm7", "Cm7", "Dm7", "Em7", "Fm7", "Gm7",
    "Csus4", "Dsus4", "Esus4", "Fsus4", "Gsus4", "Asus4", "Bsus4",
    "N.C."
  ];

export const CHORD_MAP = {
    'C': 0, 'C#': 1, 'D♭': 1, 'D': 2, 'D#': 3, 'E♭': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G♭': 6, 'G': 7, 'G#': 8, 'A♭': 8, 'A': 9, 'A#': 10, 'B♭': 10, 'B': 11
  };
  
export const CHORD_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHORD_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const CHORD_NAMES = CHORD_NAMES_SHARP; // Default to sharp