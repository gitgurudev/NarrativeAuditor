// File: src/services/api.js
//
// Netflix-style LLM-as-a-Judge — Groq API (free tier)
// Model: llama-3.3-70b-versatile  |  Free: 14,400 req/day · 500K tokens/day
//
//  Upgrade 1 — Per-criterion judges (clarity / creativity / engagement / coherence)
//  Upgrade 2 — Tiered rationale (reasoning → summary → score)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.1-8b-instant';   // 20k TPM free tier (vs 12k for 70b)
const API_KEY  = import.meta.env.VITE_GROQ_API_KEY;

const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

// ── Groq client with auto-retry on 429 ───────────────────────────────────────

async function chat(messages, opts = {}, _retry = 0) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens:  opts.max_tokens  ?? 800,
    }),
  });

  // Auto-retry on rate limit — Groq tells us exact wait time
  if (res.status === 429 && _retry < 4) {
    const errBody = await res.json().catch(() => ({}));
    const retryMsg = errBody.error?.message ?? '';
    const match    = retryMsg.match(/try again in ([\d.]+)s/i);
    const waitMs   = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : (2 ** _retry) * 3000;
    console.warn(`[Groq] 429 — waiting ${waitMs}ms then retry ${_retry + 1}/4`);
    await new Promise(r => setTimeout(r, waitMs));
    return chat(messages, opts, _retry + 1);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody.error?.message || res.statusText;
    console.error('[Groq] error →', res.status, msg);
    throw new Error(`Groq ${res.status}: ${msg}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function parseJSON(raw) {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[parseJSON] failed to parse:', raw.slice(0, 300));
    throw new Error(`Model returned invalid JSON: ${e.message}`);
  }
}

// ── Criterion prompts ─────────────────────────────────────────────────────────

const CRITERION_PROMPTS = {
  clarity: `You are an expert screenplay analyst specialising in CLARITY.
Clarity means: clear scene transitions, unambiguous character goals, readable action lines, logical information flow.`,

  creativity: `You are an expert screenplay analyst specialising in CREATIVITY.
Creativity means: original premise, unexpected story choices, fresh character dynamics, subverted genre expectations.`,

  engagement: `You are an expert screenplay analyst specialising in ENGAGEMENT.
Engagement means: pacing, tension, hooks, the reader's desire to turn the page. Cold opens, set-pieces, momentum.`,

  coherence: `You are an expert screenplay analyst specialising in COHERENCE.
Coherence means: internal logic, cause-and-effect chains, consistent character behaviour, resolved subplots, world-rule consistency.`,
};

// ── Single criterion call (tiered rationale) ──────────────────────────────────

async function callCriterionJudge(text, criterion, chunkMeta) {
  const systemPrompt = CRITERION_PROMPTS[criterion];

  const userPrompt = `
You are evaluating section ${chunkMeta.chunkIndex + 1} of ${chunkMeta.totalChunks} (pages ${chunkMeta.startPage}–${chunkMeta.endPage}) of a screenplay.

SCREENPLAY TEXT:
"""
${text.slice(0, 3000)}
"""

Apply the Netflix LLM-as-a-Judge tiered rationale method:

Step 1 — REASONING: Write 150–250 words of detailed analytical reasoning about ${criterion} in this section. Be specific, cite page ranges or scene moments.

Step 2 — SUMMARY: Condense your reasoning into exactly 2 sentences a producer could read.

Step 3 — SCORE: Give a score from 1–10 for ${criterion} in this section.

Respond ONLY with valid JSON, no markdown:
{
  "reasoning": "...",
  "summary": "...",
  "score": <number 1-10>
}`.trim();

  const raw    = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ], { temperature: 0.25, max_tokens: 800 });

  const parsed = parseJSON(raw);
  return {
    score:     Math.min(10, Math.max(1, Number(parsed.score))),
    reasoning: parsed.reasoning,
    summary:   parsed.summary,
  };
}

// ── Public: evaluate one chunk ────────────────────────────────────────────────
// Sequential calls (not parallel) to stay within free tier rate limits.
// 4 calls per chunk, one at a time.

export async function evaluateChunk(chunk, totalChunks) {
  const chunkMeta = {
    chunkIndex: chunk.index,
    startPage:  chunk.startPage,
    endPage:    chunk.endPage,
    totalChunks,
  };

  const scores = {}, notes = {}, reasoning = {}, consensus = {};

  for (const criterion of CRITERIA) {
    const r = await callCriterionJudge(chunk.text, criterion, chunkMeta);
    scores[criterion]    = r.score;
    notes[criterion]     = r.summary;
    reasoning[criterion] = r.reasoning;
    consensus[criterion] = [r.score];
  }

  const chunkSummary = `Pages ${chunk.startPage}–${chunk.endPage}: ` +
    `Clarity ${scores.clarity}/10 · Creativity ${scores.creativity}/10 · ` +
    `Engagement ${scores.engagement}/10 · Coherence ${scores.coherence}/10. ` +
    notes.clarity;

  return {
    chunkIndex: chunk.index,
    startPage:  chunk.startPage,
    endPage:    chunk.endPage,
    scores, notes, reasoning, consensus, chunkSummary,
  };
}

// ── Public: synthesize all chunks into final result ───────────────────────────

export async function synthesizeEvaluation(chunkResults, { totalPages, filename }) {
  const chunkSummary = chunkResults.map((c, i) =>
    `Section ${i + 1} (p.${c.startPage}–${c.endPage}): ` +
    CRITERIA.map(k => `${k}=${c.scores[k]}`).join(', ') +
    `. Notes: ${Object.values(c.notes).join(' | ')}`
  ).join('\n');

  const prompt = `
You are a senior story editor synthesizing a full screenplay evaluation.

Script: "${filename}" — ${totalPages} pages, ${chunkResults.length} sections evaluated.

SECTION-BY-SECTION RESULTS:
${chunkSummary}

Produce a FINAL evaluation. For each criterion, average the section scores and write a 2-sentence explanation highlighting the strongest and weakest section.

Also write:
- summary: 3–4 sentence overall assessment for the writer
- verdict: exactly one of "Excellent" / "Good" / "Needs Improvement"
  (Excellent = avg ≥ 8.0, Good = avg ≥ 6.0, Needs Improvement = below 6.0)
- improvements: array of 4–5 specific, actionable improvement suggestions

Respond ONLY with valid JSON, no markdown:
{
  "clarity":    { "score": <avg 1-10>, "explanation": "2 sentences" },
  "creativity": { "score": <avg 1-10>, "explanation": "2 sentences" },
  "engagement": { "score": <avg 1-10>, "explanation": "2 sentences" },
  "coherence":  { "score": <avg 1-10>, "explanation": "2 sentences" },
  "summary": "...",
  "verdict": "Good",
  "improvements": ["...", "...", "...", "..."]
}`.trim();

  const raw    = await chat([{ role: 'user', content: prompt }], { temperature: 0.3, max_tokens: 1200 });
  const parsed = parseJSON(raw);
  for (const k of CRITERIA) {
    if (parsed[k]) parsed[k].score = Math.min(10, Math.max(1, Number(parsed[k].score)));
  }
  return parsed;
}

// ── Public: Script Intelligence (4 parallel analyses) ────────────────────────

export async function analyzeScript(chunks, chunkResults, _meta) {
  const allNotes = chunkResults.map((c, i) =>
    `Section ${i + 1} (p.${c.startPage}–${c.endPage}): ${Object.values(c.notes).join(' ')}`
  ).join('\n');

  const characterPrompt = `
You are a screenplay continuity editor. Based on these section-by-section analyst notes, identify all named characters and any consistency issues.

NOTES:
${allNotes}

Return ONLY valid JSON:
{
  "list": [
    {
      "name": "CHARACTER NAME",
      "mentions": <estimated count>,
      "firstSeen": "p.X",
      "lastSeen": "p.X",
      "status": "ok" | "warning" | "error",
      "issues": ["issue description if any"]
    }
  ],
  "overallScore": <1-10>,
  "summary": "2-sentence overall character consistency assessment"
}`.trim();

  const plotGapPrompt = `
You are a story structure analyst. Based on these section notes, identify plot gaps, unresolved threads, logic holes, and missing context.

NOTES:
${allNotes}

Return ONLY valid JSON:
{
  "gaps": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "location": "p.X–Y or section reference",
      "title": "short gap name",
      "description": "specific description of the gap or unresolved thread"
    }
  ],
  "overallScore": <1-10>,
  "summary": "2-sentence overall plot integrity assessment"
}`.trim();

  const arcData = chunkResults.map((c, i) => ({
    section: `S${i + 1}`,
    pages:   `${c.startPage}–${c.endPage}`,
    notes:   Object.values(c.notes).join(' '),
    engagementScore: c.scores.engagement,
  }));

  const tonePrompt = `
You are a tone and pacing analyst for screenplays. Based on these section summaries and engagement scores, characterise the emotional/tonal arc.

SECTIONS:
${JSON.stringify(arcData, null, 2)}

Return ONLY valid JSON:
{
  "arc": [
    {
      "section": "S1",
      "label": "tone label (e.g. Tense, Contemplative, Explosive)",
      "intensity": <1-10>,
      "hex": "<a hex color representing the mood e.g. #ef4444 for intense, #6366f1 for contemplative>",
      "mood": "genre word (Thriller, Drama, Action, etc.)"
    }
  ],
  "dominantTone": "overall tone label",
  "toneShifts": [
    {
      "from": "S1",
      "to": "S2",
      "severity": "jarring" | "abrupt" | "smooth",
      "description": "what causes the shift and whether it works"
    }
  ],
  "summary": "2-sentence tone arc assessment"
}`.trim();

  const ranked = chunkResults
    .map((c, i) => {
      const avg = CRITERIA.reduce((s, k) => s + c.scores[k], 0) / 4;
      return { i, avg, chunk: chunks[i] };
    })
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  const sceneData = ranked.map(({ i, chunk, avg }) => ({
    section:  `S${i + 1}`,
    pages:    `p.${chunk?.startPage}–${chunk?.endPage}`,
    notes:    Object.values(chunkResults[i].notes).join(' '),
    avgScore: avg.toFixed(1),
    textSample: chunk?.text?.slice(0, 500) ?? '',
  }));

  const improvPrompt = `
You are a script doctor. For each weak section below, identify the core problem and write a specific scene improvement.

WEAK SECTIONS:
${JSON.stringify(sceneData, null, 2)}

For each section return:
- weakness: what specifically is wrong (2-3 sentences)
- suggestion: how to fix it (1-2 sentences, concrete)
- rewrite: a short scene rewrite sample (screenplay format, 4-8 lines)

Return ONLY valid JSON:
{
  "scenes": [
    {
      "section": "S1",
      "pages": "p.X–Y",
      "weakness": "...",
      "suggestion": "...",
      "rewrite": "INT. LOCATION — TIME\\n\\nAction line.\\n\\nCHARACTER\\nDialogue."
    }
  ]
}`.trim();

  // Sequential to respect free tier rate limits
  const characters       = parseJSON(await chat([{ role: 'user', content: characterPrompt }], { temperature: 0.2, max_tokens: 900 }));
  const plotGaps         = parseJSON(await chat([{ role: 'user', content: plotGapPrompt   }], { temperature: 0.2, max_tokens: 900 }));
  const toneArc          = parseJSON(await chat([{ role: 'user', content: tonePrompt      }], { temperature: 0.3, max_tokens: 900 }));
  const sceneImprovements = parseJSON(await chat([{ role: 'user', content: improvPrompt   }], { temperature: 0.4, max_tokens: 1400 }));

  return { characters, plotGaps, toneArc, sceneImprovements };
}
