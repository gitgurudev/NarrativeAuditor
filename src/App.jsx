// File: src/App.jsx
import { useState, useCallback } from 'react';
import PdfUploader    from './components/PdfUploader.jsx';
import ChunkProgress  from './components/ChunkProgress.jsx';
import ResultsPanel   from './components/ResultsPanel.jsx';
import ScriptAnalysis from './components/ScriptAnalysis.jsx';
import { extractPdfText }       from './utils/pdfParser.js';
import { buildChunks, estimateWordCount } from './utils/chunker.js';
import { evaluateChunk, synthesizeEvaluation, analyzeScript } from './services/api.js';
import styles from './App.module.css';

function App() {
  // ── PDF / extraction state ─────────────────────────────────────────────
  const [phase,           setPhase]           = useState('idle');
  const [pdfInfo,         setPdfInfo]         = useState(null);
  const [extractProgress, setExtractProgress] = useState(0);
  const [chunks,          setChunks]          = useState([]);

  // ── Evaluation state ───────────────────────────────────────────────────
  const [chunkStatuses,   setChunkStatuses]   = useState([]);
  const [chunkResults,    setChunkResults]    = useState([]);
  const [results,         setResults]         = useState(null);
  const [analysis,        setAnalysis]        = useState(null);

  // ── UI ─────────────────────────────────────────────────────────────────
  const [error, setError] = useState(null);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleFileSelected = useCallback(async (file) => {
    setError(null);
    setPhase('extracting');
    setExtractProgress(0);

    try {
      const { pageCount, pages } = await extractPdfText(file, (current, total) => {
        setExtractProgress(Math.round((current / total) * 100));
      });

      const builtChunks = buildChunks(pages);
      const wordCount   = estimateWordCount(pages);

      setChunks(builtChunks);
      setChunkStatuses(builtChunks.map(() => 'pending'));
      setChunkResults(builtChunks.map(() => null));
      setPdfInfo({ name: file.name, pageCount, totalChunks: builtChunks.length, wordCount });
      setPhase('ready');
    } catch (err) {
      setError('Could not read PDF. Make sure it contains selectable text (not a scanned image).');
      setPhase('idle');
    }
  }, []);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setPdfInfo(null);
    setChunks([]);
    setChunkStatuses([]);
    setChunkResults([]);
    setResults(null);
    setAnalysis(null);
    setError(null);
  }, []);

  const handleEvaluate = useCallback(async () => {
    if (!chunks.length) return;
    setError(null);
    setResults(null);
    setPhase('evaluating');

    // ── Phase 1: evaluate each chunk sequentially ──────────────────────
    const collectedResults = [];

    for (let i = 0; i < chunks.length; i++) {
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

      // ── Script Intelligence: 4 parallel analyses (non-blocking) ───────
      setAnalysis('loading');
      analyzeScript(chunks, collectedResults, {
        totalPages: pdfInfo.pageCount,
        filename:   pdfInfo.name,
      })
        .then((a) => setAnalysis(a))
        .catch(() => setAnalysis(null));
    } catch (err) {
      setError(`Synthesis failed: ${err.message}`);
      setPhase('ready');
    }
  }, [chunks, pdfInfo]);

  // ── Render ─────────────────────────────────────────────────────────────
  const isEvaluating   = phase === 'evaluating';
  const isSynthesizing = phase === 'synthesizing';
  const isBusy         = isEvaluating || isSynthesizing || phase === 'extracting';

  return (
    <div className={styles.app}>

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
          <div className={styles.headerBadge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            Chunk-based · 4 criteria
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className={styles.main}>

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

        {(isEvaluating || isSynthesizing) && (
          <ChunkProgress
            chunks={chunks}
            statuses={chunkStatuses}
            chunkResults={chunkResults}
            isSynthesizing={isSynthesizing}
          />
        )}

        {error && (
          <div className={styles.errorBanner} role="alert">
            <span>⚠ {error}</span>
            <button className={styles.errorDismiss} onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
          </div>
        )}

        {phase === 'done' && results && (
          <>
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
