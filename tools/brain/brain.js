/* =========================================================
   EverydayTools.uk — Daily Brain (brain.js)
   Multi-file loader + recycle + full UI wiring
========================================================= */

const DATA_BASE = "/tools/brain/data/";

const DATA_RANGES = [
  { from: "2026-01-12", to: "2026-02-10", file: "sets-2026-01-12_to_2026-02-10.json" },
  { from: "2026-02-11", to: "2026-03-10", file: "sets-2026-02-11_to_2026-03-10.json" },
  { from: "2026-03-11", to: "2026-04-09", file: "sets-2026-03-11_to_2026-04-09.json" },
];

const __SETS_CACHE = new Map();

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
  const A = Date.UTC(ya, ma - 1, da);
  const B = Date.UTC(yb, mb - 1, db);
  return Math.floor((B - A) / 86400000);
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

function pickFileForDate(effectiveDayKey) {
  for (const r of DATA_RANGES) {
    if (dateInRange(effectiveDayKey, r.from, r.to)) {
      return { url: DATA_BASE + r.file, range: r };
    }
  }
  return null;
}

async function fetchSetsFile(url) {

  if (__SETS_CACHE.has(url)) return __SETS_CACHE.get(url);

  const p = fetch(url,{cache:"no-store"}).then(r=>{
    if(!r.ok) throw new Error("Failed loading sets");
    return r.json();
  });

  __SETS_CACHE.set(url,p);

  return p;
}

async function loadSetsForDay(requestedDayKey){

  const {effective}=mapDateToCycle(requestedDayKey);

  const pick=pickFileForDate(effective);

  const sets=await fetchSetsFile(pick.url);

  const day=sets[effective] || Object.values(sets)[0];

  return {sets,dayKey:effective,day}

}

/* =========================================================
   STORAGE
========================================================= */

const STORE_KEY="et_brain_v2";

function readStore(){

  try{
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}")
  }catch{
    return {}
  }

}

function writeStore(s){

  localStorage.setItem(STORE_KEY,JSON.stringify(s))

}

let store=readStore()

/* =========================================================
   DOM
========================================================= */

const elQuestions=document.getElementById("questions")
const elResultBox=document.getElementById("resultBox")
const elDayKey=document.getElementById("dayKey")
const elDayScore=document.getElementById("dayScore")

/* =========================================================
   QUESTIONS
========================================================= */

function normalizeAnswer(s){

  return String(s||"").trim().toLowerCase()

}

function getDayStore(key){

  if(!store.days) store.days={}

  if(!store.days[key]){

    store.days[key]={score:0,answers:{}}

  }

  return store.days[key]

}

function makeCard(q,group,index,dayKey){

  const expected=q.a

  const wrap=document.createElement("div")
  wrap.className="q-card"

  const input=document.createElement("input")
  const btn=document.createElement("button")
  const feedback=document.createElement("div")

  input.placeholder="Your answer"
  btn.textContent="Check"

  btn.onclick=()=>{

    const val=normalizeAnswer(input.value)

    const ok=val===normalizeAnswer(expected)

    const rec=getDayStore(dayKey)

    rec.answers[group+index]={correct:ok}

    rec.score=Object.values(rec.answers).filter(x=>x.correct).length

    writeStore(store)

    feedback.textContent=ok?"✅ Correct":"❌ Try again"

    updatePanels(dayKey)

  }

  wrap.innerHTML=`<strong>${group}</strong><p>${q.q}</p>`

  wrap.appendChild(input)
  wrap.appendChild(btn)
  wrap.appendChild(feedback)

  return wrap

}

/* =========================================================
   PANELS
========================================================= */

function updatePanels(dayKey){

  const rec=getDayStore(dayKey)

  elDayScore.textContent=rec.score||0

}

/* =========================================================
   MAIN RENDER
========================================================= */

async function render(){

  const today=new Date().toISOString().slice(0,10)

  const loaded=await loadSetsForDay(today)

  elDayKey.textContent=loaded.dayKey

  elQuestions.innerHTML=""

  const day=loaded.day

  if(day.easy){

    day.easy.forEach((q,i)=>{

      elQuestions.appendChild(makeCard(q,"easy",i,loaded.dayKey))

    })

  }

  if(day.medium){

    day.medium.forEach((q,i)=>{

      elQuestions.appendChild(makeCard(q,"medium",i,loaded.dayKey))

    })

  }

  updatePanels(loaded.dayKey)

}

render()

/* =========================================================
   STREAK
========================================================= */

async function loadStreakUI(){

  const email=localStorage.getItem("dailybrain_email")

  if(!email) return

  try{

    const res=await fetch("https://brain-digest.ahmadzoury.workers.dev/streak?email="+encodeURIComponent(email))

    const data=await res.json()

    const el=document.getElementById("brain-streak")

    if(!el) return

    if(data.current_streak>0){

      el.textContent=`🔥 Streak ${data.current_streak}`

    }

  }catch{}

}

document.addEventListener("DOMContentLoaded",loadStreakUI)

/* =========================================================
   EMAIL SUBSCRIBE
========================================================= */

const subscribeForm=document.getElementById("subscribeForm")
const subscribeEmail=document.getElementById("subscribeEmail")
const subscribeMsg=document.getElementById("subscribeMsg")

if(subscribeForm){

subscribeForm.addEventListener("submit",async e=>{

e.preventDefault()

const email=subscribeEmail.value.trim()

if(!email || !email.includes("@")){

subscribeMsg.textContent="❌ Please enter a valid email"
return

}

subscribeMsg.textContent="Subscribing..."

try{

const res=await fetch("/api/brain-subscribe",{
method:"POST",
headers:{"Content-Type":"application/json"},
const selectedLevels = Array.from(
  document.querySelectorAll('input[name="level"]:checked')
).map(el => el.value);

if(selectedLevels.length === 0){
  selectedLevels.push("medium","hard");
}

body:JSON.stringify({
  email: email,
  levels: selectedLevels
})
const selectedLevels = Array.from(
  document.querySelectorAll('input[name="level"]:checked')
).map(el => el.value);

if(selectedLevels.length === 0){
  selectedLevels.push("medium","hard");
}

body:JSON.stringify({
  email: email,
  levels: selectedLevels
})

let data

try{

data=await res.json()

}catch{

throw new Error("Invalid response")

}

if(data.ok){

subscribeMsg.textContent="✅ Subscribed successfully!"

localStorage.setItem("dailybrain_email",email)

subscribeEmail.value=""

}else{

subscribeMsg.textContent="❌ "+(data.error||"Subscription failed")

}

}catch(err){

console.error(err)

subscribeMsg.textContent="❌ Network error"

}

})

}