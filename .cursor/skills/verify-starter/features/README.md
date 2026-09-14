# verify-starter feature map

Maintained source for verifying the user-facing behavior of this TanStack Start + Clerk + Convex starter. Read this index, then use the matching feature file as the recipe. Routes come from `src/routes/**`; the shell (nav, sign-in button, user menu) from `src/routes/__root.tsx`.

## Baseline preconditions

- Launched with `.cursor/skills/verify-starter/bin/launch.sh --port 3123` (any free port; `state.env` records `BASE_URL`).
- `.cursor/skills/verify-starter/bin/doctor.sh` reports `healthy` and prints the Clerk mode (`keys` or `keyless`) and the Convex mode (`anonymous` or `cloud`).
- `posts` table empty unless a recipe says otherwise: `.cursor/skills/verify-starter/bin/backend.sh posts-count` prints `0` (reset with `posts-reset`).
- Signed-out browser state. Every `drive.mjs` invocation starts a fresh Chromium context, so this holds unless you pass `--sign-in`.
- Never drive a Vite server this run did not start. Reusing the anonymous Convex backend on :3210 is allowed when `launch.sh` reported `reused`.

## Driving conventions

- Commands run from the repo root; `drive.mjs` = `node .cursor/skills/verify-starter/bin/drive.mjs`.
- One `drive.mjs` invocation per recipe: the browser session does not survive between invocations. Pass `--feature <id>` so evidence lands in its own directory.
- Prefer `role=` + `name=` locators, then `data-slot` attributes from shadcn (`[data-slot="card"]`, `[data-slot="card-title"]`, `[data-slot="dropdown-menu-trigger"]`), then Clerk's `.cl-*` class roots. No coordinates, no nth-child chains.
- Add `exact` when a name is a substring of another (`name=Posts exact`: `Browse posts` also matches).
- Before clicking a React handler (`Populate posts`, `Show a toast`, `Sign in`) on a freshly loaded page, wait for hydration: `wait-convex` on pages with Convex queries (`/posts`, `/dashboard`, `/user`), `wait-idle` elsewhere. Links (`<a href>`) work before hydration.
- Treat every step string as literal, including quotes.

## Proof and skip reporting

- A proof = the `steps.jsonl` + per-step screenshots of the real user path, plus an `aria` snapshot and a named `screenshot` at the claimed end state, plus the backend check the recipe names (`backend.sh posts-count`, `env-list`).
- Record the feature file and sub-feature IDs the drive covered next to the artifact path.
- A page that returns the expected content with a surprising HTTP status is not a pass: `expect-status` is part of each recipe. Observed statuses in this app: `200` public pages, `404` unknown routes, `500` for protected routes while signed out and for the dev-only `/e2e/error` route (the shell still renders).
- Keyless Clerk mode cannot reach signed-in features. Report them as `verified-unreachable` with the prerequisite (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, Clerk JWT template `convex`, `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment, an existing `+clerk_test` user). Do not report a keyless sign-in attempt as coverage.
- Restore the fixture (`posts-reset`) after a mutation. Never delete `/tmp/verify-starter/artifacts`.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then exactly four H2 sections in this order:

1. `Sub-features`: short IDs with one line for each behavior.
2. `How to get to it (user POV)`: every user entry point.
3. `Driving it with drive.mjs`: starts with `Preconditions:`, then labeled bullets that pair each user action with the exact step and the observable result, then the complete invocation.
4. `Gotchas`: traps that waste or invalidate a run.

## Features

- [Home](./home.md): brand, nav, hero card, signed-out calls to action (`Get started`, `Browse posts`), signed-in `Go to dashboard`.
- [Posts](./posts.md): Convex-backed list, empty state, `Populate posts` seed action with toast and stored rows.
- [Sign in and the auth gate](./sign-in-gate.md): `Sign in` / `Get started` modal, protected `/dashboard` and `/user` rendering Clerk `SignIn` when signed out, Testing-Token sign-in, signed-in nav and sign out.
- [Dashboard and Account](./dashboard-and-account.md): Clerk session card, Convex identity card (the Clerk → Convex JWT proof), sonner toast, `/user` account card, user menu navigation.
- [Not found and error boundary](./not-found-and-errors.md): 404 page with `Go home`, catch boundary on `/e2e/error` with `Try again`.
