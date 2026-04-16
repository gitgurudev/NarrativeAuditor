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

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const USE_MOCK  = import.meta.env.VITE_MOCK_API === 'true';

const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

// ── Mock data ─────────────────────────────────────────────────────────────────

/**
 * Per-criterion tiered rationale mock data.
 * Each entry has:
 *   reasoning → long trace (what Netflix calls "tiered rationale step 1")
 *   summary   → human-readable condensation (step 2)
 *   chunkScores → [chunk0scores, chunk1scores, chunk2scores...] where each is [run1,run2,run3]
 */
const MOCK_CRITERION_DATA = {
  clarity: {
    reasoning: `The narrative structure is generally clear with well-defined scene transitions and purposeful character introductions. The protagonist's central goal is established within the first few pages, giving readers a reliable orientation to the story's stakes. Scene headers and action lines are concise and directive. However, several transitions between Act I and Act II lack the contextual bridges that would help audiences follow geographic and temporal shifts — specifically, the cut from the office setting to the mountain sequence on page 34 assumes reader knowledge that has not yet been established. Exposition-heavy dialogue in the mid-section inserts backstory in a way that feels grafted rather than organic to the scene's action. Clarity is above average for the genre, but a non-specialist reader will encounter at least three moments requiring re-reading.`,
    summary: `Generally clear narrative with a well-anchored protagonist goal, but Act I–II transitions and some grafted exposition create recurring clarity gaps that will slow attentive readers.`,
    chunkScores: [[7,7,8],[6,6,7],[7,8,7],[8,8,9],[7,7,8]],
  },
  creativity: {
    reasoning: `The script demonstrates genuine creative ambition that sets it apart from genre conventions. The inciting incident — which inverts the expected power dynamic between protagonist and antagonist — is bold and immediately signals that this is a work willing to take formal risks. The antagonist's motivation, revealed across three non-contiguous scenes rather than in a single exposition dump, shows sophisticated structural thinking. The mid-story reversal on pages 68–72 recontextualises the opening sequence in a way that rewards attentive readers and creates genuine surprise. The non-linear structural choice in Act III is the script's riskiest move: it could alienate casual readers but earns deep thematic resonance for those tracking the story's central metaphor. The final image is original and stays with the reader. Minor deductions for two plot devices (the locked room, the overheard conversation) that lean on genre cliché.`,
    summary: `Stands out for its inverted power dynamic, layered antagonist reveal, and a genuinely surprising mid-story reversal. The non-linear Act III is a high-risk, high-reward structural choice that works.`,
    chunkScores: [[8,8,9],[7,7,8],[7,7,7],[7,8,7],[9,9,8]],
  },
  engagement: {
    reasoning: `The cold open is the script's most effective engagement tool — it establishes stakes, introduces the protagonist under pressure, and ends on a question that compels the reader forward. Engagement is high through approximately page 30. The problem begins in the second act where three consecutive scenes (pages 41–58) convey largely the same narrative information: the protagonist is isolated, the antagonist is closing in, and the allies are unreliable. This redundancy causes a measurable pacing collapse. A reader tracking engagement would notice the urge to skim here. The large set-piece on pages 89–103 recovers momentum forcefully and is the most cinematically realised section of the script. The Act II finale restores full engagement. Climax and resolution deliver emotional payoff, though a single scene in the denouement over-explains a thematic point the reader has already understood.`,
    summary: `Strong cold open and a powerful mid-script set-piece, but a three-scene redundancy block in Act II causes a significant momentum collapse that risks losing readers before the recovery.`,
    chunkScores: [[8,7,8],[5,5,6],[7,7,8],[8,8,9],[8,8,7]],
  },
  coherence: {
    reasoning: `The primary narrative thread is coherently constructed. Character decisions derive logically from established psychology and the cause-and-effect chain from inciting incident to climax is traceable without gaps. The internal world rules are consistent throughout — a requirement this genre demands and one the script meets. The main coherence liability is a secondary subplot introduced on pages 22–25 involving the protagonist's estranged sibling. This subplot resurfaces on pages 78–80 and then disappears entirely. No resolution, no deliberate abandonment, no acknowledgement. In a script of this length, unresolved threads read as authorial oversight rather than intentional ambiguity. A second minor issue: the antagonist's access to the encrypted files is referenced in Act I but the mechanism of access is never explained, creating a small but nagging plot hole for analytically-minded readers.`,
    summary: `Solid cause-and-effect chain and consistent world rules, but an unresolved sibling subplot and an unexplained antagonist capability create two noticeable structural gaps that undermine otherwise strong coherence.`,
    chunkScores: [[6,6,7],[7,7,8],[6,6,6],[8,8,8],[6,5,7]],
  },
};

/** Mock final synthesis result (used when VITE_MOCK_API=true) */
const MOCK_FINAL_EVALUATION = {
  clarity: {
    score: 7.3,
    explanation: `Generally clear narrative with a well-anchored protagonist goal, but Act I–II transitions and some grafted exposition create recurring clarity gaps that slow attentive readers.`,
    reasoning: MOCK_CRITERION_DATA.clarity.reasoning,
    consensusRuns: [7.1, 7.4, 7.5],
  },
  creativity: {
    score: 7.9,
    explanation: `Stands out for its inverted power dynamic, layered antagonist reveal, and a genuinely surprising mid-story reversal. The non-linear Act III is a high-risk, high-reward structural choice that works.`,
    reasoning: MOCK_CRITERION_DATA.creativity.reasoning,
    consensusRuns: [7.8, 8.0, 7.9],
  },
  engagement: {
    score: 7.1,
    explanation: `Strong cold open and a powerful mid-script set-piece, but a three-scene redundancy block in Act II causes a significant momentum collapse that risks losing readers before the recovery.`,
    reasoning: MOCK_CRITERION_DATA.engagement.reasoning,
    consensusRuns: [6.9, 7.2, 7.1],
  },
  coherence: {
    score: 6.9,
    explanation: `Solid cause-and-effect chain and consistent world rules, but an unresolved sibling subplot and an unexplained antagonist capability create two noticeable structural gaps.`,
    reasoning: MOCK_CRITERION_DATA.coherence.reasoning,
    consensusRuns: [6.8, 7.0, 6.9],
  },
  summary: `NarrativeAuditor evaluated this script across 5 sections using 4 independent criterion judges, each run 3 times for consensus accuracy. The script demonstrates genuine creative ambition — particularly in its antagonist construction, structural choices, and final image — paired with solid clarity and above-average engagement. The primary structural liability is an unresolved secondary subplot that threads through all five sections without payoff. The second act needs surgical trimming: three scenes convey redundant information and cause a measurable pacing collapse. With targeted revision to the middle act and subplot resolution, this screenplay has genuine commercial and festival potential.`,
  verdict: 'Good',
  improvements: [
    'Resolve or cut the sibling subplot introduced on pages 22–25 — it resurfaces on pages 78–80 then disappears, reading as an oversight rather than intentional ambiguity.',
    'Cut 20–25% of Act II pages 41–58: the three consecutive scenes convey the same "isolated protagonist" information and are the single biggest cause of pacing collapse.',
    'Explain the antagonist\'s access to the encrypted files — the mechanism is referenced in Act I but never provided, creating a plot hole for analytically-minded readers.',
    'Clarify the Act I–II transition at page 34: add one establishing line that bridges the office setting to the mountain sequence so readers aren\'t disoriented.',
    'Trim the final denouement scene that over-explains the central theme — the audience has already understood it; trust the preceding imagery to carry the meaning.',
  ],
};

// ── Mock: Script Intelligence Analysis ───────────────────────────────────────

const MOCK_SCRIPT_ANALYSIS = {
  characters: {
    list: [
      { name: 'MARCUS',          mentions: 47, firstSeen: 'p.1',  lastSeen: 'p.118', status: 'ok',      issues: [] },
      { name: 'SARAH',           mentions: 23, firstSeen: 'p.4',  lastSeen: 'p.80',  status: 'warning', issues: ['Exits the narrative on p.80 without explanation or resolution — reads as authorial oversight rather than intentional exit.'] },
      { name: 'DR. CHEN',        mentions: 8,  firstSeen: 'p.22', lastSeen: 'p.79',  status: 'warning', issues: ['Motivation shifts unexplained: allies Marcus in Act I, opposes him in Act II with no bridging scene or revelation to justify the change.'] },
      { name: 'THE WATCHER',     mentions: 3,  firstSeen: 'p.34', lastSeen: 'p.35',  status: 'error',   issues: ['Referenced by name on p.98 as if already established, but last appeared on p.35 with no reintroduction — creates reader confusion.'] },
      { name: 'LIEUTENANT FORD', mentions: 5,  firstSeen: 'p.12', lastSeen: 'p.67',  status: 'ok',      issues: [] },
    ],
    overallScore: 7,
    summary: '2 of 5 tracked characters have consistency issues. The sibling subplot character (Sarah) and an unexplained motivation shift (Dr. Chen) are the primary concerns.',
  },
  plotGaps: {
    gaps: [
      {
        severity: 'critical',
        location: 'p.22–80',
        title: 'Sibling subplot abandoned',
        description: 'Sarah is introduced as the protagonist\'s estranged sibling with an apparent role in the central conflict. She resurfaces briefly at p.78–80, then vanishes entirely. No resolution, no deliberate abandonment, no acknowledgement in the final act.',
      },
      {
        severity: 'high',
        location: 'Act I → Act II',
        title: 'Antagonist\'s file access unexplained',
        description: 'The antagonist\'s ability to access Marcus\'s encrypted files is referenced as established fact throughout Act II, but the mechanism is never explained. Creates a logic hole that analytically-minded viewers will fixate on.',
      },
      {
        severity: 'medium',
        location: 'p.34',
        title: 'Mountain sequence context gap',
        description: 'A hard cut from the city office to a mountain location assumes geographic knowledge not yet established. One establishing line or brief transition would resolve this cleanly.',
      },
      {
        severity: 'low',
        location: 'p.89',
        title: 'Safe house origin unestablished',
        description: 'The group arrives at a safe house with no prior setup of how they know its location. Minor detail but breaks immersion for attentive readers.',
      },
    ],
    overallScore: 6,
    summary: '4 plot gaps detected — 1 critical, 1 high, 1 medium, 1 low severity. The abandoned sibling subplot is the most structurally damaging issue.',
  },
  toneArc: {
    arc: [
      { section: 'S1', label: 'Tense · Urgent',   intensity: 8,  hex: '#ef4444', mood: 'Thriller' },
      { section: 'S2', label: 'Contemplative',     intensity: 3,  hex: '#6366f1', mood: 'Drama'    },
      { section: 'S3', label: 'Rising Dread',      intensity: 7,  hex: '#f59e0b', mood: 'Suspense' },
      { section: 'S4', label: 'Explosive',         intensity: 10, hex: '#dc2626', mood: 'Action'   },
      { section: 'S5', label: 'Melancholic',       intensity: 4,  hex: '#3b82f6', mood: 'Drama'    },
    ],
    dominantTone: 'Thriller / Suspense',
    toneShifts: [
      { from: 'S1', to: 'S2', severity: 'jarring', description: 'Intensity drops from 8 → 3 without a transitional buffer. The contemplative mid-section feels disconnected from the urgent opening — readers expecting escalation are momentarily lost.' },
      { from: 'S4', to: 'S5', severity: 'abrupt', description: 'Post-climax tonal reset is too rapid. The melancholic denouement would benefit from 1–2 bridging scenes to ease the drop from peak intensity.' },
    ],
    summary: 'Dominant tone is Thriller/Suspense with a strong action climax. Two jarring tonal transitions weaken the emotional throughline, particularly the S1→S2 intensity cliff.',
  },
  sceneImprovements: {
    scenes: [
      {
        section: 'S2',
        pages: 'p.41–58',
        weakness: 'Three consecutive scenes convey identical narrative information: Marcus is isolated, the antagonist is closing in, and allies are unreliable. No new information, no character development, no tonal variation across 17 pages.',
        suggestion: 'Merge into one scene with a fresh revelation. Use it to advance character psychology — add a specific piece of information Marcus discovers that changes his understanding of the situation.',
        rewrite: `INT. MARCUS'S APARTMENT — NIGHT

Marcus spreads photos across the floor. Every face he trusted.
He photographs each one with his phone, then burns the prints.

His phone BUZZES. Blocked number.

TEXT: "I know which one you haven't turned yet."

Marcus stares at the photo of LIEUTENANT FORD. The most loyal person he knows.

He puts it face-down.`,
      },
      {
        section: 'S1',
        pages: 'p.34',
        weakness: 'Hard geographic cut with no establishment. Reader has no context for why the character is at a mountain location or how much time has passed since the previous scene.',
        suggestion: 'Add a single establishing beat — a brief super, a line of dialogue, or one transitional exterior shot that grounds the geography and time shift.',
        rewrite: `EXT. MOUNTAIN ROAD — DAWN

[SUPER: "Brenner Pass — 6 hours earlier"]

A rental car navigates hairpin turns. Inside, MARCUS checks his mirror. Nothing follows.

He exhales. He didn't think they'd let him get this far.`,
      },
      {
        section: 'S3',
        pages: 'p.78–80',
        weakness: 'Sarah\'s reappearance is unmotivated and her dialogue restates exposition the audience already knows. The scene ends without advancing either the relationship or the plot — it\'s pure wheel-spinning.',
        suggestion: 'Give this scene a real dramatic pivot: a decision made, a secret revealed, or a deliberate refusal that has consequences. If it can\'t do that work, cut it and acknowledge Sarah\'s absence in dialogue instead.',
        rewrite: `INT. HOSPITAL CORRIDOR — NIGHT

Marcus finds SARAH at the end of the hall. She doesn't turn.

SARAH: "I know what you need from me."

MARCUS: "Sarah—"

SARAH: "I'm not going to give it to you."

She walks through a door. It locks behind her.

Marcus stands alone. He doesn't follow. For the first time, he understands: she made her choice before he arrived.`,
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

function jitter(base, range = 0.5) {
  return Math.round((base + (Math.random() * range * 2 - range)) * 10) / 10;
}

function clamp(v, min = 1, max = 10) { return Math.min(max, Math.max(min, v)); }

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
  if (USE_MOCK) {
    const data       = MOCK_CRITERION_DATA[criterion];
    const chunkIdx   = chunkMeta.chunkIndex % data.chunkScores.length;
    const run        = data.chunkScores[chunkIdx];
    const runIdx     = chunkMeta._runIndex ?? 0;
    return {
      score:     clamp(run[runIdx % run.length]),
      reasoning: data.reasoning,
      summary:   data.summary,
    };
  }

  return post('/api/judge-criterion', {
    text,
    criterion,
    chunkIndex:  chunkMeta.chunkIndex,
    startPage:   chunkMeta.startPage,
    endPage:     chunkMeta.endPage,
    totalChunks: chunkMeta.totalChunks,
    // Tiered rationale instruction is in the backend system prompt:
    // "1. Write detailed reasoning. 2. Summarise in 2 sentences. 3. Score 1–10."
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
  if (USE_MOCK) {
    // Stagger mock delays slightly so UI feels alive
    const stagger = CRITERIA.indexOf(criterion) * 180;
    await delay(1400 + stagger + Math.random() * 400);

    const data     = MOCK_CRITERION_DATA[criterion];
    const chunkIdx = chunkMeta.chunkIndex % data.chunkScores.length;
    const runs     = data.chunkScores[chunkIdx].map((s) => clamp(jitter(s, 0.3)));
    const avg      = Math.round((runs.reduce((s, v) => s + v, 0) / runs.length) * 10) / 10;

    return { criterion, score: avg, runs, reasoning: data.reasoning, summary: data.summary };
  }

  // Fire 3 runs in parallel
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

  // Upgrade 1: 4 independent criterion judges
  // Upgrade 2: each uses tiered rationale
  // Upgrade 3: each runs 3× for consensus
  // All 12 calls fire in parallel
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

  // Derive chunk summary from criterion summaries
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
  if (USE_MOCK) {
    await delay(1800);
    return MOCK_SCRIPT_ANALYSIS;
  }

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
  if (USE_MOCK) {
    await delay(2600);
    return MOCK_FINAL_EVALUATION;
  }

  // Run synthesis 3× in parallel for consensus
  const [s1, s2, s3] = await Promise.all([
    post('/api/synthesize', { chunkResults, ...meta, _runIndex: 0 }),
    post('/api/synthesize', { chunkResults, ...meta, _runIndex: 1 }),
    post('/api/synthesize', { chunkResults, ...meta, _runIndex: 2 }),
  ]);

  // Average scores across synthesis runs; use first run's text fields
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
