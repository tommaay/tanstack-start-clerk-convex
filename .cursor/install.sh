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
#    Skip when a backend already serves :3210 AND it is the deployment this
#    checkout's `.env.local` names (the `convex` terminal is up on a re-run).
#    The check mirrors the Convex CLI: `GET /instance_name` must equal the
#    deployment name (`ensureBackendRunning` in convex/dist/cli.bundle.cjs).
#    `.env.local` holds `CONVEX_DEPLOYMENT=anonymous:<name>`; the part after
#    the last `:` is that name. Any other backend on :3210 is an error, since
#    `convex dev --once` cannot start a second one there and Vite would point
#    at a foreign deployment. Limit: every CONVEX_AGENT_MODE=anonymous checkout
#    is named `anonymous-agent` by the CLI, so two agent-mode checkouts on one
#    machine cannot be told apart here (nor by the CLI).
#    Both probes carry timeouts: a socket that accepts but never answers must
#    not hang the install; it falls through to the deploy path, where the CLI
#    reports the port conflict itself.
CURL_PROBE=(curl -sf --connect-timeout 2 --max-time 5)
if "${CURL_PROBE[@]}" -o /dev/null http://127.0.0.1:3210/version; then
  expected=""
  if [ -f .env.local ]; then
    expected="$(awk -F'[=:]' '/^CONVEX_DEPLOYMENT=/ { print $NF; exit }' .env.local)"
  fi
  running="$("${CURL_PROBE[@]}" http://127.0.0.1:3210/instance_name || true)"
  if [ -z "$expected" ] || [ "$running" != "$expected" ]; then
    echo "ERROR: port 3210 serves Convex backend '${running:-unknown}', but this checkout expects '${expected:-none (no CONVEX_DEPLOYMENT in .env.local)}'. Stop that backend and re-run this script." >&2
    exit 1
  fi
  echo "Convex local backend '$running' already running on port 3210; skipping deploy."
else
  # Recipe from `npx convex init --help`: `init` writes .env.local without a
  # push, so `env set` has a deployment to target. `convex/auth.config.ts`
  # reads CLERK_JWT_ISSUER_DOMAIN at push time and `convex dev` fails when unset.
  CONVEX_AGENT_MODE=anonymous pnpm exec convex init
  CONVEX_AGENT_MODE=anonymous pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN \
    "${CLERK_JWT_ISSUER_DOMAIN:-https://placeholder.clerk.accounts.dev}"
  CONVEX_AGENT_MODE=anonymous pnpm exec convex dev --once
fi
