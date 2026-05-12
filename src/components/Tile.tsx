import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { tileColour } from '../styles/palette';
import type { TileMotion } from '../hooks/motion';
import styles from './Tile.module.css';

type TileProps = {
  motion: TileMotion;
  onGhostDone: (id: string) => void;
};

// Mount at fromRow/fromCol, RAF to row/col → CSS transition fires (TD §3.3).
export function Tile({ motion, onGhostDone }: TileProps) {
  const [pos, setPos] = useState({ row: motion.fromRow, col: motion.fromCol });

  useLayoutEffect(() => {
    setPos({ row: motion.fromRow, col: motion.fromCol });
  }, [motion.fromRow, motion.fromCol, motion.row, motion.col]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPos({ row: motion.row, col: motion.col });
    });
    return () => cancelAnimationFrame(raf);
  }, [motion.fromRow, motion.fromCol, motion.row, motion.col]);

  const { bg, fg } = tileColour(motion.value);
  const style = {
    '--row': pos.row,
    '--col': pos.col,
    backgroundColor: bg,
    color: fg,
  } as CSSProperties;

  return (
    <div
      className={styles.tile}
      style={style}
      data-ghost={motion.ghost || undefined}
      data-spawned={motion.spawned || undefined}
      data-merged={motion.merged || undefined}
      onTransitionEnd={(e) => {
        if (motion.ghost && e.propertyName === 'translate') onGhostDone(motion.id);
      }}
    >
      {motion.value}
    </div>
  );
}
