/**
 * Vitest: two projects with different runtimes.
 *
 * - `convex`: `convex/**\/*.test.ts` in `edge-runtime` (matches the Convex
 *   runtime; required by `convex-test`).
 * - `node`: `scripts/**\/*.test.mjs` and `src/**\/*.test.ts` in Node.
 *
 * Playwright specs live in `e2e/` and are excluded here.
 * Source: https://docs.convex.dev/testing/convex-test
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'convex',
          include: ['convex/**/*.test.ts'],
          environment: 'edge-runtime',
          server: { deps: { inline: ['convex-test'] } },
        },
      },
      {
        test: {
          name: 'node',
          include: ['scripts/**/*.test.mjs', 'src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
