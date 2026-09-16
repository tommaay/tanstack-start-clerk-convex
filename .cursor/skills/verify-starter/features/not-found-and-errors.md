# Not found and error boundary

Unknown URLs render the app shell with a `404` heading, `We couldn’t find that page.`, and a `Go home` link styled as a button (`role=link`; HTTP 404). A route that throws renders the catch boundary: heading `Something went wrong`, `Please try again. If the problem continues, go back home.`, a `Try again` button that re-runs the route, and a `Go home` link; in development the raw error is shown below the message (`src/components/error-boundary.tsx`). The dev-only route `/e2e/error` throws `e2e: intentional route error` on purpose so the boundary can be exercised; production builds answer 404 for it.

## Sub-features

- `nf-page` renders `404` + `Go home` for an unknown path with HTTP 404.
- `nf-go-home` returns to `/` from the 404 page.
- `err-boundary` renders `Something went wrong` with `Try again` and `Go home` when a route throws.
- `err-dev-detail` shows the raw error text in development (`vite dev`) only.
- `err-go-home` returns to `/` from the boundary.

## How to get to it (user POV)

- Type any URL that is not a route, e.g. `http://localhost:<port>/this-route-does-not-exist`.
- Follow a stale link inside the app.
- Open `http://localhost:<port>/e2e/error` while running `vite dev` (development only).

## Driving it with drive.mjs

Preconditions:

- Instance healthy (`bin/doctor.sh`), started by `bin/launch.sh` (which runs `vite dev`, so `/e2e/error` exists). Any Clerk mode, signed out or in.

- **Unknown route.** Steps `goto /this-route-does-not-exist`, `expect-status 404`, `expect role=heading name=404`, `expect-text "We couldn’t find that page."`, `expect role=link name="Go home"`, `aria not-found`, `screenshot not-found`. Shell plus 404 content, HTTP 404.
- **Go home.** Steps `click role=link name="Go home"`, `expect-url /$`, `expect text="TanStack Start + Clerk + Convex" exact`. Back on the home card.
- **Throwing route.** Steps `goto /e2e/error`, `expect-status 500`, `expect role=heading name="Something went wrong"`, `expect role=button name="Try again"`, `expect role=link name="Go home"`, `expect-text "e2e: intentional route error"`, `aria error-boundary`, `screenshot error-boundary`. Boundary with the dev error detail, HTTP 500.
- **Try again.** Step `click role=button name="Try again"` then `expect role=heading name="Something went wrong"`. The route throws again; the boundary stays (proves the button re-runs the route without a crash).
- **Go home from the boundary.** Steps `click role=link name="Go home"`, `expect-url /$`, `expect role=heading name="Something went wrong" count=0`.

Complete invocation (proven in keyless mode):

```bash
node .cursor/skills/verify-starter/bin/drive.mjs --feature not-found-and-errors \
  'goto /this-route-does-not-exist' 'expect-status 404' \
  'expect role=heading name=404' 'expect-text "We couldn’t find that page."' \
  'expect role=link name="Go home"' 'aria not-found' 'screenshot not-found' \
  'click role=link name="Go home"' 'expect-url /$' \
  'expect text="TanStack Start + Clerk + Convex" exact' \
  'goto /e2e/error' 'expect-status 500' \
  'expect role=heading name="Something went wrong"' 'expect role=button name="Try again"' \
  'expect role=link name="Go home"' 'expect-text "e2e: intentional route error"' \
  'aria error-boundary' 'screenshot error-boundary' \
  'click role=button name="Try again"' 'expect role=heading name="Something went wrong"' \
  'click role=link name="Go home"' 'expect-url /$' \
  'expect role=heading name="Something went wrong" count=0'
```

## Gotchas

- The apostrophe in `We couldn’t find that page.` is the typographic `’` (U+2019), copied from `src/components/not-found.tsx`; a straight `'` does not match.
- `/e2e/error` is registered in every build (`src/routeTree.gen.ts`), but its `beforeLoad` throws `notFound()` unless `import.meta.env.DEV`. Against `pnpm build && pnpm start` it is therefore a 404, and the raw error detail is hidden in production too.
- `Go home` appears twice in the boundary's DOM tree only if a nested boundary also renders; on `/e2e/error` there is one, so `role=link name="Go home"` is unambiguous.
- The boundary logs `DefaultCatchBoundary Error: Error: e2e: intentional route error` to the browser console on purpose (several times: on load, then again after `Try again`). The `console.log` artifact for this recipe also contains `[error] Failed to load resource: … 404` (the unknown route), `[error] Failed to load resource: … 500` (the throwing route), a React `[error] %o … e2e: intentional route error`, and `[warning] Warning: Error in route match: /e2e/error/e2e/error`. All of these are the 404 and the boundary firing as designed, not new failures.
- Signed-in users see the same pages; the shell (nav, avatar) is unaffected by the 404 or the boundary.
