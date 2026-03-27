/* =========================================================
   EverydayTools.uk — Daily Brain (brain.js)
   Multi-file loader + recycle + full UI wiring
========================================================= */

const DATA_BASE = "/tools/brain/data/";

const DATA_RANGES = [
  { from: "2026-01-12", to: "2026-02-10", file: "sets-2026-01-12_to_2026-02-10.json" },
  { from: "2026-02-11", to: "2026-03-10", file: "sets-2026-02-11_to_2026-03-10.json" },
  { from: "2026-03-11", to: "2026-04-09", file: "sets-2026-03-11_to_2026-04-09.json" },
  { from: "2026-04-10", to: "2026-05-09", file: "sets-2026-04-10_to_2026-05-09.json" },
];

const __SETS_CACHE = new Map();
const STORE_KEY = "et_brain_v2";

/* ================= HELPERS ================= */

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
  return Math.floor((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

function getGlobalSpan() {
  const sorted = [...DATA_RANGES].sort((a, b) => a.from.localeCompare(b.from));
  return { start: sorted[0].from, end: sorted[sorted.length - 1].to };
}

function mapDateToCycle(requestedDayKey) {
  const { start, end } = getGlobalSpan();

  if (requestedDayKey >= start && requestedDayKey <= end) {
    return { effective: requestedDayKey, cycled: false };
  }

  const spanDays = daysBetween(start, end) + 1;

  if (requestedDayKey > end) {
    const offset = daysBetween(end, requestedDayKey);
    const idx = (offset - 1) % spanDays;
    return { effective: addDays(start, idx), cycled: true };
  }

  const offsetBack = daysBetween(requestedDayKey, start);
  const idxBack = (offsetBack - 1) % spanDays;
  return { effective: addDays(end, -idxBack), cycled: true };
}

function pickFileForDate(day) {
  return DATA_RANGES.find(r => dateInRange(day, r.from, r.to));
}

async function fetchSetsFile(url) {
  if (__SETS_CACHE.has(url)) return __SETS_CACHE.get(url);

  const p = fetch(url, { cache: "no-store" }).then(r => {
    if (!r.ok) throw new Error(`Failed loading sets: ${r.status}`);
    return r.json();
  });

  __SETS_CACHE.set(url, p);
  return p;
}

async function loadSetsForDay(requestedDayKey) {
  const { effective, cycled } = mapDateToCycle(requestedDayKey);
  const range = pickFileForDate(effective);

  if (!range) throw new Error("No data file found");

  const sets = await fetchSetsFile(DATA_BASE + range.file);
  const day = sets[effective] || Object.values(sets)[0];

  return { day, dayKey: effective, cycled };
}

/* ================= STORAGE ================= */

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}

function writeStore(s) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

let store = readStore();

function getDayStore(key) {
  store.days ||= {};
  store.days[key] ||= { score: 0, answers: {} };
  return store.days[key];
}

/* ================= UTIL ================= */

function normalizeAnswer(s) {
  return String(s || "").trim().toLowerCase();
}

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ================= DOM ================= */

let elQuestions, elResultBox, elDayKey, elDayScore, elDateSelect;
let currentSelectedDay = getTodayUTC();

/* ================= CARD ================= */

function makeCard(q, group, index, dayKey) {
  const expected = q.a;
  const wrap = document.createElement("div");
  wrap.className = "q-card";

  const input = document.createElement("input");
  const btn = document.createElement("button");
  const feedback = document.createElement("div");

  input.placeholder = "Your answer";
  btn.textContent = "Check";

  const answerKey = `${group}_${index}`;
  let attempts = 0;

  btn.onclick = () => {
    const val = normalizeAnswer(input.value);
    const ok = Array.isArray(expected)
      ? expected.map(normalizeAnswer).includes(val)
      : val === normalizeAnswer(expected);

    const rec = getDayStore(dayKey);

    if (ok) {
      rec.answers[answerKey] = { correct: true };
      rec.score = Object.values(rec.answers).filter(x => x.correct).length;
      writeStore(store);

      feedback.textContent = "✅ Correct";
      feedback.style.color = "#4ade80";
    } else {
      attempts++;

      if (attempts === 1) {
        feedback.textContent = "❌ Try again — think about the pattern";
      } else if (attempts === 2) {
        feedback.textContent = "💡 Hint: " + (q.hint || "");
      } else {
        if (!wrap.querySelector(".reveal-btn")) {
          const reveal = document.createElement("button");
          reveal.textContent = "Reveal Answer";
          reveal.className = "reveal-btn";

          reveal.onclick = () => {
            const ans = Array.isArray(expected) ? expected[0] : expected;
            feedback.innerHTML = `✅ ${escapeHtml(ans)}<br><small>${escapeHtml(q.explanation || "")}</small>`;
            input.disabled = true;
            btn.disabled = true;
          };

          wrap.appendChild(reveal);
        }
      }
    }

    updatePanels(dayKey);
  };

  wrap.innerHTML = `
    <strong>${group}</strong>
    <div class="brain-puzzle">${q.q}</div>
  `;

  wrap.appendChild(input);
  wrap.appendChild(btn);

  // shapes
  const bar = document.createElement("div");
  ["▲","■","○","△","□"].forEach(s => {
    const b = document.createElement("button");
    b.textContent = s;
    b.onclick = () => input.value += s;
    bar.appendChild(b);
  });

  wrap.appendChild(bar);

  // helper
  const helper = document.createElement("div");
  helper.textContent = "Answer using number, word, or symbol";
  helper.style.opacity = "0.7";
  helper.style.fontSize = "12px";
  wrap.appendChild(helper);

  wrap.appendChild(feedback);

  return wrap;
}

/* ================= UI ================= */

function updatePanels(dayKey) {
  const rec = getDayStore(dayKey);
  elDayScore.textContent = rec.score || 0;
}

async function render(dayKey = currentSelectedDay) {
  elQuestions.innerHTML = "Loading...";

  const { day, dayKey: key } = await loadSetsForDay(dayKey);

  elQuestions.innerHTML = "";

  ["easy","medium","hard"].forEach(group => {
    day[group]?.forEach((q, i) => {
      elQuestions.appendChild(makeCard(q, group, i, key));
    });
  });

  updatePanels(key);
}

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
  elQuestions = document.getElementById("questions");
  elDayScore = document.getElementById("dayScore");

  render();
});