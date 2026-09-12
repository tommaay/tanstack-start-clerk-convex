# TanStack Start + Clerk + Convex

A full-stack React starter: TanStack Start (SSR) + Clerk (auth) + Convex
(backend), with Tailwind v4 + shadcn/ui. Deploys to Vercel through Nitro.

Agents: read [`AGENTS.md`](AGENTS.md) (generated from
[`INSTRUCTIONS.md`](INSTRUCTIONS.md)).

## Setup

```bash
pnpm install
npx convex dev   # creates the deployment, writes VITE_CONVEX_URL to .env.local
```

Then wire up Clerk (see the [Convex + Clerk guide](https://docs.convex.dev/auth/clerk)):

1. Create a Clerk app and a **JWT template named `convex`** (must match `applicationID` in [`convex/auth.config.ts`](convex/auth.config.ts)).
2. Add `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local` (see [`.env.example`](.env.example)).
3. Set `CLERK_JWT_ISSUER_DOMAIN` (the template's Issuer URL) on the **Convex deployment**: Convex dashboard → Settings → Environment Variables, or `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev`. The backend reads it, not the app.

```bash
pnpm dev   # runs the app on :3000 + convex dev
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | `convex dev --once`, then Vite (:3000) + `convex dev` watcher |
| `pnpm check` | Full gate: format → lint → typecheck → test → convex:check → e2e |
| `pnpm check:core` | Same without Playwright |
| `pnpm lint` / `pnpm lint:fix` | Biome (`src/`, `scripts/`), ESLint (`convex/`), returns-validator and hard-rail scans |
| `pnpm format` / `pnpm format:check` | Biome formatter |
| `pnpm test` | Vitest — `convex-test` specs in `convex/`, script tests in `scripts/` |
| `pnpm test:e2e` | Playwright against `vite dev` (needs Clerk dev keys in `.env.local`) |
| `pnpm convex:generate` / `pnpm convex:check` | Regenerate `convex/_generated/` / fail if it drifted from HEAD |
| `pnpm agents:sync` | Regenerate `AGENTS.md` + `CLAUDE.md` from `INSTRUCTIONS.md` |
| `pnpm build` / `pnpm start` | Nitro production build to `.output/` and local run |

Lefthook installs a pre-commit hook on `pnpm install` (Biome on staged files,
ESLint on `convex/`, rail scans, agent-doc sync).

## Testing

- **Unit** — `pnpm test`. Convex functions run in `convex-test` (edge-runtime).
  Put `foo.test.ts` next to `convex/foo.ts`.
- **e2e** — `pnpm test:e2e`. Uses Clerk Testing Tokens
  ([docs](https://clerk.com/docs/guides/development/testing/playwright/overview)).
  Public specs run with just the Clerk keys. Signed-in specs
  (`e2e/authenticated/`) run when `E2E_CLERK_USER_EMAIL` names an existing
  Clerk user (create one in the Dashboard; use a `+clerk_test` address).
  If another app already listens on :3000, run `E2E_PORT=3123 pnpm test:e2e`.

## CI

[`.github/workflows/check.yml`](.github/workflows/check.yml) runs `pnpm check:core`
against an anonymous local Convex backend (no Convex account needed), then
Playwright when these repository secrets exist:

| Secret | Purpose |
| --- | --- |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk **dev** instance keys (`pk_test_` / `sk_test_`) |
| `CLERK_JWT_ISSUER_DOMAIN` | Issuer URL of the `convex` JWT template; set on the anonymous deployment |
| `E2E_CLERK_USER_EMAIL` | Optional. Enables the signed-in Playwright project |

Without the Clerk secrets the e2e step is skipped with a warning.

## Deploy to Vercel

Nitro is configured in [`vite.config.ts`](vite.config.ts); its Vercel preset is
zero-config ([TanStack hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting),
[TanStack Start on Vercel](https://vercel.com/docs/frameworks/full-stack/tanstack-start),
[Nitro → Vercel](https://nitro.build/deploy/providers/vercel)).

1. Import the repo at vercel.com/new. Build command `pnpm build`, no output
   directory override (Nitro writes the Vercel Build Output).
2. Environment variables: `VITE_CONVEX_URL` (your **prod** Convex URL — it is
   inlined at build time), `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   (production keys).
3. Deploy Convex separately with `npx convex deploy` (human-only; see
   [`docs/cloud-agents.md`](docs/cloud-agents.md)) and set
   `CLERK_JWT_ISSUER_DOMAIN` on the production Convex deployment.

## Cloud agents

`.cursor/environment.json` + `.cursor/install.sh` prepare a Cursor Cloud Agent
with an anonymous Convex backend. Details and required secrets:
[`docs/cloud-agents.md`](docs/cloud-agents.md).
