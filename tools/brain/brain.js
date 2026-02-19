/* =========================================================
   EverydayTools.uk — Daily Brain (brain.js)
   Multi-file loader + recycle + full UI wiring
   Works with your index.html IDs:
   dateSelect, btnPrevDay, btnToday, btnNextDay,
   resetTime, dayKey, questions, resultBox,
   dayScore, bestDaysBody, leaderboardBody
========================================================= */

// ================================
// Multi-file sets loader + recycle
// ================================
const DATA_BASE = "/tools/brain/data/";

const DATA_RANGES = [
  { from: "2026-01-12", to: "2026-02-10", file: "sets-2026-01-12_to_2026-02-10.json" },
  { from: "2026-02-11", to: "2026-03-10", file: "sets-2026-02-11_to_2026-03-10.json" },
  { from: "2026-03-11", to: "2026-04-09", file: "sets-2026-03-11_to_2026-04-09.json" },
];

// Cache per file (fast)
const __SETS_CACHE = new Map();

function dateInRange(date, from, to) {
  return date >= from && date <= to;
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  const A = Date.UTC(ya, ma - 1, da);
  const B = Date.UTC(yb, mb - 1, db);
  return Math.floor((B - A) / 86400000);
}

function getGlobalSpan() {
  const sorted = [...DATA_RANGES].sort((a, b) => a.from.localeCompare(b.from));
  return { start: sorted[0].from, end: sorted[sorted.length - 1].to };
}

// Map ANY date into our available span by cycling forever
function mapDateToCycle(requestedDayKey) {
  const { start, end } = getGlobalSpan();

  if (requestedDayKey >= start && requestedDayKey <= end) {
    return { effective: requestedDayKey, cycled: false };
  }

  const spanDays = daysBetween(start, end) + 1;

  // after end -> wrap forward
  if (requestedDayKey > end) {
    const offset = daysBetween(end, requestedDayKey); // 1,2,3...
    const idx = (offset - 1) % spanDays;
    return { effective: addDays(start, idx), cycled: true };
  }

  // before start -> wrap backwards
  const offsetBack = daysBetween(requestedDayKey, start); // 1,2,3...
  const idxBack = (offsetBack - 1) % spanDays;
  return { effective: addDays(end, -idxBack), cycled: true };
}

function pickFileForDate(effectiveDayKey) {
  for (const r of DATA_RANGES) {
    if (dateInRange(effectiveDayKey, r.from, r.to)) {
      return { url: DATA_BASE + r.file, range: r };
    }
  }
  return null;
}

function listAvailableDayKeys(sets) {
  if (!sets || typeof sets !== "object") return [];
  return Object.keys(sets)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();
}

// If exact day missing inside selected file, fallback to closest <= day, else last
function fallbackWithinFile(sets, preferredKey) {
  if (sets?.[preferredKey]) return { dayKey: preferredKey, usedFallback: false };
  const keys = listAvailableDayKeys(sets);
  if (!keys.length) return { dayKey: preferredKey, usedFallback: true };
  const le = keys.filter((k) => k <= preferredKey);
  return { dayKey: le.length ? le[le.length - 1] : keys[keys.length - 1], usedFallback: true };
}

async function fetchSetsFile(url) {
  if (__SETS_CACHE.has(url)) return __SETS_CACHE.get(url);

  const p = fetch(url, { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error(`Failed to load sets: ${r.status} ${r.statusText}`);
    return r.json();
  });

  __SETS_CACHE.set(url, p);
  return p;
}

async function loadSetsForDay(requestedDayKey) {
  const { effective, cycled } = mapDateToCycle(requestedDayKey);

  const pick = pickFileForDate(effective);
  if (!pick) throw new Error(`No data range configured for effective date: ${effective}`);

  const sets = await fetchSetsFile(pick.url);
  const { dayKey, usedFallback } = fallbackWithinFile(sets, effective);

  return {
    requestedDayKey,
    effectiveDayKey: effective,
    usedCycle: cycled,
    fileUrl: pick.url,
    sets,
    dayKey,        // final day key to show
    usedFallback,
  };
}
async function 
// ================================
// App state + storage
// ================================
const STORE_KEY = "et_brain_v2"; // bump version safely

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(s) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

let store = readStore();
let currentRequestedKey = null; // date user selected (may be future)
let currentLoaded = null;       // loaded object from loadSetsForDay()

// ================================
// DOM
// ================================
const elDateSelect = document.getElementById("dateSelect");
const elPrev = document.getElementById("btnPrevDay");
const elToday = document.getElementById("btnToday");
const elNext = document.getElementById("btnNextDay");

const elReset = document.getElementById("resetTime");
const elDayKey = document.getElementById("dayKey");

const elQuestions = document.getElementById("questions");
const elResultBox = document.getElementById("resultBox");

const elDayScore = document.getElementById("dayScore");
const elBestDaysBody = document.getElementById("bestDaysBody");
const elLeaderboardBody = document.getElementById("leaderboardBody");

// ================================
// Time helpers
// ================================
function todayUTCKey() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function msToNextUtcMidnight() {
  const d = new Date();
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) -
    Date.now()
  );
}

function fmtHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// ================================
// UI: date dropdown + nav
// ================================
function buildDateOptions() {
  // Past 30 days + next 120 days (requested keys)
  const today = todayUTCKey();
  const start = addDays(today, -30);
  const end = addDays(today, 120);

  const opts = [];
  const days = daysBetween(start, end);
  for (let i = 0; i <= days; i++) {
    opts.push(addDays(start, i));
  }

  elDateSelect.innerHTML = opts
    .map((k) => `<option value="${k}">${k}</option>`)
    .join("");

  return { start, end };
}

function setSelectedDate(key) {
  currentRequestedKey = key;
  elDateSelect.value = key;
}

function stepDay(delta) {
  const base = currentRequestedKey || todayUTCKey();
  const next = addDays(base, delta);
  setSelectedDate(next);
  renderForRequestedDate(next);
}

// ================================
// Question rendering + grading
// ================================
function normalizeAnswer(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getDayStore(requestedKey) {
  if (!store.days) store.days = {};
  if (!store.days[requestedKey]) {
    store.days[requestedKey] = {
      requestedKey,
      score: 0,
      answers: {}, // qid -> { given, correct }
      completedAt: null,
      meta: null,  // { effectiveKey, usedCycle, usedFallback, fileUrl }
    };
  }
  return store.days[requestedKey];
}

function makeQCard({ group, idx, qObj, expected, saved }) {
  const qid = `${group}:${idx}`;
  const given = saved?.answers?.[qid]?.given ?? "";
  const wasCorrect = saved?.answers?.[qid]?.correct === true;

  const wrap = document.createElement("div");
  wrap.className = "q-card";
  wrap.style.border = "1px solid rgba(255,255,255,0.10)";
  wrap.style.borderRadius = "14px";
  wrap.style.padding = "14px";
  wrap.style.background = "rgba(0,0,0,0.12)";
  wrap.style.marginBottom = "10px";

  const title = document.createElement("div");
  title.style.display = "flex";
  title.style.justifyContent = "space-between";
  title.style.alignItems = "center";
  title.style.gap = "10px";

  const left = document.createElement("div");
  left.innerHTML = `<strong>${group.toUpperCase()}</strong> <span style="opacity:.7;font-size:12px;">#${idx + 1}</span>`;

  const right = document.createElement("div");
  right.style.fontSize = "12px";
  right.style.opacity = "0.85";
  right.textContent = wasCorrect ? "✅ Correct" : "";

  title.appendChild(left);
  title.appendChild(right);

  const qText = document.createElement("div");
  qText.style.marginTop = "10px";
  qText.style.fontSize = "14px";
  qText.textContent = qObj.q || "";

  const hint = document.createElement("div");
  hint.style.marginTop = "8px";
  hint.style.fontSize = "12px";
  hint.style.opacity = "0.75";
  hint.textContent = qObj.hint ? `Hint: ${qObj.hint}` : "";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "10px";
  row.style.marginTop = "12px";
  row.style.flexWrap = "wrap";

  const input = document.createElement("input");
  input.type = "text";
  input.value = given;
  input.placeholder = "Your answer…";
  input.style.flex = "1";
  input.style.minWidth = "180px";
  input.style.padding = "10px 12px";
  input.style.borderRadius = "12px";
  input.style.border = "1px solid rgba(255,255,255,0.12)";
  input.style.background = "rgba(0,0,0,0.20)";
  input.style.color = "inherit";
  input.autocomplete = "off";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Check";
  btn.style.padding = "10px 12px";
  btn.style.borderRadius = "12px";
  btn.style.border = "1px solid rgba(255,255,255,0.14)";
  btn.style.background = "rgba(78,161,255,0.18)";
  btn.style.color = "inherit";
  btn.style.cursor = "pointer";

  const feedback = document.createElement("div");
  feedback.style.marginTop = "10px";
  feedback.style.fontSize = "12px";
  feedback.style.opacity = "0.9";

  function setFeedback(ok) {
    if (ok) {
      feedback.textContent = "✅ Correct!";
      right.textContent = "✅ Correct";
    } else {
      feedback.textContent = "❌ Not correct yet.";
      right.textContent = "";
    }
  }

  // Initial feedback if already correct
  if (wasCorrect) {
    setFeedback(true);
  }

  function gradeAndSave() {
    const val = normalizeAnswer(input.value);
    const exp = normalizeAnswer(expected);

    const ok = val.length > 0 && val === exp;

    const dayRec = getDayStore(currentRequestedKey);
    dayRec.answers[qid] = { given: input.value, correct: ok };

    // score: 1 per correct (simple and clear)
    dayRec.score = Object.values(dayRec.answers).filter((x) => x.correct).length;

    writeStore(store);
    setFeedback(ok);
    updateResultPanels();
  }

  btn.addEventListener("click", gradeAndSave);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") gradeAndSave();
  });

  row.appendChild(input);
  row.appendChild(btn);

  wrap.appendChild(title);
  wrap.appendChild(qText);
  if (qObj.hint) wrap.appendChild(hint);
  wrap.appendChild(row);
  wrap.appendChild(feedback);

  return wrap;
}

function flattenDay(dayObj) {
  // returns [{group, qObj}]
  const out = [];
  if (!dayObj) return out;

  if (Array.isArray(dayObj.easy)) dayObj.easy.forEach((q) => out.push({ group: "easy", q }));
  if (Array.isArray(dayObj.medium)) dayObj.medium.forEach((q) => out.push({ group: "medium", q }));
  if (Array.isArray(dayObj.hard)) dayObj.hard.forEach((q) => out.push({ group: "hard", q }));

  // fallback if day itself is array
  if (!out.length && Array.isArray(dayObj)) dayObj.forEach((q) => out.push({ group: "mix", q }));

  return out;
}

// ================================
// Panels: score, best days, leaderboard placeholder
// ================================
function updateResultPanels() {
  const rec = getDayStore(currentRequestedKey);
  elDayScore.textContent = String(rec.score || 0);

  // best days = top scores from local store
  const allDays = Object.values(store.days || {});
  const top = allDays
    .map((d) => ({ key: d.requestedKey, score: Number(d.score || 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, 7);

  elBestDaysBody.innerHTML = top.length
    ? top
        .map(
          (x) => `
        <tr>
          <td style="padding:6px 0;opacity:.85;">${x.key}</td>
          <td style="padding:6px 0;text-align:right;font-weight:700;">${x.score}</td>
        </tr>`
        )
        .join("")
    : `<tr><td style="padding:8px 0;opacity:.7;">No scores yet.</td><td></td></tr>`;

  // Global leaderboard: keep stable even if no API
  // If you later add an endpoint, you can wire it here.
  if (!elLeaderboardBody.dataset.loaded) {
    elLeaderboardBody.innerHTML = `
      <tr><td style="padding:8px 0;opacity:.7;">
        Leaderboard will appear here (API not connected yet).
      </td><td></td></tr>
    `;
    elLeaderboardBody.dataset.loaded = "1";
  }
}

// ================================
// Main render
// ================================
async function renderForRequestedDate(requestedKey) {
  // basic UI state
  elQuestions.innerHTML = "";
  elResultBox.textContent = "Loading today’s puzzles…";
  elDayKey.textContent = requestedKey;

  // make sure local record exists
  const rec = getDayStore(requestedKey);

  try {
    const loaded = await loadSetsForDay(requestedKey);
    currentLoaded = loaded;

    // Save metadata to local record (useful for debugging)
    rec.meta = {
      effectiveKey: loaded.effectiveDayKey,
      usedCycle: loaded.usedCycle,
      usedFallback: loaded.usedFallback,
      fileUrl: loaded.fileUrl,
    };
    writeStore(store);

    const dayKeyToShow = loaded.dayKey;
    elDayKey.textContent = dayKeyToShow;

    const day = loaded.sets[dayKeyToShow];
    const flat = flattenDay(day);

    // Note area
    const notes = [];
    if (loaded.usedCycle) {
      notes.push(`Recycled: ${loaded.requestedDayKey} → ${loaded.effectiveDayKey}`);
    }
    if (loaded.usedFallback) {
      notes.push(`Adjusted inside file to: ${loaded.dayKey}`);
    }

    if (!flat.length) {
      elResultBox.textContent = `No questions found for ${dayKeyToShow}.`;
      updateResultPanels();
      return;
    }

    elResultBox.innerHTML = notes.length
      ? `<span style="opacity:.75;">${notes.join(" · ")}</span>`
      : "";

    // Render
    const groups = {
      easy: flat.filter((x) => x.group === "easy").map((x) => x.q),
      medium: flat.filter((x) => x.group === "medium").map((x) => x.q),
      hard: flat.filter((x) => x.group === "hard").map((x) => x.q),
      mix: flat.filter((x) => x.group === "mix").map((x) => x.q),
    };

    const order = ["easy", "medium", "hard", "mix"];
    for (const g of order) {
      const arr = groups[g];
      if (!arr || !arr.length) continue;

      arr.forEach((qObj, idx) => {
        const expected = qObj.a ?? "";
        const card = makeQCard({
          group: g === "mix" ? "mix" : g,
          idx,
          qObj,
          expected,
          saved: rec,
        });
        elQuestions.appendChild(card);
      });
    }

    updateResultPanels();
  } catch (e) {
    console.error(e);
    elResultBox.textContent = "Failed to load puzzles. Check console.";
    updateResultPanels();
  }
}

// ================================
// Init
// ================================
function startResetTimer() {
  function tick() {
    elReset.textContent = fmtHMS(msToNextUtcMidnight());
  }
  tick();
  setInterval(tick, 1000);
}

function wireEvents() {
  elDateSelect.addEventListener("change", () => {
    const key = elDateSelect.value;
    setSelectedDate(key);
    renderForRequestedDate(key);
  });

  elPrev.addEventListener("click", () => stepDay(-1));
  elNext.addEventListener("click", () => stepDay(1));
  elToday.addEventListener("click", () => {
    const t = todayUTCKey();
    setSelectedDate(t);
    renderForRequestedDate(t);
  });
}

function init() {
  buildDateOptions();
  wireEvents();
  startResetTimer();

  const initial = todayUTCKey();
  setSelectedDate(initial);
  renderForRequestedDate(initial);
}

init();
