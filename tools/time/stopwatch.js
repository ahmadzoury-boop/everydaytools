(() => {
  const els = {
    time: document.getElementById("time"),
    statusLabel: document.getElementById("statusLabel"),
    lapCount: document.getElementById("lapCount"),
    startPauseBtn: document.getElementById("startPauseBtn"),
    lapBtn: document.getElementById("lapBtn"),
    resetBtn: document.getElementById("resetBtn"),
    copyBtn: document.getElementById("copyBtn"),
    clearLapsBtn: document.getElementById("clearLapsBtn"),
    laps: document.getElementById("laps"),
  };

  let running = false;
  let startPerf = 0;          // performance.now() reference
  let elapsedMs = 0;          // total elapsed in ms when paused
  let rafId = null;

  let lapTotals = [];         // total times (ms) at each lap
  let lastLapTotal = 0;

  function pad2(n) { return String(n).padStart(2, "0"); }

  // Format: HH:MM:SS.CS (centiseconds)
  function formatTime(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalS = Math.floor(totalCs / 100);
    const s = totalS % 60;
    const totalM = Math.floor(totalS / 60);
    const m = totalM % 60;
    const h = Math.floor(totalM / 60);
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
  }

  function renderTime() {
    els.time.textContent = formatTime(elapsedMs);
    els.statusLabel.textContent = running ? "Running" : (elapsedMs > 0 ? "Paused" : "Ready");
    els.startPauseBtn.textContent = running ? "Pause" : "Start";
    els.lapCount.textContent = `Laps: ${lapTotals.length}`;
    document.title = `${formatTime(elapsedMs)} — Stopwatch`;
  }

  function tick() {
    if (!running) return;
    const now = performance.now();
    elapsedMs = Math.max(0, now - startPerf);
    renderTime();
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    // continue from paused value
    startPerf = performance.now() - elapsedMs;
    rafId = requestAnimationFrame(tick);
    renderTime();
  }

  function pause() {
    if (!running) return;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    // freeze elapsedMs based on now
    elapsedMs = Math.max(0, performance.now() - startPerf);
    renderTime();
  }

  function reset() {
    pause();
    elapsedMs = 0;
    lapTotals = [];
    lastLapTotal = 0;
    renderLaps();
    renderTime();
  }

  function addLap() {
    if (!running && elapsedMs === 0) return;

    // ensure elapsedMs is current even if user clicks Lap while running
    const current = running ? Math.max(0, performance.now() - startPerf) : elapsedMs;

    lapTotals.push(current);
    renderLaps();
    renderTime();
  }

  function clearLaps() {
    lapTotals = [];
    lastLapTotal = 0;
    renderLaps();
    renderTime();
  }

  function renderLaps() {
    if (lapTotals.length === 0) {
      els.laps.innerHTML = `
        <div style="padding:12px; color:var(--muted); background:rgba(0,0,0,.18);">
          No laps yet.
        </div>`;
      return;
    }

    // Build rows newest first
    let html = `<div style="display:grid; grid-template-columns: 70px 1fr 1fr; gap:0; border-bottom:1px solid var(--border); background:rgba(0,0,0,.18); color:var(--muted); font-weight:700;">
      <div style="padding:10px 12px;">Lap</div>
      <div style="padding:10px 12px;">Split</div>
      <div style="padding:10px 12px;">Total</div>
    </div>`;

    let prev = 0;
    for (let i = 0; i < lapTotals.length; i++) {
      const total = lapTotals[i];
      const split = total - prev;
      prev = total;
      const lapNum = i + 1;

      html += `<div style="display:grid; grid-template-columns: 70px 1fr 1fr; border-bottom:1px solid var(--border);">
        <div style="padding:10px 12px; font-weight:800;">${lapNum}</div>
        <div style="padding:10px 12px; color:var(--muted);">${formatTime(split)}</div>
        <div style="padding:10px 12px;">${formatTime(total)}</div>
      </div>`;
    }

    els.laps.innerHTML = html;
  }

  async function copyLaps() {
    if (lapTotals.length === 0) return;

    let prev = 0;
    const lines = lapTotals.map((total, idx) => {
      const split = total - prev;
      prev = total;
      return `Lap ${idx + 1}: Split ${formatTime(split)} | Total ${formatTime(total)}`;
    });

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      els.copyBtn.textContent = "Copied!";
      setTimeout(() => (els.copyBtn.textContent = "Copy laps"), 900);
    } catch {
      // fallback: prompt
      window.prompt("Copy laps:", text);
    }
  }

  // Events
  els.startPauseBtn.addEventListener("click", () => (running ? pause() : start()));
  els.lapBtn.addEventListener("click", addLap);
  els.resetBtn.addEventListener("click", reset);
  els.copyBtn.addEventListener("click", copyLaps);
  els.clearLapsBtn.addEventListener("click", clearLaps);

  // Keyboard shortcuts: Space = start/pause, L = lap, R = reset
  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName?.toLowerCase?.() || "";
    if (tag === "input" || tag === "textarea") return;

    if (e.code === "Space") {
      e.preventDefault();
      running ? pause() : start();
    } else if (e.key.toLowerCase() === "l") {
      addLap();
    } else if (e.key.toLowerCase() === "r") {
      reset();
    }
  });

  // Initial render
  renderLaps();
  renderTime();
})();
