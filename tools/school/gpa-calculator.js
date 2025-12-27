(() => {
  const LS_KEY = "gpa_calc_v1";

  const gradeModeEl = document.getElementById("gradeMode");
  const scaleEl = document.getElementById("scale");
  const weightedOnEl = document.getElementById("weightedOn");
  const capWrap = document.getElementById("capWrap");
  const weightedCapEl = document.getElementById("weightedCap");

  const addCourseBtn = document.getElementById("addCourseBtn");
  const add5Btn = document.getElementById("add5Btn");
  const clearBtn = document.getElementById("clearBtn");
  const copyBtn = document.getElementById("copyBtn");

  const tbody = document.getElementById("tbody");
  const gradeHead = document.getElementById("gradeHead");
  const levelHead = document.getElementById("levelHead");

  const gpaText = document.getElementById("gpaText");
  const creditsPill = document.getElementById("creditsPill");
  const pointsPill = document.getElementById("pointsPill");
  const wgpaPill = document.getElementById("wgpaPill");
  const metaText = document.getElementById("metaText");

  function clampNum(v, min, max = Infinity) {
    v = Number(v);
    if (!Number.isFinite(v)) v = min;
    v = Math.max(min, v);
    v = Math.min(max, v);
    return v;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // Letter -> points mapping
  function letterMap(scale) {
    const base = {
      "A+": 4.0, "A": 4.0, "A-": 3.7,
      "B+": 3.3, "B": 3.0, "B-": 2.7,
      "C+": 2.3, "C": 2.0, "C-": 1.7,
      "D+": 1.3, "D": 1.0, "D-": 0.7,
      "F": 0.0
    };
    if (scale === 4.3) base["A+"] = 4.3;
    return base;
  }

  const LETTERS = ["A+","A","A-","B+","B","B-","C+","C","C-","D+","D","D-","F"];

  function percentToLetter(p) {
    // Common US-style +/- cutoffs (can differ by school)
    if (p >= 97) return "A+";
    if (p >= 93) return "A";
    if (p >= 90) return "A-";
    if (p >= 87) return "B+";
    if (p >= 83) return "B";
    if (p >= 80) return "B-";
    if (p >= 77) return "C+";
    if (p >= 73) return "C";
    if (p >= 70) return "C-";
    if (p >= 67) return "D+";
    if (p >= 63) return "D";
    if (p >= 60) return "D-";
    return "F";
  }

  const LEVELS = [
    { key: "regular", label: "Regular", bonus: 0.0 },
    { key: "honors",  label: "Honors (+0.5)", bonus: 0.5 },
    { key: "ap",      label: "AP/IB (+1.0)", bonus: 1.0 },
  ];

  // State
  let state = {
    gradeMode: "letter",
    scale: "4.0",
    weightedOn: false,
    weightedCap: 5.0,
    courses: []
  };

  function save() {
    state.gradeMode = gradeModeEl.value;
    state.scale = scaleEl.value;
    state.weightedOn = !!weightedOnEl.checked;
    state.weightedCap = clampNum(weightedCapEl.value, 0, 20);

    // courses from DOM
    state.courses = getRows().map(row => {
      const name = row.querySelector('[data-f="name"]').value || "";
      const credits = clampNum(row.querySelector('[data-f="credits"]').value, 0, 100);

      const gradeMode = gradeModeEl.value;
      let gradeValue = "";
      if (gradeMode === "letter") gradeValue = row.querySelector('[data-f="letter"]').value;
      if (gradeMode === "percent") gradeValue = row.querySelector('[data-f="percent"]').value;
      if (gradeMode === "points") gradeValue = row.querySelector('[data-f="points"]').value;

      const level = row.querySelector('[data-f="level"]')?.value || "regular";

      return { name, credits, gradeValue, level };
    });

    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;

      state.gradeMode = d.gradeMode || "letter";
      state.scale = d.scale || "4.0";
      state.weightedOn = !!d.weightedOn;
      state.weightedCap = clampNum(d.weightedCap ?? 5.0, 0, 20);

      if (Array.isArray(d.courses)) {
        state.courses = d.courses.map(c => ({
          name: c.name || "",
          credits: clampNum(c.credits ?? 0, 0, 100),
          gradeValue: (c.gradeValue ?? ""),
          level: (c.level === "honors" || c.level === "ap") ? c.level : "regular"
        }));
      }
    } catch {}
  }

  function getRows() {
    return Array.from(tbody.querySelectorAll("tr"));
  }

  function makeGradeCell(gradeMode, scaleNum, storedValue = "") {
    const td = document.createElement("td");

    if (gradeMode === "letter") {
      const sel = document.createElement("select");
      sel.setAttribute("data-f", "letter");
      LETTERS.forEach(l => {
        const o = document.createElement("option");
        o.value = l;
        o.textContent = l;
        sel.appendChild(o);
      });
      sel.value = storedValue && LETTERS.includes(storedValue) ? storedValue : "A";
      td.appendChild(sel);
      return td;
    }

    if (gradeMode === "percent") {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.max = "100";
      inp.step = "0.1";
      inp.placeholder = "e.g. 88.5";
      inp.setAttribute("data-f", "percent");
      inp.value = storedValue !== "" ? storedValue : "90";
      td.appendChild(inp);
      return td;
    }

    // points
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.max = String(scaleNum);
    inp.step = "0.01";
    inp.placeholder = `0–${scaleNum}`;
    inp.setAttribute("data-f", "points");
    inp.value = storedValue !== "" ? storedValue : String(scaleNum);
    td.appendChild(inp);
    return td;
  }

  function makeLevelCell(storedLevel = "regular") {
    const td = document.createElement("td");
    td.className = "levelCell";
    const sel = document.createElement("select");
    sel.setAttribute("data-f", "level");
    LEVELS.forEach(L => {
      const o = document.createElement("option");
      o.value = L.key;
      o.textContent = L.label;
      sel.appendChild(o);
    });
    sel.value = storedLevel;
    td.appendChild(sel);
    return td;
  }

  function addCourseRow(course = null) {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    const nameIn = document.createElement("input");
    nameIn.placeholder = "e.g. Math 101";
    nameIn.setAttribute("data-f", "name");
    nameIn.value = course?.name || "";
    nameTd.appendChild(nameIn);

    const creditsTd = document.createElement("td");
    const creditsIn = document.createElement("input");
    creditsIn.type = "number";
    creditsIn.min = "0";
    creditsIn.step = "0.5";
    creditsIn.placeholder = "e.g. 3";
    creditsIn.setAttribute("data-f", "credits");
    creditsIn.value = (course?.credits ?? 3);
    creditsTd.appendChild(creditsIn);

    const scaleNum = Number(scaleEl.value);
    const gradeTd = makeGradeCell(gradeModeEl.value, scaleNum, course?.gradeValue ?? "");

    const levelTd = makeLevelCell(course?.level ?? "regular");

    const pointsTd = document.createElement("td");
    pointsTd.className = "muted";
    pointsTd.setAttribute("data-f", "rowPoints");
    pointsTd.textContent = "—";

    const actionsTd = document.createElement("td");
    actionsTd.className = "actions";
    const delBtn = document.createElement("button");
    delBtn.className = "mini";
    delBtn.textContent = "Del";
    actionsTd.appendChild(delBtn);

    tr.appendChild(nameTd);
    tr.appendChild(creditsTd);
    tr.appendChild(gradeTd);
    tr.appendChild(levelTd);
    tr.appendChild(pointsTd);
    tr.appendChild(actionsTd);

    // delete
    delBtn.addEventListener("click", () => {
      tr.remove();
      save();
      recalc();
    });

    // inputs change
    tr.querySelectorAll("input,select").forEach(el => {
      el.addEventListener("input", () => { save(); recalc(); });
      el.addEventListener("change", () => { save(); recalc(); });
    });

    tbody.appendChild(tr);
    applyWeightedVisibility();
    save();
    recalc();
  }

  function applyWeightedVisibility() {
    const on = !!weightedOnEl.checked;
    capWrap.classList.toggle("hidden", !on);
    levelHead.classList.toggle("hidden", !on);
    wgpaPill.classList.toggle("hidden", !on);

    // show/hide each level cell
    getRows().forEach(tr => {
      const levelTd = tr.querySelector(".levelCell");
      if (levelTd) levelTd.classList.toggle("hidden", !on);
    });
  }

  function rebuildTableForGradeMode() {
    // rebuild grade cell for each row, preserving gradeValue as much as possible
    const scaleNum = Number(scaleEl.value);
    const mode = gradeModeEl.value;

    getRows().forEach(tr => {
      // read old value (best effort)
      let old = "";
      const oldLetter = tr.querySelector('[data-f="letter"]');
      const oldPercent = tr.querySelector('[data-f="percent"]');
      const oldPoints = tr.querySelector('[data-f="points"]');
      if (oldLetter) old = oldLetter.value;
      if (oldPercent) old = oldPercent.value;
      if (oldPoints) old = oldPoints.value;

      const gradeCellIndex = 2; // Course, Credits, Grade...
      tr.children[gradeCellIndex].replaceWith(makeGradeCell(mode, scaleNum, old));
    });

    gradeHead.textContent = (mode === "letter") ? "Grade (Letter)"
      : (mode === "percent") ? "Grade (%)"
      : "Grade (Points)";

    // reattach listeners for newly created inputs
    getRows().forEach(tr => {
      tr.querySelectorAll("input,select").forEach(el => {
        el.addEventListener("input", () => { save(); recalc(); });
        el.addEventListener("change", () => { save(); recalc(); });
      });
    });

    save();
    recalc();
  }

  function computeRowPoints(row, scaleNum, map) {
    const credits = clampNum(row.querySelector('[data-f="credits"]').value, 0, 100);
    if (credits <= 0) return { ok: false, credits: 0, base: 0, weighted: 0, note: "credits" };

    let basePoints = null;
    const mode = gradeModeEl.value;

    if (mode === "letter") {
      const letter = row.querySelector('[data-f="letter"]').value;
      basePoints = map[letter];
    } else if (mode === "percent") {
      const p = clampNum(row.querySelector('[data-f="percent"]').value, -999, 999);
      if (!Number.isFinite(p)) return { ok: false, credits: 0, base: 0, weighted: 0, note: "grade" };
      const letter = percentToLetter(p);
      basePoints = map[letter];
    } else {
      const gp = clampNum(row.querySelector('[data-f="points"]').value, 0, 20);
      basePoints = gp;
    }

    if (!Number.isFinite(basePoints)) return { ok: false, credits: 0, base: 0, weighted: 0, note: "grade" };

    // weighted
    let w = basePoints;
    if (weightedOnEl.checked) {
      const lvl = row.querySelector('[data-f="level"]')?.value || "regular";
      const bonus = LEVELS.find(x => x.key === lvl)?.bonus ?? 0;
      const cap = clampNum(weightedCapEl.value, 0, 20);
      w = Math.min(basePoints + bonus, cap);
    }

    return {
      ok: true,
      credits,
      base: basePoints,
      weighted: w
    };
  }

  function recalc() {
    const scaleNum = Number(scaleEl.value);
    const map = letterMap(scaleNum);

    let totalCredits = 0;
    let totalPoints = 0;
    let totalWPoints = 0;
    let invalid = 0;

    getRows().forEach(row => {
      const cell = row.querySelector('[data-f="rowPoints"]');
      cell.classList.remove("warn","err");

      const res = computeRowPoints(row, scaleNum, map);
      if (!res.ok) {
        invalid++;
        cell.textContent = "—";
        cell.classList.add("err");
        return;
      }

      const pts = res.base * res.credits;
      const wpts = res.weighted * res.credits;

      totalCredits += res.credits;
      totalPoints += pts;
      totalWPoints += wpts;

      cell.textContent = `${res.base.toFixed(2)} × ${res.credits} = ${pts.toFixed(2)}`;
    });

    creditsPill.textContent = `Total credits: ${round2(totalCredits)}`;
    pointsPill.textContent = `Total points: ${totalPoints.toFixed(2)}`;

    if (totalCredits <= 0) {
      gpaText.textContent = "GPA: —";
      wgpaPill.textContent = "Weighted GPA: —";
      metaText.textContent = "Add at least one course with credits and a grade.";
      return;
    }

    const gpa = totalPoints / totalCredits;
    gpaText.textContent = `GPA: ${gpa.toFixed(2)} / ${scaleNum.toFixed(1)}`;

    if (weightedOnEl.checked) {
      const wgpa = totalWPoints / totalCredits;
      wgpaPill.textContent = `Weighted GPA: ${wgpa.toFixed(2)}`;
    }

    const notes = [];
    if (invalid) notes.push(`⚠ ${invalid} row(s) missing or invalid`);
    if (gradeModeEl.value === "percent") notes.push("Percent-to-letter conversion is US-style and may differ by school.");
    metaText.textContent = notes.join(" · ");
  }

  function resetAll() {
    state = {
      gradeMode: "letter",
      scale: "4.0",
      weightedOn: false,
      weightedCap: 5.0,
      courses: []
    };
    try { localStorage.removeItem(LS_KEY); } catch {}

    gradeModeEl.value = "letter";
    scaleEl.value = "4.0";
    weightedOnEl.checked = false;
    weightedCapEl.value = "5.0";

    tbody.innerHTML = "";
    addCourseRow({ name: "", credits: 3, gradeValue: "A", level: "regular" });
    addCourseRow({ name: "", credits: 3, gradeValue: "A-", level: "regular" });

    applyWeightedVisibility();
    recalc();
    save();
  }

  async function copyResults() {
    const lines = [];
    lines.push(gpaText.textContent);
    if (weightedOnEl.checked) lines.push(wgpaPill.textContent);
    lines.push(creditsPill.textContent);
    lines.push(pointsPill.textContent);

    try { await navigator.clipboard.writeText(lines.join("\n")); } catch {}
  }

  // Events
  gradeModeEl.addEventListener("change", () => {
    rebuildTableForGradeMode();
  });

  scaleEl.addEventListener("change", () => {
    // adjust default cap based on scale if user hasn’t customized much
    const sc = Number(scaleEl.value);
    if (!weightedOnEl.checked) {
      // no action
    } else {
      // sensible default cap
      weightedCapEl.value = (sc === 4.3) ? "5.3" : "5.0";
    }
    rebuildTableForGradeMode();
  });

  weightedOnEl.addEventListener("change", () => {
    applyWeightedVisibility();
    save();
    recalc();
  });

  weightedCapEl.addEventListener("input", () => { save(); recalc(); });
  weightedCapEl.addEventListener("change", () => { save(); recalc(); });

  addCourseBtn.addEventListener("click", () => addCourseRow());
  add5Btn.addEventListener("click", () => {
    for (let i = 0; i < 5; i++) addCourseRow();
  });

  clearBtn.addEventListener("click", () => {
    tbody.innerHTML = "";
    addCourseRow();
    save();
    recalc();
  });

  copyBtn.addEventListener("click", copyResults);

  // Shortcuts (ignore typing)
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Enter") { e.preventDefault(); recalc(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); resetAll(); }
  });

  // Init
  load();

  gradeModeEl.value = state.gradeMode;
  scaleEl.value = state.scale;
  weightedOnEl.checked = state.weightedOn;
  weightedCapEl.value = String(state.weightedCap ?? 5.0);

  tbody.innerHTML = "";
  if (state.courses && state.courses.length) {
    state.courses.forEach(c => addCourseRow(c));
  } else {
    addCourseRow({ name: "", credits: 3, gradeValue: "A", level: "regular" });
    addCourseRow({ name: "", credits: 3, gradeValue: "B+", level: "regular" });
  }

  applyWeightedVisibility();
  recalc();
  save();
})();
