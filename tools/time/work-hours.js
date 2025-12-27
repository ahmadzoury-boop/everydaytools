(() => {
  const LS_KEY = "work_hours_v1";

  const daysWrap = document.getElementById("days");

  const weekStartEl = document.getElementById("weekStart");
  const weekStartsOnEl = document.getElementById("weekStartsOn");
  const roundingEl = document.getElementById("rounding");
  const overtimeWeeklyEl = document.getElementById("overtimeWeekly");

  const addDefaultBtn = document.getElementById("addDefaultBtn");
  const clearBtn = document.getElementById("clearBtn");
  const copyBtn = document.getElementById("copyBtn");
  const csvBtn = document.getElementById("csvBtn");
  const resetBtn = document.getElementById("resetBtn");

  const weekTotalText = document.getElementById("weekTotalText");
  const weekMetaText = document.getElementById("weekMetaText");

  const DAY_NAMES_MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const DAY_NAMES_SUN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  function clampInt(v, min, max = Infinity) {
    v = Number(v);
    if (!Number.isFinite(v)) v = min;
    v = Math.floor(v);
    v = Math.max(min, v);
    v = Math.min(max, v);
    return v;
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatHM(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${pad2(h)}:${pad2(m)}`;
  }

  function formatHMS(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  function parseTimeToSec(t) {
    if (!t) return null;
    const parts = String(t).split(":").map(Number);
    if (parts.length < 2) return null;
    const h = parts[0], m = parts[1], s = parts[2] ?? 0;
    if (![h,m,s].every(Number.isFinite)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  }

  function roundSeconds(sec, roundingMinutes) {
    const r = Number(roundingMinutes);
    if (!r || r <= 0) return sec;
    const step = r * 60;
    return Math.round(sec / step) * step;
  }

  function toISODate(d) {
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function getWeekBaseDate() {
    // If empty, default to today
    const v = weekStartEl.value;
    if (!v) {
      const now = new Date();
      weekStartEl.value = toISODate(now);
      return now;
    }
    const d = new Date(v + "T00:00:00");
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  // ---------- Data model ----------
  // days[i] = array of shifts
  // shift = { start:"09:00", end:"17:00", breakMin:30, cross:"auto|same|next" }
  let state = {
    weekStart: "",
    weekStartsOn: "monday",
    rounding: 0,
    overtimeWeekly: 40,
    days: Array.from({ length: 7 }, () => ([])),
  };

  function save() {
    state.weekStart = weekStartEl.value || "";
    state.weekStartsOn = weekStartsOnEl.value;
    state.rounding = clampInt(roundingEl.value, 0, 60);
    state.overtimeWeekly = Number(overtimeWeeklyEl.value || 0);

    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;

      state.weekStart = d.weekStart || "";
      state.weekStartsOn = d.weekStartsOn || "monday";
      state.rounding = clampInt(d.rounding, 0, 60);
      state.overtimeWeekly = Number(d.overtimeWeekly || 40);

      if (Array.isArray(d.days) && d.days.length === 7) {
        state.days = d.days.map(arr => Array.isArray(arr) ? arr.map(s => ({
          start: s.start || "",
          end: s.end || "",
          breakMin: clampInt(s.breakMin ?? 0, 0, 1440),
          cross: (s.cross === "same" || s.cross === "next") ? s.cross : "auto",
        })) : []);
      }
    } catch {}
  }

  // ---------- UI builders ----------
  function dayNames() {
    return state.weekStartsOn === "sunday" ? DAY_NAMES_SUN : DAY_NAMES_MON;
  }

  function dayDateLabel(index) {
    const base = getWeekBaseDate();
    // This "weekStart" is the first day displayed (Mon or Sun depending setting)
    const d = addDays(base, index);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  function makeShiftRow(dayIndex, shiftIndex, shift) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input type="time" value="${shift.start || ""}" /></td>
      <td><input type="time" value="${shift.end || ""}" /></td>
      <td><input type="number" min="0" value="${shift.breakMin ?? 0}" style="max-width:110px" /></td>
      <td>
        <select>
          <option value="auto">Auto next day</option>
          <option value="same">Same day</option>
          <option value="next">Force next day</option>
        </select>
      </td>
      <td class="muted" data-cell="dur">—</td>
      <td class="actions">
        <button class="mini" data-act="dup" title="Duplicate">Dup</button>
        <button class="mini" data-act="del" title="Delete">Del</button>
      </td>
    `;

    const [startIn, endIn] = tr.querySelectorAll('input[type="time"]');
    const breakIn = tr.querySelector('input[type="number"]');
    const crossSel = tr.querySelector("select");
    const durCell = tr.querySelector('[data-cell="dur"]');

    crossSel.value = shift.cross || "auto";

    function updateShiftFromInputs() {
      const s = state.days[dayIndex][shiftIndex];
      if (!s) return;
      s.start = startIn.value;
      s.end = endIn.value;
      s.breakMin = clampInt(breakIn.value, 0, 1440);
      s.cross = crossSel.value;
      save();
      recalc();
    }

    [startIn, endIn, breakIn, crossSel].forEach(el => {
      el.addEventListener("change", updateShiftFromInputs);
      el.addEventListener("input", () => { save(); });
    });

    tr.querySelector('[data-act="del"]').addEventListener("click", () => {
      state.days[dayIndex].splice(shiftIndex, 1);
      save();
      render();
      recalc();
    });

    tr.querySelector('[data-act="dup"]').addEventListener("click", () => {
      const s = state.days[dayIndex][shiftIndex];
      state.days[dayIndex].splice(shiftIndex + 1, 0, { ...s });
      save();
      render();
      recalc();
    });

    // helper for recalc to fill duration
    tr._setDuration = (text, cls = "") => {
      durCell.textContent = text;
      durCell.classList.remove("warn","err");
      if (cls) durCell.classList.add(cls);
    };

    return tr;
  }

  function makeDayCard(dayIndex) {
    const names = dayNames();
    const card = document.createElement("div");
    card.className = "dayCard";

    const title = names[dayIndex];
    const dateLabel = dayDateLabel(dayIndex);

    card.innerHTML = `
      <div class="dayHead">
        <div>
          <div class="dayTitle">${title}</div>
          <div class="dayDate">${dateLabel}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="mini" data-act="add">Add shift</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:18%">Start</th>
            <th style="width:18%">End</th>
            <th style="width:18%">Break (min)</th>
            <th style="width:20%">Overnight</th>
            <th style="width:16%">Hours</th>
            <th style="width:10%"></th>
          </tr>
        </thead>
        <tbody data-body></tbody>
      </table>

      <div class="totals">
        <div class="pill" data-total>Day total: 00:00</div>
        <div class="pill muted" data-dec>Decimal: 0.00</div>
      </div>
    `;

    const tbody = card.querySelector("[data-body]");
    const totalEl = card.querySelector("[data-total]");
    const decEl = card.querySelector("[data-dec]");

    const shifts = state.days[dayIndex];
    shifts.forEach((shift, idx) => tbody.appendChild(makeShiftRow(dayIndex, idx, shift)));

    card.querySelector('[data-act="add"]').addEventListener("click", () => {
      state.days[dayIndex].push({ start: "", end: "", breakMin: 0, cross: "auto" });
      save();
      render();
      recalc();
    });

    card._setDayTotals = (sec) => {
      totalEl.textContent = `Day total: ${formatHM(sec)}`;
      decEl.textContent = `Decimal: ${(sec / 3600).toFixed(2)}`;
    };

    return card;
  }

  function render() {
    daysWrap.innerHTML = "";

    // sync controls from state
    weekStartEl.value = state.weekStart || weekStartEl.value || "";
    weekStartsOnEl.value = state.weekStartsOn || "monday";
    roundingEl.value = String(state.rounding ?? 0);
    overtimeWeeklyEl.value = String(state.overtimeWeekly ?? 40);

    for (let i = 0; i < 7; i++) {
      daysWrap.appendChild(makeDayCard(i));
    }
  }

  // ---------- Calculations ----------
  function calcShiftSeconds(shift) {
    const s = parseTimeToSec(shift.start);
    const e0 = parseTimeToSec(shift.end);
    if (s === null || e0 === null) return { ok: false, sec: 0, reason: "invalid" };

    let e = e0;
    const cross = shift.cross || "auto";
    if (cross === "auto" && e < s) e += 86400;
    if (cross === "next") e += 86400;

    let diff = e - s;
    if (diff < 0) return { ok: false, sec: 0, reason: "negative" };

    const breakSec = clampInt(shift.breakMin ?? 0, 0, 1440) * 60;
    diff = Math.max(0, diff - breakSec);

    diff = roundSeconds(diff, state.rounding);

    return { ok: true, sec: diff, reason: "" };
  }

  function recalc() {
    const dayCards = Array.from(daysWrap.querySelectorAll(".dayCard"));

    let weekSec = 0;
    let invalidCount = 0;

    dayCards.forEach((card, dayIndex) => {
      const rows = Array.from(card.querySelectorAll("tbody tr"));
      let daySec = 0;

      rows.forEach((tr, shiftIndex) => {
        const shift = state.days[dayIndex][shiftIndex];
        const res = calcShiftSeconds(shift);

        if (!res.ok) {
          invalidCount += 1;
          tr._setDuration("Invalid", "err");
          return;
        }

        daySec += res.sec;
        tr._setDuration(formatHM(res.sec));
      });

      weekSec += daySec;
      card._setDayTotals(daySec);
    });

    const overtimeThresholdSec = Math.max(0, Number(state.overtimeWeekly || 0)) * 3600;
    const overtimeSec = overtimeThresholdSec > 0 ? Math.max(0, weekSec - overtimeThresholdSec) : 0;
    const regularSec = weekSec - overtimeSec;

    weekTotalText.textContent = `Week total: ${formatHM(weekSec)}`;

    const metaParts = [];
    metaParts.push(`Decimal hours: ${(weekSec / 3600).toFixed(2)}`);
    if (overtimeThresholdSec > 0) {
      metaParts.push(`Regular: ${formatHM(regularSec)}`);
      metaParts.push(`Overtime: ${formatHM(overtimeSec)} (over ${Number(state.overtimeWeekly || 0)}h)`);
    }
    if (invalidCount) metaParts.push(`⚠ ${invalidCount} invalid shift(s)`);
    weekMetaText.textContent = metaParts.join(" · ");
  }

  // ---------- Actions ----------
  function clearWeek() {
    state.days = Array.from({ length: 7 }, () => ([]));
    save();
    render();
    recalc();
  }

  function addTypicalMonFri() {
    // Mon–Fri: 09:00–17:00 with 30 min break
    // Weekend empty
    const monStartIndex = (state.weekStartsOn === "sunday") ? 1 : 0; // where Monday appears
    const friIndex = (state.weekStartsOn === "sunday") ? 5 : 4;

    state.days = Array.from({ length: 7 }, () => ([]));
    for (let i = monStartIndex; i <= friIndex; i++) {
      state.days[i].push({ start: "09:00", end: "17:00", breakMin: 30, cross: "same" });
    }
    save();
    render();
    recalc();
  }

  async function copySummary() {
    const names = dayNames();
    const lines = [];
    lines.push(`Work Hours Summary`);
    lines.push(`Week start: ${weekStartEl.value || ""}`);
    lines.push(`Rounding: ${roundingEl.value} min`);
    lines.push(`Overtime threshold: ${overtimeWeeklyEl.value || 0}h`);
    lines.push("");

    // daily totals
    const dayCards = Array.from(daysWrap.querySelectorAll(".dayCard"));
    let weekSec = 0;
    dayCards.forEach((card, i) => {
      const pill = card.querySelector("[data-total]");
      const txt = pill ? pill.textContent.replace("Day total: ", "").trim() : "00:00";
      lines.push(`${names[i]}: ${txt}`);
      // approximate parse for week total from HH:MM
      const [h,m] = txt.split(":").map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) weekSec += (h*3600 + m*60);
    });

    lines.push("");
    lines.push(`Week total: ${formatHM(weekSec)} (${(weekSec/3600).toFixed(2)}h)`);

    try { await navigator.clipboard.writeText(lines.join("\n")); } catch {}
  }

  function exportCSV() {
    const names = dayNames();
    const base = getWeekBaseDate();

    const rows = [];
    rows.push(["Day","Date","Start","End","BreakMin","OvernightMode","NetHHMM","NetDecimal"].join(","));

    for (let i = 0; i < 7; i++) {
      const date = addDays(base, i);
      const dateStr = date.toISOString().slice(0,10);
      const shifts = state.days[i];

      if (shifts.length === 0) {
        rows.push([names[i], dateStr, "", "", "", "", "00:00", "0.00"].join(","));
        continue;
      }

      shifts.forEach(s => {
        const res = calcShiftSeconds(s);
        const hhmm = res.ok ? formatHM(res.sec) : "Invalid";
        const dec = res.ok ? (res.sec/3600).toFixed(2) : "";
        rows.push([
          names[i],
          dateStr,
          s.start || "",
          s.end || "",
          String(s.breakMin ?? 0),
          s.cross || "auto",
          hhmm,
          dec
        ].map(x => `"${String(x).replaceAll('"','""')}"`).join(","));
      });
    }

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "work-hours.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    state = {
      weekStart: "",
      weekStartsOn: "monday",
      rounding: 0,
      overtimeWeekly: 40,
      days: Array.from({ length: 7 }, () => ([])),
    };
    // default week start = today
    const now = new Date();
    state.weekStart = toISODate(now);

    try { localStorage.removeItem(LS_KEY); } catch {}
    weekStartEl.value = state.weekStart;
    weekStartsOnEl.value = state.weekStartsOn;
    roundingEl.value = String(state.rounding);
    overtimeWeeklyEl.value = String(state.overtimeWeekly);

    render();
    recalc();
    save();
  }

  // ---------- Events ----------
  [weekStartEl, weekStartsOnEl, roundingEl, overtimeWeeklyEl].forEach(el => {
    el.addEventListener("change", () => {
      // refresh date labels when weekStart/weekStartsOn changes
      save();
      render();
      recalc();
    });
  });

  addDefaultBtn.addEventListener("click", addTypicalMonFri);
  clearBtn.addEventListener("click", clearWeek);
  copyBtn.addEventListener("click", copySummary);
  csvBtn.addEventListener("click", exportCSV);
  resetBtn.addEventListener("click", resetAll);

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Enter") { e.preventDefault(); recalc(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); resetAll(); }
  });

  // ---------- Init ----------
  // default date if empty
  if (!weekStartEl.value) weekStartEl.value = toISODate(new Date());

  load();

  // Apply loaded state to controls (if any)
  if (state.weekStart) weekStartEl.value = state.weekStart;

  render();
  recalc();
  save();
})();
