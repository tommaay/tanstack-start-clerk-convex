# Feature map

Route → files → tests. Update this table when you add or move a page.

| Route | Route file | Auth | Data | e2e spec |
| --- | --- | --- | --- | --- |
| `/` | `src/routes/index.tsx` | public | — | `e2e/public/pages.spec.ts` |
| `/posts` | `src/routes/posts.tsx` | public | `api.posts.list`, `api.posts.populate` | `e2e/public/pages.spec.ts` |
| `/dashboard` | `src/routes/_authed/dashboard.tsx` | `_authed` | `api.user.profile` | `e2e/authenticated/dashboard.spec.ts` |
| `/user` | `src/routes/_authed/user.tsx` | `_authed` | `api.user.profile` | — |
| `/e2e/error` | `src/routes/e2e/error.tsx` | public, **dev only** | throws | `e2e/public/pages.spec.ts` |
| `*` (404) | `src/components/not-found.tsx` via `router.tsx` | — | — | `e2e/public/pages.spec.ts` |

Shared shell: `src/routes/__root.tsx` (Clerk provider, nav, Convex auth token
via `fetchClerkAuth` server function). Error fallback:
`src/components/error-boundary.tsx`.

## Add a page

1. Create `src/routes/<name>.tsx` (public) or `src/routes/_authed/<name>.tsx`
   (signed-in). `vite dev` / `vite build` regenerates `src/routeTree.gen.ts`.
2. Use `~/components/typography` for text and `<ContentContainer>` for width.
3. Data: `convexQuery(api.<module>.<fn>, args)` in `loader` with
   `context.queryClient.ensureQueryData`, then `useSuspenseQuery` in the
   component (see `posts.tsx`).
4. Add a nav link in `__root.tsx` when the page belongs in the header.
5. Add a Playwright spec in `e2e/public/` or `e2e/authenticated/`. Prefer
   role/text locators; `data-slot="card"` etc. come from shadcn.
6. Add the row above. Run `pnpm check`.

## Add a Convex function

1. `convex/<module>.ts` — `args` **and** `returns` validators
   (`scripts/check-convex-returns.mjs` fails otherwise). Whole documents:
   `schema.doc("table")`.
2. `convex/<module>.test.ts` — `convex-test`; `t.withIdentity({...})` for
   signed-in behavior.
3. `pnpm convex:generate` and commit `convex/_generated/`.

## Verification tiers

| Tier | Command | Covers |
| --- | --- | --- |
| Static | `pnpm lint`, `pnpm typecheck` | Biome, ESLint (convex), validators, rails, TS |
| Unit | `pnpm test` | Convex functions, repo scripts |
| Drift | `pnpm convex:check` | `convex/_generated/` matches HEAD |
| Browser | `pnpm test:e2e` | SSR pages, Convex data, Clerk gate; signed-in with `E2E_CLERK_USER_EMAIL` |
| Prod build | `pnpm build && pnpm start` | Nitro output boots (needs Clerk keys in env) |
