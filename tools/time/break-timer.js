(() => {
  const LS_KEY = "break_timer_v1";

  const timeEl = document.getElementById("time");
  const phaseEl = document.getElementById("phase");
  const fillEl = document.getElementById("fill");

  const cycleEl = document.getElementById("cycle");
  const cycleTotalEl = document.getElementById("cycleTotal");
  const modeLabelEl = document.getElementById("modeLabel");

  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const soundBtn = document.getElementById("soundBtn");
  const fsBtn = document.getElementById("fsBtn");

  const prepareIn = document.getElementById("prepare");
  const workIn = document.getElementById("work");
  const breakIn = document.getElementById("breakMin");
  const cyclesIn = document.getElementById("cycles");
  const autoStartIn = document.getElementById("autoStart");
  const notifyIn = document.getElementById("notify");

  // ---- Beep
  let audioCtx = null;
  let soundOn = true;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }

  function beep(freq = 880, duration = 0.08) {
    if (!soundOn) return;
    ensureAudio();
    if (!audioCtx) return;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + duration + 0.02);
  }

  function tripleBeep() {
    beep(880, 0.07);
    setTimeout(() => beep(880, 0.07), 120);
    setTimeout(() => beep(880, 0.07), 240);
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function clampInt(v, min, max = Infinity) {
    v = Number(v);
    if (!Number.isFinite(v)) v = min;
    v = Math.floor(v);
    v = Math.max(min, v);
    v = Math.min(max, v);
    return v;
  }

  // ---- Notifications
  async function maybeNotify(title, body) {
    if (notifyIn.value !== "on") return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    if (Notification.permission !== "granted") return;

    try { new Notification(title, { body }); } catch {}
  }

  // ---- Settings save/load
  function readSettings() {
    return {
      prepare: clampInt(prepareIn.value, 0, 3600),
      workMin: clampInt(workIn.value, 1, 1440),
      breakMin: clampInt(breakIn.value, 1, 1440),
      cycles: clampInt(cyclesIn.value, 0, 1000), // 0 = infinite
      autoStart: !!autoStartIn.checked,
      notify: notifyIn.value || "off",
    };
  }

  function saveSettings() {
    const s = readSettings();
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return;

      prepareIn.value = clampInt(s.prepare, 0, 3600);
      workIn.value = clampInt(s.workMin, 1, 1440);
      breakIn.value = clampInt(s.breakMin, 1, 1440);
      cyclesIn.value = String(clampInt(s.cycles, 0, 1000));
      autoStartIn.checked = !!s.autoStart;
      notifyIn.value = (s.notify === "on") ? "on" : "off";
    } catch {}
  }

  // ---- Timer state
  let settings = readSettings();
  let intervalId = null;
  let running = false;

  // phases: IDLE -> PREPARE -> WORK -> BREAK -> ... -> DONE
  let phase = "IDLE";
  let phaseTotal = 0;
  let remaining = 0;

  let cycle = 0; // completed cycles
  let isWork = true; // within cycle

  function setUI() {
    timeEl.textContent = formatTime(remaining);

    if (phase === "IDLE") phaseEl.textContent = "Idle";
    if (phase === "PREPARE") phaseEl.textContent = "Prepare";
    if (phase === "WORK") phaseEl.textContent = "Work";
    if (phase === "BREAK") phaseEl.textContent = "Break";
    if (phase === "DONE") phaseEl.textContent = "Done ✅";

    modeLabelEl.textContent = (phase === "BREAK") ? "Break" : "Work";

    cycleEl.textContent = String(cycle);
    cycleTotalEl.textContent = settings.cycles === 0 ? "∞" : String(settings.cycles);

    const pct = phaseTotal > 0 ? ((phaseTotal - remaining) / phaseTotal) * 100 : 0;
    fillEl.style.width = Math.max(0, Math.min(100, pct)) + "%";

    startBtn.textContent =
      running ? "Running…" : (phase === "IDLE" || phase === "DONE") ? "Start" : "Resume";

    pauseBtn.disabled = !running;
  }

  function goPhase(newPhase, seconds) {
    phase = newPhase;
    phaseTotal = Math.max(0, seconds);
    remaining = phaseTotal;

    // beeps + notifications
    if (phase === "WORK") {
      beep(1046, 0.10);
      maybeNotify("Work started", "Focus time.");
    }
    if (phase === "BREAK") {
      beep(659, 0.10);
      maybeNotify("Break started", "Take a short break.");
    }
    if (phase === "DONE") {
      tripleBeep();
      maybeNotify("Finished", "All cycles completed.");
    }

    setUI();
  }

  function nextPhase() {
    const { prepare, workMin, breakMin, cycles } = settings;

    if (phase === "IDLE") {
      cycle = 0;
      isWork = true;
      if (prepare > 0) return goPhase("PREPARE", prepare);
      return goPhase("WORK", workMin * 60);
    }

    if (phase === "PREPARE") {
      return goPhase("WORK", workMin * 60);
    }

    if (phase === "WORK") {
      return goPhase("BREAK", breakMin * 60);
    }

    if (phase === "BREAK") {
      // one full cycle completed after break ends
      cycle += 1;

      if (cycles !== 0 && cycle >= cycles) {
        return goPhase("DONE", 0);
      }

      return goPhase("WORK", workMin * 60);
    }

    if (phase === "DONE") {
      return reset();
    }
  }

  function tick() {
    if (!running) return;

    remaining -= 1;

    // last 3 seconds countdown
    if (remaining > 0 && remaining <= 3 && phase !== "IDLE" && phase !== "DONE") {
      beep(880, 0.06);
    }

    if (remaining <= 0) {
      if (settings.autoStart) {
        nextPhase();
      } else {
        running = false;
        nextPhase(); // move, but stop
      }
    }

    setUI();
  }

  function start() {
    settings = readSettings();
    saveSettings();
    ensureAudio();

    if (phase === "IDLE" || phase === "DONE") {
      goPhase("IDLE", 0);
      nextPhase();
    }

    if (phase === "DONE") return;

    running = true;
    if (!intervalId) intervalId = setInterval(tick, 1000);

    startBtn.disabled = true;
    pauseBtn.disabled = false;
    setUI();
  }

  function pause() {
    running = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    setUI();
  }

  function reset() {
    running = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;

    settings = readSettings();
    phase = "IDLE";
    phaseTotal = 0;
    remaining = 0;

    cycle = 0;
    isWork = true;

    fillEl.style.width = "0%";
    setUI();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }

  // Events
  startBtn.addEventListener("click", () => !running && start());
  pauseBtn.addEventListener("click", pause);
  resetBtn.addEventListener("click", reset);

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = "Sound: " + (soundOn ? "ON" : "OFF");
    if (soundOn) beep(880, 0.08);
  });

  fsBtn.addEventListener("click", toggleFullscreen);

  [prepareIn, workIn, breakIn, cyclesIn, autoStartIn, notifyIn].forEach(el => {
    el.addEventListener("input", () => saveSettings());
    el.addEventListener("change", () => { saveSettings(); settings = readSettings(); setUI(); });
  });

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.code === "Space") { e.preventDefault(); running ? pause() : start(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); reset(); }
    if (e.key.toLowerCase() === "f") { e.preventDefault(); toggleFullscreen(); }
  });

  // Init
  loadSettings();
  settings = readSettings();
  reset();
})();
