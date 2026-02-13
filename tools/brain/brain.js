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
 * EXPECTED HTML IDs (recommended):
 * - #dateSelect   (select)
 * - #dayKey       (date label container)
 * - #questions    (questions container)
 * - #resultBox    (optional: status/errors)
 * - #btnPrevDay   (optional button)
 * - #btnNextDay   (optional button)
 * - #btnToday     (optional button)
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
  // If HTML comes back (404 page), show a useful error
  if (txt.trim().startsWith("<")) {
    throw new Error(`Expected JSON but got HTML from: ${url}`);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
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

// ---------- Catalog + Merge ----------
async function loadCatalog() {
  if (catalog) return catalog;
  catalog = await fetchJSON(CATALOG_URL);

  if (!catalog?.ranges?.length) {
    throw new Error("catalog.json has no ranges");
  }

  // Sort ranges by start date
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

  // Fetch sequentially (simpler and avoids rate limits)
  for (const r of cat.ranges) {
    if (!r?.url) continue;
    const data = await fetchJSON(r.url);
    mergeSets(merged, data);
  }

  allSets = merged;
  allDates = Object.keys(allSets).sort(); // YYYY-MM-DD sorts correctly
  if (!allDates.length) throw new Error("No dates found after merging ranges.");

  return allSets;
}

// ---------- UI: Dropdown ----------
function buildDateDropdown(selectedDate) {
  const sel = qs("dateSelect");
  if (!sel) return;

  sel.innerHTML = "";

  // Special option: Play all (start from first date)
  const optAll = document.createElement("option");
  optAll.value = "__ALL__";
  optAll.textContent = "Play all puzzles (start)";
  sel.appendChild(optAll);

  // Dates
  for (const d of allDates) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    sel.appendChild(opt);
  }

  // Determine initial selection
  const initial = allDates.includes(selectedDate) ? selectedDate : todayKeyUTC();
  sel.value = allDates.includes(initial) ? initial : allDates[allDates.length - 1];

  sel.addEventListener("change", () => {
    const v = sel.value;
    if (v === "__ALL__") {
      // Start from first date
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
  });
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

  const dateEl = qs("dayKey");
  if (dateEl) dateEl.textContent = dateKey;

  const container = qs("questions");
  if (!container) return;

  const dayObj = allSets?.[dateKey];
  const questions = pickThree(dayObj);

  if (!questions.length) {
    container.innerHTML = `<div class="muted">No puzzles found for ${dateKey}</div>`;
    return;
  }

  // Build UI with answer inputs
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
            <button class="q-check">Check</button>
          </div>
          <div class="q-feedback muted"></div>
        </div>
      `;
    })
    .join("");

  // Wire events
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

      // Save attempt
      store.answers = store.answers || {};
      store.answers[key] = { user: input.value, correct, at: Date.now() };
      saveStore();

      if (correct) {
        fb.textContent = "✅ Correct!";
        fb.classList.remove("bad");
        fb.classList.add("good");
      } else {
        // Show explanation safely
        const exp = q.explanation ? ` ${q.explanation}` : "";
        fb.textContent = `❌ Not quite. Correct answer: ${q.a}.${exp}`;
        fb.classList.remove("good");
        fb.classList.add("bad");
      }

      // Update daily score & optionally post it
      updateAndMaybeSubmitDayScore(dateKey);
    };

    btn.addEventListener("click", runCheck);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runCheck();
    });

    // Restore previous
    const prev = store.answers?.[`${dateKey}::${i}`];
    if (prev?.user != null) {
      input.value = prev.user;
      // Don't auto-check; keep it clean
    }
  });

  // Set dropdown selection (if user navigates via buttons)
  const sel = qs("dateSelect");
  if (sel && allDates.includes(dateKey)) {
    sel.value = dateKey;
  }

  // Save current
  store.current = dateKey;
  saveStore();
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Navigation (optional buttons) ----------
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
  const prev = qs("btnPrevDay");
  const next = qs("btnNextDay");
  const today = qs("btnToday");
  if (prev) prev.addEventListener("click", goPrev);
  if (next) next.addEventListener("click", goNext);
  if (today) today.addEventListener("click", goToday);
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

  // Store local score history
  store.scores = store.scores || {};
  store.scores[dateKey] = { score, updatedAt: Date.now() };
  saveStore();

  // Optionally display somewhere (if you have an element)
  const scoreEl = qs("dayScore");
  if (scoreEl) scoreEl.textContent = String(score);

  // Submit to API (optional)
  // Only submit if user has at least 1 correct (avoids spam)
  if (score <= 0) return;

  try {
    const res = await fetch(SCORE_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ day: dateKey, score }),
    });

    if (!res.ok) return; // silent fail
  } catch {
    // silent fail
  }
}

// ---------- Init ----------
(async function init() {
  try {
    setResult("Loading puzzles...");
    await loadAllSets();

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
// =====================================================
// Date Navigation + Dropdown (works with your HTML IDs)
// Supports: #dateSelect + #btnPrevDay/#btnToday/#btnNextDay
// Also supports: #pickDate + #btnPrev/#btnNext if present
// =====================================================

(function () {
  const $ = (id) => document.getElementById(id);

  const dateSelect = $("dateSelect");
  const pickDate = $("pickDate"); // hidden in your HTML (compat)
  const dayKeyEl = $("dayKey");
  const activeDateLabel = $("activeDateLabel"); // hidden (compat)

  const btnPrevDay = $("btnPrevDay");
  const btnNextDay = $("btnNextDay");
  const btnToday = $("btnToday");

  const btnPrev = $("btnPrev"); // hidden compat
  const btnNext = $("btnNext"); // hidden compat

  // --- helpers ---
  function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function fromKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(key, n) {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }

  // --- find which dates exist in your setsData (or fall back) ---
  function getAvailableKeys() {
    // 1) if your brain.js already loaded setsData like { "2026-01-12": {...}, ... }
    if (typeof setsData === "object" && setsData) {
      return Object.keys(setsData).sort();
    }

    // 2) if your data structure is { days: { "YYYY-MM-DD": ... } }
    if (typeof setsData === "object" && setsData && setsData.days) {
      return Object.keys(setsData.days).sort();
    }

    // 3) fallback: only today
    return [toKey(new Date())];
  }

  function nearestExisting(key, keys) {
    if (!keys.length) return key;
    if (keys.includes(key)) return key;

    // pick closest by date
    const target = new Date(key).getTime();
    let best = keys[0];
    let bestDist = Math.abs(new Date(best).getTime() - target);
    for (const k of keys) {
      const dist = Math.abs(new Date(k).getTime() - target);
      if (dist < bestDist) {
        best = k;
        bestDist = dist;
      }
    }
    return best;
  }

  // --- IMPORTANT: call your real render function ---
  function renderByKey(key) {
    // update date labels
    if (dayKeyEl) dayKeyEl.textContent = key;
    if (activeDateLabel) activeDateLabel.textContent = key;
    if (pickDate) pickDate.value = key;
    if (dateSelect) dateSelect.value = key;

    // Try common function names (so we don’t need to guess yours)
    if (typeof renderForDate === "function") return renderForDate(key);
    if (typeof renderDay === "function") return renderDay(key);
    if (typeof loadDay === "function") return loadDay(key);
    if (typeof render === "function") return render(key);

    console.warn(
      "No date render function found. Add one of: renderForDate(key) / renderDay(key) / loadDay(key) / render(key)"
    );
  }

  // --- fill dropdown ---
  function populateDropdown(keys, selectedKey) {
    if (!dateSelect) return;
    dateSelect.innerHTML = "";
    for (const k of keys) {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      dateSelect.appendChild(opt);
    }
    dateSelect.value = selectedKey;
  }

  // --- init after your data loads (retry a few times) ---
  function initNav() {
    const keys = getAvailableKeys();
    const today = toKey(new Date());
    const startKey = nearestExisting(today, keys);

    populateDropdown(keys, startKey);
    renderByKey(startKey);

    // Dropdown change
    if (dateSelect) {
      dateSelect.addEventListener("change", () => {
        if (!dateSelect.value) return;
        renderByKey(dateSelect.value);
      });
    }

    // Hidden pickDate (compat)
    if (pickDate) {
      pickDate.addEventListener("change", () => {
        if (!pickDate.value) return;
        renderByKey(pickDate.value);
      });
    }

    // Buttons
    const goPrev = () => {
      const current = (dateSelect && dateSelect.value) || (pickDate && pickDate.value) || today;
      // move to previous existing in list if possible
      const idx = keys.indexOf(current);
      const nextKey = idx > 0 ? keys[idx - 1] : addDays(current, -1);
      renderByKey(nearestExisting(nextKey, keys));
    };

    const goNext = () => {
      const current = (dateSelect && dateSelect.value) || (pickDate && pickDate.value) || today;
      const idx = keys.indexOf(current);
      const nextKey = (idx >= 0 && idx < keys.length - 1) ? keys[idx + 1] : addDays(current, +1);
      renderByKey(nearestExisting(nextKey, keys));
    };

    const goToday = () => renderByKey(nearestExisting(today, keys));

    if (btnPrevDay) btnPrevDay.addEventListener("click", goPrev);
    if (btnNextDay) btnNextDay.addEventListener("click", goNext);
    if (btnToday) btnToday.addEventListener("click", goToday);

    // compat hidden buttons
    if (btnPrev) btnPrev.addEventListener("click", goPrev);
    if (btnNext) btnNext.addEventListener("click", goNext);
  }

  // Retry init in case setsData loads async
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    // if your setsData becomes available later, this catches it
    const keys = getAvailableKeys();
    if (keys && keys.length) {
      clearInterval(t);
      initNav();
    }
    if (tries >= 25) {
      clearInterval(t);
      initNav(); // fallback anyway
    }
  }, 120);
})();

