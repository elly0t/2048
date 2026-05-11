import { useGame } from '../hooks/useGame';
import { COPY } from '../i18n/copy';
import styles from './Header.module.css';

export function Header() {
  const { score, bestScore, reset } = useGame();

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{COPY.app.title}</h1>
      <div className={styles.scores}>
        <div className={styles.scoreBlock}>
          <span className={styles.label}>{COPY.header.scoreLabel}</span>
          <span className={styles.value} aria-live="polite">
            {score}
          </span>
        </div>
        <div className={styles.scoreBlock}>
          <span className={styles.label}>{COPY.header.bestLabel}</span>
          <span className={styles.value} aria-live="polite">
            {bestScore}
          </span>
        </div>
      </div>
      <button className={styles.restart} onClick={() => reset()}>
        Restart
      </button>
    </header>
  );
}
