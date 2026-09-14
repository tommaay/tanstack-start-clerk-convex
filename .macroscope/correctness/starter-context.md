---
include:
  - "src/**"
  - "convex/**"
  - "scripts/**"
  - "e2e/**"
  - "playwright.config.ts"
exclude:
  - "src/routeTree.gen.ts"
  - "convex/_generated/**"
---

**Project shape.** TanStack Start (SSR, file routes, Vite 8) + Clerk + Convex, styled with Tailwind v4 and shadcn/ui, deployed to Vercel through Nitro. `~/*` resolves to `./src/*`. `pnpm` only.

**The auth gate throws on purpose.** `src/routes/_authed.tsx` `beforeLoad` throws `new Error('Not authenticated')` when `context.userId` is missing, and its `errorComponent` matches that exact message to render Clerk `<SignIn routing="hash" forceRedirectUrl={location.href}>`. Every other error is rethrown to the default boundary. Do not flag the thrown error as unhandled, do not suggest `redirect()` to a sign-in route (there is none), and do not flag the string comparison. Pages under `src/routes/_authed/` contain no auth checks by design.

**Two Convex providers are intentional.** `src/router.tsx` wraps the router in `<ConvexProvider>` (`Wrap`), and `src/routes/__root.tsx` wraps the tree in `<ClerkProvider>` → `<ConvexProviderWithClerk client={context.convexClient} useAuth={useAuth}>`. This is the shape in the Convex docs for TanStack Start + Clerk (https://docs.convex.dev/client/tanstack/tanstack-start/clerk). `getRouter()` builds a fresh `ConvexReactClient`, `ConvexQueryClient`, and `QueryClient` per request; that is not a leak.

**`beforeLoad` runs on server and client.** In `__root.tsx`, `fetchClerkAuth` is a `createServerFn` (`auth()` + `getToken({ template: 'convex' })`). `ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)` uses optional chaining because `serverHttpClient` exists only during SSR. Reading route context instead of `process.env` in `head()` / `beforeLoad()` is correct, not a missing fallback.

**Client-safe env.** `src/router.tsx` reads `import.meta.env.VITE_CONVEX_URL` (inlined at build time) and throws when it is missing; the throw is the intended fail-fast. `src/utils/env.ts` (`requireEnv`) and `src/utils/logger.ts` (Winston) are Node-only and are imported only from server code; `scripts/check-hard-rails.mjs` enforces the client-folder side of that.

**`console.error` in `src/components/error-boundary.tsx`** carries a `biome-ignore lint/suspicious/noConsole` comment and is the one allowed browser console call. The raw error renders only when `import.meta.env.DEV`.

**`src/routes/e2e/error.tsx` throws on purpose.** It is a dev-only route for the Playwright catch-boundary test; in production its `beforeLoad` throws `notFound()`.

**`TanStackRouterDevtools`** is rendered unconditionally in `__root.tsx`; it is a no-op in production builds.

**Convex demo functions.** `posts.list` is public and unauthenticated by design (demo data) and uses `.collect()` on a ten-row seed table. `posts.populate` is an `action` that calls `ctx.runQuery(api.posts.list, {})`; the explicit `Array<Doc<'posts'>>` annotation avoids a TypeScript circularity, and calling a public sibling here is existing, accepted code. `posts.insert` is an `internalMutation` reached only through `internal.posts.insert`. `user.profile` returns `null` for anonymous callers and picks `subject` / `email` / `name` / `pictureUrl` on purpose; custom claims must not pass through.

**Convex trusts Clerk through `auth.config.ts`.** `process.env.CLERK_JWT_ISSUER_DOMAIN!` is a Convex **deployment** variable; the non-null assertion is deliberate because `convex dev` fails the push when it is unset. `applicationID: 'convex'` is the Clerk JWT template name and matches `getToken({ template: 'convex' })` in `__root.tsx`.

**Generated files.** `src/routeTree.gen.ts` and `convex/_generated/**` are generated and committed; `pnpm convex:check` fails CI when `convex/_generated/` drifts. `convex/_generated/ai/**` belongs to `npx convex ai-files`. Do not review their contents.

**Tests.** Convex functions are proven by `convex-test` specs beside them (`convex/*.test.ts`, `convexTest({ schema, modules })` with `import.meta.glob('./**/*.ts')`; the `/// <reference types="vite/client" />` directive types `import.meta.glob`). Repo scripts are proven by `scripts/*.test.mjs`. When a change to a Convex function has no test change, mention it once; do not repeat it per hunk.

**Playwright.** `playwright.config.ts` loads `.env.local` then `.env` with `process.loadEnvFile` (shell values win), throws at config load when a Clerk key is missing, registers the `authenticated` project only when `E2E_CLERK_USER_EMAIL` is set, and uses `reuseExistingServer: !isCI` for the `vite` web server. The `convex` web server (present only under `CONVEX_AGENT_MODE=anonymous`) uses `reuseExistingServer: true` on purpose so the tests share the running anonymous watcher. The `TEST_WORKER_INDEX` check only silences a duplicate warning in workers. Every spec calls `setupClerkTestingToken({ page })` in `beforeEach` so headless browsers pass Clerk bot detection; it is required, not redundant. `.cl-rootBox` and `[data-slot="..."]` are accepted stable selectors.

**Scripts.** `scripts/*.mjs` parse files with the TypeScript compiler API on purpose (comments, strings, and JSX text must not produce false positives) and guard side effects with an `isMain` check so tests can import them.

**Logging.** `logger` from `~/utils/logger` is the only server logger; `console.*` is banned by Biome.
