# Dashboard and Account

Signed-in pages. `/dashboard` shows three cards: `Clerk session` (name, email, user ID read from Clerk on the client), `Convex identity` (email and subject returned by the Convex query `user:profile`, which reads the verified Clerk JWT; it shows `No identity on the Convex request.` when the JWT does not reach Convex), and `Components` with a `Show a toast` button that raises the sonner toast `Hello from sonner 👋`. `/user` shows one `Account` card: `Welcome! Your email address is <email>.` or `You are not logged in.` Both are reachable from the avatar menu (`Dashboard`, `Account`) and the home `Go to dashboard` link.

## Sub-features

- `dash-clerk-card` shows the signed-in user's name, email, and user ID.
- `dash-convex-card` shows the same email plus the Clerk subject: proof the `convex` JWT reaches the Convex deployment (`CLERK_JWT_ISSUER_DOMAIN` correct).
- `dash-convex-card-missing` shows `No identity on the Convex request.` when the issuer or template is wrong: a configuration failure signal, not a pass.
- `dash-toast` shows `Hello from sonner` after `Show a toast`.
- `account-card` (`/user`) shows `Welcome! Your email address is <email>.`
- `menu-nav` reaches `/dashboard` and `/user` from the avatar menu items `Dashboard` and `Account`.

## How to get to it (user POV)

- Sign in, then click `Go to dashboard` on the home page or the `Dashboard` nav link.
- Open the avatar menu (top right) and choose `Dashboard` or `Account`.
- Open `http://localhost:<port>/dashboard` or `/user` directly (signed out, the Clerk sign-in renders first and returns here after sign-in).

## Driving it with drive.mjs

Preconditions:

- Clerk mode `keys` (dev-instance keys), a Clerk JWT template named `convex` on that instance, and `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment equal to that template's issuer (`bin/backend.sh env-list` shows the value; `https://placeholder.clerk.accounts.dev` means the Convex card will read `No identity on the Convex request.`).
- An existing user with a `+clerk_test` address (called `<email>` below).
- Instance healthy (`bin/doctor.sh`).

- **Sign in and open.** Flags `--clerk-testing-token --sign-in <email>`, steps `goto /`, `click role=link name="Go to dashboard"`, `expect-url /dashboard$`, `expect role=heading name=Dashboard`. Heading `Dashboard` and the line `This page is protected — you only reach it while signed in.` visible. (`expect-status` does not apply after a client-side navigation; use the URL and heading.)
- **Clerk card.** Step `expect within=[data-slot="card"] within-text="Clerk session" text=<email> exact`. The email is rendered in the `Clerk session` card.
- **Convex card.** Steps `expect within=[data-slot="card"] within-text="Convex identity" text="No identity on the Convex request." count=0`, `expect within=[data-slot="card"] within-text="Convex identity" text=<email> exact`. The email appears in the `Convex identity` card and the failure sentence does not.
- **Toast.** Steps `wait-convex`, `click role=button name="Show a toast"`, `expect-text "Hello from sonner"`. Toast visible.
- **Proof.** Steps `aria dashboard`, `screenshot dashboard`.
- **Account via menu.** Steps `click css=[data-slot="dropdown-menu-trigger"]`, `click role=menuitem name=Account`, `expect-url /user$`, `expect-text "Welcome! Your email address is"`, `expect text=<email>`, `aria account`, `screenshot account`.
- **Side effect.** Run `.cursor/skills/verify-starter/bin/backend.sh env-list` and keep the output: it names the issuer the Convex card was verified against.

Complete invocation (`keys` mode; executed only up to the sign-in against a throwaway keyless instance while this skill was generated, so the card assertions are unproven):

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature dashboard \
  --clerk-testing-token --sign-in e2e+clerk_test@example.com \
  'goto /' 'click role=link name="Go to dashboard"' 'expect-url /dashboard$' \
  'expect role=heading name=Dashboard' \
  'expect within=[data-slot="card"] within-text="Clerk session" text=e2e+clerk_test@example.com exact' \
  'expect within=[data-slot="card"] within-text="Convex identity" text="No identity on the Convex request." count=0' \
  'expect within=[data-slot="card"] within-text="Convex identity" text=e2e+clerk_test@example.com exact' \
  'wait-convex' 'click role=button name="Show a toast"' 'expect-text "Hello from sonner"' \
  'aria dashboard' 'screenshot dashboard' \
  'click css=[data-slot="dropdown-menu-trigger"]' 'click role=menuitem name=Account' \
  'expect-url /user$' 'expect-text "Welcome! Your email address is"' \
  'expect text=e2e+clerk_test@example.com' 'aria account' 'screenshot account'
.cursor/skills/verify-starter/bin/backend.sh env-list
```

Equivalent repo harness: `E2E_CLERK_USER_EMAIL=<email> E2E_PORT=3123 pnpm test:e2e --project authenticated` (`e2e/authenticated/dashboard.spec.ts` asserts both cards).

## Gotchas

- `No identity on the Convex request.` with a correct Clerk session means the JWT never reached Convex: wrong `CLERK_JWT_ISSUER_DOMAIN` on the deployment, no `convex` JWT template, or the placeholder issuer from `.cursor/install.sh`. Record it as a configuration failure with the `env-list` output.
- Keyless mode cannot reach these pages: signing in breaks every route with `Something went wrong` (see [sign-in-gate.md](./sign-in-gate.md)). Report `verified-unreachable`.
- `expect-status` only reflects the last `goto`; after `click role=link name="Go to dashboard"` (client navigation) use `expect-url` and the heading instead.
- The `Convex identity` card is populated by `useSuspenseQuery`; assert the email with the default 20 s step timeout rather than a `sleep`.
- `Show a toast` is a React handler; `wait-convex` before clicking (the dashboard subscribes to `user:profile`, so the WebSocket opens).
- The `Clerk session` card shows `—` for a missing name; assert the email, which the test user always has.
- `/user` has no heading element: its title `Account` is a `[data-slot="card-title"]` div. Assert the welcome sentence.
