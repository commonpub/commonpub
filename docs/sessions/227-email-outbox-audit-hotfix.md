# Session 227 — Email outbox audit + hotfix (SHIPPED)

Adversarial review of the just-shipped email Phase 1 (`docs/sessions/227-email-phase1-outbox.md`)
before building Phase 2/3 on top of it. Net: architecture sound (token security, claim
atomicity, auth-mail bypass, pref-merge all verified clean), but found one real P1 + a P2
worth hardening. Fixed both. **infra 0.10.1 / server 2.97.1 / layer 0.86.11** (patch, no
schema/migration). Email still OFF in prod → zero behavior change.

## Verified clean (no change needed)
- **Multi-replica claim**: `FOR UPDATE SKIP LOCKED` survives drizzle's `inArray`-subquery
  serialization (single atomic UPDATE) — confirmed by rendering the SQL + a new regression
  test. The earlier tests couldn't prove this (PGlite is single-connection → SKIP LOCKED is
  a runtime no-op).
- HMAC unsubscribe token (constant-time, length-checked, not forgeable/replayable);
  `/api/unsubscribe` merges prefs (no clobber); HTML/header escaping; `shouldEmailNotification`
  honors `unsubscribedAll` + digest mode + verified; auth mail bypasses the outbox.

## Fixed
### P1 (real, mail loss) — partial-batch success was marked entirely `sent`
Resend's `/emails/batch` returns `200 { data: [{id}, ...] }` with one entry per ACCEPTED
message; individual messages can be rejected inside a 200. The old `sendBatch` returned
`void` and the drain marked the whole chunk sent → rejected messages silently dropped (and
on a 5xx-after-partial, the whole chunk would re-send → duplicates).
- `EmailAdapter.sendBatch` now returns `EmailSendResult[]` (one per message, in order).
  Resend attributes per index (`data[i].id` present ⇒ accepted, else rejected); SMTP/Console
  attribute per send. A thrown error still means a transport failure (whole chunk retried).
- `drainEmailOutbox` marks ONLY the `ok` rows sent and reschedules/dead-letters the rest
  individually — no silent loss, no blind whole-chunk resend.

### P2 (hardening) — cross-replica lock-expiry double-send on a long/slow tick
- Added a **30s HTTP timeout** (`EMAIL_HTTP_TIMEOUT_MS`, `AbortSignal.timeout`) to the Resend
  calls so a hung request can't outlive its row lock.
- **Clamp the tick** so its worst-case duration stays under the 5-min lock TTL
  (`maxPerTick ≤ maxChunks × batchSize`, `maxChunks = floor(LOCK_TTL / (per-call-budget + gap))`).
  Default 200/tick is unaffected; a pathological large `maxPerTick` is clamped.
- mark-sent / reschedule UPDATEs now guard on `status='sending'` so a row reclaimed by
  another replica mid-tick isn't stomped.

## Deferred (documented, not bugs)
- Digest builds all messages in memory + one big insert + N+1 `listNotifications` — a scale
  refinement (paginate); digests are once/day over the small verified+opted-in subset.
- Backoff "6 attempts = 5 retries" is correct-as-intended.
- Messages export is sender-only — correct (matches the deletion cascade; received DMs are
  the other party's data).

## Tests
- infra **158** (+3: Resend `sendBatch` partial attribution, transport-failure throw,
  Console `sendBatch` all-ok; the `send` test now allows the `signal` option).
- server **1513** (+2: partial-batch drain attribution, `FOR UPDATE SKIP LOCKED` SQL
  emission regression guard). layer **1417**, typecheck **28/28**.

## Release / roll
- Published infra 0.10.1 → server 2.97.1 (pins infra 0.10.1) → layer 0.86.11 (pins server
  2.97.1). The layer MUST be republished so the consumer-side layer plugin re-pins the fixed
  server (its `drainEmailOutbox`/adapter resolve to the layer's pinned server). No migration.
- Rolled to all 3 (deveco/heatsync pins + lockfiles).
