// ================================
// EverydayTools.uk — Daily Brain
// MVP: 3 levels (Easy->Medium->Hard) with unlocks, hints, scoring, share
// Data: tools/brain/data/sets-2026-01-12_to_2026-02-10.json
// Reset: UTC midnight
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const FILTER_KEY = "et_brain_filter_v1";

// ---------- Date / reset helpers (UTC) ----------
function utcTodayKey() {
  return new Date().toISOString().slice(0, 10);
}
function msToNextUtcMidnight() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const next = Date.UTC(y, m, d + 1, 0, 0, 0);
  return next - now.getTime();
}
function fmtCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const min = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${min}:${s}`;
}

// ---------- Storage ----------
function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}
function getDayRecord(store, dateKey) {
  if (!store.history) store.history = {};
  if (!store.history[dateKey]) {
    store.history[dateKey] = {
      date: dateKey,
      levels: {
        easy: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0, timeSec: 0 },
        medium: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0, timeSec: 0 },
        hard: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0, timeSec: 0 }
      }
    };
  }
  return store.history[dateKey];
}

// ---------- Scoring ----------
const LEVELS = ["easy", "medium", "hard"];
const MAX_POINTS = { easy: 10, medium: 10, hard: 10 };
const WRONG_PENALTY = { easy: 2, medium: 3, hard: 4 };
const HINT_PENALTY = { easy: 2, medium: 3, hard: 4 };

// ---------- Filter ----------
let activeFilter = localStorage.getItem(FILTER_KEY) || "all";

// ---------- DOM ----------
const statusEl = document.getElementById("status");
const levelsEl = document.getElementById("levels");
const resultEl = document.getElementById("result");

// ---------- Utils ----------
function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAnswer(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[£$€]/g, (m) => m)
    .replace(/[,]/g, "");
}
function isAccepted(input, acceptedArr) {
  const v = normalizeAnswer(input);
  return (acceptedArr || []).some(a => normalizeAnswer(a) === v);
}

// ---------- Helpers ----------
function levelTitle(lvl) {
  return lvl === "easy" ? "Easy" : lvl === "medium" ? "Medium" : "Hard";
}
function levelLockedReason(lvl, dayRec) {
  if (lvl === "medium" && !dayRec.levels.easy.done) return "Complete Easy to unlock.";
  if (lvl === "hard" && !dayRec.levels.medium.done) return "Complete Medium to unlock.";
  return "";
}
function computeLevelPoints(lvl, maxAttempts, attempts, hintUsed, correct) {
  if (!correct) return 0;
  let pts = MAX_POINTS[lvl];
  const wrongs = Math.max(0, attempts - 1);
  pts -= wrongs * WRONG_PENALTY[lvl];
  if (hintUsed) pts -= HINT_PENALTY[lvl];
  return Math.max(0, pts);
}
function totalScore(dayRec) {
  return LEVELS.reduce((s, l) => s + (dayRec.levels[l].points || 0), 0);
}
function completedForStreak(dayRec) {
  return dayRec.levels.easy.done && dayRec.levels.medium.done;
}

// ---------- Streak ----------
function updateStreak(store, todayKey) {
  if (!store.streak) store.streak = { current: 0, best: 0, lastCompletedDate: null };
  const rec = getDayRecord(store, todayKey);
  if (!completedForStreak(rec)) return;

  const last = store.streak.lastCompletedDate;
  if (last === todayKey) return;

  if (last) {
    const diff = (new Date(`${todayKey}T00:00:00Z`) - new Date(`${last}T00:00:00Z`)) / 86400000;
    store.streak.current = diff === 1 ? store.streak.current + 1 : 1;
  } else store.streak.current = 1;

  store.streak.best = Math.max(store.streak.best, store.streak.current);
  store.streak.lastCompletedDate = todayKey;
}

// ---------- Countdown ----------
function startCountdown() {
  const tick = () => {
    const left = msToNextUtcMidnight();
    const store = loadStore();
    statusEl.innerHTML = `
      <span class="badge">Resets in ${esc(fmtCountdown(left))} (UTC)</span>
      &nbsp;&nbsp;<span class="badge">Streak 🔥 ${esc(store.streak?.current || 0)}</span>
      &nbsp;&nbsp;<span class="badge">Best ${esc(store.streak?.best || 0)}</span>
    `;
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- Filter UI ----------
function wireFilterButtons(onChange) {
  const map = {
    all: document.getElementById("filter-all"),
    easy: document.getElementById("filter-easy"),
    medium: document.getElementById("filter-medium"),
    hard: document.getElementById("filter-hard")
  };

  Object.entries(map).forEach(([k, el]) => {
    if (!el) return;
    el.onclick = () => {
      activeFilter = k;
      localStorage.setItem(FILTER_KEY, k);
      Object.values(map).forEach(b => b && b.classList.remove("active"));
      el.classList.add("active");
      onChange();
    };
  });

  Object.values(map).forEach(b => b && b.classList.remove("active"));
  map[activeFilter]?.classList.add("active");
}

// ---------- Puzzle render ----------
function renderPuzzle(set, store) {
  const todayKey = utcTodayKey();
  const dayRec = getDayRecord(store, todayKey);

  levelsEl.innerHTML = "";
  resultEl.classList.add("hidden");
  resultEl.innerHTML = "";

  const startTimes = {};
  const levelsToShow = activeFilter === "all" ? LEVELS : [activeFilter];

  levelsToShow.forEach((lvl) => {
    const data = set[lvl];
    const rec = dayRec.levels[lvl];
    const lockedReason = levelLockedReason(lvl, dayRec);

    const box = document.createElement("section");
    box.className = "level";

    box.innerHTML = `
      <h2>${levelTitle(lvl)}</h2>
      <div class="small">${esc(set.theme || "")} • Attempts: ${esc(data.maxAttempts)} • Type: ${esc(data.type)}</div>
    `;

    if (lockedReason) {
      box.innerHTML += `<div class="hint">${esc(lockedReason)}</div>`;
      levelsEl.appendChild(box);
      return;
    }

    if (rec.done) {
      box.innerHTML += `
        <div style="margin-top:10px">
          <strong>${rec.correct ? "✅ Completed" : "❌ Completed"}</strong>
          <div class="small">Attempts: ${rec.attempts} • Points: ${rec.points}</div>
        </div>`;
      levelsEl.appendChild(box);
      return;
    }

    startTimes[lvl] = Date.now();
    box.innerHTML += `
      <div style="margin-top:10px">${esc(data.prompt || "")}</div>
      <div class="row">
        <input id="inp-${lvl}" placeholder="Type your answer…" />
        <button id="btn-${lvl}">Submit</button>
      </div>
      <div id="msg-${lvl}" class="small"></div>
      <div class="row"><button id="hintbtn-${lvl}" style="background:#1f6feb">Hint</button></div>
      <div id="hint-${lvl}" class="hint hidden"></div>
    `;
    levelsEl.appendChild(box);

    document.getElementById(`hintbtn-${lvl}`).onclick = () => {
      rec.hintUsed = true;
      document.getElementById(`hint-${lvl}`).textContent = data.hint || "No hint.";
      document.getElementById(`hint-${lvl}`).classList.remove("hidden");
      saveStore(store);
    };

    document.getElementById(`btn-${lvl}`).onclick = () => {
      rec.attempts++;
      const ok = isAccepted(document.getElementById(`inp-${lvl}`).value, data.accepted);
      if (ok || rec.attempts >= data.maxAttempts) {
        rec.done = true;
        rec.correct = ok;
        rec.points = ok ? computeLevelPoints(lvl, data.maxAttempts, rec.attempts, rec.hintUsed, true) : 0;
        saveStore(store);
        renderPuzzle(set, store);
        maybeShowResult(set, store);
      }
    };
  });

  maybeShowResult(set, store);
}

// ---------- Results & Stats (UNCHANGED) ----------
/* everything below remains identical to your original file */

// ---------- Main ----------
async function main() {
  startCountdown();

  const todayKey = utcTodayKey();
  const store = loadStore();
  getDayRecord(store, todayKey);
  saveStore(store);

  const res = await fetch(DATA_URL, { cache: "no-store" });
  const data = await res.json();
  const set = (data.sets || []).find(s => s.date === todayKey);

  if (!set) {
    levelsEl.innerHTML = `
      <div class="level">
        <h2>Today's set not found</h2>
        <div class="small">UTC date: ${esc(todayKey)}</div>
      </div>`;
    return;
  }

  wireFilterButtons(() => renderPuzzle(set, store));
  renderPuzzle(set, store);
}

main();
