// ================================
// EverydayTools.uk — Daily Brain
// MVP: 3 levels (Easy->Medium->Hard) with unlocks, hints, scoring, share
// Data: tools/brain/data/sets-2026-01-12_to_2026-02-10.json
// Reset: UTC midnight
// ================================

const DATA_URL = "./data/sets-2026-01-12_to_2026-02-10.json";
const STORE_KEY = "et_brain_v1";

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

// ---------- DOM ----------
const statusEl = document.getElementById("status");
const levelsEl = document.getElementById("levels");
const resultEl = document.getElementById("result");

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Normalization for answers ----------
function normalizeAnswer(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[£$€]/g, (m) => m) // keep currency symbols
    .replace(/[,]/g, ""); // allow 10,000 vs 10000
}

function isAccepted(input, acceptedArr) {
  const v = normalizeAnswer(input);
  return (acceptedArr || []).some(a => normalizeAnswer(a) === v);
}

// ---------- Render helpers ----------
function levelTitle(lvl) {
  if (lvl === "easy") return "Easy";
  if (lvl === "medium") return "Medium";
  return "Hard";
}

function levelLockedReason(lvl, dayRec) {
  if (lvl === "medium" && !dayRec.levels.easy.done) return "Complete Easy to unlock.";
  if (lvl === "hard" && !dayRec.levels.medium.done) return "Complete Medium to unlock.";
  return "";
}

function computeLevelPoints(lvl, maxAttempts, attempts, hintUsed, correct) {
  if (!correct) return 0;
  let pts = MAX_POINTS[lvl];
  // attempts includes the successful attempt; so wrong attempts = attempts-1
  const wrongs = Math.max(0, attempts - 1);
  pts -= wrongs * WRONG_PENALTY[lvl];
  if (hintUsed) pts -= HINT_PENALTY[lvl];
  return Math.max(0, pts);
}

function totalScore(dayRec) {
  return LEVELS.reduce((sum, lvl) => sum + (dayRec.levels[lvl].points || 0), 0);
}

function completedForStreak(dayRec) {
  // streak condition: Easy + Medium completed (done)
  return dayRec.levels.easy.done && dayRec.levels.medium.done;
}

// ---------- Streak logic ----------
function updateStreak(store, todayKey) {
  if (!store.streak) store.streak = { current: 0, best: 0, lastCompletedDate: null };

  const rec = getDayRecord(store, todayKey);
  const qualifies = completedForStreak(rec);

  if (!qualifies) return;

  const last = store.streak.lastCompletedDate;

  // If already counted today, do nothing
  if (last === todayKey) return;

  // Determine if last is yesterday (UTC)
  if (last) {
    const lastDate = new Date(`${last}T00:00:00Z`);
    const todayDate = new Date(`${todayKey}T00:00:00Z`);
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) store.streak.current += 1;
    else store.streak.current = 1;
  } else {
    store.streak.current = 1;
  }

  store.streak.best = Math.max(store.streak.best, store.streak.current);
  store.streak.lastCompletedDate = todayKey;
}

// ---------- Countdown ----------
function startCountdown() {
  const tick = () => {
    const left = msToNextUtcMidnight();
    const store = loadStore();
    const streak = store.streak?.current || 0;
    const best = store.streak?.best || 0;
    statusEl.innerHTML = `
      <span class="badge">Resets in ${esc(fmtCountdown(left))} (UTC)</span>
      &nbsp;&nbsp;
      <span class="badge">Streak 🔥 ${esc(streak)}</span>
      &nbsp;&nbsp;
      <span class="badge">Best ${esc(best)}</span>
    `;
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- Puzzle render ----------
function renderPuzzle(set, store) {
  const todayKey = utcTodayKey();
  const dayRec = getDayRecord(store, todayKey);

  levelsEl.innerHTML = "";
  resultEl.classList.add("hidden");
  resultEl.innerHTML = "";

  const startTimes = { easy: null, medium: null, hard: null };

  LEVELS.forEach((lvl) => {
    const data = set[lvl];
    const rec = dayRec.levels[lvl];

    const lockedReason = levelLockedReason(lvl, dayRec);
    const locked = Boolean(lockedReason);

    const box = document.createElement("section");
    box.className = "level";

    const header = `
      <h2>${levelTitle(lvl)}</h2>
      <div class="small">${esc(set.theme || "")} • Attempts: ${esc(data.maxAttempts)} • Type: ${esc(data.type)}</div>
    `;

    if (locked) {
      box.innerHTML = header + `<div class="hint">${esc(lockedReason)}</div>`;
      levelsEl.appendChild(box);
      return;
    }

    // If already done, show result
    if (rec.done) {
      const status = rec.correct ? "✅ Completed" : "❌ Completed";
      box.innerHTML = header + `
        <div style="margin-top:10px">
          <div><strong>${status}</strong></div>
          <div class="small">Attempts: ${esc(rec.attempts)} • Hint: ${esc(rec.hintUsed ? "Used" : "No")} • Points: ${esc(rec.points)}</div>
          <div class="small">${esc(data.explain || "")}</div>
        </div>
      `;
      levelsEl.appendChild(box);
      return;
    }

    // Active puzzle UI
    const promptHtml = renderPromptHtml(data, rec);
    box.innerHTML = header + `
      <div style="margin-top:10px">${promptHtml}</div>

      <div class="row">
        <input id="inp-${lvl}" autocomplete="off" placeholder="Type your answer…" />
        <button id="btn-${lvl}">Submit</button>
      </div>

      <div id="msg-${lvl}" class="small" style="margin-top:10px"></div>

      <div id="hint-${lvl}" class="hint hidden"></div>

      <div class="row" style="margin-top:10px">
        <button id="hintbtn-${lvl}" style="background:#1f6feb">Hint</button>
      </div>
    `;

    levelsEl.appendChild(box);

    const inp = document.getElementById(`inp-${lvl}`);
    const btn = document.getElementById(`btn-${lvl}`);
    const msg = document.getElementById(`msg-${lvl}`);
    const hintBox = document.getElementById(`hint-${lvl}`);
    const hintBtn = document.getElementById(`hintbtn-${lvl}`);

    startTimes[lvl] = Date.now();

    // Hint button
    hintBtn.onclick = () => {
      if (rec.hintUsed) return;
      rec.hintUsed = true;
      hintBox.textContent = data.hint || "No hint available.";
      hintBox.classList.remove("hidden");
      hintBtn.disabled = true;
      msg.textContent = `Hint used (−${HINT_PENALTY[lvl]} potential points).`;
      saveStore(store);
    };

    // Submit
    const submit = () => {
      const val = inp.value;
      if (!val.trim()) return;

      rec.attempts = (rec.attempts || 0) + 1;

      const ok = isAccepted(val, data.accepted);

      if (ok) {
        rec.done = true;
        rec.correct = true;
        rec.timeSec = Math.round((Date.now() - startTimes[lvl]) / 1000);
        rec.points = computeLevelPoints(lvl, data.maxAttempts, rec.attempts, rec.hintUsed, true);

        saveStore(store);
        // re-render to show completion + unlock next level
        renderPuzzle(set, store);
        maybeShowResult(set, store);
        return;
      }

      // wrong
      if (rec.attempts >= data.maxAttempts) {
        rec.done = true;
        rec.correct = false;
        rec.timeSec = Math.round((Date.now() - startTimes[lvl]) / 1000);
        rec.points = 0;

        saveStore(store);
        renderPuzzle(set, store);
        maybeShowResult(set, store);
        return;
      }

      // Provide progressive reveal for clues type
      if (data.type === "clues" && Array.isArray(data.clues)) {
        const idx = Math.min(rec.attempts, data.clues.length - 1);
        // show next clue in hint box (without marking as hint used)
        hintBox.textContent = `Next clue: ${data.clues[idx]}`;
        hintBox.classList.remove("hidden");
      } else {
        // show the regular hint box but still let user choose hint button for official hint
        msg.textContent = `Not quite. Tries left: ${data.maxAttempts - rec.attempts}.`;
      }

      saveStore(store);
    };

    btn.onclick = submit;
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });

  maybeShowResult(set, store);
}

function renderPromptHtml(data, rec) {
  // type-specific display
  if (data.type === "clues" && Array.isArray(data.clues)) {
    const shown = Math.max(1, Math.min(data.clues.length, rec.attempts + 1));
    const list = data.clues.slice(0, shown).map(c => `<li>${esc(c)}</li>`).join("");
    return `<div class="small">Guess the word:</div><ul>${list}</ul>`;
  }

  if (data.type === "odd" && Array.isArray(data.options)) {
    const opts = data.options.map(o => `<span class="badge" style="margin:4px 6px 0 0; display:inline-block;">${esc(o)}</span>`).join("");
    return `<div class="small">Odd one out:</div><div style="margin-top:8px">${opts}</div>`;
  }

  // default prompt
  return `<div>${esc(data.prompt || "")}</div>`;
}

// ---------- Results ----------
function maybeShowResult(set, store) {
  const todayKey = utcTodayKey();
  const dayRec = getDayRecord(store, todayKey);

  const allUnlockedLevelsDone =
    dayRec.levels.easy.done &&
    dayRec.levels.medium.done &&
    (dayRec.levels.hard.done || true); // hard can be skipped, but we still show result after medium

  // show after Medium is completed (and hard either done or not)
  if (!dayRec.levels.medium.done) return;

  updateStreak(store, todayKey);
  saveStore(store);

  const score = totalScore(dayRec);
  const easyDone = dayRec.levels.easy.done ? "✅" : "—";
  const medDone = dayRec.levels.medium.done ? "✅" : "—";
  const hardDone = dayRec.levels.hard.done ? (dayRec.levels.hard.correct ? "✅" : "❌") : "—";

  const streak = store.streak?.current || 0;

  const shareText =
`Daily Brain #${todayKey} 🧠 ${score}/30
Easy ${easyDone} | Medium ${medDone} | Hard ${hardDone}
Streak: ${streak}🔥
https://everydaytools.uk/tools/brain`;

  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `
    <h3 style="margin:0 0 8px">Today's Result</h3>
    <div class="small">Theme: ${esc(set.theme || "—")}</div>
    <div style="margin-top:8px"><strong>Score:</strong> ${esc(score)}/30</div>
    <div class="small" style="margin-top:6px">Easy: ${esc(dayRec.levels.easy.points)} pts • Medium: ${esc(dayRec.levels.medium.points)} pts • Hard: ${esc(dayRec.levels.hard.points)} pts</div>

    <div class="row" style="margin-top:12px">
      <button id="copyShare">Copy Share</button>
      <button id="viewStats" style="background:#6e7681">View Stats</button>
    </div>

    <pre id="shareBox" class="hint" style="white-space:pre-wrap; margin-top:12px">${esc(shareText)}</pre>
  `;

  document.getElementById("copyShare").onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      alert("Copied! Paste it on WhatsApp/Instagram/X ✅");
    } catch {
      alert("Copy failed. You can manually select the text in the box.");
    }
  };

  document.getElementById("viewStats").onclick = () => {
    showStats(store);
  };
}

// ---------- Stats modal (simple) ----------
function showStats(store) {
  const hist = store.history || {};
  const entries = Object.values(hist).sort((a, b) => a.date.localeCompare(b.date));

  const rows = entries.slice(-14).map((r) => {
    const s = (r.levels.easy.points || 0) + (r.levels.medium.points || 0) + (r.levels.hard.points || 0);
    const em = r.levels.easy.done ? "✅" : "—";
    const mm = r.levels.medium.done ? "✅" : "—";
    const hm = r.levels.hard.done ? (r.levels.hard.correct ? "✅" : "❌") : "—";
    return `<tr>
      <td>${esc(r.date)}</td>
      <td>${esc(s)}/30</td>
      <td>${esc(em)}</td>
      <td>${esc(mm)}</td>
      <td>${esc(hm)}</td>
    </tr>`;
  }).join("");

  const streak = store.streak?.current || 0;
  const best = store.streak?.best || 0;

  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `
    <h3 style="margin:0 0 8px">Stats</h3>
    <div class="small">Streak 🔥 ${esc(streak)} • Best ${esc(best)}</div>

    <table style="width:100%; margin-top:12px; border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid var(--border); padding:8px 6px">Date</th>
          <th style="text-align:left; border-bottom:1px solid var(--border); padding:8px 6px">Score</th>
          <th style="text-align:left; border-bottom:1px solid var(--border); padding:8px 6px">E</th>
          <th style="text-align:left; border-bottom:1px solid var(--border); padding:8px 6px">M</th>
          <th style="text-align:left; border-bottom:1px solid var(--border); padding:8px 6px">H</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5" class="small" style="padding:10px">No history yet.</td></tr>`}</tbody>
    </table>

    <div class="row" style="margin-top:12px">
      <button id="backToday" style="background:#6e7681">Back to Today</button>
      <button id="resetLocal" style="background:#b62324">Reset Local Data</button>
    </div>
  `;

  document.getElementById("backToday").onclick = () => location.reload();
  document.getElementById("resetLocal").onclick = () => {
    if (confirm("This will clear your local Daily Brain progress on this device. Continue?")) {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }
  };
}

// ---------- Main ----------
async function main() {
  startCountdown();

  const todayKey = utcTodayKey();
  const store = loadStore();
  getDayRecord(store, todayKey); // ensure exists
  saveStore(store);

  let data;
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    levelsEl.innerHTML = `<div class="level"><strong>Could not load puzzles.</strong><div class="small">Check the JSON path and try again.</div></div>`;
    return;
  }

  const set = (data.sets || []).find(s => s.date === todayKey);

  if (!set) {
    levelsEl.innerHTML = `
      <div class="level">
        <h2>Today's set not found</h2>
        <div class="small">UTC date: ${esc(todayKey)}</div>
        <div class="hint">You can add more dates to the JSON file later.</div>
      </div>
    `;
    return;
  }

  renderPuzzle(set, store);
}

main();
