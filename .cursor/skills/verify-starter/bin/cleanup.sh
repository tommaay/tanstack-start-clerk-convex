#!/usr/bin/env bash
#
# Tear down what bin/launch.sh started. Evidence survives.
#
#   bin/cleanup.sh
#
# Kills the Vite process group and, only when this run started it, the Convex
# process group (by recorded PID, never by name). Copies run logs into the
# evidence directory, removes `.clerk/` only when keyless mode created it
# during this run, then deletes $VERIFY_HOME/run. Never touches
# $VERIFY_HOME/artifacts.
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

cd "$REPO_ROOT"

if ! load_state; then
  printf '[verify-starter] nothing to clean: no state at %s\n' "$STATE_FILE"
  exit 0
fi
log "cleaning run $RUN_ID"

# Send TERM to the process group; the recorded PID is the group leader (setsid).
stop_group() {
  local pid="$1" label="$2" i
  if ! pid_alive "$pid"; then
    log "$label ($pid) already stopped"
    return
  fi
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  for ((i = 0; i < 20; i++)); do
    pid_alive "$pid" || break
    sleep 0.5
  done
  if pid_alive "$pid"; then
    warn "$label ($pid) ignored TERM; sending KILL"
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  log "$label ($pid) stopped"
}

stop_group "$VITE_PID" "vite"
if [ "$CONVEX_MODE" = anonymous ]; then
  if [ "$CONVEX_REUSED" = 1 ]; then
    log "convex backend was reused; leaving it running"
  elif [ -n "$CONVEX_PID" ]; then
    stop_group "$CONVEX_PID" "convex dev"
  fi
fi

remaining="$(port_listeners "$PORT" | tr '\n' ' ')"
[ -z "$remaining" ] || warn ":$PORT still has listener(s) $remaining that this run did not start; left alone"

if [ "$CLERK_MODE" = keyless ] && [ "$CLERK_DIR_PREEXISTED" = 0 ] && [ -e .clerk ]; then
  rm -rf .clerk
  log "removed .clerk/ (keyless temp keys created during this run)"
fi

mkdir -p "$ARTIFACTS_DIR"
for f in vite.log convex.log; do
  [ -f "$RUN_DIR/$f" ] && cp "$RUN_DIR/$f" "$ARTIFACTS_DIR/$f"
done
cp "$STATE_FILE" "$ARTIFACTS_DIR/state.env"
rm -rf "$RUN_DIR"
log "run state removed; evidence kept at $ARTIFACTS_DIR"
