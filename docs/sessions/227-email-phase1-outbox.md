# Session 227 — Email Phase 1 + 1b: durable outbox + unsubscribe (SHIPPED)

Implemented Phase 1 + 1b of `docs/plans/email-comms-overhaul.md` — the foundational
email-delivery pipeline that Phases 2 (templates) and 3 (broadcast) build on. Chosen
queue tech: **Postgres `email_outbox`** (the user's decision; BullMQ deferred to the
scaling tier). **Zero prod behavior change**: email is OFF on all 3, and the worker is
gated by the same `emailNotifications` flag.

## What shipped — schema 0.51.0 / infra 0.10.0 / server 2.97.0 / layer 0.86.10, migration 0036

### The problem
The send path was one synchronous `fetch` per recipient with no queue, batching,
throttle, or retry. Resend caps at 5 req/s, so a digest/broadcast to thousands would
429 and silently drop mail.

### Phase 1 — durable outbox (separation of concerns: producer vs worker)
- **schema** (`comms.ts`, its OWN module — not jammed into social.ts): `email_outbox`
  table (status pending→sending→sent/failed, attempts, lastError, scheduledAt,
  claimedAt/lockExpiresAt, headers jsonb; index on (status, scheduledAt)). Migration
  **0036**, additive. `user_id` nullable + cascade.
- **infra**: `EmailAdapter.sendBatch()` (Resend `/emails/batch`, ≤100/call; SMTP/Console
  loop) + optional `EmailMessage.headers`.
- **server** (`comms/outbox.ts`): `enqueueEmail`/`enqueueEmails` (producers) +
  `drainEmailOutbox(db, adapter, opts)` (the worker core): claims a batch with
  `FOR UPDATE SKIP LOCKED` + a 5-min lock expiry (crash-safe, multi-replica-safe),
  sends via `sendBatch`, throttles to `maxBatchesPerSecond` (default 5), retries with
  exponential backoff (2^n min, cap 1h), dead-letters at `maxAttempts` (default 6).
  Pure-ish (injectable clock + sleep) → unit-testable.
- **layer**: new `email-outbox.ts` Nitro plugin drains on an interval (default 8s, tunable
  via `NUXT_EMAIL_*` runtimeConfig) with a re-entrancy guard; `notification-email.ts`
  refactored to **enqueue** (instant + digest) instead of looping `adapter.send`. Auth
  mail (verify/reset) intentionally still sends directly (low-volume, latency-sensitive).

### Phase 1b — unsubscribe (CAN-SPAM / GDPR)
- **server** (`comms/unsubscribe.ts`): stateless HMAC tokens over the userId with
  AUTH_SECRET (no storage, not enumerable, constant-time verify).
- `users.emailNotifications.unsubscribedAll` (jsonb, no migration; validator updated);
  `shouldEmailNotification` + the digest loop both honor it. Auth mail stays exempt.
- Every notification/digest email gets a visible footer **Unsubscribe** link (page,
  scope choice) + a one-click `List-Unsubscribe` / `List-Unsubscribe-Post` header (API).
- **layer**: `POST /api/unsubscribe` (token-auth, merges prefs, works cross-origin — the
  CSRF middleware only guards cookie-auth requests) + a public `pages/unsubscribe.vue`.

## Tests
- Server (+10, suite **1511**): outbox drain — success+chunking, throttle gap, retry→
  backoff→dead-letter, future-scheduled skip, stale-lock reclaim
  (`email-outbox.integration.test.ts`); unsubscribe token round-trip / wrong-secret /
  tamper / swapped-id / malformed (`unsubscribe-token.test.ts`).
- Layer (+5): unsubscribe page (digest/all/error states) + route contract (token-auth,
  not session-auth, merges prefs). Infra 155, full typecheck **28/28**.
- **Live** (docker pg :5433 + nuxt dev, email ENABLED + console adapter): a real follow
  enqueued a `notification` outbox row → the worker drained it to `sent` with the
  `List-Unsubscribe` header → one-click POST `/api/unsubscribe` set `unsubscribedAll`
  (merged, not clobbered) → a re-follow produced NO new row (suppressed); invalid token
  → 400.

## Release / roll
- Published schema 0.51.0 → infra 0.10.0 → server 2.97.0 → layer 0.86.10 (server pins
  infra 0.10.0; layer pins schema 0.51.0 + server 2.97.0). Migration **0036** additive.
  Rolled to all 3 (deveco/heatsync pins + lockfiles). **No flags changed; email stays
  OFF in prod** — the outbox + worker are inert until an operator enables email.

## Decisions
- Postgres outbox (consistent with the repo's worker pattern) over BullMQ; the enqueue
  API is forward-compatible if the drain is swapped later.
- Auth mail bypasses the outbox (direct send) — low volume, user is waiting.
- HMAC unsubscribe token (no DB column); coarse per-chunk retry on batch failure (no
  mail lost; documented).

## Next (per `docs/plans/email-comms-overhaul.md`)
- Phase 2: customizable email templates + admin editor (instance_settings `email.branding`).
- Phase 3: admin broadcast (depends on this outbox + unsubscribe + a broadcast template).
- Then GDPR Phase 2 (re-acceptance gate + logged-in cookie record).
- CLI pins still stale; re-pin on the next CLI bump (now schema ^0.51 / server ^2.97 /
  infra ^0.10 / layer ^0.86.10).
