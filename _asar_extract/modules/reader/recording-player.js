const ICONS = {
  play: `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path>
    </svg>
  `,
  pause: `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="7" y="6" width="3.5" height="12" rx="1"></rect>
      <rect x="13.5" y="6" width="3.5" height="12" rx="1"></rect>
    </svg>
  `,
  trash: `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
      <path d="M3 6h18"></path>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  `,
};

const MIN_TRUSTED_DURATION_SEC = 0.5;
const RECORDING_BITRATE = 256000;
const SEEK_SETTLE_TOLERANCE_SEC = 0.35;
const SEEK_WATCHDOG_MS = 600;

function fmtTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function setIcon(el, iconName) {
  if (!el) return;
  el.innerHTML = ICONS[iconName] || "";
}

function estimateDurationMsFromBlob(blob) {
  if (!blob?.size) return 0;
  // WAV: 16-bit mono 48kHz ≈ 768kbps; WebM/Opus recordings ≈ 256kbps
  const bitrate = blob.type?.startsWith('audio/wav') ? 768000 : RECORDING_BITRATE;
  return Math.max(0, Math.round((blob.size * 8 / bitrate) * 1000));
}

function getAudioDurationSec(audio) {
  const d = audio.duration;
  if (Number.isFinite(d) && d >= MIN_TRUSTED_DURATION_SEC) return d;
  if (audio.seekable && audio.seekable.length > 0) {
    const end = audio.seekable.end(audio.seekable.length - 1);
    if (Number.isFinite(end) && end >= MIN_TRUSTED_DURATION_SEC) return end;
  }
  return 0;
}

export function createRecordingPlayer({
  listEl,
  canInteract,
  onDelete,
  onPatchDuration,
}) {
  let objectUrls = [];
  let players = new Map();
  let activeSeek = null;
  let currentPlayingId = null;
  let suppressClickUntil = 0;

  const resolveDurationMs = (player) => {
    const storedMs = player.durationMs || 0;
    const fromAudioMs = Math.round(getAudioDurationSec(player.audio) * 1000);
    return Math.max(storedMs, fromAudioMs);
  };

  const updatePlayerTime = (player) => {
    const totalMs = resolveDurationMs(player);
    if (totalMs > (player.durationMs || 0)) {
      player.durationMs = totalMs;
      onPatchDuration?.(player.recordingId, totalMs);
    }
    const pendingMs = Number.isFinite(player._pendingVisualSeekRatio)
      ? (player._pendingVisualSeekRatio * totalMs)
      : null;
    const currentMs = player.audio.currentTime * 1000;
    const hasProgress = currentMs > 30;
    const displayMs = !player.audio.paused
      ? currentMs
      : (pendingMs ?? (hasProgress ? currentMs : totalMs));
    player.timeEl.textContent = fmtTime(displayMs);
  };

  const pauseAll = (exceptId = null, reset = true) => {
    players.forEach((player, id) => {
      if (exceptId != null && id === exceptId) return;
      player.audio.pause();
      setIcon(player.playBtn, "play");
      if (reset) {
        player.audio.currentTime = 0;
        player.fillEl.style.width = "0%";
      }
      updatePlayerTime(player);
    });
    if (exceptId == null) currentPlayingId = null;
  };

  const pauseCurrentPlaying = (exceptId = null, reset = false) => {
    if (currentPlayingId == null || currentPlayingId === exceptId) return;
    const player = players.get(currentPlayingId);
    if (!player) {
      currentPlayingId = null;
      return;
    }
    player.audio.pause();
    setIcon(player.playBtn, "play");
    if (reset) {
      player.audio.currentTime = 0;
      player.fillEl.style.width = "0%";
    }
    updatePlayerTime(player);
    currentPlayingId = null;
  };

  const clearPendingSeekState = (player) => {
    if (!player) return;
    player._pendingVisualSeekRatio = null;
    player._pendingVisualSeekStartedAt = 0;
    player._pendingSeekTime = null;
    if (player._pendingSeekWatchdogId != null) {
      clearTimeout(player._pendingSeekWatchdogId);
      player._pendingSeekWatchdogId = null;
    }
  };

  const syncFillFromAudio = (player) => {
    const durSec = resolveDurationMs(player) / 1000;
    if (durSec > 0) {
      const ratio = Math.min(1, Math.max(0, player.audio.currentTime / durSec));
      player.fillEl.style.width = `${ratio * 100}%`;
    } else {
      player.fillEl.style.width = "0%";
    }
  };

  const isSeekSettled = (player) => {
    if (!player || !Number.isFinite(player._pendingVisualSeekRatio)) return true;
    const durSec = resolveDurationMs(player) / 1000;
    if (!Number.isFinite(durSec) || durSec <= 0) return false;
    const targetTime = Number.isFinite(player._pendingSeekTime)
      ? player._pendingSeekTime
      : (player._pendingVisualSeekRatio * durSec);
    return Math.abs(player.audio.currentTime - targetTime) <= SEEK_SETTLE_TOLERANCE_SEC;
  };

  const settleSeekIfReady = (player, { force = false } = {}) => {
    if (!player || !Number.isFinite(player._pendingVisualSeekRatio)) return true;
    if (activeSeek?.id === player.recordingId) {
      clearPendingSeekState(player);
      return true;
    }
    if (!force && !isSeekSettled(player)) return false;
    clearPendingSeekState(player);
    syncFillFromAudio(player);
    updatePlayerTime(player);
    return true;
  };

  const armSeekWatchdog = (player) => {
    if (!player) return;
    if (player._pendingSeekWatchdogId != null) clearTimeout(player._pendingSeekWatchdogId);
    player._pendingSeekWatchdogId = setTimeout(() => {
      player._pendingSeekWatchdogId = null;
      // 互動 seek 優先流暢度：逾時直接以目前實際位置收斂，不做重轉檔。
      settleSeekIfReady(player, { force: true });
    }, SEEK_WATCHDOG_MS);
  };

  const trySeek = (player, ratio, { applyToAudio = true } = {}) => {
    const durSec = resolveDurationMs(player) / 1000;
    if (!Number.isFinite(durSec) || durSec <= 0) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    const targetTime = durSec * clamped;
    player.fillEl.style.width = `${clamped * 100}%`;
    player.timeEl.textContent = fmtTime(targetTime * 1000);
    if (applyToAudio) {
      player._pendingSeekTime = targetTime;
      player._pendingVisualSeekRatio = clamped;
      player._pendingVisualSeekStartedAt = performance.now();
      player.audio.currentTime = targetTime;
      armSeekWatchdog(player);
    }
  };

  const flushSeekFrame = () => {
    if (!activeSeek) return;
    activeSeek.rafId = null;
    const player = players.get(activeSeek.id);
    if (!player) return;
    const rect = activeSeek.progressEl.getBoundingClientRect();
    if (!rect.width) return;
    activeSeek.progressLeft = rect.left;
    activeSeek.progressWidth = rect.width;
    const ratio = Math.min(1, Math.max(0, (activeSeek.latestClientX - rect.left) / rect.width));
    trySeek(player, ratio, { applyToAudio: false });
  };

  const queueSeekFrame = (clientX) => {
    if (!activeSeek) return;
    activeSeek.latestClientX = clientX;
    if (activeSeek.rafId != null) return;
    activeSeek.rafId = requestAnimationFrame(flushSeekFrame);
  };

  const startSeek = (id, progressEl, clientX, pointerId) => {
    const player = players.get(id);
    if (!player) return;
    const rect = progressEl.getBoundingClientRect();
    if (!rect.width) return;
    clearPendingSeekState(player);
    activeSeek = {
      id,
      progressEl,
      pointerId,
      progressLeft: rect.left,
      progressWidth: rect.width,
      latestClientX: clientX,
      rafId: null,
    };
    try {
      if (pointerId != null) progressEl.setPointerCapture(pointerId);
    } catch (_) {}
    queueSeekFrame(clientX);
    window.addEventListener("pointermove", onSeekMove);
    window.addEventListener("pointerup", endSeek);
    window.addEventListener("pointercancel", endSeek);
  };

  const onSeekMove = (e) => {
    if (!activeSeek) return;
    queueSeekFrame(e.clientX);
  };

  const endSeek = (e) => {
    if (!activeSeek) return;
    const { id, progressEl, pointerId, rafId } = activeSeek;
    if (rafId != null) cancelAnimationFrame(rafId);
    try {
      if (pointerId != null) progressEl.releasePointerCapture(pointerId);
    } catch (_) {}
    const finalClientX = e?.clientX ?? activeSeek.latestClientX;
    const player = players.get(id);
    if (player && finalClientX != null) {
      const rect = progressEl.getBoundingClientRect();
      if (rect.width > 0) {
        trySeek(player, (finalClientX - rect.left) / rect.width, { applyToAudio: true });
      }
    }
    suppressClickUntil = performance.now() + 220;
    activeSeek = null;
    window.removeEventListener("pointermove", onSeekMove);
    window.removeEventListener("pointerup", endSeek);
    window.removeEventListener("pointercancel", endSeek);
  };

  const clear = () => {
    endSeek();
    pauseAll(null, true);
    players.forEach((player) => clearPendingSeekState(player));
    players = new Map();
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
  };

  const renderItem = (item) => {
    const row = document.createElement("div");
    row.className = "recording-item";
    row.dataset.recItem = String(item.id);
    const url = URL.createObjectURL(item.blob);
    objectUrls.push(url);
    const initialMs = Math.max(item.durationMs || 0, estimateDurationMsFromBlob(item.blob));
    row.innerHTML = `
      <div class="recording-player">
        <button type="button" class="btn-icon recording-play-btn" data-rec-play="${item.id}" title="播放或暫停"></button>
        <div class="recording-progress" data-rec-progress="${item.id}">
          <div class="recording-progress-fill" data-rec-progress-fill="${item.id}"></div>
        </div>
        <div class="recording-time" data-rec-time="${item.id}">${fmtTime(initialMs)}</div>
        <button type="button" class="btn-icon recording-delete-btn" data-rec-delete="${item.id}" title="刪除錄音"></button>
      </div>
      <audio preload="auto" src="${url}" data-rec-audio="${item.id}"></audio>
    `;
    const player = {
      recordingId: item.id,
      blob: item.blob,
      durationMs: initialMs,
      audio: row.querySelector(`[data-rec-audio="${item.id}"]`),
      playBtn: row.querySelector(`[data-rec-play="${item.id}"]`),
      timeEl: row.querySelector(`[data-rec-time="${item.id}"]`),
      fillEl: row.querySelector(`[data-rec-progress-fill="${item.id}"]`),
      progressEl: row.querySelector(`[data-rec-progress="${item.id}"]`),
      _pendingSeekTime: null,
      _pendingVisualSeekRatio: null,
      _pendingVisualSeekStartedAt: 0,
      _pendingSeekWatchdogId: null,
    };
    players.set(item.id, player);
    setIcon(player.playBtn, "play");
    setIcon(row.querySelector(`[data-rec-delete="${item.id}"]`), "trash");

    player.audio.addEventListener("loadedmetadata", () => updatePlayerTime(player));
    player.audio.addEventListener("durationchange", () => updatePlayerTime(player));
    player.audio.addEventListener("seeked", () => {
      settleSeekIfReady(player, { force: true });
    });
    player.audio.addEventListener("play", () => {
      pauseCurrentPlaying(item.id, false);
      currentPlayingId = item.id;
      setIcon(player.playBtn, "pause");
      updatePlayerTime(player);
    });
    player.audio.addEventListener("pause", () => {
      if (currentPlayingId === item.id && !player.audio.ended) setIcon(player.playBtn, "play");
      updatePlayerTime(player);
    });
    player.audio.addEventListener("timeupdate", () => {
      if (activeSeek?.id === item.id) return;
      if (Number.isFinite(player._pendingVisualSeekRatio)) return;
      syncFillFromAudio(player);
      updatePlayerTime(player);
    });
    player.audio.addEventListener("ended", () => {
      clearPendingSeekState(player);
      setIcon(player.playBtn, "play");
      player.fillEl.style.width = "0%";
      if (currentPlayingId === item.id) currentPlayingId = null;
      updatePlayerTime(player);
    });

    return row;
  };

  const render = (items) => {
    clear();
    if (!items.length) {
      listEl.innerHTML = `<div class="recordings-empty">暫無錄音</div>`;
      return;
    }
    listEl.innerHTML = "";
    items.forEach((item) => listEl.appendChild(renderItem(item)));
  };

  const onClick = async (e) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const deleteBtn = e.target.closest("[data-rec-delete]");
    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.recDelete);
      await onDelete?.(id);
      return;
    }

    const playBtn = e.target.closest("[data-rec-play]");
    if (!playBtn) return;
    if (canInteract && !canInteract()) return;
    const id = Number(playBtn.dataset.recPlay);
    const player = players.get(id);
    if (!player) return;
    if (player.audio.paused) {
      pauseCurrentPlaying(id, true);
      player.audio.play().catch(() => setIcon(player.playBtn, "play"));
    } else {
      player.audio.pause();
      setIcon(player.playBtn, "play");
    }
  };

  const onPointerDown = (e) => {
    const progressEl = e.target.closest("[data-rec-progress]");
    if (!progressEl) return;
    if (canInteract && !canInteract()) return;
    e.preventDefault();
    e.stopPropagation();
    startSeek(Number(progressEl.dataset.recProgress), progressEl, e.clientX, e.pointerId);
  };

  listEl.addEventListener("click", onClick);
  listEl.addEventListener("pointerdown", onPointerDown);

  return {
    render,
    pauseAll: () => pauseAll(null, false),
    stopAll: () => pauseAll(null, true),
    destroy: () => {
      listEl.removeEventListener("click", onClick);
      listEl.removeEventListener("pointerdown", onPointerDown);
      clear();
    },
  };
}

