(() => {
  const els = {
    time: document.getElementById("time"),
    modeLabel: document.getElementById("modeLabel"),
    sessionLabel: document.getElementById("sessionLabel"),
    startPauseBtn: document.getElementById("startPauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    skipBtn: document.getElementById("skipBtn"),
    focusMin: document.getElementById("focusMin"),
    shortMin: document.getElementById("shortMin"),
    longMin: document.getElementById("longMin"),
    longEvery: document.getElementById("longEvery"),
  };

  const STORAGE_KEY = "toolstack_pomodoro_v1";

  const defaultState = {
    focusMin: 25,
    shortMin: 5,
    longMin: 15,
    longEvery: 4,
    mode: "focus",  // focus | short | long
    session: 1,     // focus session number (1-based)
    remainingSec: 25 * 60,
    running: false,
    endsAt: null,
  };

  let state = loadState();
  let tickHandle = null;

  function clampInt(val, min, max, fallback) {
    const n = Number.parseInt(String(val), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      const s = { ...defaultState, ...parsed };

      s.focusMin = clampInt(s.focusMin, 1, 180, 25);
      s.shortMin = clampInt(s.shortMin, 1, 60, 5);
      s.longMin = clampInt(s.longMin, 1, 90, 15);
      s.longEvery = clampInt(s.longEvery, 2, 12, 4);
      if (!["focus", "short", "long"].includes(s.mode)) s.mode = "focus";

      if (s.running && typeof s.endsAt === "number") {
        const now = Date.now();
        const diff = Math.max(0, Math.round((s.endsAt - now) / 1000));
        s.remainingSec = diff;
        if (diff === 0) s.running = false;
      } else {
        s.running = false;
        s.endsAt = null;
      }
      return s;
    } catch {
      return { ...defaultState };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function modeName(mode) {
    if (mode === "focus") return "Focus";
    if (mode === "short") return "Short break";
    return "Long break";
  }

  function durationForMode(mode) {
    if (mode === "focus") return state.focusMin * 60;
    if (mode === "short") return state.shortMin * 60;
    return state.longMin * 60;
  }

  function applyInputsToState() {
    state.focusMin = clampInt(els.focusMin.value, 1, 180, 25);
    state.shortMin = clampInt(els.shortMin.value, 1, 60, 5);
    state.longMin = clampInt(els.longMin.value, 1, 90, 15);
    state.longEvery = clampInt(els.longEvery.value, 2, 12, 4);

    els.focusMin.value = state.focusMin;
    els.shortMin.value = state.shortMin;
    els.longMin.value = state.longMin;
    els.longEvery.value = state.longEvery;

    saveState();
  }

  function render() {
    els.time.textContent = formatTime(state.remainingSec);
    els.modeLabel.textContent = modeName(state.mode);
    els.sessionLabel.textContent = `Session: ${state.session}`;
    els.startPauseBtn.textContent = state.running ? "Pause" : "Start";
    document.title = `${formatTime(state.remainingSec)} — ${modeName(state.mode)} | Pomodoro`;
  }

  function stopTick() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function startTick() {
    stopTick();
    tickHandle = setInterval(() => {
      if (!state.running || typeof state.endsAt !== "number") return;

      const now = Date.now();
      const diff = Math.max(0, Math.round((state.endsAt - now) / 1000));
      state.remainingSec = diff;

      if (diff === 0) {
        state.running = false;
        state.endsAt = null;
        saveState();
        stopTick();
        onFinish();
      } else {
        saveState();
      }
      render();
    }, 250);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.endsAt = Date.now() + state.remainingSec * 1000;
    saveState();
    startTick();
    render();
  }

  function pause() {
    if (!state.running) return;
    const now = Date.now();
    const diff = Math.max(0, Math.round((state.endsAt - now) / 1000));
    state.remainingSec = diff;
    state.running = false;
    state.endsAt = null;
    saveState();
    stopTick();
    render();
  }

  function reset() {
    applyInputsToState();
    pause();
    state.remainingSec = durationForMode(state.mode);
    saveState();
    render();
  }

  function nextMode() {
    if (state.mode === "focus") {
      const shouldLong = (state.session % state.longEvery === 0);
      state.mode = shouldLong ? "long" : "short";
      state.remainingSec = durationForMode(state.mode);
    } else {
      state.mode = "focus";
      state.session += 1;
      state.remainingSec = durationForMode("focus");
    }
    saveState();
    render();
  }

  function onFinish() {
    // tiny beep
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 220);
    } catch {}
    nextMode(); // advance but don’t auto-start
  }

  function init() {
    els.focusMin.value = state.focusMin;
    els.shortMin.value = state.shortMin;
    els.longMin.value = state.longMin;
    els.longEvery.value = state.longEvery;

    if (!state.running && (state.remainingSec <= 0 || state.remainingSec > 86400)) {
      state.remainingSec = durationForMode(state.mode);
    }

    els.startPauseBtn.addEventListener("click", () => {
      state.running ? pause() : start();
    });
    els.resetBtn.addEventListener("click", reset);
    els.skipBtn.addEventListener("click", () => {
      pause();
      nextMode();
    });

    ["change", "blur"].forEach(evt => {
      els.focusMin.addEventListener(evt, applyInputsToState);
      els.shortMin.addEventListener(evt, applyInputsToState);
      els.longMin.addEventListener(evt, applyInputsToState);
      els.longEvery.addEventListener(evt, applyInputsToState);
    });

    window.addEventListener("keydown", (e) => {
      const tag = e.target?.tagName?.toLowerCase?.() || "";
      if (tag === "input" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        state.running ? pause() : start();
      } else if (e.key.toLowerCase() === "r") {
        reset();
      } else if (e.key.toLowerCase() === "n") {
        pause();
        nextMode();
      }
    });

    saveState();
    render();
    if (state.running) startTick();
  }

  init();
})();
