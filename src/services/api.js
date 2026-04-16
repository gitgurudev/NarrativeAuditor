// File: src/services/api.js
//
// Netflix-style LLM-as-a-Judge — calls OpenRouter directly from the browser.
// Model: google/gemini-2.0-flash-exp:free (1M context, free tier)
//
//  Upgrade 1 — Per-criterion judges (clarity / creativity / engagement / coherence)
//  Upgrade 2 — Tiered rationale (reasoning → summary → score)
//  Upgrade 3 — Consensus scoring (3 parallel runs, averaged)

const OR_URL  = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL   = 'google/gemini-2.0-flash-exp:free';
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

// ── OpenRouter client ─────────────────────────────────────────────────────────

async function chat(messages, opts = {}) {
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://narrative-auditor.onrender.com',
      'X-Title':       'NarrativeAuditor',
    },
    body: JSON.stringify({
      model:       MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens:  opts.max_tokens  ?? 1500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter ${res.status}: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function parseJSON(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(cleaned);
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
${text.slice(0, 12000)}
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

// ── Consensus scoring — 3 parallel runs ──────────────────────────────────────

async function evaluateCriterionWithConsensus(text, criterion, chunkMeta) {
  const [r1, r2, r3] = await Promise.all([
    callCriterionJudge(text, criterion, chunkMeta),
    callCriterionJudge(text, criterion, chunkMeta),
    callCriterionJudge(text, criterion, chunkMeta),
  ]);

  const runs = [r1.score, r2.score, r3.score];
  const avg  = Math.round((runs.reduce((s, v) => s + v, 0) / 3) * 10) / 10;

  return { criterion, score: avg, runs, reasoning: r1.reasoning, summary: r1.summary };
}

// ── Public: evaluate one chunk ────────────────────────────────────────────────

export async function evaluateChunk(chunk, totalChunks) {
  const chunkMeta = {
    chunkIndex: chunk.index,
    startPage:  chunk.startPage,
    endPage:    chunk.endPage,
    totalChunks,
  };

  const results = await Promise.all(
    CRITERIA.map((criterion) =>
      evaluateCriterionWithConsensus(chunk.text, criterion, chunkMeta)
    )
  );

  const scores = {}, notes = {}, reasoning = {}, consensus = {};
  for (const r of results) {
    scores[r.criterion]    = r.score;
    notes[r.criterion]     = r.summary;
    reasoning[r.criterion] = r.reasoning;
    consensus[r.criterion] = r.runs;
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

  // 3-run consensus on synthesis too
  const synth = async () => {
    const raw    = await chat([{ role: 'user', content: prompt }], { temperature: 0.3, max_tokens: 1200 });
    const parsed = parseJSON(raw);
    for (const k of CRITERIA) {
      if (parsed[k]) parsed[k].score = Math.min(10, Math.max(1, Number(parsed[k].score)));
    }
    return parsed;
  };

  const [s1, s2, s3] = await Promise.all([synth(), synth(), synth()]);

  const final = { ...s1 };
  for (const key of CRITERIA) {
    const avg = Math.round(
      ([s1, s2, s3].reduce((sum, s) => sum + s[key].score, 0) / 3) * 10
    ) / 10;
    final[key] = { ...s1[key], score: avg, consensusRuns: [s1[key].score, s2[key].score, s3[key].score] };
  }
  return final;
}

// ── Public: Script Intelligence (4 parallel analyses) ────────────────────────

export async function analyzeScript(chunks, chunkResults, { totalPages, filename }) {
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

  const [characters, plotGaps, toneArc, sceneImprovements] = await Promise.all([
    chat([{ role: 'user', content: characterPrompt }], { temperature: 0.2, max_tokens: 900 }).then(parseJSON),
    chat([{ role: 'user', content: plotGapPrompt   }], { temperature: 0.2, max_tokens: 900 }).then(parseJSON),
    chat([{ role: 'user', content: tonePrompt      }], { temperature: 0.3, max_tokens: 900 }).then(parseJSON),
    chat([{ role: 'user', content: improvPrompt    }], { temperature: 0.4, max_tokens: 1400 }).then(parseJSON),
  ]);

  return { characters, plotGaps, toneArc, sceneImprovements };
}
