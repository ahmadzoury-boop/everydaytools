// ================================
// EverydayTools.uk — Daily Brain
// MVP: 3 levels (Easy->Medium->Hard) with unlocks, hints, scoring, share
// Data: tools/brain/data/sets-2026-01-12_to_2026-02-10.json
// Reset: UTC midnight
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const FILTER_KEY = "et_brain_filter_v1";
const SUBSCRIBE_KEY = "et_brain_subscribed";

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
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// ---------- Storage ----------
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(s) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}
function getDayRecord(store, dateKey) {
  if (!store.history) store.history = {};
  if (!store.history[dateKey]) {
    store.history[dateKey] = {
      date: dateKey,
      levels: {
        easy: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0 },
        medium: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0 },
        hard: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0 }
      }
    };
  }
  return store.history[dateKey];
}

// ---------- Config ----------
const LEVELS = ["easy", "medium", "hard"];
const MAX_POINTS = { easy: 10, medium: 10, hard: 10 };
const WRONG_PENALTY = { easy: 2, medium: 3, hard: 4 };
const HINT_PENALTY = { easy: 2, medium: 3, hard: 4 };
let activeFilter = localStorage.getItem(FILTER_KEY) || "all";

// ---------- DOM ----------
const statusEl = document.getElementById("status");
const levelsEl = document.getElementById("levels");
const resultEl = document.getElementById("result");

// ---------- Utils ----------
const esc = s => String(s).replace(/[&<>"']/g, m =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[m])
);

function normalizeAnswer(s) {
  return String(s || "").trim().toUpperCase().replace(/\s+/g, " ").replace(/[,]/g, "");
}
function isAccepted(input, arr) {
  const v = normalizeAnswer(input);
  return (arr || []).some(a => normalizeAnswer(a) === v);
}

// ---------- UI helpers ----------
function levelTitle(l) {
  return l === "easy" ? "Easy" : l === "medium" ? "Medium" : "Hard";
}
function levelLockedReason(lvl, rec) {
  if (lvl === "medium" && !rec.levels.easy.done) return "Complete Easy to unlock.";
  if (lvl === "hard" && !rec.levels.medium.done) return "Complete Medium to unlock.";
  return "";
}
function computePoints(lvl, max, attempts, hint, correct) {
  if (!correct) return 0;
  let pts = MAX_POINTS[lvl];
  pts -= Math.max(0, attempts - 1) * WRONG_PENALTY[lvl];
  if (hint) pts -= HINT_PENALTY[lvl];
  return Math.max(0, pts);
}
function totalScore(rec) {
  return LEVELS.reduce((s, l) => s + (rec.levels[l].points || 0), 0);
}

// ---------- Streak ----------
function updateStreak(store, today) {
  if (!store.streak) store.streak = { current: 0, best: 0, last: null };
  const r = getDayRecord(store, today);
  if (!(r.levels.easy.done && r.levels.medium.done)) return;

  if (store.streak.last === today) return;

  if (store.streak.last) {
    const diff = (new Date(today) - new Date(store.streak.last)) / 86400000;
    store.streak.current = diff === 1 ? store.streak.current + 1 : 1;
  } else store.streak.current = 1;

  store.streak.best = Math.max(store.streak.best, store.streak.current);
  store.streak.last = today;
}

// ---------- Countdown ----------
function startCountdown() {
  const tick = () => {
    const store = loadStore();
    statusEl.innerHTML = `
      <span class="badge">Resets in ${fmtCountdown(msToNextUtcMidnight())} (UTC)</span>
      <span class="badge">Streak 🔥 ${store.streak?.current || 0}</span>
      <span class="badge">Best ${store.streak?.best || 0}</span>
    `;
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- Filters ----------
function wireFilterButtons(onChange) {
  ["all","easy","medium","hard"].forEach(k => {
    const el = document.getElementById(`filter-${k}`);
    if (!el) return;
    el.onclick = () => {
      activeFilter = k;
      localStorage.setItem(FILTER_KEY, k);
      document.querySelectorAll("#filter-all,#filter-easy,#filter-medium,#filter-hard")
        .forEach(b => b.classList.remove("active"));
      el.classList.add("active");
      onChange();
    };
  });
  document.getElementById(`filter-${activeFilter}`)?.classList.add("active");
}

// ---------- Render ----------
function renderPuzzle(set, store) {
  const today = utcTodayKey();
  const rec = getDayRecord(store, today);
  levelsEl.innerHTML = "";
  resultEl.classList.add("hidden");
  resultEl.innerHTML = "";

  const toShow = activeFilter === "all" ? LEVELS : [activeFilter];

  toShow.forEach(lvl => {
    const data = set[lvl];
    const r = rec.levels[lvl];
    const lock = levelLockedReason(lvl, rec);

    const box = document.createElement("section");
    box.className = "level";
    box.innerHTML = `<h2>${levelTitle(lvl)}</h2>
      <div class="small">${esc(set.theme || "")} • Attempts: ${data.maxAttempts}</div>`;

    if (lock) {
      box.innerHTML += `<div class="hint">${lock}</div>`;
      return levelsEl.appendChild(box);
    }

    if (r.done) {
      box.innerHTML += `<div class="small">${r.correct ? "✅ Completed" : "❌ Failed"} • ${r.points} pts</div>`;
      return levelsEl.appendChild(box);
    }

    box.innerHTML += `
      <div>${esc(data.prompt)}</div>
      <div class="row">
        <input id="i-${lvl}" placeholder="Your answer…" />
        <button id="b-${lvl}">Submit</button>
      </div>
      <div id="m-${lvl}" class="small"></div>
      <button id="h-${lvl}" style="background:#1f6feb">Hint</button>
      <div id="hint-${lvl}" class="hint hidden"></div>
    `;
    levelsEl.appendChild(box);

    document.getElementById(`h-${lvl}`).onclick = () => {
      r.hintUsed = true;
      document.getElementById(`hint-${lvl}`).textContent = data.hint || "No hint.";
      document.getElementById(`hint-${lvl}`).classList.remove("hidden");
      saveStore(store);
    };

    document.getElementById(`b-${lvl}`).onclick = () => {
      r.attempts++;
      const ok = isAccepted(document.getElementById(`i-${lvl}`).value, data.accepted);
      if (ok || r.attempts >= data.maxAttempts) {
        r.done = true;
        r.correct = ok;
        r.points = ok ? computePoints(lvl, data.maxAttempts, r.attempts, r.hintUsed, true) : 0;
        saveStore(store);
        renderPuzzle(set, store);
        maybeShowResult(set, store);
      }
    };
  });

  maybeShowResult(set, store);
}

// ---------- Results ----------
function maybeShowResult(set, store) {
  const today = utcTodayKey();
  const rec = getDayRecord(store, today);
  if (!rec.levels.medium.done) return;

  updateStreak(store, today);
  saveStore(store);

  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `
    <h3>Today's Result</h3>
    <div class="small">Score: ${totalScore(rec)}/30</div>
  `;
}

// ---------- Email subscription ----------
function initBrainSubscription() {
  const form = document.getElementById("brain-subscribe-form");
  if (!form) return;

  const msg = document.getElementById("brain-subscribe-msg");
  const unsub = document.getElementById("brain-unsubscribe-btn");

  if (localStorage.getItem(SUBSCRIBE_KEY)) {
    form.innerHTML = `<p class="small">✅ You’re subscribed to Daily Brain emails.</p>
      <button id="brain-unsub-inline" style="background:#b62324">Unsubscribe</button>`;
    document.getElementById("brain-unsub-inline").onclick = () => {
      localStorage.removeItem(SUBSCRIBE_KEY);
      location.reload();
    };
    return;
  }

  form.onsubmit = e => {
    e.preventDefault();
    localStorage.setItem(SUBSCRIBE_KEY, "1");
    msg.textContent = "🎉 Subscribed successfully!";
    setTimeout(() => location.reload(), 800);
  };

  unsub.onclick = () => {
    localStorage.removeItem(SUBSCRIBE_KEY);
    msg.textContent = "You are unsubscribed.";
  };
}

// ---------- Main ----------
async function main() {
  startCountdown();
  const store = loadStore();
  saveStore(store);

  const res = await fetch(DATA_URL, { cache: "no-store" });
  const data = await res.json();
  const set = (data.sets || []).find(s => s.date === utcTodayKey());

  if (!set) {
    levelsEl.innerHTML = `<div class="level"><h2>Today's set not found</h2></div>`;
    return;
  }

  wireFilterButtons(() => renderPuzzle(set, store));
  renderPuzzle(set, store);
  initBrainSubscription();
}

main();
