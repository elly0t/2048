import { useGame } from '../hooks/useGame';
import { COPY } from '../i18n/copy';
import styles from './AIPanel.module.css';

export function AIPanel() {
  const { advice, adviceLoading, requestAdvice } = useGame();

  return (
    <div className={styles.panel}>
      {advice && (
        <p
          className={styles.advice}
          aria-live="polite"
          data-testid="advice"
          data-loading={adviceLoading}
        >
          <strong className={styles.adviceDirection} data-testid="advice-direction">
            {advice.direction ?? '—'}
          </strong>{' '}
          — {advice.reasoning}
        </p>
      )}
      <button
        type="button"
        className={styles.askButton}
        onClick={() => {
          if (!adviceLoading) void requestAdvice();
        }}
        aria-disabled={adviceLoading}
        data-testid="ask-ai"
      >
        {adviceLoading ? (
          <span className={styles.askLabel}>{COPY.ai.computing}</span>
        ) : (
          <>
            <span className={styles.askLabel}>{COPY.ai.askAi}</span>
            <span className={styles.shortcutHint}>{COPY.ai.shortcutHint}</span>
          </>
        )}
      </button>
    </div>
  );
}
