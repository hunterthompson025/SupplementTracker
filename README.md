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
  `daysRemaining()` and `needsOrder()` in `store.js` — no screen does its own
  arithmetic, so they cannot drift apart.

## How counts work

Stock is tracked **per user**, not pooled. If two people take the same
supplement, each has their own record with their own count, and the Inventory
table shows a separate row per person. That keeps every screen in agreement:
a cycle count or a usage log changes one person's number, and Maintenance, the
Home preview, the Inventory row and the order list all move together.

Pooling a shared supplement into a single row would also hide the case that
matters most — one person nearly out while the other is well stocked would
average out to "OK" and the order would be missed.

### Inactive supplements

Each supplement has an **Inactive** checkbox on the Maintenance form, unchecked
by default. Ticking it keeps the supplement and its on-hand count but stops
counting it as consumed: `dailyCaps()` returns 0, so logging usage leaves the
count alone, "days left" shows `—`, weekly/monthly use show 0, and it never
appears on the order list. Untick it and everything resumes.

## Firebase setup

The app will not let anyone in — including you — until both of these are done.

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
