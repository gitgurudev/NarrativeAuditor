// File: src/components/StoryInput.jsx
import styles from './StoryInput.module.css';

const MIN_CHARS = 80;

/**
 * Full-width story/script input panel.
 *
 * @param {{
 *   value: string,
 *   onChange: (v: string) => void,
 *   onEvaluate: () => void,
 *   onImprove: () => void,
 *   isEvaluating: boolean,
 *   isImproving: boolean,
 *   hasResults: boolean,
 * }} props
 */
function StoryInput({ value, onChange, onEvaluate, onImprove, isEvaluating, isImproving, hasResults }) {
  const charCount   = value.length;
  const isBusy      = isEvaluating || isImproving;
  const canSubmit   = charCount >= MIN_CHARS && !isBusy;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Your Story or Script</h2>
        <span className={`${styles.charCount} ${charCount < MIN_CHARS ? styles.charCountWarn : ''}`}>
          {charCount.toLocaleString()} chars
          {charCount < MIN_CHARS && <span className={styles.minHint}> (min {MIN_CHARS})</span>}
        </span>
      </div>

      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Paste your story, screenplay, or narrative here…\n\nThe evaluator will score it on:\n  · Clarity\n  · Creativity\n  · Engagement\n  · Coherence`}
        disabled={isBusy}
        aria-label="Story or script input"
        spellCheck
      />

      <div className={styles.actions}>
        <button
          className={styles.evaluateBtn}
          onClick={onEvaluate}
          disabled={!canSubmit}
          aria-busy={isEvaluating}
        >
          {isEvaluating ? (
            <>
              <span className={styles.btnSpinner} aria-hidden="true" />
              Analysing…
            </>
          ) : (
            <>
              <span aria-hidden="true">◈</span> Evaluate
            </>
          )}
        </button>

        {hasResults && (
          <button
            className={styles.improveBtn}
            onClick={onImprove}
            disabled={isBusy}
            aria-busy={isImproving}
            title="Ask AI to rewrite the story addressing the identified weaknesses"
          >
            {isImproving ? (
              <>
                <span className={styles.btnSpinner} aria-hidden="true" />
                Rewriting…
              </>
            ) : (
              <>
                <span aria-hidden="true">✦</span> Improve Story
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

export default StoryInput;
