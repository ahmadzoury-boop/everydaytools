console.log("✅ brain.js loaded: v=20260213-1 (catalog)");

// ================================================
// EverydayTools.uk — Daily Brain (brain.js)
// Catalog-based puzzles + Date dropdown + Play-all
// Works with multiple monthly JSON files (keeps old data)
// ================================================

/**
 * REQUIRED FILES:
 * - /tools/brain/data/catalog.json
 *   {
 *     "ranges":[
 *       {"from":"YYYY-MM-DD","to":"YYYY-MM-DD","url":"/tools/brain/data/sets-....json"},
 *       ...
 *     ]
 *   }
 *
 * EXPECTED HTML IDs:
 * - #dateSelect   (select)
 * - #dayKey       (date label container)
 * - #questions    (questions container)
 * - #resultBox    (optional: status/errors)
 * - #btnPrevDay   (button)
 * - #btnNextDay   (button)
 * - #btnToday     (button)
 *
 * OPTIONAL COMPAT IDs (won’t hurt if missing):
 * - #pickDate     (input[type=date])
 * - #btnPrev      (button)
 * - #btnNext      (button)
 * - #activeDateLabel (span)
 */

const CATALOG_URL = "/tools/brain/data/catalog.json";
const STORE_KEY = "et_brain_v2_catalog";

// Optional API endpoints (will fail gracefully if not present)
const SCORE_API_URL = "/api/brain-score";
const LEADERBOARD_API_URL = "/api/brain-leaderboard";

// Optional: link on email etc
const BRAIN_PAGE_URL = "/tools/brain/";

// ---------- State ----------
let catalog = null;
let allSets = null; // merged object: { "YYYY-MM-DD": {easy:[],medium:[],hard:[]} }
let allDates = [];
let store = safeJSON(localStorage.getItem(STORE_KEY), {});

// ---------- Helpers ----------
function safeJSON(s, fallback) {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function saveStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function todayKeyUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  const txt = await r.text();
  if (txt.trim().startsWith("<")) {
    throw new Error(`Expected JSON but got HTML from: ${url}`);
  }
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`Invalid JSON from: ${url}`);
  }
}

function qs(id) {
  return document.getElementById(id);
}

function setResult(msg, isError = false) {
  const box = qs("resultBox");
  if (!box) return;
  box.textContent = msg || "";
  box.style.opacity = msg ? "1" : "0";
  box.style.color = isError ? "crimson" : "";
}

function normalizeAnswer(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Catalog + Merge ----------
async function loadCatalog() {
  if (catalog) return catalog;
  catalog = await fetchJSON(CATALOG_URL);

  if (!catalog?.ranges?.length) {
    throw new Error("catalog.json has no ranges");
  }

  catalog.ranges.sort((a, b) => (a.from < b.from ? -1 : 1));
  return catalog;
}

function mergeSets(target, source) {
  for (const [day, obj] of Object.entries(source || {})) {
    target[day] = obj;
  }
  return target;
}

async function loadAllSets() {
  if (allSets) return allSets;

  const cat = await loadCatalog();
  const merged = {};

  for (const r of cat.ranges) {
    if (!r?.url) continue;
    const data = await fetchJSON(r.url);
    mergeSets(merged, data);
  }

  allSets = merged;
  allDates = Object.keys(allSets).sort();
  if (!allDates.length) throw new Error("No dates found after merging ranges.");

  return allSets;
}

// ---------- UI: Dropdown ----------
function buildDateDropdown(selectedDate) {
  const sel = qs("dateSelect");
  if (!sel) return;

  sel.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "__ALL__";
  optAll.textContent = "Play all puzzles (start)";
  sel.appendChild(optAll);

  for (const d of allDates) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    sel.appendChild(opt);
  }

  const initial = allDates.includes(selectedDate) ? selectedDate : todayKeyUTC();
  sel.value = allDates.includes(initial) ? initial : allDates[allDates.length - 1];

  // IMPORTANT: avoid stacking listeners if this ever runs again
  sel.onchange = () => {
    const v = sel.value;
    if (v === "__ALL__") {
      store.mode = "all";
      store.current = allDates[0];
      saveStore();
      renderDay(store.current);
    } else {
      store.mode = "single";
      store.current = v;
      saveStore();
      renderDay(v);
    }
  };
}

// ---------- Questions pick (3 per day: easy+medium+hard) ----------
function pickThree(dayObj) {
  if (!dayObj) return [];

  const out = [];
  if (Array.isArray(dayObj.easy) && dayObj.easy.length) out.push({ diff: "easy", ...dayObj.easy[0] });
  if (Array.isArray(dayObj.medium) && dayObj.medium.length) out.push({ diff: "medium", ...dayObj.medium[0] });
  if (Array.isArray(dayObj.hard) && dayObj.hard.length) out.push({ diff: "hard", ...dayObj.hard[0] });

  return out;
}

// ---------- Render ----------
function renderDay(dateKey) {
  setResult("");

  // keep day label in sync (and optional compat labels)
  const dateEl = qs("dayKey");
  if (dateEl) dateEl.textContent = dateKey;
  const activeDateLabel = qs("activeDateLabel");
  if (activeDateLabel) activeDateLabel.textContent = dateKey;
  const pickDate = qs("pickDate");
  if (pickDate) pickDate.value = dateKey;

  const container = qs("questions");
  if (!container) return;

  const dayObj = allSets?.[dateKey];
  const questions = pickThree(dayObj);

  if (!questions.length) {
    container.innerHTML = `<div class="muted">No puzzles found for ${escapeHTML(dateKey)}</div>`;
    store.current = dateKey;
    saveStore();
    return;
  }

  container.innerHTML = questions
    .map((q, idx) => {
      const hintHtml = q.hint
        ? `<div class="q-hint"><b>Hint:</b> ${escapeHTML(q.hint)}</div>`
        : "";

      return `
        <div class="q-card" data-idx="${idx}">
          <div class="q-top">
            <div class="q-badge">${escapeHTML((q.diff || "").toUpperCase())}</div>
            <div class="q-title">Q${idx + 1}</div>
          </div>
          <div class="q-text">${escapeHTML(q.q || "")}</div>
          ${hintHtml}
          <div class="q-answer">
            <input class="q-input" type="text" placeholder="Your answer..." />
            <button class="q-check" type="button">Check</button>
          </div>
          <div class="q-feedback muted"></div>
        </div>
      `;
    })
    .join("");

  const cards = Array.from(container.querySelectorAll(".q-card"));
  cards.forEach((card) => {
    const i = Number(card.getAttribute("data-idx"));
    const q = questions[i];
    const input = card.querySelector(".q-input");
    const btn = card.querySelector(".q-check");
    const fb = card.querySelector(".q-feedback");

    const runCheck = () => {
      const user = normalizeAnswer(input.value);
      const ans = normalizeAnswer(q.a);

      const correct = user.length > 0 && user === ans;
      const key = `${dateKey}::${i}`;

      store.answers = store.answers || {};
      store.answers[key] = { user: input.value, correct, at: Date.now() };
      saveStore();

      if (correct) {
        fb.textContent = "✅ Correct!";
        fb.classList.remove("bad");
        fb.classList.add("good");
      } else {
        const exp = q.explanation ? ` ${q.explanation}` : "";
        fb.textContent = `❌ Not quite. Correct answer: ${q.a}.${exp}`;
        fb.classList.remove("good");
        fb.classList.add("bad");
      }

      updateAndMaybeSubmitDayScore(dateKey);

      // If user is in Play-all mode AND finished all 3 correct, auto-advance
      if (store.mode === "all" && computeDayScore(dateKey) >= 3) {
        const idx = idxOfDate(dateKey);
        if (idx >= 0 && idx < allDates.length - 1) {
          // small delay so user sees the success message
          setTimeout(() => renderDay(allDates[idx + 1]), 450);
        }
      }
    };

    btn.addEventListener("click", runCheck);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runCheck();
    });

    const prev = store.answers?.[`${dateKey}::${i}`];
    if (prev?.user != null) {
      input.value = prev.user;
    }
  });

  // Keep dropdown in sync (if navigated via buttons)
  const sel = qs("dateSelect");
  if (sel && allDates.includes(dateKey)) sel.value = dateKey;

  store.current = dateKey;
  saveStore();
}

// ---------- Navigation ----------
function idxOfDate(dateKey) {
  return allDates.indexOf(dateKey);
}

function goPrev() {
  const cur = store.current || todayKeyUTC();
  const i = idxOfDate(cur);
  if (i > 0) renderDay(allDates[i - 1]);
}

function goNext() {
  const cur = store.current || todayKeyUTC();
  const i = idxOfDate(cur);
  if (i >= 0 && i < allDates.length - 1) renderDay(allDates[i + 1]);
}

function goToday() {
  const t = todayKeyUTC();
  if (allDates.includes(t)) renderDay(t);
  else renderDay(allDates[allDates.length - 1]);
}

function wireNavButtons() {
  // Main IDs (your HTML)
  const prevDay = qs("btnPrevDay");
  const nextDay = qs("btnNextDay");
  const today = qs("btnToday");

  if (prevDay) prevDay.addEventListener("click", goPrev);
  if (nextDay) nextDay.addEventListener("click", goNext);
  if (today) today.addEventListener("click", goToday);

  // Compat IDs (in case you keep hidden buttons in HTML)
  const prev = qs("btnPrev");
  const next = qs("btnNext");

  if (prev) prev.addEventListener("click", goPrev);
  if (next) next.addEventListener("click", goNext);

  // Compat date input (optional): changing it renders that date
  const pickDate = qs("pickDate");
  if (pickDate) {
    pickDate.onchange = () => {
      if (!pickDate.value) return;
      if (allDates.includes(pickDate.value)) {
        store.mode = "single";
        store.current = pickDate.value;
        saveStore();
        renderDay(pickDate.value);
      }
    };
  }
}

// ---------- Scoring ----------
function computeDayScore(dateKey) {
  const dayObj = allSets?.[dateKey];
  const questions = pickThree(dayObj);
  if (!questions.length) return 0;

  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    const attempt = store.answers?.[`${dateKey}::${i}`];
    if (attempt?.correct) score += 1;
  }
  return score; // 0..3
}

async function updateAndMaybeSubmitDayScore(dateKey) {
  const score = computeDayScore(dateKey);

  store.scores = store.scores || {};
  store.scores[dateKey] = { score, updatedAt: Date.now() };
  saveStore();

  const scoreEl = qs("dayScore");
  if (scoreEl) scoreEl.textContent = String(score);

  if (score <= 0) return;

  try {
    const res = await fetch(SCORE_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ day: dateKey, score }),
    });
    if (!res.ok) return;
  } catch {
    // silent fail
  }
}

// ---------- Init ----------
(async function init() {
  try {
    setResult("Loading puzzles...");
    await loadAllSets();
    setResult(`Loaded ${allDates.length} days · ${allDates[0]} → ${allDates[allDates.length - 1]}`);


    // Decide initial date
    const saved = store.current;
    let start = saved && allDates.includes(saved) ? saved : todayKeyUTC();
    if (!allDates.includes(start)) start = allDates[allDates.length - 1];

    // Build UI
    buildDateDropdown(start);
    wireNavButtons();

    // Render start
    renderDay(start);

    setResult("");
  } catch (e) {
    console.error(e);
    setResult(`Error: ${String(e?.message || e)}`, true);
    const container = qs("questions");
    if (container) {
      container.innerHTML = `<div class="muted">Failed to load puzzles. Check console.</div>`;
    }
  }
})();
