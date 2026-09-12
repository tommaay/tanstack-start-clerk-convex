/**
 * Playwright e2e against the Vite dev server with real Clerk dev-instance keys.
 *
 * Projects:
 * - `setup` — `clerkSetup()` (Testing Token) and, when `E2E_CLERK_USER_EMAIL`
 *   is set, a one-time sign-in whose storage state authenticated specs reuse.
 * - `public` — signed-out flows (`e2e/public/**`).
 * - `authenticated` — signed-in flows (`e2e/authenticated/**`); only
 *   registered when `E2E_CLERK_USER_EMAIL` is set.
 *
 * Env (see `.env.example`): `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
 * (`pk_test_*` / `sk_test_*` only), optional `E2E_CLERK_USER_EMAIL`. Local runs
 * read `.env` / `.env.local`; CI passes them as job env from secrets.
 *
 * Servers: `pnpm dev:web` on :3000 (`E2E_PORT` overrides). When `CONVEX_AGENT_MODE=anonymous` (CI,
 * cloud agents) an anonymous local Convex backend is started too; `.env.local`
 * must already point at it (`pnpm convex:generate` writes it).
 *
 * Sources:
 * - https://clerk.com/docs/guides/development/testing/playwright/overview
 * - https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
 * - https://playwright.dev/docs/test-webserver
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE } from './e2e/constants';

// Node's .env loader keeps a variable that is already set (documented for
// `--env-file`: https://nodejs.org/api/cli.html#--env-fileconfig; verified for
// `process.loadEnvFile` on Node 24). Load order = precedence: shell/CI, then
// `.env.local`, then `.env`.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

const isCI = Boolean(process.env.CI);
// Set E2E_PORT when another project already listens on :3000; with
// `reuseExistingServer` Playwright would otherwise test that app.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;
const useAnonymousConvex = process.env.CONVEX_AGENT_MODE === 'anonymous';
const hasE2EUser = Boolean(process.env.E2E_CLERK_USER_EMAIL);

for (const name of ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY']) {
  if (!process.env[name]) {
    throw new Error(
      `Playwright needs ${name} (Clerk dev instance). Add it to .env.local or set it in CI secrets.`,
    );
  }
}

// Workers re-evaluate this config; TEST_WORKER_INDEX is only set inside them.
if (!hasE2EUser && process.env.TEST_WORKER_INDEX === undefined) {
  process.stderr.write(
    '[playwright] E2E_CLERK_USER_EMAIL is not set: the "authenticated" project is skipped.\n',
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    ...(useAnonymousConvex
      ? [
          {
            name: 'convex',
            command: 'pnpm exec convex dev',
            url: 'http://127.0.0.1:3210/version',
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]
      : []),
    {
      name: 'vite',
      command: `pnpm dev:web --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'public',
      testMatch: /public\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    ...(hasE2EUser
      ? [
          {
            name: 'authenticated',
            testMatch: /authenticated\/.*\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
});
