import { useGame, useGameKeyboard, useGameTouch } from './hooks/useGame';
import { Header } from './components/Header';
import { AIPanel } from './components/AIPanel';
import styles from './App.module.css';

export function App() {
  useGameKeyboard();
  const touch = useGameTouch();
  const { board } = useGame();

  return (
    <>
      <Header />
      <main className={styles.main} {...touch}>
        {/* TODO: replace with <Board /> in next commit */}
        <div className={styles.boardPlaceholder}>
          <pre className={styles.boardPre}>
            {board
              .map((row) =>
                row.map((c) => (c === null ? '·' : c).toString().padStart(4)).join(' '),
              )
              .join('\n')}
          </pre>
        </div>
      </main>
      <AIPanel />
    </>
  );
}
