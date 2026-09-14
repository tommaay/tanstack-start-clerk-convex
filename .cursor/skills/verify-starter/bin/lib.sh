#!/usr/bin/env bash
#
# Shared helpers for the verify-starter scripts. Source this file; do not run it.
#
# Layout under $VERIFY_HOME (default /tmp/verify-starter):
#   run/state.env            what launch.sh started (PIDs, port, run id, modes)
#   run/vite.log, run/convex.log
#   artifacts/<run-id>/      evidence. cleanup.sh never touches this tree.

VERIFY_HOME="${VERIFY_HOME:-/tmp/verify-starter}"
RUN_DIR="$VERIFY_HOME/run"
STATE_FILE="$RUN_DIR/state.env"
ARTIFACTS_ROOT="$VERIFY_HOME/artifacts"

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

CONVEX_LOCAL_PORT=3210
CURL=(curl -sS --connect-timeout 2 --max-time 10)

log() { printf '[verify-starter] %s\n' "$*"; }
warn() { printf '[verify-starter] WARN: %s\n' "$*" >&2; }
die() { printf '[verify-starter] ERROR: %s\n' "$*" >&2; exit 1; }

# Print the value of key $1 from file $2 (KEY=VALUE lines), or nothing.
env_file_value() {
  [ -f "$2" ] || return 0
  grep -E "^$1=" "$2" | head -n 1 | cut -d= -f2-
}

# Deployment name from `.env.local` (`CONVEX_DEPLOYMENT=anonymous:<name>`).
# Prints the part after the last `:`; empty when the key is absent.
convex_deployment_name() {
  awk -F'[=:]' '/^CONVEX_DEPLOYMENT=/ { print $NF; exit }' "$REPO_ROOT/.env.local" 2>/dev/null
}

# `anonymous` when `.env.local` names an anonymous local deployment, else `cloud`.
convex_mode() {
  local dep
  dep="$(env_file_value CONVEX_DEPLOYMENT "$REPO_ROOT/.env.local")"
  case "$dep" in
    anonymous:*) echo anonymous ;;
    *) echo cloud ;;
  esac
}

# Run the Convex CLI against the deployment `.env.local` names. Anonymous
# deployments need CONVEX_AGENT_MODE=anonymous (same as .cursor/install.sh).
convex_cli() {
  if [ "$(convex_mode)" = anonymous ]; then
    (cd "$REPO_ROOT" && CONVEX_AGENT_MODE=anonymous pnpm exec convex "$@")
  else
    (cd "$REPO_ROOT" && pnpm exec convex "$@")
  fi
}

# `keys` when Clerk keys exist in the environment or `.env`; else `keyless`.
clerk_mode() {
  local pk sk
  pk="${CLERK_PUBLISHABLE_KEY:-$(env_file_value CLERK_PUBLISHABLE_KEY "$REPO_ROOT/.env")}"
  sk="${CLERK_SECRET_KEY:-$(env_file_value CLERK_SECRET_KEY "$REPO_ROOT/.env")}"
  if [ -n "$pk" ] && [ -n "$sk" ]; then echo keys; else echo keyless; fi
}

# PIDs listening on TCP port $1 (one per line). Empty when nothing listens.
port_listeners() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null || true
}

# True when PID $1 is alive.
pid_alive() {
  [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null
}

# Load state.env into the current shell. Fails when there is no run.
load_state() {
  [ -f "$STATE_FILE" ] || return 1
  # shellcheck disable=SC1090
  . "$STATE_FILE"
}

# Poll `curl $2` until it answers (any HTTP status) or $1 seconds pass.
wait_for_http() {
  local seconds="$1" url="$2" i
  for ((i = 0; i < seconds; i++)); do
    if curl -s -o /dev/null --connect-timeout 1 --max-time 5 "$url"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Chromium binary Playwright will launch, or empty when it is not installed.
chromium_path() {
  (cd "$REPO_ROOT" && node -e "import('@playwright/test').then((m) => { const p = m.chromium.executablePath(); process.stdout.write(require('node:fs').existsSync(p) ? p : ''); })" 2>/dev/null)
}
