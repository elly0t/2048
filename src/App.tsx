import { useGame, useGameKeyboard } from './hooks/useGame';

// Smoke harness — exercises useGame + useGameKeyboard end-to-end without UI
// polish. Replaced piece-by-piece by Header / Board / AIPanel / StatusOverlay.

export function App() {
  useGameKeyboard();
  const game = useGame();

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h1>2048 (smoke harness)</h1>
      <p>
        score <strong>{game.score}</strong> · best <strong>{game.bestScore}</strong> ·
        status <strong>{game.status}</strong> · largest{' '}
        <strong>{game.largestTile ?? '—'}</strong>
      </p>
      <pre style={{ fontSize: 16, lineHeight: 1.4 }}>
        {game.board
          .map((row) => row.map((c) => (c === null ? '·' : c).toString().padStart(4)).join(' '))
          .join('\n')}
      </pre>
      <p>
        <button onClick={() => game.reset()}>Restart</button>{' '}
        <button onClick={() => game.requestAdvice()} disabled={game.adviceLoading}>
          {game.adviceLoading ? 'Computing…' : 'Suggest move'}
        </button>
      </p>
      {game.advice && (
        <p>
          AI: <strong>{game.advice.direction}</strong> — {game.advice.reasoning}
        </p>
      )}
      <p style={{ color: 'hsl(210 20% 50%)', fontSize: 12 }}>
        arrow keys to move · refresh to test persistence
      </p>
    </div>
  );
}
