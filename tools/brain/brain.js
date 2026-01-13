// ================================
// EverydayTools.uk — Daily Brain
// STEP 4: Local Leaderboard added
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const FILTER_KEY = "et_brain_filter_v1";
const SUBSCRIBE_KEY = "et_brain_subscribed";

// ---------- Date helpers ----------
const todayKey = () => new Date().toISOString().slice(0, 10);
const msToNextUtcMidnight = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - Date.now();
};
const fmt = ms => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// ---------- Storage ----------
const loadStore = () => JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
const saveStore = s => localStorage.setItem(STORE_KEY, JSON.stringify(s));
function dayRec(store, k) {
  store.history ||= {};
  store.history[k] ||= {
    date: k,
    levels: {
      easy: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0 },
      medium: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0 },
      hard: { done: false, correct: false, attempts: 0, hintUsed: false, points: 0 }
    }
  };
  return store.history[k];
}

// ---------- Config ----------
const LEVELS = ["easy", "medium", "hard"];
const MAX = { easy: 10, medium: 10, hard: 10 };
const WRONG = { easy: 2, medium: 3, hard: 4 };
const HINT = { easy: 2, medium: 3, hard: 4 };
let activeFilter = localStorage.getItem(FILTER_KEY) || "all";

// ---------- DOM ----------
const statusEl = document.getElementById("status");
const levelsEl = document.getElementById("levels");
const resultEl = document.getElementById("result");

// ---------- Utils ----------
const esc = s => String(s).replace(/[&<>"']/g, m =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[m])
);
const norm = s => String(s || "").trim().toUpperCase().replace(/\s+/g, " ").replace(/,/g, "");
const accepted = (i, a) => (a || []).some(v => norm(v) === norm(i));

// ---------- Countdown ----------
function countdown() {
  const t = () => {
    const s = loadStore();
    statusEl.innerHTML = `
      <span class="badge">Resets in ${fmt(msToNextUtcMidnight())} (UTC)</span>
      <span class="badge">Streak 🔥 ${s.streak?.current || 0}</span>
      <span class="badge">Best ${s.streak?.best || 0}</span>`;
  };
  t(); setInterval(t, 1000);
}

// ---------- Filters ----------
function wireFilters(cb) {
  ["all","easy","medium","hard"].forEach(k => {
    const b = document.getElementById(`filter-${k}`);
    if (!b) return;
    b.onclick = () => {
      activeFilter = k;
      localStorage.setItem(FILTER_KEY, k);
      document.querySelectorAll("#filter-all,#filter-easy,#filter-medium,#filter-hard")
        .forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      cb();
    };
  });
  document.getElementById(`filter-${activeFilter}`)?.classList.add("active");
}

// ---------- Render ----------
function render(set, store) {
  const k = todayKey();
  const rec = dayRec(store, k);
  levelsEl.innerHTML = "";
  resultEl.classList.add("hidden");

  const show = activeFilter === "all" ? LEVELS : [activeFilter];

  show.forEach(l => {
    const d = set[l];
    const r = rec.levels[l];
    const locked =
      (l === "medium" && !rec.levels.easy.done) ||
      (l === "hard" && !rec.levels.medium.done);

    const box = document.createElement("section");
    box.className = "level";
    box.innerHTML = `<h2>${l.toUpperCase()}</h2><div class="small">${esc(set.theme || "")}</div>`;

    if (locked) {
      box.innerHTML += `<div class="hint">Complete previous level to unlock.</div>`;
      return levelsEl.appendChild(box);
    }

    if (r.done) {
      box.innerHTML += `<div class="small">${r.correct ? "✅ Completed" : "❌ Failed"} • ${r.points} pts</div>`;
      return levelsEl.appendChild(box);
    }

    // ✅ FIXED QUESTION LAYOUT
    box.innerHTML += `
      <div class="question-box">
        <div class="question-text">${esc(d.prompt)}</div>

        <input
          id="i-${l}"
          placeholder="Your answer"
          inputmode="text"
        />

        <button class="primary-btn" id="b-${l}">
          Submit Answer
        </button>
      </div>

      <button id="h-${l}" style="margin-top:10px;background:#1f6feb">Hint</button>
      <div id="hint-${l}" class="hint hidden"></div>
    `;
    levelsEl.appendChild(box);

    document.getElementById(`h-${l}`).onclick = () => {
      r.hintUsed = true;
      document.getElementById(`hint-${l}`).textContent = d.hint || "No hint.";
      document.getElementById(`hint-${l}`).classList.remove("hidden");
      saveStore(store);
    };

    document.getElementById(`b-${l}`).onclick = () => {
      r.attempts++;
      const ok = accepted(document.getElementById(`i-${l}`).value, d.accepted);
      if (ok || r.attempts >= d.maxAttempts) {
        r.done = true;
        r.correct = ok;
        r.points = ok
          ? Math.max(0, MAX[l] - (r.attempts - 1) * WRONG[l] - (r.hintUsed ? HINT[l] : 0))
          : 0;
        saveStore(store);
        render(set, store);
        showResult(set, store);
      }
    };
  });

  showResult(set, store);
}

// ---------- Leaderboard ----------
function localLeaderboard(store) {
  const rows = Object.values(store.history || {})
    .map(r => ({
      date: r.date,
      score: LEVELS.reduce((s,l)=>s+(r.levels[l].points||0),0)
    }))
    .sort((a,b)=>b.score-a.score)
    .slice(0,5);

  if (!rows.length) return "";

  return `
    <h4 style="margin-top:16px">🏆 Your Best Days</h4>
    <table style="width:100%; margin-top:6px">
      ${rows.map(r=>`
        <tr>
          <td>${r.date}</td>
          <td style="text-align:right">${r.score}/30</td>
        </tr>`).join("")}
    </table>`;
}

// ---------- Result ----------
function showResult(set, store) {
  const k = todayKey();
  const r = dayRec(store, k);
  if (!r.levels.medium.done) return;

  store.streak ||= { current:0,best:0,last:null };
  if (store.streak.last !== k) {
    store.streak.current = store.streak.last &&
      (new Date(k)-new Date(store.streak.last))===86400000
      ? store.streak.current+1 : 1;
    store.streak.best = Math.max(store.streak.best, store.streak.current);
    store.streak.last = k;
  }
  saveStore(store);

  const score = LEVELS.reduce((s,l)=>s+(r.levels[l].points||0),0);
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `
    <h3>Today's Result</h3>
    <div class="small">Score: ${score}/30</div>
    ${localLeaderboard(store)}
  `;
}

// ---------- Subscribe ----------
function initSubscribe() {
  const form = document.getElementById("brain-subscribe-form");
  if (!form) return;

  if (localStorage.getItem(SUBSCRIBE_KEY)) {
    form.innerHTML = `<p class="small">✅ Subscribed</p>
      <button id="unsub" style="background:#b62324">Unsubscribe</button>`;
    document.getElementById("unsub").onclick = () => {
      localStorage.removeItem(SUBSCRIBE_KEY);
      location.reload();
    };
    return;
  }

  form.onsubmit = e => {
    e.preventDefault();
    localStorage.setItem(SUBSCRIBE_KEY,"1");
    location.reload();
  };
}

// ---------- Main ----------
async function main() {
  countdown();
  const store = loadStore();
  saveStore(store);

  const res = await fetch(DATA_URL, { cache:"no-store" });
  const data = await res.json();
  const set = (data.sets||[]).find(s=>s.date===todayKey());
  if (!set) {
    levelsEl.innerHTML = `<div class="level">Today's set not found</div>`;
    return;
  }

  wireFilters(()=>render(set,store));
  render(set,store);
  initSubscribe();
}

main();
