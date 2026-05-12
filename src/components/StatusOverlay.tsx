import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { COPY } from '../i18n/copy';
import { STATUS, type GameStatus } from '../store/types';
import styles from './StatusOverlay.module.css';

export function StatusOverlay() {
  const { status, reset } = useGame();
  // Lazy init: if we mount into an end-state, assume already acknowledged — don't re-prompt on refresh.
  const [dismissedFor, setDismissedFor] = useState<GameStatus | null>(() =>
    status === STATUS.WON || status === STATUS.LOST ? status : null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  const isEndState = status === STATUS.WON || status === STATUS.LOST;
  const shouldShow = isEndState && status !== dismissedFor;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (shouldShow) dialog.showModal();
    else if (dialog.open) dialog.close();
  }, [shouldShow]);

  const handleDismiss = () => setDismissedFor(status);
  const handleRestart = () => {
    setDismissedFor(null);
    reset();
  };

  const isWon = status === STATUS.WON;
  const dismissLabel = isWon ? COPY.status.continueButton : COPY.status.viewBoardButton;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={handleDismiss}
      aria-labelledby="status-overlay-title"
      data-testid="status-overlay"
    >
      <h2 id="status-overlay-title" className={styles.title} data-testid="status-title">
        {isWon ? COPY.status.won : COPY.status.lost}
      </h2>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={handleDismiss}
          className={styles.continueButton}
          data-testid="status-continue"
        >
          {dismissLabel}
        </button>
        <button
          type="button"
          onClick={handleRestart}
          className={styles.restartButton}
          autoFocus
          data-testid="status-restart"
        >
          {COPY.status.restartButton}
        </button>
      </div>
    </dialog>
  );
}
