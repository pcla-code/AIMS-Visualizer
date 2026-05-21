#!/usr/bin/env node
// scripts/anonymize-csvs.js
//
// Usage: node scripts/anonymize-csvs.js [path-to-source-dir]
//   path-to-source-dir defaults to the repo root (process.cwd()).
//   Reads EM2.csv and GMW.csv from <path-to-source-dir>,
//   writes anonymized replicas to ./data/EM2.csv and ./data/GMW.csv.
//
// What gets anonymized in GMW.csv:
//   - IPAddress, ResponseId
//   - RecipientFirstName / LastName / Email
//   - demo_name, demo_email, resp_email
//   - demo_district_1
//   - demo_school_pub_1, demo_school_priv_1, demo_school_OLD
//   - o{N}_tchr_name for N=1..10
//   - LocationLatitude / LocationLongitude
//   - ExternalReference (blanked)
//   - NCES_District, NCES_School, NCES_School_Private
//   - All o{N}_{i}_comments cells (name-scrub pass against the mappings)
// What gets anonymized in EM2.csv:
//   - school (same mapping as GMW so cross-dataset names stay aligned)
// All rubric scores, grades, modules, dates, percentages, and bands are untouched.
//
// Deterministic: each unique source value maps to a single fake value chosen
// from a static pool by stable hashing - re-running produces identical output.

const fs = require("fs");
const path = require("path");

// ---------- Robust CSV parser (handles quoted fields with embedded newlines) ----------

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

// ---------- Deterministic picker (stable across runs) ----------

function stableHash(s){
  // Simple deterministic 32-bit FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

function pickFromPool(pool, key, taken){
  // Deterministic + collision-free: hash to a starting index, then linear-probe
  // for the next slot not already taken by a different source value.
  const n = pool.length;
  const start = stableHash(key) % n;
  for (let i = 0; i < n; i++){
    const idx = (start + i) % n;
    const candidate = pool[idx];
    if (!taken.has(candidate)) { taken.add(candidate); return candidate; }
  }
  // Pool exhausted - extend with a numeric suffix
  return pool[start] + " " + (taken.size + 1);
}

// ---------- Static pools (no third-party deps) ----------

const OBSERVER_NAMES = [
  "Avery Calderon", "Bianca Reyes", "Caleb Whitfield",
  "Dahlia Okonkwo", "Elena Bishop", "Felix Ng",
  "Greta Holloway", "Hiro Tanaka", "Imani Sutherland",
  "Jude Fernandez", "Kira Vasquez", "Leo Petrov",
  "Mira Castillo", "Naveen Singh", "Olivia Brennan",
  "Priya Rao", "Quinn Bauer", "Rohan Mehta",
  "Sasha Kowalski", "Talia Marchetti", "Uri Steinberg",
  "Vera Lindgren", "Wesley Park", "Xian Liang",
  "Yara Almeida", "Zoe Hartwell", "Adrian Beaumont",
  "Brooke Sandoval", "Cyrus Halliday", "Daphne Eklund",
];

const TEACHER_NAMES = [
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
  "Ezra Whitcomb", "Fernanda Boswell", "Garnet Yoon",
  "Halle Stratton", "Indira Vaccaro", "Jasper Olufsen",
  "Kamila Brody", "Lennon Czajka", "Marisol Hawthorne",
  "Niko Esperanza", "Odette Pellegrino", "Phoebe Castellanos",
  "Quill Ravenscroft", "Reza Whitlock", "Saoirse Penman",
  "Tobin Lockwood", "Una Vasiliev", "Vesper Aldrich",
  "Wendell Olafsdottir", "Xenia Brockman", "Yael Ribeiro",
  "Zeke Hartshorn", "Anders Maldonado", "Briar Fitzhugh",
  "Coralie Strathmore", "Dashiell Verity", "Emery Branton",
  "Fenwick Olajide", "Galena Trembath", "Hollis Quigg",
];

const DISTRICT_POOL = [
  "Maple Ridge Unified", "Pinecrest School District",
  "Cedar Hills USD", "Silverwood Unified",
  "Brookhaven District", "Northfield Unified",
  "Stonebridge USD", "Willowmere School District",
  "Greenleaf Unified", "Highmont District",
];

const SCHOOL_POOL = [
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

const PRIVATE_SCHOOL_POOL = [
  "St. Bartholomew Academy", "Beacon Hill Day School",
  "Ivywood Country Day School", "Magnolia Hall Academy",
  "Stonecroft Friends School", "Lighthouse Christian Academy",
  "Linden Academy", "Mosaic Montessori School",
  "Verdant Springs Academy", "Cathedral Heights School",
];

// Documentation-only IP ranges (RFC 5737) - safe for demos.
const DEMO_IP_PREFIXES = ["192.0.2.", "198.51.100.", "203.0.113."];

// A handful of plausible US lat/long pairs distributed across the country.
// Encoded as "lat|lng" so they slot into the same string-keyed pool plumbing.
const DEMO_LATLONG = [
  "38.9072|-77.0369",  // Washington, DC
  "41.8781|-87.6298",  // Chicago
  "32.7767|-96.7970",  // Dallas
  "39.7392|-104.9903", // Denver
  "47.6062|-122.3321", // Seattle
  "42.3601|-71.0589",  // Boston
  "33.7490|-84.3880",  // Atlanta
  "35.2271|-80.8431",  // Charlotte
  "29.7604|-95.3698",  // Houston
  "44.9778|-93.2650",  // Minneapolis
];

// ---------- Mapping builder ----------

class DomainMapper {
  constructor(pool, formatter = (v) => v){
    this.pool = pool;
    this.formatter = formatter;
    this.taken = new Set();
    this.map = new Map();
  }
  get(value){
    const v = (value == null ? "" : String(value));
    if (!v.trim()) return v;
    const k = v.trim().toLowerCase();
    if (this.map.has(k)) return this.map.get(k);
    const picked = pickFromPool(this.pool, k, this.taken);
    const out = this.formatter(picked);
    this.map.set(k, out);
    return out;
  }
  size(){ return this.map.size; }
  entries(){ return [...this.map.entries()]; }
}

// ---------- Driver ----------

function loadCsv(p){
  if (!fs.existsSync(p)){
    console.error(`[ERROR] Source CSV not found: ${p}`);
    process.exit(1);
  }
  return parseCsv(fs.readFileSync(p, "utf8"));
}

function writeCsv(p, rows){
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, serializeCsv(rows), "utf8");
}

function isQualtricsMetaRow(headers, row){
  // Row 2 (the human-readable header echo) and row 3 (the JSON ImportId row)
  // both have non-PII content - keep as-is.
  const respIdIdx = headers.indexOf("ResponseId");
  if (respIdIdx < 0) return false;
  const v = String(row[respIdIdx] || "").trim();
  if (!v) return false;
  if (v === "Response ID") return true;
  if (v.includes("ImportId")) return true;
  return false;
}

function fullNameKey(first, last){
  return `${(first || "").trim().toLowerCase()}|${(last || "").trim().toLowerCase()}`;
}

function buildOriginalTeacherNameSet(headers, rows){
  const teacherCols = [];
  for (let n = 1; n <= 10; n++) teacherCols.push(`o${n}_tchr_name`);
  const idxs = teacherCols.map(c => headers.indexOf(c)).filter(i => i >= 0);
  const out = new Set();
  for (const row of rows){
    for (const i of idxs){
      const v = (row[i] || "").trim();
      if (v) out.add(v);
    }
  }
  return [...out];
}

function buildObserverNameSet(headers, rows){
  const out = new Set();
  const nameIdx = headers.indexOf("demo_name");
  const rFirst = headers.indexOf("RecipientFirstName");
  const rLast = headers.indexOf("RecipientLastName");
  for (const row of rows){
    if (nameIdx >= 0){
      const v = (row[nameIdx] || "").trim();
      if (v) out.add(v);
    }
    if (rFirst >= 0 && rLast >= 0){
      const f = (row[rFirst] || "").trim();
      const l = (row[rLast] || "").trim();
      if (f || l) out.add(`${f} ${l}`.trim());
    }
  }
  return [...out];
}

// ---------- Main ----------

function main(){
  const srcDir = process.argv[2] || process.cwd();
  const outDir = path.join(process.cwd(), "data");

  const gmwPath = path.join(srcDir, "GMW.csv");
  const em2Path = path.join(srcDir, "EM2.csv");

  console.log(`[anonymize-csvs] reading from: ${srcDir}`);
  console.log(`[anonymize-csvs] writing to:   ${outDir}`);

  const gmwRows = loadCsv(gmwPath);
  const em2Rows = loadCsv(em2Path);

  const gmwHeaders = gmwRows[0];
  const em2Headers = em2Rows[0];

  // Mapper pools - shared school mapping between EM2 and GMW for consistency.
  const schoolMapper = new DomainMapper(SCHOOL_POOL);
  const privateSchoolMapper = new DomainMapper(PRIVATE_SCHOOL_POOL);
  const districtMapper = new DomainMapper(DISTRICT_POOL);
  const observerMapper = new DomainMapper(OBSERVER_NAMES);
  const teacherMapper = new DomainMapper(TEACHER_NAMES);
  const ipMapper = new DomainMapper(
    Array.from({ length: 50 }, (_, i) => {
      const prefix = DEMO_IP_PREFIXES[i % DEMO_IP_PREFIXES.length];
      return prefix + ((i * 7) % 240 + 1);
    })
  );
  const latlongMapper = new DomainMapper(DEMO_LATLONG); // formatted on read
  const ncesDistrictMapper = new DomainMapper(
    Array.from({ length: 30 }, (_, i) => String(900000 + i * 137).padStart(6, "0"))
  );
  const ncesSchoolMapper = new DomainMapper(
    Array.from({ length: 60 }, (_, i) => String(900000000000 + i * 31337).padStart(12, "0"))
  );
  const ncesSchoolPrivateMapper = new DomainMapper(
    Array.from({ length: 30 }, (_, i) => "A" + String(9000000000 + i * 71).padStart(10, "0"))
  );
  const responseIdMapper = new DomainMapper(
    Array.from({ length: 200 }, (_, i) => {
      // Qualtrics-shaped: "R_" + 15-char base62-ish, derived deterministically
      const alpha = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let h = stableHash("R_" + i);
      let s = "";
      for (let k = 0; k < 15; k++){
        h = (h * 1103515245 + 12345) >>> 0;
        s += alpha[h % alpha.length];
      }
      return "R_" + s;
    })
  );

  // First pass over GMW data rows: build originals lists so we can scrub
  // comment bodies in the same single forward pass.
  const gmwDataRows = gmwRows.slice(1).filter(r => !isQualtricsMetaRow(gmwHeaders, r));

  // Pre-build name maps so we can name-scrub comment text.
  const originalTeacherNames = buildOriginalTeacherNameSet(gmwHeaders, gmwDataRows);
  for (const t of originalTeacherNames) teacherMapper.get(t);

  const originalObserverNames = buildObserverNameSet(gmwHeaders, gmwDataRows);
  for (const o of originalObserverNames) observerMapper.get(o);

  // Build name-scrub rules for comment bodies: regex per original first/last word.
  // We split observer/teacher names on whitespace to catch first OR last name
  // mentions inside comments.
  const nameTokenReplacements = []; // {regex, replacement}

  function addNameTokens(originalFull, fakeFull){
    const oTokens = originalFull.split(/\s+/).filter(t => t.length >= 3);
    const fTokens = fakeFull.split(/\s+/);
    if (!oTokens.length || !fTokens.length) return;
    // Map each original token to the fake token at the same position when possible;
    // otherwise fall back to the first fake token.
    for (let i = 0; i < oTokens.length; i++){
      const oTok = oTokens[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fTok = fTokens[Math.min(i, fTokens.length - 1)];
      // Word-boundary, case-insensitive replacement.
      nameTokenReplacements.push({
        regex: new RegExp(`\\b${oTok}\\b`, "gi"),
        replacement: fTok,
      });
    }
  }

  for (const [origLower, fake] of teacherMapper.entries()){
    // origLower is lowercased; recover original casing by re-finding in dataset list
    const original = originalTeacherNames.find(n => n.trim().toLowerCase() === origLower) || origLower;
    addNameTokens(original, fake);
  }
  for (const [origLower, fake] of observerMapper.entries()){
    const original = originalObserverNames.find(n => n.trim().toLowerCase() === origLower) || origLower;
    addNameTokens(original, fake);
  }

  // ---------- Transform GMW rows ----------

  // Helpers to read header indices
  const gIdx = (name) => gmwHeaders.indexOf(name);

  const idx = {
    ip: gIdx("IPAddress"),
    rid: gIdx("ResponseId"),
    rLast: gIdx("RecipientLastName"),
    rFirst: gIdx("RecipientFirstName"),
    rEmail: gIdx("RecipientEmail"),
    extRef: gIdx("ExternalReference"),
    lat: gIdx("LocationLatitude"),
    lng: gIdx("LocationLongitude"),
    demoName: gIdx("demo_name"),
    demoEmail: gIdx("demo_email"),
    demoDistrict: gIdx("demo_district_1"),
    demoSchoolPub: gIdx("demo_school_pub_1"),
    demoSchoolPriv: gIdx("demo_school_priv_1"),
    demoSchoolOld: gIdx("demo_school_OLD"),
    respEmail: gIdx("resp_email"),
    ncesDistrict: gIdx("NCES_District"),
    ncesSchool: gIdx("NCES_School"),
    ncesSchoolPriv: gIdx("NCES_School_Private"),
  };

  const teacherCols = [];
  for (let n = 1; n <= 10; n++) teacherCols.push(gIdx(`o${n}_tchr_name`));

  // Comment column indices (the 80 *_comments cells).
  const commentCols = [];
  for (let n = 1; n <= 10; n++){
    for (let k = 1; k <= 8; k++){
      // Note: header has a typo "09_6_comments" - handle as a fallback.
      let i = gIdx(`o${n}_${k}_comments`);
      if (i < 0 && n === 9 && k === 6) i = gIdx(`09_6_comments`);
      if (i >= 0) commentCols.push(i);
    }
  }

  function fakeEmailFor(fakeFullName){
    const parts = String(fakeFullName).trim().split(/\s+/);
    const first = (parts[0] || "user").toLowerCase().replace(/[^a-z]/g, "");
    const last = (parts.slice(1).join("") || "demo").toLowerCase().replace(/[^a-z]/g, "");
    return `${first}.${last}@example.edu`;
  }

  function scrubComment(text){
    let s = String(text || "");
    if (!s) return s;
    for (const { regex, replacement } of nameTokenReplacements){
      s = s.replace(regex, replacement);
    }
    return s;
  }

  // Transform every GMW row (data rows only - meta rows pass through unchanged).
  const newGmwRows = gmwRows.map((row, rIdx) => {
    if (rIdx === 0) return row; // header
    if (isQualtricsMetaRow(gmwHeaders, row)) return row;

    const r = row.slice();

    if (idx.ip >= 0 && r[idx.ip]) r[idx.ip] = ipMapper.get(r[idx.ip]);
    if (idx.rid >= 0 && r[idx.rid]) r[idx.rid] = responseIdMapper.get(r[idx.rid]);

    // Recipient name + email (often empty in this dataset, but handle for completeness).
    if (idx.rFirst >= 0 || idx.rLast >= 0){
      const origFirst = idx.rFirst >= 0 ? r[idx.rFirst] : "";
      const origLast = idx.rLast >= 0 ? r[idx.rLast] : "";
      if ((origFirst || "").trim() || (origLast || "").trim()){
        const key = fullNameKey(origFirst, origLast);
        const fake = observerMapper.get(`${origFirst} ${origLast}`.trim());
        const [ff, fl] = String(fake).split(/\s+/);
        if (idx.rFirst >= 0) r[idx.rFirst] = ff || "";
        if (idx.rLast >= 0) r[idx.rLast] = fl || "";
        if (idx.rEmail >= 0 && r[idx.rEmail]) r[idx.rEmail] = fakeEmailFor(fake);
      }
    }

    if (idx.extRef >= 0 && r[idx.extRef]) r[idx.extRef] = "";

    if (idx.lat >= 0 && idx.lng >= 0 && (r[idx.lat] || r[idx.lng])){
      const pairKey = `${r[idx.lat]},${r[idx.lng]}`;
      const fake = latlongMapper.get(pairKey);
      if (typeof fake === "string" && fake.includes("|")){
        const [fLat, fLng] = fake.split("|");
        r[idx.lat] = fLat;
        r[idx.lng] = fLng;
      }
    }

    if (idx.demoName >= 0 && r[idx.demoName]){
      const fake = observerMapper.get(r[idx.demoName]);
      r[idx.demoName] = fake;
      if (idx.demoEmail >= 0 && r[idx.demoEmail]) r[idx.demoEmail] = fakeEmailFor(fake);
    }
    if (idx.respEmail >= 0 && r[idx.respEmail]){
      // The originating observer's email - reuse the demo_name mapping if available
      // for this row; otherwise generate a new pseudonymous email.
      const demoFake = idx.demoName >= 0 ? r[idx.demoName] : "";
      r[idx.respEmail] = demoFake ? fakeEmailFor(demoFake) : "observer@example.edu";
    }

    if (idx.demoDistrict >= 0 && r[idx.demoDistrict]) r[idx.demoDistrict] = districtMapper.get(r[idx.demoDistrict]);
    if (idx.demoSchoolPub >= 0 && r[idx.demoSchoolPub]) r[idx.demoSchoolPub] = schoolMapper.get(r[idx.demoSchoolPub]);
    if (idx.demoSchoolPriv >= 0 && r[idx.demoSchoolPriv]) r[idx.demoSchoolPriv] = privateSchoolMapper.get(r[idx.demoSchoolPriv]);
    if (idx.demoSchoolOld >= 0 && r[idx.demoSchoolOld]) r[idx.demoSchoolOld] = schoolMapper.get(r[idx.demoSchoolOld]);

    if (idx.ncesDistrict >= 0 && r[idx.ncesDistrict]) r[idx.ncesDistrict] = ncesDistrictMapper.get(r[idx.ncesDistrict]);
    if (idx.ncesSchool >= 0 && r[idx.ncesSchool]) r[idx.ncesSchool] = ncesSchoolMapper.get(r[idx.ncesSchool]);
    if (idx.ncesSchoolPriv >= 0 && r[idx.ncesSchoolPriv]) r[idx.ncesSchoolPriv] = ncesSchoolPrivateMapper.get(r[idx.ncesSchoolPriv]);

    for (const tIdx of teacherCols){
      if (tIdx >= 0 && r[tIdx]) r[tIdx] = teacherMapper.get(r[tIdx]);
    }

    // Comment scrub: replace any first/last name token mentions in comment text.
    for (const cIdx of commentCols){
      if (cIdx >= 0 && r[cIdx]) r[cIdx] = scrubComment(r[cIdx]);
    }

    return r;
  });

  // ---------- Transform EM2 rows ----------

  const em2SchoolIdx = em2Headers.indexOf("school");
  const newEm2Rows = em2Rows.map((row, rIdx) => {
    if (rIdx === 0) return row;
    const r = row.slice();
    if (em2SchoolIdx >= 0 && r[em2SchoolIdx]) r[em2SchoolIdx] = schoolMapper.get(r[em2SchoolIdx]);
    return r;
  });

  // ---------- Write outputs ----------

  writeCsv(path.join(outDir, "GMW.csv"), newGmwRows);
  writeCsv(path.join(outDir, "EM2.csv"), newEm2Rows);

  // ---------- Audit summary ----------

  console.log("");
  console.log("[anonymize-csvs] done.");
  console.log(`  Observers replaced:    ${observerMapper.size()}`);
  console.log(`  Teachers replaced:     ${teacherMapper.size()}`);
  console.log(`  Districts replaced:    ${districtMapper.size()}`);
  console.log(`  Public schools:        ${schoolMapper.size()}`);
  console.log(`  Private schools:       ${privateSchoolMapper.size()}`);
  console.log(`  IPs replaced:          ${ipMapper.size()}`);
  console.log(`  Lat/long pairs:        ${latlongMapper.size()}`);
  console.log(`  NCES districts:        ${ncesDistrictMapper.size()}`);
  console.log(`  NCES schools:          ${ncesSchoolMapper.size()}`);
  console.log(`  Response IDs:          ${responseIdMapper.size()}`);
  console.log(`  Comment scrub rules:   ${nameTokenReplacements.length}`);
  console.log("");
  console.log(`  Wrote: ${path.join(outDir, "GMW.csv")} (${newGmwRows.length} rows)`);
  console.log(`  Wrote: ${path.join(outDir, "EM2.csv")} (${newEm2Rows.length} rows)`);
}

main();
