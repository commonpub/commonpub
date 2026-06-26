# Plan — Email & Communications Overhaul

> **Status: COMPLETE (session 227).** All phases (1+1b outbox/unsubscribe, 2 branding, 3 broadcast)
> + 3 outbox audit fixes + a maintainability refactor SHIPPED + ROLLED to all 3. Email remains OFF in
> prod (operator must wire a Resend secret). Detail: `docs/sessions/227-email-*.md`.

> Created 2026-06-25 (session 227). Companion analysis:
> `docs/reference/email-gdpr-scaling-analysis.md` §2–5. This is the master plan for
> making CommonPub's email layer production-grade at scale and adding operator
> communication tools. Four phases, three release boundaries. The GDPR/terms work is
> a separate plan (`docs/plans/gdpr-consent-hardening.md`); the two share nothing
> except the spirit of compliance.

## Why (current state, verified)

- Email is **OFF on all 3 instances** (`emailNotifications=false` live; adapter
  defaults to `console`; no deploy workflow wires a Resend/SMTP secret). So all of this
  is greenfield-safe: nothing changes for users until an operator turns email on.
- The send path (`packages/infra/src/email.ts` + `layers/base/server/plugins/
  notification-email.ts`) is **one synchronous `fetch` per recipient — no queue, no
  batching, no throttle, no retry**, running in-process on the single web replica.
- Resend caps at **5 req/s**; a digest/broadcast to thousands would blow past it →
  429s → and with no retry, **emails are silently dropped**. This is the #1 risk and
  gates everything else.
- No per-email unsubscribe (only "manage preferences in settings") → not CAN-SPAM/GDPR
  compliant for bulk mail.
- Templates are hardcoded inline-HTML; only `siteName` is interpolated — not
  operator-customizable.
- No admin way to email specific users or everyone.

## Goals

1. A reliable, throttled, batched, retrying email send pipeline that scales (Phase 1).
2. RFC-compliant unsubscribe for all non-transactional mail (Phase 1b).
3. Operator-customizable email branding + copy with a live-preview admin editor (Phase 2).
4. Admin broadcast: compose + send to all / by-role / specific users, safely (Phase 3).

## Non-goals

- Turning email ON in production (operator decision; this makes it *ready*).
- Full WYSIWYG email design (Phase 2 is branding + copy overrides, not a drag editor).
- Replacing the in-process worker model wholesale / adopting BullMQ now (noted as the
  scale-tier alternative; see Open decisions).
- Marketing-list/contact management, A/B testing, open/click analytics.

---

## Phase 1 — Email send-path hardening (FOUNDATIONAL)

Everything else depends on this. No user-visible change while email is off.

### Design: a Postgres-backed outbox + a throttled batch worker

Chosen to stay consistent with the repo's existing "Postgres table + interval worker +
multi-replica claim" pattern (federation delivery, digest, scheduled-publishing). BullMQ
is the scale-tier alternative (see Open decisions) but is a larger architectural change.

**Schema (migration NNNN, additive):**

```ts
// packages/schema/src/social.ts (near digest_runs) or a new comms.ts
export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  toEmail: varchar('to_email', { length: 255 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // null for non-user mail
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text'),
  category: varchar('category', { length: 32 }).notNull(), // 'notification'|'digest'|'broadcast'|'auth'
  status: varchar('status', { length: 16 }).notNull().default('pending'), // pending|sending|sent|failed
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).defaultNow().notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  lockExpiresAt: timestamp('lock_expires_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('idx_email_outbox_claim').on(t.status, t.scheduledAt)]);
```

**Adapter (`packages/infra/src/email.ts`):** add `sendBatch(messages: EmailMessage[])`
to the `EmailAdapter` interface. `ResendEmailAdapter.sendBatch` → `POST
https://api.resend.com/emails/batch` (up to 100/call). SMTP/Console fall back to a
sequential loop. Keep `send()` for the auth fast-path.

**Enqueue (`@commonpub/server`):** `enqueueEmail(db, msg)` / `enqueueEmails(db, msgs[])`
bulk-inserts into `email_outbox`. Refactor the call sites:
- Instant notifications (`notification.ts` sender) → `enqueueEmail` (category
  `notification`).
- Digest (`notification-email.ts`) → builds N messages, `enqueueEmails` (category
  `digest`) instead of looping `send`. This decouples assembly from delivery and fixes
  the 5/s problem.
- **Auth emails (verify/reset) stay on the direct `send()` fast-path** — low volume,
  user is waiting, must not be delayed by a worker tick. (Alternative: enqueue with a
  high-priority short interval; direct is simpler and lower-risk.)

**Worker (`layers/base/server/plugins/email-outbox.ts`, new Nitro plugin):**
- Interval ~5–10s (config). Gated by `emailNotifications` like the other email worker.
- Claim a batch: `UPDATE email_outbox SET status='sending', claimedAt=now(),
  lockExpiresAt=now()+5min WHERE id IN (SELECT id FROM email_outbox WHERE
  status='pending' AND scheduledAt<=now() ORDER BY scheduledAt LIMIT :n FOR UPDATE SKIP
  LOCKED) RETURNING *`. `SKIP LOCKED` = clean multi-replica claim (the pattern the
  scaling doc recommends; introduce it here).
- **Throttle:** a token bucket sized to `email.maxSendsPerSecond` (default 5, matches
  Resend). Each tick sends at most `interval × rate` emails, grouped into
  `email.batchSize` (default 100) `sendBatch` calls.
- **Retry/backoff:** on 429 or 5xx, `status='pending'`, `attempts++`,
  `scheduledAt = now() + backoff(attempts)` (exponential, cap ~6 attempts). On
  permanent failure or max attempts → `status='failed'`, `lastError` set (dead-letter,
  visible to admin in Phase 3). On success → `status='sent'`, `sentAt`.
- A stale-lock reclaim (lockExpiresAt passed) so a crashed replica's claimed rows retry.

**Config (`packages/config`):** `email.maxSendsPerSecond` (default 5),
`email.batchSize` (default 100), `email.workerIntervalMs` (default 8000),
`email.maxAttempts` (default 6). (Under an `email` config group, sibling to existing
email runtime config.)

**Tests (TDD, real PG + mocked adapter):** enqueue writes rows; worker claims with SKIP
LOCKED (no double-send across two concurrent claims); throttle caps per-tick volume;
batch groups ≤100; retry reschedules on simulated 429; dead-letter after maxAttempts;
stale-lock reclaim; auth path still sends directly.

### Phase 1b — Unsubscribe (ships with Phase 1)

**Token:** HMAC over `userId` with `AUTH_SECRET` (`unsubToken = base64url(userId) + '.'
+ hmac`). No storage/migration needed; not enumerable. (Alternative: a
`users.unsubscribe_token` column — only if rotation is wanted.)

**Prefs:** extend `users.emailNotifications` type with `unsubscribedAll?: boolean`
(JSONB, no migration). When true, suppress digest + instant + broadcast (auth mail
exempt).

**Route:** public `GET /unsubscribe?token=…` → verify HMAC → page offering "unsubscribe
from digests" / "unsubscribe from all". `POST` confirms → sets `digest:'none'` and/or
`unsubscribedAll:true`. RFC 8058 one-click: a `POST` endpoint for `List-Unsubscribe-Post`.

**Headers + footer:** every non-transactional email (`category` notification/digest/
broadcast) gets a `List-Unsubscribe` + `List-Unsubscribe-Post` header (Resend supports
custom headers) and a visible unsubscribe link with the per-recipient token. `wrapTemplate`
gains an `unsubscribeUrl` param; the enqueue path computes it per recipient. Auth emails
get neither.

**Tests:** token sign/verify (tamper → reject); unsubscribe sets prefs; one-click POST;
suppression honored by the worker (skip `unsubscribedAll`); auth mail has no
unsubscribe; digest/broadcast do.

### Phase 1 release

Bump `schema` (email_outbox + migration), `infra` (sendBatch), `config` (email group),
`server` (enqueue + worker logic), `layer` (worker plugin + unsubscribe route + digest
refactor). Additive migration. No behavior change while `emailNotifications` off.

---

## Phase 2 — Customizable email templates

Depends on Phase 1's template touch points. Operator branding + copy, not WYSIWYG.

**Storage:** `instance_settings` key `email.branding` (JSONB, **no migration** —
`setInstanceSetting(db, 'email.branding', value, adminId)`, same as `theme.*`). Shape
`EmailBranding`: `{ accentColor?, headerText?, logoUrl?, footerText?, introOverrides?:
{ digest?, notification? } }`.

**Refactor:** `wrapTemplate(siteName, body, branding?)` and each template accept the
branding and fall back to current hardcoded defaults. Custom copy supports a fixed token
allowlist (`{siteName}`, `{username}`, `{items}`, `{unsubscribeUrl}`) and is run through
the existing `escapeHtml` / a sanitizer so operator input can't inject markup.

**Admin editor (`layers/base/pages/admin/email-templates.vue`):** edit branding + per-
template subject/intro; **live preview** rendering the real email HTML with sample data
in an iframe/preview pane (the codebase already produces email HTML). Follows the
`admin/features.vue` / theme-editor pattern. Gated by a new `email.manage` permission
(add to `PERMISSIONS` in `packages/schema/src/permissions.ts`; auto-granted to admin via
`*`). Server: `GET/PUT /api/admin/email-branding` (reuse `setInstanceSetting`).

**Tests:** overrides applied in rendered output; default fallback when unset; token
sanitization (injected `<script>`/HTML neutralized); preview endpoint renders; permission
gate.

**Release:** `schema` (permission key only — no table), `server` (template params +
branding read), `layer` (admin editor). `instance_settings` needs no migration.

---

## Phase 3 — Admin broadcast

Depends on Phase 1 (queue/throttle), 1b (unsubscribe), 2 (a broadcast template + the
`email.manage`/branding plumbing).

**Schema (migration NNNN):** `broadcasts` table — `id, subject, bodyHtml, bodyText,
audienceSpec jsonb, sentById uuid→users(set null), recipientCount int, status, createdAt`.
For audit + the admin history list. (Or reuse `audit_logs`; a dedicated table is cleaner
for the list UI + recipient count.)

**Permission + flag:** add `users.notify` to `PERMISSIONS` (auto-admin via `*`; seed to
staff if desired). Add `features.adminBroadcast` (`z.boolean().default(false)`).

**Server (`@commonpub/server`):** `sendBroadcast(db, { subject, body, audience,
sentBy })`:
- Resolve audience: `'all'` (verified, not `unsubscribedAll`), `userId[]`, or `{ role }`
  (join role assignments). Reuse the digest job's user-select shape.
- Render via the (Phase 2) broadcast template with per-recipient `unsubscribeUrl`.
- `enqueueEmails` (category `broadcast`) — the Phase 1 worker drains it throttled. NO
  synchronous blast.
- Optionally also `createNotification(type:'system')` for in-app delivery.
- Insert a `broadcasts` audit row with `recipientCount`.

**Route:** `POST /api/admin/broadcast` gated by `requireFeature('adminBroadcast')` +
`requirePermission(event, 'users.notify')`. A `GET .../recipients/count` for a pre-send
estimate.

**UI (`layers/base/pages/admin/broadcast.vue`):** compose (subject + markdown/HTML body
using the existing editor or sanitized textarea), audience picker (all / by-role / pick
users via the existing contest-style user-search), live recipient count, preview, send +
a list of past broadcasts. Quick-action card on the admin dashboard.

**Compliance:** only `emailVerified`; exclude `unsubscribedAll`; always include the
unsubscribe link (bulk mail). Auth/transactional remain exempt.

**Tests:** permission + flag gates; audience targeting (all/role/specific) excludes
unverified + unsubscribed; correct enqueue count; broadcast row recorded; unsubscribe
link present; in-app system notification created when opted.

**Release:** `schema` (broadcasts + permission + migration), `config` (flag), `server`
(sendBroadcast), `layer` (admin UI). Flag default OFF.

---

## Master sequencing & release boundaries

1. **Release 1 = Phase 1 + 1b** (foundational pipeline + unsubscribe). Ship together.
2. **Release 2 = Phase 2** (customizable templates).
3. **Release 3 = Phase 3** (admin broadcast).

Each is a full publish + roll-to-3 per the STATUS runbook (schema→config→infra→server→
layer, PR+squash to main, deveco/heatsync pins + both lockfiles, CLI re-pin,
curl-verify). All migrations additive; all new flags default OFF; **no behavior change
until an operator enables email**. The GDPR plan can run in parallel (independent).

## Open decisions (confirm before building)

1. **Queue tech (the big one): Postgres `email_outbox` + throttled worker (recommended,
   consistent with repo) vs Redis/BullMQ (more scalable, new infra).** Recommend
   Postgres now; BullMQ when an instance actually approaches the scaling-doc's 10k–100k
   tier (it's listed there as a "top 5" change). The outbox design is forward-compatible
   — swapping the drain mechanism later doesn't change the enqueue API.
2. **Auth emails: direct send (recommended) vs enqueue with high priority.** Direct keeps
   signup/reset latency low and de-risks the auth flow.
3. **Unsubscribe token: HMAC (no storage, recommended) vs stored column (rotatable).**
4. **Broadcast body input: markdown (safer, recommended) vs raw HTML (powerful, needs the
   existing rich-HTML sanitizer).**
5. **Whether to enable email in prod at all after this lands** — purely operator's call;
   the work only makes it safe to.

## Effort estimate

- Phase 1 + 1b: ~1.5–2 sessions (1 migration, adapter batch, enqueue refactor of 3 call
  sites, the worker, unsubscribe route + headers, thorough concurrency/throttle/retry
  tests).
- Phase 2: ~1 session (template param refactor, branding storage, admin editor + preview).
- Phase 3: ~1–1.5 sessions (broadcast fn + audience targeting, route, admin UI, audit
  table, tests).

Total ~3.5–4.5 focused sessions across 3 releases.
