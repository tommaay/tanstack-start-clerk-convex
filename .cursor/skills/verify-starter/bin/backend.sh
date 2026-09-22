#!/usr/bin/env bash
#
# Convex side of a proof: read stored state or reset the demo fixture.
#
#   bin/backend.sh posts-list             # JSON array of posts (read-only)
#   bin/backend.sh posts-count            # number of posts (read-only)
#   bin/backend.sh posts-reset            # empty the posts table (fixture reset)
#   bin/backend.sh posts-populate         # run the seed action outside the UI
#   bin/backend.sh env-list               # deployment env vars (read-only)
#
# Uses the deployment named in `.env.local`, with CONVEX_AGENT_MODE=anonymous
# for anonymous local deployments. `posts-reset` replaces the table with an
# empty import (`convex import --table posts --replace`), the only way this
# repo offers to delete posts: there is no delete function in convex/posts.ts.
# `posts-populate` is fixture setup for live-update checks, not proof of the
# `Populate posts` button.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

cmd="${1:-}"
case "$cmd" in
  posts-list)
    convex_cli run posts:list
    ;;
  posts-count)
    convex_cli run posts:list | grep -c '"_id"' || true
    ;;
  posts-reset)
    empty="$(mktemp --suffix=.jsonl)"
    convex_cli import --table posts --replace --format jsonLines -y "$empty"
    rm -f "$empty"
    ;;
  posts-populate)
    convex_cli run posts:populate
    ;;
  env-list)
    convex_cli env list
    ;;
  ""|-h|--help)
    sed -n '2,16p' "$0"
    ;;
  *)
    die "unknown command: $cmd"
    ;;
esac
