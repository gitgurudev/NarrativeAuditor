// File: src/components/PdfUploader.jsx
import { useRef, useState } from 'react';
import styles from './PdfUploader.module.css';

const CRITERIA = [
  { icon: '◎', label: 'Clarity',    color: '#6366f1', bg: '#eef2ff' },
  { icon: '✦', label: 'Creativity', color: '#8b5cf6', bg: '#f5f3ff' },
  { icon: '⚡', label: 'Engagement', color: '#ec4899', bg: '#fdf2f8' },
  { icon: '◈', label: 'Coherence',  color: '#3b82f6', bg: '#eff6ff' },
];

const FEATURES = [
  { icon: '⬡', title: 'Character Tracking',  desc: 'Consistency across every scene' },
  { icon: '◉', title: 'Plot Gap Detection',   desc: 'Finds unresolved threads' },
  { icon: '◐', title: 'Tone Arc Analysis',    desc: 'Emotional arc visualized' },
  { icon: '✎', title: 'AI Scene Rewrites',    desc: 'Fix weak scenes instantly' },
];

function PdfUploader({
  pdfInfo,
  isExtracting,
  extractProgress,
  onFileSelected,
  onReset,
  onEvaluate,
  isEvaluating,
}) {
  const inputRef  = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file) {
    if (!file || file.type !== 'application/pdf') return;
    onFileSelected(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
    e.target.value = '';
  }

  // ── Extraction in progress ────────────────────────────────────────────────
  if (isExtracting) {
    return (
      <div className={styles.hero}>
        <div className={styles.extractingState}>
          <div className={styles.extractIconWrap}>
            <span className={styles.extractIcon}>📄</span>
          </div>
          <p className={styles.extractTitle}>Reading your script…</p>
          <p className={styles.extractSub}>Extracting text page by page</p>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${extractProgress}%` }} />
          </div>
          <p className={styles.progressLabel}>{Math.round(extractProgress)}% complete</p>
        </div>
      </div>
    );
  }

  // ── File loaded — show info + evaluate ───────────────────────────────────
  if (pdfInfo) {
    return (
      <div className={styles.hero}>
        <div className={styles.fileReady}>

          {/* File info */}
          <div className={styles.fileCard}>
            <div className={styles.fileIconWrap}>
              <span className={styles.fileIconEmoji}>📋</span>
            </div>
            <div className={styles.fileMeta}>
              <p className={styles.fileName}>{pdfInfo.name}</p>
              <div className={styles.filePills}>
                <span className={styles.pill}>{pdfInfo.pageCount} pages</span>
                <span className={styles.pill}>~{pdfInfo.wordCount.toLocaleString()} words</span>
                <span className={`${styles.pill} ${styles.pillAccent}`}>
                  {pdfInfo.totalChunks} section{pdfInfo.totalChunks !== 1 ? 's' : ''} · 30 pages each
                </span>
              </div>
            </div>
            <button className={styles.changePdfBtn} onClick={onReset} disabled={isEvaluating}>
              ✕ Change
            </button>
          </div>

          {/* What will run */}
          <div className={styles.planRow}>
            {CRITERIA.map((c) => (
              <div key={c.label} className={styles.planChip} style={{ background: c.bg, color: c.color }}>
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </div>
            ))}
            <div className={styles.planChip} style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <span>⬡</span>
              <span>Characters</span>
            </div>
            <div className={styles.planChip} style={{ background: '#fff7ed', color: '#ea580c' }}>
              <span>◉</span>
              <span>Plot Gaps</span>
            </div>
          </div>

          <p className={styles.planNote}>
            {pdfInfo.totalChunks} sequential passes · 4 independent judges · 3-run consensus per criterion · character &amp; plot analysis
          </p>

          {/* CTA */}
          <button
            className={styles.evaluateBtn}
            onClick={onEvaluate}
            disabled={isEvaluating}
          >
            {isEvaluating ? (
              <><span className={styles.spinner} /> Evaluating…</>
            ) : (
              <>
                <span className={styles.evaluateBtnIcon}>◈</span>
                Start Full Analysis
                <span className={styles.evaluateBtnArrow}>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Default: landing hero + drop zone ────────────────────────────────────
  return (
    <div className={styles.hero}>

      {/* ── Top: headline ── */}
      <div className={styles.headline}>
        <div className={styles.netflixBadge}>
          <span className={styles.netflixDot} />
          Inspired by Netflix LLM-as-a-Judge paper
        </div>
        <h2 className={styles.headlineTitle}>
          Evaluate your screenplay<br />
          <span className={styles.headlineGradient}>like a professional analyst</span>
        </h2>
        <p className={styles.headlineSub}>
          Upload a PDF script. Get AI-powered scores, character tracking, plot gap detection, tone analysis, and scene-level rewrites.
        </p>
      </div>

      {/* ── Criterion chips ── */}
      <div className={styles.criteriaRow}>
        {CRITERIA.map((c) => (
          <div key={c.label} className={styles.criterionChip}>
            <span className={styles.criterionChipIcon} style={{ color: c.color, background: c.bg }}>
              {c.icon}
            </span>
            <span className={styles.criterionChipLabel}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* ── Drop zone ── */}
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload PDF screenplay"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div className={`${styles.dropIconWrap} ${isDragging ? styles.dropIconWrapActive : ''}`}>
          <span className={styles.dropIconEmoji}>{isDragging ? '⬇' : '◈'}</span>
        </div>
        <p className={styles.dropTitle}>
          {isDragging ? 'Release to upload' : 'Drop your script PDF here'}
        </p>
        <p className={styles.dropSubtext}>or click to browse · PDF only</p>
        <div className={styles.dropCapsules}>
          <span className={styles.dropCapsule}>✓ Up to 200+ pages</span>
          <span className={styles.dropCapsule}>✓ Auto-chunked</span>
          <span className={styles.dropCapsule}>✓ No backend needed</span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className={styles.hiddenInput}
        onChange={handleInputChange}
        aria-hidden="true"
      />

      {/* ── Feature highlights ── */}
      <div className={styles.featuresGrid}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <div>
              <p className={styles.featureTitle}>{f.title}</p>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

export default PdfUploader;
