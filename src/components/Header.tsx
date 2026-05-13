import { useGame } from '../hooks/useGame';
import { COPY } from '../i18n/copy';
import { STATUS } from '../store/types';
import styles from './Header.module.css';

export function Header() {
  const { score, bestScore, status, reset } = useGame();
  const titleStatus = status === STATUS.WON ? 'won' : status === STATUS.LOST ? 'lost' : undefined;

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <h1 className={styles.title} data-status={titleStatus}>
          {COPY.app.title}
        </h1>
        <div className={styles.scores}>
          <div className={styles.scoreBlock}>
            <span className={styles.label}>{COPY.header.scoreLabel}</span>
            <span className={styles.value} aria-live="polite" data-testid="score">
              {score}
            </span>
          </div>
          <div className={styles.scoreBlock}>
            <span className={styles.label}>{COPY.header.bestLabel}</span>
            <span className={styles.value} aria-live="polite" data-testid="best-score">
              {bestScore}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.restart}
          onClick={() => reset()}
          data-testid="restartt"
        >
          <span aria-hidden="true" className={styles.restartIcon}>
            ↺
          </span>
          <span className={styles.restartLabel}>{COPY.header.newGame}</span>
        </button>
      </div>
    </header>
  );
}
