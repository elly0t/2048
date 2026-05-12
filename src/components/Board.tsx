import { useLayoutEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Cell } from './Cell';
import { Tile } from './Tile';
import type { TileMotion } from '../hooks/motion';
import styles from './Board.module.css';

// Two-layer DOM (TD §3.3): static slot grid + absolute tile overlay keyed by stable motion id.
export function Board() {
  const { board, motions } = useGame();
  const [liveMotions, setLiveMotions] = useState<TileMotion[]>([]);

  // Sync incoming motions synchronously before paint to avoid one-frame stale render.
  useLayoutEffect(() => {
    setLiveMotions(motions);
  }, [motions]);

  const handleGhostDone = (id: string) => {
    setLiveMotions((prev) => prev.filter((m) => m.id !== id));
  };

  // Fallback: before the first move, motions is empty — render directly from board values.
  const tilesToRender: TileMotion[] =
    liveMotions.length > 0
      ? liveMotions
      : board.flatMap((row, r) =>
          row
            .map((value, c): TileMotion | null =>
              value === null
                ? null
                : {
                    id: `static-${r}-${c}`,
                    value,
                    row: r,
                    col: c,
                    fromRow: r,
                    fromCol: c,
                    merged: false,
                    spawned: true,
                    ghost: false,
                  },
            )
            .filter((m): m is TileMotion => m !== null),
        );

  return (
    <div className={styles.board} role="grid" aria-label="2048 game board" data-testid="board">
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <Cell key={i} />
        ))}
      </div>
      <div className={styles.tileLayer}>
        {tilesToRender.map((motion) => (
          <Tile key={motion.id} motion={motion} onGhostDone={handleGhostDone} />
        ))}
      </div>
    </div>
  );
}
