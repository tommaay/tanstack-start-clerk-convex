#!/usr/bin/env bash
#
# Start the app for verification and record what was started.
#
#   bin/launch.sh [--port <n>] [--run-id <id>]
#
# 1. Convex: with an anonymous deployment in `.env.local`, start
#    `CONVEX_AGENT_MODE=anonymous pnpm exec convex dev` unless :3210 already
#    serves that exact deployment (then it is reused and cleanup leaves it).
#    Any other backend on :3210 is an error. With a cloud deployment nothing
#    is started; the deployment is remote.
# 2. Vite: `pnpm dev:web --port <n> --strictPort`. A busy port is an error;
#    the script never drives a server it did not start.
# 3. Ready signal: `GET http://localhost:<n>/` answers 200 and the body carries
#    the nav brand `Start · Clerk · Convex`.
#
# State goes to $VERIFY_HOME/run/state.env (default /tmp/verify-starter).
# Teardown: bin/cleanup.sh.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PORT=3000
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --run-id) RUN_ID="$2"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

cd "$REPO_ROOT"

if [ -f "$STATE_FILE" ]; then
  die "a run already exists ($STATE_FILE). Run bin/cleanup.sh first."
fi
[ -d node_modules ] || die "node_modules missing. Run: pnpm install --frozen-lockfile --ignore-scripts"
[ -n "$(env_file_value VITE_CONVEX_URL .env.local)" ] || die ".env.local has no VITE_CONVEX_URL. Run .cursor/install.sh (cloud) or npx convex dev (local) first."

mkdir -p "$RUN_DIR" "$ARTIFACTS_ROOT/$RUN_ID"

# Playwright's Chromium is required by bin/drive.mjs. Install the browser
# cache when missing; system libraries may still need
# `sudo node node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/cli.js install-deps chromium`.
if [ -z "$(chromium_path)" ]; then
  log "Playwright Chromium missing; running: pnpm exec playwright install chromium"
  pnpm exec playwright install chromium
fi

CONVEX_MODE="$(convex_mode)"
CONVEX_PID=""
CONVEX_REUSED=0
if [ "$CONVEX_MODE" = anonymous ]; then
  expected="$(convex_deployment_name)"
  if "${CURL[@]}" -o /dev/null "http://127.0.0.1:$CONVEX_LOCAL_PORT/version" 2>/dev/null; then
    running="$("${CURL[@]}" "http://127.0.0.1:$CONVEX_LOCAL_PORT/instance_name" 2>/dev/null || true)"
    if [ "$running" != "$expected" ]; then
      die "port $CONVEX_LOCAL_PORT serves Convex backend '${running:-unknown}' but .env.local expects '$expected'. Stop it first."
    fi
    log "Convex backend '$running' already on :$CONVEX_LOCAL_PORT; reusing it (cleanup will leave it running)."
    CONVEX_REUSED=1
  else
    log "starting anonymous Convex backend on :$CONVEX_LOCAL_PORT"
    CONVEX_AGENT_MODE=anonymous setsid nohup pnpm exec convex dev > "$RUN_DIR/convex.log" 2>&1 < /dev/null &
    CONVEX_PID=$!
    if ! wait_for_http 120 "http://127.0.0.1:$CONVEX_LOCAL_PORT/version"; then
      kill -TERM -- "-$CONVEX_PID" 2>/dev/null || true
      die "Convex backend did not answer on :$CONVEX_LOCAL_PORT within 120s. See $RUN_DIR/convex.log"
    fi
    for _ in $(seq 1 120); do
      grep -q "Convex functions ready" "$RUN_DIR/convex.log" && break
      sleep 1
    done
    grep -q "Convex functions ready" "$RUN_DIR/convex.log" || {
      kill -TERM -- "-$CONVEX_PID" 2>/dev/null || true
      die "Convex functions were not deployed within 120s. See $RUN_DIR/convex.log"
    }
  fi
else
  log "cloud Convex deployment ($(env_file_value CONVEX_DEPLOYMENT .env.local)); nothing to start locally."
fi

if [ -n "$(port_listeners "$PORT")" ]; then
  [ "$CONVEX_REUSED" = 1 ] || kill -TERM -- "-$CONVEX_PID" 2>/dev/null || true
  die "port $PORT is busy (pids: $(port_listeners "$PORT" | tr '\n' ' ')). Pick another: bin/launch.sh --port 3123"
fi

CLERK_MODE="$(clerk_mode)"
CLERK_DIR_PREEXISTED=0
[ -e .clerk ] && CLERK_DIR_PREEXISTED=1
if [ "$CLERK_MODE" = keyless ]; then
  warn "no Clerk keys in env or .env: Clerk runs in keyless mode. Signed-out pages work; sign-in cannot be verified."
fi

log "starting Vite on :$PORT"
setsid nohup pnpm dev:web --port "$PORT" --strictPort > "$RUN_DIR/vite.log" 2>&1 < /dev/null &
VITE_PID=$!
BASE_URL="http://localhost:$PORT"
if ! wait_for_http 120 "$BASE_URL/"; then
  kill -TERM -- "-$VITE_PID" 2>/dev/null || true
  [ "$CONVEX_REUSED" = 1 ] || kill -TERM -- "-$CONVEX_PID" 2>/dev/null || true
  die "Vite did not answer on $BASE_URL within 120s. See $RUN_DIR/vite.log"
fi
status="$(curl -s -o "$RUN_DIR/home.html" -w '%{http_code}' --max-time 60 "$BASE_URL/")"
if [ "$status" != 200 ] || ! grep -q 'Start · Clerk · Convex' "$RUN_DIR/home.html"; then
  kill -TERM -- "-$VITE_PID" 2>/dev/null || true
  [ "$CONVEX_REUSED" = 1 ] || kill -TERM -- "-$CONVEX_PID" 2>/dev/null || true
  die "GET / answered $status without the nav brand. See $RUN_DIR/vite.log and $RUN_DIR/home.html"
fi

cat > "$STATE_FILE" <<EOF
RUN_ID=$RUN_ID
PORT=$PORT
BASE_URL=$BASE_URL
VITE_PID=$VITE_PID
CONVEX_MODE=$CONVEX_MODE
CONVEX_PID=$CONVEX_PID
CONVEX_REUSED=$CONVEX_REUSED
CLERK_MODE=$CLERK_MODE
CLERK_DIR_PREEXISTED=$CLERK_DIR_PREEXISTED
ARTIFACTS_DIR=$ARTIFACTS_ROOT/$RUN_ID
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

log "ready: $BASE_URL (run $RUN_ID, clerk=$CLERK_MODE, convex=$CONVEX_MODE$( [ "$CONVEX_REUSED" = 1 ] && echo ' reused'))"
log "state: $STATE_FILE"
log "evidence: $ARTIFACTS_ROOT/$RUN_ID"
