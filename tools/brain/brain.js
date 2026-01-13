// ================================
// EverydayTools.uk — Daily Brain
// STEP 7: Player Name + Anti-spam + Global Tabs
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const FILTER_KEY = "et_brain_filter_v1";
const SUBSCRIBE_KEY = "et_brain_subscribed";

// Global leaderboard client-side controls
const GLOBAL_SENT_KEY = "et_brain_global_sent_v2";
const PLAYER_NAME_KEY = "et_brain_player_name_v1";
const DEVICE_ID_KEY = "et_brain_device_id_v1";

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

function ensureDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    // small random id (client-side only)
    id = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getPlayerName() {
  return (localStorage.getItem(PLAYER_NAME_KEY) || "").trim() || "Player";
}

function setPlayerName(name) {
  const cleaned = String(name || "").trim().slice(0, 24);
  if (!cleaned) {
    localStorage.removeItem(PLAYER_NAME_KEY);
    return;
  }
  localStorage.setItem(PLAYER_NAME_KEY, cleaned);
}

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

// ---------- Player UI (injected) ----------
function initPlayerUI() {
  // Inject a small "name" area right after #status (only once)
  if (document.getElementById("player-box")) return;

  const wrap = document.createElement("div");
  wrap.id = "player-box";
  wrap.className = "hint";
  wrap.style.marginTop = "10px";

  const current = esc(getPlayerName());

  wrap.innerHTML = `
    <strong>👤 Your name (for Global Leaderboard)</strong>
    <div class="row" style="gap:8px; flex-wrap:wrap; margin-top:10px;">
      <input id="player-name-input" placeholder="Enter your name" value="${current}" />
      <button id="player-name-save">Save</button>
      <button id="player-name-clear" style="background:#30363d">Clear</button>
    </div>
    <div id="player-name-msg" class="small" style="margin-top:6px"></div>
  `;

  statusEl.insertAdjacentElement("afterend", wrap);

  document.getElementById("player-name-save").onclick = () => {
    const v = document.getElementById("player-name-input").value;
    setPlayerName(v);
    document.getElementById("player-name-msg").textContent = `Saved as: ${getPlayerName()}`;
    // refresh global block if shown
    if (!resultEl.classList.contains("hidden")) {
      showResult(window.__brainSet, window.__brainStore);
    }
  };

  document.getElementById("player-name-clear").onclick = () => {
    localStorage.removeItem(PLAYER_NAME_KEY);
    document.getElementById("player-name-input").value = "";
    document.getElementById("player-name-msg").textContent = "Name cleared.";
    if (!resultEl.classList.contains("hidden")) {
      showResult(window.__brainSet, window.__brainStore);
    }
  };
}

// ---------- Global submit (Anti-spam client-side) ----------
function loadSentMap() {
  return JSON.parse(localStorage.getItem(GLOBAL_SENT_KEY) || "{}");
}
function saveSentMap(m) {
  localStorage.setItem(GLOBAL_SENT_KEY, JSON.stringify(m));
}

async function submitGlobal(score, level) {
  // client-side anti-spam: once per day per level per device
  const day = todayKey();
  const sent = loadSentMap();
  sent[day] ||= {};
  if (sent[day][level]) return;

  try {
    await fetch("/api/brain-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: getPlayerName(),
        score,
        level
      })
    });
    sent[day][level] = true;
    saveSentMap(sent);
  } catch {
    // do not mark as sent if failed
  }
}

// ---------- Global fetch ----------
async function fetchGlobalLeaderboard(level, limit = 10) {
  try {
    const res = await fetch(`/api/brain-score?level=${encodeURIComponent(level)}&limit=${limit}`);
    const data = await res.json();
    return data && data.ok ? data.leaderboard : [];
  } catch {
    return [];
  }
}

function globalTabsHTML(active = "easy") {
  const mk = (lvl, label) => `
    <button
      type="button"
      id="gb-tab-${lvl}"
      class="${active === lvl ? "active" : ""}"
      style="margin-right:8px"
    >${label}</button>
  `;
  return `
    <div class="row" style="gap:8px; flex-wrap:wrap; margin-top:10px;">
      <span class="badge">Global:</span>
      ${mk("easy","Easy")}
      ${mk("medium","Medium")}
      ${mk("hard","Hard")}
    </div>
  `;
}

function renderGlobalRows(rows) {
  if (!rows.length) return `<div class="small" style="margin-top:8px">No global scores yet.</div>`;
  // keep as table; CSS already makes it card-like on mobile
  return `
    <table style="width:100%; margin-top:8px">
      ${rows.map((r,i)=>`
        <tr>
          <td>#${i+1} ${esc(r.name || "Player")}</td>
          <td style="text-align:right">${Number(r.score) || 0}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

async function updateGlobalBlock(level) {
  const holder = document.getElementById("global-holder");
  const body = document.getElementById("global-body");
  if (!holder || !body) return;

  // highlight active tab
  ["easy","medium","hard"].forEach(lvl => {
    const b = document.getElementById(`gb-tab-${lvl}`);
    if (!b) return;
    b.classList.toggle("active", lvl === level);
  });

  body.innerHTML = `<div class="small">Loading…</div>`;
  const rows = await fetchGlobalLeaderboard(level, 10);
  body.innerHTML = renderGlobalRows(rows);
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

    box.innerHTML += `
      <div class="question-box">
        <div class="question-text">${esc(d.prompt)}</div>
        <input id="i-${l}" placeholder="Your answer" inputmode="text" />
        <button class="primary-btn" id="b-${l}">Submit Answer</button>
      </div>

      <button id="h-${l}" class="hint-btn">💡 Show hint</button>
      <div id="hint-${l}" class="hint hidden"></div>
    `;
    levelsEl.appendChild(box);

    // Hint once
    const hintBtn = document.getElementById(`h-${l}`);
    const hintBox = document.getElementById(`hint-${l}`);

    if (r.hintUsed) {
      hintBtn.disabled = true;
      hintBtn.textContent = "Hint shown";
      hintBox.textContent = d.hint || "No hint.";
      hintBox.classList.remove("hidden");
    }

    hintBtn.onclick = e => {
      r.hintUsed = true;
      hintBox.textContent = d.hint || "No hint.";
      hintBox.classList.remove("hidden");
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = "Hint shown";
      saveStore(store);
    };

    // Submit
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

        // ✅ Send per-level to global once, when level is completed
        // (Anti-spam ensures once per day per level)
        submitGlobal(r.points || 0, l);

        render(set, store);
        showResult(set, store);
      }
    };
  });

  showResult(set, store);
}

// ---------- Leaderboard (Local) ----------
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
async function showResult(set, store) {
  // keep global for the player UI re-render
  window.__brainSet = set;
  window.__brainStore = store;

  const k = todayKey();
  const r = dayRec(store, k);

  // only show daily result when medium done (your rule)
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

  const total = LEVELS.reduce((s,l)=>s+(r.levels[l].points||0),0);

  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `
    <h3>Today's Result</h3>
    <div class="small">Score: ${total}/30</div>
    <div class="small" style="margin-top:4px; opacity:.9">Global name: <strong>${esc(getPlayerName())}</strong></div>

    ${localLeaderboard(store)}

    <div id="global-holder" style="margin-top:18px">
      <h4 style="margin:0">🌍 Global Leaderboard</h4>
      ${globalTabsHTML("easy")}
      <div id="global-body"></div>
    </div>
  `;

  // Wire tabs
  ["easy","medium","hard"].forEach(lvl => {
    const b = document.getElementById(`gb-tab-${lvl}`);
    if (!b) return;
    b.onclick = () => updateGlobalBlock(lvl);
  });

  // Default load Easy
  updateGlobalBlock("easy");
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
  ensureDeviceId(); // client-side fingerprint base (local only)
  countdown();
  initPlayerUI();

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
