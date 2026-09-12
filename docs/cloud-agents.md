# Cloud agents

How cloud coding agents (Cursor Cloud Agents, Devin, Jules, CI) run this repo
without touching your personal Convex dev deployment.

## Convex isolation

- Set `CONVEX_AGENT_MODE=anonymous` **only** for cloud agents and CI. Locally,
  run `convex dev` logged in as yourself.
- Anonymous mode starts a local Convex backend on `127.0.0.1:3210` and writes
  `.env.local` (`CONVEX_DEPLOYMENT=anonymous:anonymous-agent`,
  `VITE_CONVEX_URL=http://127.0.0.1:3210`). Source:
  [Agent mode](https://docs.convex.dev/cli/agent-mode).
- `convex dev --once` deploys and **stops** the backend. Keep a `convex dev`
  watcher running for the app (the `convex` terminal in
  `.cursor/environment.json`; Playwright starts one itself in CI).
- The anonymous deployment starts with **no environment variables**, and
  `env set` needs a configured deployment. Use the order from
  `npx convex init --help`, all with `CONVEX_AGENT_MODE=anonymous`:
  `convex init` (writes `.env.local`, no push) →
  `convex env set CLERK_JWT_ISSUER_DOMAIN <issuer>` → `convex dev --once`.
  `convex/auth.config.ts` fails the push when the variable is missing.
- Never run `npx convex deploy` from an agent session. Production deploys are
  human-only.

## Secrets

Cursor Secrets (cloud agents) / repository secrets (GitHub Actions):

| Name | Required for | Notes |
| --- | --- | --- |
| `CLERK_PUBLISHABLE_KEY` | app boot, e2e | `pk_test_…` dev instance only |
| `CLERK_SECRET_KEY` | app boot, e2e | `sk_test_…`. `clerkMiddleware()` returns 500 on every request without it |
| `CLERK_JWT_ISSUER_DOMAIN` | `convex dev`, signed-in e2e | Issuer URL of the `convex` JWT template. A placeholder lets `convex dev` run but breaks Convex auth |
| `E2E_CLERK_USER_EMAIL` | signed-in e2e (optional) | Existing user; use `+clerk_test` address |

## Cursor Cloud Agent flow

1. `.cursor/install.sh` — `pnpm install --ignore-scripts`, writes `.env` with
   the Clerk keys, sets `CLERK_JWT_ISSUER_DOMAIN` on the anonymous deployment,
   runs `convex dev --once` (skipped when :3210 already answers **and** its
   `GET /instance_name` equals the deployment named in `.env.local`, the same
   check the Convex CLI makes; any other backend on the port is an error).
   Limit: the CLI names every `CONVEX_AGENT_MODE=anonymous` deployment
   `anonymous-agent`, so two agent-mode checkouts on one machine look alike.
2. Terminals — `convex` (anonymous watcher) and `vite` (`pnpm dev:web`).
3. Agent runs `pnpm check` before opening a PR. Without
   `E2E_CLERK_USER_EMAIL` the signed-in project is skipped; say so in the PR.

## GitHub Actions

`.github/workflows/check.yml`:

- `permissions: contents: read`, `persist-credentials: false`, concurrency per
  ref.
- Caches `~/.cache/convex` (local backend binary).
- Sets `CLERK_JWT_ISSUER_DOMAIN` on the anonymous deployment, then
  `pnpm check:core`.
- Runs Playwright only when `CLERK_SECRET_KEY` is present; otherwise emits a
  workflow warning. Uploads `playwright-report` on failure.
