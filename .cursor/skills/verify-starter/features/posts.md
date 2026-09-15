# Posts

The posts page (`/posts`) lists every row of the Convex `posts` table as a card (title + body), oldest first, rendered on the server and kept live over the Convex WebSocket. When the table is empty it shows `No posts yet. Use “Populate posts” to seed some from Convex.` and a `Populate posts` button that runs the Convex action `posts:populate`: it fetches the sample posts from `https://jsonplaceholder.typicode.com/posts`, inserts the first ten, shows the toast `Posts populated`, and the button disappears once the list is non-empty. Public: no sign-in needed.

## Sub-features

- `posts-list` renders one card per stored post with title and body.
- `posts-empty` shows the empty-state card and the `Populate posts` button only when the table is empty.
- `posts-populate` seeds ten posts from the button, shows `Posts populated`, and the list updates live.
- `posts-populate-error` shows `Could not populate posts` when the action throws (no egress to jsonplaceholder).
- `posts-live` reflects rows inserted outside the page (`convex run posts:populate`) without a reload.

## How to get to it (user POV)

- Click the `Posts` nav link on any page.
- Click `Browse posts` on the home page.
- Open `http://localhost:<port>/posts`.

## Driving it with drive.mjs

Preconditions:

- Instance healthy (`bin/doctor.sh`), signed out, any Clerk mode.
- Empty table: `.cursor/skills/verify-starter/bin/backend.sh posts-count` prints `0` (else run `posts-reset`).
- Outbound HTTPS to `jsonplaceholder.typicode.com` from the machine running the Convex backend (`curl -sI https://jsonplaceholder.typicode.com/posts` answers 200).

- **Open posts.** Go to `/posts`. Steps `goto /posts`, `expect-status 200`, `expect role=heading name=Posts`. Heading `Posts` visible.
- **Empty state.** Step `expect-text "No posts yet."` and `expect role=button name="Populate posts"`. Empty card and button visible.
- **Wait for live data.** Step `wait-convex`. The page's Convex sync WebSocket is open (hydrated).
- **Populate.** Click the button. Step `click role=button name="Populate posts"`. The label switches to `Populating…` while the action runs.
- **Toast.** Step `expect-text "Posts populated"`. The sonner toast appears with description `Sample posts were loaded into Convex.`
- **List.** Steps `expect css=[data-slot="card-title"] count=10`, `expect role=button name="Populate posts" count=0`, `expect text="No posts yet." count=0`. Ten cards, no button, no empty state.
- **Proof.** Steps `aria after-populate`, `screenshot after-populate`.
- **Side effect.** Run `.cursor/skills/verify-starter/bin/backend.sh posts-count`. Prints `10`. Save the output next to the artifacts.
- **Restore.** Run `.cursor/skills/verify-starter/bin/backend.sh posts-reset`. `posts-count` prints `0` again.

Complete invocation (proven in keyless + anonymous mode):

```bash
.cursor/skills/verify-starter/bin/backend.sh posts-reset
node .cursor/skills/verify-starter/bin/drive.mjs --feature posts \
  'goto /posts' 'expect-status 200' 'expect role=heading name=Posts' \
  'expect-text "No posts yet."' 'expect role=button name="Populate posts"' \
  'wait-convex' \
  'click role=button name="Populate posts"' \
  'expect-text "Posts populated"' \
  'expect css=[data-slot="card-title"] count=10' \
  'expect role=button name="Populate posts" count=0' \
  'expect text="No posts yet." count=0' \
  'aria after-populate' 'screenshot after-populate'
.cursor/skills/verify-starter/bin/backend.sh posts-count   # expect 10
.cursor/skills/verify-starter/bin/backend.sh posts-reset
```

`posts-live` variant: open `/posts` with an empty table in one `drive.mjs` invocation that includes `wait-convex` then `sleep 5000` then `expect css=[data-slot="card-title"] count=10`, and during the sleep run `.cursor/skills/verify-starter/bin/backend.sh posts-populate` from another shell. The cards must appear without a reload.

## Gotchas

- Clicking `Populate posts` before hydration does nothing: the SSR button has no handler yet and no toast appears. Always `wait-convex` first.
- The action is idempotent: when rows exist it returns without inserting, so a second run cannot be "proven" by re-clicking. Reset the table first.
- `posts:populate` needs egress from the **Convex backend** (local process in anonymous mode, Convex cloud otherwise), not from the browser. A sandbox that blocks it yields `Could not populate posts`.
- Data persists in `.convex/local/` (observed: `.convex/local/default/`) across backend restarts; a non-empty table hides the button and the empty state on the next run.
- The list is sorted by `_creationTime`; the ten inserts run in parallel (`Promise.all`), so card order is not guaranteed to be the JSONPlaceholder id order even though it often is. Assert count, not order.
- Toasts auto-dismiss after a few seconds; assert `Posts populated` right after the click, before the card count.
