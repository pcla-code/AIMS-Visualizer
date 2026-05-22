#!/usr/bin/env node
// scripts/generate-demo-csvs.js
//
// Generates fully synthetic EM2.csv and GMW.csv demo files.
//
// Unlike scripts/anonymize-csvs.js, this script does NOT read or transform
// any real source data. Every value - schools, teachers, observers, scores,
// dates, and the 80 free-text comment cells per GMW row - is fabricated
// from static pools and templated phrases. The output is safe for public
// release with no risk of leaking real student, teacher, or school data.
//
// Usage: node scripts/generate-demo-csvs.js
//   Reads only the schema (header + Qualtrics meta rows) from existing
//   data/GMW.csv and data/EM2.csv, then overwrites every data row.
//
// Deterministic: a fixed PRNG seed makes the output byte-identical across runs.

const fs = require("fs");
const path = require("path");

// ---------- Robust CSV parse/serialize (same as anonymize-csvs.js) ----------

function parseCsv(text){
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQ){
      if (c === '"' && text[i+1] === '"'){ field += '"'; i++; }
      else if (c === '"'){ inQ = false; }
      else { field += c; }
    } else {
      if (c === '"'){ inQ = true; }
      else if (c === ","){ row.push(field); field = ""; }
      else if (c === "\r"){ /* swallow */ }
      else if (c === "\n"){ row.push(field); rows.push(row); row = []; field = ""; }
      else { field += c; }
    }
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

function serializeCsv(rows){
  const needsQuote = (s) => /[",\r\n]/.test(s);
  return rows.map(row =>
    row.map(field => {
      const s = field == null ? "" : String(field);
      return needsQuote(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")
  ).join("\r\n") + "\r\n";
}

// ---------- Deterministic PRNG ----------

function mulberry32(seed){
  let s = seed >>> 0;
  return function(){
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260522);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randint = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p) => rand() < p;

// ---------- Pools ----------

const PUBLIC_SCHOOLS = [
  "Sequoia Elementary School", "Aspen Grove Elementary School",
  "Wildflower Elementary School", "Riverbend Elementary School",
  "Hawthorn Park Elementary School", "Glacier Peak Elementary School",
  "Sunflower Ridge Elementary School", "Cobblestone Elementary School",
  "Heritage Pines Elementary School", "Driftwood Elementary School",
  "Lantern Hill Elementary School", "Quartz Creek Elementary School",
  "Periwinkle Elementary School", "Songbird Meadows Elementary School",
  "Copperfield Elementary School", "Marigold Elementary School",
  "Crescent Cove Elementary School", "Thornberry Elementary School",
  "Birchwood Elementary School", "Foxglen Elementary School",
];

const PRIVATE_SCHOOLS = [
  "St. Bartholomew Academy", "Beacon Hill Day School",
  "Ivywood Country Day School", "Magnolia Hall Academy",
  "Stonecroft Friends School", "Lighthouse Christian Academy",
  "Linden Academy", "Mosaic Montessori School",
  "Verdant Springs Academy", "Cathedral Heights School",
];

const DISTRICTS = [
  "Maple Ridge Unified", "Pinecrest School District",
  "Cedar Hills USD", "Silverwood Unified",
  "Brookhaven District", "Northfield Unified",
  "Stonebridge USD", "Willowmere School District",
  "Greenleaf Unified", "Highmont District",
];

const OBSERVERS = [
  "Avery Calderon", "Bianca Reyes", "Caleb Whitfield",
  "Dahlia Okonkwo", "Elena Bishop", "Felix Ng",
  "Greta Holloway", "Hiro Tanaka", "Imani Sutherland",
  "Jude Fernandez", "Kira Vasquez", "Leo Petrov",
  "Mira Castillo", "Naveen Singh", "Olivia Brennan",
];

const TEACHERS = [
  "Aiden Cabrera", "Bella Yamamoto", "Camille Voss",
  "Darius Pemberton", "Esme Larkin", "Fiona Drummond",
  "Gabriel Ortiz-Reilly", "Hannah Iverson", "Isaac Quintero",
  "Jenna Bellamy", "Kai Sorensen", "Lila Townsend",
  "Mateo Aguilar", "Nora Whitman", "Oscar Delaney",
  "Penny McAllister", "Quincy Rosales", "Rosa Henley",
  "Soren Vidal", "Talia Kessler", "Umberto Barnett",
  "Vivian Crowe", "Wren Saavedra", "Xavier Boone",
  "Yusuf Pritchard", "Zara Hollister", "Amari Salgado",
  "Beatrix Donnelly", "Cosmo Fairbanks", "Della Markham",
];

const DEMO_IPS = [
  "192.0.2.15", "192.0.2.42", "192.0.2.77", "192.0.2.113", "192.0.2.198",
  "198.51.100.21", "198.51.100.56", "198.51.100.99", "198.51.100.144",
  "203.0.113.8", "203.0.113.51", "203.0.113.92", "203.0.113.166",
];

const DEMO_LATLONG = [
  ["38.9072", "-77.0369"], ["41.8781", "-87.6298"], ["32.7767", "-96.7970"],
  ["39.7392", "-104.9903"], ["47.6062", "-122.3321"], ["42.3601", "-71.0589"],
  ["33.7490", "-84.3880"], ["35.2271", "-80.8431"], ["29.7604", "-95.3698"],
  ["44.9778", "-93.2650"],
];

const ROLES = ["Coach", "Principal", "Assistant Principal", "Instructional Specialist", "District Lead"];
const STATES = ["CA", "TX", "NY", "FL", "IL", "WA", "MA", "GA", "NC", "MN"];

const GRADES = ["K", "1", "2", "3", "4", "5"];
const MODULES = ["1", "2", "3", "4", "5", "6"];
const CURRICULA = ["em2ca", "em2"];

// ---------- GMW comment templates ----------
// 8 dimensions x 3 score-bands (low: 1-2, mid: 2-3, high: 3-4).
// Comments are entirely invented. They contain no student names, no
// institution-specific references, no dates, and no real classroom anecdotes.

const COMMENT_TEMPLATES = {
  // 1. Lesson Component Facilitation
  1: {
    low:  [
      "Components ran together without clear transitions between fluency, application, and concept development.",
      "Pacing left limited time for the closing component; students did not get to a debrief.",
      "Materials were not staged ahead of time, which pulled focus away from the lesson flow.",
      "Lesson skipped the planned launch activity and went straight into independent work.",
    ],
    mid:  [
      "Most components were facilitated as designed, though the closing was abbreviated.",
      "Transitions between components were visible but a bit long; students stayed mostly on task.",
      "Teacher followed the lesson sequence with light improvisation during application.",
      "Pacing was generally aligned to the curriculum suggested time bands.",
    ],
    high: [
      "Every lesson component was facilitated with intention and clear time boundaries.",
      "Transitions were tight; the launch set up the application work efficiently.",
      "Closing component drew explicit connections back to the lesson objective.",
      "Teacher used a visible agenda that helped students self-monitor pacing.",
    ],
  },
  // 2. Pedagogical Elements
  2: {
    low:  [
      "Lesson leaned on direct telling; few of the curriculum's signature routines were visible.",
      "Anchor chart was on the wall but not referenced during the lesson.",
      "Manipulatives were available but not introduced into the work.",
      "Number line / array model from the curriculum was not used during the discussion.",
    ],
    mid:  [
      "Curriculum routines were partially used; one or two were swapped for teacher-created alternatives.",
      "Models from the curriculum appeared in the lesson, though student work didn't always reference them.",
      "Teacher pulled one signature routine into the lesson and ran it with fidelity.",
      "Visual models were referenced briefly during the share-out.",
    ],
    high: [
      "Curriculum-aligned routines anchored the lesson - choral counting and a number talk both appeared.",
      "Multiple representations were used in tandem; students chose between models when solving.",
      "Anchor charts were referenced repeatedly and updated live during the lesson.",
      "Teacher modeled the precise mathematical language the curriculum specifies.",
    ],
  },
  // 3. Cognitive Lift
  3: {
    low:  [
      "Tasks were procedural; students replicated a worked example with little decision-making.",
      "Most questions had a single correct numeric answer with no required reasoning.",
      "Worksheets stayed at the recall level for the full lesson.",
      "Higher-rigor problems in the curriculum were skipped.",
    ],
    mid:  [
      "Some tasks asked students to choose a strategy, though most were single-step.",
      "Questions occasionally pressed for justification, especially during the closing share.",
      "A few extension problems were available for students who finished early.",
      "Cognitive demand was uneven across the lesson - high during launch, lower during practice.",
    ],
    high: [
      "Tasks required students to compare strategies and defend their choices.",
      "Open-ended prompts produced multiple valid solution paths in student work.",
      "Teacher held the rigor of the curriculum task without funneling students to a single method.",
      "Closing questions pressed students to generalize beyond the specific numbers in the task.",
    ],
  },
  // 4. Discourse
  4: {
    low:  [
      "Discussion was mostly teacher-to-student; few student-to-student exchanges happened.",
      "Talk moves like restating or adding on were not prompted.",
      "A small group of students answered most questions while others were quiet.",
      "Wait time was very short; teacher typically filled in the answer.",
    ],
    mid:  [
      "Some turn-and-talks took place, with a brief whole-group share afterward.",
      "Teacher used 'who can build on that?' a few times to chain student responses.",
      "Discussion was structured but uneven across the room.",
      "Sentence stems were posted; about half the students used them.",
    ],
    high: [
      "Students consistently restated, agreed with, or pushed back on one another's reasoning.",
      "Teacher acted as a facilitator while students drove the mathematical discussion.",
      "Multiple talk moves - revoicing, pressing for reasoning, adding on - were visible in every transition.",
      "Sentence stems were used naturally; discourse felt routine rather than performed.",
    ],
  },
  // 5. Collecting Evidence
  5: {
    low:  [
      "Teacher circulated briefly but did not record observations of student thinking.",
      "Exit ticket was given but not reviewed during the lesson.",
      "Only one or two students were called on to share, limiting the evidence base.",
      "No formative check happened between the launch and the independent work.",
    ],
    mid:  [
      "Teacher checked a sample of students during work time and adjusted the share-out accordingly.",
      "A quick fist-to-five check happened at the midpoint of the lesson.",
      "Some student work was photographed for later review.",
      "Teacher tracked who shared, ensuring a broader sample over the lesson.",
    ],
    high: [
      "Teacher captured specific evidence on a clipboard and used it to sequence student shares.",
      "Multiple formative checks - whiteboard responses, choral counts, partner shares - were embedded.",
      "Teacher named which students they hadn't heard from yet and pulled them into the conversation.",
      "Evidence collected during work time directly shaped the closing discussion.",
    ],
  },
  // 6. Responding and Feedback
  6: {
    low:  [
      "Feedback was mostly evaluative ('good', 'not quite') rather than specific.",
      "Errors were corrected immediately by the teacher rather than surfaced for the class.",
      "Students who struggled were given the answer without a probing question first.",
      "No follow-up was visible after a student misconception was noted.",
    ],
    mid:  [
      "Some feedback pointed to specific strategy choices; some stayed at the praise level.",
      "Teacher paused on one misconception and worked through it briefly with the class.",
      "Individual conferring during work time addressed two or three students' approaches.",
      "Feedback shifted from evaluation to questioning during the second half of the lesson.",
    ],
    high: [
      "Feedback was specific, strategy-focused, and timed to keep students productively struggling.",
      "Teacher used student errors as instructional moments, often making them visible to the class.",
      "Probing questions consistently preceded any direct correction.",
      "Written and verbal feedback both pointed students toward a clear next move.",
    ],
  },
  // 7. Collaborative Engagement
  7: {
    low:  [
      "Partner work was assigned but most students worked individually next to each other.",
      "Group roles were not assigned; one student typically did the work for the pair.",
      "Collaboration time was short and ended before most pairs were finished.",
      "Materials were shared but conversation between partners was minimal.",
    ],
    mid:  [
      "Partner work was structured with a brief protocol; about half the pairs followed it.",
      "Teacher modeled what a strong collaboration looked like before releasing students.",
      "Some groups produced shared work while others split the task.",
      "Group norms were posted and referenced once during the lesson.",
    ],
    high: [
      "Partner work was structured with clear roles and accountable talk stems.",
      "Students naturally compared strategies and revised their own work after listening to a peer.",
      "Group protocols were embedded in routines; transitions in and out of pairs were efficient.",
      "Teacher visibly redirected groups using collaborative norms rather than reasserting control.",
    ],
  },
  // 8. Independent Engagement
  8: {
    low:  [
      "Several students were off-task during independent work and were not redirected.",
      "Work time was short and many students did not produce a written response.",
      "Independent work did not match the cognitive level of the lesson launch.",
      "Students who finished early had no clear next step.",
    ],
    mid:  [
      "Most students worked independently for the full block, with a few needing redirection.",
      "Independent task was aligned to the lesson objective; engagement was steady.",
      "Teacher provided an extension for early finishers, used by some students.",
      "Quiet, focused work happened for the bulk of the independent block.",
    ],
    high: [
      "Students were visibly invested - working through tough problems without quitting.",
      "Independent work showed clear evidence of the strategies developed earlier in the lesson.",
      "Students self-monitored, checked their work, and revised before submitting.",
      "Every student produced written work that the teacher can use diagnostically.",
    ],
  },
};

const NEXT_STEPS_TEMPLATES = [
  "Continue building out student-led discourse routines; consider a sentence-stem refresh.",
  "Plan a coaching cycle focused on closing-component facilitation.",
  "Co-plan the next module's launch lesson to tighten transitions.",
  "Try a paired observation focused specifically on accountable talk.",
  "Pull a small group during work time to gather more diagnostic evidence.",
  "Revisit the curriculum's signature routines in next week's PLC.",
  "Layer in one new formative check at the lesson midpoint.",
  "Try a low-stakes student-led share at the close.",
  "Plan for one targeted extension problem for early finishers.",
  "Use the next observation to focus on cognitive demand of student tasks.",
];

// ---------- Helpers ----------

function fakeEmail(fullName){
  const parts = fullName.trim().split(/\s+/);
  const first = (parts[0] || "user").toLowerCase().replace(/[^a-z]/g, "");
  const last = (parts.slice(1).join("") || "demo").toLowerCase().replace(/[^a-z]/g, "");
  return `${first}.${last}@example.edu`;
}

function commentFor(dim, score){
  const band = score <= 2 ? "low" : score === 3 ? "mid" : "high";
  const arr = COMMENT_TEMPLATES[dim][band];
  return pick(arr);
}

// ---------- Teacher archetypes ----------
//
// Each teacher is assigned one of several distinct rubric "shapes" so the
// radar chart and Power Level rankings look dramatically different across
// the roster. Per-dimension values are anchor points in the 1..4 scale.
// Dimensions index: 1 LessonComp 2 Pedagogy 3 CogLift 4 Discourse
//                   5 CollectingEv 6 RespFeedback 7 CollabEng 8 IndepEng

const TEACHER_ARCHETYPES = [
  // Top of the rubric across the board - "all-star" - clean wide radar.
  { name: "achiever",            shape: [4.0, 3.9, 3.8, 4.0, 3.9, 3.9, 4.0, 3.9] },
  // Discourse / collaboration champion, weak on evidence collection.
  { name: "discourse_champion",  shape: [3.0, 3.0, 3.8, 4.0, 1.5, 2.5, 4.0, 3.8] },
  // Strong with the curriculum routines, low on student-driven discourse.
  { name: "curriculum_faithful", shape: [4.0, 4.0, 2.0, 1.8, 3.5, 3.0, 2.5, 3.5] },
  // Cognitive lift + feedback focused, average everywhere else.
  { name: "rigor_pusher",        shape: [3.0, 3.0, 4.0, 3.0, 3.5, 4.0, 2.5, 3.0] },
  // Mid-level all-rounder.
  { name: "steady_middler",      shape: [2.8, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8] },
  // Spiky - alternating dimensions.
  { name: "spiky_high",          shape: [4.0, 2.0, 4.0, 2.0, 4.0, 2.0, 4.0, 2.0] },
  // Spiky - opposite alternation.
  { name: "spiky_low",           shape: [1.5, 3.8, 1.5, 3.8, 1.5, 3.8, 1.5, 3.8] },
  // Independent / collaborative engagement excellent, structure weaker.
  { name: "engagement_first",    shape: [2.0, 2.2, 2.8, 3.5, 2.5, 3.0, 4.0, 4.0] },
  // Mostly Emerging, with one or two pockets of growth.
  { name: "emerging",            shape: [1.8, 1.6, 1.6, 2.2, 1.8, 1.8, 2.0, 1.8] },
  // Genuinely struggling across the board.
  { name: "struggling",          shape: [1.2, 1.4, 1.2, 1.3, 1.3, 1.2, 1.4, 1.2] },
];

// Each teacher gets a stable archetype + small per-dimension personality
// wobble. The wobble is small (±0.25) compared to between-archetype spread
// so the archetype shape stays visible.
function buildTeacherProfile(name, idx){
  // Hash name to a deterministic per-teacher RNG so re-runs are stable.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++){
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const r = mulberry32(h);
  const archetype = TEACHER_ARCHETYPES[idx % TEACHER_ARCHETYPES.length];
  const dims = {};
  for (let d = 1; d <= 8; d++){
    dims[d] = archetype.shape[d - 1] + (r() - 0.5) * 0.5;
  }
  return { archetype: archetype.name, dims };
}

// Distribute archetypes across the teacher roster. With 30 teachers and 10
// archetypes we get 3 teachers per archetype - enough that filters showing
// "all Achievers" or "all Strugglers" still find a multi-teacher cohort.
const TEACHER_PROFILES = Object.fromEntries(
  TEACHERS.map((t, i) => [t, buildTeacherProfile(t, i)])
);

function scoreForTeacherOnDim(teacher, dim){
  const profile = TEACHER_PROFILES[teacher];
  // Session-level noise is small so the teacher's archetype dominates the chart.
  const target = profile.dims[dim] + (rand() - 0.5) * 0.35;
  return Math.max(1, Math.min(4, Math.round(target)));
}

// ---------- EM2 generation ----------

function generateEm2(headers){
  const rows = [headers];
  const HEADER_IDX = Object.fromEntries(headers.map((h, i) => [h, i]));

  // ---- School personalities: tiered baselines so the school-comparison bar
  // chart shows real range, not a row of similar bars. Each school also
  // gets a "trend arc" so the date filter and Oracle Mode regression reveal
  // schools that are clearly improving, declining, or stable.
  //
  // Trend curve runs from start of year (date_pos = 0) to end (date_pos = 1)
  // and is added to the school's baseline ratio.
  //   improving:  +0.20 over the year
  //   declining:  -0.25 over the year
  //   flat:        0
  //   sawtooth:    ±0.15 oscillation (most consistent overall avg)
  //
  // Per-grade modifier is large enough to be visible on grade-filtered views.
  // Per-module difficulty creates dips in some modules.

  const schoolProfiles = {};
  const TIERS = [
    { count: 4, range: [0.85, 0.95] }, // top performers
    { count: 4, range: [0.70, 0.85] }, // strong
    { count: 6, range: [0.50, 0.70] }, // mid
    { count: 4, range: [0.30, 0.50] }, // struggling
    { count: 2, range: [0.18, 0.30] }, // very low
  ];
  const TRENDS = ["improving", "declining", "flat", "sawtooth"];
  // Shuffle a copy of the school list deterministically and assign tiers.
  const shuffled = PUBLIC_SCHOOLS.slice();
  for (let i = shuffled.length - 1; i > 0; i--){
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let cursor = 0;
  for (let t = 0; t < TIERS.length; t++){
    const { count, range } = TIERS[t];
    for (let k = 0; k < count && cursor < shuffled.length; k++, cursor++){
      const s = shuffled[cursor];
      const baseline = range[0] + rand() * (range[1] - range[0]);
      const trend = TRENDS[(cursor + t) % TRENDS.length];
      schoolProfiles[s] = { baseline, trend };
    }
  }

  // Per-module difficulty - module 4 and 6 are visibly harder for everyone,
  // module 2 is the gentlest. This creates contrast in module-filtered views.
  const MODULE_DIFFICULTY = { "1": 0.00, "2": +0.08, "3": -0.02, "4": -0.12, "5": -0.04, "6": -0.10 };

  function trendDelta(trend, datePos){
    // datePos in [0..1]
    if (trend === "improving") return -0.10 + 0.30 * datePos;        // -0.10 -> +0.20
    if (trend === "declining") return +0.12 - 0.30 * datePos;        // +0.12 -> -0.18
    if (trend === "flat")      return 0;
    if (trend === "sawtooth")  return 0.15 * Math.sin(datePos * Math.PI * 4);
    return 0;
  }

  // Date helpers - we sample across an 11-month window so the trend arcs
  // have room to play out.
  function pickDateAndPos(){
    const monthIdx = randint(0, 10); // 0..10 -> month 1..11
    const day = randint(1, 28);
    const year = 25;
    const month = monthIdx + 1;
    const datePos = (monthIdx * 30 + day) / 330;
    return [`${month}/${day}/${year}`, Math.max(0, Math.min(1, datePos))];
  }

  const topics = ["A", "B", "C", "D", "E", "F"];
  const targetRows = 9000;
  for (let i = 0; i < targetRows; i++){
    const school = pick(PUBLIC_SCHOOLS);
    const profile = schoolProfiles[school];
    const grade = pick(["3", "4", "5"]);
    const module = pick(MODULES);
    const topic = pick(topics);
    const quizN = randint(1, 3);
    const assessment = `Grade ${grade}, Module ${module}, Topic ${topic} Quiz ${quizN}`;
    const [date, datePos] = pickDateAndPos();

    // Grade modifier - wider than before so per-grade slices look distinct.
    const gradeMod = grade === "5" ? +0.10 : grade === "3" ? -0.12 : 0;

    const possible = randint(6, 18);
    const skill =
      profile.baseline
      + gradeMod
      + (MODULE_DIFFICULTY[module] || 0)
      + trendDelta(profile.trend, datePos);
    const ratio = Math.max(0.02, Math.min(1.0, skill + (rand() - 0.5) * 0.18));
    const achieved = Math.max(0, Math.min(possible, Math.round(possible * ratio)));
    const pct = Math.round(100 * achieved / possible);
    const band =
      pct >= 80 ? "advanced" :
      pct >= 65 ? "proficient" :
      pct >= 45 ? "partially proficient" :
                  "not yet proficient";

    const row = new Array(headers.length).fill("");
    row[HEADER_IDX["assessment"]] = assessment;
    row[HEADER_IDX["assessment_status"]] = "open";
    row[HEADER_IDX["type_of_assessment"]] = "TQ";
    row[HEADER_IDX["is_custom"]] = "FALSE";
    row[HEADER_IDX["grade"]] = grade;
    row[HEADER_IDX["module"]] = module;
    row[HEADER_IDX["curriculum"]] = "em2ca";
    row[HEADER_IDX["school"]] = school;
    row[HEADER_IDX["date_launched"]] = date;
    row[HEADER_IDX["date_completed"]] = date;
    row[HEADER_IDX["overall_points_achieved"]] = String(achieved);
    row[HEADER_IDX["overall_points_possible"]] = String(possible);
    row[HEADER_IDX["overall_percentage"]] = String(pct);
    row[HEADER_IDX["performance_band"]] = band;
    rows.push(row);
  }
  return rows;
}

// ---------- GMW generation ----------

// Helper: per-row, fill one observation slot (n in 1..10).
function fillObservationSlot(row, headers, HIDX, n, teacher){
  const set = (col, val) => {
    const i = HIDX[col];
    if (i != null) row[i] = val;
  };
  set(`o${n}_tchr_name`, teacher);
  set(`o${n}_tchr_grade`, pick(GRADES));
  set(`o${n}_tchr_curr`, pick(CURRICULA));
  set(`o${n}_tchr_mod`, pick(MODULES));
  for (let k = 1; k <= 8; k++){
    const score = scoreForTeacherOnDim(teacher, k);
    set(`o${n}_${k}`, String(score));
    // Handle the typo "09_6_comments" in the source schema.
    const commentCol = (n === 9 && k === 6) ? "09_6_comments" : `o${n}_${k}_comments`;
    set(commentCol, commentFor(k, score));
  }
  if (n <= 8){
    // o9_next and o10_next do not exist in the header; only o1..o8 have _next.
    set(`o${n}_next`, pick(NEXT_STEPS_TEMPLATES));
  }
}

function pad2(n){ return n < 10 ? "0" + n : String(n); }
function isoTimestamp(year, month, day, hour, minute){
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(randint(0,59))}`;
}

function generateGmw(headers, metaRows){
  const HIDX = Object.fromEntries(headers.map((h, i) => [h, i]));
  const rows = [headers, ...metaRows];

  // Generate ~55 response rows. Each observer files 2-5 rows over time;
  // each row carries 1-5 observation slots (rest blank).
  const responsesPerObserver = OBSERVERS.map(o => randint(2, 5));
  const totalResponses = responsesPerObserver.reduce((a,b) => a+b, 0);

  let respCounter = 0;
  for (let oi = 0; oi < OBSERVERS.length; oi++){
    const observer = OBSERVERS[oi];
    const reps = responsesPerObserver[oi];
    const role = pick(ROLES);
    const state = pick(STATES);
    const district = pick(DISTRICTS);
    const pubSchool = pick(PUBLIC_SCHOOLS);
    const privSchool = chance(0.25) ? pick(PRIVATE_SCHOOLS) : "";
    const [lat, lng] = pick(DEMO_LATLONG);
    const ip = pick(DEMO_IPS);

    for (let r = 0; r < reps; r++){
      respCounter++;
      const month = randint(1, 10);
      const day = randint(1, 28);
      const startHour = randint(8, 14);
      const startMin = randint(0, 50);
      const duration = randint(900, 2400);
      const startTs = isoTimestamp(2025, month, day, startHour, startMin);
      const endHour = startHour + (duration > 3600 ? 1 : 0);
      const endMin = (startMin + Math.floor(duration / 60)) % 60;
      const endTs = isoTimestamp(2025, month, day, endHour, endMin);
      const obsDate = `${pad2(month)}/${pad2(day)}/2025`;

      const row = new Array(headers.length).fill("");

      // Qualtrics meta
      row[HIDX["StartDate"]] = startTs;
      row[HIDX["EndDate"]] = endTs;
      row[HIDX["Status"]] = "0";
      row[HIDX["IPAddress"]] = ip;
      row[HIDX["Progress"]] = "100";
      row[HIDX["Duration (in seconds)"]] = String(duration);
      row[HIDX["Finished"]] = "1";
      row[HIDX["RecordedDate"]] = endTs;
      row[HIDX["ResponseId"]] = "R_" + Math.floor(rand() * 1e15).toString(36).slice(0, 15).padEnd(15, "0");
      row[HIDX["LocationLatitude"]] = lat;
      row[HIDX["LocationLongitude"]] = lng;
      row[HIDX["DistributionChannel"]] = "anonymous";
      row[HIDX["UserLanguage"]] = "EN";

      // Demo (observer) fields
      row[HIDX["demo_name"]] = observer;
      row[HIDX["demo_email"]] = fakeEmail(observer);
      row[HIDX["demo_role"]] = role;
      row[HIDX["demo_state"]] = state;
      row[HIDX["demo_district_1"]] = district;
      row[HIDX["demo_school_pub_1"]] = pubSchool;
      row[HIDX["demo_school_priv_1"]] = privSchool;
      row[HIDX["date of ob"]] = obsDate;
      row[HIDX["resp_email"]] = fakeEmail(observer);

      // NCES IDs (synthetic)
      if (HIDX["NCES_District"] != null) row[HIDX["NCES_District"]] = String(900000 + (respCounter * 137) % 100000).padStart(6, "0");
      if (HIDX["NCES_School"] != null) row[HIDX["NCES_School"]] = String(900000000000 + (respCounter * 31337) % 1000000000).padStart(12, "0");
      if (HIDX["NCES_School_Private"] != null && privSchool) row[HIDX["NCES_School_Private"]] = "A" + String(9000000000 + (respCounter * 71) % 1000000).padStart(10, "0");

      // 1..5 observation slots per row (rest blank)
      const slotCount = randint(1, 5);
      // Pick teachers without immediate repetition within this row.
      const teachersThisRow = new Set();
      while (teachersThisRow.size < slotCount){
        teachersThisRow.add(pick(TEACHERS));
      }
      let slotIdx = 1;
      for (const t of teachersThisRow){
        fillObservationSlot(row, headers, HIDX, slotIdx, t);
        slotIdx++;
      }

      // LastObs is a derived field in some Qualtrics exports - leave blank
      // (the visualizer recomputes per-row state from the o{n}_* columns).

      rows.push(row);
    }
  }
  return rows;
}

// ---------- Main ----------

function main(){
  const repoRoot = path.resolve(__dirname, "..");
  const dataDir = path.join(repoRoot, "data");
  const em2Path = path.join(dataDir, "EM2.csv");
  const gmwPath = path.join(dataDir, "GMW.csv");

  if (!fs.existsSync(em2Path) || !fs.existsSync(gmwPath)){
    console.error("[ERROR] data/EM2.csv and data/GMW.csv must exist (the script preserves their headers/meta rows).");
    process.exit(1);
  }

  const em2Existing = parseCsv(fs.readFileSync(em2Path, "utf8"));
  const gmwExisting = parseCsv(fs.readFileSync(gmwPath, "utf8"));

  const em2Headers = em2Existing[0];
  const gmwHeaders = gmwExisting[0];

  // GMW has 2 Qualtrics meta rows (human-readable labels + ImportId JSON).
  // Identify them: any row whose ResponseId cell is "Response ID" or contains "ImportId".
  const respIdIdx = gmwHeaders.indexOf("ResponseId");
  const gmwMetaRows = [];
  for (let i = 1; i < gmwExisting.length; i++){
    const v = String(gmwExisting[i][respIdIdx] || "");
    if (v === "Response ID" || v.includes("ImportId")) gmwMetaRows.push(gmwExisting[i]);
    else break;
  }

  console.log(`[generate-demo-csvs] EM2 schema: ${em2Headers.length} columns`);
  console.log(`[generate-demo-csvs] GMW schema: ${gmwHeaders.length} columns + ${gmwMetaRows.length} meta row(s)`);

  const em2Rows = generateEm2(em2Headers);
  const gmwRows = generateGmw(gmwHeaders, gmwMetaRows);

  fs.writeFileSync(em2Path, serializeCsv(em2Rows), "utf8");
  fs.writeFileSync(gmwPath, serializeCsv(gmwRows), "utf8");

  console.log("");
  console.log(`[generate-demo-csvs] done.`);
  console.log(`  Wrote: ${em2Path} (${em2Rows.length - 1} data rows, ${PUBLIC_SCHOOLS.length} schools)`);
  console.log(`  Wrote: ${gmwPath} (${gmwRows.length - 1 - gmwMetaRows.length} data rows, ${OBSERVERS.length} observers, ${TEACHERS.length} teachers)`);
  console.log("");
  console.log("  All values are synthetic. No real names, schools, or comments were used as input.");
}

main();
