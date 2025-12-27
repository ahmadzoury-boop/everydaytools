(() => {
  const els = {
    time: document.getElementById("time"),
    phaseLabel: document.getElementById("phaseLabel"),
    roundLabel: document.getElementById("roundLabel"),
    startPauseBtn: document.getElementById("startPauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    skipBtn: document.getElementById("skipBtn"),
    rounds: document.getElementById("rounds"),
    workSec: document.getElementById("workSec"),
    restSec: document.getElementById("restSec"),
    classicBtn: document.getElementById("classicBtn"),
  };

  const STORAGE_KEY = "toolstack_tabata_v1";

  let cfg = { rounds: 8, workSec: 20, restSec: 10 };

  let running = false;
  let phase = "ready"; // ready | work | rest | done
  let currentRound = 0;
  let remainingSec = 0;
  let endsAt = null;
  let tickHandle = null;

  // Audio (non-blocking unlock)
  let audioCtx = null;
  function ensureAudioUnlocked() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    } catch {}
  }
  function beep(freq = 880, ms = 180) {
    try {
      if (!audioCtx || audioCtx.state === "suspended") return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const now = audioCtx.currentTime;

      o.type = "sine";
      o.frequency.value = freq;

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);

      o.connect(g); g.connect(audioCtx.destination);
      o.start(now);
      o.stop(now + ms / 1000 + 0.02);
    } catch {}
  }

  function clampInt(val, min, max, fallback) {
    const n = Number.parseInt(String(val), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function saveCfg() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function loadCfg() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      cfg.rounds = clampInt(parsed.rounds, 1, 60, cfg.rounds);
      cfg.workSec = clampInt(parsed.workSec, 5, 3600, cfg.workSec);
      cfg.restSec = clampInt(parsed.restSec, 0, 3600, cfg.restSec);
    } catch {}
  }

  function formatMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function applyInputsToCfg() {
    cfg.rounds = clampInt(els.rounds.value, 1, 60, 8);
    cfg.workSec = clampInt(els.workSec.value, 5, 3600, 20);
    cfg.restSec = clampInt(els.restSec.value, 0, 3600, 10);

    els.rounds.value = cfg.rounds;
    els.workSec.value = cfg.workSec;
    els.restSec.value = cfg.restSec;

    saveCfg();
  }

  function render() {
    els.time.textContent = formatMMSS(remainingSec);

    const phaseName =
      phase === "work" ? "Work" :
      phase === "rest" ? "Rest" :
      phase === "done" ? "Done" : "Ready";

    els.phaseLabel.textContent = phaseName;
    els.roundLabel.textContent = `Round: ${currentRound} / ${cfg.rounds}`;
    els.startPauseBtn.textContent = running ? "Pause" : "Start";
    document.title = `${formatMMSS(remainingSec)} — Tabata (${phaseName})`;
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
        advance();
        return;
      }
      render();
    }, 200);
  }

  function setPhase(newPhase, sec, beepFreq) {
    phase = newPhase;
    remainingSec = sec;
    render();
    if (beepFreq) beep(beepFreq, 160);
  }

  function advance() {
    ensureAudioUnlocked();

    if (phase === "ready") {
      currentRound = 1;
      setPhase("work", cfg.workSec, 880);
      return;
    }

    if (phase === "work") {
      if (cfg.restSec > 0) {
        setPhase("rest", cfg.restSec, 660);
      } else {
        if (currentRound >= cfg.rounds) {
          phase = "done";
          remainingSec = 0;
          beep(990, 260); beep(990, 260);
          render();
        } else {
          currentRound += 1;
          setPhase("work", cfg.workSec, 880);
        }
      }
      return;
    }

    if (phase === "rest") {
      if (currentRound >= cfg.rounds) {
        phase = "done";
        remainingSec = 0;
        beep(990, 260); beep(990, 260);
        render();
      } else {
        currentRound += 1;
        setPhase("work", cfg.workSec, 880);
      }
      return;
    }

    if (phase === "done") {
      phase = "ready";
      currentRound = 0;
      remainingSec = cfg.workSec;
      render();
    }
  }

  function start() {
    ensureAudioUnlocked();

    if (phase === "ready") {
      applyInputsToCfg();
      remainingSec = cfg.workSec;
      render();
    }
    if (phase === "done") {
      phase = "ready";
      currentRound = 0;
      remainingSec = cfg.workSec;
      render();
    }
    if (remainingSec <= 0) advance();

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
    applyInputsToCfg();
    pause();
    phase = "ready";
    currentRound = 0;
    remainingSec = cfg.workSec;
    render();
  }

  function skip() {
    pause();
    advance();
  }

  function setClassic() {
    ensureAudioUnlocked();
    els.rounds.value = 8;
    els.workSec.value = 20;
    els.restSec.value = 10;
    applyInputsToCfg();
    reset();
  }

  function init() {
    loadCfg();
    els.rounds.value = cfg.rounds;
    els.workSec.value = cfg.workSec;
    els.restSec.value = cfg.restSec;

    phase = "ready";
    currentRound = 0;
    remainingSec = cfg.workSec;

    els.startPauseBtn.addEventListener("click", () => (running ? pause() : start()));
    els.resetBtn.addEventListener("click", reset);
    els.skipBtn.addEventListener("click", skip);
    els.classicBtn.addEventListener("click", setClassic);

    ["change", "blur"].forEach(evt => {
      els.rounds.addEventListener(evt, applyInputsToCfg);
      els.workSec.addEventListener(evt, applyInputsToCfg);
      els.restSec.addEventListener(evt, applyInputsToCfg);
    });

    window.addEventListener("keydown", (e) => {
      const tag = e.target?.tagName?.toLowerCase?.() || "";
      if (tag === "input" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        running ? pause() : start();
      } else if (e.key.toLowerCase() === "r") {
        reset();
      } else if (e.key.toLowerCase() === "n") {
        skip();
      }
    });

    render();
  }

  init();
})();
