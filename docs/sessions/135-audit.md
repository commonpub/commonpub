# Session 135 — Nine-round meticulous audit

Date: 2026-05-05. Branch: `main` (no code changes — audit only).

Nine rounds of audit work, each verifying the prior round's claims. Final
state: **30 CERTAIN findings, 3 LIKELY, 0 UNCERTAIN, 10 WITHDRAWN.**

This document records every confirmed finding at file:line, every
withdrawn claim (so future audits don't re-flag), and the recommended
fix scope.

## How to read this

- **CERTAIN** — verified against current code at the cited file:line. The
  bug exists and the fix is correct. Fix when prioritised.
- **LIKELY** — the cited code is real; whether the bug is "live right
  now" depends on something that requires running the system to
  demonstrate. The fixes are correct conservative choices regardless.
- **WITHDRAWN** — claims I made in earlier rounds and have since
  invalidated by direct verification. Recorded so they don't get
  re-discovered.

## Verified clean (no action)

These were each examined and are correctly built:

- **HTTP signature verification** (`packages/protocol/src/keypairs.ts:verifyHttpSignature`
  + `layers/base/server/utils/inbox.ts:verifyInboxRequest`). Body-size cap,
  signature presence, keyId extraction, actor resolution, **keyId-domain ==
  actor.id-domain match**, ±5min Date freshness, digest match against
  SHA-256, RSASSA-PKCS1-v1_5 verify. All in order.
- **Public API surface** (`layers/base/server/api/public/v1/**`). Every
  route calls `requireApiScope`. Hand-written OpenAPI spec at
  `openapi.json.get.ts` matches routes. Hard-forced `status='published'
  visibility='public'` filter regardless of internal API changes.
  Strong Zod input validation, page-size capped at 100.
- **All 148 mutating routes auth-gated.** Verified by reading every
  `*.post.ts | *.put.ts | *.delete.ts | *.patch.ts` under
  `layers/base/server/api/`. The 7 without `requireAuth/requireAdmin/
  requireApiScope` are intentional public endpoints (login, OAuth code
  exchange, view counters).
- **Better Auth ↔ schema alignment**: user/session/verification all
  match. The one gap is OAuth-provider-only (see NEW-M8 below).
- **`createFederatedSession` ↔ Better Auth's `resolveSession`**: compatible.
  Manual session insert produces a row Better Auth resolves identically
  to its own.
- **Admin user suspension cascades to session deletion**
  (`packages/server/src/admin/admin.ts:341-344`). When admin suspends or
  deletes a user, all their sessions are deleted in the same flow, so
  Better Auth's resolveSession returns null on the next request — no
  `requireAuth` check on `user.status` needed.
- **Server-side content sanitization**
  (`packages/server/src/content/content.ts:21-67:sanitizeBlockContent`)
  uses `isomorphic-dompurify` on every BlockTuple's `data.html` on both
  create (line 501) and update (line 559). DOM-based, allowlist of safe
  tags, fallback strips all tags if DOMPurify import fails.
- **Federated content sanitization** (`packages/server/src/federation/inboxHandlers.ts`,
  `protocol/src/sanitize.ts:sanitizeHtml`). Regex-based but conservative.
- **Email templates** (`packages/infra/src/email.ts:140-263`): every
  interpolated value is `escapeHtml`-ed. nodemailer/Resend strip CRLF
  from headers automatically, so subject-line injection is closed.
- **runtimeConfig.public exposure** (`layers/base/nuxt.config.ts:74-96`):
  no secrets in public config. Server-only fields stay top-level.
- **Theme CSS layer ordering** (`packages/ui/theme/agora.css`): correctly
  closes `@layer commonpub` before component overrides per the feedback
  memory.
- **@commonpub/ui components**: no hardcoded colours, no Options API,
  full ARIA, focus management on Dialog. Compliant with CLAUDE.md
  rules #3 and #5.

## Findings — CERTAIN

Severity: how much harm if exploited × how easy to exploit.

### 1. HIGH — image-proxy SSRF via `redirect: 'follow'`

**File:** `layers/base/server/api/image-proxy.get.ts:63`

The endpoint validates the input URL against a thorough SSRF blocklist
(127, 10, 172.16/12, 192.168, 169.254 metadata, fc/fd, fe80, localhost)
but then calls `fetch(url, { redirect: 'follow' })`. The redirect target
is **not re-validated against the blocklist**. An attacker hosts
`evil.com/img.png` returning `302 → https://10.0.0.1/internal-thing`;
the initial host passes, then fetch follows the redirect to the
private IP.

**The endpoint is unauthenticated.** The IP rate-limiter is the only
throttle, evadable.

**Fix:** port the existing redirect-revalidation pattern from
`packages/server/src/import/ssrf.ts:safeFetch`. Manual redirect with
`isPrivateUrl` re-check on each Location header.

### 2. HIGH — image-proxy unbounded body when Content-Length missing

**File:** `layers/base/server/api/image-proxy.get.ts:78-83`

```ts
const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
if (contentLength > 10 * 1024 * 1024) { throw createError(...); }
const buffer = Buffer.from(await response.arrayBuffer());
```

If the upstream omits Content-Length (chunked transfer-encoding always
omits it), `parseInt('') || '0'` evaluates to 0, the check passes,
`arrayBuffer()` reads the full body unbounded. An attacker hosts a
chunked endpoint streaming hundreds of MB of noise → OOM.

**Fix:** stream and accumulate, abort early on exceeding cap. ~10 lines.
Same PR as #1.

### 3. MED — Sharp megapixel-bomb DoS, no `limitInputPixels`

**File:** `packages/infra/src/image.ts:60, 79`

`processImage` calls `sharp(data).metadata()` and later
`sharp(data).resize().toBuffer()` without `limitInputPixels`. The upload
route enforces a 10MB byte-size cap but no megapixel cap. A malicious
authenticated user can upload a 10MB PNG that decodes to 50000×50000
pixels (~7.5GB raw bitmap) and OOM the Node process.

**Fix:** `await sharp(data, { limitInputPixels: 100_000_000 }).metadata()`
on both call sites. Bounds the worst case to ~400MB decoded.

### 4. MED — inboxHandlers fetches federated `objectUri` without SSRF check

**File:** `packages/server/src/federation/inboxHandlers.ts:1261`

```ts
const noteResponse = await fetch(objectUri, { ... });
```

No `isPrivateUrl(objectUri)` check. The fetch is gated to
mirrored-hub actors, which limits the attack surface to operators of
trusted instances — but defence-in-depth says trusted ≠ unbounded.

**Fix:** one line: `if (isPrivateUrl(objectUri)) return;` before the
fetch.

### 5. MED — `safeFetch` reads full body before size check

**File:** `packages/server/src/import/ssrf.ts:107-110`

Same pattern as image-proxy:

```ts
const buffer = await response.arrayBuffer();
if (buffer.byteLength > MAX_RESPONSE_SIZE) { throw new Error('Response too large'); }
```

The Content-Length pre-check at line 102 only runs if the header is
present, and is bypassable with chunked encoding. Used by content-import
flow which requires auth, so surface is authenticated users only.

**Fix:** same streaming pattern as #1+#2. Could ride along in the same
PR.

### 6. MED defense-in-depth — `safeFetch` and image-proxy use hostname-only SSRF check

**Files:** `packages/server/src/import/ssrf.ts:29-49` (`isPrivateUrl`),
`layers/base/server/api/image-proxy.get.ts:32-50`

`isPrivateUrl` checks the hostname against patterns. It does not
resolve DNS first. An attacker controls `evil.com` with a DNS A record
pointing to a private IP — hostname check passes, actual TCP connect
goes to the private IP.

**Bounded by current deployment topology**: image-proxy enforces HTTPS
(no internal HTTPS service has a valid cert for an attacker domain);
internal services (Postgres :5432, Redis :6379, Meilisearch :7700) are
not on port 80/443. As soon as a new internal HTTP service is added,
the bypass becomes live.

**Fix:** non-trivial — would need to resolve DNS first, verify IPs
private, then connect with a custom Dispatcher pinning the resolved IP.
Worth flagging on the federation roadmap rather than urgent fix.

### 7. MED — Notification spam: no dedup

**File:** `packages/server/src/notification/notification.ts:200-250`

`createNotification` always inserts a fresh row. The `notifications`
schema has no UNIQUE constraint (verified by grep — no `uq_notif*` or
unique-on-notifications). Combined with `toggleLike` calling
`createNotification` on every like-create: a malicious user can
like → unlike → like repeatedly to flood a victim's notification feed.
Each round writes a row + emits an SSE event. Unbounded growth of the
notifications table.

**Fix:** add UNIQUE `(user_id, type, actor_id, link)` constraint and use
`onConflictDoNothing` (or `onConflictDoUpdate` to bump createdAt). ~10
lines + a migration.

### 8. MED — SSE `/api/realtime/stream` has no per-user connection limit

**File:** `layers/base/server/api/realtime/stream.get.ts`

Every authenticated request creates: 2 `setInterval` timers, 1 Redis
pub/sub subscriber (when Redis enabled), 1 `ReadableStream`. Verified
by grep — zero hits for `activeConnections`, `maxConnections`, or
`connectionLimit` anywhere in the codebase.

A malicious authenticated user can open hundreds of concurrent SSE
connections (browsers self-limit, but a script bypasses).

**Fix:** maintain `Map<userId, count>` in the module scope, increment
on connect, decrement on cleanup, reject when over a per-user cap (10
is generous). ~15 lines.

### 9. MED — Redis healthcheck doesn't authenticate

**File:** `deploy/docker-compose.prod.yml:73-77`

```yaml
healthcheck:
  test: ['CMD', 'redis-cli', 'ping']
```

Redis runs with `--requirepass`. `redis-cli ping` without `-a $PASS`
returns the NOAUTH error. The container is showing healthy because
redis-cli still exits 0 after receiving any server response — but the
healthcheck isn't actually verifying Redis serves authenticated
commands.

**Fix:**
```yaml
test: ['CMD-SHELL', 'redis-cli -a "$$REDIS_PASSWORD" ping | grep -q PONG']
```
The `$$` is the compose escape so the shell expands `$REDIS_PASSWORD`
inside the container at runtime. One-line change. Note: `deploy.yml`
doesn't auto-sync the compose file (item #28 below), so this needs to
be scp'd manually.

### 10. MED a11y — Layer modals lack focus trap/restore

**Files:** `layers/base/components/ImportUrlModal.vue`,
`RemoteFollowDialog.vue`, `PublishErrorsModal.vue`,
`ShareToHubModal.vue` (and likely other modals).

Each sets `role="dialog" aria-modal="true"` and has an Esc keydown
handler — but no focus trap, no programmatic initial focus, no focus
restore on close, no body scroll lock. Searched the layer for
`<CpubDialog`, `useFocusTrap`, `tabindex="-1"` — zero hits.

The headless `Dialog` component at `packages/ui/src/components/Dialog.vue`
implements all of this correctly. The layer reimplements without
those a11y features.

**Fix:** refactor each layer modal to use `<CpubDialog>` from
`@commonpub/ui`. ~10 lines per modal. CLAUDE.md compliance + WCAG
2.1 AA.

### 11. MED — Circuit-breaker writes silently swallow errors

**Files:** `packages/server/src/federation/delivery.ts:179, 181, 188`

```ts
await recordDeliveryFailure(db, inboxDomain).catch(() => {});
await recordDeliverySuccess(db, inboxDomain).catch(() => {});
```

Three sites swallow circuit-breaker DB writes. If the DB fails the
write, breaker state diverges from reality: it won't open after enough
failures (false-closed) or won't close after recovery (false-open).

**Fix:** replace the three `.catch(() => {})` with structured-log
emits using `createStructuredLogger({ component: 'federation-delivery' })`.
~10 lines.

### 12. MED — No `emailVerified` enforcement on mutating actions

**Files:** Searched all production paths — zero `emailVerified` checks.

Better Auth sends a verification email on signup
(`createAuth.ts:60-67`), but no code anywhere blocks unverified users
from posting content, joining hubs, or producing federated activity.
A spammer can sign up with `attacker@throwaway.invalid`, skip the
verification email, and immediately post.

The one place `emailVerified` IS checked is
`notification.ts:81:getNotificationEmailTarget` — unverified users
don't receive notification emails. So password-reset abuse is bounded,
but content-spam-via-fake-account is open.

**Fix:** add `requireVerifiedEmail(event)` helper that wraps
`requireAuth` and checks the user's `emailVerified` column (already
loaded via `enrichUser`). Apply to content/comment/hub-join routes.

### 13. MED dormant — Better Auth `account` table missing OAuth columns

**File:** `packages/schema/src/auth.ts:66-79` (`accounts` table)

Better Auth's `account` schema (verified against
`@better-auth/core@1.6.4/db/get-tables.mjs`) requires: `idToken`,
`accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`. Our schema
has none of them.

For email/password auth (current default — both prod sites), only
`password` is used and that exists. **Zero current impact.**

But: the `socialProviders` block at `createAuth.ts:18-30` conditionally
adds GitHub and Google OAuth based on `config.auth.github` /
`config.auth.google`. Anyone enabling either without first running a
schema migration will hit "column does not exist" at OAuth callback.

**Fix:** migration `0003_oauth_account_columns.sql`:

```sql
ALTER TABLE accounts
  ADD COLUMN id_token TEXT,
  ADD COLUMN access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN refresh_token_expires_at TIMESTAMPTZ,
  ADD COLUMN scope TEXT;
```

And update `packages/schema/src/auth.ts` to declare them. Ship before
enabling any OAuth provider.

### 14. LOW — Meilisearch filter values not escaped (defense-in-depth)

**File:** `packages/server/src/search/contentSearch.ts:75-82`

User-supplied `opts.type`, `opts.difficulty`, `opts.authorUsername`,
`opts.tags[]` interpolated into Meilisearch filter strings without
quote escaping. The Zod schema upstream
(`search/index.get.ts:7-18`) accepts arbitrary strings.

Currently no exploit because the Meilisearch index only contains
published content (`indexContent` line 300 explicitly skips drafts), so
breaking out of the filter doesn't reveal anything new. Worth fixing
as defense-in-depth.

**Fix:** escape `"` and `\` in every user-supplied filter value before
interpolation. ~5 lines.

### 15. LOW — `wasPublished` dead variable hides narrow PUT-to-publish federation gap

**File:** `packages/server/src/content/content.ts:575`

```ts
// Track status transition for federation
const wasPublished = current.status === 'published';
```

Variable computed but never read. Was meant to gate a draft→published
transition for federation. The dedicated `POST /publish` route uses
`publishContent` → `onContentPublished` → `federateContent` (correct).
The narrow uncovered path: a user PUTs `{ status: 'published' }`
directly via `PUT /content/[id]` from a draft — the route then calls
`onContentUpdated` (sends Update), but no Create activity ever fired.

The frontend uses the dedicated publish endpoint, so this is
theoretical.

**Fix:** either delete the variable + comment, or wire it up to gate
first-publish federation in the PUT route (~5 lines either way).

### 16. LOW — `deploy/migrations/` orphaned

**Files:** `deploy/migrations/001-rename-communities-to-hubs.sql`,
`002-backfill-federated-hub-members.sql`

Both predate the session-128 baseline migration. The actual deploy uses
`packages/schema/migrations/` via `scripts/db-migrate.mjs`. The
`deploy/migrations/` directory is dead.

**Fix:** `git rm -r deploy/migrations/`.

### 17. LOW — `design-system-v2/` untracked + not gitignored

**File:** repo root.

Documented in `codebase-analysis/01-monorepo-topology.md:31` as
"ARCHIVE. Figma HTML exports. Not used at runtime." Shows up in
`git status` every session.

**Fix:** add `design-system-v2/` to `.gitignore`. One line.

### 18. LOW — 3 server integration tests skipped without explanation

**Files:**
- `packages/server/src/__tests__/messaging.integration.test.ts:106`
- `packages/server/src/__tests__/hub.integration.test.ts:148, 170`

`it.skip` with no `// TODO`, `// flaky`, or explanation comment.

**Fix:** triage — un-skip and fix, document why they're skipped, or
delete with a reason in the commit message.

### 19. LOW — `federation/messaging.ts` half-implemented

**File:** `packages/server/src/federation/messaging.ts:12-13`

Imports `buildCreateActivity` and `contentToNote` from protocol —
neither used. Docstring claims the file does "AP Create(Note) for DMs"
but the actual code only does actor resolution + a `sanitizeHtml` call.
Other federation modules (federation.ts, timeline.ts) construct
activities via these helpers; this file looks like a half-implemented
DM-federation feature.

**Fix:** investigate. Either delete the unused imports (if DM
federation isn't planned), or finish the implementation.

### 20. LOW — codebase-analysis stale and factually wrong on Redis

**File:** `codebase-analysis/09-gotchas-and-invariants.md`

The "Redis is provisioned but unused" section is wrong since session
130. The doc was written at session 125; sessions 130-134 added
Redis-backed rate limiting + SSE pub/sub.

Other drift verified:
- `01-monorepo-topology.md:48-58` claims schema `0.13.0`, server
  `2.43.0`, config `0.10.0`, layer `0.15.3`, learning `0.5.0`,
  explainer `0.7.11`, infra `0.5.1`. Reality: `0.14.4 / 2.47.4 / 0.11.0
  / 0.18.3 / 0.5.2 / 0.7.12 / 0.6.2`.
- `04-api-routes.md` claims 257 routes; reality 281.
- `05-layer-pages-components.md` claims 75 pages; reality 86.

**Fix options:** (a) refresh the docs; (b) add a banner to
`codebase-analysis/README.md` saying "Anchored at session 125; for
current state see latest `docs/sessions/`."; (c) delete
`codebase-analysis/` and rely on session logs.

### 21. LOW — No skip-to-content link

**File:** `layers/base/layouts/default.vue` (or wherever)

WCAG 2.4.1 (Bypass Blocks). Searched layer for "skip-to" or
"Skip to" — zero hits.

**Fix:** add `<a href="#main" class="cpub-skip-link">Skip to content</a>`
plus `:focus` styles to reveal it. ~10 lines.

### 22. LOW — `<html lang>` not set

**File:** `layers/base/nuxt.config.ts`

WCAG 3.1.1 (Language of Page). Nuxt's default leaves `<html>` without
`lang`.

**Fix:** add `app.head.htmlAttrs = { lang: 'en' }`. One line.

### 23. LOW — Caddyfile has no body cap on `/api/*`

**File:** `deploy/Caddyfile:53`

Inbox routes are capped at 1MB; the catch-all at line 53 has no body
cap. App-level `validateUpload` ultimately rejects oversized uploads,
but the body is buffered through Caddy first.

**Fix:** `request_body { max_size 128MB }` in the catch-all handler.

### 24. LOW — Font Awesome from cdnjs without SRI

**File:** `layers/base/nuxt.config.ts:22`

If cdnjs is compromised, arbitrary CSS could be served (and via CSS
injection, potentially XSS).

**Fix:** add `integrity="sha384-..."` and `crossorigin="anonymous"` to
the link tag, OR self-host the icon set.

### 25. LOW — DB pool never drained on shutdown

**File:** `layers/base/server/utils/db.ts:25-31`

`pg.Pool` created with `max: 20, idleTimeoutMillis: 30_000`, but
`pool.end()` never called. No `process.on('SIGTERM' | 'SIGINT')`
handler anywhere in the codebase.

Only matters for graceful shutdown / clean test teardown. Docker
SIGKILLs after the configured grace period anyway.

**Fix:** Nitro plugin `process.on('SIGTERM', async () => { await pool.end(); })`.
~10 lines, same place to add Redis `.quit()`.

### 26. LOW deferred — enrichUser DB query per request, no cache

**File:** `layers/base/server/middleware/auth.ts:62-78`

Every authenticated API request and every SSR page load runs
`SELECT role, username, status FROM users WHERE id = $1`. Both prod
sites are at single-digit req/s; this is not currently a bottleneck.
Becomes one at multi-instance scale-out.

**Fix:** cache the enriched user fields in-memory keyed by userId with
60s TTL, OR move `role/username/status` into Better Auth's
`additionalFields` so they're embedded in the session.

### 27. LOW — ~50-60 `console.*` calls in production paths

97 total console.* sites; ~50-60 are actionable for migration to
`createStructuredLogger`. The rest are intentional fallbacks
(`structuredLogger.ts:62` circular-ref fallback, `redis/logger.ts`
default sink, `email.ts` ConsoleEmailAdapter, plugin lifecycle logs).

**Fix:** bulk find-replace; ride along when in the affected file.

### 28. LOW — `view.post.ts` setInterval — no `.unref()`

**File:** `layers/base/server/api/content/[id]/view.post.ts:8`

`setInterval(..., 120_000)` at module load with no clearing. The
`recentViews` Map is bounded by the 5-min cleanup window so memory is
fine, but the interval holds the event loop on shutdown.

**Fix:** add `.unref()`. One line.

### 29. LOW — S3 creds fall back to empty string

**File:** `packages/infra/src/storage.ts:208-209`

`process.env.S3_ACCESS_KEY ?? ''` and `?? ''` — if `S3_BUCKET` is set
but credentials are missing, every upload fails with
`InvalidAccessKeyId` instead of failing fast at adapter init.

**Fix:** throw at `createStorageFromEnv` if bucket is set but creds
are missing.

### 30. LOW — Lint: 85 `no-unused-vars` warnings

Mostly stale imports in tests. The load-bearing one (`wasPublished`)
is item #15 above. Rest is noise.

**Fix:** one-shot cleanup PR.

## Findings — LIKELY (3)

These would require running the system to convert to CERTAIN. The fixes
remain correct conservative choices.

- **L1** Redis healthcheck "passes coincidentally on NOAUTH". I'm ~80%
  confident based on standard `redis-cli` exit-code semantics, but
  haven't run it. The fix in #9 is correct either way.
- **L2** Sharp megapixel-bomb is exploitable in practice. Haven't
  actually demoed a 50000² PNG against a running upload route. The fix
  in #3 (`limitInputPixels`) is correct.
- **L4** DNS-rebind in #6 is exploitable under the *current* deployment
  topology. Bounded by HTTPS-only enforcement on image-proxy and the
  fact that internal services aren't on port 80/443. As deployment
  evolves, this can become live.

## Withdrawn claims (10)

Recorded so future audits don't re-flag them:

- **W1** S3 `ACL: 'public-read'` is HIGH. **Withdrawn:** all upload
  paths in the codebase are intentionally public; federation requires
  fetchable URLs. Not a bug.
- **W2** Inbox accepts any signed activity. **Withdrawn:** correct AP
  design.
- **W3** `activities` table needs UNIQUE on AP id. **Withdrawn:**
  derived tables enforce idempotency where it matters.
- **W4** Multi-write paths are HIGH. **Withdrawn:** bounded by DB
  UNIQUE constraints and Postgres atomic counter SQL.
- **W5** Sessions need a `revoked` column. **Withdrawn:** Better Auth
  uses expiry + delete, not revocation.
- **W6** `structuredLogger.ts` ↔ `security.ts` duplication is MED.
  **Withdrawn:** intentional, documented in code comment.
- **W7** Layer hex-fallback colors (`var(--green, #22c55e)`) violate
  CLAUDE.md. **Withdrawn:** tokens always resolve when CSS loads
  correctly; CLAUDE.md rule applies to `@commonpub/ui` and
  `@commonpub/docs` (both clean).
- **W8** HTTP-signature digest soft-fallback is HIGH. **Withdrawn:**
  practically requires broken TLS to exploit; LOW defense-in-depth at
  most.
- **W9** `requireAuth` doesn't check `user.status` — bypass for
  suspended users. **Withdrawn:** admin suspension cascades to session
  deletion at `admin.ts:341-344`.
- **W10** CRLF injection in email subjects. **Withdrawn:** nodemailer
  and Resend strip CRLF from headers automatically.

## Recommended PR scope

> **Status post-implementation (session 135):** items 1–7 below are
> ✅ landed in the working tree (uncommitted). Items 5, 14 (mobile),
> 21, 22 from the LOW list are also done. See
> `docs/sessions/135-audit-fixes.md` for the full implementation log
> and `135-handoff-prompt.md` for the suggested commit breakdown.

**Single PR, half a day of focused work, all real wins:**

1. ✅ `image-proxy` SSRF + body cap (#1, #2) — ported existing
   `safeFetch` redirect-revalidation pattern via new `safeFetchBinary`
   helper; streaming size cap shared.
2. ✅ `safeFetch` streaming size check (#5) — refactored to share
   `streamBoundedBody` with `safeFetchBinary`.
3. ✅ `limitInputPixels: 100_000_000` for `sharp()` (#3).
4. ✅ `isPrivateUrl(objectUri)` in `inboxHandlers.ts:1261` (#4).
5. ✅ Replace 3 `.catch(() => {})` in `delivery.ts:179, 181, 188`
   with structured-log emits (#11).
6. ✅ Notification dedup via UNIQUE — migration
   `0003_notifications_dedup.sql`. Implemented as try-INSERT-then-
   UPDATE-on-23505 rather than `ON CONFLICT DO UPDATE` because PGlite
   rejects the latter even with a literal unique index. Schema
   declared as `uniqueIndex` not `unique('name').on(...)` because
   drizzle-kit's `pushSchema` (used by the test harness) silently
   drops table-level CONSTRAINT statements. Both quirks documented in
   `docs/llm/gotchas.md`.
7. ✅ SSE per-user connection cap (#8) — module-level `Map<userId, count>`.

**Verified by tests:** items 1, 2, 5, 6 have new vitest coverage
landed alongside the implementation:

- 7 new tests in `packages/server/src/__tests__/import-ssrf.test.ts`:
  redirect re-validation, streaming size cap, contentType return,
  redirect-chain limit, plus a regression guard for `safeFetch`
  sharing the streaming path.
- 4 new tests in `packages/server/src/__tests__/notification.integration.test.ts`:
  collapses repeated social notifications, marking-read-then-refire,
  system notifications don't dedup, different actors don't collide.

**Separate, deployment-side (still TODO):**

8. Redis healthcheck auth (#9) — needs scp to droplet (compose-sync gap).

**Pre-OAuth-enablement (still TODO, dormant):**

9. Migration `000N_oauth_account_columns.sql` (#13) — only if/when
   GitHub or Google OAuth is enabled. Numbering will continue from
   the next free index after 0003.

**Already in handoff (#28):** the deploy.yml compose-file sync.

**Mobile work continuing (#9 in 134 handoff):** ✅ all three landed
this session — `pages/admin/federation.vue`,
`pages/admin/api-keys.vue`, `pages/federation/users/[handle].vue`
each got a `@media (max-width: 768px)` block. The remaining audit
candidate `pages/docs/[siteSlug]/edit.vue` (630 lines, editor-only)
is unchanged — lower priority.

## Audit methodology — for next time

Nine rounds is excessive. Three rounds with this rigor would have
gotten 90% of the value:

- **Round 1:** broad parallel-agent crawl of every package. Useful but
  agents over-claim — every "HIGH" needs verification.
- **Rounds 2–4:** verify and downgrade. The bulk of withdrawn findings
  came from this.
- **Rounds 5–8:** target specific surfaces (UI, signatures, schema,
  routes). New findings drop sharply by round 6.
- **Round 9:** diminishing returns confirmed. Zero new MED+ findings.

For future audits: do one broad pass with parallel agents, then
*verify each HIGH/MED claim against current code* before accepting.
The Round 1 → Round 3 verification cycle was the highest-value work.
