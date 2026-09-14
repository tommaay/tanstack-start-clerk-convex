# Home

The home page (`/`) shows the app shell (brand link, `Home` and `Posts` nav links, a `Sign in` button or the user's avatar menu) and a hero card titled `TanStack Start + Clerk + Convex`. Signed out, the card offers `Get started` (opens the Clerk sign-in modal) and `Browse posts`. Signed in, it offers `Go to dashboard` and `Browse posts`, and the nav gains a `Dashboard` link.

## Sub-features

- `home-shell` renders the brand link and the `Home` / `Posts` nav links on every page.
- `home-hero` shows the hero card title and description.
- `home-signed-out-cta` shows `Get started` + `Browse posts`, hides `Go to dashboard` and the `Dashboard` nav link.
- `home-get-started` opens the Clerk sign-in modal from `Get started`; `Escape` or `Close modal` dismisses it.
- `home-browse-posts` navigates to `/posts`.
- `home-signed-in-cta` shows `Go to dashboard`, hides `Get started`, shows the `Dashboard` nav link and the avatar menu.

## How to get to it (user POV)

- Open `http://localhost:<port>/`.
- Click the brand link `Start · Clerk · Convex` or the `Home` nav link from any page.
- Click `Go home` on the 404 page or the error boundary.

## Driving it with drive.mjs

Preconditions:

- Instance healthy (`bin/doctor.sh`), Clerk mode any, signed out.

- **Open home.** Go to `/`. Step `goto /` then `expect-status 200`. The page answers 200.
- **Shell.** Check the nav. Steps `expect role=link name="Start · Clerk · Convex"`, `expect role=link name=Home`, `expect role=link name=Posts exact`, `expect role=button name="Sign in"`, `expect role=link name=Dashboard count=0`. Brand and two nav links visible, `Sign in` visible, no `Dashboard` link.
- **Hero.** Check the card. Step `expect text="TanStack Start + Clerk + Convex" exact`. Title visible.
- **Signed-out CTAs.** Steps `expect role=button name="Get started"`, `expect role=link name="Browse posts"`, `expect role=link name="Go to dashboard" count=0`.
- **Get started.** Wait for hydration and click. Steps `wait-idle`, `click role=button name="Get started"`, `expect role=dialog`, `expect role=textbox name="Email address"`, `aria get-started-modal`. A Clerk dialog with an `Email address` textbox and a `Continue` button appears.
- **Dismiss.** Step `press Escape` then `expect role=dialog count=0`. The dialog closes.
- **Browse posts.** Step `click role=link name="Browse posts"` then `expect-url /posts$` and `expect role=heading name=Posts`. URL ends in `/posts`, heading `Posts` visible.
- **Proof.** Step `screenshot posts-from-home`.

Complete invocation (proven in keyless mode):

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature home \
  'goto /' 'expect-status 200' \
  'expect role=link name="Start · Clerk · Convex"' 'expect role=link name=Home' \
  'expect role=link name=Posts exact' 'expect role=button name="Sign in"' \
  'expect role=link name=Dashboard count=0' \
  'expect text="TanStack Start + Clerk + Convex" exact' \
  'expect role=button name="Get started"' 'expect role=link name="Browse posts"' \
  'expect role=link name="Go to dashboard" count=0' \
  'wait-idle' 'click role=button name="Get started"' \
  'expect role=dialog' 'expect role=textbox name="Email address"' 'aria get-started-modal' \
  'press Escape' 'expect role=dialog count=0' \
  'click role=link name="Browse posts"' 'expect-url /posts$' 'expect role=heading name=Posts' \
  'screenshot posts-from-home'
```

Signed-in variant (`home-signed-in-cta`, Clerk `keys` mode with a `+clerk_test` user; not provable in keyless mode):

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature home-signed-in \
  --clerk-testing-token --sign-in e2e+clerk_test@example.com \
  'goto /' 'expect role=link name="Go to dashboard"' \
  'expect role=button name="Get started" count=0' \
  'expect role=link name=Dashboard' 'expect css=[data-slot="dropdown-menu-trigger"]' \
  'aria home-signed-in' 'screenshot home-signed-in'
```

## Gotchas

- `name=Posts` without `exact` matches both the nav link and `Browse posts`; Playwright's strict mode then fails `expect`.
- `Get started` and `Sign in` are React handlers: clicking before hydration does nothing. Use `wait-idle` first. `Browse posts` is a plain link and works before hydration.
- The Clerk modal heading is `Sign in to <app name>`; in keyless mode the app name is `My Application`. Assert `role=dialog` and the `Email address` textbox, not the heading.
- Keyless mode adds a `Keyless prompt` button (bottom of the page) that appears in ARIA snapshots and screenshots; it is Clerk UI, not app UI.
- The `Dashboard` nav link and the avatar menu render client-side from the Clerk session; `expect ... count=0` right after `goto` is only meaningful when signed out.
