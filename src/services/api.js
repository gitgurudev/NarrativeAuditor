// File: src/services/api.js
//
// Netflix-style LLM-as-a-Judge architecture:
//
//  Upgrade 1 — Per-criterion judges
//    Each criterion (clarity / creativity / engagement / coherence) gets its
//    own independent LLM call with a focused, criterion-specific prompt.
//    4 criterion calls run in PARALLEL per chunk.
//
//  Upgrade 2 — Tiered rationale
//    Each criterion call asks the model to:
//      1. Write a long, detailed reasoning trace
//      2. Condense it into a 2-sentence human-readable summary
//      3. Output a numeric score
//    Longer reasoning → more accurate scores (proven by Netflix paper).
//
//  Upgrade 3 — Consensus scoring
//    Every criterion judge runs 3 times in parallel.
//    The final score = average of the 3 runs.
//    Reduces variance caused by LLM non-determinism (~5% accuracy gain).
//
// ── Backend endpoints expected ────────────────────────────────────────────────
//
//  POST /api/judge-criterion
//    Body:  { text, criterion, chunkIndex, startPage, endPage, totalChunks }
//    Reply: { criterion, score: number, reasoning: string, summary: string }
//
//  POST /api/synthesize
//    Body:  { chunkResults, totalPages, filename }
//    Reply: EvaluationResult (see typedef)
//
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request to ${path} failed (${res.status}).`);
  }
  return res.json();
}

// ── Upgrade 1 + 2: Single criterion judge call (tiered rationale) ─────────────

/**
 * One LLM call focused on a single criterion with tiered rationale.
 * Step 1: long reasoning trace
 * Step 2: human-readable summary
 * Step 3: numeric score
 *
 * @returns {Promise<{ score: number, reasoning: string, summary: string }>}
 */
async function callCriterionJudge(text, criterion, chunkMeta) {
  return post('/api/judge-criterion', {
    text,
    criterion,
    chunkIndex:  chunkMeta.chunkIndex,
    startPage:   chunkMeta.startPage,
    endPage:     chunkMeta.endPage,
    totalChunks: chunkMeta.totalChunks,
  });
}

// ── Upgrade 3: Consensus scoring — 3 parallel runs per criterion ──────────────

/**
 * Run the same criterion judge 3 times in parallel and average the scores.
 * Uses the first run's reasoning/summary (all runs should be semantically similar).
 *
 * @returns {Promise<{ criterion, score, runs: number[], reasoning, summary }>}
 */
async function evaluateCriterionWithConsensus(text, criterion, chunkMeta) {
  const [r1, r2, r3] = await Promise.all([
    callCriterionJudge(text, criterion, { ...chunkMeta, _runIndex: 0 }),
    callCriterionJudge(text, criterion, { ...chunkMeta, _runIndex: 1 }),
    callCriterionJudge(text, criterion, { ...chunkMeta, _runIndex: 2 }),
  ]);

  const runs = [r1.score, r2.score, r3.score];
  const avg  = Math.round((runs.reduce((s, v) => s + v, 0) / 3) * 10) / 10;

  return { criterion, score: avg, runs, reasoning: r1.reasoning, summary: r1.summary };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate one chunk of the script.
 *
 * Internally runs 4 criterion judges in PARALLEL, each with 3-run consensus.
 * Total backend calls per chunk: 4 criteria × 3 consensus runs = 12 calls,
 * all fired simultaneously → wall-clock time ≈ 1 single call's latency.
 *
 * @param {{ index, startPage, endPage, text }} chunk
 * @param {number} totalChunks
 * @returns {Promise<ChunkResult>}
 */
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

  const scores    = {};
  const notes     = {};
  const reasoning = {};
  const consensus = {};

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
    scores,
    notes,
    reasoning,
    consensus,
    chunkSummary,
  };
}

/**
 * Script Intelligence: 4 parallel deep analyses.
 * Runs after synthesis — character consistency, plot gaps, tone arc, scene improvements.
 *
 * @param {{ index, startPage, endPage, text }[]} chunks  original chunk objects
 * @param {ChunkResult[]} chunkResults                    scored chunk results
 * @param {{ totalPages: number, filename: string }} meta
 * @returns {Promise<ScriptAnalysis>}
 */
export async function analyzeScript(chunks, chunkResults, meta) {
  const chunkPayload = chunks.map((c) => ({
    index: c.index, startPage: c.startPage, endPage: c.endPage, text: c.text,
  }));

  const [characters, plotGaps, toneArc, sceneImprovements] = await Promise.all([
    post('/api/analyze-characters',   { chunkResults, ...meta }),
    post('/api/analyze-plot-gaps',    { chunkResults, ...meta }),
    post('/api/analyze-tone',         { chunkResults, ...meta }),
    post('/api/suggest-improvements', { chunks: chunkPayload, chunkResults, ...meta }),
  ]);

  return { characters, plotGaps, toneArc, sceneImprovements };
}

/**
 * Synthesize all chunk results into one final evaluation.
 * Also uses 3-run consensus on the synthesis call itself.
 *
 * @param {ChunkResult[]} chunkResults
 * @param {{ totalPages: number, filename: string }} meta
 * @returns {Promise<EvaluationResult>}
 */
export async function synthesizeEvaluation(chunkResults, meta) {
  const [s1, s2, s3] = await Promise.all([
    post('/api/synthesize', { chunkResults, ...meta, _runIndex: 0 }),
    post('/api/synthesize', { chunkResults, ...meta, _runIndex: 1 }),
    post('/api/synthesize', { chunkResults, ...meta, _runIndex: 2 }),
  ]);

  const final = { ...s1 };
  for (const key of CRITERIA) {
    const avg = Math.round(
      ([s1, s2, s3].reduce((sum, s) => sum + s[key].score, 0) / 3) * 10
    ) / 10;
    final[key] = {
      ...s1[key],
      score:         avg,
      consensusRuns: [s1[key].score, s2[key].score, s3[key].score],
    };
  }
  return final;
}
