(() => {
  const LS_KEY = "time_diff_v1";

  const modeEl = document.getElementById("mode");
  const crossMidnightEl = document.getElementById("crossMidnight");
  const displayEl = document.getElementById("display");
  const decimalPlacesEl = document.getElementById("decimalPlaces");

  const panelClock = document.getElementById("panelClock");
  const panelDateTime = document.getElementById("panelDateTime");

  const startTimeEl = document.getElementById("startTime");
  const endTimeEl = document.getElementById("endTime");
  const breakMinEl = document.getElementById("breakMin");
  const breakSecEl = document.getElementById("breakSec");

  const startDTEl = document.getElementById("startDT");
  const endDTEl = document.getElementById("endDT");
  const breakMin2El = document.getElementById("breakMin2");
  const breakSec2El = document.getElementById("breakSec2");

  const calcBtn = document.getElementById("calcBtn");
  const swapBtn = document.getElementById("swapBtn");
  const resetBtn = document.getElementById("resetBtn");
  const copyBtn = document.getElementById("copyBtn");

  const durationText = document.getElementById("durationText");
  const detailsText = document.getElementById("detailsText");

  function clampInt(v, min, max = Infinity) {
    v = Number(v);
    if (!Number.isFinite(v)) v = min;
    v = Math.floor(v);
    v = Math.max(min, v);
    v = Math.min(max, v);
    return v;
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatDuration(sec, mode = "hms") {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (mode === "hm") return `${pad2(h)}:${pad2(m)}`;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  // Parse "HH:MM" or "HH:MM:SS" into seconds from 00:00:00
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

    return Math.floor(h) * 3600 + Math.floor(m) * 60 + Math.floor(s);
  }

  function save() {
    const data = {
      mode: modeEl.value,
      cross: crossMidnightEl.value,
      display: displayEl.value,
      decimals: decimalPlacesEl.value,

      startTime: startTimeEl.value,
      endTime: endTimeEl.value,
      breakMin: clampInt(breakMinEl.value, 0),
      breakSec: clampInt(breakSecEl.value, 0),

      startDT: startDTEl.value,
      endDT: endDTEl.value,
      breakMin2: clampInt(breakMin2El.value, 0),
      breakSec2: clampInt(breakSec2El.value, 0),
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;

      modeEl.value = d.mode || "clock";
      crossMidnightEl.value = d.cross || "auto";
      displayEl.value = d.display || "hms";
      decimalPlacesEl.value = d.decimals || "2";

      startTimeEl.value = d.startTime || "09:00";
      endTimeEl.value = d.endTime || "17:30";
      breakMinEl.value = clampInt(d.breakMin, 0);
      breakSecEl.value = clampInt(d.breakSec, 0);

      startDTEl.value = d.startDT || "";
      endDTEl.value = d.endDT || "";
      breakMin2El.value = clampInt(d.breakMin2, 0);
      breakSec2El.value = clampInt(d.breakSec2, 0);
    } catch {}
  }

  function setMode(mode) {
    const isDT = mode === "datetime";
    panelClock.classList.toggle("hidden", isDT);
    panelDateTime.classList.toggle("hidden", !isDT);

    save();
  }

  function calc() {
    save();

    const disp = displayEl.value; // hm or hms
    const decimals = clampInt(decimalPlacesEl.value, 2, 6);

    let diffSec = 0;
    let breakSec = 0;
    let noteParts = [];

    if (modeEl.value === "clock") {
      const s = parseClock(startTimeEl.value);
      const e = parseClock(endTimeEl.value);

      if (s === null || e === null) {
        durationText.textContent = "Duration: Invalid time";
        detailsText.textContent = "Use HH:MM or HH:MM:SS (e.g., 09:00 or 09:00:30).";
        return;
      }

      breakSec = clampInt(breakMinEl.value, 0) * 60 + clampInt(breakSecEl.value, 0);

      let end = e;
      const mode = crossMidnightEl.value;

      if (mode === "auto" && end < s) {
        end += 86400; // next day
        noteParts.push("End time assumed next day (auto).");
      } else if (mode === "next") {
        end += 86400;
        noteParts.push("End time forced next day.");
      } else if (mode === "same") {
        // no change
      }

      diffSec = end - s;

      if (diffSec < 0) {
        durationText.textContent = "Duration: Negative";
        detailsText.textContent = "End time is earlier than start time. Try “assume next day” or swap.";
        return;
      }
    } else {
      // datetime mode
      const sVal = startDTEl.value;
      const eVal = endDTEl.value;

      if (!sVal || !eVal) {
        durationText.textContent = "Duration: —";
        detailsText.textContent = "Pick start and end date/time.";
        return;
      }

      const s = new Date(sVal);
      const e = new Date(eVal);

      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        durationText.textContent = "Duration: Invalid date/time";
        detailsText.textContent = "Please choose valid start and end date/time.";
        return;
      }

      breakSec = clampInt(breakMin2El.value, 0) * 60 + clampInt(breakSec2El.value, 0);
      diffSec = Math.floor((e.getTime() - s.getTime()) / 1000);

      if (diffSec < 0) {
        durationText.textContent = "Duration: Negative";
        detailsText.textContent = "End date/time is before start. Swap them or fix input.";
        return;
      }
    }

    const net = Math.max(0, diffSec - breakSec);
    const totalMins = Math.round((net / 60) * 100) / 100;
    const decHours = net / 3600;

    durationText.textContent = `Duration: ${formatDuration(net, disp)}`;

    const parts = [];
    parts.push(`Net seconds: ${net.toLocaleString()}`);
    parts.push(`Net minutes: ${totalMins.toLocaleString()}`);
    parts.push(`Decimal hours: ${decHours.toFixed(decimals)}`);

    if (breakSec > 0) parts.push(`Break subtracted: ${formatDuration(breakSec, "hms")}`);
    if (noteParts.length) parts.push(noteParts.join(" "));

    detailsText.textContent = parts.join(" · ");
  }

  function swap() {
    if (modeEl.value === "clock") {
      const a = startTimeEl.value;
      startTimeEl.value = endTimeEl.value;
      endTimeEl.value = a;
    } else {
      const a = startDTEl.value;
      startDTEl.value = endDTEl.value;
      endDTEl.value = a;
    }
    save();
    calc();
  }

  function reset() {
    modeEl.value = "clock";
    crossMidnightEl.value = "auto";
    displayEl.value = "hms";
    decimalPlacesEl.value = "2";

    startTimeEl.value = "09:00";
    endTimeEl.value = "17:30";
    breakMinEl.value = 0;
    breakSecEl.value = 0;

    startDTEl.value = "";
    endDTEl.value = "";
    breakMin2El.value = 0;
    breakSec2El.value = 0;

    durationText.textContent = "Duration: —";
    detailsText.textContent = "";
    setMode("clock");
    save();
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  // Events
  modeEl.addEventListener("change", () => { setMode(modeEl.value); calc(); });
  [crossMidnightEl, displayEl, decimalPlacesEl].forEach(el => el.addEventListener("change", () => calc()));

  [
    startTimeEl, endTimeEl, breakMinEl, breakSecEl,
    startDTEl, endDTEl, breakMin2El, breakSec2El
  ].forEach(el => {
    el.addEventListener("input", () => save());
    el.addEventListener("change", () => calc());
  });

  calcBtn.addEventListener("click", calc);
  swapBtn.addEventListener("click", swap);
  resetBtn.addEventListener("click", reset);

  copyBtn.addEventListener("click", async () => {
    const txt = durationText.textContent.replace(/^Duration:\s*/i, "").trim();
    if (!txt || txt === "—") return;
    await copy(txt);
  });

  // Shortcuts (ignore when typing)
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Enter") { e.preventDefault(); calc(); }
    if (e.key.toLowerCase() === "s") { e.preventDefault(); swap(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); reset(); }
  });

  // Init
  load();
  setMode(modeEl.value);

  // Set default datetime-local to "now" and "+1 hour" if empty (nice UX)
  if (!startDTEl.value && !endDTEl.value) {
    const now = new Date();
    const plus = new Date(now.getTime() + 60 * 60 * 1000);
    const toLocalInput = (d) => {
      const z = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
    };
    startDTEl.value = toLocalInput(now);
    endDTEl.value = toLocalInput(plus);
  }

  calc();
})();
