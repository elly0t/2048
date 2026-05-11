import { useGame } from '../hooks/useGame';
import { Cell } from './Cell';
import { Tile } from './Tile';
import styles from './Board.module.css';

// Two-layer DOM (TD §3.3): static slot grid + absolute tile overlay. Animation-ready when stable IDs land.
export function Board() {
  const { board } = useGame();

  return (
    <div className={styles.board}>
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <Cell key={i} />
        ))}
      </div>
      <div className={styles.tileLayer}>
        {board.flatMap((row, r) =>
          row.map((value, c) =>
            value === null ? null : (
              <Tile key={`${r}-${c}`} row={r} col={c} value={value} />
            ),
          ),
        )}
      </div>
    </div>
  );
}
