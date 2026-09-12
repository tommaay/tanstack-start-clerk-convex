/**
 * Development-only route that throws, so Playwright can assert the catch
 * boundary (`DefaultCatchBoundary`). Production builds answer 404.
 */
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/e2e/error')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
    throw new Error('e2e: intentional route error');
  },
  component: () => null,
});
