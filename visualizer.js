import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeZxGWAvrrMbV-u-iTxFlQeJOmoMCLBF8",
  authDomain: "qrfdb-63bde.firebaseapp.com",
  projectId: "qrfdb-63bde",
};

const app = initializeApp(firebaseConfig);
const fs = getFirestore(app);

let DATASET_KIND = "EM2";

/* RPPL brand palette for charts */
const RPPL_PALETTE = {
  orange:    "#CC5803",
  orangeW:   "#E67128",
  plum:      "#700548",
  plumRose:  "#8F1D65",
  pink:      "#E7CFCD",
  blueDark:  "#03568A",
  blueLight: "#1A8ED6",
  ink:       "#434343",
  inkMuted:  "#7A6A70",
};
const RPPL_CHART_SEQ = [
  RPPL_PALETTE.plum,
  RPPL_PALETTE.orange,
  RPPL_PALETTE.blueDark,
  RPPL_PALETTE.blueLight,
  RPPL_PALETTE.plumRose,
  RPPL_PALETTE.orangeW,
  "#A0420C",
  "#3F0128",
];
if (typeof window !== "undefined" && window.Chart) {
  const C = window.Chart;
  C.defaults.font.family = '"Lato", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  C.defaults.font.size = 12;
  C.defaults.color = RPPL_PALETTE.ink;
  C.defaults.borderColor = "rgba(112,5,72,0.12)";
  if (C.defaults.plugins?.legend?.labels) {
    C.defaults.plugins.legend.labels.color = RPPL_PALETTE.plum;
    C.defaults.plugins.legend.labels.font = { family: '"Kumbh Sans", "Lato", sans-serif', size: 12, weight: "500" };
  }
  if (C.defaults.plugins?.tooltip) {
    C.defaults.plugins.tooltip.backgroundColor = "rgba(63,1,40,0.92)";
    C.defaults.plugins.tooltip.titleColor = "#fff";
    C.defaults.plugins.tooltip.bodyColor = "#F6E8E6";
    C.defaults.plugins.tooltip.borderColor = "rgba(255,255,255,0.18)";
    C.defaults.plugins.tooltip.borderWidth = 1;
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.cornerRadius = 10;
    C.defaults.plugins.tooltip.titleFont = { family: '"Kumbh Sans", sans-serif', weight: "600" };
  }
}

function unlockQuickshareAI(){
  window.__QS_AI_LOCKED = false;
  window.__QS_AI_TEXT = "";
}

function setCurrentYear(){
  const yearEl = document.querySelector("#current-year");
  if (!yearEl) return;
  yearEl.textContent = String(new Date().getFullYear());
}

function setMainTab(tabName){
  const valid = new Set(["overview", "dashboard", "ask", "oracle", "teacher-stats"]);
  const tab = valid.has(tabName) ? tabName : "overview";
  const isDashboard = tab === "dashboard";
  const isAsk = tab === "ask";
  const isOracle = tab === "oracle";
  const isTeacherStats = tab === "teacher-stats";
  const tabButtons = Array.from(document.querySelectorAll(".panel-tab-btn[data-main-tab]"));

  tabButtons.forEach((btn) => {
    const active = btn.dataset.mainTab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  const cards = document.querySelector("#top-cards");
  if (cards) cards.style.display = (isDashboard || isAsk || isOracle || isTeacherStats) ? "none" : "grid";

  const dashboardPanel = document.querySelector("#panel-dashboard");
  if (dashboardPanel) dashboardPanel.style.display = isDashboard ? "" : "none";

  if (isDashboard){
    if (DASHBOARD_ITEMS.length && !DASHBOARD_SELECTED.length){
      DASHBOARD_SELECTED = [DASHBOARD_ITEMS[0].id];
    }
    renderDashboardInsights();
    renderDashboardItemList();
    renderDashboardView();
    document.querySelectorAll(".page").forEach((p) => { p.style.display = "none"; });
    return;
  }

  if (isAsk){
    document.querySelectorAll(".page").forEach((p) => { p.style.display = "none"; });
    const askEl = document.querySelector("#page-ask");
    if (askEl) askEl.style.display = "";
    return;
  }

  if (isOracle){
    document.querySelectorAll(".page").forEach((p) => { p.style.display = "none"; });
    const oracleEl = document.querySelector("#page-oracle");
    if (oracleEl) oracleEl.style.display = "";
    if (typeof oracleRenderChart === "function") setTimeout(oracleRenderChart, 0);
    return;
  }

  if (isTeacherStats){
    document.querySelectorAll(".page").forEach((p) => { p.style.display = "none"; });
    const tsEl = document.querySelector("#page-teacher-stats");
    if (tsEl) tsEl.style.display = "";
    if (typeof tsOpenPage === "function") setTimeout(tsOpenPage, 0);
    return;
  }

  const activePage = document.querySelector(".nav-btn.active")?.dataset.page || "overview";
  document.querySelectorAll(".page").forEach((p) => { p.style.display = "none"; });
  const activeEl = document.querySelector("#page-" + activePage);
  if (activeEl) activeEl.style.display = "";
}

// jn.020226.qsai - keep AI summary from Quickshare from being wiped by renderInsights()
window.__QS_AI_LOCKED = false;
window.__QS_AI_TEXT = "";

window.__SV_RESTORING = false;

function paintQuickshareAI(){
  if (!window.__QS_AI_LOCKED) return;
  if (!window.__QS_AI_TEXT) return;

  const box = document.querySelector("#ai-summary");
  const out = document.querySelector("#ai-summary-text");
  if (box) box.style.display = "";
  if (out) out.textContent = window.__QS_AI_TEXT;
}

// --- Quickshare store (Firestore) ---
function genQSCode(len = 7){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no confusing 0O1l
  let out = "";
  crypto.getRandomValues(new Uint8Array(len)).forEach(n => out += alphabet[n % alphabet.length]);
  return out;
}

function getCurrentAISummaryText(){
  const t = (document.querySelector("#ai-summary-text")?.textContent || "").trim();
  if (!t) return "";
  if (/generating summary/i.test(t)) return "";
  return t;
}

async function saveQuickshareToFirestore({ sv, ai }){
  // Try a few times in case of rare collision
  for (let i=0; i<5; i++){
    const code = genQSCode(7);
    const ref = doc(fs, "aims_quickshares", code);

    try {
      await setDoc(ref, {
        sv: String(sv || ""),
        ai: String(ai || ""),
        createdAt: serverTimestamp(),
        v: 1
      });
      return code;
    } catch (e){
      // retry with a new code
      console.warn("[quickshare] save retry", e);
    }
  }
  throw new Error("Failed to create quickshare code.");
}

async function loadQuickshareFromFirestore(code){
  const ref = doc(fs, "aims_quickshares", String(code || ""));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

// - - -- -- - - - - - - -



const $ = (s, el=document) => el.querySelector(s);

function escapeHTML(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

let RAW = [];
let FILTERED = [];
let SUMMARY = []; // school+grade aggregates

let charts = {
  bands: null,
  avg: null,
  grade: null,
  school: null,
	gmwRadar: null,
  gmwBars: null,
  gmwAvg: null,
};

const DASHBOARD_STORAGE_KEY = "aims_dashboard_snapshots_v1";
let DASHBOARD_ITEMS = [];
let DASHBOARD_SELECTED = [];
let DASHBOARD_CHARTS = [];

const BAND_ORDER = [
  "not yet proficient",
  "partially proficient",
  "inconsistently proficient",
  "proficient",
  "highly proficient",
];

// jn.01272026 - UI text polish (emojis + clearer labels)
function polishButtons(){
  const set = (id, text) => {
    const el = document.querySelector(id);
    if (el) el.textContent = text;
  };

  set("#btn-apply",  "✨ Apply Filters");
  set("#btn-save-dashboard", "📌 Save to Dashboard");
  set("#btn-export", "⬇️ Export Summary CSV");
  set("#btn-reset",  "♻️ Reset Filters");
  set("#btn-copylink", "⚡ Copy Quickshare Link"); // your exact requested text
}


function parseMDY(s){
  // CSV has 10/13/25 style. Interpret as MM/DD/YY.
  if (!s) return null;
  const [m,d,y] = String(s).split("/").map(x => x.trim());
  if (!m || !d || !y) return null;
  const yy = Number(y);
  const yyyy = yy < 100 ? (2000 + yy) : yy;
  const dt = new Date(yyyy, Number(m)-1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}

function normBand(v){
  return String(v || "").trim().toLowerCase();
}

function uniqueSorted(arr){
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=> String(a).localeCompare(String(b)));
}

// jn.01272026 - Insight cards helpers
function fmtPP(x){
  const n = Number(x);
  const s = (n >= 0 ? "+" : "") + n.toFixed(1);
  return `${s}pp`;
}

function mean(arr){
  const xs = arr.filter(v => Number.isFinite(v));
  if (!xs.length) return 0;
  return xs.reduce((a,b)=>a+b,0) / xs.length;
}

function variance(arr){
  const xs = arr.filter(v => Number.isFinite(v));
  if (xs.length < 2) return Infinity;
  const m = mean(xs);
  return xs.reduce((acc,x)=> acc + Math.pow(x-m,2), 0) / xs.length;
}

function maxDate(rows){
  let best = null;
  for (const r of rows){
    const d = r.__date_completed;
    if (!d) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

// Build predicate for ALL filters except date (so we can reuse it for "previous window")
function makeNonDatePredicate(){
  const schools = getMulti($("#f-school"));
  const grades  = getMulti($("#f-grade"));
  const types   = getMulti($("#f-type"));
  const bands   = getMulti($("#f-band"));
	
  const gmwExtra = (DATASET_KIND === "GMW") ? readGMWExtraFilterState() : null;

  return (r) => {
    if (schools.length && !schools.includes(r.school)) return false;
    if (grades.length && !grades.includes(String(r.grade))) return false;

    if (DATASET_KIND === "GMW"){
      // repurposed: f-type = curriculum, f-band = module
      if (types.length && !types.includes(String(r.curriculum || ""))) return false;
      if (bands.length && !bands.includes(String(r.module || ""))) return false;
    } else {
      if (types.length && !types.includes(r.type_of_assessment)) return false;
      if (bands.length && !bands.includes(r.performance_band)) return false;
    }

    return true;
  };
}

// Compute "current window" start/end, even if user didn't pick dates (fallback to last 30 days)
function resolveWindow(rows){
  let from = $("#f-from").value ? new Date($("#f-from").value) : null;
  let to   = $("#f-to").value ? new Date($("#f-to").value) : null;

  // Inclusive end-of-day for comparisons
  const endOfDay = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
  const startOfDay = (d)=> new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);

  if (from && to){
    from = startOfDay(from);
    to = endOfDay(to);
    return { from, to, mode: "explicit" };
  }

  // Fallback: use latest date in CURRENT filtered data; take last 30 days
  const latest = maxDate(rows) || maxDate(RAW);
  if (!latest){
    return { from: null, to: null, mode: "none" };
  }

  const t = endOfDay(latest);
  const f = new Date(t.getTime() - (29 * 24 * 60 * 60 * 1000));
  return { from: startOfDay(f), to: t, mode: "fallback30" };
}

function inRange(d, from, to){
  if (!d || !from || !to) return false;
  return d >= from && d <= to;
}

function buildGroupAverages(rows){
  // group by school+grade -> avg overall_percentage
  const map = new Map();
  for (const r of rows){
    const key = `${r.school || ""}|||${String(r.grade ?? "")}`;
    if (!map.has(key)){
      map.set(key, { school: r.school || "", grade: String(r.grade ?? ""), n:0, sum:0 });
    }
    const g = map.get(key);
    g.n++;
    const pct = Number(r.overall_percentage);
    if (Number.isFinite(pct)) g.sum += pct;
  }
  const out = [];
  for (const v of map.values()){
    out.push({
      school: v.school,
      grade: v.grade,
      n: v.n,
      avg: v.n ? (v.sum / v.n) : 0
    });
  }
  return out;
}

function bandPercents(rows){
  const total = rows.length || 1;
  const counts = Object.fromEntries(BAND_ORDER.map(b=>[b,0]));
  for (const r of rows){
    const b = normBand(r.performance_band);
    if (BAND_ORDER.includes(b)) counts[b] = (counts[b]||0) + 1;
  }
  const pct = {};
  for (const b of BAND_ORDER){
    pct[b] = (counts[b] / total) * 100;
  }
  return pct;
}

function buildGMWInsightCardsHTML(){
  const rows = FILTERED || [];
  const n = rows.length;

  // averages per dimension
  const avgs = GMW_DIMENSIONS.map(d => {
    const xs = rows.map(r => Number(r?.[d.key])).filter(v => Number.isFinite(v) && v > 0);
    const avg = xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
    return { ...d, avg };
  }).filter(x => x.avg != null);

  if (!avgs.length){
    return "";
  }

  const best = [...avgs].sort((a,b)=> b.avg - a.avg)[0];
  const worst= [...avgs].sort((a,b)=> a.avg - b.avg)[0];

  // pick one comment snippet
  const snippets = collectGMWCommentSnippets(rows, { limit: 30, maxLen: 220 });
  const picked = snippets.length ? snippets[0] : null;

  const cards = [
    { kicker: "Coverage", text: `${n} observation rows in current filter.` },
    { kicker: "Strongest dimension", text: `${best.label} (avg ${best.avg.toFixed(2)} / 3)` },
    { kicker: "Weakest dimension", text: `${worst.label} (avg ${worst.avg.toFixed(2)} / 3)` },
  ];

  // Add the observation card (killer feature)
  if (picked){
    cards.push({
      kicker: "Observation snippet",
      html: `
        <div class="obs-snippet">
          <div class="obs-meta">
            <span class="chip">${escapeHTML(picked.dim)}</span>
            ${picked.scoreLabel ? `<span class="chip">${escapeHTML(picked.scoreLabel)}</span>` : ``}
            ${picked.grade ? `<span class="chip">G${escapeHTML(picked.grade)}</span>` : ``}
            ${picked.school ? `<span class="chip">${escapeHTML(picked.school)}</span>` : ``}
          </div>
          <div class="obs-text" id="gmw-rand-obs-text">${escapeHTML(picked.text)}</div>
          <div class="obs-actions">
            <button class="btn" type="button" id="btn-rand-obs">🔄 New snippet</button>
          </div>
        </div>
      `
    });
  }

  return cards.slice(0,6).map(c=>`
    <div class="insight-card">
      <div class="insight-kicker">${escapeHTML(c.kicker)}</div>
      ${c.html ? c.html : `<div class="insight-text">${escapeHTML(c.text)}</div>`}
    </div>
  `).join("");
}

function renderInsights(){
  const host = $("#insights");
  if (!host) return;

  // If nothing loaded yet
  if (!RAW.length){
    host.innerHTML = "";
    return;
  }

  // jn.022326.gmw.insights - custom GMW insight cards (placeholder for now)
	if (DATASET_KIND === "GMW"){
		host.innerHTML = buildGMWInsightCardsHTML();

		// hook refresh button (re-picks from current FILTERED)
		const btn = document.querySelector("#btn-rand-obs");
		btn?.addEventListener("click", ()=>{
			const snippets = collectGMWCommentSnippets(FILTERED || [], { limit: 30, maxLen: 220 });
			const pick = snippets[0];
			const out = document.querySelector("#gmw-rand-obs-text");
			if (pick && out) out.textContent = pick.text;
		});

		// Reveal the AI Summary panel for GMW too (it was hidden because the
		// EM2 reveal logic below never ran due to this early return).
		const aiBox = $("#ai-summary");
		const aiOut = $("#ai-summary-text");
		const hasAnyGMWContent = !!(host.innerHTML && host.innerHTML.trim()) || (FILTERED && FILTERED.length > 0);
		if (aiBox) aiBox.style.display = hasAnyGMWContent ? "" : "none";

		if (window.__QS_AI_LOCKED){
			if (aiBox) aiBox.style.display = "";
			if (aiOut && window.__QS_AI_TEXT) aiOut.textContent = window.__QS_AI_TEXT;
		} else {
			if (aiOut) aiOut.textContent = "";
			if (typeof __AI !== "undefined") __AI.lastKey = null;
		}

		return;
	}
  const pred = makeNonDatePredicate();

  // Current window is based on FILTERED (already includes date filtering, if any)
  const win = resolveWindow(FILTERED.length ? FILTERED : RAW.filter(pred));
  if (!win.from || !win.to){
    host.innerHTML = "";
    return;
  }

  // Define previous window: same duration ending the day before current window starts
  const durationMs = (win.to.getTime() - win.from.getTime()) + 1;
  const prevTo = new Date(win.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs + 1);

  // Build windowed row sets with same non-date filters
  const currentRows = RAW.filter(r => pred(r) && inRange(r.__date_completed, win.from, win.to));
  const prevRows    = RAW.filter(r => pred(r) && inRange(r.__date_completed, prevFrom, prevTo));

  // If we can’t compare, still show consistency etc.
  const canCompare = prevRows.length > 0 && currentRows.length > 0;

  const cards = [];

  // 1) Largest drop (school+grade) vs previous window
  if (canCompare){
    const cur = buildGroupAverages(currentRows);
    const prev = buildGroupAverages(prevRows);

    const prevMap = new Map(prev.map(x => [`${x.school}|||${x.grade}`, x]));
    const deltas = cur.map(c => {
      const p = prevMap.get(`${c.school}|||${c.grade}`);
      const d = p ? (c.avg - p.avg) : null;
      return { ...c, delta: d };
    }).filter(x => x.delta !== null && Number.isFinite(x.delta));

    if (deltas.length){
      deltas.sort((a,b)=> a.delta - b.delta); // most negative first
      const worst = deltas[0];
      cards.push({
        kicker: "Largest drop",
        text: `Grade ${worst.grade} at ${worst.school} (${fmtPP(worst.delta)} vs previous window)`,
        sub: `Compared against the prior ${Math.round(durationMs / (24*60*60*1000))}-day window.`
      });
    }
  }

  // 2) Most consistent school (lowest variance)
  {
    const bySchool = new Map();
    for (const r of currentRows.length ? currentRows : FILTERED){
      const s = r.school || "";
      if (!bySchool.has(s)) bySchool.set(s, []);
      bySchool.get(s).push(Number(r.overall_percentage));
    }
    const stats = Array.from(bySchool.entries()).map(([school, arr]) => ({
      school,
      v: variance(arr),
      n: arr.length
    })).filter(x => x.school && x.n >= 10); // require some sample size

    if (stats.length){
      stats.sort((a,b)=> a.v - b.v);
      const best = stats[0];
      cards.push({
        kicker: "Most consistent",
        text: `${best.school} (lowest variance)`,
        sub: `${best.n.toLocaleString()} rows in the current window.`
      });
    }
  }

  // 3) Top band shift (largest decrease) vs previous window
  if (canCompare){
    const curPct = bandPercents(currentRows);
    const prevPct = bandPercents(prevRows);

    const shifts = BAND_ORDER.map(b => ({
      band: b,
      delta: (curPct[b] || 0) - (prevPct[b] || 0)
    }));

    shifts.sort((a,b)=> a.delta - b.delta); // largest decrease first (most negative)
    const topDec = shifts[0];
    if (Number.isFinite(topDec.delta)){
      cards.push({
        kicker: "Top band shift",
        text: `“${topDec.band}” decreased most (${fmtPP(topDec.delta)})`,
        sub: `Change in share of rows vs previous window.`
      });
    }
  }

  // Optional extras (nice “wow” without noise): top performer + biggest gain
  if (canCompare){
    const cur = buildGroupAverages(currentRows);
    const prev = buildGroupAverages(prevRows);
    const prevMap = new Map(prev.map(x => [`${x.school}|||${x.grade}`, x]));

    const deltas = cur.map(c => {
      const p = prevMap.get(`${c.school}|||${c.grade}`);
      const d = p ? (c.avg - p.avg) : null;
      return { ...c, delta: d };
    }).filter(x => x.delta !== null && Number.isFinite(x.delta));

    if (cur.length){
      cur.sort((a,b)=> b.avg - a.avg);
      const top = cur[0];
      cards.push({
        kicker: "Top current average",
        text: `Grade ${top.grade} at ${top.school} (${top.avg.toFixed(1)}%)`,
        sub: `Highest avg overall_percentage in the current window.`
      });
    }

    if (deltas.length){
      deltas.sort((a,b)=> b.delta - a.delta); // biggest gain
      const best = deltas[0];
      cards.push({
        kicker: "Largest gain",
        text: `Grade ${best.grade} at ${best.school} (${fmtPP(best.delta)} vs previous window)`,
        sub: `Compared against the prior window of equal length.`
      });
    }
  }

  // Keep it 3–6 cards (as requested)
  const finalCards = cards.slice(0, 6);

  host.innerHTML = finalCards.map(c => `
    <div class="insight-card">
      <div class="insight-kicker">${c.kicker}</div>
      <div class="insight-text">${c.text}</div>
      ${c.sub ? `<div class="insight-sub">${c.sub}</div>` : ``}
    </div>
  `).join("");
	
  // Show the AI box once we have insight cards (but don’t auto-run)
  const aiBox = $("#ai-summary");
  const aiOut = $("#ai-summary-text");

  if (aiBox) aiBox.style.display = finalCards.length ? "" : "none";

  // If AI summary came from Quickshare, do NOT wipe it during initial render.
  if (window.__QS_AI_LOCKED){
    if (aiBox) aiBox.style.display = ""; // force visible if we have locked text
    if (aiOut && window.__QS_AI_TEXT) aiOut.textContent = window.__QS_AI_TEXT;
    // keep __AI.lastKey as-is (don’t invalidate)
  } else {
    if (aiOut) aiOut.textContent = ""; // normal behavior: reset when filters change
    if (typeof __AI !== "undefined") __AI.lastKey = null;
  }

}


// jn.020226 - AI Summary via OpenAI proxy (server-side; no CORS; no local models)
const OPENAI_PROXY_URL = "/aims/openai_proxy.php";

// Leave blank for the safe default (server-side OPENAI_API_KEY env var on the PHP host).
// For local dev only: paste a key here AND set DEV_ALLOW_CLIENT_KEY = true in openai_proxy.php.
// Never commit a real key. See README.md "API key & the OpenAI proxy".
const OPENAI_API_KEY = "";

let __AI = { lastKey: null, busy: false };

function getInsightLines(){
  const host = $("#insights");
  if (!host) return [];
  const lines = [];
  host.querySelectorAll(".insight-card").forEach(card => {
    const kicker = card.querySelector(".insight-kicker")?.textContent?.trim();
    const t = card.querySelector(".insight-text")?.textContent?.trim();
    const s = card.querySelector(".insight-sub")?.textContent?.trim();
    if (!t) return;
    // include kicker to help model group themes, but keep it compact
    const line = `${kicker ? (kicker + ": ") : ""}${t}${s ? " (" + s + ")" : ""}`;
    lines.push(line);
  });
  return lines.filter(Boolean);
}

function getStateKeyForAI(){
  const url = new URL(window.location.href);
  const sv = url.searchParams.get("sv");
  if (sv) return "sv:" + sv;

  // fallback snapshot
  return JSON.stringify({
    school: getMulti($("#f-school")),
    grade:  getMulti($("#f-grade")),
    type:   getMulti($("#f-type")),
    band:   getMulti($("#f-band")),
    from:   $("#f-from")?.value || "",
    to:     $("#f-to")?.value || "",
    page:   $("#page-title")?.textContent || "",
  });
}

function buildOpenAIPrompt(lines, extraNotes = []){
  const facts = lines.map(t => `- ${t}`).join("\n");
  const notes = (extraNotes || []).map(t => `- ${t}`).join("\n");

  return `
You are writing a publication-ready executive summary of a dashboard.

Use ONLY the facts in FINDINGS and OBSERVATION NOTES.
Do NOT invent causes, dates, reports, or context.
Do NOT name individual teachers or emails. Keep it anonymized.

FINDINGS:
${facts}

OBSERVATION NOTES:
${notes || "- (none)"}

Write 1–2 short paragraphs (max 4 sentences each).
Focus on what stands out across dimensions and what the notes suggest about classroom experience.
End with 2 short bullets: "Implications" and "Next checks".
`.trim();
}

function isJunk(text){
  const t = String(text || "").trim();
  if (!t) return true;
  if (t.length < 40) return true;
  if (/^\(?\s*(applause|laughter|music|cheering|inaudible)\s*\)?$/i.test(t)) return true;
  return false;
}

function safeTextFromOpenAIResponse(json){
  // Responses API returns output[] with content[] items
  // We'll collect all "output_text"
  try {
    const out = [];
    for (const item of (json?.output || [])){
      for (const c of (item?.content || [])){
        if (c?.type === "output_text" && c?.text) out.push(c.text);
      }
    }
    return out.join("\n").trim();
  } catch {
    return "";
  }
}

function truncateText(s, n = 48){
  const text = String(s || "").trim();
  if (text.length <= n) return text;
  return text.slice(0, n - 1) + "…";
}

function formatDashboardTime(ts){
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  return d.toLocaleString();
}

function getDashboardSummaryRows(limit = 14){
  const rows = (SUMMARY || []).slice();
  rows.sort((a, b) => (b.n || 0) - (a.n || 0));
  return rows.slice(0, limit).map(r => ({
    school: r.school,
    grade: r.grade,
    avg: Number(r.avg_overall_percentage ?? 0),
    proficient: Number((r.pct_proficient ?? 0) + (r["pct_highly proficient"] ?? 0)),
    notYet: Number(r["pct_not yet proficient"] ?? 0),
    n: Number(r.n ?? 0),
  }));
}

function getDashboardSnapshotNotes(item){
  if (!item) return [];
  const rows = item.summaryRows || [];
  if (!rows.length) return item.notes || [];

  const topAvg = [...rows].sort((a, b) => b.avg - a.avg)[0];
  const lowAvg = [...rows].sort((a, b) => a.avg - b.avg)[0];
  const topProf = [...rows].sort((a, b) => b.proficient - a.proficient)[0];

  return [
    `Snapshot: ${item.name}`,
    topAvg ? `Highest average: ${topAvg.school} Grade ${topAvg.grade} (${topAvg.avg.toFixed(1)}%).` : "",
    lowAvg ? `Lowest average: ${lowAvg.school} Grade ${lowAvg.grade} (${lowAvg.avg.toFixed(1)}%).` : "",
    topProf ? `Strongest proficiency: ${topProf.school} Grade ${topProf.grade} (${topProf.proficient.toFixed(1)}%).` : "",
  ].filter(Boolean);
}

function getVisibleOverviewChartConfigs(){
  const out = [];
  const canvases = Array.from(document.querySelectorAll("#page-overview canvas"));
  canvases.forEach((canvas, idx) => {
    // skip hidden chart canvases (e.g., EM2/GMW inactive panel)
    if (!canvas.getClientRects().length) return;
    const chart = Chart.getChart(canvas);
    if (!chart) return;

    const titleEl = canvas.closest("details")?.querySelector(".viz-collapse-title");
    const title = (titleEl?.textContent || `Chart ${idx + 1}`).trim();
    let config = null;
    try {
      config = JSON.parse(JSON.stringify({
        type: chart.config.type,
        data: chart.data,
        options: chart.options
      }));
    } catch {
      config = null;
    }
    if (!config) return;
    out.push({ title, config });
  });
  return out;
}

function createDashboardSnapshot(name){
  return {
    id: (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name: String(name || "").trim(),
    createdAt: new Date().toISOString(),
    datasetKind: DATASET_KIND,
    summaryRows: getDashboardSummaryRows(14),
    chartConfigs: getVisibleOverviewChartConfigs(),
    notes: getInsightLines(),
  };
}

function saveDashboardItems(){
  try {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(DASHBOARD_ITEMS));
  } catch (e){
    console.warn("Could not save dashboard snapshots:", e);
  }
}

function loadDashboardItems(){
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) DASHBOARD_ITEMS = parsed;
  } catch {
    DASHBOARD_ITEMS = [];
  }
}

function clearDashboardCharts(){
  DASHBOARD_CHARTS.forEach((ch) => {
    try { ch.destroy(); } catch {}
  });
  DASHBOARD_CHARTS = [];
}

function renderDashboardItemList(){
  const host = document.querySelector("#dashboard-list");
  const count = document.querySelector("#dashboard-count");
  if (!host || !count) return;

  host.innerHTML = "";
  count.textContent = `${DASHBOARD_ITEMS.length} saved`;

  if (!DASHBOARD_ITEMS.length){
    host.innerHTML = `<div class="muted">No saved graphs yet. Use “Save to Dashboard” from Overview.</div>`;
    return;
  }

  DASHBOARD_ITEMS.forEach((item) => {
    const active = DASHBOARD_SELECTED.includes(item.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "dashboard-item" + (active ? " active" : "");
    card.title = item.name;
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="dashboard-item-name">📈 ${escapeHTML(truncateText(item.name, 46))}</div>
      <div class="dashboard-item-time">${escapeHTML(formatDashboardTime(item.createdAt))}</div>
    `;
    card.addEventListener("click", (ev) => {
      const multi = ev.ctrlKey || ev.metaKey;
      if (multi){
        if (DASHBOARD_SELECTED.includes(item.id)){
          DASHBOARD_SELECTED = DASHBOARD_SELECTED.filter(id => id !== item.id);
        } else {
          DASHBOARD_SELECTED = [...DASHBOARD_SELECTED, item.id];
        }
      } else {
        DASHBOARD_SELECTED = [item.id];
      }
      if (!DASHBOARD_SELECTED.length && DASHBOARD_ITEMS.length){
        DASHBOARD_SELECTED = [DASHBOARD_ITEMS[0].id];
      }
      renderDashboardItemList();
      renderDashboardView();
    });
    host.appendChild(card);
  });
}

// Recolor a serialized Chart.js config in-place with the current RPPL palette so
// dashboard snapshots always match the Overview styling - even ones saved before
// the palette was finalized.
function recolorConfigToRpplPalette(cfg){
  if (!cfg?.data?.datasets) return cfg;
  const type = String(cfg.type || "").toLowerCase();
  const datasets = cfg.data.datasets;

  // Label-based semantic mapping wins over positional cycling.
  const semantic = (label) => {
    const l = String(label || "").toLowerCase();
    if (!l) return null;
    if (l.includes("not yet") || l.includes("emerging"))                 return { solid: RPPL_PALETTE.orange,   soft: "rgba(204,88,3,.18)" };
    if (l.includes("partial"))                                           return { solid: RPPL_PALETTE.orangeW,  soft: "rgba(230,113,40,.18)" };
    if (l.includes("inconsistent") || l.includes("developing"))          return { solid: RPPL_PALETTE.plumRose, soft: "rgba(143,29,101,.18)" };
    if (l.includes("highly proficient"))                                 return { solid: RPPL_PALETTE.blueDark, soft: "rgba(3,86,138,.22)" };
    if (l.includes("proficient") || l.includes("achieving"))             return { solid: RPPL_PALETTE.blueLight,soft: "rgba(26,142,214,.18)" };
    if (l.includes("average") || l.includes("avg"))                      return { solid: RPPL_PALETTE.plum,     soft: "rgba(112,5,72,.18)" };
    return null;
  };

  datasets.forEach((ds, i) => {
    const picked = semantic(ds.label) || {
      solid: RPPL_CHART_SEQ[i % RPPL_CHART_SEQ.length],
      soft:  `rgba(112,5,72,${0.14 + (i % 4) * 0.04})`,
    };

    if (type === "line" || type === "radar"){
      ds.borderColor = picked.solid;
      ds.backgroundColor = picked.soft;
      ds.pointBackgroundColor = picked.solid;
      if (ds.borderWidth == null) ds.borderWidth = 2;
    } else {
      // bar / doughnut / polarArea / others - solid fills with thin white separators
      ds.backgroundColor = picked.solid;
      if (ds.borderColor === undefined) ds.borderColor = "rgba(255,255,255,.6)";
      if (ds.borderWidth === undefined) ds.borderWidth = 1;
      if (type === "bar" && ds.borderRadius == null) ds.borderRadius = 6;
    }
  });

  return cfg;
}

function renderDashboardView(){
  const host = document.querySelector("#dashboard-view");
  if (!host) return;
  clearDashboardCharts();
  host.innerHTML = "";

  const selected = DASHBOARD_ITEMS.filter(it => DASHBOARD_SELECTED.includes(it.id));
  if (!selected.length){
    host.innerHTML = `<div class="muted">Select a saved graph from the left to display it.</div>`;
    return;
  }

  selected.forEach((item) => {
    const wrap = document.createElement("article");
    wrap.className = "dash-viz-card";
    wrap.innerHTML = `
      <div class="dash-viz-head">
        <h3 class="dash-viz-title">📈 ${escapeHTML(truncateText(item.name, 56))}</h3>
        <div class="dash-viz-time">${escapeHTML(formatDashboardTime(item.createdAt))}</div>
      </div>
      <div class="dash-viz-charts"></div>
    `;
    host.appendChild(wrap);

    const chartsHost = wrap.querySelector(".dash-viz-charts");
    const configs = Array.isArray(item.chartConfigs) ? item.chartConfigs : [];
    if (chartsHost && configs.length){
      chartsHost.innerHTML = configs.map((snap) => `
        <div class="dash-chart-wrap">
          <div class="muted" style="margin-bottom:6px;">${escapeHTML(snap.title || "Chart")}</div>
          <canvas></canvas>
        </div>
      `).join("");
      const canvases = Array.from(chartsHost.querySelectorAll("canvas"));
      canvases.forEach((canvas, i) => {
        const cfg = configs[i]?.config;
        if (!cfg) return;
        const nextCfg = recolorConfigToRpplPalette({
          type: cfg.type,
          data: JSON.parse(JSON.stringify(cfg.data)),
          options: {
            ...cfg.options,
            responsive: true,
            maintainAspectRatio: false
          }
        });
        const chart = new Chart(canvas.getContext("2d"), nextCfg);
        DASHBOARD_CHARTS.push(chart);
      });
      return;
    }

    const snapshots = Array.isArray(item.chartSnapshots) ? item.chartSnapshots : [];
    if (chartsHost && snapshots.length){
      chartsHost.innerHTML = snapshots.map((snap) => `
        <div class="dash-chart-wrap">
          <div class="muted" style="margin-bottom:6px;">${escapeHTML(snap.title || "Chart")}</div>
          <img
            src="${escapeHTML(snap.src || "")}"
            alt="${escapeHTML(snap.title || "Dashboard chart snapshot")}"
            style="width:100%;height:100%;object-fit:contain;border-radius:10px;"
          />
        </div>
      `).join("");
      return;
    }

    // Fallback for older snapshots saved before chartSnapshots existed.
    const rows = item.summaryRows || [];
    const labels = rows.map(r => `${r.school} • G${r.grade}`);
    const avgData = rows.map(r => Number(r.avg || 0));
    const profData = rows.map(r => Number(r.proficient || 0));
    const notYetData = rows.map(r => Number(r.notYet || 0));
    if (!chartsHost) return;
    chartsHost.innerHTML = `
      <div class="dash-chart-wrap"><canvas></canvas></div>
      <div class="dash-chart-wrap"><canvas></canvas></div>
    `;
    const [c1, c2] = chartsHost.querySelectorAll("canvas");
    if (!c1 || !c2) return;

    const chAvg = new Chart(c1.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Average %", data: avgData, backgroundColor: RPPL_PALETTE.plum, borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    const chBand = new Chart(c2.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Proficient+Highly Proficient %", data: profData, borderColor: RPPL_PALETTE.blueDark, backgroundColor: "rgba(3,86,138,.16)", fill: true, tension: .3, pointBackgroundColor: RPPL_PALETTE.blueDark },
          { label: "Not Yet Proficient %", data: notYetData, borderColor: RPPL_PALETTE.orange, backgroundColor: "rgba(204,88,3,.12)", fill: false, tension: .3, pointBackgroundColor: RPPL_PALETTE.orange }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    DASHBOARD_CHARTS.push(chAvg, chBand);
  });
}

function renderDashboardInsights(){
  const host = document.querySelector("#dashboard-insights");
  if (!host) return;
  const lines = getInsightLines();
  if (!lines.length){
    host.innerHTML = `<div class="muted">Insights will appear here after loading data and applying filters.</div>`;
    return;
  }
  host.innerHTML = lines.map(line => `
    <article class="insight-card">
      <div class="insight-kicker">Dashboard Insight</div>
      <div class="insight-text">${escapeHTML(line)}</div>
    </article>
  `).join("");
}

function openDashboardSaveModal(){
  const modal = document.querySelector("#dashboard-save-modal");
  const input = document.querySelector("#dashboard-name-input");
  if (!modal || !input) return;
  modal.classList.add("show");
  input.value = "";
  setTimeout(() => input.focus(), 0);
}

function closeDashboardSaveModal(){
  const modal = document.querySelector("#dashboard-save-modal");
  if (!modal) return;
  modal.classList.remove("show");
}

function saveCurrentToDashboard(){
  const input = document.querySelector("#dashboard-name-input");
  if (!input) return;
  const name = (input.value || "").trim();
  if (!name){
    alert("Please enter a name before saving.");
    input.focus();
    return;
  }

  const snapshot = createDashboardSnapshot(name);
  if (!snapshot.summaryRows.length){
    alert("No chart data available for the current filters. Load data/apply filters first.");
    return;
  }
  DASHBOARD_ITEMS = [snapshot, ...DASHBOARD_ITEMS];
  saveDashboardItems();
  closeDashboardSaveModal();
  DASHBOARD_SELECTED = [snapshot.id];
  renderDashboardItemList();
  renderDashboardView();
}

async function generateDashboardAISummary(mode = "analysis"){
  const out = document.querySelector("#dashboard-ai-text");
  if (!out) return;

  const selected = DASHBOARD_ITEMS.filter(it => DASHBOARD_SELECTED.includes(it.id));
  if (!selected.length){
    out.textContent = "Select at least one saved graph first.";
    return;
  }

  out.textContent = "Generating summary…";

  const prompt = selected.length === 1
    ? (mode === "conclusion"
      ? `
You are writing the conclusion section of an academic paper.
Use the findings below and produce a concise conclusion paragraph plus 3 bullet implications.
${getDashboardSnapshotNotes(selected[0]).map(s => `- ${s}`).join("\n")}
`.trim()
      : buildOpenAIPrompt(getDashboardSnapshotNotes(selected[0]), []))
    : `
You are writing the comparison summary section of an academic paper.
Compare the dashboard snapshots below and identify patterns, contrasts, and notable trends.
Use concise, evidence-grounded wording suitable for a findings/conclusion section.${mode === "conclusion" ? "\nEnd with a distinct conclusion paragraph and practical implications." : ""}
Use bullet points with clear comparative language.

SNAPSHOTS:
${selected.map((it, i) => {
  const lines = getDashboardSnapshotNotes(it).map(s => `- ${s}`).join("\n");
  return `Snapshot ${i + 1} (${it.name}):\n${lines}`;
}).join("\n\n")}
`.trim();

  try {
    const r = await fetch(OPENAI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: OPENAI_API_KEY, text: prompt }),
    });
    const json = await r.json();
    const text = safeTextFromOpenAIResponse(json);
    if (!r.ok || isJunk(text)){
      out.textContent = "AI summary failed or returned an empty response.";
      return;
    }
    out.textContent = text;
  } catch (e){
    console.error(e);
    out.textContent = "AI summary failed (network/proxy error).";
  }
}

function initDashboardUI(){
  loadDashboardItems();
  if (DASHBOARD_ITEMS.length && !DASHBOARD_SELECTED.length){
    DASHBOARD_SELECTED = [DASHBOARD_ITEMS[0].id];
  }
  renderDashboardItemList();
  renderDashboardView();
  renderDashboardInsights();

  document.querySelector("#btn-save-dashboard")?.addEventListener("click", openDashboardSaveModal);
  document.querySelector("#dashboard-modal-close")?.addEventListener("click", closeDashboardSaveModal);
  document.querySelector("#dashboard-modal-cancel")?.addEventListener("click", closeDashboardSaveModal);
  document.querySelector("[data-close-dashboard-modal]")?.addEventListener("click", closeDashboardSaveModal);
  document.querySelector("#dashboard-modal-save")?.addEventListener("click", saveCurrentToDashboard);
  document.querySelector("#dashboard-name-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") saveCurrentToDashboard();
  });
  const btnDashboardAI = document.querySelector("#btn-dashboard-ai");
  if (btnDashboardAI){
    btnDashboardAI.onclick = () => generateDashboardAISummary("analysis");
  }
  document.querySelector("#btn-dashboard-analysis")?.addEventListener("click", () => generateDashboardAISummary("analysis"));
  document.querySelector("#btn-dashboard-conclusion")?.addEventListener("click", () => generateDashboardAISummary("conclusion"));
}


async function generateAISummary(){
	
	if (!window.__SV_RESTORING) unlockQuickshareAI();

  const box = $("#ai-summary");
  const out = $("#ai-summary-text");
  if (!box || !out) return;

  const lines = getInsightLines();
  if (!lines.length){
    box.style.display = "none";
    return;
  }

  box.style.display = "";
  out.textContent = "Generating summary…";

  const key = getStateKeyForAI();
  if (__AI.lastKey === key && out.textContent && out.textContent !== "Generating summary…"){
    return;
  }
  if (__AI.busy) return;
  __AI.busy = true;
  __AI.lastKey = key;

	let notes = [];
	if (DATASET_KIND === "GMW"){
		const snips = collectGMWCommentSnippets(FILTERED || [], { limit: 16, maxLen: 240 });

		// anonymized note lines (no teacher names/emails)
		notes = snips.map(s => {
			const ctx = [
				s.dim,
				s.scoreLabel ? s.scoreLabel : "",
				s.grade ? `Grade ${s.grade}` : "",
				s.curriculum ? s.curriculum : "",
				s.module ? s.module : "",
			].filter(Boolean).join(" • ");
			return `${ctx}: ${s.text}`;
		});
	}

	const prompt = buildOpenAIPrompt(lines, notes);

  try {
    const r = await fetch(OPENAI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // If your proxy is hardcoded with the API key, remove apiKey entirely
        apiKey: OPENAI_API_KEY,
        text: prompt
      }),
    });

    const json = await r.json();
    const text = safeTextFromOpenAIResponse(json);

    if (!r.ok) {
      console.error("OpenAI proxy error:", json);
      out.textContent = "AI summary failed (proxy returned an error). Check console.";
      return;
    }

    if (isJunk(text)) {
      out.textContent =
        "AI summary returned an empty/invalid response. Try again or check model settings in the proxy.";
      return;
    }

    out.textContent = text;

  } catch (e){
    console.error(e);
    out.textContent = "AI summary failed (network/proxy error). Check console.";
  } finally {
    __AI.busy = false;
  }
}


// ------------------------------------------------------------
// Ask the Data - coach-flavored chat grounded in the loaded CSV
// ------------------------------------------------------------
const ASK = {
  messages: [],   // [{ role: "user"|"assistant", text }]
  busy: false,
  contextCache: { key: null, block: null },
};

const ASK_SYSTEM_PROMPT = `
You are a veteran instructional coach reading a specific dataset of classroom observations
and student assessment results. Speak like a coach talking to another coach - warm, direct,
specific, and actionable. No corporate BI voice. No hedging. No generic advice.

Rules:
- Ground every claim in the DATA CONTEXT below. If the data does not support a claim, say so.
- Never invent teachers, schools, grades, numbers, or dates.
- Do not name individual teachers by email. If you need to reference a teacher, use a descriptor
  ("the Grade 4 teacher at School X") unless a teacher name is clearly present in the data.
- Keep answers tight - 2 to 5 short paragraphs unless the question clearly asks for more.
- When a question implies an action, end with 1 to 3 coach-next-moves as short bullets.
- When the data truly cannot answer a question, say what additional data would help.
`.trim();

function buildAskContextBlock(){
  // Key off the current filter state + dataset kind + row count so we rebuild
  // only when something meaningful changed.
  const key = JSON.stringify({
    kind: DATASET_KIND || "none",
    n: (FILTERED || []).length,
    school: getMulti ? getMulti($("#f-school")) : [],
    grade:  getMulti ? getMulti($("#f-grade"))  : [],
    type:   getMulti ? getMulti($("#f-type"))   : [],
    band:   getMulti ? getMulti($("#f-band"))   : [],
    from:   $("#f-from")?.value || "",
    to:     $("#f-to")?.value   || "",
  });
  if (ASK.contextCache.key === key && ASK.contextCache.block) {
    return { key, block: ASK.contextCache.block, reused: true };
  }

  const parts = [];
  const kind = DATASET_KIND || "none";
  const n = (FILTERED || []).length;

  parts.push(`Dataset kind: ${kind}`);
  parts.push(`Rows after current filters: ${n}`);

  // Active filters
  const filterSummary = [];
  const sch = getMulti ? getMulti($("#f-school")) : [];
  const grd = getMulti ? getMulti($("#f-grade"))  : [];
  const typ = getMulti ? getMulti($("#f-type"))   : [];
  const bnd = getMulti ? getMulti($("#f-band"))   : [];
  if (sch?.length) filterSummary.push(`schools: ${sch.slice(0, 12).join(", ")}${sch.length > 12 ? " (+more)" : ""}`);
  if (grd?.length) filterSummary.push(`grades: ${grd.join(", ")}`);
  if (typ?.length) filterSummary.push(`type/curriculum: ${typ.join(", ")}`);
  if (bnd?.length) filterSummary.push(`band/module: ${bnd.join(", ")}`);
  const from = $("#f-from")?.value || "";
  const to   = $("#f-to")?.value   || "";
  if (from || to) filterSummary.push(`date window: ${from || "…"} → ${to || "…"}`);
  parts.push(`Active filters: ${filterSummary.length ? filterSummary.join(" | ") : "none"}`);

  // Insight lines already rendered on the Overview cards.
  const insightLines = (typeof getInsightLines === "function") ? getInsightLines() : [];
  if (insightLines.length){
    parts.push("\nAuto-detected insights (from the Overview cards):");
    insightLines.slice(0, 12).forEach(line => parts.push(`- ${line}`));
  }

  // School × Grade summary rows (top by row count) - reuses existing SUMMARY shape.
  const summaryRows = (typeof SUMMARY !== "undefined" && Array.isArray(SUMMARY)) ? SUMMARY.slice() : [];
  if (summaryRows.length){
    summaryRows.sort((a,b) => (b.n || 0) - (a.n || 0));
    const top = summaryRows.slice(0, 18);
    parts.push("\nSchool × Grade summary (top slices by row count):");
    top.forEach(r => {
      const bits = [
        `school=${r.school ?? "?"}`,
        `grade=${r.grade ?? "?"}`,
        `n=${r.n ?? 0}`,
      ];
      if (r.avg_overall_percentage != null) bits.push(`avg=${Number(r.avg_overall_percentage).toFixed(1)}%`);
      const prof = (r.pct_proficient ?? 0) + (r["pct_highly proficient"] ?? 0);
      if (!Number.isNaN(prof) && prof) bits.push(`proficient+=${prof.toFixed(1)}%`);
      const ny = r["pct_not yet proficient"];
      if (ny != null) bits.push(`notYet=${Number(ny).toFixed(1)}%`);
      parts.push(`- ${bits.join(" | ")}`);
    });
  }

  // GMW-specific: per-dimension averages + sampled anonymized comment snippets.
  if (kind === "GMW" && typeof collectGMWCommentSnippets === "function"){
    const snips = collectGMWCommentSnippets(FILTERED || [], { limit: 10, maxLen: 200 });
    if (snips?.length){
      parts.push("\nObservation snippets (anonymized):");
      snips.forEach(s => {
        const ctx = [s.dim, s.scoreLabel, s.grade ? `Grade ${s.grade}` : "", s.curriculum, s.module].filter(Boolean).join(" • ");
        parts.push(`- ${ctx}: ${s.text}`);
      });
    }
  }

  const block = parts.join("\n");
  ASK.contextCache = { key, block };
  return { key, block, reused: false };
}

function buildAskRequestText(userMessage){
  const { block } = buildAskContextBlock();

  const lines = [];
  lines.push("SYSTEM:");
  lines.push(ASK_SYSTEM_PROMPT);
  lines.push("");
  lines.push("DATA CONTEXT (the only facts you may rely on):");
  lines.push(block || "(no data currently loaded)");
  lines.push("");

  // Recent conversation - keep last 8 turns to stay compact.
  const history = ASK.messages.slice(-8);
  history.forEach(m => {
    lines.push(`${m.role === "assistant" ? "ASSISTANT" : "USER"}:`);
    lines.push(m.text);
    lines.push("");
  });

  lines.push("USER:");
  lines.push(userMessage);
  lines.push("");
  lines.push("ASSISTANT:");

  return lines.join("\n");
}

function askRenderTranscript(){
  const host = $("#ask-transcript");
  if (!host) return;
  const empty = $("#ask-empty");

  if (!ASK.messages.length){
    host.innerHTML = "";
    if (empty){
      host.appendChild(empty);
      empty.style.display = "";
    } else {
      host.innerHTML = `<div class="ask-empty" id="ask-empty"><div class="ask-empty-title">Ask like you'd talk to a coach.</div><div class="ask-empty-sub">Your question gets answered using the rows and filters currently loaded.</div></div>`;
    }
    return;
  }

  host.innerHTML = "";
  ASK.messages.forEach(m => {
    const bubble = document.createElement("div");
    bubble.className = "ask-bubble ask-bubble--" + (m.role === "assistant" ? "assistant" : "user");
    const who = document.createElement("div");
    who.className = "ask-bubble-who";
    who.textContent = m.role === "assistant" ? "Coach assistant" : "You";
    const body = document.createElement("div");
    body.className = "ask-bubble-body";
    body.textContent = m.text;
    bubble.appendChild(who);
    bubble.appendChild(body);
    host.appendChild(bubble);
  });
  host.scrollTop = host.scrollHeight;
}

function askUpdateContextChip(){
  const chip = $("#ask-context-chip");
  const text = $("#ask-context-text");
  if (!chip || !text) return;

  const kind = DATASET_KIND || "none";
  const n = (FILTERED || []).length;

  if (kind === "none" || !n){
    chip.classList.remove("ready");
    text.textContent = "No data loaded yet - upload a CSV to start.";
    return;
  }
  chip.classList.add("ready");
  const label = kind === "GMW" ? "Observations" : kind === "EM2" ? "Assessments" : "Rows";
  text.textContent = `${label}: ${n.toLocaleString()} rows in scope · filters applied`;
}

async function askSubmit(userText){
  const trimmed = String(userText || "").trim();
  if (!trimmed || ASK.busy) return;

  ASK.messages.push({ role: "user", text: trimmed });
  // Placeholder assistant bubble for the "thinking" state.
  ASK.messages.push({ role: "assistant", text: "Thinking…" });
  askRenderTranscript();

  ASK.busy = true;
  const sendBtn = $("#ask-send");
  if (sendBtn) sendBtn.disabled = true;

  try {
    const requestText = buildAskRequestText(trimmed);
    const r = await fetch(OPENAI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: OPENAI_API_KEY,
        text: requestText,
        max_output_tokens: 700,
        temperature: 0.35,
      }),
    });

    const json = await r.json();
    if (!r.ok){
      console.error("Ask the Data proxy error:", json);
      ASK.messages[ASK.messages.length - 1] = {
        role: "assistant",
        text: "I couldn't reach the model (proxy error). Check the console and try again.",
      };
      askRenderTranscript();
      return;
    }

    const text = safeTextFromOpenAIResponse(json);
    if (!text){
      ASK.messages[ASK.messages.length - 1] = {
        role: "assistant",
        text: "I got an empty response from the model. Try rephrasing the question.",
      };
      askRenderTranscript();
      return;
    }

    ASK.messages[ASK.messages.length - 1] = { role: "assistant", text };
    askRenderTranscript();
  } catch (e){
    console.error("Ask the Data network error:", e);
    ASK.messages[ASK.messages.length - 1] = {
      role: "assistant",
      text: "Network error while contacting the model. Check your connection and try again.",
    };
    askRenderTranscript();
  } finally {
    ASK.busy = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function initAskChat(){
  const form   = $("#ask-composer");
  const input  = $("#ask-input");
  const clear  = $("#ask-clear");
  const chips  = document.querySelectorAll("#ask-chips .ask-chip");

  askUpdateContextChip();
  askRenderTranscript();

  if (form){
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = input?.value || "";
      if (!v.trim()) return;
      if (input) input.value = "";
      askSubmit(v);
    });
  }

  if (input){
    input.addEventListener("keydown", (ev) => {
      // Cmd/Ctrl + Enter submits; plain Enter keeps newline UX predictable.
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter"){
        ev.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const p = chip.dataset.prompt || chip.textContent || "";
      if (!p.trim()) return;
      askSubmit(p.trim());
    });
  });

  if (clear){
    clear.addEventListener("click", () => {
      ASK.messages = [];
      askRenderTranscript();
      if (input) input.focus();
    });
  }

  // Refresh context chip whenever filters are applied.
  document.querySelector("#btn-apply")?.addEventListener("click", () => {
    setTimeout(askUpdateContextChip, 0);
  });
}


// ------------------------------------------------------------
// THE ORACLE - longitudinal charts with linear-regression forecasts
// ------------------------------------------------------------
let __oracleChart = null;

const ORACLE_GROUPBYS = {
  EM2: [
    { value: "school",              label: "School" },
    { value: "grade",               label: "Grade" },
    { value: "type_of_assessment",  label: "Assessment Type" },
    { value: "performance_band",    label: "Performance Band" },
  ],
  GMW: [
    { value: "school",         label: "School" },
    { value: "grade",          label: "Grade" },
    { value: "teacher",        label: "Teacher" },
    { value: "observer_name",  label: "Observer" },
    { value: "observer_role",  label: "Observer Role" },
    { value: "state",          label: "State" },
    { value: "district",       label: "District" },
    { value: "school_type",    label: "School Type" },
    { value: "curriculum",     label: "Curriculum" },
    { value: "module",         label: "Module" },
    { value: "dim",            label: "Dimension" },
  ],
};

const ORACLE_METRICS = {
  EM2: [
    { value: "avg_overall_percentage", label: "Average %" },
    { value: "pct_proficient_plus",    label: "% Proficient or higher" },
    { value: "pct_not_yet",            label: "% Not Yet Proficient" },
    { value: "count",                  label: "Row count" },
  ],
  GMW: [
    { value: "avg_dim_score", label: "Average rubric score (1–3)" },
    { value: "pct_achieving", label: "% Achieving (score 3)" },
    { value: "pct_emerging",  label: "% Emerging (score 1)" },
    { value: "count",         label: "Observation count" },
  ],
};

function oracleFillControl(sel, opts, prefer){
  if (!sel) return;
  sel.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
  if (prefer && opts.some(o => o.value === prefer)) sel.value = prefer;
}

function oraclePopulateControls(){
  const kind = (DATASET_KIND === "GMW") ? "GMW" : "EM2";
  const groupBy = $("#oracle-groupby");
  const metric  = $("#oracle-metric");
  oracleFillControl(groupBy, ORACLE_GROUPBYS[kind], groupBy?.value);
  oracleFillControl(metric,  ORACLE_METRICS[kind],  metric?.value);
}

function oracleBucketKey(date, bucket){
  if (!(date instanceof Date) || isNaN(date)) return null;
  const y = date.getFullYear();
  const m = date.getMonth();
  if (bucket === "week"){
    // Monday-based week; produce YYYY-Www using ISO week
    const d = new Date(Date.UTC(y, m, date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  if (bucket === "quarter"){
    const q = Math.floor(m / 3) + 1;
    return `${y}-Q${q}`;
  }
  // month (default/auto)
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function oracleAutoBucket(rows){
  // Choose month if span ≥ 6 months, quarter if ≥ 2 years, else week.
  const dates = rows.map(r => r.__date_completed).filter(d => d instanceof Date && !isNaN(d));
  if (!dates.length) return "month";
  const min = dates.reduce((a,b) => a < b ? a : b);
  const max = dates.reduce((a,b) => a > b ? a : b);
  const months = (max.getFullYear() - min.getFullYear()) * 12 + (max.getMonth() - min.getMonth());
  if (months >= 24) return "quarter";
  if (months >= 6)  return "month";
  return "week";
}

function oracleBucketToCenterDate(key, bucket){
  // Convert a bucket key back to a representative Date (middle of the bucket).
  if (bucket === "week"){
    const [yStr, wStr] = key.split("-W");
    const y = Number(yStr), w = Number(wStr);
    const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
    const day = simple.getUTCDay() || 7;
    if (day <= 4) simple.setUTCDate(simple.getUTCDate() - day + 1);
    else          simple.setUTCDate(simple.getUTCDate() + 8 - day);
    simple.setUTCDate(simple.getUTCDate() + 3); // mid-week
    return simple;
  }
  if (bucket === "quarter"){
    const [y, q] = key.split("-Q");
    return new Date(Number(y), (Number(q) - 1) * 3 + 1, 15);
  }
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 15);
}

function oracleAdvanceBucket(date, bucket, steps){
  const d = new Date(date);
  if (bucket === "week")    d.setDate(d.getDate() + 7 * steps);
  else if (bucket === "quarter") d.setMonth(d.getMonth() + 3 * steps);
  else                      d.setMonth(d.getMonth() + steps);
  return d;
}

// For GMW, one RAW row carries 8 dimension scores (d1..d8). When the lens is
// "dim", we emit 8 virtual rows so each dimension gets its own series. For all
// other lenses we work on the original rows.
const GMW_DIM_LABELS = [
  "Lesson Components","Pedagogical Elements","Cognitive Lift","Discourse",
  "Collecting Evidence","Feedback","Collaborative Engagement","Independent Engagement",
];

function oracleExplodeGMWByDim(rows){
  const out = [];
  for (const r of rows){
    for (let k = 1; k <= 8; k++){
      const s = Number(r[`d${k}`]);
      if (!Number.isFinite(s)) continue;
      out.push({ ...r, __dimName: GMW_DIM_LABELS[k-1], __dimScore: s });
    }
  }
  return out;
}

function oracleRowsForLens(rows, groupBy){
  if (groupBy === "dim") return oracleExplodeGMWByDim(rows);
  return rows;
}

function oracleEntityKey(row, field){
  if (field === "dim") return row.__dimName || "";
  const v = row[field];
  if (v == null || v === "") return "";
  return String(v);
}

function oracleGMWRowScore(row){
  // Prefer the exploded dim score when present; otherwise average the 8 dims.
  if (Number.isFinite(row.__dimScore)) return row.__dimScore;
  let sum = 0, n = 0;
  for (let k = 1; k <= 8; k++){
    const v = Number(row[`d${k}`]);
    if (Number.isFinite(v)){ sum += v; n++; }
  }
  return n ? sum / n : null;
}

function oracleRowMetricValue(row, metric){
  if (metric === "avg_overall_percentage"){
    const v = Number(row.overall_percentage);
    return Number.isFinite(v) ? v : null;
  }
  if (metric === "pct_proficient_plus"){
    const b = String(row.performance_band || "").toLowerCase();
    if (!b) return null;
    return (b === "proficient" || b === "highly proficient") ? 100 : 0;
  }
  if (metric === "pct_not_yet"){
    const b = String(row.performance_band || "").toLowerCase();
    if (!b) return null;
    return b === "not yet proficient" ? 100 : 0;
  }
  if (metric === "avg_dim_score"){
    return oracleGMWRowScore(row);
  }
  if (metric === "pct_achieving"){
    const v = oracleGMWRowScore(row);
    if (v == null) return null;
    return v >= 3 ? 100 : 0;
  }
  if (metric === "pct_emerging"){
    const v = oracleGMWRowScore(row);
    if (v == null) return null;
    return v <= 1 ? 100 : 0;
  }
  if (metric === "count") return 1;
  return null;
}

function oracleAggregate(values, metric){
  if (!values.length) return null;
  if (metric === "count") return values.length;
  let sum = 0, n = 0;
  for (const v of values){
    if (v == null || Number.isNaN(v)) continue;
    sum += v; n++;
  }
  return n ? sum / n : null;
}

// Simple linear regression on {x, y} points → { slope, intercept }.
function oracleLinearFit(points){
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points){
    sx  += p.x;
    sy  += p.y;
    sxy += p.x * p.y;
    sxx += p.x * p.x;
  }
  const denom = (n * sxx - sx * sx);
  if (!denom) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

function oracleBuildSeries({ rows, groupBy, metric, bucket, topN }){
  const effectiveRows = oracleRowsForLens(rows, groupBy);
  // Bucket every row by (entity, bucketKey), collecting metric values
  const grouped = new Map(); // entity -> Map(bucketKey -> values[])
  const keyOrder = new Set(); // preserve bucket order

  for (const r of effectiveRows){
    const date = r.__date_completed;
    if (!(date instanceof Date) || isNaN(date)) continue;
    const ent = oracleEntityKey(r, groupBy);
    if (!ent) continue;
    const key = oracleBucketKey(date, bucket);
    if (!key) continue;
    const v = oracleRowMetricValue(r, metric);
    if (v == null) continue;

    if (!grouped.has(ent)) grouped.set(ent, new Map());
    const inner = grouped.get(ent);
    if (!inner.has(key)) inner.set(key, []);
    inner.get(key).push(v);
    keyOrder.add(key);
  }

  // Sorted unique bucket keys (chronological)
  const bucketKeys = [...keyOrder].sort((a, b) => oracleBucketToCenterDate(a, bucket) - oracleBucketToCenterDate(b, bucket));

  // Aggregate per entity per bucket
  const series = [];
  for (const [entity, inner] of grouped.entries()){
    const points = [];
    let totalN = 0;
    bucketKeys.forEach((k, i) => {
      if (inner.has(k)){
        const vals = inner.get(k);
        totalN += vals.length;
        const agg = oracleAggregate(vals, metric);
        if (agg != null) points.push({ i, key: k, value: agg, n: vals.length });
      }
    });
    if (points.length >= 1){
      series.push({ entity, points, totalN });
    }
  }

  // Rank by totalN (most-observed first), cap to topN
  series.sort((a, b) => b.totalN - a.totalN);
  return { series: series.slice(0, topN), bucketKeys };
}

function oracleForecastSeries(series, bucketKeys, forecastSteps){
  if (!forecastSteps) return { futureKeys: [], perSeries: [] };
  const futureKeys = [];
  const lastIdx = bucketKeys.length - 1;
  for (let s = 1; s <= forecastSteps; s++) futureKeys.push(`+${s}`);

  const perSeries = series.map((s) => {
    const pts = s.points.map(p => ({ x: p.i, y: p.value }));
    const fit = oracleLinearFit(pts);
    if (!fit) return { entity: s.entity, forecast: [], fit: null };
    const forecast = [];
    for (let s2 = 1; s2 <= forecastSteps; s2++){
      const x = lastIdx + s2;
      const y = fit.intercept + fit.slope * x;
      forecast.push({ i: x, value: y });
    }
    return { entity: s.entity, forecast, fit };
  });
  return { futureKeys, perSeries };
}

function oracleFormatLabelKey(key, bucket){
  if (bucket === "week")    return key;            // 2026-W14
  if (bucket === "quarter") return key;            // 2026-Q2
  const [y, m] = key.split("-");
  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
  return `${monthName} ${y}`;                      // Feb 2026
}

function oracleColor(i){
  return RPPL_CHART_SEQ[i % RPPL_CHART_SEQ.length];
}

function oracleRenderChart(){
  const canvas = $("#chartOracle");
  if (!canvas) return;

  const groupBy = $("#oracle-groupby")?.value || "school";
  const metric  = $("#oracle-metric")?.value  || "avg_overall_percentage";
  let   bucket  = $("#oracle-bucket")?.value  || "month";
  const forecastSteps = Number($("#oracle-forecast")?.value || 0);
  const topN    = Number($("#oracle-topn")?.value || 5);

  const rows = (FILTERED && FILTERED.length) ? FILTERED : [];
  if (!rows.length){
    oracleSetNote("No data in scope. Load a CSV or loosen your filters to summon the Oracle.");
    oracleDestroyChart();
    oracleRenderInsights([]);
    return;
  }

  if (bucket === "auto") bucket = oracleAutoBucket(rows);

  const { series, bucketKeys } = oracleBuildSeries({ rows, groupBy, metric, bucket, topN });
  if (!series.length || bucketKeys.length < 1){
    oracleSetNote("Not enough dated rows to build a timeline. Try a different lens or widen the date window.");
    oracleDestroyChart();
    oracleRenderInsights([]);
    return;
  }

  const { futureKeys, perSeries: forecastBySeries } = oracleForecastSeries(series, bucketKeys, forecastSteps);
  const labels = [
    ...bucketKeys.map(k => oracleFormatLabelKey(k, bucket)),
    ...futureKeys.map(() => `Forecast`),
  ];

  // Build datasets: history solid line, forecast dashed extension (separate dataset)
  const datasets = [];
  series.forEach((s, i) => {
    const color = oracleColor(i);
    const historyData = new Array(bucketKeys.length + futureKeys.length).fill(null);
    s.points.forEach(p => { historyData[p.i] = p.value; });
    datasets.push({
      label: s.entity,
      data: historyData,
      borderColor: color,
      backgroundColor: color + "22",
      pointBackgroundColor: color,
      tension: 0.25,
      spanGaps: true,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
    });

    if (forecastSteps){
      const fc = forecastBySeries[i];
      if (fc && fc.forecast.length){
        const fcData = new Array(bucketKeys.length + futureKeys.length).fill(null);
        // Anchor the forecast line to the last history point so it looks continuous
        if (s.points.length){
          const lastPt = s.points[s.points.length - 1];
          fcData[lastPt.i] = lastPt.value;
        }
        fc.forecast.forEach(p => { fcData[p.i] = p.value; });
        datasets.push({
          label: `${s.entity} · forecast`,
          data: fcData,
          borderColor: color,
          backgroundColor: color + "10",
          borderDash: [6, 6],
          pointStyle: "triangle",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true,
        });
      }
    }
  });

  oracleDestroyChart();
  const ctx = canvas.getContext("2d");
  __oracleChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 14, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y;
              if (val == null) return `${ctx.dataset.label}: -`;
              const rounded = (metric === "count") ? Math.round(val) : Number(val).toFixed(1);
              const suffix = (metric === "count") ? "" :
                             (metric === "avg_dim_score") ? "" : "%";
              return `${ctx.dataset.label}: ${rounded}${suffix}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: metric === "count" ? true : false,
          ticks: {
            callback: (v) => (metric === "count") ? v : (metric === "avg_dim_score" ? v : v + "%"),
          },
        },
      },
    },
  });

  // Note + insights
  const horizonLabel = forecastSteps ? ` · ${forecastSteps}-${bucket} forecast` : "";
  oracleSetNote(`${series.length} entities · ${bucketKeys.length} ${bucket} buckets${horizonLabel}.`);
  oracleRenderInsights(series.map((s, i) => ({ s, fit: forecastBySeries[i]?.fit })));
}

function oracleSetNote(msg){
  const el = $("#oracle-chart-note");
  if (el) el.textContent = msg;
  const note = $("#oracle-note");
  if (note) note.textContent = msg;
}

function oracleDestroyChart(){
  if (__oracleChart){
    try { __oracleChart.destroy(); } catch {}
    __oracleChart = null;
  }
}

function oracleRenderInsights(items){
  const host = $("#oracle-insights");
  if (!host) return;
  host.innerHTML = "";
  if (!items?.length) return;

  // Rank by slope: steepest risers and fallers.
  const withSlope = items.filter(it => it.fit && Number.isFinite(it.fit.slope));
  if (!withSlope.length) return;

  withSlope.sort((a, b) => b.fit.slope - a.fit.slope);
  const topRiser = withSlope[0];
  const topFaller = withSlope[withSlope.length - 1];
  const mostStable = [...withSlope].sort((a, b) => Math.abs(a.fit.slope) - Math.abs(b.fit.slope))[0];

  const card = (kicker, title, sub, cls) => `
    <div class="oracle-insight ${cls}">
      <div class="oracle-insight-kicker">${kicker}</div>
      <div class="oracle-insight-title">${escapeHTML(title)}</div>
      <div class="oracle-insight-sub">${escapeHTML(sub)}</div>
    </div>`;

  const fmtSlope = (s) => (s >= 0 ? "+" : "") + s.toFixed(2) + " per bucket";

  host.innerHTML = [
    topRiser ? card("📈 Steepest rise", topRiser.s.entity, `Trend slope ${fmtSlope(topRiser.fit.slope)} · ${topRiser.s.totalN} rows`, "rise") : "",
    topFaller && topFaller !== topRiser ? card("📉 Sharpest drop", topFaller.s.entity, `Trend slope ${fmtSlope(topFaller.fit.slope)} · ${topFaller.s.totalN} rows`, "drop") : "",
    mostStable ? card("🧘 Most stable", mostStable.s.entity, `Near-flat trajectory · ${mostStable.s.totalN} rows`, "stable") : "",
  ].filter(Boolean).join("");
}

function initOracle(){
  oraclePopulateControls();
  ["oracle-groupby","oracle-metric","oracle-bucket","oracle-forecast","oracle-topn"].forEach(id => {
    $("#" + id)?.addEventListener("change", oracleRenderChart);
  });
  $("#oracle-run")?.addEventListener("click", oracleRenderChart);
}

// Re-populate the Oracle's group-by/metric options whenever the dataset kind changes,
// and re-render if the user is currently looking at the Oracle page.
function oracleOnDataChange(){
  oraclePopulateControls();
  const onOracle = document.querySelector("#page-oracle")?.style.display !== "none";
  if (onOracle) oracleRenderChart();
}


// ------------------------------------------------------------
// DOCS PAGE - tab toggle + commit history
// ------------------------------------------------------------
const DOCS_HISTORY = [
  { h:"v1.2.1",  a:"Neithan",        d:"2026-05-21", s:"v1.2.1: rubric dimension tooltips across dashboard, new \"What the Tool Captures\" + \"Dimension Definitions\" docs sections with 12 animated SVG diagrams, anonymized demo data (data/) + Node.js anonymizer (scripts/), README.md, safeupload/ bundle", b:"main",                          m:false, head:true },
  { h:"cd33969", a:"Neithan",        d:"2026-04-14", s:"ask the data feature implemented",                                                             b:"main",                          m:false },
  { h:"2f04ea1", a:"Neithan",        d:"2026-04-11", s:"fix: sidebar",                                                                                  b:"main",                          m:false },
  { h:"0a6d282", a:"Neithan",        d:"2026-04-09", s:"housekeeping: remote sync test",                                                                b:"master",                        m:false },
  { h:"31e91b2", a:"Neithan",        d:"2026-04-05", s:"Added Docs page",                                                                               b:"main",                          m:false },
  { h:"aa15fc4", a:"Neithan",        d:"2026-03-30", s:"fixed styling via RPPL Style Guide and fixed GMW quickshare",                                   b:"main",                          m:false },
  { h:"f59b4a7", a:"Neithan Casano", d:"2026-03-24", s:"Merge pull request #8 (feature/duplicate-declarations)",                                        b:"main",                          m:true  },
  { h:"6099611", a:"Neithan Casano", d:"2026-03-22", s:"Merge main into feature/duplicate-declarations",                                                b:"feature/duplicate-declarations",m:true  },
  { h:"c625a50", a:"Neithan Casano", d:"2026-03-18", s:"Apply premium visual theme and unify filter/dashboard button styling",                          b:"main",                          m:false },
  { h:"abf7576", a:"Neithan Casano", d:"2026-03-14", s:"Merge pull request #7 (feature/duplicate-declarations)",                                        b:"main",                          m:true  },
  { h:"6b43232", a:"Neithan Casano", d:"2026-03-12", s:"Merge main into feature/duplicate-declarations",                                                b:"feature/duplicate-declarations",m:true  },
  { h:"7c8e636", a:"Neithan Casano", d:"2026-03-08", s:"Align dashboard charts with overview and improve dashboard layout",                             b:"feature/duplicate-declarations",m:false },
  { h:"4e8b169", a:"Neithan Casano", d:"2026-03-04", s:"Merge pull request #6 (feature/duplicate-declarations)",                                        b:"main",                          m:true  },
  { h:"bb45b22", a:"Neithan Casano", d:"2026-03-02", s:"Merge main into feature/duplicate-declarations",                                                b:"feature/duplicate-declarations",m:true  },
  { h:"dbb4b80", a:"Neithan Casano", d:"2026-02-26", s:"Make dashboard charts mirror overview and wire summary button",                                 b:"feature/duplicate-declarations",m:false },
  { h:"e8ce90e", a:"Neithan Casano", d:"2026-02-22", s:"Merge pull request #5 (feature/duplicate-declarations)",                                        b:"main",                          m:true  },
  { h:"bde0cf5", a:"Neithan Casano", d:"2026-02-20", s:"Fix duplicate declarations from bad merge resolution",                                          b:"feature/duplicate-declarations",m:false },
  { h:"e6d29db", a:"Neithan Casano", d:"2026-02-17", s:"Update visualizer.js",                                                                          b:"main",                          m:false },
  { h:"e6f9116", a:"Neithan Casano", d:"2026-02-15", s:"Update visualizer.js",                                                                          b:"main",                          m:false },
  { h:"738eef5", a:"Neithan Casano", d:"2026-02-12", s:"Merge pull request #4 (feature/secret-message)",                                                b:"main",                          m:true  },
  { h:"b29b28b", a:"Neithan Casano", d:"2026-02-10", s:"Merge main into feature/secret-message",                                                        b:"feature/secret-message",        m:true  },
  { h:"6c2d505", a:"Neithan Casano", d:"2026-02-07", s:"Fix dashboard snapshot data mapping and improve compare workspace",                             b:"feature/secret-message",        m:false },
  { h:"74ded47", a:"Neithan Casano", d:"2026-02-04", s:"Update visualizer.js",                                                                          b:"main",                          m:false },
  { h:"bb3a29a", a:"Neithan Casano", d:"2026-02-01", s:"Update visualizer.js",                                                                          b:"main",                          m:false },
  { h:"f511cf5", a:"Neithan Casano", d:"2026-01-29", s:"Update visualizer.js",                                                                          b:"main",                          m:false },
  { h:"b1f761d", a:"Neithan Casano", d:"2026-01-27", s:"Merge pull request #3 (feature/secret-message)",                                                b:"main",                          m:true  },
  { h:"2879c82", a:"Neithan Casano", d:"2026-01-25", s:"Merge main into feature/secret-message",                                                        b:"feature/secret-message",        m:true  },
  { h:"271d189", a:"Neithan Casano", d:"2026-01-22", s:"Add dashboard snapshot saving, compare view, and AI summary workflow",                          b:"feature/secret-message",        m:false },
  { h:"1a12e8b", a:"Neithan Casano", d:"2026-01-20", s:"Merge pull request #2 (feature/secret-message)",                                                b:"main",                          m:true  },
  { h:"0893af8", a:"Neithan Casano", d:"2026-01-18", s:"Merge main into feature/secret-message",                                                        b:"feature/secret-message",        m:true  },
  { h:"185f5e1", a:"Neithan Casano", d:"2026-01-16", s:"Add right-panel Overview/Dashboard tabs with placeholder view",                                 b:"feature/secret-message",        m:false },
  { h:"43d67e9", a:"Neithan Casano", d:"2026-01-14", s:"Merge pull request #1 (feature/secret-message)",                                                b:"main",                          m:true  },
  { h:"509c0dc", a:"Neithan Casano", d:"2026-01-12", s:"Add sidebar copyright footer with current year",                                                b:"feature/secret-message",        m:false },
  { h:"c371426", a:"Neithan Casano", d:"2026-01-10", s:"Update openai_test.js",                                                                         b:"main",                          m:false },
  { h:"1799f23", a:"Neithan Casano", d:"2026-01-09", s:"Update visualizer.js",                                                                          b:"main",                          m:false },
  { h:"60a0fe6", a:"Neithan Casano", d:"2026-01-08", s:"Update openai_test.js",                                                                         b:"main",                          m:false },
  { h:"e080e00", a:"Neithan Casano", d:"2026-01-07", s:"Update openai_test.js",                                                                         b:"main",                          m:false },
  { h:"1b7a1f3", a:"Neithan",        d:"2026-01-06", s:"Initial sync aims",                                                                             b:"main",                          m:false, first:true },
];

const DOCS_BRANCH_COLORS = {
  "main":                           "#700548",
  "master":                         "#3E2A36",
  "feature/duplicate-declarations": "#03568A",
  "feature/secret-message":         "#CC5803",
};

function renderDocsHistory(){
  const host = $("#docs-history");
  if (!host) return;

  const byDate = new Map();
  DOCS_HISTORY.forEach(c => {
    if (!byDate.has(c.d)) byDate.set(c.d, []);
    byDate.get(c.d).push(c);
  });
  const branches = [...new Set(DOCS_HISTORY.map(c => c.b))];

  const legendHTML = `
    <div class="docs-history-legend">
      ${branches.map(b => `
        <span class="docs-history-legend-item">
          <span class="docs-history-dot" style="background:${DOCS_BRANCH_COLORS[b] || "#8A7F85"}"></span>
          ${escapeHTML(b)}
        </span>
      `).join("")}
      <span class="docs-history-legend-item"><span class="docs-history-merge-mark">⤭</span> Merge commit</span>
    </div>
  `;

  const dayBlocks = [...byDate.entries()].map(([date, commits]) => {
    const items = commits.map(c => {
      const color = DOCS_BRANCH_COLORS[c.b] || "#8A7F85";
      const badges = [];
      if (c.head)  badges.push(`<span class="docs-commit-badge head">HEAD</span>`);
      if (c.first) badges.push(`<span class="docs-commit-badge first">FIRST</span>`);
      if (c.m)     badges.push(`<span class="docs-commit-badge merge">MERGE</span>`);
      return `
        <li class="docs-commit ${c.m ? "is-merge" : ""}">
          <div class="docs-commit-rail" style="--branch-color:${color}">
            <span class="docs-commit-dot"></span>
          </div>
          <div class="docs-commit-body">
            <div class="docs-commit-top">
              <code class="docs-commit-hash">${escapeHTML(c.h)}</code>
              <span class="docs-commit-branch" style="color:${color}; border-color:${color}33; background:${color}0f;">${escapeHTML(c.b)}</span>
              ${badges.join("")}
            </div>
            <div class="docs-commit-subject">${escapeHTML(c.s)}</div>
            <div class="docs-commit-meta">${escapeHTML(c.a)}</div>
          </div>
        </li>
      `;
    }).join("");

    return `
      <div class="docs-history-day">
        <div class="docs-history-date">${escapeHTML(date)}</div>
        <ul class="docs-commit-list">${items}</ul>
      </div>
    `;
  }).join("");

  host.innerHTML = legendHTML + dayBlocks;
}

function initDocsTabs(){
  const tabs = document.querySelectorAll(".docs-tabs .docs-tab");
  const panels = document.querySelectorAll(".docs-tab-panel");
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.docsTab;
      tabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach(p => {
        const show = p.dataset.docsPanel === target;
        p.style.display = show ? "" : "none";
      });
      if (target === "history") renderDocsHistory();
    });
  });
}


function setStatus(msg){
  $("#data-status").textContent = msg;
}

function fillSelect(el, values){
  el.innerHTML = "";
  values.forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

function ensureGMWFilterStrip(){
  let host = document.querySelector("#gmw-filter-strip");
  if (!host) return null;

  if (host.dataset.ready === "1") return host;

  const defs = [
    ["observer_name", "Observer Name"],
    ["observer_email", "Observer Email"],
    ["observer_role", "Observer Role"],
    ["state", "State"],
    ["district", "District"],
    ["school_type", "School Type"],
    ["teacher", "Teacher"],
    // (grade, curriculum, module are already in the 4 main filters, but you can include them too if you want)
  ];

  host.innerHTML = defs.map(([key,label]) => `
    <div class="gmw-filter">
      <label>${label}</label>
      <select multiple id="gmw-${key}"></select>
    </div>
  `).join("");

  host.dataset.ready = "1";
  return host;
}

function fillGMWExtraFiltersFromRAW(){
  const host = ensureGMWFilterStrip();
  if (!host) return;

	const wrap = document.querySelector("#gmw-filter-strip-wrap");
	if (wrap) wrap.style.display = "block";
	host.style.display = "flex";
	
	host.style.display = "";

  const fields = ["observer_name","observer_email","observer_role","state","district","school_type","teacher"];
  for (const f of fields){
    const sel = document.querySelector(`#gmw-${CSS.escape(f)}`);
    if (!sel) continue;
    fillSelect(sel, uniqueSorted(RAW.map(r => String(r[f] || "").trim()).filter(Boolean)));
  }
}

function readGMWExtraFilterState(){
  const getSel = (id) => Array.from(document.querySelector(id)?.selectedOptions || []).map(o=>o.value);
  return {
    observer_name: getSel("#gmw-observer_name"),
    observer_email: getSel("#gmw-observer_email"),
    observer_role: getSel("#gmw-observer_role"),
    state: getSel("#gmw-state"),
    district: getSel("#gmw-district"),
    school_type: getSel("#gmw-school_type"),
    teacher: getSel("#gmw-teacher"),
  };
}

function getMulti(sel){
  return Array.from(sel.selectedOptions).map(o=>o.value);
}

function applyFilters(){

	if (!window.__SV_RESTORING) unlockQuickshareAI();

  const schools = getMulti($("#f-school"));
  const grades  = getMulti($("#f-grade"));
  const types   = getMulti($("#f-type"));
  const bands   = getMulti($("#f-band"));

  const from = $("#f-from").value ? new Date($("#f-from").value) : null;
  const to   = $("#f-to").value ? new Date($("#f-to").value) : null;
	
	const gmwExtra = (DATASET_KIND === "GMW") ? readGMWExtraFilterState() : null;

	FILTERED = RAW.filter(r=>{
		if (schools.length && !schools.includes(r.school)) return false;
		if (grades.length && !grades.includes(String(r.grade))) return false;

		if (DATASET_KIND === "GMW"){
			// repurposed: f-type = curriculum, f-band = module
			if (types.length && !types.includes(String(r.curriculum || ""))) return false;
			if (bands.length && !bands.includes(String(r.module || ""))) return false;

			// ✅ extra GMW-only filters from the horizontal strip
			if (gmwExtra){
				if (gmwExtra.observer_name?.length && !gmwExtra.observer_name.includes(String(r.observer_name || ""))) return false;
				if (gmwExtra.observer_email?.length && !gmwExtra.observer_email.includes(String(r.observer_email || ""))) return false;
				if (gmwExtra.observer_role?.length && !gmwExtra.observer_role.includes(String(r.observer_role || ""))) return false;
				if (gmwExtra.state?.length && !gmwExtra.state.includes(String(r.state || ""))) return false;
				if (gmwExtra.district?.length && !gmwExtra.district.includes(String(r.district || ""))) return false;
				if (gmwExtra.school_type?.length && !gmwExtra.school_type.includes(String(r.school_type || ""))) return false;
				if (gmwExtra.teacher?.length && !gmwExtra.teacher.includes(String(r.teacher || ""))) return false;
			}
		} else {
			if (types.length && !types.includes(r.type_of_assessment)) return false;
			if (bands.length && !bands.includes(r.performance_band)) return false;
		}

		// Date filter still works because RAW rows have __date_completed
		if (from || to){
			const dc = r.__date_completed;
			if (!dc) return false;
			if (from && dc < from) return false;
			if (to){
				const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23,59,59,999);
				if (dc > end) return false;
			}
		}
		return true;
	});

  SUMMARY = buildSummarySchoolGrade(FILTERED);
  renderAll();
  if (typeof askUpdateContextChip === "function") askUpdateContextChip();
  if (typeof oracleOnDataChange === "function") oracleOnDataChange();
}

function buildSummarySchoolGrade(rows){
  const map = new Map();

  for (const r of rows){
    const school = r.school || "";
    const grade = String(r.grade ?? "");
    const key = `${school}|||${grade}`;

    if (!map.has(key)){
      map.set(key, {
        school,
        grade,
        n: 0,
        sumPct: 0,
        sumAch: 0,
        sumPos: 0,
        bandCounts: Object.fromEntries(BAND_ORDER.map(b=>[b,0])),
      });
    }
    const g = map.get(key);
    g.n += 1;

    const pct = Number(r.overall_percentage ?? 0);
    if (isFinite(pct)) g.sumPct += pct;

    const ach = Number(r.overall_points_achieved ?? 0);
    const pos = Number(r.overall_points_possible ?? 0);
    if (isFinite(ach)) g.sumAch += ach;
    if (isFinite(pos)) g.sumPos += pos;

    const band = normBand(r.performance_band);
    if (!g.bandCounts[band] && !BAND_ORDER.includes(band)) {
      // ignore unknown labels, but you could capture them if needed
    } else {
      g.bandCounts[band] = (g.bandCounts[band] || 0) + 1;
    }
  }

  const out = Array.from(map.values()).map(x=>{
    const avg_overall_percentage = x.n ? (x.sumPct / x.n) : 0;
    const points_pct = x.sumPos ? (x.sumAch / x.sumPos) * 100 : 0;

    const bandPct = {};
    for (const b of BAND_ORDER){
      bandPct[b] = x.n ? ( (x.bandCounts[b] || 0) / x.n * 100 ) : 0;
    }

    return {
      school: x.school,
      grade: x.grade,
      n: x.n,
      avg_overall_percentage,
      points_pct,
      ...Object.fromEntries(BAND_ORDER.map(b=>[`pct_${b}`, bandPct[b]])),
    };
  });

  // stable ordering: school then grade number
  out.sort((a,b)=>{
    const s = String(a.school).localeCompare(String(b.school));
    if (s) return s;
    return Number(a.grade) - Number(b.grade);
  });

  return out;
}

function renderKPIs(){
  const schools = new Set(FILTERED.map(r=>r.school));
  const grades = new Set(FILTERED.map(r=>String(r.grade)));
  const avgPct = FILTERED.length
    ? (FILTERED.reduce((acc,r)=> acc + (Number(r.overall_percentage)||0), 0) / FILTERED.length)
    : 0;

  $("#kpis").innerHTML = `
    <div class="kpi"><div class="k">Rows</div><div class="v">${FILTERED.length.toLocaleString()}</div></div>
    <div class="kpi"><div class="k">Schools</div><div class="v">${schools.size.toLocaleString()}</div></div>
    <div class="kpi"><div class="k">Grades</div><div class="v">${grades.size.toLocaleString()}</div></div>
    <div class="kpi"><div class="k">Avg % (row mean)</div><div class="v">${avgPct.toFixed(1)}%</div></div>
  `;
}

function destroyChart(c){
  if (c) c.destroy();
}

// jn.022326.gmw.bars - breakdowns + averages

function gmwDimBreakdown(rows, dimKey){
  // returns { n, emerging, developing, achieving } as counts
  const xs = (rows || []).map(r => Number(r?.[dimKey])).filter(v => Number.isFinite(v) && v > 0);
  const out = { n: xs.length, emerging: 0, developing: 0, achieving: 0 };
  for (const v of xs){
    if (v === 1) out.emerging++;
    else if (v === 2) out.developing++;
    else if (v === 3) out.achieving++;
  }
  return out;
}

function renderGMWBarsAndAvg(){
  const emWrap = document.querySelector("#em2-charts-wrap");
  const gmwWrap = document.querySelector("#gmw-charts-wrap");

  // Toggle the correct blocks
  if (DATASET_KIND === "GMW"){
    if (emWrap) emWrap.style.display = "none";
    if (gmwWrap) gmwWrap.style.display = "";
  } else {
    if (gmwWrap) gmwWrap.style.display = "none";
    if (emWrap) emWrap.style.display = "";
    // cleanup GMW charts if switching back
    destroyChart(charts.gmwBars); charts.gmwBars = null;
    destroyChart(charts.gmwAvg);  charts.gmwAvg = null;
    return;
  }

  const noteBars = document.querySelector("#gmw-bars-note");
  const noteAvg  = document.querySelector("#gmw-avg-note");

  const labels = GMW_DIMENSIONS.map(d => d.label);

  // Build % datasets for stacked bar (Emerging/Developing/Achieving)
  const breakdowns = GMW_DIMENSIONS.map(d => gmwDimBreakdown(FILTERED, d.key));
  const denom = (b) => (b.n || 0) || 1;

  const emergingPct  = breakdowns.map(b => (b.emerging  / denom(b)) * 100);
  const developingPct= breakdowns.map(b => (b.developing/ denom(b)) * 100);
  const achievingPct = breakdowns.map(b => (b.achieving / denom(b)) * 100);

  if (noteBars){
    const n = (FILTERED || []).length;
    noteBars.textContent = `Rows: ${n} • Each bar sums to 100% (where scores exist).`;
  }

  const cBars = document.querySelector("#chartGMWBars");
  if (cBars){
    destroyChart(charts.gmwBars);
    charts.gmwBars = new Chart(cBars, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Emerging (1)",   data: emergingPct,   stack: "s", backgroundColor: RPPL_PALETTE.orange, borderColor: "rgba(255,255,255,.6)", borderWidth: 1 },
          { label: "Developing (2)", data: developingPct, stack: "s", backgroundColor: RPPL_PALETTE.plumRose, borderColor: "rgba(255,255,255,.6)", borderWidth: 1 },
          { label: "Achieving (3)",  data: achievingPct,  stack: "s", backgroundColor: RPPL_PALETTE.blueDark, borderColor: "rgba(255,255,255,.6)", borderWidth: 1 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
            max: 100,
            ticks: { callback: v => v + "%" }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              afterBody: (items) => gmwTooltipDescriptionLines(items[0]?.dataIndex)
            }
          }
        }
      }
    });
  }

  // Avg bar chart (0–3)
  const avgs = GMW_DIMENSIONS.map(d => {
    const xs = (FILTERED || [])
      .map(r => Number(r?.[d.key]))
      .filter(v => Number.isFinite(v) && v > 0);
    return xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : 0;
  });

  if (noteAvg){
    noteAvg.textContent = "Scale: 1–3 (avg of available scores).";
  }

  const cAvg = document.querySelector("#chartGMVAvg");
  if (cAvg){
    destroyChart(charts.gmwAvg);
    charts.gmwAvg = new Chart(cAvg, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Average score", data: avgs, backgroundColor: RPPL_PALETTE.plum, borderRadius: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 3, ticks: { stepSize: 1 } }
        },
        plugins: {
          tooltip: {
            callbacks: {
              afterBody: (items) => gmwTooltipDescriptionLines(items[0]?.dataIndex)
            }
          }
        }
      }
    });
  }
}

// jn.022326.gmw.obs - simple observations table (filtered rows)
function renderGMWObservations(){
  const head = document.querySelector("#gmw-obs-head");
  const body = document.querySelector("#gmw-obs-body");
  const note = document.querySelector("#gmw-obs-note");

  if (DATASET_KIND !== "GMW"){
    if (head) head.innerHTML = "";
    if (body) body.innerHTML = "";
    if (note) note.textContent = "";
    return;
  }
  if (!head || !body) return;

  // show key metadata + the 8 dimension scores + the 8 comment fields
  const cols = [
    ["school","School"],
    ["grade","Grade"],
    ["curriculum","Curriculum"],
    ["module","Module"],
    ["teacher","Teacher"],
    ["observer_role","Observer Role"],
    ["state","State"],
    ["district","District"],
    ["__date_completed","Date"],

    // scores
    ["d1","D1"],["d2","D2"],["d3","D3"],["d4","D4"],
    ["d5","D5"],["d6","D6"],["d7","D7"],["d8","D8"],

    // comments
    ["c1","D1 Notes"],["c2","D2 Notes"],["c3","D3 Notes"],["c4","D4 Notes"],
    ["c5","D5 Notes"],["c6","D6 Notes"],["c7","D7 Notes"],["c8","D8 Notes"],
  ];

  head.innerHTML = `<tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr>`;
  body.innerHTML = "";

  const rows = (FILTERED || []).slice(0, 200); // cap (comments are long)
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = cols.map(([k])=>{
      let v = r?.[k] ?? "";

      if (k === "__date_completed" && v instanceof Date && !isNaN(v)) {
        v = v.toISOString().slice(0,10);
      }

      // keep comment cells readable
      if (/^c[1-8]$/.test(k)){
        const s = String(v || "").trim();
        return `<td style="min-width:320px; white-space:normal;">${escapeHTML(s)}</td>`;
      }

      return `<td>${escapeHTML(String(v))}</td>`;
    }).join("");
    body.appendChild(tr);
  }

  if (note){
    note.textContent = `Showing ${Math.min((FILTERED||[]).length, 200)} of ${(FILTERED||[]).length} filtered observation rows (includes notes).`;
  }
}

// jn.022326.gmw.radar - compute averages for d1..d8 and render radar chart
function gmwRadarAverages(rows){
  const out = {};
  for (const dim of GMW_DIMENSIONS){
    const xs = (rows || [])
      .map(r => Number(r?.[dim.key]))
      .filter(v => Number.isFinite(v) && v > 0);
    out[dim.key] = xs.length ? (xs.reduce((a,b)=>a+b,0) / xs.length) : null;
  }
  return out;
}

function renderGMWRadar(){
  const wrap = document.querySelector("#gmw-radar-wrap");
  const note = document.querySelector("#gmw-radar-note");
  const canvas = document.querySelector("#chartGMWRadar");

  // Only for GMW
  if (DATASET_KIND !== "GMW"){
    if (wrap) wrap.style.display = "none";
    destroyChart(charts.gmwRadar);
    charts.gmwRadar = null;
    return;
  }

  if (!wrap || !canvas) return;

  wrap.style.display = "";
  const avgs = gmwRadarAverages(FILTERED);

  const labels = GMW_DIMENSIONS.map(d => d.label);
  const data = GMW_DIMENSIONS.map(d => (avgs[d.key] == null ? 0 : Number(avgs[d.key])));

  // Note: show N and “no data” warning if needed
  const n = (FILTERED || []).length;
  if (note){
    const missing = data.every(v => v === 0);
    note.textContent = missing
      ? `No rubric scores in current filter. (Rows: ${n})`
      : `Rows: ${n} • Scale: 1–3`;
  }

  destroyChart(charts.gmwRadar);
  charts.gmwRadar = new Chart(canvas, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        label: "Average rubric score",
        data,
        backgroundColor: "rgba(204,88,3,0.18)",
        borderColor: RPPL_PALETTE.orange,
        borderWidth: 2,
        pointBackgroundColor: RPPL_PALETTE.plum,
        pointBorderColor: "#fff",
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 3,
          ticks: { stepSize: 1 }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || "",
            label: (ctx) => `Avg: ${Number(ctx.raw).toFixed(2)}`,
            afterBody: (items) => gmwTooltipDescriptionLines(items[0]?.dataIndex)
          }
        }
      }
    }
  });
}

function renderBandsChart(){
  const labels = SUMMARY.map(s=> `${s.school} • G${s.grade}`);
  const datasets = BAND_ORDER.map((b,i)=>({
    label: b,
    data: SUMMARY.map(s=> s[`pct_${b}`] || 0),
    backgroundColor: RPPL_CHART_SEQ[i % RPPL_CHART_SEQ.length],
    borderColor: "rgba(255,255,255,.6)",
    borderWidth: 1,
    stack: "bands",
  }));

  destroyChart(charts.bands);
  charts.bands = new Chart($("#chartBands"), {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } }
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx)=> `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` } }
      }
    }
  });

  $("#chart-note").textContent = `Showing ${SUMMARY.length} school+grade groups.`;
}

function renderAvgChart(){
  const labels = SUMMARY.map(s=> `${s.school} • G${s.grade}`);

  destroyChart(charts.avg);
  charts.avg = new Chart($("#chartAvg"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Avg overall_percentage (row mean)", data: SUMMARY.map(s=> s.avg_overall_percentage || 0), backgroundColor: RPPL_PALETTE.plum, borderRadius: 6 },
        { label: "Achieved/Possible % (weighted)", data: SUMMARY.map(s=> s.points_pct || 0), backgroundColor: RPPL_PALETTE.orange, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } }
      }
    }
  });
}

function renderByGrade(){
  // aggregate SUMMARY -> grade only
  const gmap = new Map();
  for (const s of SUMMARY){
    const k = s.grade;
    if (!gmap.has(k)){
      gmap.set(k, { grade: k, n:0, bands:Object.fromEntries(BAND_ORDER.map(b=>[b,0])) });
    }
    const g = gmap.get(k);
    g.n += s.n;
    for (const b of BAND_ORDER){
      // convert back from pct to counts using s.n (approx). Better: compute from raw, but fine for starter.
      g.bands[b] += (s[`pct_${b}`] || 0) * s.n / 100;
    }
  }
  const grades = Array.from(gmap.values()).sort((a,b)=> Number(a.grade)-Number(b.grade));
  const labels = grades.map(g=> `G${g.grade}`);
  const datasets = BAND_ORDER.map((b,i)=>({
    label: b,
    data: grades.map(g=> g.n ? (g.bands[b]/g.n*100) : 0),
    backgroundColor: RPPL_CHART_SEQ[i % RPPL_CHART_SEQ.length],
    borderColor: "rgba(255,255,255,.6)",
    borderWidth: 1,
    stack: "bands",
  }));

  destroyChart(charts.grade);
  charts.grade = new Chart($("#chartGrade"), {
    type:"bar",
    data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{ x:{stacked:true}, y:{stacked:true, beginAtZero:true, max:100, ticks:{callback:v=>v+"%"}}}
    }
  });
}

function renderBySchool(){
  // aggregate SUMMARY -> school only
  const smap = new Map();
  for (const s of SUMMARY){
    const k = s.school;
    if (!smap.has(k)){
      smap.set(k, { school:k, n:0, bands:Object.fromEntries(BAND_ORDER.map(b=>[b,0])) });
    }
    const g = smap.get(k);
    g.n += s.n;
    for (const b of BAND_ORDER){
      g.bands[b] += (s[`pct_${b}`] || 0) * s.n / 100;
    }
  }
  const schools = Array.from(smap.values()).sort((a,b)=> String(a.school).localeCompare(String(b.school)));
  const labels = schools.map(s=> s.school);
  const datasets = BAND_ORDER.map((b,i)=>({
    label:b,
    data: schools.map(s=> s.n ? (s.bands[b]/s.n*100) : 0),
    backgroundColor: RPPL_CHART_SEQ[i % RPPL_CHART_SEQ.length],
    borderColor: "rgba(255,255,255,.6)",
    borderWidth: 1,
    stack:"bands",
  }));

  destroyChart(charts.school);
  charts.school = new Chart($("#chartSchool"), {
    type:"bar",
    data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{ x:{stacked:true}, y:{stacked:true, beginAtZero:true, max:100, ticks:{callback:v=>v+"%"}}}
    }
  });
}

function renderRawTable(){
  const head = $("#raw-head");
  const body = $("#raw-body");
  head.innerHTML = "";
  body.innerHTML = "";

  const cols = [
    "assessment","assessment_status","type_of_assessment","is_custom",
    "grade","module","curriculum","school",
    "date_launched","date_completed",
    "overall_points_achieved","overall_points_possible","overall_percentage",
    "performance_band"
  ];

  head.innerHTML = `<tr>${cols.map(c=>`<th>${c}</th>`).join("")}</tr>`;
  for (const r of FILTERED.slice(0, 1500)){ // cap for UI
    const tr = document.createElement("tr");
    tr.innerHTML = cols.map(c=>`<td>${(r[c] ?? "")}</td>`).join("");
    body.appendChild(tr);
  }
}

function renderAll(){
  renderInsights();
  renderKPIs();

  // GMW radar always okay to call (it hides itself when not GMW)
  renderGMWRadar();

  // Swap chart suite (EM2 vs GMW)
  renderGMWBarsAndAvg();

  // EM2 charts should only run in EM2 mode
  if (DATASET_KIND !== "GMW"){
    renderBandsChart();
    renderAvgChart();
    renderByGrade();
    renderBySchool();
  }

  // GMW observations table (no-op for EM2)
  renderGMWObservations();

  renderRawTable();
  renderDashboardInsights();
}

function exportSummaryCSV(){
  if (!SUMMARY.length) return;

  const cols = ["school","grade","n","avg_overall_percentage","points_pct", ...BAND_ORDER.map(b=>`pct_${b}`)];
  const lines = [cols.join(",")];
  for (const r of SUMMARY){
    const row = cols.map(c=>{
      const v = r[c];
      if (typeof v === "number") return v.toFixed(3);
      const s = String(v ?? "");
      return `"${s.replaceAll('"','""')}"`;
    });
    lines.push(row.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "school_grade_summary.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function initNav(){
  const btns = Array.from(document.querySelectorAll(".nav-btn[data-page]"));

  btns.forEach(b=>{
    b.addEventListener("click", ()=>{
      btns.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      const page = b.dataset.page;

      // NEW pills are intentionally persistent - they showcase recently-shipped work to clients.

      // Dashboard lives as a panel tab on top of the Overview page structure.
      if (page === "dashboard") {
        document.querySelectorAll(".page").forEach(p=>p.style.display="none");
        $("#page-overview").style.display = "";
        $("#page-title").textContent = "Dashboard";
        const topCards = document.querySelector("#top-cards");
        if (topCards) topCards.style.display = "";
        document.body.classList.remove("on-docs");
        setMainTab("dashboard");
        return;
      }

      const mainTab =
        page === "ask"            ? "ask"            :
        page === "oracle"         ? "oracle"         :
        page === "teacher-stats"  ? "teacher-stats"  :
        "overview";
      setMainTab(mainTab);

      $("#page-title").textContent =
        page === "overview"       ? "Overview" :
        page === "by-grade"       ? "By Grade" :
        page === "by-school"      ? "By School" :
        page === "ask"            ? "Ask the Data" :
        page === "oracle"         ? "The Oracle" :
        page === "teacher-stats"  ? "Teacher Stats" :
        page === "docs"           ? "Documentation" :
        "Raw Table";

      document.querySelectorAll(".page").forEach(p=>p.style.display="none");
      $("#page-" + page).style.display = "";

      // Hide the top data-workspace cards (Load/Filters/KPIs) on full-bleed pages.
      const topCards = document.querySelector("#top-cards");
      const fullBleed = (page === "docs" || page === "ask" || page === "oracle" || page === "teacher-stats");
      if (topCards) topCards.style.display = fullBleed ? "none" : "";
      document.body.classList.toggle("on-docs", page === "docs");

      if (page === "oracle" && typeof oracleRenderChart === "function"){
        setTimeout(oracleRenderChart, 0);
      }
    });
  });
  // default: Overview
  document.querySelector('.nav-btn[data-page="overview"]')?.click();

  // DRILL DOWN collapse/expand
  const drillToggle = document.querySelector("#drilldown-toggle");
  const drillItems = document.querySelector("#drilldown-items");
  if (drillToggle && drillItems) {
    drillToggle.addEventListener("click", () => {
      const expanded = drillToggle.getAttribute("aria-expanded") === "true";
      drillToggle.setAttribute("aria-expanded", String(!expanded));
      drillItems.classList.toggle("collapsed", expanded);
    });
  }
}

function initMainTabs(){
  const btns = Array.from(document.querySelectorAll(".panel-tab-btn[data-main-tab]"));
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.mainTab || "overview";
      // Drive through the sidebar so page visibility + active state stay in sync.
      const paired = document.querySelector(`.nav-btn[data-page="${tab}"]`);
      if (paired){
        paired.click();
      } else {
        setMainTab(tab);
      }
    });
  });
}


function initSearch(){
  $("#search")?.addEventListener("input", ()=>{
    const q = ($("#search").value || "").toLowerCase().trim();
    const rows = !q ? FILTERED : FILTERED.filter(r=>{
			const hay = (DATASET_KIND === "GMW")
				? `${r.school} ${r.teacher} ${r.curriculum} ${r.module}`.toLowerCase()
				: `${r.school} ${r.assessment} ${r.performance_band}`.toLowerCase();
      return hay.includes(q);
    });
    // render quick subset
    const body = $("#raw-body");
    body.innerHTML = "";
    const cols = [
      "assessment","assessment_status","type_of_assessment","is_custom",
      "grade","module","curriculum","school",
      "date_launched","date_completed",
      "overall_points_achieved","overall_points_possible","overall_percentage",
      "performance_band"
    ];
    for (const r of rows.slice(0, 1500)){
      const tr = document.createElement("tr");
      tr.innerHTML = cols.map(c=>`<td>${(r[c] ?? "")}</td>`).join("");
      body.appendChild(tr);
    }
  });
}


const GMW_DIMENSIONS = [
  { key: "d1", label: "Lesson Component Facilitation", category: "Curriculum Use",
    description: "How effectively the teacher enacts each part of the lesson as designed, with attention to the purpose of each component. Focuses on whether transitions, directions, and facilitation moves ensure that students engage in the intended work of each phase (e.g., sense-making, practice, synthesis), rather than just moving smoothly through the lesson." },
  { key: "d2", label: "Pedagogical Elements", category: "Curriculum Use",
    description: "The degree to which the teacher uses content-appropriate instructional moves to support how students learn the material. Focuses on whether the teacher applies key pedagogical approaches (e.g., modeling, questioning, scaffolding, use of representations or texts) in ways that deepen understanding and align to the demands of the discipline, rather than relying on generic or procedural teaching strategies." },
  { key: "d3", label: "Cognitive Lift", category: "Student-Centered Instruction",
    description: "The level of thinking students are doing. Emphasizes whether students are doing the “heavy lifting” (reasoning, problem-solving, explaining) rather than the teacher doing most of the work." },
  { key: "d4", label: "Discourse", category: "Student-Centered Instruction",
    description: "The quality and structure of student talk. Focuses on how students engage in meaningful discussion, explain ideas, respond to others, and use academic language." },
  { key: "d5", label: "Collecting Evidence", category: "Gathering and Using Evidence",
    description: "How the teacher gathers information about student understanding during the lesson. Includes curriculum-embedded assessment data, observation, and use of student work to monitor progress in real time." },
  { key: "d6", label: "Responding and Feedback", category: "Gathering and Using Evidence",
    description: "How the teacher uses evidence of student thinking to adjust instruction and provide feedback. Looks at responsiveness, specificity of feedback, and whether it moves student learning forward." },
  { key: "d7", label: "Collaborative Engagement", category: "Student Engagement",
    description: "The extent to which students engage meaningfully with peers to build understanding. Focuses on whether collaboration involves shared thinking—such as explaining, questioning, and responding to ideas—rather than simply dividing work or participating superficially." },
  { key: "d8", label: "Independent Engagement", category: "Student Engagement",
    description: "The extent to which students are actively and productively engaged in individual work that advances their understanding. Focuses on whether students are thinking, applying, and making sense of content on their own, rather than passively completing tasks or waiting for direction." },
];

function escapeAttr(s){
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Word-wrap a long string into an array of lines for Chart.js tooltips.
function wrapTooltipText(text, maxChars = 56){
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words){
    if (!line.length){ line = w; continue; }
    if ((line.length + 1 + w.length) <= maxChars){
      line += " " + w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Return the GMW_DIMENSIONS description for a given dataIndex as an array of
// wrapped lines (Chart.js renders array values one per line in tooltips).
function gmwTooltipDescriptionLines(dataIndex){
  const desc = GMW_DIMENSIONS[dataIndex]?.description || "";
  if (!desc) return [];
  return ["", ...wrapTooltipText(desc, 56)];
}

function collectGMWCommentSnippets(rows, { limit = 18, maxLen = 240 } = {}){
  if (!rows || !rows.length) return [];

  const out = [];

  for (const r of rows){
    for (let i=1; i<=8; i++){
      const c = String(r?.[`c${i}`] || "").trim();
      if (!c) continue;

      const dim = GMW_DIMENSIONS[i-1]?.label || `Dimension ${i}`;
      const score = Number(r?.[`d${i}`]);
      const scoreLabel = (score===1 ? "Emerging" : score===2 ? "Developing" : score===3 ? "Achieving" : "");

      let text = c.replace(/\s+/g, " ").trim();
      if (text.length > maxLen) text = text.slice(0, maxLen).trim() + "…";

      out.push({
        dimIndex: i,
        dim,
        score,
        scoreLabel,
        school: String(r.school || "").trim(),
        grade: String(r.grade || "").trim(),
        curriculum: String(r.curriculum || "").trim(),
        module: String(r.module || "").trim(),
        text
      });
    }
  }

  // simple “diversify”: shuffle then take first N
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out.slice(0, limit);
}

// --- jn.022326.gmw - Detect + reshape Great Minds Walkthrough (Qualtrics wide -> long) ---

function looksLikeGMWRow(r){
  // GMW exports always have demo_school_pub_1 and at least o1_1 or o1_tchr_grade
  return r && (r.demo_school_pub_1 != null) && (r.o1_1 != null || r.o1_tchr_grade != null);
}

function stripQualtricsMetaRows(rows){
  return (rows || []).filter(r => {
    // 1) Classic Qualtrics meta rows
    const rid = String(r?.ResponseId || "").trim();
    if (!rid) return false;
    if (rid === "Text") return false;
    if (rid.includes("ImportId")) return false;

    // 2) “Header echoed as data” rows (these are the ones poisoning your dropdowns)
    // If any field equals its own header token, it’s not real data.
    const headerEchoChecks = [
      ["EndDate", "EndDate"],
      ["StartDate", "StartDate"],
      ["demo_school_pub_1", "demo_school_pub_1"],
      ["o1_tchr_curr", "o1_tchr_curr"],
      ["o1_tchr_mod", "o1_tchr_mod"],
      ["o1_tchr_grade", "o1_tchr_grade"],
      ["o1_tchr_name", "o1_tchr_name"],
    ];

    for (const [k, v] of headerEchoChecks){
      if (String(r?.[k] ?? "").trim() === v) return false;
    }

    return true;
  });
}

// Turn wide (o1..o10) into long observation rows
function normalizeGMW(rows){
  const out = [];
  for (const r of rows){
    const school = r.demo_school_pub_1 || "";
    const end = r.EndDate || r.StartDate || "";
    const dt = end ? new Date(end) : null; // Qualtrics is ISO-ish; this works
    for (let i = 1; i <= 10; i++){
      const tchr = (r[`o${i}_tchr_name`] || "").trim();
      const grade = r[`o${i}_tchr_grade`];
      const curr = r[`o${i}_tchr_curr`];
      const mod  = r[`o${i}_tchr_mod`];

      // Only keep “real” observations (teacher name OR any rubric score present)
      const hasScore = [1,2,3,4,5,6,7,8].some(k => r[`o${i}_${k}`] != null && r[`o${i}_${k}`] !== "");
      if (!tchr && !hasScore) continue;

		out.push({
			__source: "GMW",

			// ---- Observer / demographics ----
			observer_name: String(r.demo_name || "").trim(),
			observer_email: String(r.demo_email || "").trim(),
			observer_role: String(r.demo_role ?? "").trim(),     // keep code; we can label later
			state: String(r.demo_state ?? "").trim(),            // keep code; we can label later
			district: String(r.demo_district_1 || "").trim(),

			// ---- School (pub/priv) normalized ----
			school: String(r.demo_school_pub_1 || r.demo_school_priv_1 || r.demo_school_OLD || "").trim(),
			school_type: r.demo_school_pub_1 ? "Public" : (r.demo_school_priv_1 ? "Private" : ""),

			// ---- Observation date ----
			date_observed_raw: String(r["date of ob"] || r.date_of_ob || r.DateObserved || r.EndDate || r.StartDate || "").trim(),
			__date_completed: (dt && !isNaN(dt)) ? dt : null,

			// ---- Teacher slice ----
			teacher: tchr,
			grade: grade != null ? String(grade).trim() : "",
			curriculum: curr != null ? String(curr).trim() : "",
			module: mod != null ? String(mod).trim() : "",

			// ---- Rubric dimensions (1-3) ----
			d1: Number(r[`o${i}_1`]),
			d2: Number(r[`o${i}_2`]),
			d3: Number(r[`o${i}_3`]),
			d4: Number(r[`o${i}_4`]),
			d5: Number(r[`o${i}_5`]),
			d6: Number(r[`o${i}_6`]),
			d7: Number(r[`o${i}_7`]),
			d8: Number(r[`o${i}_8`]),

			// ---- Optional comments (if present in export) ----
			c1: String(r[`o${i}_1_comments`] || "").trim(),
			c2: String(r[`o${i}_2_comments`] || "").trim(),
			c3: String(r[`o${i}_3_comments`] || "").trim(),
			c4: String(r[`o${i}_4_comments`] || "").trim(),
			c5: String(r[`o${i}_5_comments`] || "").trim(),
			c6: String(r[`o${i}_6_comments`] || "").trim(),
			c7: String(r[`o${i}_7_comments`] || "").trim(),
			c8: String(r[`o${i}_8_comments`] || "").trim(),
		});
    }
  }
  return out;
}


function detectDataset(rows){
  const cleaned = stripQualtricsMetaRows(rows || []);
  // If ANY row looks like GMW, treat it as GMW
  if (cleaned.some(looksLikeGMWRow)) return "GMW";
  return "EM2";
}

function reshapeGMW(rows){
  const cleaned = stripQualtricsMetaRows(rows || []);
  return normalizeGMW(cleaned);
}

function onFile(file){
  setStatus("Parsing CSV…");
  TS_LOADED = false;
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (res)=>{
      const rows = (res.data || []).filter(Boolean);

      DATASET_KIND = detectDataset(rows);

      if (DATASET_KIND === "GMW"){
        // ✅ wide -> long, and remove Qualtrics meta rows
        RAW = reshapeGMW(rows);
				
        // jn.022326.gmw.filters - populate the horizontal filter strip
        fillGMWExtraFiltersFromRAW();

        // For GMW, we do NOT have performance_band or type_of_assessment
        // We'll repurpose the existing filter dropdowns for now:
        // - f-school: school
        // - f-grade: grade
        // - f-type: curriculum
        // - f-band: (optional) module
        fillSelect($("#f-school"), uniqueSorted(RAW.map(r => r.school)));
        fillSelect($("#f-grade"),  uniqueSorted(RAW.map(r => String(r.grade || ""))));
				fillSelect($("#f-type"), uniqueSorted(
					RAW.map(r => String(r.curriculum || "").trim()).filter(v => v && !/^o\d+_/i.test(v))
				));
				fillSelect($("#f-band"), uniqueSorted(
					RAW.map(r => String(r.module || "").trim()).filter(v => v && !/^o\d+_/i.test(v))
				));

        // Optional: update labels so the UI makes sense
				const lType = document.querySelector('label[for="f-type"]');
				if (lType) lType.textContent = "Curriculum";

				const lBand = document.querySelector('label[for="f-band"]');
				if (lBand) lBand.textContent = "Module";

      } else {
				
        // hide GMW strip in EM2 mode
				const gmwWrap = document.querySelector("#gmw-filter-strip-wrap");
				if (gmwWrap) gmwWrap.style.display = "none";
				
				const gmwStrip = document.querySelector("#gmw-filter-strip");
				if (gmwStrip) gmwStrip.style.display = "none";
				
        // ✅ Existing EM2 path
        RAW = rows.map(r => ({
          ...r,
          grade: r.grade ?? r.Grade ?? r.GRADE,
          school: r.school ?? r.School ?? r.SCHOOL,
          performance_band: normBand(r.performance_band),
          __date_completed: parseMDY(r.date_completed),
        }));

        fillSelect($("#f-school"), uniqueSorted(RAW.map(r=>r.school)));
        fillSelect($("#f-grade"),  uniqueSorted(RAW.map(r=>String(r.grade))));
        fillSelect($("#f-type"),   uniqueSorted(RAW.map(r=>r.type_of_assessment)));
        fillSelect($("#f-band"),   uniqueSorted(RAW.map(r=>r.performance_band)));

        // Restore labels if you changed them
				const lType = document.querySelector('label[for="f-type"]');
				if (lType) lType.textContent = "Assessment Type";

				const lBand = document.querySelector('label[for="f-band"]');
				if (lBand) lBand.textContent = "Performance Band";
      }

      FILTERED = RAW.slice();

      // Apply saved view after options exist
      window.__SV_TRY_APPLY?.();

      setStatus(`Loaded ${RAW.length.toLocaleString()} rows. (${DATASET_KIND})`);

      // TEMP: still calling your EM2 summary path.
      // For GMW, we’ll replace charts/summary next.
      SUMMARY = buildSummarySchoolGrade(FILTERED);
      renderAll();
      if (typeof askUpdateContextChip === "function") askUpdateContextChip();
      if (typeof oracleOnDataChange === "function") oracleOnDataChange();
    },
    error: ()=>{
      setStatus("Parse failed.");
      alert("Failed to parse CSV.");
    }
  });
}

function resetFilters(){
	
	if (!window.__SV_RESTORING) unlockQuickshareAI();

  ["#f-school","#f-grade","#f-type","#f-band"].forEach(id=>{
    const sel = $(id);
    if (!sel) return;
    Array.from(sel.options).forEach(o=> o.selected = false);
  });
  $("#f-from").value = "";
  $("#f-to").value = "";
	
  // jn.022326.gmw.reset - clear extra GMW filter strip
  if (DATASET_KIND === "GMW"){
    document.querySelectorAll("#gmw-filter-strip select").forEach(sel=>{
      Array.from(sel.options).forEach(o => o.selected = false);
    });
  }
	
  FILTERED = RAW.slice();
  SUMMARY = buildSummarySchoolGrade(FILTERED);
  renderAll();
}


// jn.01272026 - Quickshare modal (pretty "Google Docs-ish" link preview)
function showQuickshareModal(link){
  // build once
  let wrap = document.querySelector("#qs-modal");
  if (!wrap){
    wrap = document.createElement("div");
    wrap.id = "qs-modal";
    wrap.innerHTML = `
      <div class="qs-backdrop" data-qs-close="1"></div>
      <div class="qs-card" role="dialog" aria-modal="true" aria-label="Quickshare Link">
        <div class="qs-head">
          <div class="qs-title">⚡ Quickshare Link Copied!</div>
          <button class="qs-x" type="button" data-qs-close="1" aria-label="Close">✕</button>
        </div>

        <div class="qs-sub">
          Anyone with this link can open it and see the exact same filters + view you’re looking at.
        </div>

        <div class="qs-preview">
          <div class="qs-label">Link preview</div>
          <div class="qs-linkrow">
            <input id="qs-link" class="qs-link" readonly />
            <button id="qs-copy" class="btn primary" type="button">Copy</button>

          </div>
          <div class="qs-hint">
            Tip: If the link looks long, that’s normal. It contains the encrypted saved “state”.
          </div>
        </div>

        <div class="qs-instructions">
          <div class="qs-label">How to share</div>
          <div class="qs-bullets">
            <div>1) Send this link to the client or your colleague.</div>
            <div>2) Ask them to paste it into their browser.</div>
            <div>3) It will open with the same school/grade/type/band filters and the same page view you are seeing.</div>
						<div>3) It's essentially a quick way to say "Hey, look at this graph I'm seeing / analysis I'm doing".</div>
          </div>
        </div>

        <div class="qs-actions">
          <button class="btn" type="button" data-qs-close="1">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    // close handlers
    wrap.addEventListener("click", (e)=>{
      const t = e.target;
      if (t?.getAttribute?.("data-qs-close") === "1"){
        wrap.classList.remove("show");
      }
    });

    // ESC close
    document.addEventListener("keydown", (e)=>{
      if (e.key === "Escape") wrap.classList.remove("show");
    });

    // copy button
    wrap.querySelector("#qs-copy")?.addEventListener("click", async ()=>{
      const input = wrap.querySelector("#qs-link");
      const val = input?.value || "";
      try {
        await navigator.clipboard.writeText(val);
        // small micro-feedback
        const btn = wrap.querySelector("#qs-copy");
        if (btn){
          const old = btn.textContent;
          btn.textContent = "✅ Copied";
          setTimeout(()=> btn.textContent = old, 900);
        }
      } catch {
        // fallback
        input?.select?.();
        document.execCommand?.("copy");
      }
    });
  }

  // fill + show
  const input = wrap.querySelector("#qs-link");
  if (input) input.value = link;

  wrap.classList.add("show");

  // select for convenience
  setTimeout(()=>{
    input?.focus?.();
    input?.select?.();
  }, 50);
}


// jn.01272026 - Saved View Links (filters/page -> URL -> restore)
(function initSavedViewLinks() {
  const $ = (s, el=document) => el.querySelector(s);

  const els = {
    school: $("#f-school"),
    grade:  $("#f-grade"),
    type:   $("#f-type"),
    band:   $("#f-band"),
    from:   $("#f-from"),
    to:     $("#f-to"),
    copy:   $("#btn-copylink"),
    apply:  $("#btn-apply"),
  };

  // ---- helpers: multiselect read/write ----
  const getMulti = (sel) => {
    if (!sel) return [];
    return Array.from(sel.selectedOptions || []).map(o => o.value);
  };

  const setMulti = (sel, values) => {
    if (!sel) return;
    const want = new Set((values || []).map(String));
    Array.from(sel.options || []).forEach(opt => {
      opt.selected = want.has(String(opt.value));
    });
  };

  // ---- page tracking ----
  // We infer from your existing buttons: .nav-btn[data-page]
  const getActivePage = () => {
    const btn = document.querySelector(".nav-btn.active");
    return btn?.getAttribute("data-page") || "overview";
  };

  const setActivePage = (page) => {
    const p = String(page || "overview");
    // click the nav button if it exists (so your existing routing logic runs)
    const btn = document.querySelector(`.nav-btn[data-page="${CSS.escape(p)}"]`);
    if (btn) btn.click();
  };

  // ---- state encode/decode ----
  // URL param name: sv (saved view)
  const encodeState = (obj) => {
    const json = JSON.stringify(obj || {});
    // UTF-8 safe base64
    const utf8 = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    );
    return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const decodeState = (s) => {
    if (!s) return null;
    try {
      const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
      const bin = atob(b64);
      const json = decodeURIComponent(Array.from(bin).map(c =>
        "%" + c.charCodeAt(0).toString(16).padStart(2, "0")
      ).join(""));
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const getStateNow = () => ({
    v: 1,
    kind:   (typeof DATASET_KIND !== "undefined" ? DATASET_KIND : "EM2"),
    page:   getActivePage(),
    school: getMulti(els.school),
    grade:  getMulti(els.grade),
    type:   getMulti(els.type),
    band:   getMulti(els.band),
    from:   els.from?.value || "",
    to:     els.to?.value || "",
    gmwExtra: (typeof DATASET_KIND !== "undefined" && DATASET_KIND === "GMW" && typeof readGMWExtraFilterState === "function")
              ? readGMWExtraFilterState()
              : null,
  });

  const writeStateToURL = (state, { replace = true } = {}) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sv", encodeState(state));
    if (replace) window.history.replaceState({}, "", url.toString());
    else window.history.pushState({}, "", url.toString());
  };

  const readStateFromURL = () => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("sv");
    return decodeState(raw);
  };

  // ---- apply state (when options exist) ----
  let __PENDING_STATE = readStateFromURL();

  const tryApplyPendingState = () => {
		if (!__PENDING_STATE) __PENDING_STATE = readStateFromURL();
		if (!__PENDING_STATE) return false;

		// options must exist to select them
		const ready =
			(els.school?.options?.length || 0) > 0 &&
			(els.grade?.options?.length  || 0) > 0 &&
			(els.type?.options?.length   || 0) > 0 &&
			(els.band?.options?.length   || 0) > 0;

		if (!ready) return false;

		const s = __PENDING_STATE;

    // Set filters
    setMulti(els.school, s.school);
    setMulti(els.grade,  s.grade);
    setMulti(els.type,   s.type);
    setMulti(els.band,   s.band);
    if (els.from && typeof s.from === "string") els.from.value = s.from;
    if (els.to   && typeof s.to   === "string") els.to.value   = s.to;

    // Restore GMW extra filter strip selections (observer_name, state, district, etc.)
    if (DATASET_KIND === "GMW" && s.gmwExtra && typeof s.gmwExtra === "object"){
      const extraMap = {
        observer_name:  "#gmw-observer_name",
        observer_email: "#gmw-observer_email",
        observer_role:  "#gmw-observer_role",
        state:          "#gmw-state",
        district:       "#gmw-district",
        school_type:    "#gmw-school_type",
        teacher:        "#gmw-teacher",
      };
      for (const [key, sel] of Object.entries(extraMap)){
        const node = document.querySelector(sel);
        if (node) setMulti(node, s.gmwExtra[key] || []);
      }
    }

    // Route to page first (so correct charts show)
    if (s.page) setActivePage(s.page);

    // Trigger your existing Apply logic
    // (uses your existing click handler if you have one)
		if (els.apply){
			window.__SV_RESTORING = true;
			els.apply.click();
			window.__SV_RESTORING = false;
		}

    __PENDING_STATE = null;
    return true;
  };

  // ---- Copy link button ----
	const copyLink = async () => {
		const state = getStateNow();
		writeStateToURL(state, { replace: true });

		const url = new URL(window.location.href);
		const sv = url.searchParams.get("sv") || "";

		const ai = getCurrentAISummaryText(); // may be ""
		let qs = "";

		try {
			// Save to Firestore, get short code
			qs = await saveQuickshareToFirestore({ sv, ai });

			// Build the short link (keep sv if you want, but you can remove it to keep link clean)
			url.searchParams.set("qs", qs);

			// optional: remove sv from link to keep it super short
			url.searchParams.delete("sv");

			const link = url.toString();

			try { await navigator.clipboard.writeText(link); } catch {}
			showQuickshareModal(link);

		} catch (e){
			console.error(e);
			// fallback: old behavior (sv-only) if Firestore write fails
			const link = window.location.href;
			try { await navigator.clipboard.writeText(link); } catch {}
			showQuickshareModal(link);
		}
	};

  els.copy?.addEventListener("click", copyLink);

  // Keep URL synced whenever Apply is used
  els.apply?.addEventListener("click", () => {
    // Let your existing Apply logic run; then we just update the URL state
    // (small timeout avoids any timing issues)
    setTimeout(() => writeStateToURL(getStateNow(), { replace: true }), 0);
  });

  // Also update URL when user switches pages (so link captures the current view)
  document.querySelectorAll(".nav-btn[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      setTimeout(() => writeStateToURL(getStateNow(), { replace: true }), 0);
    });
  });

  // IMPORTANT HOOK:
  // Call window.__SV_TRY_APPLY() after you finish populating filter dropdown options from the CSV.
  window.__SV_TRY_APPLY = tryApplyPendingState;

  // In case options are already present at init time
  tryApplyPendingState();
})();


async function applyQuickshareFromURL(){
  const url = new URL(window.location.href);
  const qs = url.searchParams.get("qs");
  if (!qs) return false;

  setStatus("Loading Quickshare…");

  const data = await loadQuickshareFromFirestore(qs);
  if (!data?.sv){
    setStatus("Quickshare not found.");
    return false;
  }

  // Put sv back into URL (so your existing restore flow can use it)
  url.searchParams.set("sv", data.sv);
	url.searchParams.delete("qs"); // optional cleanup
  window.history.replaceState({}, "", url.toString());
	// setTimeout(() => window.__SV_TRY_APPLY?.(), 0);

  // If AI exists, show it immediately
  if (data.ai){
    window.__QS_AI_LOCKED = true;
    window.__QS_AI_TEXT = String(data.ai || "");

    const box = document.querySelector("#ai-summary");
    const out = document.querySelector("#ai-summary-text");
    if (box && out){
      box.style.display = "";
      out.textContent = window.__QS_AI_TEXT;
    }
  }

  return true;
}

// jn.01272026 - Auto-load the correct CSV when a saved-view (?sv=...) link is opened.
// For GMW saved views we must load GMW.csv and run the GMW branch so the radar + GMW
// charts render; otherwise the link looks empty or reverts to EM2-style charts.
function loadBundledCSV(csvName, { silent = false } = {}){
  TS_LOADED = false;
  return new Promise((resolve) => {
    if (!silent) setStatus(`Loading ${csvName}…`);
    Papa.parse(csvName, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data || []).filter(Boolean);
        DATASET_KIND = detectDataset(rows);

        if (DATASET_KIND === "GMW"){
          RAW = reshapeGMW(rows);
          fillGMWExtraFiltersFromRAW();
          fillSelect($("#f-school"), uniqueSorted(RAW.map(r => r.school)));
          fillSelect($("#f-grade"),  uniqueSorted(RAW.map(r => String(r.grade || ""))));
          fillSelect($("#f-type"), uniqueSorted(
            RAW.map(r => String(r.curriculum || "").trim()).filter(v => v && !/^o\d+_/i.test(v))
          ));
          fillSelect($("#f-band"), uniqueSorted(
            RAW.map(r => String(r.module || "").trim()).filter(v => v && !/^o\d+_/i.test(v))
          ));
          const lType = document.querySelector('label[for="f-type"]');
          if (lType) lType.textContent = "Curriculum";
          const lBand = document.querySelector('label[for="f-band"]');
          if (lBand) lBand.textContent = "Module";
          // fillGMWExtraFiltersFromRAW already set the wrap to display:block - no extra reset here
          // (setting it to "" would revert to CSS default which is display:none).
        } else {
          const gmwWrap = document.querySelector("#gmw-filter-strip-wrap");
          if (gmwWrap) gmwWrap.style.display = "none";
          const gmwStrip = document.querySelector("#gmw-filter-strip");
          if (gmwStrip) gmwStrip.style.display = "none";

          RAW = rows.map(r => ({
            ...r,
            grade: r.grade ?? r.Grade ?? r.GRADE,
            school: r.school ?? r.School ?? r.SCHOOL,
            performance_band: normBand(r.performance_band),
            __date_completed: parseMDY(r.date_completed),
          }));

          fillSelect($("#f-school"), uniqueSorted(RAW.map(r=>r.school)));
          fillSelect($("#f-grade"),  uniqueSorted(RAW.map(r=>String(r.grade))));
          fillSelect($("#f-type"),   uniqueSorted(RAW.map(r=>r.type_of_assessment)));
          fillSelect($("#f-band"),   uniqueSorted(RAW.map(r=>r.performance_band)));

          const lType = document.querySelector('label[for="f-type"]');
          if (lType) lType.textContent = "Assessment Type";
          const lBand = document.querySelector('label[for="f-band"]');
          if (lBand) lBand.textContent = "Performance Band";
        }

        FILTERED = RAW.slice();
        SUMMARY = buildSummarySchoolGrade(FILTERED);
        renderAll();
        setStatus(`Loaded ${RAW.length.toLocaleString()} rows (${csvName}).`);
        if (typeof askUpdateContextChip === "function") askUpdateContextChip();
        if (typeof oracleOnDataChange === "function") oracleOnDataChange();
        resolve(true);
      },
      error: () => {
        if (!silent) setStatus(`Could not load ${csvName}. Upload a CSV to start.`);
        resolve(false);
      }
    });
  });
}

function autoLoadIfSavedView(){
  const url = new URL(window.location.href);
  const hasSV = url.searchParams.has("sv");
  if (!hasSV) return;

  // If already loaded (or user will load manually), skip
  if (RAW && RAW.length) return;

  // Decode the saved state to figure out which CSV to load.
  // (Decoder lives inside the IIFE; we reuse the same format here.)
  let savedKind = "EM2";
  try {
    const raw = url.searchParams.get("sv");
    if (raw){
      const b64 = raw.replace(/-/g,"+").replace(/_/g,"/") + "===".slice((raw.length+3)%4);
      const bin = atob(b64);
      const json = decodeURIComponent(Array.from(bin).map(c => "%" + c.charCodeAt(0).toString(16).padStart(2,"0")).join(""));
      const st = JSON.parse(json);
      if (st && typeof st.kind === "string") savedKind = st.kind;
    }
  } catch {/* ignore - fall back to EM2 */}

  const csvName = (savedKind === "GMW") ? "data/GMW.csv" : "data/EM2.csv";
  setStatus(`Auto-loading ${csvName}…`);

  Papa.parse(csvName, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (res) => {
      const rows = (res.data || []).filter(Boolean);

      // Run the same detection/branching onFile() uses so GMW-specific
      // filter strip, labels, chart wrappers and radar all initialize.
      DATASET_KIND = detectDataset(rows);

      if (DATASET_KIND === "GMW"){
        RAW = reshapeGMW(rows);
        fillGMWExtraFiltersFromRAW();

        fillSelect($("#f-school"), uniqueSorted(RAW.map(r => r.school)));
        fillSelect($("#f-grade"),  uniqueSorted(RAW.map(r => String(r.grade || ""))));
        fillSelect($("#f-type"), uniqueSorted(
          RAW.map(r => String(r.curriculum || "").trim()).filter(v => v && !/^o\d+_/i.test(v))
        ));
        fillSelect($("#f-band"), uniqueSorted(
          RAW.map(r => String(r.module || "").trim()).filter(v => v && !/^o\d+_/i.test(v))
        ));

        const lType = document.querySelector('label[for="f-type"]');
        if (lType) lType.textContent = "Curriculum";
        const lBand = document.querySelector('label[for="f-band"]');
        if (lBand) lBand.textContent = "Module";
      } else {
        const gmwWrap = document.querySelector("#gmw-filter-strip-wrap");
        if (gmwWrap) gmwWrap.style.display = "none";
        const gmwStrip = document.querySelector("#gmw-filter-strip");
        if (gmwStrip) gmwStrip.style.display = "none";

        RAW = rows.map(r => ({
          ...r,
          grade: r.grade ?? r.Grade ?? r.GRADE,
          school: r.school ?? r.School ?? r.SCHOOL,
          performance_band: normBand(r.performance_band),
          __date_completed: parseMDY(r.date_completed),
        }));

        fillSelect($("#f-school"), uniqueSorted(RAW.map(r=>r.school)));
        fillSelect($("#f-grade"),  uniqueSorted(RAW.map(r=>String(r.grade))));
        fillSelect($("#f-type"),   uniqueSorted(RAW.map(r=>r.type_of_assessment)));
        fillSelect($("#f-band"),   uniqueSorted(RAW.map(r=>r.performance_band)));
      }

      FILTERED = RAW.slice();

      // Apply URL-saved filters AFTER options exist (restores GMW extras too)
      window.__SV_TRY_APPLY?.();

      setStatus(`Loaded ${RAW.length.toLocaleString()} rows (${csvName}).`);
      SUMMARY = buildSummarySchoolGrade(FILTERED);
      renderAll();
      paintQuickshareAI();
    },
    error: () => {
      setStatus(`Auto-load failed (${csvName} not found).`);
      alert(`Could not auto-load ${csvName}. Make sure it is in the same folder as the HTML.`);
    }
  });
}


// ═══════════════════════════════════════════════════════════════
//   TEACHER STATS — Game-style character select & stat sheets
// ═══════════════════════════════════════════════════════════════

let TS_TEACHER_MAP = {};
let TS_CHIPS = [];
let TS_SELECTED = null;
let tsRadarChart = null;
let tsCompareChart = null;
let TS_LOADED = false;

function tsProcessData(){
  TS_TEACHER_MAP = {};
  const rows = RAW.filter(r => r.__source === "GMW" && r.teacher && String(r.teacher).trim());

  for (const r of rows){
    const name = String(r.teacher).trim();
    if (!TS_TEACHER_MAP[name]){
      TS_TEACHER_MAP[name] = {
        name,
        schools: new Set(),
        grades: new Set(),
        observations: [],
        latestDate: null,
      };
    }
    const t = TS_TEACHER_MAP[name];
    if (r.school) t.schools.add(String(r.school).trim());
    if (r.grade) t.grades.add(String(r.grade));
    t.observations.push(r);
    const d = r.__date_completed;
    if (d && (!t.latestDate || d > t.latestDate)) t.latestDate = d;
  }

  for (const t of Object.values(TS_TEACHER_MAP)){
    t.avgScores = {};
    let totalSum = 0, totalCount = 0;
    for (const dim of GMW_DIMENSIONS){
      const vals = t.observations.map(r => Number(r[dim.key])).filter(v => Number.isFinite(v) && v > 0);
      const avg = vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
      t.avgScores[dim.key] = avg;
      if (avg != null){ totalSum += avg; totalCount++; }
    }
    t.overallAvg = totalCount ? totalSum / totalCount : 0;
    t.level = Math.round(t.overallAvg * 10);
    t.schoolsArr = [...t.schools];
    t.gradesArr = [...t.grades];
  }
}

function tsGetInitials(name){
  return name.split(/\s+/).map(w => w[0] || "").join("").toUpperCase().slice(0,2);
}

function tsScoreClass(avg){
  if (avg == null) return "emerging";
  if (avg < 1.5) return "emerging";
  if (avg < 2.5) return "developing";
  return "achieving";
}

function tsRenderGrid(){
  const grid = $("#ts-grid");
  if (!grid) return;
  const teachers = Object.values(TS_TEACHER_MAP);
  const filtered = TS_CHIPS.length
    ? teachers.filter(t => TS_CHIPS.includes(t.name))
    : teachers;

  filtered.sort((a,b) => a.name.localeCompare(b.name));

  if (!filtered.length){
    grid.innerHTML = `<div class="ts-loading">No teachers found in the loaded GMW data.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const initials = tsGetInitials(t.name);
    const miniBars = GMW_DIMENSIONS.map(dim => {
      const avg = t.avgScores[dim.key];
      const cls = tsScoreClass(avg);
      const h = avg != null ? Math.max(3, Math.round((avg / 3) * 18)) : 3;
      const tipText = `${dim.label} (Score: ${avg != null ? avg.toFixed(1) : 'N/A'}) — ${dim.description || ""}`;
      return `<div class="ts-mini-bar ts-mini-bar--${cls} has-tooltip" tabindex="0" data-tooltip="${escapeAttr(tipText)}" style="height:${h}px"></div>`;
    }).join("");

    const sel = TS_SELECTED === t.name ? " selected" : "";

    return `<div class="ts-card${sel}" data-teacher="${t.name.replace(/"/g, '&quot;')}">
      <div class="ts-card-level">Lv. ${t.level}</div>
      <div class="ts-card-avatar">${initials}</div>
      <div class="ts-card-name">${t.name}</div>
      <div class="ts-card-school">${t.schoolsArr.join(", ")}</div>
      <div class="ts-card-meta">
        <span>Grade <b>${t.gradesArr.join(", ")}</b></span>
        <span><b>${t.observations.length}</b> obs</span>
      </div>
      <div class="ts-mini-bars">${miniBars}</div>
    </div>`;
  }).join("");
}

function tsRenderDetail(teacherName){
  const t = TS_TEACHER_MAP[teacherName];
  if (!t) return;

  const detail = $("#ts-detail");
  if (!detail) return;
  detail.style.display = "";

  // Header
  const header = $("#ts-detail-header");
  const initials = tsGetInitials(t.name);
  const lastDate = t.latestDate ? t.latestDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  header.innerHTML = `
    <div class="ts-detail-avatar">${initials}</div>
    <div class="ts-detail-info">
      <h3 class="ts-detail-name">${t.name}</h3>
      <div class="ts-detail-badges">
        ${t.schoolsArr.map(s => `<span class="ts-detail-badge">${s}</span>`).join("")}
        <span class="ts-detail-badge">Grade ${t.gradesArr.join(", ")}</span>
        <span class="ts-detail-badge--copper ts-detail-badge">${t.observations.length} observations</span>
        <span class="ts-detail-badge">Last: ${lastDate}</span>
      </div>
    </div>`;

  // Radar chart
  if (tsRadarChart){ tsRadarChart.destroy(); tsRadarChart = null; }
  const canvas = $("#ts-radar-chart");
  if (canvas){
    const labels = GMW_DIMENSIONS.map(d => d.label.length > 16 ? d.label.slice(0,14) + "…" : d.label);
    const data = GMW_DIMENSIONS.map(d => t.avgScores[d.key] ?? 0);
    tsRadarChart = new Chart(canvas, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: t.name,
          data,
          backgroundColor: "rgba(204,88,3,.15)",
          borderColor: RPPL_PALETTE.orange,
          borderWidth: 2,
          pointBackgroundColor: RPPL_PALETTE.plum,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: 3,
            ticks: { stepSize: 1, backdropColor: "transparent", font: { size: 10 } },
            grid: { color: "rgba(112,5,72,.08)" },
            angleLines: { color: "rgba(112,5,72,.08)" },
            pointLabels: { font: { family: '"Lato", sans-serif', size: 10 }, color: RPPL_PALETTE.ink },
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${GMW_DIMENSIONS[ctx.dataIndex]?.label}: ${ctx.raw.toFixed(2)}`,
              afterBody: (items) => gmwTooltipDescriptionLines(items[0]?.dataIndex)
            }
          }
        }
      }
    });
  }

  // Stat bars
  const barsEl = $("#ts-stat-bars");
  if (barsEl){
    barsEl.innerHTML = GMW_DIMENSIONS.map(dim => {
      const avg = t.avgScores[dim.key];
      const cls = tsScoreClass(avg);
      const pct = avg != null ? ((avg / 3) * 100).toFixed(1) : 0;
      const val = avg != null ? avg.toFixed(2) : "—";
      return `<div class="ts-bar-row">
        <span class="ts-bar-label has-tooltip" tabindex="0" data-tooltip="${escapeAttr(dim.description || "")}">${dim.label}</span>
        <div class="ts-bar-track">
          <div class="ts-bar-fill ts-bar--${cls}" style="width:${pct}%"></div>
        </div>
        <span class="ts-bar-score ts-bar-score--${cls}">${val}</span>
      </div>`;
    }).join("");
  }

  // Power level
  const powerEl = $("#ts-power-level");
  if (powerEl){
    powerEl.innerHTML = `
      <div class="ts-power-orb">
        <span class="ts-power-number">${t.overallAvg.toFixed(1)}</span>
      </div>
      <div class="ts-power-label">Power Level</div>`;
  }
}

function tsRenderComments(teacherName){
  const t = TS_TEACHER_MAP[teacherName];
  if (!t) return;
  const el = $("#ts-comments");
  if (!el) return;

  el.innerHTML = `<div class="ts-comments-title">Coaching Notes</div>` +
    GMW_DIMENSIONS.map((dim, i) => {
      const dimKey = `c${i+1}`;
      const scoreKey = dim.key;
      const comments = [];

      for (const obs of t.observations){
        const text = String(obs[dimKey] || "").trim();
        if (!text) continue;
        const score = Number(obs[scoreKey]);
        const scoreCls = score === 1 ? "emerging" : score === 2 ? "developing" : score === 3 ? "achieving" : "";
        const scoreLabel = score === 1 ? "Emerging" : score === 2 ? "Developing" : score === 3 ? "Achieving" : "";
        const date = obs.__date_completed ? obs.__date_completed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
        const observer = String(obs.observer_name || "").trim();
        comments.push({ text, score, scoreCls, scoreLabel, date, observer });
      }

      const count = comments.length;
      const items = comments.map(c => `
        <div class="ts-comment-item">
          <div class="ts-comment-text">${c.text.replace(/</g,"&lt;")}</div>
          <div class="ts-comment-meta">
            ${c.observer ? c.observer : ""}${c.date ? ` · ${c.date}` : ""}
            ${c.scoreCls ? `<span class="ts-comment-score ts-comment-score--${c.scoreCls}">${c.scoreLabel} (${c.score})</span>` : ""}
          </div>
        </div>`).join("");

      return `<div class="ts-accordion">
        <button class="ts-accordion-header" type="button">
          <span><span class="has-tooltip" tabindex="0" data-tooltip="${escapeAttr(dim.description || "")}">${dim.label}</span><span class="ts-accordion-count">(${count} note${count !== 1 ? "s" : ""})</span></span>
          <span class="ts-accordion-caret">▾</span>
        </button>
        <div class="ts-accordion-body">
          ${count ? items : `<div class="ts-comment-empty">No observation notes for this dimension.</div>`}
        </div>
      </div>`;
    }).join("");

  // Wire accordion clicks
  el.querySelectorAll(".ts-accordion-header").forEach(btn => {
    btn.addEventListener("click", () => {
      const acc = btn.closest(".ts-accordion");
      const body = acc.querySelector(".ts-accordion-body");
      const isOpen = acc.classList.contains("open");
      if (isOpen){
        body.style.maxHeight = "0";
        acc.classList.remove("open");
      } else {
        acc.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });
  });
}

function tsRenderComparison(){
  const compare = $("#ts-compare");
  if (!compare) return;
  if (TS_CHIPS.length < 2){ compare.style.display = "none"; return; }
  compare.style.display = "";

  const teachers = TS_CHIPS.map(n => TS_TEACHER_MAP[n]).filter(Boolean);
  if (teachers.length < 2){ compare.style.display = "none"; return; }

  // Sub-header
  const sub = $("#ts-compare-sub");
  if (sub) sub.textContent = `Comparing ${teachers.map(t => t.name).join(", ")}`;

  // Radar chart
  if (tsCompareChart){ tsCompareChart.destroy(); tsCompareChart = null; }
  const canvas = $("#ts-compare-radar");
  if (canvas){
    const labels = GMW_DIMENSIONS.map(d => d.label.length > 16 ? d.label.slice(0,14) + "…" : d.label);

    // Individual datasets + averaged
    const datasets = teachers.map((t, i) => ({
      label: t.name,
      data: GMW_DIMENSIONS.map(d => t.avgScores[d.key] ?? 0),
      backgroundColor: "transparent",
      borderColor: RPPL_CHART_SEQ[i % RPPL_CHART_SEQ.length],
      borderWidth: 2,
      pointBackgroundColor: RPPL_CHART_SEQ[i % RPPL_CHART_SEQ.length],
      pointRadius: 3,
    }));

    // Averaged dataset
    const avgData = GMW_DIMENSIONS.map(d => {
      const vals = teachers.map(t => t.avgScores[d.key]).filter(v => v != null);
      return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
    });
    datasets.push({
      label: "Average",
      data: avgData,
      backgroundColor: "rgba(243,201,120,.12)",
      borderColor: "#F3C978",
      borderWidth: 3,
      borderDash: [6, 3],
      pointBackgroundColor: "#F3C978",
      pointRadius: 4,
    });

    tsCompareChart = new Chart(canvas, {
      type: "radar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: 3,
            ticks: { stepSize: 1, backdropColor: "transparent", font: { size: 10 } },
            grid: { color: "rgba(112,5,72,.08)" },
            angleLines: { color: "rgba(112,5,72,.08)" },
            pointLabels: { font: { family: '"Lato", sans-serif', size: 10 }, color: RPPL_PALETTE.ink },
          }
        },
        plugins: {
          legend: { display: true, position: "bottom", labels: { font: { size: 11 } } },
        }
      }
    });
  }

  // Averaged bars
  const barsEl = $("#ts-compare-bars");
  if (barsEl){
    barsEl.innerHTML = GMW_DIMENSIONS.map(dim => {
      const vals = teachers.map(t => t.avgScores[dim.key]).filter(v => v != null);
      const avg = vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
      const cls = tsScoreClass(avg);
      const pct = avg != null ? ((avg / 3) * 100).toFixed(1) : 0;
      const val = avg != null ? avg.toFixed(2) : "—";
      return `<div class="ts-bar-row">
        <span class="ts-bar-label has-tooltip" tabindex="0" data-tooltip="${escapeAttr(dim.description || "")}">${dim.label}</span>
        <div class="ts-bar-track">
          <div class="ts-bar-fill ts-bar--${cls}" style="width:${pct}%"></div>
        </div>
        <span class="ts-bar-score ts-bar-score--${cls}">${val}</span>
      </div>`;
    }).join("");
  }

  // Comparison power level
  const powerEl = $("#ts-compare-power");
  if (powerEl){
    const allAvgs = teachers.map(t => t.overallAvg).filter(v => v > 0);
    const combinedAvg = allAvgs.length ? allAvgs.reduce((a,b) => a+b, 0) / allAvgs.length : 0;
    powerEl.innerHTML = `
      <div class="ts-power-level">
        <div class="ts-power-orb">
          <span class="ts-power-number">${combinedAvg.toFixed(1)}</span>
        </div>
        <div class="ts-power-label">Combined Power Level</div>
      </div>`;
  }
}

function tsUpdateView(){
  const detail = $("#ts-detail");
  const compare = $("#ts-compare");

  if (TS_CHIPS.length === 0){
    TS_SELECTED = null;
    if (detail) detail.style.display = "none";
    if (compare) compare.style.display = "none";
    tsRenderGrid();
  } else if (TS_CHIPS.length === 1){
    TS_SELECTED = TS_CHIPS[0];
    if (compare) compare.style.display = "none";
    tsRenderGrid();
    tsRenderDetail(TS_SELECTED);
    tsRenderComments(TS_SELECTED);
  } else {
    TS_SELECTED = null;
    if (detail) detail.style.display = "none";
    tsRenderGrid();
    tsRenderComparison();
  }
}

function tsAddChip(name){
  if (TS_CHIPS.includes(name)) return;
  TS_CHIPS.push(name);
  tsRenderChips();
  tsUpdateView();
}

function tsRemoveChip(name){
  TS_CHIPS = TS_CHIPS.filter(n => n !== name);
  tsRenderChips();
  tsUpdateView();
}

function tsRenderChips(){
  const wrap = $("#ts-chips-wrap");
  const input = $("#ts-search-input");
  if (!wrap || !input) return;

  // Remove existing chips
  wrap.querySelectorAll(".ts-chip").forEach(c => c.remove());

  // Add chips before input
  TS_CHIPS.forEach(name => {
    const chip = document.createElement("span");
    chip.className = "ts-chip";
    chip.innerHTML = `${name.replace(/</g,"&lt;")} <button class="ts-chip-x" type="button">&times;</button>`;
    chip.querySelector(".ts-chip-x").addEventListener("click", (e) => {
      e.stopPropagation();
      tsRemoveChip(name);
    });
    wrap.insertBefore(chip, input);
  });

  input.value = "";
  input.placeholder = TS_CHIPS.length ? "Add another…" : "Search teachers…";
}

function tsShowDropdown(query){
  const dropdown = $("#ts-dropdown");
  if (!dropdown) return;

  const q = query.toLowerCase().trim();
  if (!q){
    dropdown.style.display = "none";
    return;
  }

  const teachers = Object.values(TS_TEACHER_MAP)
    .filter(t => !TS_CHIPS.includes(t.name) && t.name.toLowerCase().includes(q))
    .sort((a,b) => a.name.localeCompare(b.name))
    .slice(0, 12);

  if (!teachers.length){
    dropdown.innerHTML = `<div class="ts-dropdown-empty">No matching teachers</div>`;
    dropdown.style.display = "block";
    return;
  }

  dropdown.innerHTML = teachers.map((t, i) => `
    <div class="ts-dropdown-item${i === 0 ? " highlighted" : ""}" data-teacher="${t.name.replace(/"/g, '&quot;')}">
      <div>
        <span class="ts-dropdown-name">${t.name}</span>
        <span class="ts-dropdown-meta">${t.schoolsArr[0] || ""}</span>
      </div>
      <span class="ts-dropdown-obs">${t.observations.length} obs</span>
    </div>`).join("");
  dropdown.style.display = "block";

  // Wire clicks
  dropdown.querySelectorAll(".ts-dropdown-item").forEach(item => {
    item.addEventListener("click", () => {
      tsAddChip(item.dataset.teacher);
      dropdown.style.display = "none";
      $("#ts-search-input")?.focus();
    });
  });
}

function tsInitSearch(){
  const input = $("#ts-search-input");
  const dropdown = $("#ts-dropdown");
  if (!input || !dropdown) return;

  input.addEventListener("input", () => tsShowDropdown(input.value));

  input.addEventListener("keydown", (e) => {
    const items = Array.from(dropdown.querySelectorAll(".ts-dropdown-item"));
    const highlighted = dropdown.querySelector(".ts-dropdown-item.highlighted");
    const idx = items.indexOf(highlighted);

    if (e.key === "ArrowDown" && items.length){
      e.preventDefault();
      items.forEach(it => it.classList.remove("highlighted"));
      items[(idx + 1) % items.length].classList.add("highlighted");
    } else if (e.key === "ArrowUp" && items.length){
      e.preventDefault();
      items.forEach(it => it.classList.remove("highlighted"));
      items[(idx - 1 + items.length) % items.length].classList.add("highlighted");
    } else if (e.key === "Enter"){
      e.preventDefault();
      if (highlighted){
        tsAddChip(highlighted.dataset.teacher);
        dropdown.style.display = "none";
      }
    } else if (e.key === "Escape"){
      dropdown.style.display = "none";
    } else if (e.key === "Backspace" && !input.value && TS_CHIPS.length){
      tsRemoveChip(TS_CHIPS[TS_CHIPS.length - 1]);
    }
  });

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".ts-search-bar")){
      dropdown.style.display = "none";
    }
  });
}

function tsOpenPage(){
  const page = $("#page-teacher-stats");
  if (!page) return;

  // If GMW data isn't loaded, load it
  if (DATASET_KIND !== "GMW" || !RAW.length){
    const grid = $("#ts-grid");
    if (grid) grid.innerHTML = `<div class="ts-loading"><div class="ts-loading-spinner"></div>Loading GMW data…</div>`;
    loadBundledCSV("data/GMW.csv").then(() => {
      tsProcessData();
      TS_LOADED = true;
      tsRenderGrid();
    });
  } else {
    if (!TS_LOADED){
      tsProcessData();
      TS_LOADED = true;
    }
    tsUpdateView();
  }
}

function tsInit(){
  tsInitSearch();

  // Grid click delegation
  $("#ts-grid")?.addEventListener("click", (e) => {
    const card = e.target.closest(".ts-card");
    if (!card) return;
    const name = card.dataset.teacher;
    if (!name) return;

    // If already chipped, just select
    if (TS_CHIPS.includes(name)){
      TS_SELECTED = name;
      tsRenderDetail(name);
      tsRenderComments(name);
      document.querySelectorAll(".ts-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      return;
    }

    // Toggle selection
    if (TS_SELECTED === name){
      TS_SELECTED = null;
      card.classList.remove("selected");
      $("#ts-detail").style.display = "none";
    } else {
      TS_SELECTED = name;
      document.querySelectorAll(".ts-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      tsRenderDetail(name);
      tsRenderComments(name);
    }
  });
}


async function wire(){
  setCurrentYear();
  initDashboardUI();
  initMainTabs();
  initNav();
  initAskChat();
  initOracle();
  initDocsTabs();
  initSearch();
  tsInit();

  $("#file").addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if (f) onFile(f);
  });

  $("#btn-apply").addEventListener("click", applyFilters);
  $("#btn-reset").addEventListener("click", resetFilters);
  $("#btn-export").addEventListener("click", exportSummaryCSV);
  $("#btn-ai-summarize")?.addEventListener("click", generateAISummary);

  // Quick-load buttons for bundled datasets - no upload needed.
  $("#btn-load-em2")?.addEventListener("click", () => loadBundledCSV("data/EM2.csv"));
  $("#btn-load-gmw")?.addEventListener("click", () => loadBundledCSV("data/GMW.csv"));

  // Version pill in the sidebar opens the Docs page on the History tab.
  $("#brand-version")?.addEventListener("click", () => {
    const docsNav = document.querySelector('.nav-btn[data-page="docs"]');
    if (docsNav) docsNav.click();
    setTimeout(() => {
      const historyTab = document.querySelector('.docs-tab[data-docs-tab="history"]');
      if (historyTab) historyTab.click();
    }, 30);
  });

  polishButtons();

  // ✅ IMPORTANT: apply qs -> sv BEFORE autoLoad
  try {
    const didQS = await applyQuickshareFromURL(); // sets sv in URL if qs exists

    // If RAW is already loaded (rare, but possible), apply immediately
    if (didQS && RAW?.length) {
      window.__SV_TRY_APPLY?.();
    }
  } catch (e) {
    console.warn("[quickshare] applyQuickshareFromURL failed", e);
  }

  // Now this works for BOTH:
  // - direct sv links
  // - qs links (because qs handler sets sv first)
  autoLoadIfSavedView();

  // Boot-time auto-load so Ask the Data is ready without requiring an upload.
  // Skip if a Quickshare/saved-view already loaded data, or the user uploaded in the meantime.
  setTimeout(() => {
    if (!RAW || !RAW.length){
      loadBundledCSV("data/EM2.csv", { silent: false });
    }
  }, 100);
}

wire();

// hi G can you see this? I ate corned beef for breakfast :D
