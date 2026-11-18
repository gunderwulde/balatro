import { defineConfig } from 'vitest/config';

// base = nombre del repo para GitHub Pages (https://gunderwulde.github.io/balatro/)
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/balatro/' : '/',
  test: { include: ['tests/**/*.test.ts'] },
});
