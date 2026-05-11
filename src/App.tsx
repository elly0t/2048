import { useGameKeyboard, useGameTouch } from './hooks/useGame';
import { Header } from './components/Header';
import { Board } from './components/Board';
import { AIPanel } from './components/AIPanel';
import styles from './App.module.css';

export function App() {
  useGameKeyboard();
  const touch = useGameTouch();

  return (
    <>
      <Header />
      <main className={styles.main} {...touch}>
        <Board />
      </main>
      <AIPanel />
    </>
  );
}
