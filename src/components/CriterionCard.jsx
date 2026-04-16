// File: src/components/CriterionCard.jsx
import styles from './CriterionCard.module.css';

const ICONS = {
  clarity:    '◎',
  creativity: '✦',
  engagement: '⚡',
  coherence:  '◈',
};

const LABELS = {
  clarity:    'Clarity',
  creativity: 'Creativity',
  engagement: 'Engagement',
  coherence:  'Coherence',
};

function scoreColor(s) {
  if (s >= 8) return 'var(--success)';
  if (s >= 5) return 'var(--warning)';
  return 'var(--danger)';
}

/**
 * Clean dashboard KPI card — score + bar + consensus + explanation.
 * Detailed reasoning lives in the Deep Analysis section of ResultsPanel.
 */
function CriterionCard({ criterion, score, explanation, consensusRuns }) {
  const pct = (score / 10) * 100;

  // Compute average directly from the 3 runs so it always matches what's shown
  const consensusAvg = consensusRuns?.length
    ? (consensusRuns.reduce((s, v) => s + v, 0) / consensusRuns.length).toFixed(1)
    : null;

  return (
    <article className={`${styles.card} ${styles[`card_${criterion}`]}`}>

      {/* ── Icon + label + score ── */}
      <header className={styles.cardHeader}>
        <div className={`${styles.iconWrap} ${styles[`iconWrap_${criterion}`]}`} aria-hidden="true">
          {ICONS[criterion]}
        </div>
        <div className={styles.labelGroup}>
          <h3 className={styles.label}>{LABELS[criterion]}</h3>
          <div className={styles.scoreRow}>
            <span className={`${styles.score} ${styles[`score_${criterion}`]}`}>{score}</span>
            <span className={styles.scoreDenom}>/10</span>
          </div>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className={styles.barTrack}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-label={`${LABELS[criterion]}: ${score} out of 10`}>
        <div className={`${styles.barFill} ${styles[`bar_${criterion}`]}`}
          style={{ width: `${pct}%` }} />
      </div>

      {/* ── Consensus: just the average ── */}
      {consensusAvg && (
        <div className={styles.consensus}>
          <span className={styles.consensusLabel}>3-RUN CONSENSUS</span>
          <span className={styles.consensusDivider} />
          <span className={`${styles.avg} ${styles[`avg_${criterion}`]}`}>avg {consensusAvg}</span>
        </div>
      )}

      {/* ── Explanation (tiered rationale: human-readable summary) ── */}
      <p className={styles.explanation}>{explanation}</p>
    </article>
  );
}

export default CriterionCard;
