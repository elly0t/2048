import { useEffect, useRef } from 'react';
import { useGame } from '../hooks/useGame';
import { COPY } from '../i18n/copy';
import { STATUS } from '../store/types';
import styles from './StatusOverlay.module.css';

export function StatusOverlay() {
  const { status, modalOpen, setAcknowledgedStatus, reset } = useGame();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modalOpen) {
      // Wait for the end game tile spawn (~delay 240 + duration 250 ≈ 500ms) to settle before opening.
      const timer = setTimeout(() => {
        dialog.showModal();
        dialog.focus(); // override showModal()'s default auto-focus on first button
      }, 500);
      return () => clearTimeout(timer);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [modalOpen]);

  const isWon = status === STATUS.WON;
  const dismissLabel = isWon ? COPY.status.continueButton : COPY.status.viewBoardButton;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={setAcknowledgedStatus}
      aria-labelledby="status-overlay-title"
      data-testid="status-overlay"
      tabIndex={-1}
    >
      <h2
        id="status-overlay-title"
        className={styles.title}
        data-status={isWon ? 'won' : 'lost'}
        data-testid="status-title"
      >
        {isWon ? COPY.status.won : COPY.status.lost}
      </h2>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={setAcknowledgedStatus}
          className={styles.continueButton}
          data-testid="status-continue"
        >
          {dismissLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className={styles.restartButton}
          data-testid="status-restart"
        >
          {COPY.status.restartButton}
        </button>
      </div>
    </dialog>
  );
}
