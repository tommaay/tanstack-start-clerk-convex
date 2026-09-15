---
name: review-code
description: "Review code as a reviewer for this TanStack Start + Clerk + Convex starter — a PR/branch diff with global repo context, the whole codebase, or a scope the author names — applying the .macroscope check-run standards."
---

# Review code

Produce a code review with the same standards Macroscope applies to PRs. Three modes: **diff** (a PR or branch vs its merge base), **full** (the whole codebase), **author-scoped** (whatever the requester asks about). Pick the mode from the request; when unclear, ask which one.

## Standards source

The review checklists live in `.macroscope/check-run-agents/` — one file per check run:

| File | Covers |
| ---- | ------ |
| `ui-routes-review.md` | Route placement and the `_authed` gate, server-only code in browser paths, typography / `ContentContainer` / Tailwind tokens, conventions lint does not catch, Playwright coverage |
| `convex-server-review.md` | Convex `args` + `returns` validators, identity checks, Clerk → Convex trust, server-only env/logger confinement, secrets, `convex-test` specs, `convex/_generated/` |
| `a11y-review.md` | Accessible names and labels, alt text, heading structure, status feedback, focus/keyboard |
| `docs-agent-brief-sync.md` | `INSTRUCTIONS.md` / `AGENTS.md` / `CLAUDE.md` drift, docs index, skills, rails, CI / hooks / cloud-agent config, Macroscope config |
| `pr-scope-verification.md` | Atomic scope + PR-body verification claims (diff mode only) |

Each file's front matter has `include:` / `exclude:` globs — a checklist applies to a diff when it touches matching files. Each file also `@/path`-imports repo docs — resolve those paths against the repo root and read them.

Also read `.macroscope/correctness/starter-context.md` — it lists intentional patterns that look like bugs (the `_authed.tsx` `beforeLoad` throw, two Convex providers, `import.meta.env.VITE_*` in browser code, the dev-only `src/routes/e2e/error.tsx` throw). Do not flag those.

## Mode: diff review

1. Get the diff: `gh pr diff <N>` for a PR, or `git diff main...HEAD` / `git diff <base>` for a branch. Get metadata with `gh pr view <N>` when reviewing a PR.
2. Map changed files to checklists via the `include` / `exclude` globs; apply every matching checklist's "What to check" and honor its "Do not flag".
3. Read enough surrounding code for global context — a diff hunk is not the whole picture. Follow imports to the touched functions' callers and the modules they depend on.
4. When the PR body claims verification, check the claims against `pr-scope-verification.md` (e.g. a green `Check / check` is not e2e evidence; a public-project Playwright pass is not signed-in coverage).

## Mode: full codebase review

Walk the whole repo, not a diff:

1. Apply every checklist in `.macroscope/check-run-agents/` to its `include` globs across the tree.
2. Add cross-cutting passes the per-diff checklists can't see: drift between `docs/*.md` and the code they describe, secrets committed to the repo, dead code, TODO/FIXME accumulation, security paths (the `_authed` gate, Convex writes, server functions) lacking test coverage.
3. This produces more findings than a diff review — rank them, don't dump. Lead with what would expose a user's data or leak a secret.

## Mode: author-scoped review

The author names a question, a flow, or a file set ("does the profile query handle a deleted user?", "review the auth plumbing"). Scope the review to that ask, but still apply the matching checklists to every file you read — the author sees the answer plus any invariant violations on the path.

## Rules for all modes

- **Never invent TanStack Start, TanStack Router, Clerk, Convex, or shadcn/ui APIs.** Verify unknown APIs in the official docs linked from the `## Docs index` of `AGENTS.md`, Convex APIs in `convex/_generated/ai/guidelines.md`, and anything else in `node_modules` types. If you can't verify, report "could not verify `<thing>`" — don't guess.
- Don't flag what `pnpm lint`, `pnpm typecheck`, or the tests already catch (Biome formatting, `import type`, `console.*`, banned server-only imports from `src/components/**` and `src/lib/**`, missing Convex `returns`, `@shadcn/lint` restyles). The checklists list their own exclusions — honor them.
- Findings need file:line, the rule, what's wrong, and the fix — under ~40 words each. No file:line, no finding.
- If the code is clean, say so plainly. A review that invents findings is worse than no review.

## Output

Start with scope and verdict: `Review (diff PR #N): N findings` / `Review (diff branch <name>): N findings` / `Review (full repo): N findings` / `all clear`.

Group findings by checklist area (UI & Routes, Convex & Server, Accessibility, Docs & Agent Brief, PR Scope, Other). Within a group order by severity:

- 🔴 secret or token exposure, a protected page outside `src/routes/_authed/`, a Convex function that touches user data without an identity check, server-only code in a browser path, a11y blockers, a broken sign-in or data flow
- 🟡 missing `convex-test` spec or Playwright spec on a changed path, stale doc on a changed path, silent failure states
- 🟢 convention drift, clarity

End with a one-line "Not reviewed" note naming what the mode or tooling couldn't cover (e.g. signed-in e2e, a real Clerk session against a live Convex deployment, the production Nitro build).
