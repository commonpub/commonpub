# Referral Links — Architecture & Implementation Plan

Status: BUILT + LOCALLY VERIFIED on `main` working tree (session 229), NOT yet published/deployed. Feature flag: `referralLinks` (default OFF).

### Round-2 hardening (session 229 deep audit — adversarial self-review + independent reviewer)
The audit found genuine bugs that the first test pass missed (the tests had exercised a different path than production). All fixed and regression-tested:
- **New-user guard (was a real attribution hole).** `claimReferral` now rejects any account that isn't a fresh signup: with a click time (carried in the cookie as `code.issuedAtMs`) it requires the account to have been created at/after the click; cookieless it requires creation within the last hour. Previously an existing logged-in user who merely *clicked* a `/r` link was attributed + auto-joined via the backstop. Reason code `not_new_user`.
- **Idempotent destination (backstop-vs-explicit race).** Destination is now derived purely (`deriveDestination`) and returned even on the `already_attributed` path, so whichever of the explicit endpoint / backstop wins, the referred user still lands on the right hub. The backstop middleware also skips `/api/referrals/*` so the explicit endpoint owns its own request.
- **Claim-time hub re-validation.** A hub flipped private (or deleted) after link creation is no longer auto-joined (`joinHub` has no privacy gate); `deriveDestination` likewise won't redirect to it.
- **Anonymous private-hub-name leak.** `resolveReferral` returns only PUBLIC hub names (a hub can be flipped private after creation, past the create-time check).
- **Suspended/deleted owner.** `claimReferral` + `resolveReferral` ignore links whose owner isn't `active` (deletion already cascaded).
- **Test quality.** Closed the cosmetic/uncovered gaps: collision-retry + exhaustion (via a `genCode` seam), real deterministic ordering (explicit distinct `createdAt`), idempotent-destination, action-failure isolation (banned-from-one-hub), claim-time privacy/deletion re-validation, anonymous private-hub-leak, suspended owner, update re-validation. 15 → 22 server integration tests.

**Accepted risks (v1, no-payout community — documented, not bugs):** `body.code` is honored as the referral signal (that's how a shareable `?ref=` link inherently works; gated by new-user + first-touch); `recordReferralClick` is an unauthenticated vanity counter (global tiered rate-limiter applies); `signupCount` counts an attribution even if a join action fails (attribution ≠ action success). The day-based `attributionWindowDays` governs cookie lifetime; the load-bearing guard is new-user + first-touch.

### Build state (session 229)
Implemented TDD across schema → config → server → layer. Green: repo typecheck 28/28; schema 509 tests (18 new validator); config 25; server 1548 tests (22 new referral integration). Migration `0038_milky_red_ghost.sql` (referral_links + referral_attributions). Live-verified end-to-end with Playwright + DB assertions against a local dev instance with the flag on: manager page, `/r/:code` redirect + `cpub_ref` carrier (`code.issuedAt`), "invited by X" register banner, explicit claim WITH cookie present → attribution + auto-join + hub destination (the race fix), the cookie-gated backstop firing on a normal page request (claims + clears cookie), idempotency, click/signup counters, private-hub action rejected at creation. Operator toggles shipped in `config.referral` (`cookieless`, `defaultAttributionWindowDays`); `confirmOnVerify` deferred (no verify hook + email off in prod). NOT bumped/published/rolled — that's the §16 release chain when the user approves.

### Audit revisions (session 229 — verified against real code, supersede the body where they conflict)
1. **Confirmation gate deferred.** There is no `user:verified` hook (only `user:registered`, which has no request context), and email is OFF in prod — so `referralConfirmOnVerify` has nothing to hook. v1 confirms on signup (`referral_attributions.status` defaults usable; `pending`/`rejected` kept for the future). No Nitro plugin and no `user:registered` handler are added.
2. **Operator toggles → `config.referral`, not feature flags.** Only `referralLinks` is a feature flag. A new top-level `config.referral` section (precedent: `config.docs`/`config.federation`) holds `{ cookieless: boolean=false, defaultAttributionWindowDays: number=60 }`. This avoids triplicating flag wiring for operational policy knobs.
3. **`join_hub` actions restricted to open/approval, non-private hubs** (validated at link-creation time; invite-only/private rejected with a clear error). No invite-token minting in v1 (deferred to §15). `joinHub` already handles idempotency/ban/policy.
4. **Codes stored lowercased in one `code` column with a plain unique index** (no functional `lower(code)` index, no `citext` — PGlite-test-safe). Display is the lowercased canonical form.
5. **Referral cookie is unsigned** — it carries only the public referral code (which is DB-validated on claim, and self-referral-guarded), so signing adds no security. `cpub_ref`, httpOnly, `sameSite=lax`, `secure` in prod, `Max-Age` = attribution window.
6. **Claim path is explicit-endpoint-primary + cookie-gated-middleware-backstop** (no hook). The register page calls `POST /api/referrals/claim` (deterministic: awaits join, gets destination, navigates). The backstop middleware covers OAuth/closed-tab.
7. **Rate-limiting deferred** unless an existing utility is found (no payout ⇒ low risk); documented in §10.
8. **Register banner shows "invited by X" + target hub names** for transparency/consent before signup.


A user, from their own profile / user menu, creates and manages **referral links** that (a) attribute new signups back to them and (b) run a small, bounded series of **onboarding actions** when someone signs up through the link — primarily *auto-join a hub* and/or *land the new member directly on a destination*. Codes are either an auto-generated conflict-free shortcode or a user-chosen custom slug.

This document is the source of truth for the design. It is deliberately **non-monolithic** (isolated `referral/` module mirroring `hub/`), **non-degrading** (indexed single-lookup hot path, denormalized counters, no per-request `COUNT(*)`, cookie-gated backstop), **privacy-respecting** (no raw IP, cookieless-capable, attribution is consent-disclosed), and **flag-gated** (inert until an operator opts in).

---

## 1. Goals / Non-goals

### Goals (v1)
- Logged-in users create/manage multiple referral links from `/settings/referral-links` (reachable from the user menu).
- Each link has: a **code** (auto-generated *or* custom), an optional **label**, an ordered list of **onboarding actions**, and basic **stats** (clicks, signups).
- Onboarding action vocabulary v1: `join_hub` (one or more) and `redirect` (land on a destination). Extensible to more action types without a schema change.
- A short link `/r/:code` resolves server-side, records a click, and redirects to the link's destination (default: the register page, pre-filled to show "invited by X").
- On successful signup through a link, attribution is recorded **idempotently** and the onboarding actions run (e.g. the new user is auto-joined to the configured hub and dropped on it).
- Works for **every** signup path (email, OAuth, federated) despite Better Auth's signup hook not seeing request context.
- Instance-local only. No federation. No rewards/payouts (attribution + onboarding only).

### Non-goals (v1 — documented as future extensions in §15)
- Reward/incentive engine (points, badges, leaderboards, payouts).
- Cross-instance / federated referral.
- Per-click raw analytics (IP/UA/geo logs). v1 stores **counters only**; a privacy-safe click table is designed but deferred behind a sub-decision.
- Device fingerprinting, CAPTCHA, ML fraud scoring (out of scope for a no-payout community per research; see §10).
- Arbitrary/scriptable link actions. Actions are a **fixed whitelist** validated as untrusted input.

---

## 2. Terminology (and why this is distinct from existing concepts)

| Concept | Scope | Already exists? | Relationship |
|---|---|---|---|
| **Referral link** (this feature) | Instance-wide signup attribution + onboarding | NO | New |
| **Hub invite** (`hub_invites`, `createInvite`) | Single hub, token-gated join bypass | YES (`packages/server/src/hub/moderation.ts`) | **Reused**: a referral `join_hub` action for an *invite-only* hub mints a hub invite token under the hood and passes it to `joinHub` |
| **Better Auth org invite** | Org membership | YES | Untouched |

We keep the names separate: a **hub invite** is moderation tooling scoped to one hub; a **referral link** is a personal, instance-wide growth link owned by any member. The referral system *composes* hub invites, it does not replace them.

---

## 3. The load-bearing constraint (read this before the design)

`layers/base/server/middleware/auth.ts` memoizes a **singleton** `createAuth(...)` via `getAuthMiddleware()` (the `let authMiddleware` cache, lines 6–9). The `onUserCreated` callback (line 46) — which today calls `recordConsent` and `emitHook('user:registered', …)` — closes over `db`/`config` **only**, not the per-request H3 `event`. Better Auth's `databaseHooks.user.create.after` (`packages/auth/src/createAuth.ts:86`) likewise receives only the new user object.

**Consequence:** the referral code / carrier on the signup request is **invisible** at the moment the user row is created — for *all* signup methods. So attribution **cannot** be written inside the signup hook. It must be **claimed by a separate mechanism** that holds *both* the authenticated session *and* the referral carrier. This is the central design decision and it drives §5.

(We do **not** modify the auth singleton or thread the event through it — that would couple the referral feature into the auth monolith. The claim mechanism stays fully decoupled.)

---

## 4. High-level architecture (three thin layers)

```
            ┌─────────────────────────────────────────────────────────────┐
            │  CAPTURE            ATTRIBUTION/CLAIM        ONBOARDING       │
            │                                                              │
  click ───▶│ GET /r/:code  ───▶  cpub_ref carrier  ───▶  claimReferral()  │
            │  • resolve (cached)   (signed cookie /     • idempotent       │
            │  • clickCount++        URL ?ref=)          • self-referral    │
            │  • set carrier         |                     guard            │
            │  • 302 → destination   ▼                   • runActions():    │
            │                     signup completes         join_hub →joinHub│
            │                     (any method)             redirect→path    │
            │                        |                   • signupCount++    │
            │                        ▼                                      │
            │              POST /api/referrals/claim  (primary, register pg)│
            │                     OR                                        │
            │              referral-claim middleware  (backstop: OAuth /    │
            │              (cookie-gated, idempotent)  closed-tab)          │
            └─────────────────────────────────────────────────────────────┘
```

Every box is small and isolated. The only existing code touched on the hot signup path is **additive** (a new optional middleware + a new API route); the auth singleton, `joinHub`, and the hook bus are **reused as-is**.

---

## 5. Attribution & claim (the decoupled mechanism)

### 5.1 The carrier
Between click and signup the code must survive navigation and (for OAuth) an external round-trip. Two carriers, both supported, operator-selectable:

- **Default — signed httpOnly cookie `cpub_ref`** (`{ code, issuedAt }`, HMAC-signed with the existing auth secret, `httpOnly`, `sameSite=lax`, `secure` in prod, `Max-Age` = link's attribution window). Single-purpose, first-party, **functional** (it carries an invite the user is actively redeeming, not analytics) and stores no PII. Most reliable: survives the OAuth round-trip and "click now, sign up later."
- **Cookieless mode (`config.features` sub-option) — URL `?ref=<code>` only.** The register page carries the code in its own URL and passes it to the claim call; no device storage at all (sidesteps the ePrivacy storage-consent gate entirely). Trade-off: email-signup only (the code is lost across an OAuth redirect), and "click now / sign up later" doesn't persist. Offered for operators who want maximal strictness.

Reuse `signBetterAuthCookieValue` / cookie helpers in `layers/base/server/utils/betterAuthCookie.ts` for the signing primitive (do **not** reuse the session cookie name).

### 5.2 The single claim function
`claimReferral(db, { userId, code, now }): Promise<ClaimResult>` lives in `packages/server/src/referral/attribution.ts` and is the **only** path that writes an attribution. It is idempotent and safe to call from multiple triggers:

1. Resolve `code` → active `referral_links` row (indexed lookup on `lower(code)`). Miss → no-op.
2. **Self-referral guard:** `link.ownerId === userId` → no-op (flag-for-review per §10, never auto-credit).
3. **Freshness guard:** only attribute a *new* user — account `createdAt` within the link's `attributionWindowDays` and no existing attribution. (First-touch model: the `UNIQUE(referredUserId)` constraint makes this race-proof.)
4. Insert `referral_attributions { referralLinkId, ownerId, referredUserId, status }` with `ON CONFLICT (referred_user_id) DO NOTHING`. Zero rows affected → already claimed → skip to step 6 (return existing destination) without re-running actions.
5. `UPDATE referral_links SET signup_count = signup_count + 1` (same statement scope).
6. `runActions(db, link.actions, { userId })` (§6) and return `{ destination }`.

`status` starts `pending` and flips to `confirmed` on the anti-fraud gate (§10) — default v1 confirms on signup; verification-gating is a config toggle. Onboarding actions fire immediately regardless of status (good UX); only the *counted/confirmed* attribution waits on the gate.

### 5.3 Triggers (both call `claimReferral`, never duplicate logic)
- **Primary — `POST /api/referrals/claim`** called by the register page right after a successful `signUp()` (the page still holds the code, in URL and/or cookie). Returns `{ destination }`; the page then `navigateTo(destination)`. Covers email signup cleanly.
- **Backstop — `referral-claim` server middleware** (`layers/base/server/middleware/`). **Cookie-gated:** early-returns instantly unless `event.context.auth?.user` is set *and* a `cpub_ref` cookie is present. So it does real work essentially **once per referred user** (the cookie is cleared on success), and zero work on every other request — the auth middleware has already parsed cookies, so the guard is a single map lookup. This catches OAuth/federated signups (where the register page never runs the claim) and closed-tab cases. After a successful claim it deletes `cpub_ref`.

Idempotency (the `UNIQUE(referredUserId)` constraint + `ON CONFLICT DO NOTHING`) means the primary and backstop can both fire harmlessly; whichever wins, the other no-ops.

---

## 6. Onboarding actions (bounded, typed, authz-checked)

Modeled exactly on the cross-product pattern (Discord/Clerk/Linear/Circle): the link is an opaque key that resolves to a record carrying a **fixed whitelist** of typed actions referencing existing entities — never executable logic.

`actions` is a `jsonb` array of a discriminated union, validated by Zod (`packages/schema/src/validators/referral.ts`):

```ts
// v1 vocabulary — extend the union, not the schema, to add types later
type ReferralAction =
  | { type: 'join_hub'; hubId: string }      // auto-join (uses existing joinHub)
  | { type: 'redirect'; path: string };      // land here post-signup (same-origin only)
```

`runActions(db, actions, { userId })` in `packages/server/src/referral/actions.ts` is a `switch` over `type`, each branch authz-checked:

- **`join_hub`** → `joinHub(db, userId, hubId)`. Honors ban/join-policy/idempotency for free. For an **invite-only** hub, mint a one-time `hub_invites` token via `createInvite` and pass it to `joinHub` — **but only if the link owner is admin+ of that hub** (`hasPermission(role,'manageMembers')`). A non-privileged owner cannot force-join others into a gated hub; the action degrades to "request to join" or is rejected at link-creation time.
- **`redirect`** → validated as a **same-origin relative path** (open-redirect guard: must start with `/`, no `//`, no scheme). The resolved `destination` returned by `claimReferral`. If absent, default to the first joined hub's `/hubs/:slug`, else `/`.

**Creation-time authz** (in `POST /api/referrals/index.post.ts`): every action is validated against what the owner may grant *now* (e.g. the owner must be a member of a `join_hub` target; admin+ for invite-only). This prevents privilege-escalation-via-link (the explicit security failure mode in the research).

Multiple `join_hub` actions are allowed ("a series of things"). Execution is best-effort per action and independently try-caught so one failing action can't abort onboarding.

---

## 7. Data model

New file `packages/schema/src/referral.ts` (+ barrel export in `index.ts`; validators in `validators/referral.ts`; enums in `enums.ts`). Follows the established pattern (uuid PK `defaultRandom()`, `timestamp withTimezone defaultNow notNull`, FKs `onDelete: 'cascade'`, Zod via `.strict()`, `uniqueIndex` over table constraint for PGlite-test compatibility).

### `referral_links`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `owner_id` | uuid FK→users | `onDelete: cascade` |
| `code` | varchar(40) | unique on **`lower(code)`** (see §8); stored as entered for display |
| `label` | varchar(80) nullable | user's name for the link |
| `actions` | jsonb `$type<ReferralAction[]>()` | Zod-validated, default `[]` |
| `landing_path` | text nullable | explicit destination override (same-origin) |
| `status` | enum `referral_link_status` `active|disabled` | default `active` |
| `attribution_window_days` | integer | default `60` |
| `click_count` | integer | denormalized, default `0` |
| `signup_count` | integer | denormalized, default `0` |
| `created_at`/`updated_at` | timestamptz | `updated_at` via `$onUpdateFn` |

Indexes: `uniqueIndex('uq_referral_links_code_lower').on(sql\`lower(${code})\`)`; `index('idx_referral_links_owner').on(owner_id, created_at.desc(), id.desc())` (owner listing + stable keyset pagination per the pagination-tiebreaker rule).

### `referral_attributions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `referral_link_id` | uuid FK→referral_links | `onDelete: cascade` |
| `owner_id` | uuid FK→users | denormalized for fast "who did I refer" queries |
| `referred_user_id` | uuid FK→users | `onDelete: cascade` |
| `status` | enum `referral_attribution_status` `pending|confirmed|rejected` | default `pending` |
| `confirmed_at` | timestamptz nullable | |
| `created_at` | timestamptz | |

Constraints: **`uniqueIndex('uq_referral_attr_user').on(referred_user_id)`** (first-touch, race-proof, idempotent claim). Index `(owner_id, created_at desc, id desc)`.

### `referral_clicks` (DESIGNED, DEFERRED — see Decision D2)
Append-only, **privacy-safe**: `id`, `referral_link_id`, `day_hash` (`hash(rotating_daily_salt + code + ip + ua)` — Plausible pattern, salt rotated/deleted every 24h, raw IP/UA **never stored**), `created_at`. Enables same-day dedup + time-series without PII. **v1 default: do not create this table** — increment `click_count` synchronously (community write volume is low; research §6 confirms a sync counter is fine here). Add the table + async rollup + `pg_cron`/partition retention only if click volume actually warrants it.

### Migration
`pnpm --filter @commonpub/schema run db:generate` → produces `packages/schema/migrations/0038_*.sql` (review the generated SQL, confirm `lower(code)` unique index + FKs + enums). Applied on deploy by the committed-migration path (`db-migrate.mjs`), never hand-applied.

---

## 8. Code generation & custom slugs

`packages/server/src/referral/codes.ts`:

- **Auto codes:** random over a **reduced human alphabet** (Crockford-style base32, excluding `I L O U` to avoid `1/0` confusion + accidental profanity), length **8** (~40 bits; ample for a community namespace). Generate → `INSERT` → catch Postgres unique-violation `23505` → regenerate → retry, **bounded to 5 attempts** (the UNIQUE index is the source of truth; never read-then-insert).
- **Custom codes:** normalize to the safe character class, enforce length 3–40, reject reserved route names (`admin api auth r u hubs settings dashboard login register …` — maintain a constant list) and a **profanity blocklist** (copy a static list locally so upstream changes can't shift behavior). Uniqueness on `lower(code)` so `MyCode`/`mycode` collide and custom + generated codes share one namespace.

---

## 9. Module & file layout (non-monolithic)

### `packages/server/src/referral/` (NEW — mirrors `hub/`)
- `codes.ts` — generation + custom validation (§8)
- `links.ts` — CRUD (`createReferralLink`, `listMyReferralLinks`, `updateReferralLink`, `deleteReferralLink`), action authz at creation (§6)
- `attribution.ts` — `claimReferral` (§5.2), `confirmAttribution` (gate §10), `resolveReferral` (public display lookup)
- `actions.ts` — `runActions` executor (§6), open-redirect guard
- `index.ts` — barrel; re-exported from `packages/server/src/index.ts`

### `packages/schema/` (NEW)
- `src/referral.ts`, `src/validators/referral.ts`, enums in `src/enums.ts`, barrel exports

### `layers/base/server/`
- `routes/r/[code].get.ts` — short-link landing (resolve, `click_count++`, set carrier, 302). Public; ensure it is not caught by an auth-only guard.
- `api/referrals/index.get.ts` — list my links
- `api/referrals/index.post.ts` — create (custom-or-generated code; action authz)
- `api/referrals/[id].patch.ts` — edit label/actions/status
- `api/referrals/[id].delete.ts`
- `api/referrals/claim.post.ts` — primary claim trigger (§5.3)
- `api/referrals/resolve.get.ts` — public: code → `{ ownerDisplayName, label }` for the register banner (no PII beyond public profile)
- `middleware/referral-claim.ts` — cookie-gated backstop (§5.3)
- `plugins/referral-confirm.ts` — optional: `onHook` to flip `pending→confirmed` on the anti-fraud gate (§10)

### `layers/base/` (UI)
- `pages/settings/referral-links.vue` — manager (list + create/edit + copy + stats), `definePageMeta({ middleware:'auth' })`, `@commonpub/ui` (Button/Input/Select/Dialog/Badge/Toggle), `useToast`, copy-to-clipboard pattern from `BlockCodeView.vue`
- `pages/settings.vue` — add sidebar nav link
- `layouts/default.vue` — add "Referral Links" item to the user dropdown (lines ~192) gated on `useFeatures().referralLinks`
- `pages/auth/register.vue` — read `?ref=`, show "invited by X" banner via `resolve`, call `claim` on signup success, `navigateTo(destination)`

All new server logic lives in the isolated `referral/` module; the layer files are thin route/middleware shells that call it.

---

## 10. Privacy / GDPR & anti-abuse

### Privacy (research §4)
- **No raw IP or UA persisted.** v1 stores counters only. If `referral_clicks` is later enabled, use the rotating-daily-salt hash; never truncated-IP (truncation ≠ anonymization).
- **Cookieless-capable** (`?ref=` mode) sidesteps the ePrivacy device-storage consent gate; the default `cpub_ref` cookie is single-purpose/functional and documented as such.
- **Who-referred-whom** is the highest-risk element (it profiles a relationship). Disclose it in the privacy policy; surface it to the referred user ("you were invited by X") for transparency; honor export/delete (the existing `/api/auth/export-data` + cascade FKs cover this — attributions cascade-delete with either user).
- **Retention:** if click logs are enabled, 30–90 day auto-delete.

### Anti-abuse (minimum viable for a **no-payout** community — research §3)
Priority order, all cheap/Postgres-native:
1. **Count only confirmed signups** — `status` flips to `confirmed` after email-verify + (optionally) one real action. Defeats throwaways + account-cycling. Config toggle `referralConfirmOnVerify` (default v1: confirm on signup; flip on for stricter instances).
2. **Reject obvious self-referral** — `link.ownerId === referredUserId`, and (if click logs on) same-IP-in-window → **flag-for-review, not auto-block** (CGNAT false positives).
3. **Rate-limit** `/r/:code` and `/api/referrals/claim` (per-IP + global, 429).
4. **Per-user reward cap** is N/A in v1 (no rewards) but the confirmed-count is the natural future cap point.

**Explicitly skipped** (disproportionate for no-payout, and a privacy liability): device fingerprinting, CAPTCHA-on-every-signup, ML scoring, commercial fraud SaaS.

---

## 11. Performance / non-degradation

- **Hot path (`/r/:code`)**: one indexed `lower(code)` lookup (cacheable) + one counter `UPDATE` + 302. No joins, no scans.
- **Claim**: bounded, idempotent, runs ~once per referred user (cookie cleared on success).
- **Backstop middleware**: cookie-gated → O(1) early-return on the ~100% of requests with no `cpub_ref`. Cookies already parsed by the auth middleware; adds a single presence check.
- **Stats**: denormalized `click_count`/`signup_count` columns — **no per-request `COUNT(*)`**. The "my links" list is an indexed, keyset-paginated query (`owner_id, created_at desc, id desc`).
- **Counters**: synchronous increment (low community write volume). Async rollup / sharded counters / time-partitioned click table are documented upgrades, not v1 needs.
- **Zero impact when flag OFF**: routes 404 via the feature gate, middleware early-returns, UI items hidden.

---

## 12. Federation scope

Instance-local only — like hub invites, learning, contests. Nothing in `referral_*` serializes through `@commonpub/protocol`. Add a row to the CLAUDE.md federation table: **Referral Links | No | — | Instance-local; attribution + onboarding stay on-instance.**

---

## 13. Feature flag wiring (`referralLinks`, default OFF)

Per the standing checklist (all required, env-toggle needs every one):
1. `packages/config/src/schema.ts` — `referralLinks: z.boolean().default(false)` (+ optional sub-flags `referralConfirmOnVerify`, `referralCookieless` if we ship them v1)
2. `packages/config/src/types.ts` — `referralLinks: boolean`
3. `layers/base/nuxt.config.ts` — `runtimeConfig.public.features.referralLinks: false`
4. `apps/reference/server/utils/config.ts` — `ENV_FLAG_MAP.referralLinks = 'FEATURE_REFERRAL_LINKS'`
5. `packages/test-utils/src/mockConfig.ts` — `referralLinks: false`
6. `packages/server/src/identity/__tests__/health.test.ts` — add to the flags literal
7. `layers/base/composables/useFeatures.ts` — interface + `DEFAULT_FLAGS` + return computed
8. `layers/base/middleware/feature-gate.global.ts` — `ROUTE_FEATURE_MAP['/settings/referral-links'] = 'referralLinks'` (and gate `/r` only when off? — `/r` should 404 when off too)

`/api/features`, `/api/admin/features` GET/PUT are generic — **no edits**; the `/admin/features` DB toggle works for the new flag automatically. Server checks `useConfig().features.referralLinks`; client `useFeatures().referralLinks`.

---

## 14. Testing (TDD — tests first)

- **Schema/validators**: action discriminated-union (`.strict()`), reject unknown action types, redirect-path same-origin guard, custom-code charset/length/reserved/profanity.
- **codes.ts**: generated-code alphabet; collision → `23505` → retry → success (mock unique violation); custom-code uniqueness on `lower(code)`.
- **attribution.ts**: `claimReferral` idempotency (double-call → one row), self-referral no-op, freshness guard, `ON CONFLICT` race (two concurrent claims → one attribution, one `signup_count++`), pending→confirmed.
- **actions.ts**: `join_hub` open/approval/invite paths (invite mints token only for admin owner), open-redirect rejection, per-action isolation (one throws, others run).
- **API routes**: create with custom vs generated code, action creation-authz (non-member can't `join_hub`, non-admin can't target invite-only), list/edit/delete ownership, claim returns destination, resolve exposes no PII.
- **Middleware backstop**: no cookie → no DB work; cookie + auth → claims once, clears cookie; second request → no-op.
- **Flag gating**: routes 404 + UI hidden when OFF.
- **Component (axe)**: manager page a11y; copy button; keyboard nav.
- **E2E (Playwright)**: visit `/r/:code` → register → assert attribution row + auto-joined hub + landed on destination. Plus OAuth-path backstop (mock).

Per standing rules: **verify UI visually** (run app + screenshot/Playwright) before shipping — unit-green is not enough for the manager UI, copy interaction, and the register-page banner.

---

## 15. Future extensions (data model already supports)
- **Rewards engine**: a `referral_rewards` table keyed off `confirmed` attributions; the `signup_count`/confirmed-count is the natural trigger. Leaderboards from the existing counters.
- **More action types**: `assign_tag`, `follow_user`, `grant_badge` — add to the Zod union + `runActions` switch, no migration.
- **Click analytics**: enable `referral_clicks` (§7) with async rollup + time-partitioning when volume warrants.
- **Per-campaign first/last-touch toggle**: store all touches; pick model at conversion (research §1).

---

## 16. Rollout & release
1. Branch `referral-links`. TDD as §14.
2. Bump changed packages: `schema` (new tables) → `config` (flag) → `server` (referral module) → `ui` (if new component) → `layer`. `pnpm typecheck` (28/28) + suites green.
3. Publish in dep order (`schema → config → … → server → ui → theme-studio → layer` via `pnpm run publish:layer`), poll `npm view` between.
4. Migration `0038` ships with the schema package; applied on deploy.
5. Push branch → PR → squash-merge to main (commonpub.io deploys on push). Flag stays **OFF**.
6. **Canary**: enable `referralLinks` on commonpub.io via `/admin/features` (DB toggle) first; exercise the full flow live. Then bump deveco/heatsync pins (update **both** lockfiles) and enable there.
7. Verify `/api/health` on all 3; `curl /api/features` to confirm flag state empirically.

---

## 17. Decisions (LOCKED — session 229)
- **D1 — Carrier**: **signed functional cookie default + `referralCookieless` operator opt-in.** (§5.1)
- **D2 — Click logging**: **counters only in v1.** `referral_clicks` table designed (§7) but deferred to §15; zero per-click PII, no retention job.
- **D3 — Confirmation**: **confirm-on-signup default + `referralConfirmOnVerify` toggle** for stricter instances. (§10)
- **D4 — Rewards**: **v1 is attribution + onboarding only.** No points/badges/leaderboards; rewards deferred to §15 (data model already supports).
- **D5 — Naming/entry point**: **"Referral Links" in the user menu + `/settings/referral-links`.**

Net: v1 ships two sub-flags alongside `referralLinks` — `referralCookieless` (default off) and `referralConfirmOnVerify` (default off).

---

## 18. References
External research synthesized in session 229 (attribution models, Crockford base32, `23505` retry, whitelisted typed onboarding actions à la Discord/Clerk/Linear/Circle, Plausible salted-hash privacy, no-payout anti-abuse baseline, counter-denormalization). Key codebase anchors: `layers/base/server/middleware/auth.ts` (singleton auth, §3), `packages/server/src/hub/members.ts:joinHub` (action reuse), `packages/server/src/hooks.ts` (`user:registered`), `packages/schema/src/comms.ts` (table/JSONB/validator pattern), the feature-flag checklist (§13).
