# TanStack Start + Clerk + Convex — agent brief

Full-stack React starter: **TanStack Start** (SSR, file routes, Vite 8) + **Clerk** (auth) + **Convex** (reactive backend), styled with **Tailwind v4 + shadcn/ui**. Deploys to **Vercel** through Nitro. Use **pnpm**.

`INSTRUCTIONS.md` is the source of truth (edit this file, then run `pnpm agents:sync`). Agents read the generated `AGENTS.md`. Do not edit `AGENTS.md` or `CLAUDE.md`. Sync **keeps** the Convex-managed AI marker block from `npx convex ai-files`; do not put that block in this file (refresh it with `npx convex ai-files update`). Nested `INSTRUCTIONS.md` is allowed except under `convex/`. `docs/` is the deep library — open it when this file says to. Convex API rules: `convex/_generated/ai/guidelines.md` (read it before touching `convex/`).

## Commands

- `pnpm dev` — `convex dev --once`, then Vite (port 3000) + `convex dev` watcher together
- `pnpm check` — **must pass** after any agent change (format → lint → typecheck → test → convex:check → e2e). `pnpm check:core` is the same without e2e
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` / `pnpm lint:fix` — Biome on the repo, ESLint on `convex/` only, `scripts/check-convex-returns.mjs`, `scripts/check-hard-rails.mjs`
- `pnpm format` / `pnpm format:check` — Biome formatter (not Prettier)
- `pnpm test` — Vitest: `convex/**/*.test.ts` (convex-test, edge-runtime) and `scripts/**/*.test.mjs` (node)
- `pnpm test:e2e` — Playwright against `vite dev` with real Clerk **dev** keys from `.env.local`. Signed-in specs need `E2E_CLERK_USER_EMAIL`. If :3000 is busy, `E2E_PORT=3123 pnpm test:e2e`
- `pnpm convex:generate` — `convex dev --once`; commit `convex/_generated/` after Convex modules change (`pnpm convex:check` fails when it differs from HEAD). CI and cloud agents run it with `CONVEX_AGENT_MODE=anonymous`
- `pnpm agents:sync` — regenerate `AGENTS.md` / `CLAUDE.md` from `INSTRUCTIONS.md`
- `pnpm build` / `pnpm start` — Nitro production build to `.output/` and local run
- Pre-commit (Lefthook): Biome on staged files, ESLint on `convex/`, rails, agent-doc sync. Not `pnpm check`. CI still must pass

## Conventions

- pnpm (not npm/yarn)
- Biome formats the repo and lints `src/` + `scripts/`. ESLint lints `convex/` only. Do not add Prettier
- `import type` for type-only imports (`useImportType` is an error). After `pnpm dlx shadcn@latest add <name>`, run `pnpm lint:fix`
- Functions with 2+ args: object param in, object out
- JSDoc on all files — top-level file doc + each exported function
- Path alias: `~/*` → `./src/*` (Vite 8 resolves tsconfig paths natively)
- Convex: every `query` / `mutation` / `action` (and `internal*`) has `args` **and** `returns`. Use `schema.doc("table")` for whole documents. New Convex function → `convex-test` spec beside it. Read `convex/_generated/ai/guidelines.md` first
- Auth gate: routes under `src/routes/_authed/` are protected by `_authed.tsx` (`beforeLoad` throws → Clerk `<SignIn>` renders). Public routes live at `src/routes/` root. Do not add auth checks inside page components
- Convex reads the Clerk JWT template named `convex`; `CLERK_JWT_ISSUER_DOMAIN` lives on the **Convex deployment**, not in `.env`
- Page text: `~/components/typography` (`H1`/`P`/`Lead`/`Muted`/…), not raw headings or `text-*` classes
- Page width: wrap page `<main>`/`<nav>` in `<ContentContainer>` (`~/components/content-container`); do not hardcode `mx-auto max-w-* px-4`
- shadcn/ui components live in `src/components/ui/`. Tailwind v4 is CSS-first: tokens in `src/styles/app.css`, no `tailwind.config.js`
- Logging (server): `import { logger } from '~/utils/logger'` in server functions only — never `console.log`. Browser error boundaries may `console.error` with a `biome-ignore` comment
- Server env: `requireEnv()` from `~/utils/env` inside server functions. Client values use `import.meta.env.VITE_*`
- New page → Playwright spec in `e2e/public/` (or `e2e/authenticated/` behind `_authed`). See [docs/feature-map.md](docs/feature-map.md)
- Generated, don't edit: `src/routeTree.gen.ts`, `convex/_generated/`, `AGENTS.md`, `CLAUDE.md`
- Do not store history in source comments (`// do not … because`). Put rules in this file or lint

## Pull requests

- **Never a draft:** open PRs **ready for review**. Create a draft only when the user asks for one
- **Atomic scope:** one route **or** one Convex function group **or** one schema change per PR
- **Before review:** run `pnpm check` on the PR branch. CI is the hard gate — do not request review with a red check
- **PR body — verification:** state what you verified and what you did **not** verify. Copy the checklist from [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)
- **Signed-in flows:** say **signed-in e2e was not run** unless `E2E_CLERK_USER_EMAIL` was set for `pnpm test:e2e`
- **Soft review (optional):** Bugbot / CodeRabbit on PRs is allowed. It does not replace `pnpm check`

## Cloud agents

Rules: [docs/cloud-agents.md](docs/cloud-agents.md).

- `CONVEX_AGENT_MODE=anonymous` is for **cloud agents and CI only** — never for your normal local `convex dev`
- Anonymous deployments start empty: run `convex env set CLERK_JWT_ISSUER_DOMAIN …` before the first `convex dev --once` (see `.cursor/install.sh`)
- Never run `npx convex deploy` from an agent session (production deploy is human-only)
- Follow the same PR policy as local agents

## Docs index

- `docs/feature-map.md` — route → files → tests map; how to add a page
- `docs/cloud-agents.md` — cloud agent setup, secrets, Convex isolation
- `convex/_generated/ai/guidelines.md` — Convex API rules (generated, read-only)
- Official: [TanStack Start](https://tanstack.com/start/latest), [Clerk + TanStack](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart), [Convex + Clerk](https://docs.convex.dev/auth/clerk), [Hosting (Vercel/Nitro)](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)

## Gotchas

- Route `head()` and `beforeLoad()` run in the browser too: no `process.env` there. Pass server values through a server function (`createServerFn`) and read `match.context`
- `~/utils/logger` (Winston) and `~/utils/env` are Node-only. Import them only where TanStack Start strips server code (server function handlers, `.server()` middleware). `scripts/check-hard-rails.mjs` blocks imports from `src/components/**` and `src/lib/**`
- `VITE_*` values are inlined at build time — set `VITE_CONVEX_URL` in Vercel **before** building
- `convex dev` fails with "CLERK_JWT_ISSUER_DOMAIN … not set" when the deployment variable is missing; set it on the deployment, not in `.env.local`
- Playwright with `reuseExistingServer` reuses **any** server on the port. Another project on :3000 makes every spec fail — use `E2E_PORT`
- `TanStackRouterDevtools` is a no-op in production builds; no `import.meta.env.DEV` gate needed
- Clerk `<SignIn>` in `_authed.tsx` uses `routing="hash"` so it works on any protected URL without a dedicated sign-in route
