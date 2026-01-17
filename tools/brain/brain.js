// ==========================================
// EverydayTools.uk — Daily Brain (Full Version)
// Global leaderboard + local best days + streak
// ==========================================

// ------- Config -------
const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";
const FILTER_KEY = "et_brain_filter_v1";
const SUBSCRIBE_KEY = "et_brain_subscribed";

// If your JSON starts at this date:
const START_DATE = "2026-01-12";

// ------- Date Helpers -------
const todayKey = () => new Date().toISOString().slice(0, 10);

const msToNextUtcMidnight = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - Date.now();
};

const fmtHMS = ms => {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

// ------- Global State -------
let setsData = null;
let localStore = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");

// ====== Load sets JSON ======
async function loadSets() {
  const res = await fetch(DATA_URL);
  setsData = await res.json();
}

// ====== Timer (resets) ======
function startResetCountdown() {
  const el = document.querySelector("#resetTimer");
  if (!el) return;

  function tick() {
    el.textContent = fmtHMS(msToNextUtcMidnight());
  }
  tick();
  setInterval(tick, 1000);
}

// ====== Render Q/A ======
function renderSet(level) {
  const date = todayKey();
  const obj = setsData[date];
  if (!obj) return;

  const qs = obj[level];
  const box = document.querySelector("#questionsBox");
  if (!box) return;

  box.innerHTML = "";
  qs.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "brain-question-card";
    div.innerHTML = `
      <div class="brain-q">${q.q}</div>
      <input id="ans_${i}" class="brain-ans" placeholder="Your answer" />
      <button class="brain-hint">💡 Show hint</button>
      <div class="brain-hint-box hidden">${q.hint}</div>
    `;
    div.querySelector(".brain-hint").onclick = () =>
      div.querySelector(".brain-hint-box").classList.toggle("hidden");
    box.appendChild(div);
  });
}

// ====== Submit ======
async function submitAnswers(level) {
  const date = todayKey();
  const qs = setsData[date][level];

  let score = 0;
  qs.forEach((q, i) => {
    const v = (document.querySelector(`#ans_${i}`).value || "").trim().toLowerCase();
    if (v === q.a.toLowerCase()) score++;
  });

  // Save local best days + streak
  if (!localStore.best) localStore.best = {};
  localStore.best[date] = score;

  updateStreak(score);
  saveLocalStore();

  // Submit to global leaderboard
  const nameEl = document.querySelector("#playerName");
  const playerName = (nameEl?.value || "Player").trim().slice(0, 40);

  await fetch("/api/brain-submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: playerName, score, date })
  });

  renderBestDays();
  loadGlobalLeaderboard();

  alert(`Score: ${score}/${qs.length}`);
}

// ====== Local streak logic ======
function updateStreak(score) {
  if (!localStore.streak) {
    localStore.streak = 0;
    localStore.lastDate = null;
  }

  const date = todayKey();
  if (score > 0) {
    // Scored today
    if (localStore.lastDate === yesterdayKey()) {
      localStore.streak++;
    } else if (localStore.lastDate === date) {
      // Same day — keep same streak
    } else {
      localStore.streak = 1;
    }
    localStore.lastDate = date;
  }
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ====== Save store ======
function saveLocalStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(localStore));
}

// ====== Render Best Days ======
function renderBestDays() {
  const box = document.querySelector("#bestDays");
  if (!box) return;

  box.innerHTML = "";
  if (!localStore.best) return;

  Object.keys(localStore.best)
    .sort()
    .forEach(d => {
      const sc = localStore.best[d];
      const li = document.createElement("div");
      li.textContent = `${d} — ${sc}/30`;
      box.appendChild(li);
    });

  const streak = localStore.streak || 0;
  const st = document.querySelector("#streakBox");
  if (st) st.textContent = `🔥 Streak: ${streak}`;
}

// ====== Global Leaderboard ======
async function loadGlobalLeaderboard() {
  const box = document.querySelector("#globalLeaderboard");
  if (!box) return;

  box.innerHTML = "Loading...";

  try {
    const res = await fetch("/api/brain-leaderboard");
    const data = await res.json();

    if (!data.ok) {
      box.innerHTML = "Error loading leaderboard";
      return;
    }

    const rows = data.rows || [];
    if (rows.length === 0) {
      box.innerHTML = "No global scores yet.";
      return;
    }

    box.innerHTML = "";
    rows.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "brain-lb-row";
      div.textContent = `${i + 1}. ${r.name} — ${r.score} (${r.date})`;
      box.appendChild(div);
    });
  } catch (e) {
    box.innerHTML = "Error connecting to server.";
  }
}

// ====== Init ======
async function initBrain() {
  
  console.log("🚀 initBrain started");
  console.log("State:", localStore);


  await loadSets();
  startResetCountdown();
  renderBestDays();
  loadGlobalLeaderboard();

  // Default: EASY
  renderSet("easy");

  document.querySelector("#submitBtn")?.addEventListener("click", () => {
    submitAnswers("easy");
  });
}

initBrain();
document.addEventListener("DOMContentLoaded", () => {
  initBrain();
});
