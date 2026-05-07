# Session 136 — commit + publish + deploy of session 135 audit fixes

Date: 2026-05-06.

Session 135 left a dirty working tree of 52 files (44 mod, 6 new, 2
deleted) gated on a fresh session for review, commit, publish, and
deploy. This session executed all of that. Both prod sites
(commonpub.io and deveco.io) are now running the audit-fix code with
migration 0003 applied and the new UNIQUE index in place.

## What landed

### 9 atomic commits on `commonpub/commonpub` `main`

```
4fd07ef feat(server,infra,layer): SSRF + body-cap + sharp DoS hardening
91e48c6 feat(server): federation delivery hardening — SSRF guard + structured logging
6d66dea feat(schema,server,layer): notification dedup + SSE per-user connection cap
daecc14 feat(layer): useFocusTrap composable for modal a11y
ed85903 feat(layer): mobile responsive for admin/federation pages
fc12ff9 test(server): coverage for safeFetchBinary + notification dedup
8e4526a chore: LOW-severity hygiene cleanup
ed50274 chore(deps): workspace pinning + version bumps
e0d804a docs(sessions,llm): 135 audit + audit-fixes + handoff + gotchas
```

Matches the suggested 9-commit breakdown from `135-handoff-prompt.md`
§1 exactly. No AI attribution.

### 4 packages published to npm

```
@commonpub/schema 0.14.4 → 0.15.0
@commonpub/infra  0.6.2  → 0.6.3
@commonpub/server 2.47.4 → 2.48.0
@commonpub/layer  0.18.3 → 0.19.0
```

### commonpub.io deploy

Push to main triggered `Deploy Production` workflow run 25470096855.
Completed in 6m37s. Migration 0003 applied automatically inside the
running container via `scripts/db-migrate.mjs`.

Pre-deploy state (read-only query):
- `dup_tuples = 0`, `rows_to_delete = 0` — DELETE statement was a
  no-op against prod.
- `migration_count = 3`.

Post-deploy verification:
- `migration_count = 4` ✓
- Indexes on notifications: `notifications_pkey`,
  `idx_notifications_user_id`, `idx_notifications_user_read`,
  `uq_notif_user_type_actor_link` ✓
- `leftover_dups = 0` ✓
- `https://commonpub.io/api/health` → `{"status":"ok"}` ✓

### Caddyfile sync (manual scp, compose-sync gap)

`deploy/Caddyfile` does not auto-sync via `.github/workflows/deploy.yml`
(session 134 open #3). Manually:

```
scp deploy/Caddyfile root@commonpub.io:/opt/commonpub/Caddyfile
ssh root@commonpub.io 'cd /opt/commonpub && docker compose -f docker-compose.prod.yml restart caddy'
```

Caddy came back up in 3s. Health check 200 post-restart. The 128 MB
`request_body { max_size }` cap on the catch-all is now active.

deveco.io has its own separate Caddyfile per session 133 notes — not
mirrored this session.

### deveco-io bump

```
@commonpub/layer  0.18.1 → 0.19.0
@commonpub/schema 0.14.4 → 0.15.0
```

Single commit `1ff9005` on `devEcoConsultingLLC/deveco-io` `main`,
pushed; Deploy Production run 25470452886 completed in 4m15s.
`@commonpub/server` direct pin left at `^2.47.2` (caret already
covers 2.48.0 transitively via layer; deveco's own code does not
import `safeFetch`/`safeFetchBinary`/`isPrivateUrl` directly).

Pre-deploy state:
- `dup_tuples = 0`, `migration_count = 3`.

Post-deploy verification:
- `migration_count = 4` ✓
- `uq_notif_user_type_actor_link` present ✓
- `leftover_dups = 0` ✓
- `https://deveco.io/api/health` → `{"status":"ok"}` ✓

## Decisions made

- **Bumped deveco-io's `@commonpub/schema` pin too**, beyond the
  literal instruction to bump only `@commonpub/layer`. Reason:
  deveco's `scripts/db-migrate.mjs` reads from
  `/app/node_modules/@commonpub/schema/migrations` — the top-level
  resolution. Without bumping the direct schema pin, top-level would
  have stayed at 0.14.4 and migration 0003 would have been invisible
  to the deploy. The handoff's failure-mode-D mitigation explicitly
  prescribes the dual bump; the user's brief promised "their deploy
  will run migration 0003" which only holds with both bumps. Documented
  the rationale in the deveco-io commit message.

- **Did not bump deveco-io's `@commonpub/server` pin.** The existing
  `^2.47.2` caret covers 2.48.0, but pnpm preserves the previously
  locked 2.47.2 at top-level when `pnpm install` doesn't have a
  forcing reason. Layer 0.19.0 transitively pulls server 2.48.0
  alongside, so the layer's runtime gets the new SSRF helpers while
  deveco's direct imports (none of which use the new exports) keep
  using 2.47.2. Two server copies installed — same kind of duplication
  the handoff documents as acceptable for the auth/schema split.

- **Did not bump `@commonpub/auth` / `@commonpub/docs` /
  `@commonpub/explainer` / `@commonpub/learning` / `@commonpub/protocol`
  this session.** Per the handoff's "semver finding worth flagging"
  section, those were edited (workspace-pin switch) but deliberately
  not bumped — their npm-registry artifacts still carry `^0.14.3`
  schema pins. As a result, deveco-io now installs schema 0.14.4
  (transitive via auth 0.5.1) AND schema 0.15.0 (direct + via
  server 2.48.0). Functionally fine; install-size cost only. Cleanup
  recipe is in the handoff for whenever any of those five packages
  next bumps.

## Surprises

- **None on the deploy side.** Both DBs had `dup_tuples = 0`
  pre-deploy, so the migration's DELETE statement was a no-op on both
  sites. Deploy timing was within historical bounds (commonpub 6m37s,
  deveco 4m15s).

- **npm publish required 2FA.** First publish attempt returned
  `403 — Two-factor authentication or granular access token with
  bypass 2fa enabled is required`. User authenticated; the four
  publishes then went through within a single OTP window. Note for
  future sessions: a granular access token with `bypass-2fa` enabled
  in `~/.npmrc` would skip the dance.

- **Wrong Font Awesome SRI hash (caught on the post-deploy CI audit).**
  Session 135 committed `sha384-SZXxX4w…` to `nuxt.config.ts` — but
  the actual cdnjs SHA-384 of `font-awesome/6.5.1/css/all.min.css` is
  `sha384-t1nt8BQ…` (the value `135-audit-fixes.md` and `gotchas.md`
  always cited). Session 135's local gates didn't run e2e against a
  real browser, so the mismatch wasn't caught until the post-deploy
  CI on session 136. Browsers blocked the stylesheet, all Font Awesome
  icons were missing on both prod sites for ~30 min between deploy
  and hotfix. Fix shipped as `@commonpub/layer 0.19.1`:

  - `fix(layer): correct Font Awesome SRI hash` — single-line fix in
    `layers/base/nuxt.config.ts`.
  - `chore(release): @commonpub/layer 0.19.1 + CHANGELOG` — version
    bump + this followup.
  - Pushed → commonpub.io rebuilds from-source, picks up fix.
  - Published 0.19.1 to npm.
  - deveco-io lockfile updated via `pnpm update @commonpub/layer`,
    pushed → deveco.io rebuilds with 0.19.1.

  Lesson for next audit: when verifying a hash/integrity attribute,
  recompute it against the actual file or compare to the documented
  value byte-for-byte. "SRI line is present" is not enough; the value
  is the load-bearing part. Static review of session 135's diff
  spotted the SRI was wired up correctly but didn't catch the wrong
  bytes.

## Open items

- **Redis healthcheck auth fix (audit #9)** — still TODO. Edits to
  `deploy/docker-compose.prod.yml` need scp + container recreate,
  same compose-sync gap as the Caddyfile. Ride along with the next
  deploy session.

- **Cleanup of duplicate `@commonpub/schema` install on deveco-io.**
  When `auth` / `docs` / `explainer` / `learning` / `protocol` next
  bump, switch their `@commonpub/schema` pin from `^0.14.3` to
  `workspace:*` (resolves at publish time to `^0.15.x`). For the
  three that declare-but-don't-import schema (docs, explainer,
  protocol), drop the dep entirely. Net: deveco-io ends up with one
  schema version on next round.

- **deveco-io's `@commonpub/server` direct pin** could stay at
  `^2.47.2` indefinitely or be bumped to `^2.48.0` to deduplicate
  with the transitive copy. Not urgent; fold into the next deveco
  bump if any.

- **CommonPub-side compose-sync gap (134-#3) still open.** The
  Caddyfile body-cap edit is now live on commonpub.io via manual
  scp. Long-term fix is to add a sync step to `deploy.yml` so future
  Caddyfile / compose changes don't require manual ops.

## Reference — exact verification commands

Both runs confirmed via:

```bash
# commonpub.io (postgres in container)
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub \
  -c "SELECT count(*) FROM drizzle.__drizzle_migrations" \
  -c "SELECT indexname FROM pg_indexes WHERE tablename = '\''notifications'\''" \
  -c "SELECT count(*) FROM (SELECT 1 FROM notifications WHERE actor_id IS NOT NULL AND link IS NOT NULL GROUP BY user_id, type, actor_id, link HAVING count(*) > 1) d"'

# deveco.io (managed PG, no psql in container — query via node + pg)
ssh root@deveco.io 'docker exec deveco-app-1 node -e "..."'
# (uses NUXT_DATABASE_URL/DATABASE_URL from container env)
```

The deveco app container has no `psql`; verification uses node + pg
against the same DB connection string the runtime uses. Worth
remembering for future deveco DB inspections.
