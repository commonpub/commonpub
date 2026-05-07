# Session 139 — Identity Phase 2a Mastodon-login (server-side) shipped

Date: 2026-05-07.

The OUTBOUND OAuth direction now exists in production: CommonPub
can register itself as a client of any Mastodon-API-compatible
remote, redirect the user there for consent, and exchange the auth
code for an encrypted-at-rest token grant. Routes are gated by
`features.identity.signInWithRemote` (default off), so end-users
see no change yet — Phase 2b's UI is what activates the flow.

## What shipped

### Branch merge

`feat/identity-phase-2a-mastodon-login` (2 commits) fast-forwarded
into main:

```
e2d6ea0 feat(layer): /api/auth/mastodon/{start,callback} routes (Phase 2a)
927a344 feat(server): Mastodon-login helpers (Phase 2a server-side)
```

Plus one chore-release commit `2a52284` for the version bumps.

### 2 npm publishes

| Package | From | To | Reason |
|---|---|---|---|
| `@commonpub/server` | 2.50.0 | 2.51.0 | minor — Mastodon-login helpers exported |
| `@commonpub/layer`  | 0.20.0 | 0.21.0 | minor — `/api/auth/mastodon/{start,callback}` routes |

### Both sites deployed

- **commonpub.io** — Deploy run `25488539492`, 6m25s, success.
- **deveco.io** — Deploy run `25488573963`, 4m9s, success.

Post-deploy verification:

| Check | commonpub.io | deveco.io |
|---|---|---|
| `/api/health` | 200 | 200 |
| `/api/auth/mastodon/start?host=mastodon.social` | 404 ✓ | 404 ✓ |
| Container logs (TypeError / ReferenceError / Cannot read) | clean | clean |

The 404 is the **correct** response — `signInWithRemote: false` is
the default, so the routes refuse to expose themselves until an
operator flips the flag. No new attack surface for scrapers.

## What's now possible (server-side, no UI yet)

- **`getOrRegisterRemoteClient(db, host, redirectUri)`** —
  CommonPub registers itself with any Mastodon-API host via
  megalodon's `client.registerApp()` (POST `/api/v1/apps`). Cached
  in `instance_settings` keyed by `mastodon_client:{host}`;
  subsequent links re-use credentials without re-registering.

- **`storeMastodonLoginState` / `consumeMastodonLoginState`** —
  CSRF state on `instance_settings`, 10-min TTL, single-use atomic
  consume.

- **`exchangeCodeAndVerify(host, creds, code)`** — token exchange
  via megalodon + `verifyAccountCredentials`, returns a verified
  profile + plaintext token. Caller threads through to
  `linkFederatedAccount`'s grant param (which encrypts).

- **`detectSoftwareKind(host)`** — megalodon's NodeInfo `detector`
  narrowed to our `SoftwareKind` enum. Falls back to `'unknown'`
  on detector failure.

- **`/api/auth/mastodon/start.get.ts`** — gated route. Validates
  host, get-or-registers, mints state, redirects to remote
  `/oauth/authorize`.

- **`/api/auth/mastodon/callback.get.ts`** — gated route. Three
  outcomes: already-linked (sign in + redirect), logged-in adding
  link (`linkFederatedAccount` with grant), anonymous + first-time
  (`storePendingLink` + redirect to login UI for Phase 2b).

## Decisions worth remembering

- **No new schema migration.** State + cached client credentials
  piggyback on `instance_settings` (KV) with prefixes
  `mastodon_login_state:` and `mastodon_client:`. Phase 2b can
  refactor to a dedicated table when adding audit history if
  warranted.

- **Akkoma reports as `pleroma`** via megalodon's detector — same
  mapping as the FediClient factory's `toMegalodonSns`. Documented
  in the `mapDetectorToSoftwareKind` source.

- **OAuth `?error=` responses** are surfaced to
  `/auth/login?mastodon_error=<msg>` rather than throwing 500 —
  cleaner UX even though the UI doesn't render the error yet
  (Phase 2b will).

- **Anonymous + first-time sign-in path** — uses the existing
  `storePendingLink` machinery (already in place from session 135's
  v1 SSO design). No new wiring; Phase 2b's UI just consumes the
  same `?federated=true&linkToken=...` redirect query.

## Phase 2b — what's next (the UI side)

To make this user-visible:

1. **`useFediHandleProbe` composable** — debounced WebFinger probe
   for `@user@host` strings.
2. **Smart login form** — `pages/auth/login.vue` gets the live
   probe; password field replaced with "Sign in via {host}" button
   when handle resolves to a Mastodon-API host. The button
   navigates to `/api/auth/mastodon/start?host=<host>`.
3. **Pending-link consumption UI** — `/auth/login?federated=true&linkToken=<tok>`
   page that auto-provisions a fresh local account or offers
   "link to existing account" on submit.
4. **Settings page link UI** — for logged-in users: a "Link
   Mastodon account" form at `/settings/account` that POSTs to
   `/api/auth/mastodon/start`.
5. **Real Mastodon smoke test** — once UI lands, test with a
   `mastodon.social` test account end-to-end.

## Operator checklist for enabling Mastodon-login

When ready to flip `features.identity.signInWithRemote: true`:

1. Generate the encryption key: `openssl rand -hex 32`
2. Add `CPUB_FED_TOKEN_KEY=<hex>` to the deploy `.env`
3. Set `features.identity.signInWithRemote: true` in
   `commonpub.config.ts`
4. Deploy. The Nitro `identity-startup` plugin's
   `assertIdentityConfig` confirms the key is set; if not, refuses
   to boot.
5. Until Phase 2b's UI ships, the only way to test is to construct
   the URL manually:
   `curl -L "https://your-instance/api/auth/mastodon/start?host=mastodon.social"`

## Reference verification

```bash
# Both sites running 2.51.0 / 0.21.0
for pkg in server layer; do echo "@commonpub/$pkg: $(npm view @commonpub/$pkg version)"; done
# → server 2.51.0, layer 0.21.0

# Routes 404 with flag off (correct)
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://commonpub.io/api/auth/mastodon/start?host=mastodon.social"
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://deveco.io/api/auth/mastodon/start?host=mastodon.social"
# → 404, 404

# Identity surface still all false
curl -sS https://commonpub.io/api/features | jq .identity
curl -sS https://deveco.io/api/features    | jq .identity
```
