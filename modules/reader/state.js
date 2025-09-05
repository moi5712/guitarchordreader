export let song = {
  meta: { title: "", artist: "", key: "", bpm: "", time: "", capo: "" },
  sections: [],
};

export let customChordFingerings = {};
export let playing = false;
export let rafId = null;
export let targets = [];
export let lastTs = null;
export let countdownTimeoutId = null;
export let accumulatedScroll = 0;

export let currentSettings = {
  fontSize: 18,
  lineGap: 14,
  transpose: 0,
  showFingering: false,
  countdownEnabled: false,
  speed: 30
};

export function setSong(newSong) {
    song = newSong;
}

export function setCustomChordFingerings(fingerings) {
    customChordFingerings = fingerings;
}

export function setPlaying(isPlaying) {
    playing = isPlaying;
}

export function setRafId(id) {
    rafId = id;
}

export function setTargets(newTargets) {
    targets = newTargets;
}

export function setLastTs(ts) {
    lastTs = ts;
}

export function setCountdownTimeoutId(id) {
    countdownTimeoutId = id;
}

export function setAccumulatedScroll(scroll) {
    accumulatedScroll = scroll;
}

export function setCurrentSettings(settings) {
    currentSettings = settings;
}
