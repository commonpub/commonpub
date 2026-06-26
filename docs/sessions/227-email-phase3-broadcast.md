# Session 227 — Email Phase 3 (admin broadcast) + outbox audit fix #3 (SHIPPED)

Phase 3 of `docs/plans/email-comms-overhaul.md`: an admin can compose and send an email
to all users / a role / specific users, via the durable outbox. Bundled with a third
outbox correctness fix from this turn's audit. **schema 0.53.0 / config 0.25.0 / infra
0.12.0 / server 2.99.0 / layer 0.88.0, migration 0037**. The `adminBroadcast` flag
defaults OFF; email stays OFF in prod.

## Audit (this turn, of the Phase 2 / outbox-fix-#2 code)
My own review of the per-chunk lock renewal (fix #2) found it renewed only the CURRENT
chunk's lease, so on a many-chunk tick a LATER chunk's rows could still expire before the
worker reached them → reclaim window. Fixed: renew ALL still-in-flight claimed rows
(`status='sending'`) before each chunk, so every outstanding row's lease stays fresh while
the worker is alive. Also hardened the email-branding preview iframe with `sandbox=""`
(scripts blocked; the content is already trusted + escaped).

## Phase 3 — admin broadcast
- **schema 0.53.0** (migration 0037, additive): `broadcasts` audit table (subject, body,
  cta, audience jsonb, recipientCount, sentById set-null); `broadcast.send` permission
  (auto-granted to admin via `*`); `broadcastInputSchema` + `broadcastAudienceSchema`
  (strict: subject/body required, CTA needs both label + http(s) url or neither, audience =
  `'all'` | `{role}` | `{userIds<=1000}`).
- **config 0.25.0**: `features.adminBroadcast` (default OFF). Added to the reference app's
  `ENV_FLAG_MAP` (`FEATURE_ADMIN_BROADCAST` / `NUXT_PUBLIC_FEATURES_ADMIN_BROADCAST`) and
  `layers/base/nuxt.config.ts` `runtimeConfig.public.features` so env-override + the client
  `useFeatures()` know it. (deveco/heatsync forks: enable via the `/admin/features` toggle —
  the DB-override path works for any flag without a config.ts change.)
- **infra 0.12.0**: `emailTemplates.broadcast` — plain-text body rendered as escaped
  paragraphs + an optional themed CTA button; honors branding + unsubscribe. No
  operator-supplied HTML, so no injection surface.
- **server 2.99.0**: `sendBroadcast` (audience targeting; recipients are always
  `email_verified` AND not `unsubscribedAll` via a SQL filter; per-recipient one-click
  unsubscribe; enqueues to the outbox in 500-row chunks; writes the audit row),
  `countBroadcastRecipients`, `listBroadcasts`. Plus the outbox renewal-all fix.
- **layer 0.88.0**: `POST /api/admin/broadcast` (adminBroadcast flag + `broadcast.send`),
  `POST /api/admin/broadcast/recipients` (count), `GET /api/admin/broadcast` (history);
  `pages/admin/broadcast.vue` composer (subject/body/CTA, audience all/by-role/specific via
  the `/api/admin/users` search, live recipient count, **confirm-before-send**, history);
  admin sidebar "Broadcast" link + Features-page flag meta. Email-preview iframe sandboxed.

## Tests (solid coverage)
- **schema 491** (+10: broadcast input + audience validators — all/role/userIds, half-CTA,
  non-http CTA, strict, length).
- **server 1521** (+4: sendBroadcast targeting all/role/userIds + verified/unsubscribe
  exclusions + unsubscribe header + audit row; count matches send).
- **layer 1442** (+7: broadcast route contract — flag + permission + validation; composer
  page — count-on-mount, confirm-then-send, disabled-until-filled; RBAC route-key
  completeness for the 3 new routes).
- infra 162, config 25, typecheck **28/28**.
- **Live** (docker pg + nuxt dev, email + adminBroadcast ON, console adapter): recipient
  count → send 'all' (50 accumulated verified users) → outbox broadcast rows EXCLUDE the
  unsubscribed + unverified, INCLUDE verified member/staff; email HTML carries subject + CTA
  button + CTA url + unsubscribe link; audit row recorded; by-role staff count = 1. Composer
  screenshot verified (with the history list).

## Release / roll
- Published schema 0.53.0 → config 0.25.0 → infra 0.12.0 → server 2.99.0 (pins schema
  0.53.0 + infra 0.12.0) → layer 0.88.0 (pins schema 0.53.0 + server 2.99.0). Migration
  0037. Rolled to all 3 (deveco/heatsync pins schema/config/server/layer + lockfiles).
  `adminBroadcast` OFF by default; email OFF in prod.

## Decisions
- Body is plain text + optional validated CTA (no operator HTML) — zero injection surface;
  rich-text is a future enhancement.
- Recipients filtered at SQL level (verified + not-unsubscribed); enqueue chunked at 500.
- `email.manage` (branding) and `broadcast.send` are distinct permissions.

## Next
- GDPR Phase 2 (re-acceptance gate + logged-in cookie record) — the last planned item.
- CLI pins stale (re-pin schema ^0.53 / config ^0.25 / server ^2.99 / infra ^0.12 / layer ^0.88).
