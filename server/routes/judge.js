/**
 * LLM-as-a-Judge routes — Netflix-style evaluation pipeline
 *
 * POST /api/judge-criterion    → single criterion, tiered rationale
 * POST /api/synthesize         → final evaluation from chunk results
 * POST /api/analyze-characters → character consistency
 * POST /api/analyze-plot-gaps  → plot gap detection
 * POST /api/analyze-tone       → tone arc analysis
 * POST /api/suggest-improvements → scene rewrites
 */

import { Router } from 'express';
import { chat, parseJSON } from '../utils/openrouter.js';

const router = Router();

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

// ── POST /api/judge-criterion ─────────────────────────────────────────────────

router.post('/judge-criterion', async (req, res) => {
  try {
    const { text, criterion, chunkIndex, startPage, endPage, totalChunks } = req.body;

    if (!text || !criterion || !CRITERION_PROMPTS[criterion]) {
      return res.status(400).json({ error: 'text and a valid criterion are required.' });
    }

    const systemPrompt = CRITERION_PROMPTS[criterion];

    const userPrompt = `
You are evaluating section ${chunkIndex + 1} of ${totalChunks} (pages ${startPage}–${endPage}) of a screenplay.

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

    const raw  = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ], { temperature: 0.25, max_tokens: 800 });

    const parsed = parseJSON(raw);

    res.json({
      criterion,
      score:     Math.min(10, Math.max(1, Number(parsed.score))),
      reasoning: parsed.reasoning,
      summary:   parsed.summary,
    });
  } catch (err) {
    console.error('/judge-criterion error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/synthesize ──────────────────────────────────────────────────────

router.post('/synthesize', async (req, res) => {
  try {
    const { chunkResults, totalPages, filename } = req.body;

    if (!chunkResults?.length) {
      return res.status(400).json({ error: 'chunkResults array required.' });
    }

    const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

    // Build a compact summary of all chunk scores for the model
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

    // Clamp scores
    for (const k of CRITERIA) {
      if (parsed[k]) parsed[k].score = Math.min(10, Math.max(1, Number(parsed[k].score)));
    }

    res.json(parsed);
  } catch (err) {
    console.error('/synthesize error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/analyze-characters ─────────────────────────────────────────────

router.post('/analyze-characters', async (req, res) => {
  try {
    const { chunkResults } = req.body;

    const allNotes = chunkResults.map((c, i) =>
      `Section ${i + 1} (p.${c.startPage}–${c.endPage}): ${Object.values(c.notes).join(' ')}`
    ).join('\n');

    const prompt = `
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

    const raw    = await chat([{ role: 'user', content: prompt }], { temperature: 0.2, max_tokens: 900 });
    const parsed = parseJSON(raw);
    res.json(parsed);
  } catch (err) {
    console.error('/analyze-characters error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/analyze-plot-gaps ───────────────────────────────────────────────

router.post('/analyze-plot-gaps', async (req, res) => {
  try {
    const { chunkResults } = req.body;

    const allNotes = chunkResults.map((c, i) =>
      `Section ${i + 1} (p.${c.startPage}–${c.endPage}): ${Object.values(c.notes).join(' ')}`
    ).join('\n');

    const prompt = `
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

    const raw    = await chat([{ role: 'user', content: prompt }], { temperature: 0.2, max_tokens: 900 });
    const parsed = parseJSON(raw);
    res.json(parsed);
  } catch (err) {
    console.error('/analyze-plot-gaps error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/analyze-tone ────────────────────────────────────────────────────

router.post('/analyze-tone', async (req, res) => {
  try {
    const { chunkResults } = req.body;

    const arcData = chunkResults.map((c, i) => ({
      section: `S${i + 1}`,
      pages:   `${c.startPage}–${c.endPage}`,
      notes:   Object.values(c.notes).join(' '),
      engagementScore: c.scores.engagement,
    }));

    const prompt = `
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

    const raw    = await chat([{ role: 'user', content: prompt }], { temperature: 0.3, max_tokens: 900 });
    const parsed = parseJSON(raw);
    res.json(parsed);
  } catch (err) {
    console.error('/analyze-tone error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/suggest-improvements ───────────────────────────────────────────

router.post('/suggest-improvements', async (req, res) => {
  try {
    const { chunks, chunkResults } = req.body;

    // Pick up to 3 weakest sections by avg score
    const ranked = chunkResults
      .map((c, i) => {
        const avg = ['clarity','creativity','engagement','coherence']
          .reduce((s, k) => s + c.scores[k], 0) / 4;
        return { i, avg, chunk: chunks[i] };
      })
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3);

    const sceneData = ranked.map(({ i, chunk, avg }) => ({
      section: `S${i + 1}`,
      pages:   `p.${chunk?.startPage}–${chunk?.endPage}`,
      text:    chunk?.text?.slice(0, 2000) ?? '',
      notes:   Object.values(chunkResults[i].notes).join(' '),
      avgScore: avg.toFixed(1),
    }));

    const prompt = `
You are a script doctor. For each weak section below, identify the core problem and write a specific scene improvement.

WEAK SECTIONS:
${JSON.stringify(sceneData.map(s => ({ section: s.section, pages: s.pages, notes: s.notes, avgScore: s.avgScore, textSample: s.text.slice(0,500) })), null, 2)}

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

    const raw    = await chat([{ role: 'user', content: prompt }], { temperature: 0.4, max_tokens: 1400 });
    const parsed = parseJSON(raw);
    res.json(parsed);
  } catch (err) {
    console.error('/suggest-improvements error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
