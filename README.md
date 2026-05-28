# AIMS Visualizer

[![Version](https://badgen.net/badge/version/v1.2.1/blue)](#)
[![Chart.js](https://badgen.net/badge/Chart.js/4.4.1/blue)](https://www.chartjs.org/)
[![PapaParse](https://badgen.net/badge/PapaParse/5.4.1/green)](https://www.papaparse.com/)
[![Firebase](https://badgen.net/badge/Firebase/12.0.0/orange)](https://firebase.google.com/)
[![Node.js](https://badgen.net/badge/Node.js/18+/green)](https://nodejs.org/)
[![PHP](https://badgen.net/badge/PHP/7.4+/purple)](https://www.php.net/)
[![License](https://badgen.net/badge/license/MIT/blue)](LICENSE)

https://github.com/user-attachments/assets/fd5693fa-2c3b-4813-814c-e92660e34aa6

A premium browser-based analysis workspace for two kinds of education data:

- **EM2**: student assessment performance (scores, percentages, performance bands).
- **GMW**: Great Minds Walkthrough classroom observations (8-dimension rubric across 4 categories).

Load a CSV, filter by school / grade / curriculum / date, and watch every chart, insight card, and KPI recompute together. Save snapshots to a local dashboard, share an exact view through a short link, and generate AI-written summaries on demand.

---

## ⚠️ IMPORTANT: Setting up keys (read before first run)

This repository ships with **all API keys redacted** as placeholders. The app will load, but the Quickshare and AI Summary features will not work until you fill them in.

You must set the following values before deploying the tool:

### 1. Firebase config in `visualizer.js` (top of file, ~line 6)

```js
const firebaseConfig = {
  apiKey:     "REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_FIREBASE_AUTH_DOMAIN",
  projectId:  "REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID",
};
```

Create a Firebase project at <https://console.firebase.google.com/>, enable **Firestore** in production mode, and paste the project's web SDK config above. Then add security rules that allow reads/writes to the `quickshare/{code}` document path used by the app. Anything stricter will break short-link generation.

**Why this key is safe in the browser.** The Firebase web SDK config behaves like a **public identifier**. Think of it as the public half of a keypair: it tells the SDK *which* Firebase project to talk to, but it grants no access on its own. Every read or write still has to clear the **private security rules** you configure inside Firebase, which never leave Google's servers. Firebase is designed to expect this config in client-side JS; bundling it into the browser is the documented pattern. Access control belongs in Firestore security rules.

### 2. OpenAI API key: server-side by default (recommended for production)

The OpenAI key lives **server-side** in PHP. The browser never sees it.

1. Get a key at <https://platform.openai.com/api-keys>.
2. Set `OPENAI_API_KEY` as an environment variable on the host running PHP:
   - **Apache:** `SetEnv OPENAI_API_KEY sk-...` in your vhost or `.htaccess`.
   - **nginx + php-fpm:** `fastcgi_param OPENAI_API_KEY sk-...;` in your `location ~ \.php$` block.
   - **Shared hosting / cPanel / Plesk:** add the env var via the host's UI.
3. Leave `DEV_ALLOW_CLIENT_KEY = false` in [`openai_proxy.php`](openai_proxy.php) (the default).
4. Leave `const OPENAI_API_KEY = "";` blank in [`visualizer.js`](visualizer.js) (~line 651).

In this configuration the browser sends only the prompt text; PHP reads the key from its environment and calls OpenAI. If neither the environment variable nor the dev mode below is configured, the proxy returns `500 "Server-side OPENAI_API_KEY not configured"`.

#### Dev mode: local testing only

If you can't easily set environment variables on your local machine, opt into the client-side pattern instead. **Do not deploy this configuration.**

1. In [`openai_proxy.php`](openai_proxy.php) set `DEV_ALLOW_CLIENT_KEY = true`.
2. In [`visualizer.js`](visualizer.js) paste a test key into `const OPENAI_API_KEY = "...";`.

**Warnings:**
- The key will be visible in the browser's devtools (Sources, Network), to anyone who views the page source, and to anyone who receives a quickshare link generated while the key was loaded.
- Never commit a real key to git. If you do, [revoke it immediately](https://platform.openai.com/api-keys) and rotate.
- Use a test key with a low spend cap.
- Revert both flags before pushing the proxy to any non-local host.

### 3. Proxy URL in `visualizer.js` (~line 648)

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

The bundled demo CSVs at [`data/EM2.csv`](data/EM2.csv) and [`data/GMW.csv`](data/GMW.csv) auto-load on first visit. No upload required.

---

## What it does

### 1. Overview tab: the analysis workspace
<img width="2535" height="1227" alt="overview" src="https://github.com/user-attachments/assets/38124056-785b-4834-8ebf-4918e4f2fd86" />

Drop in an **EM2** or **GMW** CSV. Format detection is automatic. Qualtrics meta-rows are stripped, GMW wide-format sheets are reshaped row-by-row into long format. Then filter:

- Four primary multi-selects (School, Grade, Type/Curriculum, Band/Module) plus a date range.
- GMW adds 7 contextual filters (observer, role, district, etc.).
- `Ctrl` / `⌘` + click = multi-select. `Shift` + click = select a range.
- Insight cards call out the largest drop, the most consistent school, the largest gain, etc.

Charts: [![Chart.js](https://badgen.net/badge/Chart.js/4.4.1/blue)](https://www.chartjs.org/) renders the radar (GMW 8 dimensions), the stacked % band chart (EM2 performance bands or GMW Emerging/Developing/Achieving), and the school × grade averages.

CSV parsing: [![PapaParse](https://badgen.net/badge/PapaParse/5.4.1/green)](https://www.papaparse.com/) handles the upload pipeline including quoted fields with embedded newlines.

### 2. Save to Dashboard
<img width="2525" height="1030" alt="dashboard" src="https://github.com/user-attachments/assets/2f9b91b4-ea87-4ca4-951e-ac4b0d8f9b57" />

Snapshot the current charts into the **Dashboard** panel and give it a name (e.g. *"Spring Benchmark: Grade 4 Focus"*). Snapshots are kept in `localStorage`, so they're private and instant. The Dashboard tab opens any snapshot, or `Ctrl`/`⌘`-click multiple to view side by side.

### 3. Quickshare & QS Link
Copy a short link that encodes your exact view: filters, active tab, date window, GMW extra filters, even the AI-summary text. Recipients open the link and land on the same scene, recomputed from their CSV copy.

[![Firebase](https://badgen.net/badge/Firebase/12.0.0/orange)](https://firebase.google.com/) Firestore stores the short codes (e.g. `?qs=A7F2K9Q`) so the URL stays tiny.

### 4. AI Summary
Turn the auto-detected insight cards into a concise narrative for memos and stakeholder briefs. Generated on demand via a thin PHP proxy at [`openai_proxy.php`](openai_proxy.php). No local model needed. The summary text travels with quickshare links so the recipient reads the same writeup. The OpenAI key lives server-side. See [Setting up keys](#️-important-setting-up-keys-read-before-first-run) above.

### 5. Oracle Mode (trend forecasting)
<img width="2525" height="1222" alt="oracle" src="https://github.com/user-attachments/assets/3336e80d-5aa6-4f0a-a3dc-04977dbf10a6" />

Project where each school × grade is heading by fitting a regression slope per bucket. Insight cards call out the **steepest rise**, **sharpest drop**, and **most stable** entity. Re-rank live whenever filters change.

### 6. Teacher Stats: game-style profiles
<img width="2522" height="1222" alt="teacher stats" src="https://github.com/user-attachments/assets/b6ef7c63-aace-4a88-9749-fa1f30f1cbc1" />

A character-select screen for teachers in the GMW dataset:

- Each teacher card shows initials, school, grade, observation count, and a **Level badge** (10–30) derived from their overall rubric average.
- Click a card to reveal a full stat sheet: a radar of all 8 dimensions, HP/MP-style gradient bars (orange = Emerging, amber = Developing, blue = Achieving), and a pulsing **Power Level orb** with their composite score.
- Multi-select via Messenger-style chips to overlay multiple teachers on the radar; a gold dashed line shows their averaged profile.
- Every observation comment is filed into 8 collapsible **Coaching Notes** sections (one per rubric dimension) with observer, date, and the score that day.

<img width="2546" height="1436" alt="dimensions" src="https://github.com/user-attachments/assets/6a316b75-eadb-494e-9f96-003a24e6ab97" />


---

## The rubric

GMW captures classroom data across **eight dimensions** grouped into **four categories**. Hover any dimension label in the dashboard (radar axes, bar segments, mini-bars, stat-bar labels, accordion headers) to see the full definition in a tooltip.
<img width="2210" height="645" alt="rubric" src="https://github.com/user-attachments/assets/8467961b-28dc-4a6b-8f63-a4f8807bcea7" />


| Category | Dimensions |
|---|---|
| **Curriculum Use** | Lesson Component Facilitation · Pedagogical Elements |
| **Student-Centered Instruction** | Cognitive Lift · Discourse |
| **Gathering and Using Evidence** | Collecting Evidence · Responding and Feedback |
| **Student Engagement** | Collaborative Engagement · Independent Engagement |

The full definitions live in [`visualizer.js`](visualizer.js) on the `GMW_DIMENSIONS` constant and are mirrored as docs cards in the Docs tab of the app.

---

## Demo data

The repo ships with **fully synthetic** EM2 and GMW demo data at [`data/`](data/). Every value (schools, districts, teacher and observer names, dates, IPs, lat/long, NCES IDs, rubric scores, **and the 80 free-text observation comments per GMW row**) is fabricated from static pools and templated phrases in [`scripts/generate-demo-csvs.js`](scripts/generate-demo-csvs.js). No real student, teacher, school, or comment data was used as input. Safe to share publicly.

To regenerate the demo CSVs:

```bash
node scripts/generate-demo-csvs.js
```

[![Node.js](https://badgen.net/badge/Node.js/18+/green)](https://nodejs.org/) Dependency-free. No `npm install` needed. The script preserves the existing column schema in [`data/EM2.csv`](data/EM2.csv) and [`data/GMW.csv`](data/GMW.csv) (including the Qualtrics meta rows in GMW) and overwrites every data row. A fixed PRNG seed makes the output deterministic across runs. Schools are assigned tiered baselines plus per-school trend arcs (improving / declining / flat / sawtooth) so insight cards and Oracle Mode have real signal to find. Each teacher gets one of ten distinct rubric archetypes (Achiever, Discourse Champion, Curriculum-Faithful, Spiky, Emerging, Struggling, and more), so the radar charts, Power Level rankings, and Coaching Notes show visually striking differences across the roster.

### Anonymizing your own real data (separate workflow)

If you have real EM2/GMW source files you want to load locally (e.g., to test the app against your own district's data), [`scripts/anonymize-csvs.js`](scripts/anonymize-csvs.js) is a separate tool that builds deterministic identifier mappings and runs a name-scrub pass over comment cells:

```bash
node scripts/anonymize-csvs.js [path-to-source-dir]
```

This anonymizes `IPAddress`, `ResponseId`, recipient/observer/teacher names, emails, districts, public/private school names, NCES IDs, lat/long, and runs a regex scrub over the 80 `o{N}_{i}_comments` cells.

> **Caveat: comments.** The anonymizer's comment scrub only replaces *name tokens it knows about*. Free-text comments can still contain student names, classroom anecdotes, or context the scrub won't catch. Anonymized real comments are **not** safe to publish or commit. The shipped demo data in [`data/`](data/) deliberately does not use this script's output. It uses fully synthetic comments instead.

---

## File layout

```
.
├── index.html                  # Single-page UI (Overview, Docs, Dashboard, Teacher Stats tabs)
├── visualizer.js               # All app logic - filtering, charts, dashboard, quickshare, AI, Teacher Stats
├── visualizer.css              # Design system + every CSS animation in the docs-card diagrams
├── openai_proxy.php            # Minimal POST proxy that forwards prompts to the OpenAI API
├── data/
│   ├── EM2.csv                 # Fully synthetic EM2 demo (assessment performance)
│   └── GMW.csv                 # Fully synthetic GMW demo (Great Minds Walkthrough observations)
├── scripts/
│   ├── generate-demo-csvs.js   # Synthetic demo-data generator (Node.js, no deps)
│   └── anonymize-csvs.js       # Optional anonymizer for local use against real data
├── openai_test.html            # Standalone smoke test for the OpenAI proxy
└── openai_test.js
```

---

## Browser & runtime support

- **Browsers**: any modern evergreen browser (Chrome, Edge, Firefox, Safari). Uses ES modules and CSS custom properties.
- **AI Summary**: requires the PHP proxy to be reachable. [![PHP](https://badgen.net/badge/PHP/7.4+/purple)](https://www.php.net/). See [Setting up keys](#️-important-setting-up-keys-read-before-first-run) for the server-side / dev-mode options.
- **Demo-data generator / anonymizer**: [![Node.js](https://badgen.net/badge/Node.js/18+/green)](https://nodejs.org/) tested on 18+. No `package.json` required.

---

## Keyboard & accessibility

- `Ctrl` / `⌘` + click in any multi-select = add to selection.
- `Shift` + click in a multi-select = range select.
- Dimension tooltips appear on `:hover`, `:focus`, and `:focus-within`, so keyboard users can `Tab` to a stat-bar label or accordion header and read the rubric definition without a pointer device.

---

## License

Released under the [MIT License](LICENSE). © 2026
