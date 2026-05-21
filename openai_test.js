// IMPORTANT: replace this placeholder with your own OpenAI API key before
// running the smoke test. See README.md -> "Setting up keys".
// Never commit a real key back to the repo - rotate it immediately if you do.
const OPENAI_API_KEY = "REPLACE_WITH_YOUR_OPENAI_API_KEY";

// If your project uses a proxy / different base URL later, change this.
const OPENAI_URL = "/aims/openai_proxy.php";

const $ = (s) => document.querySelector(s);

function linesFromTextarea(v){
  return String(v || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
}

function buildPrompt(lines){
  // Strong “don’t just list back” instruction + output shape.
  const bullets = lines.map(l => `- ${l}`).join("\n");

  return `
You are writing a brief, publication-ready executive summary of assessment findings.

STRICT RULES:
- Use ONLY the information in the FINDINGS.
- Paraphrase. Do NOT repeat the FINDINGS verbatim.
- Do NOT list the findings one-by-one.
- Do NOT invent causes, dates, locations, or background context.
- Keep it clear, professional, and concise.

FINDINGS:
${bullets}

Write EXACTLY this structure:

PARAGRAPH_1:
<2–3 sentences describing the overall story>

PARAGRAPH_2:
<2–3 sentences highlighting key changes and what it implies to verify next>

NEXT_CHECKS:
- <check 1>
- <check 2>
`.trim();
}

function extractText(respJson){
  // Responses API: prefer output_text, otherwise try common shapes
  if (respJson?.output_text) return respJson.output_text;
  // Fallback: scan for any text fields
  try {
    const out = respJson?.output || [];
    for (const item of out){
      const content = item?.content || [];
      for (const c of content){
        if (c?.type === "output_text" && c?.text) return c.text;
      }
    }
  } catch {}
  return "";
}

function looksLikeJustBullets(out, inputLines){
  const o = String(out || "").toLowerCase();
  let hits = 0;
  for (const l of inputLines){
    const chunk = l.toLowerCase().slice(0, 40);
    if (chunk.length >= 18 && o.includes(chunk)) hits++;
  }
  return hits >= 2; // too much verbatim reuse
}

async function summarize(){
  const btn = $("#btn");
  const status = $("#status");
  const out = $("#out");

  const lines = linesFromTextarea($("#input").value);
  if (!lines.length){
    out.textContent = "Please paste at least 2–3 insight lines.";
    return;
  }

  btn.disabled = true;
  status.textContent = "Calling OpenAI…";
  out.textContent = "Working…";

  try {
    const prompt = buildPrompt(lines);

		const r = await fetch(OPENAI_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				apiKey: OPENAI_API_KEY,
				text: prompt
			}),
		});

    const data = await r.json();

    if (!r.ok){
      out.textContent =
        `HTTP ${r.status}\n` +
        (data?.error?.message ? data.error.message : JSON.stringify(data, null, 2));
      status.textContent = "Error.";
      return;
    }

    const text = (extractText(data) || "").trim();

    // If it "summarizes" by just echoing the bullets, do a tighter retry once.
    if (!text || looksLikeJustBullets(text, lines)){
      status.textContent = "Retrying with stricter paraphrase…";
      const stricter = prompt + "\n\nIMPORTANT: If you copy any phrase longer than 6 words from FINDINGS, you FAIL.";
      const r2 = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: stricter,
          temperature: 0.1,
          max_output_tokens: 280,
        }),
      });
      const d2 = await r2.json();
      if (r2.ok){
        const t2 = (extractText(d2) || "").trim();
        out.textContent = t2 || text || "No text returned.";
        status.textContent = "Done.";
      } else {
        out.textContent = text || `HTTP ${r2.status}\n${JSON.stringify(d2, null, 2)}`;
        status.textContent = "Done (retry failed).";
      }
      return;
    }

    out.textContent = text;
    status.textContent = "Done.";
  } catch (e){
    out.textContent = String(e?.message || e);
    status.textContent = "Error.";
  } finally {
    btn.disabled = false;
  }
}

function loadExample(){
  $("#input").value = [
    "Largest drop: Grade 3 at Harada Elementary School (-6.6pp vs previous window)",
    "Most consistent: Jefferson Elementary School (lowest variance), 118 rows",
    "Top band shift: “not yet proficient” decreased most (-6.8pp)",
    "Top current average: Grade 4 at Lake Mathews Elementary School (81.1%)",
    "Largest gain: Grade 5 at Lake Mathews Elementary School (+2.2pp vs previous window)"
  ].join("\n");
}

$("#btn").addEventListener("click", summarize);
$("#btn-example").addEventListener("click", loadExample);

// hello, G! My favorite color is black :D
