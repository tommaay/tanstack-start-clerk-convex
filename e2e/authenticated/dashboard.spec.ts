/**
 * Signed-in flow: the dashboard must show the Clerk session *and* the Convex
 * identity. The second card is only populated when the Clerk JWT reaches
 * Convex, so this test proves `CLERK_JWT_ISSUER_DOMAIN` is set correctly on
 * the Convex deployment under test.
 *
 * Runs only when `E2E_CLERK_USER_EMAIL` is set (storage state from
 * `e2e/global.setup.ts`).
 */
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('dashboard shows the Clerk session and the Convex identity', async ({
  page,
}) => {
  const email = process.env.E2E_CLERK_USER_EMAIL as string;

  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const clerkCard = page.locator('[data-slot="card"]', {
    hasText: 'Clerk session',
  });
  await expect(clerkCard.getByText(email, { exact: true })).toBeVisible();

  // Convex card: populated only when the query read the verified JWT.
  const convexCard = page.locator('[data-slot="card"]', {
    hasText: 'Convex identity',
  });
  await expect(
    convexCard.getByText('No identity on the Convex request.'),
  ).toHaveCount(0);
  await expect(convexCard.getByText(email, { exact: true })).toBeVisible();
});

test('home shows the dashboard link when signed in', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('link', { name: 'Go to dashboard' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get started' })).toHaveCount(
    0,
  );
});
