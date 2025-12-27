(() => {
  const LS_KEY = "time_calc_v1";

  const modeEl = document.getElementById("mode");
  const opWrap = document.getElementById("opWrap");
  const baseWrap = document.getElementById("baseWrap");
  const panelAddSub = document.getElementById("panelAddSub");
  const panelSum = document.getElementById("panelSum");

  const opEl = document.getElementById("op");
  const baseTimeEl = document.getElementById("baseTime");
  const showSecondsEl = document.getElementById("showSeconds");

  const dhEl = document.getElementById("dh");
  const dmEl = document.getElementById("dm");
  const dsEl = document.getElementById("ds");
  const durationPresetEl = document.getElementById("durationPreset");

  const calcBtn = document.getElementById("calcBtn");
  const swapBtn = document.getElementById("swapBtn");
  const resetBtn = document.getElementById("resetBtn");
  const copyBtn = document.getElementById("copyBtn");

  const resultText = document.getElementById("resultText");
  const resultNote = document.getElementById("resultNote");

  const rowsWrap = document.getElementById("rows");
  const addRowBtn = document.getElementById("addRowBtn");
  const clearRowsBtn = document.getElementById("clearRowsBtn");
  const copySumBtn = document.getElementById("copySumBtn");
  const sumText = document.getElementById("sumText");
  const sumMeta = document.getElementById("sumMeta");

  function clampInt(v, min, max = Infinity) {
    v = Number(v);
    if (!Number.isFinite(v)) v = min;
    v = Math.floor(v);
    v = Math.max(min, v);
    v = Math.min(max, v);
    return v;
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatHMS(totalSeconds, force) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (force === "hm") return `${pad2(h)}:${pad2(m)}`;
    if (force === "hms") return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;

    // auto: show seconds only if non-zero
    return s === 0 ? `${pad2(h)}:${pad2(m)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  // Parse "HH:MM" or "HH:MM:SS" (clock time)
  function parseClock(str) {
    if (!str) return null;
    const t = String(str).trim();
    const parts = t.split(":").map(x => x.trim());
    if (parts.length < 2 || parts.length > 3) return null;

    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const s = parts.length === 3 ? Number(parts[2]) : 0;

    if (![h, m, s].every(Number.isFinite)) return null;
    if (h < 0 || m < 0 || s < 0) return null;
    if (m > 59 || s > 59) return null;

    // Allow 0–23 normally; if user types 24+ we still accept but will wrap
    return (Math.floor(h) * 3600) + (Math.floor(m) * 60) + Math.floor(s);
  }

  function normalizeDaySeconds(sec) {
    const DAY = 86400;
    const dayOffset = Math.floor(sec / DAY);
    const norm = ((sec % DAY) + DAY) % DAY;
    return { norm, dayOffset };
  }

  function calcAddSub() {
    const base = parseClock(baseTimeEl.value);
    if (base === null) {
      resultText.textContent = "Result: Invalid base time";
      resultNote.textContent = "Use HH:MM or HH:MM:SS (e.g., 14:30 or 14:30:15).";
      return;
    }

    const dh = clampInt(dhEl.value, 0);
    const dm = clampInt(dmEl.value, 0);
    const ds = clampInt(dsEl.value, 0);
    const dur = dh * 3600 + dm * 60 + ds;

    const sign = (opEl.value === "sub") ? -1 : 1;
    const raw = base + sign * dur;

    const { norm, dayOffset } = normalizeDaySeconds(raw);

    const h = Math.floor(norm / 3600);
    const m = Math.floor((norm % 3600) / 60);
    const s = norm % 60;

    const dispMode = showSecondsEl.value; // auto, hms, hm
    let force = "auto";
    if (dispMode === "hms") force = "hms";
    if (dispMode === "hm") force = "hm";

    const out = formatHMS(h * 3600 + m * 60 + s, force);

    resultText.textContent = `Result: ${out}`;

    if (dayOffset === 0) {
      resultNote.textContent = `Base ${baseTimeEl.value.trim()} ${opEl.value === "sub" ? "−" : "+"} ${formatHMS(dur, "hms")} = same day`;
    } else if (dayOffset > 0) {
      resultNote.textContent = `Crossed midnight: next day (+${dayOffset})`;
    } else {
      resultNote.textContent = `Crossed midnight: previous day (${dayOffset})`;
    }
  }

  // ---- Sum durations mode
  function createRow(h = 0, m = 0, s = 0) {
    const row = document.createElement("div");
    row.className = "durRow";

    row.innerHTML = `
      <div>
        <label>Hours</label>
        <input type="number" min="0" value="${h}">
      </div>
      <div>
        <label>Minutes</label>
        <input type="number" min="0" value="${m}">
      </div>
      <div>
        <label>Seconds</label>
        <input type="number" min="0" value="${s}">
      </div>
      <button title="Remove">Remove</button>
    `;

    const inputs = row.querySelectorAll("input");
    const removeBtn = row.querySelector("button");

    inputs.forEach(inp => {
      inp.addEventListener("input", () => { save(); renderSum(); });
      inp.addEventListener("change", () => { save(); renderSum(); });
    });

    removeBtn.addEventListener("click", () => {
      row.remove();
      save();
      renderSum();
    });

    return row;
  }

  function getRows() {
    return Array.from(rowsWrap.querySelectorAll(".durRow"));
  }

  function sumSeconds() {
    let total = 0;
    for (const row of getRows()) {
      const ins = row.querySelectorAll("input");
      const h = clampInt(ins[0].value, 0);
      const m = clampInt(ins[1].value, 0);
      const s = clampInt(ins[2].value, 0);
      total += h * 3600 + m * 60 + s;
    }
    return total;
  }

  function renderSum() {
    const total = sumSeconds();
    sumText.textContent = `Total: ${formatHMS(total, "hms")}`;

    const mins = Math.round((total / 60) * 100) / 100;
    sumMeta.textContent = `${total} seconds · ${mins} minutes`;
  }

  // ---- Copy
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // ---- Persist
  function save() {
    const data = {
      mode: modeEl.value,
      op: opEl.value,
      baseTime: baseTimeEl.value,
      showSeconds: showSecondsEl.value,
      dh: clampInt(dhEl.value, 0),
      dm: clampInt(dmEl.value, 0),
      ds: clampInt(dsEl.value, 0),
      rows: getRows().map(r => {
        const ins = r.querySelectorAll("input");
        return {
          h: clampInt(ins[0].value, 0),
          m: clampInt(ins[1].value, 0),
          s: clampInt(ins[2].value, 0),
        };
      }),
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;

      modeEl.value = d.mode || "addsub";
      opEl.value = d.op || "add";
      baseTimeEl.value = d.baseTime || "14:30";
      showSecondsEl.value = d.showSeconds || "auto";

      dhEl.value = clampInt(d.dh, 0);
      dmEl.value = clampInt(d.dm, 0);
      dsEl.value = clampInt(d.ds, 0);

      // rows
      rowsWrap.innerHTML = "";
      if (Array.isArray(d.rows) && d.rows.length) {
        d.rows.forEach(x => rowsWrap.appendChild(createRow(x.h || 0, x.m || 0, x.s || 0)));
      }
    } catch {}
  }

  // ---- Mode switching
  function setMode(mode) {
    const sumMode = mode === "sum";

    panelAddSub.classList.toggle("hidden", sumMode);
    panelSum.classList.toggle("hidden", !sumMode);

    opWrap.classList.toggle("hidden", sumMode);
    baseWrap.classList.toggle("hidden", sumMode);

    save();
    if (sumMode) renderSum();
  }

  // ---- Events
  modeEl.addEventListener("change", () => setMode(modeEl.value));

  [opEl, baseTimeEl, showSecondsEl, dhEl, dmEl, dsEl].forEach(el => {
    el.addEventListener("input", () => save());
    el.addEventListener("change", () => save());
  });

  durationPresetEl.addEventListener("change", () => {
    const v = durationPresetEl.value;
    if (!v) return;
    const parts = v.split(":").map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      dhEl.value = parts[0];
      dmEl.value = parts[1];
      dsEl.value = parts[2];
      save();
      calcAddSub();
    }
    durationPresetEl.value = "";
  });

  calcBtn.addEventListener("click", () => { save(); calcAddSub(); });

  swapBtn.addEventListener("click", () => {
    opEl.value = (opEl.value === "add") ? "sub" : "add";
    save();
    calcAddSub();
  });

  resetBtn.addEventListener("click", () => {
    opEl.value = "add";
    baseTimeEl.value = "14:30";
    showSecondsEl.value = "auto";
    dhEl.value = 1;
    dmEl.value = 15;
    dsEl.value = 0;

    resultText.textContent = "Result: —";
    resultNote.textContent = "";
    save();
  });

  copyBtn.addEventListener("click", async () => {
    const text = resultText.textContent.replace(/^Result:\s*/i, "").trim();
    if (!text || text === "—") return;
    await copyText(text);
  });

  addRowBtn.addEventListener("click", () => {
    rowsWrap.appendChild(createRow(0, 0, 0));
    save();
    renderSum();
  });

  clearRowsBtn.addEventListener("click", () => {
    rowsWrap.innerHTML = "";
    rowsWrap.appendChild(createRow(0, 0, 0));
    save();
    renderSum();
  });

  copySumBtn.addEventListener("click", async () => {
    await copyText(sumText.textContent.replace(/^Total:\s*/i, "").trim());
  });

  // Shortcuts
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Enter" && modeEl.value === "addsub") {
      e.preventDefault();
      calcAddSub();
    }
    if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      resetBtn.click();
    }
  });

  // Init
  load();

  // Ensure there is at least 1 duration row in sum mode
  if (getRows().length === 0) rowsWrap.appendChild(createRow(0, 0, 0));

  setMode(modeEl.value);
  renderSum();
})();
