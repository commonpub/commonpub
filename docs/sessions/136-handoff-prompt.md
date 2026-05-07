# Session 136 → 137 Handoff

Fresh Claude Code context. Session 136 shipped session 135's audit
fixes to prod (commonpub.io + deveco.io) across 11 commits and 5
package publishes, hotfixed a wrong Font Awesome SRI hash in the same
session, ran a deep audit verifying runtime behavior on both prod
sites, and drafted a comprehensive design doc for cross-instance
delegated authorization (extending the v1 SSO).

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Re-emphasize:
   - Never add Claude as co-author / Signed-off-by / any AI
     attribution to commits, in any repo.
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`.
   - Feature flags in `commonpub.config.ts` for any new behavior.
2. `docs/sessions/136-deploy.md` — what shipped this session,
   pre/post-deploy verification, the SRI hotfix surprise, deveco
   bump rationale.
3. `docs/sessions/136-cross-instance-identity-design.md` — the
   forward-looking design (this is the substantive read for 137 if
   the next session continues that thread).
4. `docs/sessions/135-audit.md` + `135-audit-fixes.md` — only if
   you need backstory on 0.19.x's contents.
5. `docs/llm/gotchas.md` "Session 135 — audit-fix invariants" —
   eight invariants future sessions must not regress.

## Current state (2026-05-06, end of session 136)

| Site         | Versions live | Migration count | Notes |
|--------------|---------------|-----------------|-------|
| commonpub.io | schema 0.15.0, server 2.48.0, infra 0.6.3, layer 0.19.1 | 4 | from-source build; Caddy body-cap manually scp'd |
| deveco.io    | schema 0.15.0 (top), layer 0.19.1, server 2.47.2 (top) + 2.48.0 (transitive via layer) | 4 | from-npm build |

Working trees: clean, both repos. Origin sync: in sync.

**Verified runtime behavior at end of session 136:**
- `uq_notif_user_type_actor_link` index present on both DBs with
  correct column order `(user_id, type, actor_id, link)`.
- Migration hashes byte-identical across both DBs.
- Drizzle schema-drift check clean.
- `pnpm install --frozen-lockfile` no-op.
- Live SSRF defense returns 403 for `https://10.0.0.1`,
  `https://127.0.0.1`, `https://169.254.169.254` on both prod sites.
- All e2e tests passing (caught the SRI bug; greenlit the hotfix).
- Bundles contain new code (greppable distinctive strings present).
- No errors in last 200 log lines on either container.

## Open items

### From 135 audit, not yet shipped

- **Redis healthcheck auth (audit #9).** `deploy/docker-compose.prod.yml`
  uses `redis-cli ping` without `-a $REDIS_PASSWORD`. Fix needs scp
  to commonpub.io (deveco's Redis has no password, fine as-is).

  ```yaml
  test: ['CMD-SHELL', 'redis-cli -a "$$REDIS_PASSWORD" ping | grep -q PONG']
  ```

- **Schema-duplicate cleanup on next package bump.** When
  `auth/docs/explainer/learning/protocol` next bumps, switch their
  `@commonpub/schema` pin from `^0.14.3` to `workspace:*` (resolves
  to `^0.15.x` at publish). For `docs/explainer/protocol`, drop the
  dep entirely — declared but not imported. Net: deveco-io ends up
  with one schema version on next round.

- **deveco-io's `@commonpub/server` direct pin** stays at `^2.47.2`.
  Bumping to `^2.48.0` would dedupe with the transitive copy. Not
  urgent. Fold into the next deveco bump.

- **Compose-sync gap (134-#3).** `deploy/Caddyfile` and
  `deploy/docker-compose.prod.yml` not auto-synced by
  `.github/workflows/deploy.yml`. Long-term fix: add a sync step.

### From 136 deploy + audit

- **/contests 404 on commonpub.io.** Pre-existing; contests is
  feature-flagged off in commonpub.config. The previous CI e2e
  flagged it only as collateral damage from the SRI bug. Not a new
  issue; mentioned for completeness.

- **e2e suite expects `/contests` to load.** With contests off,
  the test passes by virtue of "no fatal console errors" being
  vacuously true on a 404 page. If contests ever ships on commonpub,
  the test should be revised; if it stays off, the test is
  load-bearing only as a smoke check that the 404 page itself is
  clean. Worth a comment in `apps/reference/e2e/smoke.spec.ts`
  near line 132.

### New from session 136 (cross-instance auth design)

If 137 continues the cross-instance identity thread, the design doc
at `136-cross-instance-identity-design.md` lays out the phased plan.
Phase 0 (today) is what already ships; phase 1 is the next
incremental step. Read it in full before opening any code.

If 137 picks something else, the design doc is forward reference —
no commits required to merge. It can sit as a session-scoped
proposal.

## Lessons recorded as memory

- **Verify load-bearing literal values, don't just spot the line**
  (`feedback_verify_loadbearing_values.md`). The wrong FA SRI hash
  was committed in 135 because static review of the diff confirmed
  the line was present and well-formed but never recomputed the
  hash. Future audits with hash/checksum/SRI/signature literals
  should recompute or cross-reference byte-for-byte.

## Deploy verification commands (worth saving)

Both sites confirmed via:

```bash
# commonpub.io (postgres in container)
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub \
  -c "SELECT count(*) FROM drizzle.__drizzle_migrations" \
  -c "\d notifications"'

# deveco.io (managed PG; no psql in container — use node)
ssh root@deveco.io "docker exec deveco-app-1 node -e \"
  import('pg').then(async ({default: pg}) => {
    const pool = new pg.Pool({ connectionString: process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL, max: 1 });
    const r = await pool.query('SELECT count(*) FROM drizzle.__drizzle_migrations');
    console.log(r.rows);
    await pool.end();
  });
\""

# Live SSRF defense check (both sites)
for h in commonpub.io deveco.io; do
  for ip in 10.0.0.1 127.0.0.1 169.254.169.254; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "https://$h/api/image-proxy?url=https://$ip/x")
    echo "$h via $ip → $code (expect 403)"
  done
done

# Live integrity check (Font Awesome SRI)
curl -sS https://commonpub.io/ | grep -o 'integrity="[^"]*"' | sort -u
# Expect: integrity="sha384-t1nt8BQoYMLFN5p42tRAtuAAFQaCQODekUVeKKZrEnEyp4H2R0RHFz0KWpmj7i8g"
```

## Standing reminders

- **Conventional commits.** `feat(infra):`, `fix(layer):`,
  `chore(release):`, `docs(sessions):`. Atomic.
- **Never add Claude attribution.** No `Co-Authored-By:`,
  `Signed-off-by:`, or AI mention. Anywhere.
- **`pnpm publish`**, never `npm publish`. With `--access public
  --no-git-checks`. Confirm via `npm view @commonpub/<pkg> version`.
- **`pnpm install --frozen-lockfile`** must be a no-op after any
  workspace package.json edit before pushing.
- **Schema migrations** via committed SQL files in
  `packages/schema/migrations/`. Never `drizzle-kit push` in CI.
- **Session logging.** Update `docs/sessions/` with what was done,
  decisions, open questions, next steps.

## Quick reference

- Migration state:
  ```
  ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"'
  ```
- Redis keys (commonpub, password required):
  ```
  ssh root@commonpub.io 'cd /opt/commonpub && PW=$(grep ^REDIS_PASSWORD= .env | cut -d= -f2) && docker exec commonpub-redis-1 redis-cli -a "$PW" --scan --pattern "cpub:*"'
  ```
- Redis keys (deveco, no auth):
  ```
  ssh root@deveco.io 'docker exec deveco-redis-1 redis-cli --scan --pattern "cpub:*"'
  ```
- CI runs latest:
  ```
  gh -R commonpub/commonpub run list --branch main --limit 3
  gh -R devEcoConsultingLLC/deveco-io run list --branch main --limit 3
  ```
- Publish a package:
  ```
  pnpm --filter @commonpub/<pkg> publish --access public --no-git-checks
  ```
  (Requires `npm login` first; 2FA OTP-protected unless using a
  granular access token with bypass-2fa.)
