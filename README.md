# TanStack Start + Clerk + Convex

A full-stack React starter: TanStack Start (SSR) + Clerk (auth) + Convex
(backend), with Tailwind v4 + shadcn/ui.

## Setup

```bash
pnpm install
npx convex dev   # creates the deployment, writes VITE_CONVEX_URL to .env.local
```

Then wire up Clerk (see the [Convex + Clerk guide](https://docs.convex.dev/auth/clerk)):

1. Create a Clerk app and a **JWT template named `convex`** (must match `applicationID` in [`convex/auth.config.ts`](convex/auth.config.ts)).
2. Add `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local` (see [`.env.example`](.env.example)).
3. Set `CLERK_JWT_ISSUER_DOMAIN` (the template's Issuer URL) on the **Convex deployment** — Convex dashboard → Settings → Environment Variables. It's read by the backend, not the app.

```bash
pnpm dev   # runs the app on :3000 + convex dev
```
