## Summary

<!-- What changed and why. Link the issue or task. -->

## Verification

<!-- Check what you ran locally. CI runs the full gate; e2e needs Clerk secrets. -->

- [ ] `pnpm check` passes (or `pnpm check:core` + note why e2e was skipped)
- [ ] New or changed Convex functions have `args` **and** `returns` validators
- [ ] New pages have a Playwright spec (`e2e/public/` or `e2e/authenticated/`)
- [ ] `INSTRUCTIONS.md` updated when conventions changed (`pnpm agents:sync` ran)
- [ ] Screenshots or a recording for visible UI changes

## Not verified

<!-- Anything you could not run or reach (e.g. signed-in e2e without E2E_CLERK_USER_EMAIL). -->

## Notes for reviewers

<!-- Risky spots, follow-ups, decisions you want a second opinion on. -->
