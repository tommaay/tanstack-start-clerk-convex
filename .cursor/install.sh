#!/usr/bin/env bash
#
# Cloud Agent install script (Cursor Cloud Agents, Devin, Jules, CI-like VMs).
#
# Idempotent: safe to run repeatedly. Installs dependencies, points the
# anonymous Convex deployment at the Clerk JWT issuer, deploys once to generate
# `.env.local` + `convex/_generated/`, and writes a `.env` with the Clerk keys.
# Long-running dev servers start from the `terminals` in
# `.cursor/environment.json`.
#
# Required Cursor Secrets (injected as env vars):
#   CLERK_PUBLISHABLE_KEY   pk_test_… (Clerk dev instance)
#   CLERK_SECRET_KEY        sk_test_…
#   CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
# Optional:
#   E2E_CLERK_USER_EMAIL    enables the signed-in Playwright project
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Dependencies from the frozen lockfile.
#    `--ignore-scripts` skips the root `prepare` script (`lefthook install`),
#    which cannot run in Cloud Agents because Cursor sets a custom
#    `core.hooksPath`.
pnpm install --frozen-lockfile --ignore-scripts

# 2. Clerk keys for the dev server. `clerkMiddleware()` throws on every request
#    without CLERK_SECRET_KEY, so warn loudly when the secrets are missing.
if [ ! -f .env ]; then
  if [ -z "${CLERK_PUBLISHABLE_KEY:-}" ] || [ -z "${CLERK_SECRET_KEY:-}" ]; then
    echo "WARNING: CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY are not set. The app will return 500 until you add them (Cursor Secrets or .env)." >&2
  fi
  cat > .env <<EOF
CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY:-}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-}
EOF
fi

# 3. Anonymous local Convex deployment.
#    Skip when a backend already serves :3210 (the `convex` terminal is up on a
#    re-run): `convex dev --once` refuses to start a second backend there, and a
#    running backend means `.env.local` and generated types already exist.
if curl -sf -o /dev/null http://127.0.0.1:3210/version; then
  echo "Convex local backend already running on port 3210; skipping deploy."
else
  # `convex/auth.config.ts` reads this deployment variable at push time and
  # `convex dev` fails when it is unset. `env set` works before the first deploy.
  CONVEX_AGENT_MODE=anonymous pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN \
    "${CLERK_JWT_ISSUER_DOMAIN:-https://placeholder.clerk.accounts.dev}"
  CONVEX_AGENT_MODE=anonymous pnpm exec convex dev --once
fi
