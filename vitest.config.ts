import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mismo alias que tsconfig.json ("@/*" → "./*")
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    // Solo tests unitarios. Los E2E viven en tests/e2e y los corre Playwright.
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['tests/setup.ts'],
    css: false,
  },
});
