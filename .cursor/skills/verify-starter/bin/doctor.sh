#!/usr/bin/env bash
#
# Read-only health check: is the launched instance worth driving?
#
#   bin/doctor.sh
#
# Checks the run recorded by bin/launch.sh: processes alive and owning their
# ports, `GET /` 200 with the nav brand, `GET /<unknown>` 404, Convex backend
# identity (anonymous) and the deployed `posts:list` query, Clerk mode,
# Playwright Chromium, and stray `.clerk/` state in the checkout.
# Exit 0 only when every check passes. Changes nothing.
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FAIL=0
ok() { printf '  ok    %s\n' "$*"; }
bad() { printf '  FAIL  %s\n' "$*"; FAIL=1; }
note() { printf '  note  %s\n' "$*"; }

cd "$REPO_ROOT"

if ! load_state; then
  printf '[verify-starter] no run state at %s. Run bin/launch.sh first.\n' "$STATE_FILE"
  exit 1
fi
printf '[verify-starter] doctor for run %s (%s)\n' "$RUN_ID" "$BASE_URL"

# Processes and ports
if pid_alive "$VITE_PID"; then ok "vite process $VITE_PID alive"; else bad "vite process $VITE_PID is gone (see $RUN_DIR/vite.log)"; fi
listeners="$(port_listeners "$PORT" | tr '\n' ' ')"
if [ -z "$listeners" ]; then
  bad "nothing listens on :$PORT"
else
  owned=0
  for pid in $listeners; do
    # The listener is vite, a child of the pnpm process group we started.
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')"
    [ "$pgid" = "$VITE_PID" ] && owned=1
  done
  if [ "$owned" = 1 ]; then ok ":$PORT owned by our vite process group ($listeners)"; else bad ":$PORT is held by pid(s) $listeners, not by our run (pgid $VITE_PID)"; fi
fi

# App answers with its identity
status="$(curl -s -o "$RUN_DIR/doctor-home.html" -w '%{http_code}' --max-time 60 "$BASE_URL/" || echo 000)"
if [ "$status" = 200 ] && grep -q 'Start · Clerk · Convex' "$RUN_DIR/doctor-home.html"; then
  ok "GET / -> 200 with nav brand 'Start · Clerk · Convex'"
else
  bad "GET / -> $status (expected 200 with the nav brand)"
fi
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$BASE_URL/verify-starter-does-not-exist" || echo 000)"
if [ "$status" = 404 ]; then ok "GET /verify-starter-does-not-exist -> 404"; else bad "GET /verify-starter-does-not-exist -> $status (expected 404)"; fi

# Convex
if [ "$CONVEX_MODE" = anonymous ]; then
  expected="$(convex_deployment_name)"
  running="$("${CURL[@]}" "http://127.0.0.1:$CONVEX_LOCAL_PORT/instance_name" 2>/dev/null || echo '')"
  if [ -n "$running" ] && [ "$running" = "$expected" ]; then
    ok "Convex backend '$running' on :$CONVEX_LOCAL_PORT matches .env.local"
  else
    bad "Convex backend on :$CONVEX_LOCAL_PORT is '${running:-not answering}', expected '$expected'"
  fi
  if [ "$CONVEX_REUSED" = 1 ]; then
    note "Convex backend was reused, not started by this run"
  elif pid_alive "$CONVEX_PID"; then
    ok "convex dev process $CONVEX_PID alive"
  else
    bad "convex dev process $CONVEX_PID is gone (see $RUN_DIR/convex.log)"
  fi
else
  note "cloud Convex deployment: $(env_file_value CONVEX_DEPLOYMENT .env.local)"
fi
if out="$(convex_cli run posts:list 2>&1)" && printf '%s' "$out" | grep -q '^\['; then
  count="$(printf '%s' "$out" | grep -c '"_id"')"
  ok "convex run posts:list -> array with $count post(s)"
else
  bad "convex run posts:list failed: $(printf '%s' "$out" | tail -n 2 | tr '\n' ' ')"
fi

# Clerk
if [ "$CLERK_MODE" = keys ]; then
  ok "Clerk keys present (Testing Token and sign-in paths available)"
else
  note "Clerk keyless mode: signed-out surfaces only; sign-in, dashboard and account cannot be verified"
fi
if [ -e .clerk ] && ! git check-ignore -q .clerk; then
  note ".clerk/ exists in the checkout and is not ignored by git; never commit it (keyless temp keys)"
fi

# Browser
if [ -n "$(chromium_path)" ]; then ok "Playwright Chromium at $(chromium_path)"; else bad "Playwright Chromium missing: pnpm exec playwright install chromium"; fi

# Evidence location
if [ -d "$ARTIFACTS_DIR" ]; then ok "evidence dir $ARTIFACTS_DIR"; else bad "evidence dir $ARTIFACTS_DIR missing"; fi

if [ "$FAIL" = 0 ]; then
  printf '[verify-starter] doctor: healthy\n'
else
  printf '[verify-starter] doctor: UNHEALTHY. Do not drive this instance; run bin/cleanup.sh and relaunch.\n'
fi
exit "$FAIL"
