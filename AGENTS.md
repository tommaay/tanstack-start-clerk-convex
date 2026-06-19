<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# This app

A full-stack React starter: **TanStack Start** (SSR + file-based routing on
Vite) + **Clerk** (auth) + **Convex** (reactive backend/DB), styled with
**Tailwind v4 + shadcn/ui**.

## Commands (pnpm)

- `pnpm dev` — sync Convex once, then run the Vite app (port 3000) + `convex dev` together
- `pnpm build` — production build (`vite build` + `tsc --noEmit`)
- `pnpm lint` — type-check + ESLint (must pass with zero warnings)
- `pnpm format` — Prettier

Always run `pnpm lint` before claiming work is done.

## Conventions

- Use **pnpm**.
- TypeScript: use `import type` for type-only imports.
- Path alias: `~/*` → `src/*` (resolved natively by Vite 8; no `vite-tsconfig-paths`).
- shadcn/ui components live in `src/components/ui/` (added via `pnpm dlx shadcn@latest add <name>`).
- Tailwind v4 is CSS-first: tokens in `src/styles/app.css`, no `tailwind.config.js`.
- Page text: use `~/components/typography` (`H1`/`P`/`Lead`/`Muted`/…), not raw heading/`text-*` classes.
- Page width/gutters: wrap page `<main>`/`<nav>` in `<ContentContainer>` (`~/components/content-container`); don't hardcode `mx-auto max-w-* px-4`.
- Generated, don't edit: `src/routeTree.gen.ts`, `convex/_generated/`.
