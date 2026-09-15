# Sign in and the auth gate

Signed-out users see a `Sign in` button in the nav and `Get started` on the home page; both open Clerk's prebuilt `SignIn` in a modal. Protected routes (`/dashboard`, `/user`, everything under `src/routes/_authed/`) render the same Clerk `SignIn` inline instead of the page while signed out, and return to the requested URL after sign-in. Signed in, the nav shows a `Dashboard` link and an avatar menu with `Dashboard`, `Account`, and `Sign out`. Clerk hosts the credential UI; this app never sees passwords.

## Sub-features

- `gate-nav-modal` opens the Clerk sign-in dialog from the nav `Sign in` button.
- `gate-protected-dashboard` shows Clerk `SignIn` inline on `/dashboard` while signed out; no `Dashboard` heading.
- `gate-protected-user` shows Clerk `SignIn` inline on `/user` while signed out; no `Account` card.
- `gate-sign-in` signs a Clerk dev-instance user in (Testing Token + server-side sign-in token) and lands on the protected page.
- `gate-signed-in-nav` shows the `Dashboard` nav link and the avatar menu; hides `Sign in`.
- `gate-sign-out` signs out from the avatar menu; nav returns to `Sign in`.

## How to get to it (user POV)

- Click `Sign in` in the nav on any page.
- Click `Get started` on the home page (see [home.md](./home.md)).
- Open `http://localhost:<port>/dashboard` or `http://localhost:<port>/user` while signed out.
- Signed in: open the avatar menu (top right) and choose `Sign out`.

## Driving it with drive.mjs

Preconditions:

- Instance healthy (`bin/doctor.sh`), signed out.
- `gate-sign-in`, `gate-signed-in-nav`, `gate-sign-out` additionally need Clerk mode `keys` (`pk_test_`/`sk_test_` dev-instance keys in the shell env or `.env`) and an existing user with a `+clerk_test` address (create it in the Clerk Dashboard; `E2E_CLERK_USER_EMAIL` in `.env.example`). For the Convex identity card, see [dashboard-and-account.md](./dashboard-and-account.md).

- **Nav modal.** Go home, wait for hydration, click `Sign in`. Steps `goto /`, `wait-idle`, `click role=button name="Sign in"`, `expect role=dialog`, `expect css=.cl-rootBox first`, `expect role=textbox name="Email address"`, `expect role=button name=Continue exact`, `aria sign-in-modal`, `screenshot sign-in-modal`. A Clerk dialog with an email textbox and `Continue` appears.
- **Dismiss.** Step `click role=button name="Close modal"` then `expect role=dialog count=0`.
- **Protected dashboard.** Steps `goto /dashboard`, `expect-status 500`, `expect css=.cl-rootBox first`, `expect role=textbox name="Email address"`, `expect role=heading name=Dashboard count=0`, `aria gate-dashboard`, `screenshot gate-dashboard`. The shell renders with an inline Clerk `SignIn`; no `Dashboard` heading. The HTTP status is 500 (the `_authed` `beforeLoad` throws `Not authenticated` on the server; the error component renders `SignIn`).
- **Protected account.** Steps `goto /user`, `expect-status 500`, `expect css=.cl-rootBox first`, `expect css=[data-slot="card-title"] count=0`. Inline `SignIn`, no card.

Complete signed-out invocation (proven in keyless mode):

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature sign-in-gate \
  'goto /' 'wait-idle' 'click role=button name="Sign in"' \
  'expect role=dialog' 'expect css=.cl-rootBox first' \
  'expect role=textbox name="Email address"' 'expect role=button name=Continue exact' \
  'aria sign-in-modal' 'screenshot sign-in-modal' \
  'click role=button name="Close modal"' 'expect role=dialog count=0' \
  'goto /dashboard' 'expect-status 500' 'expect css=.cl-rootBox first' \
  'expect role=textbox name="Email address"' 'expect role=heading name=Dashboard count=0' \
  'aria gate-dashboard' 'screenshot gate-dashboard' \
  'goto /user' 'expect-status 500' 'expect css=.cl-rootBox first' \
  'expect css=[data-slot="card-title"] count=0'
```

- **Sign in.** (`keys` mode) Sign the test user in through Clerk's testing helpers, then load the protected page. Steps with flags `--clerk-testing-token --sign-in <email>`: `goto /`, `expect role=link name=Dashboard`, `expect role=button name="Sign in" count=0`, `expect css=[data-slot="dropdown-menu-trigger"]`, `goto /dashboard`, `expect-status 200`, `expect role=heading name=Dashboard`. Nav shows `Dashboard` and the avatar; `/dashboard` renders.
- **Sign out.** Steps `click css=[data-slot="dropdown-menu-trigger"]`, `expect role=menuitem name="Sign out"`, `aria user-menu`, `click role=menuitem name="Sign out"`, `expect role=button name="Sign in"`, `expect role=link name=Dashboard count=0`, `screenshot signed-out-again`.

Complete signed-in invocation (`keys` mode; not provable in keyless mode):

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature sign-in-gate-signed-in \
  --clerk-testing-token --sign-in e2e+clerk_test@example.com \
  'goto /' 'expect role=link name=Dashboard' 'expect role=button name="Sign in" count=0' \
  'expect css=[data-slot="dropdown-menu-trigger"]' \
  'goto /dashboard' 'expect-status 200' 'expect role=heading name=Dashboard' \
  'click css=[data-slot="dropdown-menu-trigger"]' 'expect role=menuitem name="Sign out"' \
  'aria user-menu' 'click role=menuitem name="Sign out"' \
  'expect role=button name="Sign in"' 'expect role=link name=Dashboard count=0' \
  'screenshot signed-out-again'
```

The repo's Playwright suite covers the same gate: `E2E_PORT=3123 pnpm test:e2e --project public` (`e2e/public/pages.spec.ts`, "protected routes show Clerk sign-in when signed out") and, with `E2E_CLERK_USER_EMAIL`, `--project authenticated`.

## Gotchas

- Keyless mode: `--sign-in` does create a session, but the root route then calls `getToken({ template: 'convex' })` and the temporary Clerk instance has no `convex` JWT template. Clerk answers 404 and every page shows `Something went wrong` / `Not Found`. This is the documented setup gap (README step 1), not an app bug. Report signed-in sub-features as `verified-unreachable`.
- Typing an email into the modal and pressing `Continue` reaches Clerk's hosted verification (code by email); never drive that. Use `--clerk-testing-token --sign-in`, the path `e2e/global.setup.ts` uses.
- The modal and the inline `SignIn` share `.cl-rootBox`; use `role=dialog` to tell the modal apart.
- Protected routes answer HTTP 500 while signed out even though the UI is correct. `expect-status 500` is the expected value; a 200 there would mean the gate did not fire.
- The `console.log` artifact for a signed-out `/dashboard` or `/user` contains `[error] Failed to load resource: … 500`, a React `[error] %o … Error: Not authenticated … The above error occurred in the <MatchInnerImpl> component`, and `[warning] Warning: Error in route match: /_authed/`. All three are the gate firing (`_authed.tsx` throws on purpose), not new failures; `/` and `/posts` log no errors.
- Do not assert the Clerk heading text (`Sign in to <app name>`): it is the Clerk application name, `My Application` in keyless mode.
- The avatar trigger's accessible name depends on whether the avatar image loaded (`alt` = full name, or `User` when Clerk has no name) or the initials fallback rendered; target `css=[data-slot="dropdown-menu-trigger"]`.
