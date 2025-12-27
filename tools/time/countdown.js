(() => {
  const els = {
    time: document.getElementById("time"),
    statusLabel: document.getElementById("statusLabel"),
    setLabel: document.getElementById("setLabel"),
    startPauseBtn: document.getElementById("startPauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    stopBtn: document.getElementById("stopBtn"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds"),
    presets: Array.from(document.querySelectorAll(".preset")),
  };

  const STORAGE_KEY = "toolstack_countdown_v1";

  // State
  let running = false;
  let remainingSec = 0;
  let setSec = 5 * 60;
  let endsAt = null;
  let tickHandle = null;

  // --- Audio (unlock by user gesture, but NEVER block timer) ---
  let audioCtx = null;

  function ensureAudioUnlocked() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    } catch {}
  }

  function beep() {
    try {
      if (!audioCtx || audioCtx.state === "suspended") return;

      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      o.type = "sine";
      o.frequency.value = 880;

      const now = audioCtx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      o.connect(g);
      g.connect(audioCtx.destination);

      o.start(now);
      o.stop(now + 0.38);
    } catch {}
  }

  function clampInt(val, min, max, fallback) {
    const n = Number.parseInt(String(val), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function formatHMS(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function readInputsToSetSec() {
    const h = clampInt(els.hours.value, 0, 99, 0);
    const m = clampInt(els.minutes.value, 0, 59, 5);
    const s = clampInt(els.seconds.value, 0, 59, 0);

    els.hours.value = h;
    els.minutes.value = m;
    els.seconds.value = s;

    return Math.max(0, h * 3600 + m * 60 + s);
  }

  function writeSetSecToInputs(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    els.hours.value = h;
    els.minutes.value = m;
    els.seconds.value = s;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setSec }));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.setSec === "number" && parsed.setSec >= 0) {
        setSec = Math.min(parsed.setSec, 99 * 3600 + 59 * 60 + 59);
      }
    } catch {}
  }

  function render() {
    els.time.textContent = formatHMS(remainingSec);
    els.setLabel.textContent = `Set: ${formatHMS(setSec)}`;

    if (running) {
      els.statusLabel.textContent = "Running";
      els.startPauseBtn.textContent = "Pause";
    } else {
      els.statusLabel.textContent = remainingSec === 0 ? "Ready" : "Paused";
      els.startPauseBtn.textContent = "Start";
    }

    document.title = `${formatHMS(remainingSec)} — Countdown`;
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
      if (!running || typeof endsAt !== "number") return;

      const now = Date.now();
      const diff = Math.max(0, Math.round((endsAt - now) / 1000));
      remainingSec = diff;

      if (diff === 0) {
        running = false;
        endsAt = null;
        stopTick();
        beep();
      }

      render();
    }, 200);
  }

  function start() {
    ensureAudioUnlocked(); // safe; never blocks

    if (setSec === 0) return;
    if (remainingSec === 0) remainingSec = setSec;

    running = true;
    endsAt = Date.now() + remainingSec * 1000;
    startTick();
    render();
  }

  function pause() {
    if (!running) return;
    const now = Date.now();
    remainingSec = Math.max(0, Math.round((endsAt - now) / 1000));
    running = false;
    endsAt = null;
    stopTick();
    render();
  }

  function reset() {
    setSec = readInputsToSetSec();
    save();

    pause();
    remainingSec = setSec;
    render();
  }

  function stop() {
    pause();
    remainingSec = 0;
    render();
  }

  function setPreset(sec) {
    ensureAudioUnlocked();

    sec = Math.max(0, Math.min(sec, 99 * 3600 + 59 * 60 + 59));
    setSec = sec;
    save();

    writeSetSecToInputs(setSec);
    pause();
    remainingSec = setSec;
    render();
  }

  function init() {
    load();
    writeSetSecToInputs(setSec);
    remainingSec = setSec;

    // Buttons
    els.startPauseBtn.addEventListener("click", () => (running ? pause() : start()));
    els.resetBtn.addEventListener("click", reset);
    els.stopBtn.addEventListener("click", stop);

    // Inputs save
    ["change", "blur"].forEach((evt) => {
      els.hours.addEventListener(evt, () => { setSec = readInputsToSetSec(); save(); els.setLabel.textContent = `Set: ${formatHMS(setSec)}`; });
      els.minutes.addEventListener(evt, () => { setSec = readInputsToSetSec(); save(); els.setLabel.textContent = `Set: ${formatHMS(setSec)}`; });
      els.seconds.addEventListener(evt, () => { setSec = readInputsToSetSec(); save(); els.setLabel.textContent = `Set: ${formatHMS(setSec)}`; });
    });

    // Presets
    els.presets.forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = Number(btn.getAttribute("data-sec") || "0");
        if (Number.isFinite(sec)) setPreset(sec);
      });
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      const tag = e.target?.tagName?.toLowerCase?.() || "";
      if (tag === "input" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        running ? pause() : start();
      } else if (e.key.toLowerCase() === "r") {
        reset();
      } else if (e.key.toLowerCase() === "s") {
        stop();
      }
    });

    render();
  }

  init();
})();
