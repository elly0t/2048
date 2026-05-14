import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 2048, open: true },
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}));
