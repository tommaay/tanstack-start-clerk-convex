---
name: verify-starter
description: "Drive the TanStack Start + Clerk + Convex starter (this repo) through its web UI the way a user does and capture proof: launch Vite + the local Convex backend, health-check, run Playwright step recipes against real routes (/, /posts, /dashboard, /user, 404, error boundary), record screenshots/ARIA/console/Convex state, tear down. Use when a change must be proven in the running app, when reproducing a UI bug, or before opening a PR that touches routes, Convex functions, or Clerk wiring."
---

# verify-starter

Project-local verification skill for this repo. Surface: **web UI** served by Vite on `http://localhost:<port>` (default 3000), backed by a **Convex** deployment (anonymous local backend on `127.0.0.1:3210` in cloud/CI, or the developer's cloud deployment) and **Clerk** auth. There is no CLI or public API surface; Convex functions are reached only through the UI or `convex run`.

All commands run from the repo root. `bin/` paths below are relative to `.cursor/skills/verify-starter/`.

## Modes you will find yourself in

Detected by `bin/launch.sh` and shown by `bin/doctor.sh`:

| Dimension | Value | How it is detected | Consequence |
| --- | --- | --- | --- |
| Clerk | `keys` | `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in the shell env or `.env` | Sign-in via Testing Token works (`--clerk-testing-token`, `--sign-in`). Dashboard/Account verifiable when the Clerk instance has a JWT template named `convex` **and** `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment is that template's issuer. |
| Clerk | `keyless` | both keys blank/missing | `@clerk/tanstack-react-start` starts in keyless mode, creates a temporary Clerk app and writes `.clerk/.tmp/keyless.json` (untracked, contains an `sk_test_` key: never commit it). Signed-out surfaces work. Signing in breaks every page with `Something went wrong` (`Not Found`) because the temp instance has no `convex` JWT template. |
| Convex | `anonymous` | `.env.local` has `CONVEX_DEPLOYMENT=anonymous:<name>` | Launch starts/reuses the local backend on :3210. `convex` CLI calls need `CONVEX_AGENT_MODE=anonymous` (the helpers add it). |
| Convex | `cloud` | any other `CONVEX_DEPLOYMENT` | Nothing to start locally; `convex run` targets the remote deployment. Not exercised while this skill was generated. |

The generating run was `keyless` + `anonymous` (Cursor Cloud Agent without Clerk secrets). Everything marked **proven** below was executed in that mode.

## Isolation

- One verification instance per machine when Convex is `anonymous`: the Convex CLI names every anonymous deployment `anonymous-agent` and binds :3210. `bin/launch.sh` reuses a backend that already serves that exact name (and then leaves it alone on cleanup) and refuses any other backend on :3210.
- Vite: one instance per port. `bin/launch.sh` refuses a busy port instead of reusing a foreign server (Playwright's `reuseExistingServer` gotcha from `README.md`). In the Cursor Cloud environment the `vite` terminal from `.cursor/environment.json` already holds :3000, so use `--port 3123`.
- Browser state is per `drive.mjs` invocation (fresh Chromium context). Convex data is shared by every instance on the same deployment: `posts` rows written by one drive are visible to the next. Reset with `bin/backend.sh posts-reset`.

## Launch

```bash
.cursor/skills/verify-starter/bin/launch.sh --port 3123
```

Does, in order: checks `node_modules` and `.env.local` (`VITE_CONVEX_URL`); installs Playwright Chromium into `~/.cache/ms-playwright` if missing (system libraries: `sudo node node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/cli.js install-deps chromium`); starts `CONVEX_AGENT_MODE=anonymous pnpm exec convex dev` (anonymous mode, unless :3210 already serves the deployment named in `.env.local`) and waits for `GET http://127.0.0.1:3210/version` plus the log line `Convex functions ready`; starts `pnpm dev:web --port <port> --strictPort`; waits for `GET /` to answer.

Ready signal: `GET http://localhost:<port>/` returns **200** and the body contains the nav brand `Start · Clerk · Convex`. The launcher prints `ready: http://localhost:<port> (run <id>, clerk=<mode>, convex=<mode>)`.

State: `/tmp/verify-starter/run/state.env` (override the root with `VERIFY_HOME`). Logs: `/tmp/verify-starter/run/vite.log`, `convex.log`. A second `launch.sh` while state exists fails: run cleanup first.

Teardown: `bin/cleanup.sh` (see Cleanup).

## Doctor

```bash
.cursor/skills/verify-starter/bin/doctor.sh
```

Read-only. Exit 0 only when all pass:

- Vite process (recorded PID) alive and the listener on `<port>` belongs to its process group.
- `GET /` → 200 with `Start · Clerk · Convex`; `GET /verify-starter-does-not-exist` → 404.
- Anonymous Convex: `GET http://127.0.0.1:3210/instance_name` equals the name in `.env.local`; our `convex dev` PID alive (or `reused` noted).
- `convex run posts:list` returns a JSON array (functions deployed; prints the post count).
- Clerk mode (`keys` / `keyless`), Playwright Chromium present, evidence directory exists.
- Note when `.clerk/` exists and is not git-ignored.

Run it before the first drive and again after any drive that failed for a reason you do not understand. `UNHEALTHY` means: do not drive; `bin/cleanup.sh` then relaunch.

## Drive

Harness: `bin/drive.mjs`, a Playwright (library mode, `@playwright/test` already in devDependencies) step runner. One invocation = one fresh headless Chromium session. Each step is one shell argument; quotes inside a step group words.

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature posts \
  'goto /posts' 'expect-status 200' \
  'expect role=heading name=Posts' \
  'wait-convex' \
  'click role=button name="Populate posts"' \
  'expect-text "Posts populated"' \
  'expect css=[data-slot="card-title"] count=10' \
  'aria after-populate' 'screenshot after-populate'
```

Steps: `goto <path>`, `wait-convex`, `wait-idle`, `click <locator>`, `fill <locator> <value>`, `press <key>`, `expect <locator> [visible|hidden|enabled|disabled|count=N|min=N]`, `expect-text <text>`, `expect-url <regex>`, `expect-status <code>`, `screenshot <name>`, `aria <name>`, `sleep <ms>`, `note <text>`. Locators: `role=<role> name=<name> [exact]`, `text=<text> [exact]`, `label=`, `placeholder=`, `css=<selector>`, `within=<css> within-text=<text>` (scope to a container such as a shadcn card), `first`, `nth=<n>`. `node .cursor/skills/verify-starter/bin/drive.mjs --help` prints the full reference.

Stable handles in this app (from `src/routes/**` and `src/components/**`):

- Nav: `role=link name="Start · Clerk · Convex"`, `role=link name=Home`, `role=link name=Posts exact` (plain `name=Posts` also matches `Browse posts`), `role=link name=Dashboard` (signed-in only), `role=button name="Sign in"` (signed-out only), avatar menu trigger `css=[data-slot="dropdown-menu-trigger"]` (signed-in only; its accessible name is the avatar `alt`, the user's full name, or the initials fallback when the image does not load, so do not rely on the name), menu items `role=menuitem name=Dashboard` / `name=Account` / `name="Sign out"`.
- Home: `text="TanStack Start + Clerk + Convex" exact`, `role=button name="Get started"`, `role=link name="Browse posts"`, `role=link name="Go to dashboard"` (signed-in).
- Posts: `role=heading name=Posts`, `role=button name="Populate posts"` (only while the table is empty; label `Populating…` while running), empty state `text="No posts yet."`, cards `css=[data-slot="card-title"]`, toast `text="Posts populated"` / `text="Could not populate posts"`.
- Clerk UI: `.cl-rootBox` (every prebuilt component root), modal `role=dialog` with `role=button name="Close modal"`, `role=textbox name="Email address"`, `role=button name=Continue exact` (`Continue with Google` also matches without `exact`). The heading reads `Sign in to <Clerk app name>` (`My Application` in keyless mode) so do not assert it.
- Dashboard: `role=heading name=Dashboard`, cards `within=[data-slot="card"] within-text="Clerk session"` / `within-text="Convex identity"` / `within-text=Components`, `text="No identity on the Convex request."`, `role=button name="Show a toast"`, toast `text="Hello from sonner"`.
- Account (`/user`): card title `css=[data-slot="card-title"]` reading `Account`, paragraph `Welcome! Your email address is <email>.` or `You are not logged in.`
- Not found: `role=heading name=404`, `role=link name="Go home"`. Error boundary: `role=heading name="Something went wrong"`, `role=button name="Try again"`, dev-only raw error text.

Signed-in drives (Clerk `keys` mode only; the repo's documented path, `e2e/global.setup.ts`): create a Clerk dev-instance user with a `+clerk_test` address, then

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature dashboard \
  --clerk-testing-token --sign-in e2e+clerk_test@example.com \
  'goto /' 'expect role=link name="Go to dashboard"' \
  'click role=link name="Go to dashboard"' 'expect role=heading name=Dashboard' \
  'expect within=[data-slot="card"] within-text="Clerk session" text=e2e+clerk_test@example.com exact' \
  'expect within=[data-slot="card"] within-text="Convex identity" text=e2e+clerk_test@example.com exact' \
  'aria dashboard' 'screenshot dashboard'
```

`--clerk-testing-token` runs `clerkSetup()` + `setupClerkTestingToken()` from `@clerk/testing/playwright`; `--sign-in` runs `clerk.signIn({ page, emailAddress })` after the first `goto`. Both flags were executed once against a throwaway keyless instance (token fetched, session created); the Convex identity assertion was **not** provable there (see Modes). The repo's own Playwright suite is the second harness: `E2E_PORT=3123 pnpm test:e2e` (needs the Clerk keys, `playwright.config.ts` throws without them; the `authenticated` project needs `E2E_CLERK_USER_EMAIL`).

Backend side of a proof:

```bash
.cursor/skills/verify-starter/bin/backend.sh posts-count   # read-only
.cursor/skills/verify-starter/bin/backend.sh posts-list    # read-only JSON
.cursor/skills/verify-starter/bin/backend.sh posts-reset   # fixture reset (empty import --replace)
.cursor/skills/verify-starter/bin/backend.sh env-list      # deployment env (CLERK_JWT_ISSUER_DOMAIN)
```

Feature recipes: [`features/README.md`](features/README.md).

## Evidence

Location: `/tmp/verify-starter/artifacts/<run-id>/<feature>/` (`ARTIFACTS_DIR` in `state.env`; override with `ARTIFACTS_DIR=` when driving without launch state). In a Cursor Cloud Agent, copy the files you cite into `/opt/cursor/artifacts/` for the walkthrough.

Per drive: `steps.jsonl` (one line per step: step text, ok, detail, duration, URL, screenshot path), `NN-<verb>.png` full-page screenshot after **every** step (`-FAILED` suffix on the failing one), `console.log` (browser console, page errors, Convex WebSocket open), `<name>.aria.txt` ARIA snapshots, `summary.json` (pass/fail counts, base URL, Clerk flags). Cleanup adds `vite.log`, `convex.log`, `state.env` to `<run-id>/`.

Proof standards:

- Exercise the real user path: navigate and click what a user clicks. `convex run posts:populate` seeds data but is not proof of the `Populate posts` button; `backend.sh posts-reset` is fixture setup, not a feature.
- Capture the action and the resulting state: the step screenshots do this automatically; add `aria` + `screenshot` at the state you claim.
- Verify side effects beside the visible state: after `Populate posts`, `backend.sh posts-count` must print `10`; after a sign-in, the `Convex identity` card must show the user's email, not `No identity on the Convex request.`
- No mocks: this app has no mock boundary. The only external call (`https://jsonplaceholder.typicode.com/posts` inside `posts:populate`) runs for real from the Convex backend; without egress the button shows `Could not populate posts`.
- Keyless mode is not a substitute for Clerk: report signed-in features as `verified-unreachable` with the missing prerequisite (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, a `convex` JWT template, `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment, an `E2E_CLERK_USER_EMAIL` user).

## Cleanup

```bash
.cursor/skills/verify-starter/bin/cleanup.sh
```

Kills the Vite process group and, only if this run started it, the Convex process group, both by recorded PID (never by name). Leaves a reused Convex backend and any foreign listener alone (warns). Removes `.clerk/` only when keyless mode created it during this run. Copies `vite.log`, `convex.log`, `state.env` into the evidence directory, then deletes `/tmp/verify-starter/run`. Never touches `/tmp/verify-starter/artifacts`. Run it after every failed attempt too, then relaunch.

Fixture residue is separate from instances: if a drive populated posts, `bin/backend.sh posts-reset` restores the empty table (data lives in `.convex/local/<deployment>/` for anonymous backends and survives restarts).

## Helpers

| Script | Invocation | Purpose |
| --- | --- | --- |
| `bin/launch.sh` | `.cursor/skills/verify-starter/bin/launch.sh [--port N] [--run-id ID]` | Start Convex (anonymous) + Vite, wait for ready, write `state.env` |
| `bin/doctor.sh` | `.cursor/skills/verify-starter/bin/doctor.sh` | Read-only health check of the recorded run |
| `bin/drive.mjs` | `node .cursor/skills/verify-starter/bin/drive.mjs --feature <id> [--base URL] [--continue] [--clerk-testing-token] [--sign-in EMAIL] <step>...` | Playwright step runner with per-step evidence |
| `bin/backend.sh` | `.cursor/skills/verify-starter/bin/backend.sh posts-list\|posts-count\|posts-reset\|env-list` | Convex state read / fixture reset via the Convex CLI |
| `bin/cleanup.sh` | `.cursor/skills/verify-starter/bin/cleanup.sh` | Tear down what launch started; keep evidence |
| `bin/lib.sh` | sourced by the scripts | Shared paths, mode detection, port/PID helpers |

All scripts are executable and idempotent to re-run after a failure. Keep the map honest with `/maintain-verification-skill` when routes, selectors, or the auth wiring change.
