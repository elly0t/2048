import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 2048 },
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
