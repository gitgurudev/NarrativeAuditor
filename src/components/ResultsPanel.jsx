// File: src/components/ResultsPanel.jsx
import { useState } from 'react';
import CriterionCard from './CriterionCard.jsx';
import ResultsChart from './ResultsChart.jsx';
import styles from './ResultsPanel.module.css';

const CRITERIA = ['clarity', 'creativity', 'engagement', 'coherence'];

const CRITERION_META = {
  clarity:    { icon: '◎', color: '#6366f1' },
  creativity: { icon: '✦', color: '#8b5cf6' },
  engagement: { icon: '⚡', color: '#ec4899' },
  coherence:  { icon: '◈', color: '#3b82f6' },
};

const VERDICT_META = {
  'Excellent':         { cls: 'excellent', icon: '★', sub: 'Outstanding work across all dimensions' },
  'Good':              { cls: 'good',      icon: '◆', sub: 'Solid narrative with room to grow'      },
  'Needs Improvement': { cls: 'needs',     icon: '▲', sub: 'Significant revision recommended'       },
};

function ResultsPanel({ results, scriptName }) {
  const { summary, verdict, improvements } = results;
  const meta = VERDICT_META[verdict] ?? VERDICT_META['Good'];
  const [activeTab, setActiveTab] = useState('clarity');
  const [showChart, setShowChart] = useState(false);

  const avgScore = (
    CRITERIA.reduce((sum, k) => sum + results[k].score, 0) / CRITERIA.length
  ).toFixed(1);

  // Check if any reasoning is available
  const hasReasoning = CRITERIA.some((k) => results[k]?.reasoning);

  return (
    <>
    {showChart && <ResultsChart results={results} scriptName={scriptName} onClose={() => setShowChart(false)} />}
    <section className={styles.panel} aria-label="Evaluation results">

      {/* ── Verdict hero ── */}
      <div className={`${styles.verdictBanner} ${styles[`verdict_${meta.cls}`]}`}>
        <div className={styles.verdictLeft}>
          <div className={styles.verdictIconWrap} aria-hidden="true">{meta.icon}</div>
          <div>
            <p className={styles.verdictLabel}>Final Verdict</p>
            <p className={styles.verdictText}>{verdict}</p>
            <p className={styles.verdictSubtext}>{meta.sub}</p>
          </div>
        </div>
        <button className={styles.exportBtn} onClick={() => setShowChart(true)}>
          ↓ Export Chart
        </button>
        <div className={styles.avgScore}>
          <span className={styles.avgScoreNum}>{avgScore}</span>
          <span className={styles.avgScoreDenom}>/10</span>
          <span className={styles.avgScoreLabel}>avg score</span>
        </div>
      </div>

      {/* ── 4-column criterion grid ── */}
      <div className={styles.grid}>
        {CRITERIA.map((key) => (
          <CriterionCard
            key={key}
            criterion={key}
            score={results[key].score}
            explanation={results[key].explanation}
            consensusRuns={results[key].consensusRuns}
          />
        ))}
      </div>

      {/* ── Summary ── */}
      <div className={styles.summaryCard}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>◉</span>
          Overall Summary
        </h3>
        <p className={styles.summaryText}>{summary}</p>
      </div>

      {/* ── Improvements ── */}
      {improvements?.length > 0 && (
        <div className={styles.improvementsCard}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionTitleIcon}>→</span>
            Suggested Improvements
          </h3>
          <ol className={styles.improvementList}>
            {improvements.map((tip, i) => (
              <li key={i} className={styles.improvementItem}>
                <span className={styles.tipNum}>{i + 1}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Deep Analysis (tabbed reasoning) ── */}
      {hasReasoning && (
        <div className={styles.deepCard}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.sectionTitleIcon}>⊕</span>
            Deep Analysis
            <span className={styles.deepBadge}>Tiered Rationale · Step 1</span>
          </h3>
          <p className={styles.deepSubtext}>
            Detailed reasoning trace from each independent criterion judge
          </p>

          {/* Tabs */}
          <div className={styles.tabs} role="tablist">
            {CRITERIA.map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={activeTab === key}
                className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
                style={{ '--tc': CRITERION_META[key].color }}
                onClick={() => setActiveTab(key)}>
                <span className={styles.tabIcon}>{CRITERION_META[key].icon}</span>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={styles.tabContent} role="tabpanel">
            {CRITERIA.map((key) => (
              activeTab === key && (
                <div key={key} className={styles.tabPane}>
                  <div className={styles.tabPaneHeader}
                    style={{ '--tc': CRITERION_META[key].color }}>
                    <span className={styles.tabPaneIcon}>{CRITERION_META[key].icon}</span>
                    <span className={styles.tabPaneTitle}>
                      {key.charAt(0).toUpperCase() + key.slice(1)} — Score {results[key].score}/10
                    </span>
                    {results[key].consensusRuns?.length > 0 && (
                      <span className={styles.tabPaneRuns}>
                        Runs: {results[key].consensusRuns.join(' · ')}
                      </span>
                    )}
                  </div>
                  <p className={styles.reasoningText}>
                    {results[key].reasoning || results[key].explanation}
                  </p>
                </div>
              )
            ))}
          </div>
        </div>
      )}

    </section>
    </>
  );
}

export default ResultsPanel;
