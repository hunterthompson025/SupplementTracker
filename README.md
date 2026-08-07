# Supplement Tracker

A small private web app for tracking a household's supplement inventory: who
takes what, how fast it depletes, and what needs reordering each month. Static
site hosted on GitHub Pages, with Firebase Firestore for real-time sync between
devices and Firebase Authentication as the access gate.

## Project layout

```
index.html                  markup only — no inline styles or scripts
firestore.rules             security rules (must be published to Firebase)
assets/
  css/styles.css            all styling, organised by section
  js/
    main.js                 entry point: event wiring + boot
    config.js               Firebase project config
    firebase.js             SDK initialisation, exports auth/db/STATE_DOC
    store.js                shared state + domain helpers
    sync.js                 Firestore listener, saves, sync badge
    auth.js                 sign-in gate
    render.js               full re-render after every snapshot
    dom.js                  $ / esc / show / hide / alert helpers
    dates.js                "days left in month" calculations
    errors.js               global error banner
    nav.js                  screen switching
    users.js                user list + dropdown
    supplements.js          add/edit form + per-user list
    usage.js                home screen usage logging
    inventory.js            inventory roll-up + cycle count
    orders.js               order list generation
```

### Conventions

- **No build step.** ES modules load directly from `assets/js/`, and the
  Firebase compat SDK loads from gstatic as classic scripts. Nothing to compile,
  nothing to install.
- **No inline event handlers.** Clickable controls carry `data-action` (plus
  `data-uid` / `data-sid` arguments); a single delegated listener in `main.js`
  dispatches them. Dynamically rendered markup needs no rebinding.
- **All interpolated text is escaped.** Any user-supplied value written into an
  `innerHTML` template goes through `esc()` from `dom.js`.
- **Show/hide uses the `.hidden` class**, so elements keep their natural
  `display` value from the stylesheet.
- **One source of truth.** `store.state` mirrors the Firestore `app/state`
  document and is the only thing persisted.
- **One source of truth for counts, too.** Home, Maintenance, Inventory and the
  order list all derive their numbers from `capsOnHand()`, `dailyCaps()`,
  `stockDailyCaps()`, `daysRemaining()` and `needsOrder()` in `store.js` — no
  screen does its own arithmetic, so they cannot drift apart.
- **One count per physical supply.** A shared supplement is one `stocks[]` entry
  that several users point at, so two people's numbers for the same bottle
  cannot disagree — there is only one number.

## How counts work

State separates a **stock** from a **regimen**:

```
users:  [{id, name, supplements: [{id, stockId, dosePerSession, times, inactive}]}]
stocks: [{id, name, brand, capPerBottle, bottles}]
```

A *stock* is one physical supply of one product. A *regimen* is how one person
takes it. When two people share a bottle, both regimens point at the same
`stockId`, so there is exactly **one** count — it cannot drift between them, and
a cycle count is a single write that both people immediately see.

Dose, times and the inactive flag stay per person, because two people can share
a bottle and still take it differently. The consumption that matters is the sum:
`stockDailyCaps()` adds up every taker's daily draw, and "days left", the order
list and the Inventory row all measure against that combined number. A bottle
two people take from empties twice as fast, and the app now says so.

Inventory shows one row per supply, listing each taker with their own daily
draw, so a shared row still shows who is responsible for how much of it.

### Sharing a supplement

Tick more than one user under **Assign to user(s)** when adding it. If the name
and brand already match something on the shelf, the form says so and the new
person draws from that existing supply instead of a second count being invented.

### Upgrading from per-user counts

Older documents kept the count on each user's supplement. `migrateState()` in
`store.js` splits those into a stock plus a regimen on load, in memory — the
first write afterwards persists the new shape.

Migration deliberately gives every existing supplement **its own** stock, even
where two users clearly had the same product. The old data cannot tell a shared
bottle from two separate ones, and guessing would either double the real count
or throw half of it away, so every number survives exactly as it was. To link
two users to one supply afterwards: edit one person's copy, tick the other user
under *Also assign to additional user(s)*, delete the other person's now-orphaned
copy, and do a single cycle count to set the true number.

### Inactive supplements

Each supplement has an **Inactive** checkbox on the Maintenance form, unchecked
by default. Ticking it keeps the supplement and its on-hand count but stops
counting it as consumed: `dailyCaps()` returns 0, so logging usage leaves the
count alone, "days left" shows `—`, weekly/monthly use show 0, and it never
appears on the order list. Untick it and everything resumes.

## Firebase setup

The app will not let anyone in — including you — until all of these are done.

### 1. Create the login account(s)

Firebase Console → **Authentication** → **Get started** → enable the
**Email/Password** provider → **Users** → **Add user**.

One shared account works fine for a household; separate accounts also work, as
the app does not distinguish between them. Firebase requires the username to be
in email format, but it does not have to be an address you actually read.

Recommended: **Authentication → Settings → User actions** → uncheck
**Enable create (sign-up)** so nobody can self-register against the project.

### 2. Publish the security rules

Firebase Console → **Firestore Database** → **Rules** → paste the contents of
[`firestore.rules`](firestore.rules) → **Publish**.

Until this is published the state document is world-writable, no matter what the
login screen does.

### 3. Let the hosting domain sign in

Two separate allow-lists have to include wherever the app is served from, and
each has its own error message:

| Where | What to add | Error if missing |
| --- | --- | --- |
| Firebase Console → **Authentication → Settings → Authorized domains** | `hunterthompson025.github.io` | `auth/unauthorized-domain` |
| Google Cloud Console → **APIs & Services → Credentials** → the browser API key → **Application restrictions → Websites** | `https://hunterthompson025.github.io/*` | `auth/requests-from-referer-…-are-blocked` |

Referrer patterns must be **bare origin + `/*`**, never path-scoped. Sign-in is a
cross-origin request to `identitytoolkit.googleapis.com`, and the default
`Referrer-Policy: strict-origin-when-cross-origin` strips the path, so the key
only ever sees `https://hunterthompson025.github.io/`. An entry like
`https://hunterthompson025.github.io/SupplementTracker/*` looks correct but can
never match.

For local development, Firebase's Authorized domains list already contains
`localhost`, so only the API key needs entries — add `http://localhost:8000/*`
and `http://127.0.0.1:8000/*`, matching whatever port you serve on. The port is
part of the referrer, so `http://localhost/*` alone is not enough.

Each entry is added with **ADD** → type → **DONE**, then **SAVE**; skipping DONE
discards the entry. Key changes take a few minutes to take effect.

If the project has more than one browser API key, the one that matters is the
one whose value matches `apiKey` in [`assets/js/config.js`](assets/js/config.js).
The failing request's URL in DevTools ends in `?key=…`, which identifies it
conclusively.

The API key restriction is not what protects the data — the key is readable in
view-source either way. It limits who can spend the project's quota.

This is the step that actually protects the data. Until it is published, the
Firestore document is world-writable no matter what the page displays.

## Local development

ES modules are subject to CORS, so opening `index.html` as a `file://` URL will
fail. Serve the directory over HTTP instead:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

For sign-in to work from localhost, add `localhost` under Firebase Console →
**Authentication → Settings → Authorized domains**.

## Deploying

GitHub Pages serves from the repository root, so pushing to `main` is the
deploy. `index.html`, `assets/`, and `firestore.rules` are all that ship —
`firestore.rules` is reference only and is not used by the browser.

## Notes

- The Firebase API key in `assets/js/config.js` is **public by design**. It
  identifies the project; it does not grant access. The security rules do.
- Anyone can still load the page and see the empty login form. They cannot read
  or write the data.
- Sessions use `LOCAL` persistence, so each device signs in once and stays
  signed in until it explicitly signs out.
