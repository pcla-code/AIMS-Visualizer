# AIMS Visualizer

[![Version](https://badgen.net/badge/version/v1.2.1/blue)](#)
[![Chart.js](https://badgen.net/badge/Chart.js/4.4.1/blue)](https://www.chartjs.org/)
[![PapaParse](https://badgen.net/badge/PapaParse/5.4.1/green)](https://www.papaparse.com/)
[![Firebase](https://badgen.net/badge/Firebase/12.0.0/orange)](https://firebase.google.com/)
[![Node.js](https://badgen.net/badge/Node.js/18+/green)](https://nodejs.org/)
[![PHP](https://badgen.net/badge/PHP/7.4+/purple)](https://www.php.net/)
[![License](https://badgen.net/badge/license/private/grey)](#)

A premium browser-based analysis workspace for two kinds of education data:

- **EM2** — student assessment performance (scores, percentages, performance bands).
- **GMW** — Great Minds Walkthrough classroom observations (8-dimension rubric across 4 categories).

Load a CSV, filter by school / grade / curriculum / date, and watch every chart, insight card, and KPI recompute together. Save snapshots to a local dashboard, share an exact view through a short link, and generate AI-written summaries on demand.

---

## ⚠️ IMPORTANT — Setting up keys (read before first run)

This repository ships with **all API keys redacted** as placeholders. The app will load, but the Quickshare and AI Summary features will not work until you fill them in.

You must set the following values before deploying the tool:

### 1. Firebase config — `visualizer.js` (top of file, ~line 6)

```js
const firebaseConfig = {
  apiKey:     "REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_FIREBASE_AUTH_DOMAIN",
  projectId:  "REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID",
};
```

Create a Firebase project at <https://console.firebase.google.com/>, enable **Firestore** in production mode, and paste the project's web SDK config above. Then add security rules that allow reads/writes to the `quickshare/{code}` document path used by the app — anything stricter will break short-link generation.

### 2. OpenAI API key — `visualizer.js` (~line 656) and `openai_test.js` (line 2)

```js
const OPENAI_API_KEY = "REPLACE_WITH_YOUR_OPENAI_API_KEY";
```

Get a key at <https://platform.openai.com/api-keys>. **Recommended**: leave this placeholder in the client and instead hardcode the key server-side inside [`openai_proxy.php`](openai_proxy.php) so the key never ships to the browser. To do that:

1. In `openai_proxy.php`, replace the line `$apiKey = $body["apiKey"] ?? "";` with `$apiKey = getenv("OPENAI_API_KEY");` (and set `OPENAI_API_KEY` in the host's environment).
2. In `visualizer.js` set `const OPENAI_API_KEY = "";` and remove `apiKey: OPENAI_API_KEY` from the three `fetch(OPENAI_PROXY_URL, ...)` payloads.

**Never commit a real key to git.** If you do, [revoke it immediately](https://platform.openai.com/api-keys) and rotate.

### 3. Proxy URL — `visualizer.js` (~line 652)

```js
const OPENAI_PROXY_URL = "/aims/openai_proxy.php";
```

Change this if you host the PHP proxy at a different path or on a different origin.

---

## Quick start

```bash
# Clone the repo, then either:
# 1) Open index.html directly in a browser (works for everything except
#    the AI Summary feature, which needs the PHP proxy).
# 2) Serve the folder over any static HTTP server, e.g.:
npx http-server .          # then visit http://localhost:8080
```

The bundled demo CSVs at [`data/EM2.csv`](data/EM2.csv) and [`data/GMW.csv`](data/GMW.csv) auto-load on first visit — no upload required.

---

## What it does

### 1. Overview tab — the analysis workspace
Drop in an **EM2** or **GMW** CSV. Format detection is automatic. Qualtrics meta-rows are stripped, GMW wide-format sheets are reshaped row-by-row into long format. Then filter:

- Four primary multi-selects (School, Grade, Type/Curriculum, Band/Module) plus a date range.
- GMW adds 7 contextual filters (observer, role, district, etc.).
- `Ctrl` / `⌘` + click = multi-select. `Shift` + click = select a range.
- Insight cards call out the largest drop, the most consistent school, the largest gain, etc.

Charts: [![Chart.js](https://badgen.net/badge/Chart.js/4.4.1/blue)](https://www.chartjs.org/) renders the radar (GMW 8 dimensions), the stacked % band chart (EM2 performance bands or GMW Emerging/Developing/Achieving), and the school × grade averages.

CSV parsing: [![PapaParse](https://badgen.net/badge/PapaParse/5.4.1/green)](https://www.papaparse.com/) handles the upload pipeline including quoted fields with embedded newlines.

### 2. Save to Dashboard
Snapshot the current charts into the **Dashboard** panel and give it a name (e.g. *"Spring Benchmark — Grade 4 Focus"*). Snapshots are kept in `localStorage`, so they're private and instant. The Dashboard tab opens any snapshot, or `Ctrl`/`⌘`-click multiple to view side by side.

### 3. Quickshare & QS Link
Copy a short link that encodes your exact view — filters, active tab, date window, GMW extra filters, even the AI-summary text. Recipients open the link and land on the same scene, recomputed from their CSV copy.

[![Firebase](https://badgen.net/badge/Firebase/12.0.0/orange)](https://firebase.google.com/) Firestore stores the short codes (e.g. `?qs=A7F2K9Q`) so the URL stays tiny.

### 4. AI Summary
Turn the auto-detected insight cards into a concise narrative for memos and stakeholder briefs. Generated on demand via a thin PHP proxy at [`openai_proxy.php`](openai_proxy.php) — no local model needed. The summary text travels with quickshare links so the recipient reads the same writeup.

### 5. Oracle Mode (trend forecasting)
Project where each school × grade is heading by fitting a regression slope per bucket. Insight cards call out the **steepest rise**, **sharpest drop**, and **most stable** entity. Re-rank live whenever filters change.

### 6. Teacher Stats — game-style profiles
A character-select screen for teachers in the GMW dataset:

- Each teacher card shows initials, school, grade, observation count, and a **Level badge** (10–30) derived from their overall rubric average.
- Click a card to reveal a full stat sheet: a radar of all 8 dimensions, HP/MP-style gradient bars (orange = Emerging, amber = Developing, blue = Achieving), and a pulsing **Power Level orb** with their composite score.
- Multi-select via Messenger-style chips to overlay multiple teachers on the radar; a gold dashed line shows their averaged profile.
- Every observation comment is filed into 8 collapsible **Coaching Notes** sections — one per rubric dimension — with observer, date, and the score that day.

---

## The rubric

GMW captures classroom data across **eight dimensions** grouped into **four categories**. Hover any dimension label in the dashboard (radar axes, bar segments, mini-bars, stat-bar labels, accordion headers) to see the full definition in a tooltip.

| Category | Dimensions |
|---|---|
| **Curriculum Use** | Lesson Component Facilitation · Pedagogical Elements |
| **Student-Centered Instruction** | Cognitive Lift · Discourse |
| **Gathering and Using Evidence** | Collecting Evidence · Responding and Feedback |
| **Student Engagement** | Collaborative Engagement · Independent Engagement |

The full definitions live in [`visualizer.js`](visualizer.js) on the `GMW_DIMENSIONS` constant and are mirrored as docs cards in the Docs tab of the app.

---

## Demo data

The repo ships with **anonymized** EM2 and GMW data at [`data/`](data/) so the app works out of the box without any real names or institutions.

To regenerate the demo CSVs from a real source (e.g., after the source CSV is updated):

```bash
node scripts/anonymize-csvs.js [path-to-source-dir]
```

[![Node.js](https://badgen.net/badge/Node.js/18+/green)](https://nodejs.org/) The script ([`scripts/anonymize-csvs.js`](scripts/anonymize-csvs.js)) is dependency-free — no `npm install` needed. It builds deterministic mappings per identifier domain (teachers, observers, schools, districts, NCES IDs, IPs, emails, lat/long) and scrubs first/last name mentions inside observation comment text. Rubric scores, dates, grades, modules, percentages, and performance bands are untouched. Re-running against the same source produces byte-identical output.

**What gets anonymized:**

- GMW: `IPAddress`, `ResponseId`, `RecipientFirstName/LastName/Email`, `demo_name`, `demo_email`, `resp_email`, `demo_district_1`, `demo_school_pub_1`, `demo_school_priv_1`, `demo_school_OLD`, `o{1..10}_tchr_name`, `LocationLatitude/Longitude`, `ExternalReference`, `NCES_District`, `NCES_School`, `NCES_School_Private`, and the 80 `o{N}_{i}_comments` cells.
- EM2: `school` (mapped through the same school pool as GMW so cross-dataset names stay aligned).

---

## File layout

```
.
├── index.html                  # Single-page UI (Overview, Docs, Dashboard, Teacher Stats tabs)
├── visualizer.js               # All app logic - filtering, charts, dashboard, quickshare, AI, Teacher Stats
├── visualizer.css              # Design system + every CSS animation in the docs-card diagrams
├── openai_proxy.php            # Minimal POST proxy that forwards prompts to the OpenAI API
├── data/
│   ├── EM2.csv                 # Anonymized EM2 demo (assessment performance)
│   └── GMW.csv                 # Anonymized GMW demo (Great Minds Walkthrough observations)
├── scripts/
│   └── anonymize-csvs.js       # Deterministic anonymizer (Node.js, no deps)
├── openai_test.html            # Standalone smoke test for the OpenAI proxy
└── openai_test.js
```

---

## Browser & runtime support

- **Browsers**: any modern evergreen browser (Chrome, Edge, Firefox, Safari). Uses ES modules and CSS custom properties.
- **AI Summary**: requires the PHP proxy to be reachable. [![PHP](https://badgen.net/badge/PHP/7.4+/purple)](https://www.php.net/) — set `OPENAI_API_KEY` in the proxy host's environment, lock the endpoint down for production.
- **Anonymizer**: [![Node.js](https://badgen.net/badge/Node.js/18+/green)](https://nodejs.org/) tested on 18+. No `package.json` required.

---

## Keyboard & accessibility

- `Ctrl` / `⌘` + click in any multi-select = add to selection.
- `Shift` + click in a multi-select = range select.
- Dimension tooltips appear on `:hover`, `:focus`, and `:focus-within`, so keyboard users can `Tab` to a stat-bar label or accordion header and read the rubric definition without a pointer device.

---

## License

Private project — all rights reserved by the AIMS team.
