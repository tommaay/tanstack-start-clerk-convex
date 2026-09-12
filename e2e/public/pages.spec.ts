/**
 * Signed-out smoke tests: home, posts (Convex query), 404, error boundary,
 * and the sign-in gate on a protected route.
 */
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('home renders and links to posts', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('TanStack Start + Clerk + Convex', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();

  await page.getByRole('link', { name: 'Browse posts' }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
});

test('posts page loads data from Convex', async ({ page }) => {
  await page.goto('/posts');

  await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
  // Either the empty state or at least one post card; both prove the query ran.
  const emptyState = page.getByText('No posts yet.');
  const firstPost = page.locator('[data-slot="card-title"]').first();
  await expect(emptyState.or(firstPost)).toBeVisible();
});

test('unknown routes show the not-found page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');

  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible();
});

test('route errors render the catch boundary', async ({ page }) => {
  await page.goto('/e2e/error');

  await expect(
    page.getByRole('heading', { name: 'Something went wrong' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('protected routes show Clerk sign-in when signed out', async ({ page }) => {
  await page.goto('/dashboard');

  // `.cl-rootBox` is a stable Clerk class on every prebuilt component root.
  await expect(page.locator('.cl-rootBox').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
});
