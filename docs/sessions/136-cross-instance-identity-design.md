# Session 136 — Cross-instance identity & delegated authorization design

Status: design doc, no code yet. Drafted 2026-05-06 in conversation
following the session 135/136 audit + deploy. Supersedes ADR 010 in
scope (still references it) — this proposal extends the current
SSO-only model into delegated authorization.

## Where we are

What ships today (verified in audit, not just docs):

- **WebFinger discovery** — `packages/auth/src/sso.ts:discoverOAuthEndpoint`.
  Looks up `acct:user@host`, follows the `oauth_endpoint` link in the
  JRD response. (Custom rel; not standard OIDC discovery.)
- **OAuth2 authorization-code server** —
  `packages/server/src/federation/oauth.ts:processAuthorize` and
  `processTokenExchange`. Auth codes stored in `oauth_codes` table
  with single-use semantics; access tokens are 3600s, no refresh.
- **OAuth2 client** — `exchangeCodeForToken` calls remote token
  endpoint, returns `{ accessToken, user }`. Token is discarded after
  first use (just verifies identity).
- **Dynamic Client Registration** — `processDynamicRegistration`
  idempotent per-domain; instance B registers itself with instance A
  on first link.
- **`federated_accounts` table** — joins local `users.id` to remote
  `actor_uri`. **No token storage.** Stores profile snapshot
  (preferredUsername, displayName, avatarUrl, lastSyncedAt) only.
- **Trusted-instance gating** — both config-file and DB-stored
  allowlists; both ends must explicitly trust.
- **Pending-link tokens** — `storePendingLink` / `consumePendingLink`
  hold a verified-via-OAuth identity for ~10 min between OAuth
  callback and "create local account" UI step. So sign-up via remote
  is partially scaffolded.
- **`createFederatedSession`** — direct INSERT into
  `sessions` table to mint a Better Auth session for a federated
  user, bypassing email/password.

ADR 010 is the source of truth for the v1 design. The model: OAuth is
a one-shot SSO probe, not a persistent grant. Tokens live for 60 min
and are never refreshed because nobody calls remote APIs with them
after the initial sign-in.

## What the user wants (vision, paraphrased)

1. **Account linking** — `moheeb@commonpub.io` and `moheeb@deveco.io`
   can be linked, treated as the same person, switch between contexts.
2. **No-extra-account sign-up via remote** — visiting a new instance,
   typing `@moheeb@commonpub.io`, and ending up with a local account
   that's authenticated via the home instance — no new password,
   username preserved.
3. **Smart login form** — typing `@user@host` in the login field
   replaces the password field with "sign in via *host*"; if you're
   already signed in there, instant; else bounce + return.
4. **Direct interaction on remote instances** — from deveco's UI,
   like/comment/follow/post on commonpub *as* your linked
   commonpub identity (not a federated relay through deveco).
5. **Cross-instance publish-as picker** — compose form has a
   "publishing to: [instance / identity]" dropdown so a single user
   can drive multiple identities from one UI.

## Gap analysis

| Capability | v1 (current) | v2 (vision) |
|---|---|---|
| WebFinger discovery | ✅ | ✅ standardize |
| OAuth authorization code grant | ✅ | ✅ |
| Token storage | ❌ discarded | ✅ persist `access_token` + `refresh_token` |
| Refresh tokens | ❌ | ✅ rotate before expiry |
| Scopes | ❌ implicit "all" | ✅ explicit (`read`, `write`, `follow`, `publish`, `interact`) |
| Identity context (acting-as) | ❌ session = single identity | ✅ session = native identity + N linked, with active context |
| Cross-instance API client | ❌ one-shot fetch in SSO callback | ✅ pooled clients with auto-refresh per linked identity |
| Sign-up via remote | ⚠️ partially (pending-link tokens exist) | ✅ first-class flow, no password choice |
| Login form auto-detect `@user@host` | ❌ | ✅ live WebFinger as user types |
| Compose "publish-as" picker | ❌ | ✅ |
| Like/comment/follow via linked identity | ❌ | ✅ |
| Token revocation endpoint | ❌ | ✅ both as server (revoke our tokens) and client (drop linked grant) |
| Standard OIDC discovery doc | ❌ uses custom WebFinger rel | ✅ also serve `/.well-known/openid-configuration` |
| Better Auth `account` OAuth columns | ❌ (audit #13 dormant) | ✅ ship migration when first OAuth provider enabled |

## Layered architecture

The design splits into four layers that compose cleanly. Each layer
is independently shippable behind a feature flag.

```
┌───────────────────────────────────────────────────────────────────┐
│ Layer 4: UI primitives                                            │
│  - account switcher (avatar dropdown)                             │
│  - compose publish-as picker                                      │
│  - login form @user@host live-resolve                             │
│  - per-post "act as linked identity" affordances                  │
└───────────────────────────────────────────────────────────────────┘
                              ▲
┌───────────────────────────────────────────────────────────────────┐
│ Layer 3: Action routing                                           │
│  - publishAction.route(identity) → local | proxy                  │
│  - likeAction, followAction, commentAction, etc.                  │
│  - one place that decides "do this locally or proxy to remote"    │
└───────────────────────────────────────────────────────────────────┘
                              ▲
┌───────────────────────────────────────────────────────────────────┐
│ Layer 2: Identity context + federated client pool                 │
│  - resolveIdentityContext(event) → { sessionUser, actingAs, all } │
│  - getInstanceClient(localUserId, foreignActorUri) → client       │
│  - auto-refresh, token rotation, retry-on-401                     │
└───────────────────────────────────────────────────────────────────┘
                              ▲
┌───────────────────────────────────────────────────────────────────┐
│ Layer 1: Discovery + grant primitives                             │
│  - WebFinger lookup (existing)                                    │
│  - OIDC discovery doc (new)                                       │
│  - OAuth authorize / token / refresh / revoke (extend existing)   │
│  - DCR (existing)                                                 │
│  - federated_accounts schema migration (add token columns)        │
└───────────────────────────────────────────────────────────────────┘
```

### Layer 1: Discovery + grant primitives

**Standardize OIDC discovery.** Continue serving the WebFinger
`oauth_endpoint` rel for backwards compat, but also expose
`/.well-known/openid-configuration` with the canonical fields:

```json
{
  "issuer": "https://commonpub.io",
  "authorization_endpoint": "https://commonpub.io/auth/oauth/authorize",
  "token_endpoint": "https://commonpub.io/api/auth/oauth2/token",
  "registration_endpoint": "https://commonpub.io/api/auth/oauth2/register",
  "revocation_endpoint": "https://commonpub.io/api/auth/oauth2/revoke",
  "userinfo_endpoint": "https://commonpub.io/api/users/me",
  "scopes_supported": ["openid", "profile", "read", "write", "follow", "publish", "interact"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"]
}
```

This makes us interoperable with any OIDC-aware client and gives a
clean upgrade path (other Fediverse impls or third-party tools can
sign in to a CommonPub instance without learning our custom WebFinger
extension).

**Add PKCE support** (`code_challenge` / `code_challenge_method=S256`)
on the authorize endpoint. Needed because some clients can't keep a
client_secret (browser-side native apps). Already a 2025 best
practice; should not be optional.

**Add refresh tokens.** Token endpoint returns:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "read write follow",
  "id_token": "...optional, OIDC..."
}
```

Refresh tokens stored hashed (SHA-256) on the server, rotated on use
(emit a new refresh token each time). Lifetime: 30 days idle, 90 days
absolute. Revocable via revocation endpoint.

**Schema migration `0004_oauth_tokens.sql`:**

```sql
-- federated_accounts gets token storage so the current user's
-- session can act on a linked remote instance.
ALTER TABLE federated_accounts
  ADD COLUMN access_token        TEXT,
  ADD COLUMN access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN refresh_token_hash  TEXT,
  ADD COLUMN refresh_token_expires_at TIMESTAMPTZ,
  ADD COLUMN scopes              TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN token_status        TEXT NOT NULL DEFAULT 'active'
    CHECK (token_status IN ('active', 'expired', 'revoked', 'pending'));

-- Index for token-status filtering (e.g., "find expiring tokens to refresh")
CREATE INDEX idx_federated_accounts_token_status
  ON federated_accounts (token_status);

-- The Better-Auth account table needs OAuth columns too (audit #13).
-- Ship simultaneously since we're touching auth schema; both gates
-- behind features.federatedAuth.delegatedActions in commonpub.config.
ALTER TABLE accounts
  ADD COLUMN id_token TEXT,
  ADD COLUMN access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN refresh_token_expires_at TIMESTAMPTZ,
  ADD COLUMN scope TEXT;
```

Why `refresh_token_hash` (not the raw token):
- Stolen DB dumps don't yield refresh tokens.
- We compare incoming refresh_token by hashing it and checking against
  the stored hash. Same pattern as password storage.
- Access tokens are short-lived enough to store in plain (still
  encrypted at rest at the disk level, but no need for hash compare).

### Layer 2: Identity context + federated client pool

**The core abstraction:**

```ts
// packages/auth/src/identityContext.ts
export type ActorIdentity =
  | NativeIdentity
  | LinkedIdentity;

export interface NativeIdentity {
  kind: 'native';
  /** Local user id (users.id PK). */
  userId: string;
  /** Local actor URI (this instance). */
  actorUri: string;
  /** Bare username, no @host. */
  username: string;
  /** Same instance as `config.instance.domain`. */
  instance: string;
}

export interface LinkedIdentity {
  kind: 'linked';
  /** The local user this linked identity belongs to. */
  localUserId: string;
  /** federated_accounts.id */
  federatedAccountId: string;
  /** Remote actor URI (e.g., https://commonpub.io/users/moheeb). */
  foreignActorUri: string;
  /** Remote handle username (no @host). */
  username: string;
  /** Remote instance domain. */
  instance: string;
  /** OAuth grant status. */
  tokenStatus: 'active' | 'expired' | 'revoked' | 'pending';
  /** Granted scopes. */
  scopes: ReadonlyArray<Scope>;
}

export interface IdentityContext {
  /** Always the user the Better Auth session resolved to. */
  sessionUser: NativeIdentity;
  /** The active acting-as identity for this request. May be the same as sessionUser. */
  actingAs: ActorIdentity;
  /** All identities available to this session. */
  available: ReadonlyArray<ActorIdentity>;
}

export async function resolveIdentityContext(event: H3Event): Promise<IdentityContext>;
export async function setActingAs(event: H3Event, target: ActorIdentity): Promise<void>;
```

**How `actingAs` is selected per request:**
1. Check the explicit `X-Cpub-Acting-As` header (preferred for API clients).
2. Else check `cpub_acting_as` cookie (set by UI account switcher).
3. Else default to `sessionUser`.
4. If the requested actor isn't in `available`, fail closed (return native).

**The federated client:**

```ts
// packages/server/src/federation/instanceClient.ts
export class FederatedInstanceClient {
  constructor(
    private readonly db: DB,
    private readonly federatedAccountId: string,
    private readonly remoteInstance: string,
  ) {}

  /** GET with bearer; auto-refresh on 401. */
  async get<T>(path: string, init?: RequestInit): Promise<T>;
  /** POST (and PUT/PATCH/DELETE variants). */
  async post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;

  /** Force a refresh now. */
  async refresh(): Promise<void>;
  /** Revoke the grant remotely + locally. */
  async unlink(): Promise<void>;
}

export async function getInstanceClient(
  db: DB,
  localUserId: string,
  foreignActorUri: string,
): Promise<FederatedInstanceClient>;
```

**Refresh flow** (worth being explicit about, this is where bugs live):

1. Caller invokes `client.post('/api/content', body)`.
2. Client reads `federated_accounts` for this id, sees
   `access_token_expires_at` is in the future → uses it.
3. If 401 returned → calls `refresh()`:
   a. Reads `refresh_token_hash` (no — we hash incoming, not outgoing
      — for refresh we need the *raw* token. Solution: store the
      ENCRYPTED raw refresh token, not just the hash. Encryption key
      lives in env.) — see Refresh-token-storage variants below.
   b. POST to remote `/api/auth/oauth2/token` with
      `grant_type=refresh_token&refresh_token=<raw>`.
   c. Receive new `access_token` + `refresh_token`. Update row.
   d. Retry the original call once.
4. If refresh returns 400 with `invalid_grant` → mark
   `token_status = 'revoked'`, throw `LinkedIdentityRevoked`. Caller
   must surface to UI as "Re-link your commonpub.io account".

**Refresh-token-storage variants — pick one:**

| Variant | Pros | Cons | Recommendation |
|---|---|---|---|
| Plaintext | Simplest | DB dump = full grants | ❌ |
| Hash-only | Stolen-dump-safe | Can't actually use to refresh — hash is one-way | ❌ |
| Symmetric encrypt at app layer (e.g., `@noble/ciphers/chacha`) with key in env | Working refresh + dump-protected if key not in dump | Key rotation is a multi-step migration | ✅ choose this |
| Store in Redis/Valkey (encrypted) | Encryption + ephemeral | Refresh tokens up to 90 days outlive Redis cache eviction policies; complicates revocation | ❌ for refresh tokens (consider for short-lived access tokens) |

So: encrypted refresh tokens in Postgres, short-lived access tokens
in Postgres unencrypted (low value if leaked since they expire in
60 min). Encryption key in `CPUB_FED_TOKEN_KEY` env var, 32 bytes
hex. Document key-rotation runbook in `docs/operations/`.

### Layer 3: Action routing

The action-routing layer is what turns "user has linked identity"
from a passive credential into active capability. The principle:
**every user-facing action declares whether it can be proxied.**

```ts
// packages/server/src/actions/index.ts
export interface ActionRoute<TInput, TResult> {
  name: string;
  /** Required scopes for the linked-identity case. */
  scopes: ReadonlyArray<Scope>;
  /** Run locally as the native session user. */
  local: (db: DB, identity: NativeIdentity, input: TInput) => Promise<TResult>;
  /** Run via OAuth-bearer call to the linked instance. */
  proxy?: (client: FederatedInstanceClient, identity: LinkedIdentity, input: TInput) => Promise<TResult>;
}

export async function executeAction<TI, TR>(
  ctx: IdentityContext,
  action: ActionRoute<TI, TR>,
  input: TI,
): Promise<TR> {
  if (ctx.actingAs.kind === 'native') {
    return action.local(useDB(), ctx.actingAs, input);
  }
  if (!action.proxy) {
    throw new ActionNotProxiable(action.name);
  }
  if (!hasAllScopes(ctx.actingAs.scopes, action.scopes)) {
    throw new InsufficientScopes(action.name, action.scopes);
  }
  const client = await getInstanceClient(useDB(), ctx.actingAs.localUserId, ctx.actingAs.foreignActorUri);
  return action.proxy(client, ctx.actingAs, input);
}
```

Concrete action modules:

```ts
// packages/server/src/actions/publish.ts
export const publishAction: ActionRoute<PublishInput, ContentRow> = {
  name: 'publish',
  scopes: ['publish'],
  async local(db, identity, input) {
    // existing local publish path: createContent + onContentPublished + federate
    return createPublishedContent(db, identity.userId, input);
  },
  async proxy(client, identity, input) {
    // Calls remote /api/content with bearer; remote does its own federation
    return client.post('/api/content', { ...input, status: 'published' });
  },
};

// packages/server/src/actions/like.ts
export const likeAction: ActionRoute<{ targetUri: string }, void> = {
  name: 'like',
  scopes: ['interact'],
  async local(db, identity, { targetUri }) { return localLike(db, identity.userId, targetUri); },
  async proxy(client, _identity, { targetUri }) { await client.post('/api/likes', { target: targetUri }); },
};
```

**Actions that should NOT be proxiable** (always run on native instance):
- account settings, profile edits → these are about your local identity
- linked-identity management itself (you can't unlink-via-link, that's circular)
- admin actions (always tied to the instance you're administering)

**Actions that should be proxiable** (any user-facing content action):
- publish, edit, delete content
- like, unlike, comment, repost
- follow, unfollow, mute
- DM (requires special handling because messages are instance-local
  in the federation scope table — this might just bounce the user
  to the home instance until DMs federate)

The route enum + scope set lives in `commonpub.config.ts` so
operators can disable specific proxied actions if their threat model
demands it.

### Layer 4: UI primitives

Three load-bearing UI surfaces. Each gets its own composable so
nothing is duplicated.

**4a. Smart login form**

```vue
<!-- layers/base/pages/auth/login.vue -->
<script setup lang="ts">
const handle = ref('');
const probe = useFederatedHandleProbe(handle); // debounced WebFinger lookup

// states: 'empty' | 'invalid' | 'local' | 'remote-discovered' | 'remote-unsupported'
</script>

<template>
  <input v-model="handle" placeholder="@user@host or email" />
  <template v-if="probe.state === 'remote-discovered'">
    <button @click="signInViaRemote(probe.discovery)">
      Sign in via {{ probe.instance }}
    </button>
    <p class="hint">
      You'll be redirected to {{ probe.instance }} to confirm.
      No new password needed.
    </p>
  </template>
  <template v-else-if="probe.state === 'local' || probe.state === 'empty'">
    <input type="password" v-model="password" />
    <button @click="signInLocal">Sign in</button>
  </template>
</template>
```

`useFederatedHandleProbe`:
- Debounces input (300ms idle).
- Parses `@user@host` / `user@host` / plain `user`.
- For host-shaped input: WebFinger probe → if `oauth_endpoint`
  link present → `state = 'remote-discovered'`, expose
  `{ instance, discovery, suggestedAvatar }`.
- For plain input or email: `state = 'local'`.
- Caches WebFinger results for the session (reduce probe traffic).

**4b. Account switcher (top-right avatar dropdown)**

```
┌─────────────────────────────────┐
│ 👤 moheeb@deveco.io       (you) │
│ ─────────────────────────────── │
│ Acting as:                      │
│ ● moheeb@deveco.io     (native) │
│ ○ moheeb@commonpub.io   (linked)│ <- click switches
│ ─────────────────────────────── │
│ + Link another account          │
│ ⚙ Settings                      │
│ ⏻ Sign out                      │
└─────────────────────────────────┘
```

The "Acting as" line is the *only* mutable state in this menu —
clicking sets the `cpub_acting_as` cookie + a banner appears at the
top of the page until the user reverts:

```
┌─────────────────────────────────────────────────────────┐
│ ⓘ You're acting as moheeb@commonpub.io.                 │
│   Posts and likes will appear there. [Switch back]      │
└─────────────────────────────────────────────────────────┘
```

The banner is essential — invisible context switches are the #1
foot-gun in any "act-as" UX (the AWS console, GitHub
sudo-as-org, etc., all have prominent acting-as banners for the same
reason).

**4c. Compose publish-as picker**

When `available.length > 1` (user has at least one linked identity),
the compose form gains a small dropdown:

```
┌──────────────────────────────────────┐
│ Publishing to: [moheeb@deveco.io  ▼] │
│                  ─────────────────   │
│                  moheeb@deveco.io    │
│                  moheeb@commonpub.io │
│                                      │
│ [textarea]                           │
│ ...                                  │
│ [Cancel]              [Publish]      │
└──────────────────────────────────────┘
```

The dropdown defaults to the current `actingAs`. Per-post override
doesn't persist in the cookie — it's just for this post. After
publish, control returns to whatever the global "Acting as" was.

Why per-post override matters: a common pattern is "I'm browsing
deveco's UI but want to push this thought to my commonpub
audience" — without a per-post picker, the user has to set acting-as,
post, set acting-as back. Three clicks for a one-time decision.

**4d. Native-vs-linked interaction badges**

When viewing a post by `someone@commonpub.io` while you're on
deveco, if you have a linked identity at commonpub, show a subtle
"interact natively" toggle next to the like/comment buttons:

```
[♡ Like]   [💬 Comment]   ⓘ Acting via deveco. [Use commonpub.io →]
```

Clicking "Use commonpub.io →" briefly switches actingAs for this
interaction only. Useful when commenting on a friend's post on their
home instance — your comment shows up under your @commonpub.io
handle, in their notifications without an extra federation hop.

## Failure modes — comprehensive

This is where the SRI bug taught us a lesson: every load-bearing
runtime path needs at least one failure-mode checklist. For
cross-instance auth, the chain is long and partly out of our
control. Here's the matrix.

| # | Failure | Surface | Mitigation | UX |
|---|---|---|---|---|
| 1 | WebFinger unreachable | login probe | retry with backoff (max 3); cache negative result for 60s | "Couldn't reach `host`. Check spelling or try again." |
| 2 | WebFinger 404 (no acct: there) | login probe | none, this is final | "No account `@user@host` found." |
| 3 | OIDC discovery missing | DCR step | fall back to WebFinger `oauth_endpoint` rel | silent if fallback works |
| 4 | DCR rate-limited / refused | first-link | back off, surface admin contact | "Instance has temporarily blocked new links. Try later." |
| 5 | OAuth user denies | post-redirect | `?error=access_denied` from remote | "Sign-in cancelled." back to login |
| 6 | OAuth `state`/CSRF mismatch | callback | abort, log security event | generic "Sign-in failed, please try again" + audit log entry |
| 7 | Token exchange returns 4xx | callback | log, fail | "Could not complete sign-in. Try again." |
| 8 | Token exchange returns 5xx | callback | retry once with backoff | as above; on persistent fail, contact-admin link |
| 9 | Access token expired mid-flight | API call | auto-refresh in client; one retry | invisible to user |
| 10 | Refresh token expired | API call | mark `token_status='revoked'`; emit event | "Your link to `host` has expired. [Re-link]" banner |
| 11 | Refresh token returns 5xx | API call | retry with backoff (3 attempts); after, treat as expired | as above |
| 12 | Remote API 403 (insufficient scope) | API call | parse `WWW-Authenticate: Bearer scope=...`; prompt re-authorize | "This action needs `<scope>`. [Grant access]" |
| 13 | Remote API rate limit (429) | API call | respect `Retry-After`; queue if action has `idempotencyKey`; otherwise fail with backoff | "Slow down — `host` is rate-limiting. Try again in N s." |
| 14 | Remote instance down | API call | best-effort retry; for publish, queue on local outbox-pending shelf | "deveco.io is offline. Your post will be sent when it's back." |
| 15 | Username collision on auto-provision | sign-up via remote | prefix with instance host or refuse with "@moheeb taken on deveco. Choose another." | explicit choice |
| 16 | Email collision | sign-up via remote | prompt "An account with this email exists. Link instead?" | explicit choice |
| 17 | Two linked identities of same handle | UI display | full `@user@host` everywhere, never bare `@user` | structural |
| 18 | Linked instance compromised | impact bound | scoped tokens; revocable; audit log | "If you suspect `host` was compromised, [revoke now]" |
| 19 | Phishing instance (`commonpub.evil.com`) | first-link | instance-fingerprint cache; warn loud on subsequent mismatch | bright red "FINGERPRINT MISMATCH" interstitial |
| 20 | Token theft (DB dump) | server compromise | refresh tokens encrypted with env-key; access tokens short-lived | minimum blast radius |
| 21 | Scope-creep (we silently broaden grants) | implementation bug | central `scopes_supported` enum; static analysis on action `scopes:` | review-time check |
| 22 | Federation amplification (compromised account → mass spam) | abuse | per-linked-identity rate limits; abuse signals propagate to home | abuse-report flow surfaces |
| 23 | Home instance suspends user | authz state drift | next refresh fails → tokenStatus=revoked; UI shows banner | auto on next call |
| 24 | User unlinks but old access tokens still valid | access window | revocation endpoint invalidates server-side; if remote doesn't honor revocation, max window = access_token_expires_at | bounded by token_lifetime config |
| 25 | DNS rebind on instance discovery | initial WebFinger | already mitigated by `safeFetch` (session 135 / 0.19.0 ssrf.ts) | invisible |
| 26 | Cross-instance time skew on token expiry | refresh logic | refresh proactively at 80% of expires_in; clock-skew tolerance ±5min | invisible |
| 27 | Linked-identity action from suspended local user | abuse | local suspension cascades — block proxied actions when sessionUser is suspended | "Your account is suspended; cannot act as linked." |
| 28 | Multiple browser tabs racing on token refresh | concurrency | DB-level row lock (FOR UPDATE) during refresh; or single-flight Map keyed by federatedAccountId | invisible |

## What this unlocks

Beyond the immediate "post from B as A" use case:

1. **Identity portability.** Move between instances without losing
   your audience. Mastodon's account migration is a one-shot
   redirect; this is *bidirectional ongoing*. Someone leaving
   `commonpub.io` for `deveco.io` doesn't lose their commonpub
   followers — the linked identity continues to function until they
   choose to unlink.

2. **Multi-context "alts" without log-out/log-in.** Today, separate
   personae require separate sessions. Linked identities means your
   compose form has an "as" picker. Each context can have its own
   avatar and bio (at the home instance), but switching is one
   click. Powerful for: work vs. personal, professional vs. fanfic,
   English vs. Japanese audience.

3. **Federation-wide reputation signals.** "moheeb has a 3-year
   account on commonpub.io with 5K followers" can be visible (or
   weighted, or cross-checked for moderation) on deveco.io — without
   needing a global identity authority. Each instance vouches for
   its own users.

4. **Inter-instance moderation cooperation.** Instance B can import
   instance A's block-list as a *suggestion* (not enforced). A
   linked-identity user's home-instance-suspension cascades as
   token revocation, with optional UI "your account on `host` is
   suspended; this remote interaction won't work until they
   unsuspend or you re-link."

5. **SSO for the open social web.** The same primitives work for
   any OIDC-aware Fediverse implementation. A user with an account
   on `mastodon.social` could sign in to a CommonPub instance via
   their Mastodon identity (subject to Mastodon implementing the
   OIDC discovery doc — they don't yet, but the design doesn't
   require us to be the only speaker of the protocol).

6. **Lossless instance failure.** If `commonpub.io` ever shuts down,
   your linked identity on deveco.io still has your data — your
   posts (federated copies), your follows (the federation table),
   your audience reach (via deveco's federation paths). The instance
   failure mode goes from "account lost" to "primary residence
   changed."

7. **Delegation patterns.** Organizations can grant N humans access
   to one organizational identity via OAuth scopes. Each human
   signs in via their personal identity but acts AS the org. Maps
   cleanly: each grant is a `federated_accounts` row pointing the
   human's local userId at the org's actor URI, scoped to
   "publish + interact" (no profile-edit).

8. **"Universal compose" UX.** Most Fediverse UX has the user
   thinking "which app/instance am I in?" before composing.
   Linked identities + acting-as means the compose-anywhere pattern
   becomes natural: any client showing CommonPub UI lets you publish
   to any of your identities. Future iOS/Android client could be
   100% identity-agnostic — pick the identity per-post.

9. **Account recovery via second identity.** If you lose access to
   `commonpub.io` (forgot password, email change, instance recovery
   issue), and you have a linked identity on deveco.io, that
   linked identity still proves you're you. Recovery mechanism:
   sign in to deveco, request "recovery proof" → deveco posts an
   AP activity (signed by deveco) attesting the linked identity →
   commonpub admin can use that as one factor in account recovery.

10. **Better client experimentation.** Third-party Fediverse apps
    (mobile, terminal, voice) can be built against any instance's
    OAuth + REST API and work for *every* CommonPub user — they
    don't need a per-instance integration. The Mastodon API
    ecosystem demonstrated this works; CommonPub inheriting it
    extends the surface area without owning the apps.

## Phased rollout

Each phase is an independent ship behind a feature flag in
`commonpub.config.ts`:

```ts
features: {
  federatedAuth: {
    enabled: false,                 // Phase 0: off
    discoveryDoc: false,            // Phase 1
    persistentTokens: false,        // Phase 2
    delegatedSignIn: false,         // Phase 3
    actingAs: false,                // Phase 4
    delegatedActions: {             // Phase 5
      publish: false,
      interact: false,              // like, comment, follow
    },
  },
}
```

**Phase 0 (now): SSO sign-in.** What ships today. Verify both prod
sites can sign in to each other via WebFinger + OAuth. Confirm the
existing v1 flow works end-to-end with the live runtime. (As of
session 136, no end-to-end smoke has been run on this — adding to
137 open items.)

**Phase 1: Standardize discovery + add PKCE.**
- Serve `/.well-known/openid-configuration`.
- Add PKCE to authorize endpoint.
- Discovery probe in client uses OIDC first, falls back to WebFinger.
- No new tables. No UX change.
- Acceptance: `curl https://commonpub.io/.well-known/openid-configuration` returns valid JSON.

**Phase 2: Persistent tokens + refresh.**
- Migration `0004_oauth_tokens.sql` adds token columns.
- Token endpoint returns `refresh_token` + `expires_in`.
- Client stores refresh tokens encrypted; auto-rotates.
- Revocation endpoint added.
- No UX change yet — tokens stored but not used for actions.
- Acceptance: refresh-token round trip works in integration test;
  revoking a token causes next API call to fail with 401.

**Phase 3: First-class sign-up via remote (no new password).**
- Login form gets `useFederatedHandleProbe` composable.
- New "Sign in via host" button replaces password field on host-shaped input.
- Auto-provision local account on first sign-in if no link exists
  (handle already verified by WebFinger + OAuth; email pulled via
  `userinfo_endpoint`).
- Acceptance: a user with only a `commonpub.io` account can sign up
  on `deveco.io` via the OAuth bounce, ending with a deveco local
  account named `moheeb` linked to `moheeb@commonpub.io`.

**Phase 4: Acting-as identity context.**
- `IdentityContext` resolution at the request middleware.
- Avatar dropdown gets the "Acting as" section.
- Top-page banner when actingAs ≠ sessionUser.
- No new actions enabled yet — switching just updates the
  context, but proxying actions is still off.
- Acceptance: switch identity, observe context cookie, observe
  banner, switch back.

**Phase 5: Delegated actions, gradually.**
- `actions/` registry in `@commonpub/server`.
- Start with `interact` (like, comment, follow) — low blast radius.
- Then `publish` — biggest UX win, biggest abuse surface; hardest
  to gate.
- UI: per-post publish-as picker; "interact via" toggles on remote posts.
- Acceptance: from deveco UI, like a commonpub post, observe like
  appears on commonpub from your moheeb@commonpub identity.

**Phase 6 (later): Cross-instance unification.**
- Unified inbox (notifications across linked instances).
- Federation-wide reputation signals.
- Account-migration flows.
- Block-list import.

## Programming model — keep it elegant

A few hard rules to keep this from sprawling:

1. **One source of truth for `IdentityContext`.** Resolved once
   per request in middleware. Available via composable
   `useIdentityContext()` everywhere. Never re-derive from
   ad-hoc fields.

2. **Action proxying is config, not code branches.** Every
   user-action handler imports its `ActionRoute` declaration; the
   route's `local`/`proxy` functions are the only places where
   "acting-as native" vs "acting-as linked" branches. Never sprinkle
   `if (actingAs.kind === 'linked')` through controllers.

3. **Federation client is opaque to callers.** `client.post('/api/content', body)`
   shouldn't know about token storage, refresh logic, or revocation
   detection. That all lives inside the client.

4. **Every linked-identity API call is auditable.** Audit log row
   per call: `{actor: localUserId, actingAs: foreignActorUri, action: name, result: 'ok'|err, latency_ms}`.
   For incident investigation and abuse pattern detection.

5. **Scopes are an enum, not strings.** The `Scope` type is exported
   from `@commonpub/protocol`; new scopes require adding to the
   enum (a code change, not a string-literal sprinkle). Static
   analysis catches typos.

6. **Tokens never log.** Logger has a redaction rule for any field
   matching `/token|secret|authorization/i`. Verified at startup.

7. **Feature flags gate everything.** A user landing on a
   `federatedAuth.enabled = false` instance sees the v1 SSO-only UX
   and gets sane errors, not blank screens.

## Open architectural questions (decisions deferred)

These need someone to make a call before phase 2 ships:

- **Q1: Is the AP `actor` URI the canonical foreign identifier, or
  do we want a separate `cpub:account` URN?** Mastodon's API
  inconsistency (`acct:user@host` vs `https://host/users/user` vs
  `https://host/@user`) caused real bugs in third-party clients.
  We should pick one canonical form and translate at boundaries.
  Recommendation: `https://<host>/users/<username>` (the AP actor
  URI) — already what we use throughout federation code.

- **Q2: How do scopes map to AP capabilities?** AP doesn't have a
  standard scope vocabulary. Our scopes (read/write/follow/publish/
  interact) need to be translated to "what AP activities is this
  bearer allowed to issue on the user's behalf"? Recommendation:
  publish ⇒ Create(Article|Note|Project), interact ⇒
  Like|Announce|Follow, follow ⇒ Follow only. Lock this in protocol
  package.

- **Q3: Does an instance auto-trust DCR clients, or require admin
  approval?** Currently DCR is auto-approve and idempotent. For
  small private instances, this is fine. For instances with abuse
  budgets, we need an admin-approval queue. Recommendation: opt-in
  via `features.federatedAuth.requireAdminApproval` config; default
  off for ergonomics.

- **Q4: Multi-tab refresh coordination.** Two browser tabs both hit
  a 401 simultaneously, both try to refresh, one wins, the other's
  refresh fails because the refresh-token-rotation invalidated it.
  Single-flight needed. Recommendation: per-(localUserId,
  federatedAccountId) `Map<string, Promise>` in module scope —
  same pattern as the SSE connection cap from session 135.

- **Q5: Token storage encryption — pre-launch or migration-able?**
  If we ship phase 2 with plain refresh tokens and migrate to
  encrypted later, we have to re-encrypt all existing rows under
  load. Recommendation: ship encrypted from day one. Pre-launch
  acceptance criteria: refresh-token-encryption is on by default
  and `CPUB_FED_TOKEN_KEY` is in `commonpub.config.ts`'s required
  env list.

## Relationship to existing code

The phase plan above is designed to be additive. No existing
endpoint changes behavior in phase 1–2. Phase 3 changes the
login form's *appearance* but the existing email/password path stays
intact and is still the default.

Key existing files this plan will touch:

| Phase | File | Change |
|---|---|---|
| 1 | `layers/base/server/routes/.well-known/openid-configuration.ts` | new |
| 1 | `packages/server/src/federation/oauth.ts:processAuthorize` | accept PKCE params |
| 2 | `packages/schema/src/auth.ts:federatedAccounts` | + token columns |
| 2 | `packages/schema/migrations/0004_oauth_tokens.sql` | new |
| 2 | `packages/server/src/federation/oauth.ts:processTokenExchange` | issue refresh, return scopes |
| 2 | `packages/server/src/federation/oauth.ts` | + `processTokenRefresh`, `processTokenRevocation` |
| 2 | `packages/server/src/federation/instanceClient.ts` | new |
| 3 | `layers/base/composables/useFederatedHandleProbe.ts` | new |
| 3 | `layers/base/pages/auth/login.vue` | live-resolve + remote-bounce |
| 3 | `packages/server/src/federation/oauth.ts:autoProvisionAccount` | new (uses pending-link existing) |
| 4 | `packages/auth/src/identityContext.ts` | new |
| 4 | `layers/base/server/middleware/auth.ts` | resolveIdentityContext |
| 4 | `layers/base/components/AccountSwitcher.vue` | new (was avatar dropdown) |
| 4 | `layers/base/components/ActingAsBanner.vue` | new |
| 5 | `packages/server/src/actions/{publish,like,follow,comment}.ts` | new |
| 5 | `layers/base/components/ComposeForm.vue` | publish-as picker |
| 5 | `layers/base/components/PostInteractionBar.vue` | "interact via" toggle |

Most existing code is unchanged. The big new directories are:
`packages/server/src/actions/`,
`packages/auth/src/identityContext.ts`,
the migration, and the four new Vue components.

## Acceptance test for the whole vision

When the design is fully shipped, this is the demo script:

1. User signs up on `commonpub.io` as `moheeb`.
2. Visits `deveco.io`, types `@moheeb@commonpub.io` in the login
   form. Password field disappears, replaced with "Sign in via
   commonpub.io". One click. Bounces. Returns. Local account
   `moheeb` exists on deveco, no password chosen.
3. Top-right avatar shows `moheeb@deveco.io`. Dropdown lists "Acting
   as" → `moheeb@deveco.io (native)` and `moheeb@commonpub.io
   (linked)`. Switches to commonpub.
4. Banner appears at top: "You're acting as moheeb@commonpub.io.
   [Switch back]"
5. Composes a post. Publish-as picker says "commonpub.io". Publishes.
6. Post appears in commonpub.io's outbox. Federates to deveco's
   followers naturally.
7. Visits a post by `someone@commonpub.io` while in deveco UI. Like
   button shows "♡  Like (via deveco)" with a small "[Use
   commonpub.io →]" toggle. Clicks toggle, then likes. Like appears
   under `moheeb@commonpub.io` on commonpub.io.
8. Goes to settings, unlinks commonpub.io. Local deveco account
   stays. Posts published-as-commonpub stay on commonpub
   (ownership is recorded against the foreign actor).

If all eight steps work without surprise, the vision is realized.
