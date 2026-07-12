# Plan — Federation & Email Audit Fixes (session 231 audit)

> Created 2026-07-12 (session 231) from a 4-agent deep audit of the federation core,
> mirroring/registry, the email pipeline, and contest↔email wiring. This plan covers the
> **correctness + security fixes**. The UI/UX-rich contest communications build (deadline
> reminders, entry/judge/winner emails, notification preference center) is a separate doc:
> `docs/plans/contest-communications.md`.
>
> **Verdict of the audit:** the security-critical cores are genuinely solid. HTTP-signature
> verify, raw-body digest, coverage policy, SSRF pinning, outbox privacy gating, email
> HMAC/escaping/audience-gating all held up. Every "never federated" claim for the session
> 224-230 local-only features (steward / hub_flags / referral / featuredId) is CONFIRMED
> true (verified against `buildHubGroupActor`'s explicit allowlist and zero protocol refs).
> The findings below are one real P1 test regression, a cluster of pre-existing P2 hardening
> gaps (most latent behind flags), and P3 polish.
>
> **🔴 ROUND-5 CORRECTION — "nothing is on fire" was WRONG.** A ground-up re-attack (round 5) that
> refused to trust this "SOLID" verdict found a **live, unauthenticated, systemic content/hub
> privacy leak** that all four prior rounds and the original session-204 fix missed. It is P1
> (arguably P0), live on all 3 instances, needs no flag for most sites, and **outranks everything in
> this plan and the contest-communications plan.** It has its own doc:
> **`docs/plans/content-privacy-enforcement.md`** — do that FIRST. Two other live/latent items also
> outrank the flag-latent Phase-2 work here (GDPR export gaps + an RBAC delegation ceiling — see the
> Round-5 section at the bottom). What genuinely held up under re-attack: HTTP-signature verify, SSRF
> pinning, the AP *outbox projection* (distinct from the broken content read paths), the contest
> scoring/PII path, and the auth/session core.

## Severity legend

- **P1** — real, active, low-effort to fix. Do first.
- **P2** — confirmed correctness/security gap; some latent behind an off-by-default flag.
- **P3** — defense-in-depth / robustness; low likelihood or low harm.

---

## Phase 0 — P1: email outbox test regression (test-only, do first)

**Finding (CONFIRMED, reproduced 5 failed / 1576 passed).** `packages/server/src/__tests__/
email-outbox.integration.test.ts` has 5 tests that fail **deterministically every run**, not
"PGlite timing flakes" as `docs/sessions/230-handoff.md` and STATUS.md claim. Root cause:
`enqueueEmail`/`enqueueEmails` insert with `scheduledAt` defaulting to DB `now()` (real wall
clock, ~2026-07-12), but the tests drive `drainEmailOutbox` with a hardcoded fake
`now = new Date('2026-07-01T00:00:00Z')`. The claim predicate is
`lte(emailOutbox.scheduledAt, now)` (`comms/outbox.ts:130`), so real rows are stamped *after*
the fake now → **0 rows claimed** → every "expect sent > 0" assertion fails. The two passing
drain tests are the ones that set times explicitly (future / stale-lock).

**Why it matters:** production is fine (real `now()`), but the FOR-UPDATE-SKIP-LOCKED claim,
backoff/dead-letter, partial-batch attribution, and throttle logic now have **zero passing
coverage** guarding regressions, and the failures are being waved off in the handoff.

**Fix (test-only):** anchor the tests to a single fixed base clock and enqueue at/before it.
Cleanest: give the `msg()` helper (line 23) a default `scheduledAt` of a fixed `BASE` constant
(e.g. `2026-07-01T00:00:00Z`) and use `BASE` as the `now` everywhere; the "does not claim
future" test keeps its explicit `now + 1h`, the stale test keeps its explicit past lock. This
removes all dependence on real wall-clock so it can't rot again. (Alternative: inject a clock
into `enqueueEmail` and pass it — larger, not worth it for a test bug.)

**Also correct the docs:** update the "5 pre-existing email-outbox PGlite timing flakes" line in
`docs/sessions/230-handoff.md` and the STATUS.md TL;DR to reflect that these were a deterministic
date-bomb now fixed. This prevents the next session from re-waving-off a red outbox suite.

**Release:** none. `@commonpub/server` test-only change; no publish. Land on main → commonpub.io
rebuilds from source. No consumer impact.

---

## Phase 1 — P2 quick CONFIRMED fixes (small, high-value, backend-only)

### 1a. Negative `page` → negative SQL OFFSET → unauthenticated 500 on all outbox routes
**File:** `packages/server/src/federation/outboxQueries.ts:65`
(`offset = (page - 1) * pageSize`), reached from `routes/actor/outbox.ts`,
`routes/users/[username]/outbox.ts`, `routes/hubs/[slug]/outbox.ts`.
`?page=-1` parses to `-1` (truthy, not NaN) → passes the `!page || isNaN(page)` collection
guard → `offset = -40` → Postgres `OFFSET must not be negative` → unhandled 500. Unauthenticated,
trivially repeatable, same NaN/limit/offset DoS class flagged in prior audits.
**Fix (verified):** clamp the page in `outboxQueries.ts` — `const p = Math.max(1, Math.floor(page))`
— before computing `offset = (p - 1) * pageSize`. This is the clean, correct fix. **Do NOT** try to
route these through `normalizePagination` (`packages/server/src/query.ts:152`, not
`federation/query.ts`): that helper is **offset/limit-based**, while the outbox path passes a
**`page`** and derives the offset internally, so it is not a drop-in — you'd have to convert
page→offset first. The in-place page clamp is simpler and covers all three routes.
**Test:** `?page=-1`, `?page=0`, `?page=abc` on each of the 3 outbox routes → 200 with page-1
semantics, never 500.

### 1b. Federated comment/reply/boost counters inflatable by any peer (no handler-level dedup)
**File:** `packages/server/src/federation/inboxHandlers.ts:863-866, 909-918`
Route-level replay dedup keys on `body.id` and is **skipped when the activity has no `id`**
(`routes/inbox.ts:26`). Unlike `onLike`/`onAnnounce` (which carry their own actor+object
idempotency marker), the `onCreate` reply path increments the parent's `commentCount` /
`localCommentCount` with **no idempotency guard**. A signed peer can send
`Create{ object: Note{ inReplyTo: <our content> } }` with no top-level `id` (and no `object.id`
so even the `federatedContent` upsert is skipped) and bump the count infinitely. Pollutes any
count-driven sort/ranking.
**Fix (corrected after verification — my first draft was wrong):** require a stable identity before
applying the reply side-effect. **Prefer (a):** reject/skip an inbound `Create` that has neither a
top-level `id` NOR an `object.id` — an activity we cannot dedup should not mutate counts. If we DO
have the reply Note's own `object.id`, key the idempotency on **that** via the existing
`recordActivitySeen`/`processed_activities` atomic `INSERT … ON CONFLICT DO NOTHING RETURNING`
(`activityDedup.ts:28`), incrementing only when a row is returned; this degenerates to (a) when the
id is absent.
**Do NOT** do what the first draft said (key a `(actorUri, objectUri, 'reply')` marker "like the
like path"): (1) the like path at `inboxHandlers.ts:1124` is **not** an ON-CONFLICT marker — it's a
racy `SELECT`-then-`INSERT` on the **unconstrained** `activities` log table (which Phase 3 below
flags as its own race), so it can't back `ON CONFLICT`; (2) there is **no** existing
`(actor,object,verb)` marker table to reuse; (3) replies are **not** idempotent by `(actor,parent)`
— the same actor can legitimately post many distinct replies to one parent, so an `(actor,parent)`
marker would **undercount** genuine replies. Key on the reply's own id or reject id-less Creates.
Apply the same guard to the boost/`localBoostCount` path (which likewise carries the Announce's id).
**Test:** deliver the same reply Create (with an id) twice → `commentCount` increments once; two
DIFFERENT replies from the same actor to the same parent → increments twice; an id-less Create →
skipped (no increment), not stored.

### 1c. Contest lifecycle notifications overwrite each other (dedup-key collision)
**File:** `packages/server/src/contest/contest.ts:271-354`, `judging.ts:289-296`,
`judges.ts:88-96`, `stakeholders.ts:110-113`
`createNotification` dedups on `UNIQUE(userId, type, actorId, link)` and **overwrites** the prior
row's title/message on conflict (`notification.ts:187-203`). All non-completed contest lifecycle
notifications for a recipient share `type='contest'`, `actorId=organizer`, and
`link=/contests/{slug}`, so "Contest Open" → later "Judging Started" replace the same row, and a
judge's invite gets overwritten by "judging started" when inviter==organizer. Only the
winner/results cases escape (they append `/results` to the link).
**Fix:** make each lifecycle event's notification distinct so it doesn't collapse. Options: append
a milestone discriminator to `link` (e.g. `/contests/{slug}?e=judging-open`,
`?e=stage-2-advanced`), or add a nullable `dedupKey` column consulted instead of `link`. The
`link` discriminator is zero-migration and keeps the click-through target correct (query param
ignored by the page). Choose per-event milestone strings shared with the reminder ledger in the
contest-communications plan.
**Test:** transition a contest through active → judging → completed for one entrant → three
distinct notification rows survive, not one overwritten row.
**Note:** this fix is a prerequisite for the contest-communications build and is duplicated in
that plan's Phase 1; do it once, here or there.

**Phase 1 release:** `@commonpub/server` (federation + contest) → `@commonpub/layer` (no route
signature change; the outbox clamp is server-side). Bump server minor, layer patch, roll to 3 per
the STATUS runbook. No schema change if 1c uses the `link` discriminator.

---

## Phase 2 — P2 federation hardening (larger; most latent behind flags)

### 2a. Inbox amplification / DoS via uncached pre-dedup 30s actor fetch
**File:** `layers/base/server/utils/inbox.ts:106`
`verifyInboxRequest` resolves the signer via `resolveActor(actorUri, createSafeActorFetchFn())`
— the **uncached** protocol helper — on **every** inbound delivery, before replay dedup and
before any cheap rejection, with `RESOLVE_TIMEOUT_MS = 30_000`. An attacker POSTs to `/inbox`
with `keyId="https://victim.example/slow#main-key"`; the server issues an outbound GET to the
victim and holds the request open up to 30s. Repeatable across the per-IP budget (which itself
**fails open on Redis error**, `middleware/security.ts:41`) and from many IPs → reflected
amplification at a third party + request-slot exhaustion. Also a plain efficiency regression:
legit high-volume senders get their key re-fetched per activity instead of hitting the 24h
`remoteActors` cache.
**Fix (expanded after verification — the naive swap is incomplete AND regresses).** Verified:
`resolveRemoteActor` (`federation.ts:132`) IS a 24h `remoteActors`-table cache and returns the same
`{publicKey:{publicKeyPem},id}` shape `verifyInboxRequest` needs (drop-in on the happy path). BUT
two gaps must be closed or the swap trades one bug for another:
- **(c) No negative caching (confirmed).** On a resolve miss `resolveRemoteActor` returns null and
  writes nothing (`:169`), so an attacker's made-up `keyId` — the exact DoS vector — still triggers
  a fresh outbound fetch **every** request. The swap only helps honest, resolvable senders unless we
  add a **negative-cache / short-TTL failure memo** (e.g. cache "unresolvable" for a few minutes) so
  bogus keyIds don't re-fetch.
- **(d) New 24h key-rotation blind spot (confirmed).** Today verify always fresh-fetches, so a legit
  actor that rotates its key works immediately. A cache hit would serve a **stale** `publicKeyPem`
  for up to 24h and `verifyInboxRequest` has **no re-fetch-on-failure fallback** → the rotating
  actor's activities 401 until expiry. Mitigate: on signature-verify FAILURE against a cache-hit
  key, force **one** fresh `resolveActor` and retry before returning 401.
So the corrected fix = swap to `resolveRemoteActor` + add negative caching + add the
verify-failure→refetch retry + optionally lower the resolve timeout on this path (e.g. 8s) + a cheap
signature-header-shape pre-check before any outbound fetch. Keep SSRF pinning. This is a larger
change than "swap the resolver," so budget accordingly.
**Test:** two signed deliveries from the same actor → one outbound key fetch (cache hit on the
second); a bogus/unresolvable keyId hit twice → at most one outbound fetch (negative-cached); a
sender that rotates its key → verify fails once, refetches, then succeeds (no 24h outage).

### 2b. Live mirror ingestion ignores the `mirrorMaxItems` quota
**File:** `packages/server/src/federation/mirroring.ts:537-552`
`matchMirrorForContent` has a comment block describing a per-mirror quota ("skip if the mirror
has hit the configured max") but **no code** — it unconditionally bumps `contentCount` and stores
the item. `mirrorMaxItems` is honored only in the **backfill** path (`inboxHandlers.ts:263`,
`backfill.ts:105`). An operator-approved pull mirror can push unbounded content to the shared
inbox → resource exhaustion by a semi-trusted peer.
**Fix:** implement the documented check — before storing, read the mirror's `contentCount` and if
`>= mirrorMaxItems` skip the store (and optionally flag the mirror). Keep it cheap (the count is
already on the mirror row). Decide behavior when full: silently drop vs mark the mirror errored;
recommend drop + increment an `overflowCount` for admin visibility.
**Test:** a mirror at its cap receives one more inbound Create → not stored, count unchanged.

### 2c. Backfill trusts outbox items' `actor` without host binding (attribution forgery)
**File:** `packages/server/src/federation/backfill.ts:192`, `hubMirroring.ts:1128`
The backfill path calls `processInboxActivity(activity, handlers)` directly on items crawled from
a remote outbox, with **no** `assertActorMatchesSigner` (the live inbox routes all bind
`activity.actor`'s host to the cryptographic signer). A mirrored peer can serve an outbox whose
`Create`/`Like`/`Announce` items carry `actor: https://victim.example/...`; on backfill our
handlers store `federatedContent` / increment like counts attributed to `victim.example`.
Confused-deputy attribution forgery by a semi-trusted (approved-mirror) peer.
**Fix:** in the backfill loop, bind each item's `actor` host to the **outbox's host** (the domain
we are backfilling from) before dispatch — reject/skip items whose `actor` host differs from the
mirror domain. This mirrors the `assertActorMatchesSigner` invariant for a context where there is
no per-item signature (the transport is a signed GET of the outbox, not per-item signatures).
**Test:** backfill an outbox whose items name a third-party actor → those items are skipped, not
stored.

### 2d. Inbound federated HTML relies on regex allowlist sanitizers (DOWNGRADED — my premise was refuted)
**File:** `packages/protocol/src/sanitize.ts:96` (ingress) + `layers/base/composables/useSanitize.ts:70` (render)
**Correction:** my first draft claimed the render-layer `sanitizeBlockHtml` is "a no-op … so this
regex may be the only real XSS boundary." **That is false.** Verified: the federated `v-html` sinks
(`federated-hubs/[id]/posts/[postId].vue:142`, `mirror/[id].vue:120`) call the **layer**
`sanitizeBlockHtml` (`useSanitize.ts:70`), a **real allowlist sanitizer** (strips comments,
non-allowlisted tags, all `on*`/`style`, rejects unsafe `href`/`src`) with a **passing XSS test
suite** (`apps/reference/__tests__/sanitize.test.ts`). The session-203 "no-op" referred to a
*different* function (the editor package's), which is **also no longer a no-op**
(`packages/editor/vue/utils.ts:186` runs a DOMParser walk). So **defense-in-depth already exists at
the render layer** — there is nothing to "restore."
**Residual (real but low-priority hardening, not a gap):** both boundaries are regex/DOMParser
allowlists, and any regex HTML sanitizer is theoretically bypassable (mutation-XSS). A DOM-based
sanitizer (jsdom + DOMPurify) at the federation ingress would be strictly safer, but with a proven
allowlist at BOTH ingress and render this is a hardening nicety, not a P2. **Reclassify as P3.**
**Also:** correct the stale `codebase-analysis/06-other-packages.md:107` line that still calls
`sanitizeBlockHtml` a "no-op identity function" — it misled this very plan.
**Test (if pursued):** a mutation-XSS / scheme-obfuscation corpus through the ingress path → inert
HTML; keep the existing render-layer XSS suite green.

### 2e. Private hubs federate with no privacy gate when `federateHubs` is on
**File:** `layers/base/server/middleware/hub-ap.ts:24-33`, `layers/base/server/api/hubs/
index.post.ts:13-17` (and `federateHubPost`/`federateHubShare` call sites)
The Group actor JSON is served for **any** hub slug (checks only the feature flags, never
`hub.privacy`); creation federates regardless of privacy; only follow auto-accept consults
`hub.privacy`. If an operator enables `federateHubs`, a `privacy='private'` hub's
name/description/member-count/icon and every post broadcast to the fediverse with public
addressing. Latent today (CLAUDE.md rule 5: hubs local-only in v1, `federateHubs` off), but a
foot-gun the moment the flag flips.
**Fix:** gate every hub AP surface on `hub.privacy === 'public'` — the `hub-ap` middleware
(404/403 for non-public hubs), `federateHubActor`, `federateHubPost`, `federateHubShare` call
sites, webfinger, and the hub outbox/followers/resources/products routes. Single helper
`isHubFederatable(hub)` = `features.federation && features.federateHubs && hub.privacy==='public'`.
**Test:** with `federateHubs` on, a private hub's `/hubs/{slug}` AP actor, outbox, and webfinger
all 404; a public hub's still serve.

**Phase 2 release:** `@commonpub/server` (2a caching + refetch-retry in `federation.ts`, 2b, 2c,
2e) → `@commonpub/layer` (2a inbox-util wiring, 2e middleware/routes). 2a is a real change to
`resolveRemoteActor` (negative cache + verify-failure refetch), not just a one-line util swap —
verify against a two-instance interop round-trip incl. a key-rotation case. 2b/2e are latent-flag
fixes. **2d is DOWNGRADED to P3** (defense-in-depth already exists at the render layer) — carry it
in the Phase 3 batch as optional hardening, not here.

---

## Phase 3 — P3 polish (batchable; robustness / defense-in-depth)

### Federation
- **Dedup-before-process drops activities on transient failure** —
  `federation/activityDedup.ts:28` + inbox routes record "seen" *before* `processInboxActivity`;
  a DB blip mid-process leaves the `processed_activities` row so the sender's redelivery is
  silently discarded with no side effect applied. **Fix:** record seen only after successful
  processing, or make record+process transactional (roll back the seen row on throw). Availability
  fix, not security.
- **`federateComment` no visibility gate** — `federation/federation.ts:694-753` checks only
  `targetType`, never the parent's `status`/`visibility` (unlike `federateContent`). A comment on
  a members-only/private item emits a public `Create(Note)` with `inReplyTo` = that item's URI,
  leaking its existence + the comment text. **Fix:** load the parent and gate
  `visibility==='public' && status==='published'` before emitting; verify callers. (PLAUSIBLE —
  confirm callers actually invoke it for non-public parents.)
- **`onLike` check-then-act race across distinct activity ids** — `inboxHandlers.ts:1124-1140`
  SELECTs then INSERTs the marker; two concurrent Likes with different ids but same actor+object
  both pass the SELECT → double count. **Fix:** rely on the `ON CONFLICT DO NOTHING` insert as the
  gate (increment only when a row is returned), dropping the pre-SELECT.
- **`unshareContent` sends no `Undo(Announce)`** — `hub/posts.ts:792-837` correctly fixes local
  `post_count` (session 230) but queues no federation retraction, so remotes that mirrored the hub
  keep the orphaned shared-content card + inflated `localPostCount`. Consistent with "Hubs =
  Partial", so arguably by-design; if hub federation matures, emit `Undo(Announce)`.
- **Local `likePost`/`unlikePost` non-transactional** — `hub/posts.ts:418-474`: the
  `onConflictDoNothing` gate and the counter increment are separate statements (the federated path
  `hubMirroring.ts:1298` *is* transactional; the local path was left as-is in session 203). **Fix:**
  wrap in `db.transaction`. Cosmetic counter, `GREATEST(...,0)`-clamped, so low urgency.

### Email
- **Worker lease renewal doesn't re-check ownership → live-worker stall can double-send** —
  `comms/outbox.ts:161-164` renews `lockExpiresAt WHERE id IN (claimedIds) AND status='sending'`
  with no ownership predicate. If worker A stalls >5min mid-tick, B reclaims via the stale-lock
  branch, then A blindly re-extends and marks the row `sent` while B also sends it. **Fix:**
  scope the renewal to this worker's claim — add a per-worker claim token column, or include
  `AND claimedAt = <our claim time>` in the renewal + the final `sent` update. Low likelihood
  (needs a >5min stall surviving the 30s HTTP timeout).
- **`List-Unsubscribe` URL has no GET handler** — `comms/unsubscribe.ts:38` header points at
  `/api/unsubscribe?token=…` but only a `.post` handler exists. RFC 8058 one-click POSTs (fine),
  but RFC 2369 fallback clients / a human pasting the URL GET it → 404/405, silent one-click
  failure. **Fix:** add a GET handler that renders the existing `/unsubscribe` confirm page (which
  already works). See the compliance section of the contest-communications plan (both header forms).
- **Empty `AUTH_SECRET` makes unsubscribe tokens forgeable** — `broadcast.ts:62` /
  `notification-email.ts:42` / `unsubscribe.post.ts:16` fall back to `authSecret || ''` → HMAC key
  `''` → anyone can forge an unsubscribe token for any user (griefing). Low harm (reversible), but
  **fix:** hard-fail (or refuse to emit unsubscribe links) when `AUTH_SECRET` is empty.
- **`adminBroadcast` ON while `emailNotifications` OFF piles up undrained rows** —
  `broadcast/index.post.ts:11-12` gates only admin + `adminBroadcast` + `broadcast.send`; the
  worker gates on `emailNotifications`. An admin can enqueue a broadcast that never drains, then
  flushes an old blast when email is later enabled. **Fix:** the broadcast route should also assert
  `emailNotifications` (or warn clearly in the UI that email is off).
- **Already-enqueued mail ignores a later unsubscribe** — `comms/outbox.ts` sends whatever is
  `pending` without re-checking prefs; a user who unsubscribes after a large broadcast/digest is
  enqueued still gets the queued messages. **Fix:** re-check `unsubscribedAll` at send time (join
  `users.emailNotifications`) for `category IN ('digest','broadcast','notification')`; auth exempt.
- **`emailMaxSendsPerSecond` actually caps batches/sec (~up to 500 emails/s)** —
  `email-outbox.ts:30` maps the env value to `maxBatchesPerSecond`; each batch is up to 100.
  Misleading to an operator tuning to a provider's per-message limit. **Fix:** rename to
  `emailMaxBatchesPerSecond` (or make it a true per-message token bucket). Cosmetic/naming.
- **`button()` / `wrapTemplate` trust callers to pre-escape** — `email/render.ts:36-44,67-69`
  interpolate raw. Every current caller escapes (verified, no live XSS), but a future template that
  forgets is an email-XSS footgun. **Fix:** escape inside the primitives (safe-by-default); pass
  URLs through a validator.
- **Broadcast runs inline in the request + no idempotency** — `broadcast.ts:54-83` loads the whole
  audience into memory and inserts synchronously in the HTTP handler; a very large `all` audience
  can time out, and a double-click sends twice. **Fix:** cap/chunk the audience resolution and add
  a submit idempotency guard (client disable + server dedup on a client-supplied request id).
- **Unsubscribe route binds decoded token → `users.id` (uuid) with no domain check** —
  `unsubscribe.post.ts:25,33` passes the HMAC-decoded id straight to `eq(users.id, userId)`; a
  non-uuid value would throw `invalid input syntax for type uuid` → unhandled 500. Not exploitable
  (reaching the query requires a valid HMAC over that id, unforgeable without the secret), but a
  belt-and-suspenders uuid-shape guard before the query is cheap.

### TS/schema hygiene (surfaced during audit)
- **`NotificationType` union omits `event`** though it's in the DB enum
  (`notification.ts:21` vs `enums.ts:73`) — an `event` notification wouldn't type-check. Add
  `event` to the union (and `certificate` is declared-but-unused — either wire or drop). Cheap.

**Phase 3 release:** batch into one `@commonpub/server` + `@commonpub/infra` (render escaping) +
`@commonpub/layer` (unsubscribe GET route) minor. Roll to 3. All low-risk.

---

## Sequencing & release discipline

1. **Phase 0** — land immediately (test-only, corrects a misleading handoff note). No publish.
2. **Phase 1** — one server+layer roll (the unauthenticated 500 is the priority; 1c also unblocks
   the contest-comms plan).
3. **Phase 2** — hardening roll; 2a/2c first (pure hardening), then 2b/2e (latent-flag), 2d on its
   own track (dependency decision).
4. **Phase 3** — a cleanup roll; batchable, no urgency.

Per the STATUS runbook: TDD (test first), publish order schema→config→infra→server→layer polling
`npm view`, layer only via `pnpm run publish:layer`, hand-edit caret pins across 0.x minors, bump
BOTH lockfiles for deveco/heatsync, re-pin the CLI, and **verify with `curl /api/health` + a real
route per instance** (never trust `gh run`). No AI attribution in commits. Migrations via committed
SQL + `db-migrate.mjs` (only 2d-DOMPurify and none of the others need a migration; 1c avoids one via
the `link` discriminator).

## What the audit verified as SOLID (do not re-litigate)

HTTP-signature verify (raw-body digest, coverage policy requiring `(request-target)`/host/date/
digest, 5-min skew, no algorithm confusion, fail-closed 401); actor↔signer + keyId↔actor.id
binding; replay dedup atomic INSERT…ON CONFLICT; all outbound remote fetches SSRF-pinned; SSRF
classifier (IPv4-mapped, 6to4, NAT64, encodings, fail-closed); outbox projection gates
published+public+not-deleted with deterministic ids; `federateContent`/`federateUpdate` re-gate
visibility; `onUpdate`/`onDelete` authorization + Group-image URL scheme restriction; registry
ping (signature-verified, NodeInfo pulled not self-reported, per-domain rate limit, blocked
honored); mirror-request Offer/Follow consent (loop-guard, offer-id AND sender correlation,
idempotent); backfill live bounds (MAX_PAGES, maxItems, since-cutoff, cursor resume); email HMAC
unsubscribe (timing-safe, tamper-rejected); email template escaping (every field through
`escapeHtml`, accent re-validated); broadcast audience gating (verified + not-unsubscribed);
consent/GDPR (recordConsent dedup, require-terms flag-gated + read-safe + escape hatch); and
**all session 224-230 local-only features confirmed non-federating** (steward / hub_flags /
referral / featuredId absent from the Group actor allowlist and all protocol/federation code).

---

## Round-2 blast-radius corrections (session 231, workflow audit)

> A 12-surface upstream/downstream degradation audit traced each proposed fix through its OTHER
> callers. These corrections **supersede the inline fix text above where they conflict** — most of
> the original fix descriptions were too optimistic about blast radius. Each item cites its finding
> id (R#) and is CONFIRMED against code unless marked PLAUSIBLE.

### The resolver-cache fix (2a) is more dangerous than it looked — 3 corrections
`resolveRemoteActor` is the SHARED resolver used by delivery, sendFollow, mirroring, hubFederation,
timeline, messaging — NOT just inbox verify. Naive changes there degrade the whole write path.
- **R1 (P1).** Negative-caching a **transient** failure (timeout/abort/DNS/5xx/reset) in the shared
  resolver silently drops outbound delivery/follow/mirror for the whole TTL — a 3s blip → a
  multi-minute write-path outage. **Edit:** negative-cache ONLY permanent/deterministic outcomes
  (HTTP 404/410, WebFinger no-match, malformed actor); never transient. Gate the negative-cache
  **read** behind an opt-in `{ useNegativeCache?: true }` passed ONLY from `inbox.ts`; leave all
  outbound callers on always-refetch.
- **R2 (P1).** Do NOT store the memo in `remote_actors` — it collides with the 24h positive-read
  (`federation.ts:140-162`) and `remote_actors.inbox NOT NULL` (insert throw, or a sentinel served
  as a cache HIT → delivery to a fake inbox). **Edit:** separate memo store, or a nullable
  `unresolvableUntil` column checked FIRST and short-circuited to null before building the actor.
  Needs its own `packages/schema` migration.
- **R29 (P3, PLAUSIBLE).** Do NOT lower the module-level `RESOLVE_TIMEOUT_MS` (it also throttles
  outbound delivery/WebFinger to slow-but-valid peers). **Edit:** thread an optional
  `timeoutMs?` (default 30_000) through `resolveActor`/`createSafeActorFetchFn`; `inbox.ts` passes
  ~8_000. This is a public type-signature change in protocol + server.
- **R19 (P2).** Tests: rewrite `inbox.test.ts` to mock server's `resolveRemoteActor` (not protocol's
  `resolveActor`); the separate-table memo keeps `federation-resolve.integration.test.ts:162`'s
  zero-row-on-failure invariant.

### The mirror-quota fix (2b) does NOT actually drop content as written — 3 corrections
- **R3 (P1).** `matchMirrorForContent` returning `null` at cap does NOT stop the store — `onCreate`
  (`inboxHandlers.ts:761`) inserts `federatedContent` anyway with `mirrorId=null`, so the quota is
  unenforced AND at-cap content is silently downgraded to unattributed. **Edit:** return a
  discriminated result (`{mirrorId} | {atCap:true} | null`) and make `onCreate` SKIP the
  `federatedContent` insert when `atCap`.
- **R8 (P2).** The cap is read from `opts.federationConfig?.mirrorMaxItems`, which is **undefined on
  all 3 live inbox routes** (no `federationConfig` passed) → enforcement is a no-op in production
  (works only in backfill). **Edit (re-corrected round 4):** plumb `federationConfig`
  (`{mirrorMaxItems}`) through `createInboxHandlers` in all three inbox route files. **Do NOT** "read
  the cap via `useConfig()` inside `matchMirrorForContent`" (an earlier draft's option) — VERIFIED
  WRONG: `packages/server` is framework-agnostic and never uses Nitro auto-imports; config is
  threaded as a parameter (the comment at `mirroring.ts:538` literally says "passed from federation
  config, not stored per-mirror"). Add an integration test that drives `onCreate` via the live-route
  handler construction so the plumbing is exercised, not just the unit path.
- **R12 (P2).** `contentCount` freezing at cap makes the admin "Items imported" read as a stall.
  **Edit:** add an at-cap signal (`instance_mirrors.overflow_count` or an `atCap` bool → schema +
  `MirrorDetailModal` prop) so a frozen count reads as intentional.
- **R30/R31 (P3).** Make any new `matchMirrorForContent` cap param a trailing optional (5-arg test
  calls compile) with a hard no-op when undefined; and only `result.processed++` in `backfill.ts:193`
  when an item was actually stored (else the admin backfill summary overstates).

### The id-less Create guard (1b) must not early-return — R13/R24
- **R13 (P2).** A top-of-handler `if(!objectUri) return` skips the tail `activities` insert
  (`inboxHandlers.ts:934-942`) and breaks `federation-production.integration.test.ts:156` (an id-less
  Create must still LOG +1). **Edit:** scope the guard to ONLY the reply/comment-count increment
  side-effects (`:801-924`); keep the tail activity-log insert unconditional. (Interop is safe — R5
  verify confirmed Mastodon/Pleroma/Misskey/Lemmy/PeerTube all mint ids on both wrapper and object.)
- **R24 (P3).** Key idempotency on `object.id`/`objectUri` ONLY; the top-level activity id is
  unreachable at handler level. Do NOT change the `onCreate`/`onAnnounce` `InboxCallbacks` signature
  (avoids a `@commonpub/protocol` bump). Standard server-minor + layer-patch.

### The negative-page clamp (1a) misses the hub route — R14
- **R14 (P2).** The bug lives in TWO offset computations: `getContentOutboxPage:65` (instance+user)
  AND `getHubOutboxPage:184` (its own math). Clamping only line 65 leaves
  `GET /hubs/<slug>/outbox?page=-1` still 500ing. **Edit:** apply
  `const p = Math.max(1, Math.floor(page)); offset = (p-1)*pageSize;` in BOTH functions.

### The email send-time recheck (Phase 3) breaks the send path as sketched — R4/R11/R27
- **R4 (P1).** An INNER JOIN `users` on `outbox.userId` drops every null-userId row → suppresses ALL
  currently-working outbox mail and fails the drain integration test (sent=0). **Edit:** do a
  POST-claim per-row pref lookup keyed on `claimed[].userId`; treat `userId=NULL` as SEND (or LEFT
  JOIN + coalesce-to-send).
- **R11 (P2).** Do NOT fold the pref lookup into the `FOR UPDATE SKIP LOCKED` claim — it locks
  joined `users` rows (no `OF email_outbox`) and breaks the mirrored claim-SQL assertion. Keep the
  claim SELECT exactly as-is; filter in JS after claim, before `sendBatch`.
- **R27 (P3).** Make the recheck **suppress-by-default for every non-auth category** (exempt only
  auth/security), not a hardcoded `('digest','broadcast','notification')` allowlist — otherwise the
  contest plan's new `reminder` category flows through the same drain and bypasses the recheck.

### The private-hub gate (2e) needs bidirectional lifecycle handling — R9/R10/R22/R23
- **R9 (P2).** A private→public flip calls only `federateHubUpdate` (never `federateHubActor`), so a
  newly-public hub never emits its bootstrap Announce and never becomes fediverse-visible. **Edit:**
  in `index.put.ts`, on not-public→public also call `federateHubActor(db, hub.id, domain)`.
- **R10 (P2).** A public→private flip orphans accepted remote followers (no `Delete(Group)`/`Undo`
  path, and 404'ing the actor destroys the signature-verify path needed to notify them). **Edit:**
  before gating the actor route, emit `Delete(Group)`/per-follower `Undo` WHILE the route still
  serves, then mark followers removed. Implement `federateHubDelete`.
- **R22 (P3).** Gating strictly on `==='public'` de-federates existing **unlisted** hubs on deploy
  (no user action). **Edit:** decide unlisted semantics — gate on `privacy!=='private'` if unlisted
  is federatable, else add the R10 retraction so unlisted hubs don't orphan silently.
- **R23 (P3).** Gating only the plan-named call sites leaks a private hub via un-named
  `federateHubPostUpdate@614`, `federateHubPostDelete@835`, `relayRemoteMemberPost@363`. **Edit:**
  centralize the gate as an early-return INSIDE each `federateHub*` fn (re-read `hub.privacy`), not
  only at layer call sites.

### Migration & release ripple — R20/R21
- **R21 (P3).** The `email_outbox` lease-token and `broadcasts` scope columns MUST be nullable or
  carry a server-side DEFAULT — a bare `ADD COLUMN ... NOT NULL` emits a non-additive migration that
  hard-fails `db-migrate.mjs` on any non-empty table. Verify the generated `.sql`.
- **R20 (P2).** Every schema-touching fix forces a coordinated `create-commonpub` pin bump +
  dual-lockfile regen (deveco npm lock gitignored, heatsync tracked) + CLI re-pin, or frozen-install
  deploys hard-fail. Before publishing any layer TYPE change, `pnpm pack` + `pnpm add` the tarball
  into deveco-io and run its nuxt typecheck (memory: layer source is typechecked in the consumer).

### Contest-plan dependencies that live in THIS plan (call out the coupling)
The contest plan's compliance + suppression explicitly depend on three Phase-3 items here: the
send-time unsubscribe recheck (above), the **`List-Unsubscribe` GET handler**, and the broadcast
drain-gate + idempotency. Land these before contest Phase 2/4 email or that mail ships
non-compliant / double-sending (completeness gaps 6-8).

### Clean / refuted (traced safe)
- **1c link discriminator (R, notif-dedup-link): CLEAN** — nothing keys off the exact link string
  except the intentionally contest-scoped dedup path; social-type dedup untouched.
- **1b interop: SAFE** — no major fediverse server emits id-less Creates.

---

## Round-4 verification corrections (session 231, "never assume" pass)

> Verified the round-2/3 corrections themselves against code. Two corrections were themselves wrong
> or under-specified; the rest confirmed.

- **[R2 RE-CORRECTED — the negative-cache column doesn't work].** R2 said "add a nullable
  `unresolvableUntil` column on `remote_actors`." VERIFIED INFEASIBLE for the dominant case: a
  never-before-resolved actor whose first resolution fails has **no row** to hang the column on, and
  you **can't INSERT one** because `remote_actors.inbox` (`schema/federation.ts:10`) and
  `instanceDomain` are **NOT NULL** — you'd have to either make `inbox` nullable (large blast radius:
  dereferenced non-null at `federation.ts:149,195` + the delivery path) or insert a sentinel inbox
  (the exact "served as a cache HIT → delivery to a fake inbox" hazard R2 warns of). **Use a dedicated
  `actor_resolution_failures` table** (`actor_uri text unique`, `unresolvable_until timestamptz`,
  `reason text`; no inbox/domain constraints), checked FIRST in `resolveRemoteActor` (before the
  `remote_actors` read at `:134`) and short-circuited to null. This also keeps R19's "zero rows in
  `remote_actors` on failure" invariant intact and serves the never-resolved case cleanly.
- **[R10 async-delivery caveat].** R10 says emit `Delete(Group)`/`Undo` "WHILE the route still serves,
  then gate." But hub federation delivery is **asynchronous** — `federate*` fns only enqueue a
  `pending` `activities` row; a separate worker delivers it later (and fetches the actor key for
  signing). So ordering two function calls does NOT guarantee the Delete goes out before the actor
  route 404s. **Edit:** introduce an explicit `pending_deletion` hub state that KEEPS the actor route
  serving until the queued `Delete` is marked `delivered`, then gate. All primitives exist
  (`buildDeleteActivity`/`buildUndoActivity` imported in `hubFederation.ts:22,25`;
  `getHubFederatedFollowers` at `:235`; `federateHubActor` bootstrap-Announce at `:257` for the R9
  private→public direction — R9 confirmed buildable as written). `federateHubDelete` must be built.
- **[R8 already re-corrected inline]** — plumb `federationConfig` through `createInboxHandlers`; do NOT
  use `useConfig()` in the framework-agnostic server package (see Phase-2 §2b, R8).
- **[1a line accuracy].** The comment-count increments are at `inboxHandlers.ts:865` (local
  `commentCount`) and `:916` (`localCommentCount`); the tail `activities` insert is `:934-942`. (The
  earlier "909-918" range straddled the unrelated `remoteReplyCount` block at 908-910, which already
  has its own dedup select — don't touch that one.) R13's "scope the guard to :801-924 increments,
  keep the :934-942 tail insert unconditional" is correct.
- **[R5 wording].** `updateProfileSchema` is a plain `z.object()`, **not** `.strict()` — it **silently
  strips** unknown keys (worse than a loud 400). The remediation is unchanged (widen the
  `emailNotifications` shape before shipping the matrix UI), but the mechanism is silent-strip, not
  reject.
- **[CONFIRMED implementable as written]:** R6 (profile merge — `unsubscribe.post.ts:37-42` spread
  pattern is real and mirrorable), R29 (thread optional `timeoutMs` through `resolveActor` /
  `createSafeActorFetchFn` — module consts today, backward-compatible additive param, protocol+server
  minor / layer unaffected), and every fact-check citation (13/14, the 14th being the R5 wording).
- **[CLI pins CURRENT]** — create-commonpub is at the live stack (schema^0.56 / config^0.30 /
  server^2.105 / layer^0.97); each publish phase re-pins `template.rs` AND `tests/cli.rs` (the test
  asserts exact strings — the anti-drift forcing function).

---

## Round-5 ground-up findings (session 231 — re-attacking the foundation)

> Four fresh agents told NOT to trust rounds 1-4 or the plans. They re-attacked the "SOLID" cores,
> re-derived every bug, hunted un-audited subsystems, and audited the audit methodology. The biggest
> finding (content/hub privacy leak) is its own plan. The rest:

### P1 LIVE — content/hub privacy leak → see `docs/plans/content-privacy-enforcement.md`
Do this before ANY item in this plan. Server-only, no migration, unauthenticated, all 3 instances.

### NEW P2 (LIVE) — GDPR right-of-access export is incomplete
- **G1.** `profile/export.ts:170-174,240-245` OMITS the IP/userAgent the platform holds about the
  subject (`userConsents.ipAddress/userAgent`, `contestAgreementAcceptances.ip`) — an Art. 15 access
  shortfall on a platform built around PII + consent + IP logging.
- **G2.** The referral graph (`referral_links`/`referral_attributions`, session 229) is absent from
  the export, though the export's own comment claims it mirrors the deletion cascade's reach (silent
  regression). **Fix:** add both to `buildDataExport`; cheap; live on all 3. Ranks ABOVE the
  flag-latent 2b/2e work by real-world value. (Deletion itself is thorough — all user FKs cascade.)

### NEW P2 — RBAC `roles.manage` has no privilege ceiling (latent: RBAC-on + delegation)
`rbac/admin.ts:75-119` `sanitizeGrants` blocks only `*`/`admin.*`, so a non-admin holding
`roles.manage` can mint a role granting any non-bypass permission (`contest.pii`, `settings.manage`,
`users.manage`, `federation.manage`) and self-assign — near-root escalation short of full admin.
**Fix:** a privilege ceiling (can't grant what you don't hold). Also **R4:** the `contest.*` segment
wildcard silently includes `contest.pii` — building a "contest organizer" role via wildcard collapses
the PII boundary; exclude `contest.pii` from wildcard expansion. One-function fix, larger blast radius
than most Phase-2 items. Also **R3 (P2 live):** `contest.create`/`event.create` are seeded but no
route enforces them (any member creates contests/events) — either enforce or stop advertising them.
And **R1 (P3):** the 30s per-process authz cache lingers a revoked `contest.pii`/`federation.manage`
grant cross-pod (bounded PII-read window; admin demotion is already immediate).

### 2b mirror-quota — DEEPER than stated (re-derive agent): lean P1
The bug is not just "the cap is a no-op." The ENTIRE mirror-filter mechanism (content-type filter,
tag filter, AND the active-pull-mirror existence check) never gates storage: `onCreate` stores
`federatedContent` for any validly-signed remote `Create` carrying an `objectUri` **even when NO
mirror exists at all** (`matchMirrorForContent`'s return is used only as an FK + a stats bump).
So the real exposure is unbounded federated-content growth driven by ANY federation peer. **Fix:**
gate the `onCreate` `federatedContent` insert on a matched, approved, under-cap mirror — not merely
implement the cap inside `matchMirrorForContent`. Upgrade the finding toward P1.

### 🔬 METHODOLOGY — the "SOLID" claims are static-only; change medium, don't add a round
Baseline VERIFIED by running: `@commonpub/server` typecheck clean; **5 failed / 1576 passed**, all 5
the outbox date-bomb; nothing else red. But the test suite has a structural blind spot: **the entire
crypto+network boundary is mocked** (`inbox.test.ts` `vi.mock('@commonpub/protocol')` → verify=true;
the "two-instance" tests are direct function calls with seeded actors — "no HTTP servers, no ports").
**No real signed inbound activity round-trip exists anywhere.** So every "SOLID" claim in this plan is
a code-reading, behaviorally unverified. Worse, the existing tests are too loose/split-brain to catch
the very bugs this plan fixes:
- reply-count test asserts `>=1` (passes under infinite inflation) + sends an id-BEARING reply (the
  attack is id-LESS) → 1b uncovered.
- dedup test asserts likes collapse (correct) but never sends colliding contest events → 1c uncovered.
- SKIP-LOCKED test asserts a SQL string on single-connection PGlite → multi-replica safety unproven.
- mirror-quota test drives `matchMirrorForContent` directly (the path the live routes DON'T wire) →
  the no-op is structurally hidden (2b/R8).
- negative-page untested at the route; PGlite may not reproduce Postgres's negative-OFFSET error.

**Gate order (round-5 verdict):** land **Phase 0** (free), then the **privacy plan** (P1 live), then
the GDPR export + RBAC ceiling (live/latent, cheap, high value). Do **NOT** ship **2a** (resolver
cache — its fix lives entirely in the mocked layer and touches the shared outbound resolver), **2e**
(private-hub gate — zero tests), the **preference matrix** (a11y is a real-browser/keyboard artifact,
axe-in-jsdom ≠ real SR), or the **reminder worker** (multi-replica idempotency can't be proven on
single-connection PGlite) on green unit tests alone. Each needs its named behavioral harness: a
network-instrumented two-instance signature round-trip, a real-browser + axe a11y run, and a
real-Postgres concurrency harness. Re-label everything called "SOLID" as "static-reviewed,
behaviorally unverified" until one real signed request and one real concurrent claim have run.
