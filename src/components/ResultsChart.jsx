// File: src/components/ResultsChart.jsx
import { useRef } from 'react';
import { toPng } from 'html-to-image';
import styles from './ResultsChart.module.css';

const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

const CRITERION_META = {
  clarity:    { icon: '◎', label: 'Clarity',    color: '#6366f1', bg: '#eef2ff', gradient: 'linear-gradient(90deg, #6366f1, #818cf8)' },
  creativity: { icon: '✦', label: 'Creativity', color: '#8b5cf6', bg: '#f5f3ff', gradient: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' },
  engagement: { icon: '⚡', label: 'Engagement', color: '#ec4899', bg: '#fdf2f8', gradient: 'linear-gradient(90deg, #ec4899, #f472b6)' },
  coherence:  { icon: '◈', label: 'Coherence',  color: '#3b82f6', bg: '#eff6ff', gradient: 'linear-gradient(90deg, #3b82f6, #60a5fa)' },
};

const VERDICT_COLORS = {
  'Excellent':         { bg: '#059669', badge: '#d1fae5', text: '#065f46' },
  'Good':              { bg: '#d97706', badge: '#fef3c7', text: '#92400e' },
  'Needs Improvement': { bg: '#dc2626', badge: '#fee2e2', text: '#991b1b' },
};

function ResultsChart({ results, scriptName, onClose }) {
  const chartRef = useRef(null);

  const { verdict } = results;
  const verdictColors = VERDICT_COLORS[verdict] ?? VERDICT_COLORS['Good'];

  const avgScore = (
    CRITERIA.reduce((sum, k) => sum + results[k].score, 0) / CRITERIA.length
  ).toFixed(1);

  async function handleDownload() {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = 'narrative-audit-results.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Action bar (outside the exportable area) */}
        <div className={styles.actionBar}>
          <span className={styles.actionLabel}>Preview · Click "Save" to download PNG</span>
          <div className={styles.actionButtons}>
            <button className={styles.btnSave} onClick={handleDownload}>
              ↓ Save PNG
            </button>
            <button className={styles.btnClose} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Exportable chart area ── */}
        <div ref={chartRef} className={styles.chart}>

          {/* Header */}
          <div className={styles.chartHeader}>
            <div className={styles.brandCol}>
              <div className={styles.brandRow}>
                <span className={styles.brandIcon}>◈</span>
                <span className={styles.brandName}>NarrativeAuditor</span>
                <span className={styles.brandTagline}>LLM-as-a-Judge · Netflix-style Evaluation</span>
              </div>
              {scriptName && (
                <div className={styles.scriptName}>
                  📄 {scriptName}
                </div>
              )}
            </div>
            <div className={styles.verdictBadge}
              style={{ background: verdictColors.badge, color: verdictColors.text }}>
              {verdict}
            </div>
          </div>

          {/* Score display */}
          <div className={styles.scoreHero}>
            <div className={styles.scoreHeroNum} style={{ color: verdictColors.bg }}>
              {avgScore}
              <span className={styles.scoreHeroDenom}>/10</span>
            </div>
            <div className={styles.scoreHeroLabel}>Overall Average Score</div>
          </div>

          {/* Bar chart section */}
          <div className={styles.chartSection}>
            <div className={styles.chartSectionTitle}>Per-Criterion Scores · 3-Run Consensus</div>
            <div className={styles.bars}>
              {CRITERIA.map((key) => {
                const meta = CRITERION_META[key];
                const score = results[key].score;
                const pct = (score / 10) * 100;
                const runs = results[key].consensusRuns;
                const avg = runs?.length
                  ? (runs.reduce((s, v) => s + v, 0) / runs.length).toFixed(1)
                  : score.toFixed(1);

                return (
                  <div key={key} className={styles.barRow}>
                    <div className={styles.barLabel}>
                      <span className={styles.barIcon} style={{ color: meta.color }}>{meta.icon}</span>
                      <span className={styles.barName}>{meta.label}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${pct}%`, background: meta.gradient }}
                      />
                    </div>
                    <div className={styles.barScore} style={{ color: meta.color }}>
                      {score}
                      <span className={styles.barScoreDenom}>/10</span>
                    </div>
                    {runs?.length > 0 && (
                      <div className={styles.barRuns}>
                        <span className={styles.barRunsLabel}>avg</span>
                        <span className={styles.barRunsVal} style={{ color: meta.color, background: meta.bg }}>
                          {avg}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consensus dot matrix */}
          {CRITERIA.some((k) => results[k].consensusRuns?.length > 0) && (
            <div className={styles.chartSection}>
              <div className={styles.chartSectionTitle}>Consensus Run Matrix · Each criterion × 3 independent LLM calls</div>
              <div className={styles.matrix}>
                {CRITERIA.map((key) => {
                  const meta = CRITERION_META[key];
                  const runs = results[key].consensusRuns ?? [];
                  return (
                    <div key={key} className={styles.matrixRow}>
                      <div className={styles.matrixLabel} style={{ color: meta.color }}>
                        {meta.icon} {meta.label}
                      </div>
                      <div className={styles.matrixDots}>
                        {runs.map((v, i) => (
                          <div key={i} className={styles.matrixDot}
                            style={{ background: meta.bg, color: meta.color, borderColor: meta.color }}>
                            <span className={styles.matrixDotRun}>R{i + 1}</span>
                            <span className={styles.matrixDotVal}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={styles.chartFooter}>
            <div className={styles.footerMethod}>
              Methodology: 4 independent criterion judges × 3-run consensus scoring · Tiered rationale (chain-of-thought → summary → score)
            </div>
            <div className={styles.footerRef}>
              Inspired by Netflix Technology Blog · "LLM-as-a-Judge" evaluation framework
            </div>
          </div>

        </div>
        {/* end .chart */}

      </div>
    </div>
  );
}

export default ResultsChart;
