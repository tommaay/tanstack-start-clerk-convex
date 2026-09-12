/**
 * Clerk test bootstrap. Runs once before the `public` and `authenticated`
 * projects (see `playwright.config.ts`).
 *
 * 1. `clerkSetup()` fetches a Testing Token so headless browsers pass Clerk's
 *    bot detection. It must run in a project-based setup (not a function
 *    `globalSetup`) so `CLERK_FAPI` / `CLERK_TESTING_TOKEN` reach the workers.
 * 2. When `E2E_CLERK_USER_EMAIL` is set, sign that user in with a server-side
 *    sign-in token (no password, no verification UI) and save the storage
 *    state for the `authenticated` project.
 *
 * Create the test user in the Clerk Dashboard first. Use a `+clerk_test`
 * address (e.g. `e2e+clerk_test@example.com`) so Clerk sends no emails.
 *
 * Source: https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows
 */
import {
  clerk,
  clerkSetup,
  setupClerkTestingToken,
} from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE } from './constants';

setup.describe.configure({ mode: 'serial' });

setup('clerk testing token', async () => {
  await clerkSetup();
});

setup('sign in the e2e user and save storage state', async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL;
  setup.skip(!emailAddress, 'E2E_CLERK_USER_EMAIL is not set');

  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: emailAddress as string });

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
