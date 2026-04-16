// File: src/App.jsx
import { useState, useCallback } from 'react';
import PdfUploader     from './components/PdfUploader.jsx';
import ChunkProgress   from './components/ChunkProgress.jsx';
import ResultsPanel    from './components/ResultsPanel.jsx';
import ScriptAnalysis  from './components/ScriptAnalysis.jsx';
import AuthModal       from './components/AuthModal.jsx';
import { useAuth }     from './hooks/useAuth.js';
import { extractPdfText }       from './utils/pdfParser.js';
import { buildChunks, estimateWordCount } from './utils/chunker.js';
import { evaluateChunk, synthesizeEvaluation, analyzeScript } from './services/api.js';
import styles from './App.module.css';

/**
 * Phases:
 *  'idle'         → waiting for PDF upload
 *  'extracting'   → PDF.js reading pages (progress shown)
 *  'ready'        → extraction done, file info shown, waiting for user to start
 *  'evaluating'   → sequential chunk API calls in progress
 *  'synthesizing' → all chunks done, final synthesis call
 *  'done'         → results ready
 */

function App() {
  const { user, loading: authLoading, logout, startEvaluation } = useAuth();

  // ── PDF / extraction state ─────────────────────────────────────────────
  const [phase,           setPhase]           = useState('idle');
  const [pdfInfo,         setPdfInfo]         = useState(null);   // { name, pageCount, totalChunks, wordCount }
  const [extractProgress, setExtractProgress] = useState(0);
  const [chunks,          setChunks]          = useState([]);     // Chunk[]

  // ── Evaluation state ───────────────────────────────────────────────────
  const [chunkStatuses,   setChunkStatuses]   = useState([]);     // 'pending'|'processing'|'done'|'error'
  const [chunkResults,    setChunkResults]    = useState([]);     // ChunkResult[]
  const [results,         setResults]         = useState(null);   // EvaluationResult
  const [analysis,        setAnalysis]        = useState(null);   // ScriptAnalysis | 'loading'

  // ── UI ─────────────────────────────────────────────────────────────────
  const [error, setError] = useState(null);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleFileSelected = useCallback(async (file) => {
    setError(null);
    setPhase('extracting');
    setExtractProgress(0);

    try {
      setPdfFile(file);
      const { pageCount, pages } = await extractPdfText(file, (current, total) => {
        setExtractProgress(Math.round((current / total) * 100));
      });

      const builtChunks = buildChunks(pages);
      const wordCount   = estimateWordCount(pages);

      setChunks(builtChunks);
      setChunkStatuses(builtChunks.map(() => 'pending'));
      setChunkResults(builtChunks.map(() => null));
      setPdfInfo({
        name:        file.name,
        pageCount,
        totalChunks: builtChunks.length,
        wordCount,
      });
      setPhase('ready');
    } catch (err) {
      setError('Could not read PDF. Make sure it contains selectable text (not a scanned image).');
      setPhase('idle');
    }
  }, []);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setPdfInfo(null);
    setPdfFile(null);
    setChunks([]);
    setChunkStatuses([]);
    setChunkResults([]);
    setResults(null);
    setAnalysis(null);
    setError(null);
  }, []);

  // Keep original PDF File object so we can upload it to backend for email
  const [pdfFile, setPdfFile] = useState(null);

  const handleEvaluate = useCallback(async () => {
    if (!chunks.length) return;
    setError(null);
    setResults(null);

    // ── Gate: send PDF to backend, check limit, trigger email ──────────
    try {
      await startEvaluation(pdfFile);
    } catch (err) {
      setError(err.message);
      if (err.limitReached) setPhase('idle');
      return;
    }

    // ── Phase 1: evaluate each chunk sequentially ──────────────────────
    setPhase('evaluating');
    const collectedResults = [];

    for (let i = 0; i < chunks.length; i++) {
      // Mark current chunk as processing
      setChunkStatuses((prev) => prev.map((s, idx) => (idx === i ? 'processing' : s)));

      try {
        const result = await evaluateChunk(chunks[i], chunks.length);
        collectedResults.push(result);

        setChunkResults((prev) => prev.map((r, idx) => (idx === i ? result : r)));
        setChunkStatuses((prev) => prev.map((s, idx) => (idx === i ? 'done' : s)));
      } catch (err) {
        setChunkStatuses((prev) => prev.map((s, idx) => (idx === i ? 'error' : s)));
        setError(`Failed on chunk ${i + 1} (${chunks[i].label}): ${err.message}`);
        setPhase('ready');
        return;
      }
    }

    // ── Phase 2: synthesize all chunk results ──────────────────────────
    setPhase('synthesizing');
    try {
      const finalResult = await synthesizeEvaluation(collectedResults, {
        totalPages: pdfInfo.pageCount,
        filename:   pdfInfo.name,
      });
      setResults(finalResult);
      setPhase('done');

      // ── Script Intelligence: run 4 analyses in parallel (non-blocking) ──
      setAnalysis('loading');
      analyzeScript(chunks, collectedResults, {
        totalPages: pdfInfo.pageCount,
        filename:   pdfInfo.name,
      })
        .then((a) => setAnalysis(a))
        .catch(() => setAnalysis(null)); // silent fail — analysis is bonus
    } catch (err) {
      setError(`Synthesis failed: ${err.message}`);
      setPhase('ready');
    }
  }, [chunks, pdfInfo, pdfFile, startEvaluation]);

  // ── Render ─────────────────────────────────────────────────────────────
  const isEvaluating  = phase === 'evaluating';
  const isSynthesizing = phase === 'synthesizing';
  const isBusy        = isEvaluating || isSynthesizing || phase === 'extracting';

  if (authLoading) return null; // brief flash while checking stored token

  return (
    <div className={styles.app}>

      {/* ── Auth gate ── */}
      {!user && <AuthModal onSuccess={() => {}} />}

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon} aria-hidden="true">◈</div>
            <div>
              <h1 className={styles.brandName}>NarrativeAuditor</h1>
              <p className={styles.brandTagline}>AI-powered script &amp; story evaluation</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            {user && (
              <div className={styles.userBadge}>
                <span className={styles.userAvatar}>{user.username[0].toUpperCase()}</span>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.username}</span>
                  <span className={styles.userQuota}>
                    {2 - user.evaluationsUsed} eval{2 - user.evaluationsUsed !== 1 ? 's' : ''} left
                  </span>
                </div>
                <button className={styles.logoutBtn} onClick={logout} title="Sign out">↩</button>
              </div>
            )}
            <div className={styles.headerBadge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              Chunk-based · 4 criteria
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className={styles.main}>

        {/* PDF upload / file info */}
        {(phase === 'idle' || phase === 'extracting' || phase === 'ready') && (
          <PdfUploader
            pdfInfo={pdfInfo}
            isExtracting={phase === 'extracting'}
            extractProgress={extractProgress}
            onFileSelected={handleFileSelected}
            onReset={handleReset}
            onEvaluate={handleEvaluate}
            isEvaluating={isBusy}
          />
        )}

        {/* Chunk-by-chunk progress */}
        {(isEvaluating || isSynthesizing) && (
          <ChunkProgress
            chunks={chunks}
            statuses={chunkStatuses}
            chunkResults={chunkResults}
            isSynthesizing={isSynthesizing}
          />
        )}

        {/* Error banner */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span>⚠ {error}</span>
            <button className={styles.errorDismiss} onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
          </div>
        )}

        {/* Final results */}
        {phase === 'done' && results && (
          <>
            {/* File summary strip */}
            <div className={styles.completedStrip}>
              <span className={styles.completedIcon} aria-hidden="true">✓</span>
              <span>
                Evaluated <strong>{pdfInfo?.name}</strong> · {pdfInfo?.pageCount} pages
                · {chunks.length} chunks
              </span>
              <button className={styles.newEvalBtn} onClick={handleReset}>
                Evaluate another PDF
              </button>
            </div>

            <ResultsPanel results={results} scriptName={pdfInfo?.name} />
          <ScriptAnalysis analysis={analysis} />
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        NarrativeAuditor · Chunk-based AI evaluation
      </footer>
    </div>
  );
}

export default App;
