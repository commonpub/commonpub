# Session 136 — Cross-instance identity, simplified plan

> Short, opinionated working plan — written 2026-05-06 after web
> research into Mastodon, Pleroma/Akkoma, GoToSocial, Bonfire,
> AT Protocol, IndieAuth, and the existing TypeScript client lib
> ecosystem (megalodon, masto.js).
>
> This plan supersedes the earlier `136-cross-instance-identity-design.md`
> as the action plan. The earlier doc remains as the *reference*
> design — comprehensive, with full failure-mode matrix and rollout
> tables. This file is the actionable, simplest path that preserves
> flexibility.

> **Phase 1a status (2026-05-06):** the foundation has shipped on
> branch `feat/identity-phase-1a-foundation` (5 commits, ~1100 LOC,
> 54 new tests). Some implementation choices diverged from this plan;
> this document has been updated post-hoc to match the implementation.
> See the "Implementation deviations" section near the bottom.

## TL;DR

1. **Speak the Mastodon API.** As both client (to log into anything
   Fediverse) and server (so anything Mastodon-compatible can log
   into us). The Mastodon API is the de-facto Fediverse standard;
   ActivityPub C2S is a ghost town; everyone else (GoToSocial,
   Akkoma, Pleroma, Iceshrimp, Firefish, Bonfire-mostly) implements
   it. Refer: [Mastodon OAuth spec](https://docs.joinmastodon.org/spec/oauth/).
2. **Use `megalodon` as the client.** Production-grade TypeScript
   library, supports Mastodon + Pleroma + Friendica + Firefish through
   a single interface. Don't invent our own OAuth dance.
   Refer: [megalodon](https://github.com/h3poteto/megalodon).
3. **One `Identity` abstraction, three UI surfaces, ~15 files
   touched.** The compose form, avatar dropdown, login form, and a
   global banner. Existing controllers don't change.

## Why Mastodon-API-first

Three things changed my thinking after the earlier design doc:

- **Mastodon API is everywhere.** Implementing it gives us
  bidirectional interop with the entire mainstream Fediverse with
  no per-protocol effort.
- **Mastodon doesn't use refresh tokens.** Their OAuth grants a
  long-lived access token, revocable via `POST /oauth/revoke`. So
  the v2 design's elaborate refresh-rotation-encryption story was
  solving a problem we don't actually have. We store the token,
  use it until 401, prompt re-link.
- **`megalodon` exists.** The whole "build an OAuth client + token
  store + refresh logic + revocation handling + retry-on-401" subsystem
  is already a battle-tested npm package. Add a thin wrapper.

The existing CommonPub-to-CommonPub OAuth scaffolding (`packages/server/src/federation/oauth.ts`)
was modeled on this same flow without naming it as such. We can
**rename what's already there** to be Mastodon-API-compatible
(it almost is) and the rest of the Fediverse comes along for free.

## The single abstraction

One type. One resolver. One router.

```ts
// packages/auth/src/identity.ts
export interface Identity {
  /** Stable across sessions. References federated_accounts.id for linked, users.id for native. */
  id: string;
  kind: 'native' | 'linked';
  /** Display handle: `user@host`. */
  handle: string;
  /** Bare username, no host. */
  username: string;
  /** Origin instance domain. For native, this is the local instance. */
  instance: string;
  /** AP actor URI. */
  actorUri: string;
  /** Linked-only: the OAuth bearer + scopes for calling this identity's home. */
  grant?: {
    accessToken: string;        // store encrypted at rest
    scopes: ReadonlyArray<Scope>;
    revokedAt: Date | null;     // soft-revocation flag
    softwareKind: 'mastodon' | 'pleroma' | 'cpub' | 'unknown';
  };
}

export interface IdentityContext {
  /** The authenticated session user — always native. */
  session: Identity;
  /** Whoever the session is currently acting as. May === session. */
  active: Identity;
  /** Native + all linked identities for this session. */
  available: ReadonlyArray<Identity>;
}

export async function resolveIdentityContext(event: H3Event): Promise<IdentityContext>;
```

Resolved once per request in middleware, cached on `event.context.identity`,
read everywhere via `useIdentityContext(event)`.

The active identity comes from (in order):

1. `X-Cpub-Acting-As` header (for API clients)
2. `cpub_acting_as` cookie (set by avatar dropdown switcher)
3. `?as=` query param (for per-post override on a single request)
4. Default: `session`

If the requested identity isn't in `available`, fall back silently to
`session`. Fail closed.

## The runtime: action routing without sprawl

The hard rule: **no controller checks `if (active.kind === 'linked')`.**
That branching lives in exactly one place — the action router.

```ts
// packages/server/src/identity/router.ts
export interface ActionRoute<TIn, TOut> {
  name: string;
  scopes: ReadonlyArray<Scope>;
  /** Run on this instance, against the local DB, as the session's native user. */
  local(event: H3Event, identity: Identity, input: TIn): Promise<TOut>;
  /** Run via Mastodon API call to the linked identity's home. */
  remote(client: FediClient, identity: Identity, input: TIn): Promise<TOut>;
}

// packages/server/src/identity/run.ts
export async function run<TIn, TOut>(
  event: H3Event,
  action: ActionRoute<TIn, TOut>,
  input: TIn,
): Promise<TOut> {
  const ctx = await resolveIdentityContext(event);
  if (ctx.active.kind === 'native') return action.local(event, ctx.active, input);
  if (!ctx.active.grant) throw new ActionUnavailable(action.name, 'no-grant');
  if (!hasAllScopes(ctx.active.grant.scopes, action.scopes)) {
    throw new InsufficientScopes(action.name, action.scopes);
  }
  const client = await getFediClient(ctx.active);
  return action.remote(client, ctx.active, input);
}
```

The existing `createPublishedContent`, `createLike`, etc. **don't move
or change**. They become the body of `local()`. The `remote()` half is
a thin Mastodon API call.

```ts
// packages/server/src/identity/actions/publish.ts
export const publishAction: ActionRoute<PublishInput, ContentRow> = {
  name: 'publish',
  scopes: ['write'],
  local: (event, _identity, input) => createPublishedContent(useDB(event), input),
  remote: (client, _identity, input) => client.statuses.create({
    status: input.body,
    visibility: input.visibility ?? 'public',
    // CommonPub's BlockTuple → Mastodon's plain status text adapter
    // lives in this file; trivial today since both speak HTML/markdown.
  }),
};
```

A controller calls `await run(event, publishAction, input)`. Done.
Adding a new proxiable action = one file. **No edits across the
codebase.**

Actions that should NOT be remoteable get `remote = undefined` (or
throw). That set is fixed: profile edits, settings, admin actions.

## The Mastodon-API client: thin wrapper around megalodon

```ts
// packages/server/src/identity/fediClient.ts
import { default as generator } from 'megalodon';

export interface FediClient {
  statuses: { create(opts): Promise<Status>; delete(id): Promise<void> };
  favourites: { add(statusId): Promise<void>; remove(statusId): Promise<void> };
  follows: { add(account): Promise<void>; remove(account): Promise<void> };
  account: { verifyCredentials(): Promise<Account> };
  // ... only what we actually call
}

export async function getFediClient(identity: Identity): Promise<FediClient> {
  if (identity.kind !== 'linked' || !identity.grant) {
    throw new Error('cannot create FediClient for non-linked identity');
  }
  const baseUrl = `https://${identity.instance}`;
  const client = generator(identity.grant.softwareKind, baseUrl, identity.grant.accessToken);
  return wrapMegalodonAsFediClient(client, identity);
}
```

The wrapper layer:

- **Detects 401** → marks `revokedAt`, throws `LinkedIdentityRevoked`
- **Logs every call** to an audit table: `{actor, instance, action,
  result, latency_ms}`. One row per call. Surface in admin UI.
- **Never logs the token** (redaction rule applied at logger init,
  verified at startup).
- **Single-flight refresh** keyed by `federatedAccountId` — even if
  Mastodon doesn't refresh, we may add adapters that do.

## Schema: one migration, additive

As implemented in
`packages/schema/migrations/0004_federated_oauth_tokens.sql`:

```sql
ALTER TABLE federated_accounts
  ADD COLUMN access_token_ciphertext text,           -- base64(ct||tag), null until set
  ADD COLUMN access_token_iv         text,           -- base64(12-byte nonce)
  ADD COLUMN scopes                  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN software_kind           varchar(32) NOT NULL DEFAULT 'unknown',
  ADD COLUMN revoked_at              timestamptz,
  ADD COLUMN last_verified_at        timestamptz;
```

Notes on what shipped vs the original sketch:

- **`text` not `bytea`.** Tokens are stored as base64-encoded strings.
  Drizzle/PGlite portability is simpler and the ~33% storage overhead
  is negligible for OAuth tokens. The crypto layer transparently
  base64-encodes/decodes.
- **No CHECK on `software_kind`.** Validation happens at the
  application layer via `isSoftwareKind()` in `@commonpub/auth`. A
  database CHECK would lock out future protocol kinds (AT Proto,
  Solid, etc.) until a migration was filed; the application guard is
  forward-compatible.
- **No partial index on `revoked_at`.** Skipped because Phase 1a has
  no consumers yet. Add when Phase 1b's "find expiring tokens to
  refresh / verify" cron actually queries it.
- **Column name: `access_token_ciphertext`** (not
  `access_token_encrypted`) — more precise, since it's specifically
  AEAD ciphertext bundling tag||ct, not just "encrypted".

Token encryption: ChaCha20-Poly1305 with a 32-byte key in the
`CPUB_FED_TOKEN_KEY` env var. IV per row. Plain access tokens are
never written to disk. (Helpers in `@commonpub/infra`: `encryptToken`,
`decryptToken`. Wraps `@noble/ciphers/chacha`.)

No refresh-token columns. Mastodon doesn't issue refresh tokens; if a
future protocol adapter (AT Proto OAuth, IndieAuth) does, those go in
adapter-specific tables linked back to `federated_accounts.id`.

## The three UI surfaces (and the banner)

### 1. Smart login form

```vue
<!-- layers/base/pages/auth/login.vue -->
<input v-model="handle" placeholder="@user@host or email" />
<!-- as user types, useFediHandleProbe debounces, does WebFinger,
     confirms server is Mastodon-API-compatible -->
<template v-if="probe.state === 'remote'">
  <button @click="signInVia(probe)">
    Sign in via {{ probe.instance }}
  </button>
  <p class="hint">No new password — you'll be redirected briefly.</p>
</template>
<template v-else>
  <input type="password" v-model="password" />
  <button>Sign in</button>
</template>
```

`useFediHandleProbe` resolution states:
- `empty` — no input or just username
- `local` — looks like email or bare username, fall through to password
- `remote` — `@user@host` shape, host probed and Mastodon-API-detected
- `unsupported` — `@user@host` shape but host doesn't speak Mastodon API
- `unreachable` — host probe failed

The probe caches results per session (deduplicate WebFinger traffic).
The `Sign in via` button kicks off the OAuth dance via `/api/auth/link/start?host=<probed>`.

### 2. Avatar dropdown — "Acting as" section

```
┌─────────────────────────────────────┐
│ 👤 moheeb@deveco.io          (you)  │ ← native identity, immutable
│ ─────────────────────────────────── │
│ Acting as:                          │ ← mutable section
│ ● moheeb@deveco.io       (native)   │
│ ○ moheeb@commonpub.io     (linked)  │
│ ○ cwebber@social.coop  (linked, FA) │ ← shows software kind
│ ─────────────────────────────────── │
│ + Link another account              │
│ ⚙ Settings                          │
│ ⏻ Sign out                          │
└─────────────────────────────────────┘
```

Clicking the radio sets `cpub_acting_as` cookie + reloads to apply.
"Link another account" goes to a settings page that runs the same
OAuth dance as login but with an existing session.

### 3. Compose form — per-post identity picker

Only renders when `available.length > 1`:

```
┌──────────────────────────────────────────┐
│ Publishing to: [moheeb@commonpub.io  ▼] │ ← starts at active
│                                          │
│ [textarea]                               │
│                                          │
│ [Cancel]                       [Publish] │
└──────────────────────────────────────────┘
```

Per-post override does NOT mutate the cookie. Just sends `?as=<id>`
on the publish request. Other parts of the page stay in the active
context.

### 4. The persistent banner (the real UX god move)

When `active !== session`, a sticky bar pinned to the viewport top:

```
┌────────────────────────────────────────────────────────────────┐
│ 🪪 Acting as @moheeb@commonpub.io. [Switch back to deveco]     │ ← amber bg
└────────────────────────────────────────────────────────────────┘
```

Color-distinct from the main UI (Stripe/AWS pattern). Always visible.
One click reverts. The banner is *the* affordance against the #1
acting-as failure mode: silently posting from the wrong identity.
Hidden context = malware. Persistent indicator = sanity.

**Theme-token prerequisites (Phase 4 must add these BEFORE shipping
any UI):**

CLAUDE.md rule #3: no hardcoded colours in `@commonpub/ui` /
`@commonpub/docs`. The "amber" banner must read from CSS custom
properties. Add to `packages/ui/theme/base.css` and `dark.css`:

```css
:root {
  /* "Acting as" / context-warning state. Distinct from main UI. */
  --color-acting-as-bg:        /* amber-ish; ~ #fef3c7 in light, #4a3a18 dark */;
  --color-acting-as-bg-strong: /* slightly darker for hover */;
  --color-acting-as-fg:        /* foreground text on the bg */;
  --color-acting-as-border:    /* 2px border per design system */;
}
```

Then `ActingAsBanner.vue` and `IdentitySwitcher.vue` reference
`var(--color-acting-as-*)` only. Same rule for the per-action chip
(`Posting as @...` next to publish button) — it should use either
`--color-acting-as-bg` (consistent visual signal) or `--accent-bg`
(if the design opts for the theme accent).

The compose form's identity dropdown should reuse existing
`@commonpub/ui` token primitives (`--input-bg`, `--input-border`,
`--text-primary`) — no custom palette needed there.

If the design lands in a non-`@commonpub/ui` package (e.g., direct
in `layers/base/components/`), CLAUDE.md rule #3 technically doesn't
apply. But the spirit of the rule does: still use `var(--*)` for
themability across instance brands.

### Plus: contextual indicators (passive)

- Compose textarea shows a small `Posting as @...` chip beside the
  Publish button — confirms intent at the moment of action.
- When viewing a post by `@bob@host` and you have a linked identity at
  `host`, the like/comment/follow buttons gain a small "via @..." chip
  showing which of your identities will perform it. Click chip to
  toggle for that interaction only.

## File diff estimate (the "doesn't edit everything" claim)

New files:

```
packages/auth/src/identity.ts                       # Identity, IdentityContext, scope enum
packages/server/src/identity/router.ts              # ActionRoute, run()
packages/server/src/identity/fediClient.ts          # megalodon wrapper
packages/server/src/identity/actions/publish.ts     # ActionRoute for publish
packages/server/src/identity/actions/like.ts        # ditto
packages/server/src/identity/actions/follow.ts      # ditto
packages/server/src/identity/actions/comment.ts     # ditto
packages/schema/migrations/0004_federated_oauth_tokens.sql
packages/infra/src/tokenCrypto.ts                   # chacha20-poly1305 helpers
layers/base/server/middleware/identity.ts           # resolves IdentityContext
layers/base/server/api/auth/link/start.get.ts       # initiate OAuth flow
layers/base/server/api/auth/link/callback.get.ts    # handle OAuth callback
layers/base/composables/useFediHandleProbe.ts       # debounced WebFinger probe
layers/base/composables/useIdentityContext.ts       # client-side reactive identity
layers/base/components/IdentitySwitcher.vue         # the dropdown content
layers/base/components/ActingAsBanner.vue           # the sticky banner
```

Modified files (smallest possible):

```
packages/schema/src/auth.ts                          # add token columns to federatedAccounts
packages/server/src/index.ts                        # export ActionRoute, run, etc.
layers/base/pages/auth/login.vue                    # add useFediHandleProbe + remote-bounce
layers/base/components/AvatarDropdown.vue           # mount IdentitySwitcher
layers/base/components/ComposeForm.vue              # add publish-as picker (renders only when available.length > 1)
layers/base/layouts/default.vue                     # mount ActingAsBanner
layers/base/server/api/content/index.post.ts        # call run(event, publishAction, input)
layers/base/server/api/content/[id]/like.post.ts    # call run(event, likeAction, ...)
... ~5–10 controllers swap to run()
```

That's ~16 new files, ~10 edited. Most existing controllers stay byte-for-byte identical until you choose to make them remoteable — that's just changing one call.

## Phased rollout (each phase ships behind a flag)

```ts
// commonpub.config.ts
features: {
  identity: {
    // Phase 1: link only, read-only.
    linkRemoteAccounts: false,
    // Phase 2: smart login form + auto-provision.
    signInWithRemote: false,
    // Phase 3: acting-as switcher + banner. No remote actions yet.
    actingAs: false,
    // Phase 4: remote actions (per-action toggle).
    remoteActions: {
      interact: false,   // like, follow, comment
      publish: false,    // create content
    },
  }
}
```

**Phase 1 — link & read.** Migration 0004. OAuth dance against any
Mastodon-API host. Settings page "Link account". Stored token used
only to call `/api/v1/accounts/verify_credentials` and display a
linked-profile chip on user settings. Two days of work.

**Phase 2 — sign in with remote.** Smart login form. Auto-provision
local user on first remote sign-in. Username collisions handled with
`<username>_<host>` fallback. Two more days.

**Phase 3 — acting-as.** `IdentityContext` middleware, switcher,
banner. No remote actions yet — just the context machinery, so
switching just shows the banner and changes which identity displays
on profile pages. Three days.

**Phase 4 — remote actions, gradually.** Wire `like`, `follow`,
`comment` first (low blast radius — these are idempotent-ish and
recoverable). Then `publish`. Per-action feature flags. ~5 days.

**Total: ~12 working days for the full vision shipped in 4 deployable
slices.** Each slice is independently valuable; no slice depends on
the next.

## Failure modes (abbreviated — full matrix in the design doc)

The dominant failure modes for a Mastodon-API world:

| # | Failure | Mitigation | UX surface |
|---|---|---|---|
| 1 | Token revoked at remote (401) | Mark `revoked_at`; throw | "Re-link your @host account" banner |
| 2 | Remote down | Retry 3× with backoff; queue publishes if idempotent | "Couldn't reach @host. Will retry." |
| 3 | Scope insufficient (403) | Parse `WWW-Authenticate`; prompt re-authorize | "This needs `publish`. [Grant?]" |
| 4 | Phishing instance fingerprint mismatch | Cache instance public key + DCR client_id at first link; hard-fail on mismatch | Loud red interstitial, never auto-proceed |
| 5 | Username collision on auto-provision | Try `<username>_<host>`, then numeric suffix | "Pick a username for this account" if both fail |
| 6 | DNS rebind on probe | Already mitigated by `safeFetch` (session 135) | invisible |
| 7 | Multi-tab race on token use | Single-flight `Map<federatedAccountId, Promise>` | invisible |
| 8 | Token leaked from DB dump | ChaCha20-Poly1305 at rest with env-key | post-incident: rotate env-key, re-encrypt |
| 9 | Remote rate limit (429) | Honor `Retry-After`; queue if action has idempotency key | "Slow down. Retrying in N s." |
| 10 | User deletes linked account at remote | Next call 401 → revoked path | same banner as #1 |
| 11 | We try to interact-as on a non-Mastodon-API host (e.g., a Bonfire instance that didn't ship the API) | `softwareKind = 'unknown'`, route disabled at link time | "This instance doesn't support remote interactions yet" |

Most of these are unchanged from the design doc. The biggest
simplification is **#1**: in Mastodon-world there's no refresh, so
the recovery path is one click "re-link" rather than the four-step
refresh-rotation-revocation-cascade in the v2 design.

## What this unlocks

Same as the design doc, abbreviated:

1. **Day-one Fediverse interop.** Sign in to commonpub with your
   `@cwebber@social.coop` Mastodon identity. Post from commonpub to
   your Mastodon. No protocol negotiation.
2. **Zero per-instance integration burden** for third-party clients.
   Build a CommonPub client using `megalodon` and it works against
   every CommonPub instance plus every Mastodon, Akkoma, Pleroma,
   GoToSocial, etc.
3. **Migration paths.** Mastodon → CommonPub: log in with your
   Mastodon identity, optionally import follows.
4. **Multi-context one-click.** Personal vs. work, fanfic vs. pro,
   no log-out-log-in.
5. **Identity portability.** Bidirectional, ongoing — instance
   shutdown becomes "primary residence changed", not "account lost".
6. **Future protocol adapters.** AT Proto's PDS OAuth, IndieAuth,
   Solid OIDC: each is a new `softwareKind` + new client adapter.
   Everything else (router, switcher, banner, schema) stays.
7. **Lossless second-factor recovery.** Linked identity at deveco
   can attest "this is moheeb" via signed AP activity if commonpub
   recovery is needed.

## Open questions (the only three that can't be deferred)

**Q1 — Mastodon-API surface scope.** Which endpoints do we implement
on our own server? Minimum useful: `/api/v1/apps`, `/oauth/authorize`,
`/oauth/token`, `/oauth/revoke`, `/api/v1/accounts/verify_credentials`,
`/api/v1/statuses` (POST). With those five, any Mastodon client can
log into a CommonPub instance and post. Extending to `/api/v1/timelines/home`
etc. broadens the third-party-client story but isn't required for
the user's vision. Recommendation: ship the five, lazy-add the rest.

**Q2 — How do BlockTuple posts translate to Mastodon's plain
status?** Mastodon expects `status: string` (plain text or simple
HTML). CommonPub's BlockTuple is structured. The remote publish
adapter needs a "render to plain HTML" pass + a truncation policy
(Mastodon's default char limit is 500, configurable). Reverse
direction: Mastodon-style status fetched from a remote → render in
our UI. Recommendation: add `protocol/src/blockToMastodon.ts` and
`protocol/src/mastodonToBlock.ts`. Keep them dumb; round-trip is not
required.

**Q3 — Acting-as for SSE / real-time.** The notification stream and
realtime API today key off `event.context.user`. Should they key
off `active` or `session`? Recommendation: **session** (notifications
are inherently about your local account). When acting as a linked
identity, the user should still see *their* notifications, not the
linked-account's. Linked notifications would require subscribing to
the remote instance's stream — a future addition.

## Implementation notes / leverage points

These are the calls to get right early so the rest follows:

- **Resolve identity context in middleware, not controllers.** Mount
  `identity.ts` middleware ahead of route handlers so every event
  has `event.context.identity` populated. Controllers never call
  `resolveIdentityContext` directly.
- **Make `run()` the gateway for every user action.** Even native
  actions go through it. Keeps the hot path uniform; analytics/logging
  attaches in one place.
- **`FediClient` is opaque to callers.** No leaking
  `Authorization: Bearer ...` outside this file. Caller does not
  know about token storage.
- **Encrypt tokens at rest, day one.** Don't ship plain-text in
  phase 1 with intent-to-encrypt-later. Re-encrypting at load is a
  migration; encrypting from the start is an env-var.
- **Audit-log every linked-action call.** Schema:
  `{at, sessionUserId, federatedAccountId, instance, action, status, latency_ms}`.
  Surface in admin UI as part of the federation page (already
  exists).
- **Scope grants narrow, expand on prompt.** First link grants
  `read`. User clicks "publish via this account" → re-authorize with
  `read write`. Don't request the union upfront — friction kills
  conversion.
- **The `softwareKind` field is load-bearing.** `mastodon`,
  `pleroma`, `gotosocial`, etc. — `megalodon` already does software
  detection. Cache the result on first link; use it to gate features
  (e.g., bookmarks: Mastodon yes, GoToSocial yes, Bonfire ?).
- **Don't reinvent the OAuth state-machine UI.** The existing
  `pages/auth/oauth/authorize.vue` consent screen works for
  CommonPub-as-AS. Extend it to display the requesting client's
  domain + scopes prominently. Don't redesign.
- **The 'pending link' token machinery already exists** in
  `oauth.ts` (`storePendingLink` / `consumePendingLink`). Reuse for
  auto-provision flow.

## The 8-step end-to-end demo (when phases 1–4 are shipped)

1. User has `@cwebber@social.coop` (a real Mastodon account).
2. Visits `commonpub.io`, types `@cwebber@social.coop` in login.
   Password field becomes "Sign in via social.coop".
3. One click. OAuth dance. Returns. commonpub auto-provisions a
   local `cwebber` linked to `cwebber@social.coop`. No password
   chosen.
4. Avatar dropdown shows `cwebber@commonpub.io (you)` and
   `cwebber@social.coop (linked, mastodon)`.
5. Switches to `cwebber@social.coop`. Amber banner appears at top.
6. Composes a post. Picker says "Publishing to: social.coop".
   Publishes.
7. Status appears in `social.coop`'s API. Federates to whoever
   follows `cwebber@social.coop`. Other Mastodon users see it as a
   normal toot from cwebber.
8. Likes a post by `@evan@mastodon.social`. Like is sent via Mastodon
   API to `social.coop`, which federates to `mastodon.social`.
   `evan` sees the like under `cwebber@social.coop`'s identity.

Demo complete. Total commits: ~30 across 4 PRs.

## Required env / config additions

```sh
# commonpub.io / deveco.io .env
CPUB_FED_TOKEN_KEY=<32-byte hex from `openssl rand -hex 32`>
```

```ts
// commonpub.config.ts
features: {
  identity: {
    linkRemoteAccounts: true,   // phase 1
    signInWithRemote: true,     // phase 2
    actingAs: true,             // phase 3
    remoteActions: {
      interact: true,           // phase 4a
      publish: false,           // phase 4b — last
    },
  },
},
auth: {
  // Already exists; widen "trustedInstances" semantics:
  // - explicit list = whitelist (only these allowed to be linked from)
  // - undefined = any Mastodon-API host allowed
  // - empty array = no linking allowed (lock down)
}
```

## Why this is "elegant" — the test

If a year from now we want to add AT Protocol support:

1. New file: `packages/server/src/identity/atprotoClient.ts`
2. Add `'atproto'` to `softwareKind` enum
3. Detection logic in `getFediClient`: if `softwareKind === 'atproto'`,
   use atprotoClient instead of megalodon
4. Possibly: new ActionRoute adapter shapes (likely the same — most
   actions translate cleanly)

Zero changes to controllers. Zero changes to schema. Zero changes to
UI. The whole rest of the codebase doesn't know we added another
protocol.

That's the test. If a future protocol adapter requires more than 5
file changes outside `identity/`, the abstraction is wrong.

## Implementation deviations (Phase 1a as actually shipped)

Captured here so the plan stays synchronised with reality.

- **Column type / naming:** see the "Schema" section above.
- **Router signature is generic over event type.** `ActionRoute<TEvent, TIn, TOut>`
  rather than `ActionRoute<TIn, TOut>` with hardcoded `H3Event`. This
  keeps `@commonpub/server` framework-agnostic (no `h3` dependency).
  Layer-side code instantiates `ActionRoute<H3Event, ...>`. Tests use
  `unknown`.
- **`run()` does not take `IdentityContext`; it takes the active
  identity directly.** This keeps `run()` a pure function of its
  inputs and trivially unit-testable. Middleware that resolves
  IdentityContext (Phase 3+) reads `event.context.identity.active`
  and forwards it to `run()`.
- **FediClient uses factory-registration.** `setFediClientFactory(...)`
  is called once at app init by Phase 1b's plugin; `getFediClient`
  internally delegates. Avoids threading `db` / token-key /
  audit-logger dependencies through every `run()` call site, and
  avoids leaking framework-specific globals into
  `@commonpub/server`. Tests register a mock factory per-case via
  `setFediClientFactory`, clear with `setFediClientFactory(null)` in
  `afterEach`.
- **No bounded `revoked_at` partial index in Phase 1a.** No consumers
  yet. Add with Phase 1b's verify-credentials cron.
- **No CHECK on `software_kind`.** Application-layer validation only.
- **PKCE / OIDC discovery doc / refresh tokens NOT added in Phase 1a.**
  Phase 1a only ships data + crypto + types + router skeleton.
  Phase 1b adds the OAuth flow; PKCE rides along then.

## What's NOT in this plan (deliberately)

- **Federation-wide reputation signals.** Future. Requires a separate
  trust-graph model.
- **Unified inbox across linked instances.** Future. Requires
  consuming remote streams.
- **Account migration / data import from remote.** Future. Useful
  but distinct.
- **Org / delegation grants.** Future. Same primitives but adds a
  permission model on top.
- **Public client (PKCE-only) registration.** Mastodon supports
  confidential clients only today; if mobile/browser-native CommonPub
  clients want to skip a server backend, we'd need a different
  registration path. Not blocking the plan.

These are valuable but each is an independent ship. None block the
core 4 phases.

## Sources & prior art

- [Mastodon OAuth 2.0 spec](https://docs.joinmastodon.org/spec/oauth/) —
  authorization code + client credentials, no refresh tokens, PKCE
  in 4.3+, revocation endpoint.
- [Mastodon /api/v1/apps](https://docs.joinmastodon.org/methods/apps/) —
  proprietary client registration; not standard DCR but idempotent
  enough.
- [Mastodon "Logging in with an account"](https://docs.joinmastodon.org/client/authorized/) —
  the canonical client flow we should match.
- [megalodon](https://github.com/h3poteto/megalodon) — Mastodon +
  Pleroma + Friendica + Firefish unified client.
- [IndieAuth spec](https://indieauth.spec.indieweb.org/) — profile
  URL as identity; relevant for personal-domain users (Phase 5+).
- [AT Protocol OAuth blog post](https://docs.bsky.app/blog/oauth-atproto) —
  Bluesky/AT Proto's OAuth direction; future adapter.
- [Bonfire federation interop docs](https://docs.bonfirenetworks.org/federation-interoperability.html) —
  same WebFinger + ActivityPub assumptions.
- [Phanpy](https://github.com/cheeaun/phanpy) — gold-standard
  multi-account UX. Look at their account switcher pattern before
  designing ours.

## What "ready to start" looks like

If/when we open the implementation:

1. `git checkout -b feat/identity-phase-1-link`
2. Write `packages/schema/migrations/0004_federated_oauth_tokens.sql`
3. Update `packages/schema/src/auth.ts` (add columns to
   federatedAccounts; export `Identity` type)
4. Add `packages/infra/src/tokenCrypto.ts` (chacha20-poly1305)
5. Write `packages/server/src/identity/{identity,fediClient,run}.ts`
6. Add the auth/link routes
7. Add the settings-page "Link account" UI (one new vue component)
8. Smoke: link a deveco account from commonpub via the existing
   CommonPub-to-CommonPub OAuth (already works), verify
   `verify_credentials` returns the linked profile through `FediClient`
9. Smoke: link a real Mastodon account from commonpub (e.g., a
   `mastodon.social` test account), verify the same
10. Ship phase 1 behind `features.identity.linkRemoteAccounts = true`

That's the first PR. Two days, ~16 files. Each subsequent phase is
about the same size.
