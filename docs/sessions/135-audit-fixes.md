# Session 135 — nine-round audit + audit-fix PR set

Date: 2026-05-05.

This session has two artefacts: the audit (`135-audit.md`) and this
implementation log. The audit ran nine rounds, each verifying the
prior; the implementation landed all CERTAIN findings worth shipping
this week as five discrete change sets in one working tree.

CI status: all 30 turbo tasks green. 912+ unit/integration tests
pass; one new dedup-aware S3 test added. Lint warnings dropped 85 →
82 (three dead-imports/`wasPublished` cleared).

## What changed

### PR 1 — image-proxy + safeFetch + sharp DoS hardening

Closes both HIGH findings (image-proxy SSRF via `redirect: 'follow'`
and unbounded body when Content-Length missing) plus the sharp
megapixel-bomb.

- `packages/server/src/import/ssrf.ts` — added `safeFetchBinary`,
  refactored `safeFetch` and the new helper to share a
  `streamBoundedBody` that aborts mid-read when over the size cap.
  Falls back to `arrayBuffer()` when `response.body` is unavailable
  (test mocks, HEAD responses) — production paths always use the
  streaming path.
- `packages/server/src/index.ts` — exported `safeFetch`,
  `safeFetchBinary`, `isPrivateUrl`, `SafeFetchOptions`.
- `layers/base/server/api/image-proxy.get.ts` — replaced the inline
  `fetch(url, { redirect: 'follow' })` + Content-Length check with a
  single `safeFetchBinary(url)` call. Kept the upfront HTTPS-only
  check as defense-in-depth on top of safeFetchBinary's own
  `isPrivateUrl` validation. Maps `'private or reserved'` /
  `'Too many redirects'` errors to 403 and `'Response too large'` to
  502 so callers can distinguish them.
- `packages/infra/src/image.ts` — `limitInputPixels: 100_000_000`
  on both `sharp(data, ...)` calls in `processImage`. Caps decoded
  bitmap memory at ~400 MB.

### PR 2 — federation delivery hardening

- `packages/server/src/federation/inboxHandlers.ts:1259-1264` — added
  `isPrivateUrl(objectUri)` guard before the federated-Note
  dereferencing fetch. Even mirrored-hub actors can't make us a
  confused-deputy SSRF vector for internal services.
- `packages/server/src/federation/delivery.ts:179, 181, 188` —
  replaced 3 `.catch(() => {})` swallows on circuit-breaker DB writes
  with structured-log emits via
  `createStructuredLogger({ component: 'federation-delivery' })`.
  One JSON line per failed write to stdout.

### PR 3 — notification dedup + SSE connection cap

- `packages/schema/src/social.ts` — added UNIQUE constraint
  `uq_notif_user_type_actor_link` on
  `(user_id, type, actor_id, link)`. Postgres NULL-distinct semantics
  handle system notifications (no actor + no link) without dedup —
  social notifications dedup naturally because both columns are
  always populated.
- `packages/schema/migrations/0003_notifications_dedup.sql` (new) +
  `meta/0003_snapshot.json` + journal entry.
- `packages/server/src/notification/notification.ts:200-260` —
  dedup is implemented as try-INSERT, on Postgres unique-violation
  error code `23505` retry as UPDATE. Avoids `ON CONFLICT … WHERE`
  partial-index inference because PGlite (the test DB) rejects it
  even with a literal full UNIQUE constraint (verified by 35 failing
  tests during round-3 of implementation). The try/catch approach is
  portable across Postgres + PGlite, preserves the
  bump-`createdAt`-and-reset-`read` semantics on dedup.
- `layers/base/server/api/realtime/stream.get.ts` — module-level
  `Map<userId, count>` enforces 10-connection cap per user. Returns
  429 over the cap. Decrement runs in the existing `cleanup()`
  function alongside interval clearing and unsubscribe.

### PR 4 — modal a11y refactor

- `layers/base/composables/useFocusTrap.ts` (new) — focus trap, Esc
  to close, body scroll lock, focus restoration, modeled on the
  `<Dialog>` component's behaviour from `@commonpub/ui`. Used as
  `useFocusTrap(dialogRef, () => props.show, handleClose)` from any
  modal's `<script setup>`.
- `layers/base/components/ImportUrlModal.vue`,
  `RemoteFollowDialog.vue`, `ContentPicker.vue` — wired in. The
  fourth modal-y component, `CookieConsent.vue`, is a banner not a
  modal (no overlay, no focus capture intent) and is left as-is.

The plan considered fully refactoring each modal to wrap `<Dialog>`,
but that would have lost the per-modal header styling (e.g.,
`ImportUrlModal`'s file-import icon) and was higher-risk than this
composable approach that preserves the existing visual design.

### PR 5 — LOW hygiene

Mechanical cleanups for the audit's LOW backlog. All changes are
small and independent:

- `.gitignore` — added `design-system-v2/` (Figma archive that's
  been showing up in `git status` since session 105).
- `deploy/migrations/` — deleted (orphan SQL files predating the
  session-128 baseline migration; CI uses
  `packages/schema/migrations/`).
- `layers/base/nuxt.config.ts` — `app.head.htmlAttrs = { lang: 'en' }`
  (WCAG 3.1.1) and Font Awesome SRI integrity hash
  (`sha384-t1nt8BQ…` for cdnjs's 6.5.1 build). Real hash, computed
  via `curl … | openssl dgst -sha384 -binary | openssl base64 -A` —
  not a placeholder.
- `layers/base/layouts/default.vue` — skip-to-content link with
  visible-on-focus `:focus` styles (WCAG 2.4.1).
- `layers/base/server/api/content/[id]/view.post.ts` — `.unref()` on
  the cleanup `setInterval` so it doesn't hold the event loop on
  shutdown.
- `packages/infra/src/storage.ts` — `createStorageFromEnv` throws
  fast when `S3_BUCKET` is set without `S3_ACCESS_KEY`/`S3_SECRET_KEY`.
  Also one new test, one existing test updated to set credentials
  explicitly.
- `packages/server/src/search/contentSearch.ts:75-82` — escape `\`
  and `"` in user-supplied Meilisearch filter values. No current
  exploit (drafts aren't indexed) but defense-in-depth.
- `packages/server/src/content/content.ts:575` — removed the dead
  `wasPublished` variable + comment.
- `packages/server/src/federation/messaging.ts:12-13` — removed
  unused `buildCreateActivity, contentToNote` imports.
- `codebase-analysis/README.md` — added a stale-as-of-session-125
  banner pointing readers at the latest `docs/sessions/` log.
- `deploy/Caddyfile` — 128 MB `request_body { max_size }` cap on the
  catch-all handler. (Inbox routes already had a 1 MB cap.)

The 3 `it.skip` integration tests flagged in the audit (#18) turned
out to already have explanatory comments — `messaging.integration.test.ts:104-105`,
`hub.integration.test.ts:147` both note PGlite limitations and
"skip until real Postgres test DB". Withdrawn from the cleanup.

## Version bumps

PRs 1-5 are coordinated workspace-internal — `apps/reference`,
`apps/shell`, and `layers/base` switched their `@commonpub/*` deps
from `^x.y.z` to `workspace:*` so local typecheck/build resolves to
workspace packages instead of the previously-cached npm versions.

| Package              | From   | To     | Reason |
|----------------------|--------|--------|--------|
| `@commonpub/server`  | 2.47.4 | 2.48.0 | new exports: `safeFetch`, `safeFetchBinary`, `isPrivateUrl` |
| `@commonpub/schema`  | 0.14.4 | 0.15.0 | new migration + UNIQUE constraint |
| `@commonpub/infra`   | 0.6.2  | 0.6.3  | added `limitInputPixels` arg (no API change) |
| `@commonpub/layer`   | 0.18.3 | 0.19.0 | new `useFocusTrap` composable, SSE connection cap, skip-link, lang attr |

Lockfile has been refreshed (`pnpm install --no-frozen-lockfile`)
and verified clean (`pnpm install --frozen-lockfile` re-runs as
no-op).

## Verification

```
pnpm typecheck   # 26/26 green
pnpm lint        # 0 errors, 82 warnings (down from 85)
pnpm test        # 30/30 turbo tasks green; 912+ vitest pass, 3+4 skipped
```

The skipped tests (3 server `it.skip` + 4 infra `redis.integration`)
all have documented reasons (PGlite limits or Redis URL gating). Not
new this session.

## What I deliberately did NOT ship

These are findings from the audit that are real but either dormant,
deferred, or require coordination this session can't provide:

- **Redis healthcheck auth fix** — needs manual scp to droplets (the
  compose-sync gap from session 134's open item #3). Per droplet:
  ```
  scp deploy/docker-compose.prod.yml root@commonpub.io:/opt/commonpub/
  ssh root@commonpub.io 'cd /opt/commonpub && docker compose -f docker-compose.prod.yml up -d --force-recreate redis'
  ```
  But: the audit-recommended fix for healthcheck is in
  `docker-compose.prod.yml` — and I didn't actually edit that file
  this session because the Caddyfile body-cap was higher-leverage
  (defends ALL paths, not just inbox). Add the healthcheck shell-form
  in the next deploy session.

- **OAuth account columns migration (#13)** — dormant; ship before
  enabling GitHub/Google OAuth, never before.

- **`emailVerified` enforcement on mutating actions** — separate PR
  if spam becomes a real problem.

- **DNS-rebind hardening for `isPrivateUrl`** — bounded by current
  deployment topology. Real fix is non-trivial (DNS pre-resolution +
  pinned-IP Dispatcher).

- **`enrichUser` per-request DB query caching** — premature at
  current scale.

- **Graceful-shutdown SIGTERM plugin** — only matters for clean
  multi-instance scale-out.

- **Bulk migration of remaining ~50 `console.*` to structured
  logger** — mechanical; ride along when in the file for other
  reasons.

- **Mobile @media for `pages/admin/federation.vue`,
  `admin/api-keys.vue`, `federation/users/[handle].vue`** — already
  on session 134's open list.

## Decisions worth remembering

- **Notification dedup uses try/catch on 23505, not ON CONFLICT.**
  Drizzle's `onConflictDoUpdate` with `target: [cols]` gets
  `42P10 — no unique or exclusion constraint matching the ON CONFLICT
  specification` from PGlite even when a literal UNIQUE constraint
  exists. Verified through three implementation attempts (partial
  index + `targetWhere`, full index + targetWhere, full index without
  targetWhere). The try/catch path works on both Postgres and
  PGlite; the dedup semantics are identical.

- **Modal a11y went via composable, not Dialog wrap.** Plan called
  for replacing layer modals with `<Dialog>` from `@commonpub/ui`.
  Dialog provides title-and-close-button header, which would have
  forced losing each modal's custom header (icon, custom button
  layout). The `useFocusTrap` composable closes the WCAG 2.1 AA
  gap (focus trap, Esc, scroll lock, focus restore) without the
  visual regression. Worth revisiting if Dialog grows a slot-based
  header API.

- **Workspace pinning over caret pinning.** `apps/reference`,
  `apps/shell`, `layers/base` now use `workspace:*` for
  `@commonpub/server` and `@commonpub/schema` (matching how
  `@commonpub/layer` and `@commonpub/config` were already pinned).
  Prevents the issue where pnpm picked up the previously-published
  npm version (2.47.3) instead of the workspace's local 2.47.4 → 2.48.0.
  At publish time, `pnpm publish` replaces `workspace:*` with the
  current workspace version, so npm consumers see real version
  ranges, not `workspace:*`.

## Files touched

33 files modified, 4 new, 2 deleted. Diff summary:
- `packages/server`: 7 files
- `layers/base`: 8 files
- `packages/schema`: 4 files (incl. migration + snapshot)
- `packages/infra`: 3 files
- `apps/reference`, `apps/shell`: 1 file each
- `deploy/`: 1 mod (Caddyfile), 2 deletes (orphan migrations)
- `docs/sessions/`: 2 new (135-audit.md, this file)
- Repo-root: `.gitignore`, `pnpm-lock.yaml`
