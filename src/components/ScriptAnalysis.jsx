// File: src/components/ScriptAnalysis.jsx
import { useState } from 'react';
import styles from './ScriptAnalysis.module.css';

// ── Character Consistency ─────────────────────────────────────────────────────

function CharacterCard({ data }) {
  const [expanded, setExpanded] = useState(null); // character name or null

  const statusMeta = {
    ok:      { icon: '✓', label: 'Consistent', cls: styles.statusOk },
    warning: { icon: '⚠', label: 'Warning',    cls: styles.statusWarning },
    error:   { icon: '✕', label: 'Issue',       cls: styles.statusError },
  };

  return (
    <div className={`${styles.panel} ${styles.panelCharacter}`}>
      <div className={styles.panelHeader}>
        <span className={`${styles.panelIcon} ${styles.iconCharacter}`}>⬡</span>
        <div className={styles.panelMeta}>
          <h3 className={styles.panelTitle}>Character Consistency</h3>
          <p className={styles.panelSub}>{data.list.length} characters tracked</p>
        </div>
        <div className={`${styles.scorePill} ${styles.scorePillCharacter}`}>{data.overallScore}/10</div>
      </div>

      <p className={styles.panelSummary}>{data.summary}</p>

      <div className={styles.characterList}>
        {data.list.map((char) => {
          const sm = statusMeta[char.status];
          const isOpen = expanded === char.name;
          return (
            <div key={char.name}
              className={`${styles.characterRow} ${char.issues.length ? styles.characterRowClickable : ''}`}
              onClick={() => char.issues.length && setExpanded(isOpen ? null : char.name)}>
              <span className={`${styles.charStatus} ${sm.cls}`}>{sm.icon}</span>
              <span className={styles.charName}>{char.name}</span>
              <span className={styles.charMeta}>{char.mentions} mentions</span>
              <span className={styles.charRange}>{char.firstSeen} – {char.lastSeen}</span>
              {char.issues.length > 0 && (
                <span className={styles.charChevron}>{isOpen ? '▲' : '▼'}</span>
              )}
              {isOpen && char.issues.length > 0 && (
                <div className={styles.charIssueBox}>
                  {char.issues.map((issue, i) => (
                    <p key={i} className={styles.charIssueText}>{issue}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Plot Gap Detection ────────────────────────────────────────────────────────

const SEVERITY_META = {
  critical: { cls: styles.sevCritical, label: 'CRITICAL' },
  high:     { cls: styles.sevHigh,     label: 'HIGH'     },
  medium:   { cls: styles.sevMedium,   label: 'MEDIUM'   },
  low:      { cls: styles.sevLow,      label: 'LOW'      },
};

function PlotGapsCard({ data }) {
  return (
    <div className={`${styles.panel} ${styles.panelPlot}`}>
      <div className={styles.panelHeader}>
        <span className={`${styles.panelIcon} ${styles.iconPlot}`}>◉</span>
        <div className={styles.panelMeta}>
          <h3 className={styles.panelTitle}>Plot Gap Detection</h3>
          <p className={styles.panelSub}>{data.gaps.length} gaps found</p>
        </div>
        <div className={`${styles.scorePill} ${styles.scorePillPlot}`}>{data.overallScore}/10</div>
      </div>

      <p className={styles.panelSummary}>{data.summary}</p>

      <div className={styles.gapList}>
        {data.gaps.map((gap, i) => {
          const sm = SEVERITY_META[gap.severity];
          return (
            <div key={i} className={styles.gapRow}>
              <div className={styles.gapTop}>
                <span className={`${styles.sevBadge} ${sm.cls}`}>{sm.label}</span>
                <span className={styles.gapTitle}>{gap.title}</span>
                <span className={styles.gapLocation}>{gap.location}</span>
              </div>
              <p className={styles.gapDesc}>{gap.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tone Analysis ─────────────────────────────────────────────────────────────

function ToneArcCard({ data }) {
  const maxIntensity = Math.max(...data.arc.map((a) => a.intensity));

  return (
    <div className={`${styles.panel} ${styles.panelTone}`}>
      <div className={styles.panelHeader}>
        <span className={`${styles.panelIcon} ${styles.iconTone}`}>◐</span>
        <div className={styles.panelMeta}>
          <h3 className={styles.panelTitle}>Tone Analysis</h3>
          <p className={styles.panelSub}>{data.dominantTone}</p>
        </div>
        <div className={`${styles.toneShiftCount} ${data.toneShifts.length > 1 ? styles.toneShiftWarn : styles.toneShiftOk}`}>
          {data.toneShifts.length} shift{data.toneShifts.length !== 1 ? 's' : ''}
        </div>
      </div>

      <p className={styles.panelSummary}>{data.summary}</p>

      {/* Arc chart */}
      <div className={styles.arcChart}>
        {data.arc.map((seg, i) => {
          const heightPct = (seg.intensity / maxIntensity) * 100;
          return (
            <div key={i} className={styles.arcCol}>
              <div className={styles.arcBarWrap}>
                <div
                  className={styles.arcBar}
                  style={{ height: `${heightPct}%`, background: seg.hex }}
                  title={`${seg.label} — intensity ${seg.intensity}/10`}
                />
              </div>
              <span className={styles.arcLabel}>{seg.section}</span>
              <span className={styles.arcMood}>{seg.mood}</span>
            </div>
          );
        })}
      </div>

      {/* Tone shift warnings */}
      {data.toneShifts.length > 0 && (
        <div className={styles.shiftList}>
          {data.toneShifts.map((shift, i) => (
            <div key={i} className={styles.shiftRow}>
              <span className={`${styles.shiftBadge} ${shift.severity === 'jarring' ? styles.shiftJarring : styles.shiftAbrupt}`}>
                {shift.from}→{shift.to}
              </span>
              <p className={styles.shiftDesc}>{shift.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scene Improver ────────────────────────────────────────────────────────────

function SceneImproverCard({ data }) {
  const [activeScene, setActiveScene] = useState(0);
  const scene = data.scenes[activeScene];

  return (
    <div className={`${styles.panel} ${styles.panelScene}`}>
      <div className={styles.panelHeader}>
        <span className={`${styles.panelIcon} ${styles.iconScene}`}>✎</span>
        <div className={styles.panelMeta}>
          <h3 className={styles.panelTitle}>Improve This Scene</h3>
          <p className={styles.panelSub}>{data.scenes.length} scenes selected</p>
        </div>
        <span className={styles.sceneBadge}>AI Rewrites</span>
      </div>

      {/* Scene tabs */}
      <div className={styles.sceneTabs}>
        {data.scenes.map((s, i) => (
          <button
            key={i}
            className={`${styles.sceneTab} ${activeScene === i ? styles.sceneTabActive : ''}`}
            onClick={() => setActiveScene(i)}>
            {s.section} · {s.pages}
          </button>
        ))}
      </div>

      {scene && (
        <div className={styles.sceneContent}>
          {/* Weakness */}
          <div className={styles.sceneBlock}>
            <div className={styles.sceneBlockLabel}>
              <span className={styles.sceneBlockIcon} style={{ background: '#fee2e2', color: '#dc2626' }}>⚠</span>
              Weakness Identified
            </div>
            <p className={styles.sceneBlockText}>{scene.weakness}</p>
          </div>

          {/* Suggestion */}
          <div className={styles.sceneBlock}>
            <div className={styles.sceneBlockLabel}>
              <span className={styles.sceneBlockIcon} style={{ background: '#dcfce7', color: '#16a34a' }}>→</span>
              Suggested Fix
            </div>
            <p className={styles.sceneBlockText}>{scene.suggestion}</p>
          </div>

          {/* Rewrite */}
          <div className={styles.sceneBlock}>
            <div className={styles.sceneBlockLabel}>
              <span className={styles.sceneBlockIcon} style={{ background: '#ede9fe', color: '#7c3aed' }}>✎</span>
              AI Rewrite
            </div>
            <pre className={styles.sceneRewrite}>{scene.rewrite}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonDot} />
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonSpinner} />
      </div>
      <div className={styles.skeletonGrid}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonCard}>
            <div className={styles.skeletonBar} style={{ width: '60%' }} />
            <div className={styles.skeletonBar} style={{ width: '85%' }} />
            <div className={styles.skeletonBar} style={{ width: '40%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

function ScriptAnalysis({ analysis }) {
  if (!analysis) return null;
  if (analysis === 'loading') return <AnalysisSkeleton />;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>🔬</span>
        <div>
          <h2 className={styles.sectionTitle}>Script Intelligence</h2>
          <p className={styles.sectionSub}>4 deep analyses · character consistency · plot gaps · tone arc · scene rewrites</p>
        </div>
        <span className={styles.sectionBadge}>AI-Powered</span>
      </div>

      <div className={styles.grid}>
        <CharacterCard  data={analysis.characters}        />
        <PlotGapsCard   data={analysis.plotGaps}          />
        <ToneArcCard    data={analysis.toneArc}           />
        <SceneImproverCard data={analysis.sceneImprovements} />
      </div>
    </section>
  );
}

export default ScriptAnalysis;
