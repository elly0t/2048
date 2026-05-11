import type { CSSProperties } from 'react';
import { tileColour } from '../styles/palette';
import styles from './Tile.module.css';

type TileProps = {
  row: number;
  col: number;
  value: number;
};

// Position via --row/--col inline CSS props + transform formula in CSS — animation layers in cleanly (TD §3.3).
export function Tile({ row, col, value }: TileProps) {
  const { bg, fg } = tileColour(value);
  const style = {
    '--row': row,
    '--col': col,
    backgroundColor: bg,
    color: fg,
  } as CSSProperties;

  return (
    <div className={styles.tile} style={style}>
      {value}
    </div>
  );
}
