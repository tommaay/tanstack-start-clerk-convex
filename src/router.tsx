/**
 * Router factory with Convex (real-time) + React Query integration.
 *
 * A new router is created per request. Each router gets its own
 * `ConvexReactClient` (WebSocket on the client, HTTP on the server),
 * `ConvexQueryClient`, and `QueryClient`, wired together through
 * `setupRouterSsrQueryIntegration` for SSR dehydration/hydration.
 *
 * App-wide error and not-found fallbacks are registered here so routes
 * inherit them.
 */
import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { DefaultCatchBoundary } from '~/components/error-boundary';
import { NotFound } from '~/components/not-found';
import { routeTree } from './routeTree.gen';

/** Build the router for one request (server) or the browser session (client). */
export function getRouter() {
  // `VITE_*` values are inlined at build time; this is client-safe.
  const CONVEX_URL: string | undefined = import.meta.env.VITE_CONVEX_URL;
  if (!CONVEX_URL) {
    throw new Error('missing VITE_CONVEX_URL envar');
  }
  const convex = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  });
  const convexQueryClient = new ConvexQueryClient(convex);

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultPreloadStaleTime: 0, // Let React Query handle all caching
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: NotFound,
    context: { queryClient, convexClient: convex, convexQueryClient },
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        {children}
      </ConvexProvider>
    ),
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
