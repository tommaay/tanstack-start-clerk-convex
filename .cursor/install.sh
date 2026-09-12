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
#    Each key is managed on its own: a non-blank value already in `.env` wins
#    (user-edited), a blank or missing key takes the current environment value.
#    A first run without secrets therefore does not pin empty keys forever.

# Print the value of `$1` from `.env`, or nothing when the key is absent/blank.
env_file_value() {
  [ -f .env ] || return 0
  grep -E "^$1=" .env | head -n 1 | cut -d= -f2-
}

# Set `$1=$2` in `.env` unless `.env` already holds a non-blank value for `$1`.
ensure_env_key() {
  local name="$1" value="$2"
  if [ -n "$(env_file_value "$name")" ]; then
    return 0
  fi
  if [ -f .env ] && grep -qE "^${name}=" .env; then
    # `grep -v` exits 1 when nothing is left; that is not an error here.
    grep -vE "^${name}=" .env > .env.tmp || true
    mv .env.tmp .env
  fi
  printf '%s=%s\n' "$name" "$value" >> .env
}

# Owner-only mode: the file holds CLERK_SECRET_KEY. The subshell keeps the
# restrictive umask from leaking into later steps. umask only shapes new
# files, so an existing hand-made `.env` (often 0644) is tightened first.
(
  umask 077
  if [ -f .env ]; then
    chmod 600 .env
  fi
  ensure_env_key CLERK_PUBLISHABLE_KEY "${CLERK_PUBLISHABLE_KEY:-}"
  ensure_env_key CLERK_SECRET_KEY "${CLERK_SECRET_KEY:-}"
)
if [ -z "$(env_file_value CLERK_PUBLISHABLE_KEY)" ] || [ -z "$(env_file_value CLERK_SECRET_KEY)" ]; then
  echo "WARNING: CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY are blank in .env. The app will return 500 until you add them (Cursor Secrets, then re-run this script, or edit .env)." >&2
fi

# 3. Anonymous local Convex deployment.
#    Skip when a backend already serves :3210 AND this checkout has its
#    `.env.local` (the `convex` terminal is up on a re-run). A busy port with
#    no `.env.local` means another project's backend owns :3210; `convex dev
#    --once` cannot start a second backend there, so stop with a clear error
#    instead of leaving Vite without VITE_CONVEX_URL.
if curl -sf -o /dev/null http://127.0.0.1:3210/version; then
  if [ ! -f .env.local ]; then
    echo "ERROR: port 3210 already serves a Convex backend, but this checkout has no .env.local. Stop that backend (another project?) and re-run this script." >&2
    exit 1
  fi
  echo "Convex local backend already running on port 3210; skipping deploy."
else
  # Recipe from `npx convex init --help`: `init` writes .env.local without a
  # push, so `env set` has a deployment to target. `convex/auth.config.ts`
  # reads CLERK_JWT_ISSUER_DOMAIN at push time and `convex dev` fails when unset.
  CONVEX_AGENT_MODE=anonymous pnpm exec convex init
  CONVEX_AGENT_MODE=anonymous pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN \
    "${CLERK_JWT_ISSUER_DOMAIN:-https://placeholder.clerk.accounts.dev}"
  CONVEX_AGENT_MODE=anonymous pnpm exec convex dev --once
fi
