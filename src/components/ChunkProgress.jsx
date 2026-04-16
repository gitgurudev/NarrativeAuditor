// File: src/components/ChunkProgress.jsx
import styles from './ChunkProgress.module.css';

const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

const CRITERION_META = {
  clarity:    { icon: '◎', color: '#6366f1', label: 'Clarity'    },
  creativity: { icon: '✦', color: '#8b5cf6', label: 'Creativity' },
  engagement: { icon: '⚡', color: '#ec4899', label: 'Engagement' },
  coherence:  { icon: '◈', color: '#3b82f6', label: 'Coherence'  },
};

function scoreColor(s) {
  if (s >= 8) return 'var(--success)';
  if (s >= 5) return 'var(--warning)';
  return 'var(--danger)';
}
function scoreBg(s) {
  if (s >= 8) return 'var(--success-soft)';
  if (s >= 5) return 'var(--warning-soft)';
  return 'var(--danger-soft)';
}

function ChunkProgress({ chunks, statuses, chunkResults, isSynthesizing }) {
  const doneCount      = statuses.filter((s) => s === 'done').length;
  const processingIdx  = statuses.findIndex((s) => s === 'processing');
  const totalSteps     = chunks.length + 1; // +1 for synthesis
  const completedSteps = isSynthesizing ? chunks.length : doneCount;
  const pct            = Math.round((completedSteps / totalSteps) * 100);

  const activeResult   = processingIdx >= 0 ? chunkResults[processingIdx] : null;
  const completedItems = chunkResults
    .map((r, i) => ({ result: r, idx: i }))
    .filter(({ result }) => result !== null);

  const currentLabel = isSynthesizing
    ? 'Final Synthesis'
    : processingIdx >= 0
      ? `Section ${processingIdx + 1} of ${chunks.length}`
      : doneCount === chunks.length
        ? 'All sections complete'
        : 'Preparing…';

  return (
    <section className={styles.panel} aria-label="Evaluation progress" aria-live="polite">

      {/* ── Top bar: title + % ── */}
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.title}>
            {isSynthesizing ? 'Generating Final Report' : 'Analysing Script'}
          </h2>
          <p className={styles.subtitle}>
            {isSynthesizing
              ? '3 synthesis judges combining all section assessments'
              : `${currentLabel} · 4 criterion judges × 3 consensus runs`}
          </p>
        </div>
        <div className={styles.pctWrap}>
          <span className={styles.pct}>{pct}%</span>
          <span className={styles.pctLabel}>complete</span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isSynthesizing ? styles.fillSynth : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ── Stepper dots ── */}
      <div className={styles.stepper}>
        {chunks.map((_, i) => {
          const s = statuses[i] || 'pending';
          return (
            <div key={i} className={styles.stepItem}>
              {i > 0 && (
                <div className={`${styles.stepLine} ${i <= doneCount ? styles.stepLineFilled : ''}`} />
              )}
              <div className={`${styles.stepDot} ${styles[`dot_${s}`]}`}>
                {s === 'done'       && <span>✓</span>}
                {s === 'processing' && <span className={styles.dotSpinner} />}
                {(s === 'pending' || s === 'error') && <span>{i + 1}</span>}
              </div>
              <span className={`${styles.stepLabel} ${s === 'processing' ? styles.stepLabelActive : ''}`}>
                S{i + 1}
              </span>
            </div>
          );
        })}

        {/* Synthesis step */}
        <div className={styles.stepItem}>
          <div className={`${styles.stepLine} ${doneCount === chunks.length ? styles.stepLineFilled : ''}`} />
          <div className={`${styles.stepDot} ${isSynthesizing ? styles.dot_processing : doneCount < chunks.length ? styles.dot_pending : styles.dot_pending}`}>
            {isSynthesizing
              ? <span className={styles.dotSpinner} />
              : <span>⊕</span>}
          </div>
          <span className={`${styles.stepLabel} ${isSynthesizing ? styles.stepLabelActive : ''}`}>
            Final
          </span>
        </div>
      </div>

      {/* ── Active section card ── */}
      {(processingIdx >= 0 || isSynthesizing) && (
        <div className={styles.activeCard}>
          <div className={styles.activeCardHeader}>
            <span className={styles.activePulse} aria-hidden="true" />
            <span className={styles.activeTitle}>
              {isSynthesizing ? 'Generating Full Report + Script Intelligence…' : `Analysing Section ${processingIdx + 1}`}
            </span>
            <span className={styles.activeBadge}>
              {isSynthesizing ? 'Almost done' : '4 independent judges'}
            </span>
          </div>

          {!isSynthesizing && (
            <div className={styles.criteriaGrid}>
              {CRITERIA.map((c) => {
                const score = activeResult?.scores?.[c];
                const runs  = activeResult?.consensus?.[c] || [];
                const done  = score !== undefined;
                return (
                  <div key={c} className={`${styles.criterionChip} ${done ? styles.chipDone : styles.chipRunning}`}
                    style={{ '--cc': CRITERION_META[c].color }}>
                    <span className={styles.chipIcon}>{CRITERION_META[c].icon}</span>
                    <span className={styles.chipLabel}>{CRITERION_META[c].label}</span>
                    {done ? (
                      <span className={styles.chipScore}
                        style={{ color: scoreColor(score), background: scoreBg(score) }}>
                        {score}
                      </span>
                    ) : (
                      <span className={styles.chipSpinner} />
                    )}
                    {done && runs.length > 0 && (
                      <div className={styles.miniRuns}>
                        {runs.map((r, ri) => (
                          <span key={ri} style={{ background: scoreColor(r) }} className={styles.miniDot} title={`Run ${ri+1}: ${r}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Completed sections (compact) ── */}
      {completedItems.length > 0 && (
        <div className={styles.completedSection}>
          <p className={styles.completedHeader}>Completed sections</p>
          <div className={styles.completedList}>
            {completedItems.map(({ result, idx }) => (
              <div key={idx} className={styles.completedRow}>
                <span className={styles.completedLabel}>Section {idx + 1}</span>
                <div className={styles.completedScores}>
                  {CRITERIA.map((c) => {
                    const score = result?.scores?.[c];
                    return (
                      <span key={c} className={styles.completedScore}
                        style={{ color: scoreColor(score), background: scoreBg(score) }}
                        title={`${CRITERION_META[c].label}: ${score}`}>
                        {CRITERION_META[c].icon}{score}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}

export default ChunkProgress;
