# Resume prompt — CommonPub (after session 171)

Paste everything between the `---` rules as the FIRST message when you come back.
Session 171 overhauled + shipped the **contest feature** and is in a clean,
published, deployed, verified state on **all three** instances
(commonpub.io, deveco.io, heatsynclabs.io). One operator follow-up remains:
heatsync's CI uses the fragile `db:push --force` (see the heatsync note below).

---

Fresh Claude Code session on the CommonPub monorepo
(`/Users/obsidian/Projects/ossuary-projects/commonpub`). commonpub.io builds from
workspace `main`; deveco.io is a thin npm consumer at
`ossuary-projects/deveco-io`. **No AI attribution in commits. pnpm (never npm)
for publishing.**

## What shipped in session 171 (contest overhaul — LIVE + verified)

Deep audit + hardening of the entire contest feature, then a bugfix release to a
**live** feature (the `contests` flag is ON, not dormant — `curl /api/features`
showed `contests:true` on all three instances; the OLD code had an
unauthenticated judge-score leak).

- **Unified judges on the `contest_judges` table** (single source of truth). The
  `contests.judges` jsonb is vestigial. End-to-end judging worked via the UI for
  the first time. Wired the accept-invite flow (banners).
- **Closed the judge-score leak** — `includeJudgeScores` is privileged-only;
  aggregate score reveal honours `judgingVisibility` via the pure
  `shouldRevealScores(visibility, status, privileged)` helper.
- **Flexibility:** settable community voting + judging visibility; a
  judging-criteria rubric (migration **0006** = `judging_criteria` jsonb);
  category prizes alongside place-based.
- **UI:** tabbed contest detail (a11y arrow-key tabs), sidebar phase timeline,
  countdown-to-judging-deadline, rubric display, homepage active-only filter.
- **Fixes:** `RANK()` ranking (ties + unscored), date validation, public-v1
  serializer (was always-null deadlines/prizes), `v-model.number` empty coercion.
- **Tests:** server 1146, schema 477, layer 675 (+22 this session, incl. an
  exhaustive `shouldRevealScores` matrix + an endpoint source-contract test).
- **Published:** `@commonpub/schema@0.19.0`, `@commonpub/server@2.60.0`,
  `@commonpub/layer@0.26.0`. Bumped `create-commonpub` pins + deveco pins.

## Live state (verified this session)

- **commonpub.io** — deployed from `main` (workspace), migration 0006 applied,
  smoke passed. `/`, `/api/health`, `/contests`, `/api/contests` all 200.
- **deveco.io** — npm consumer on layer 0.26.0 / schema 0.19.0 / server 2.60.0;
  Deploy Production GREEN, migration 0006 applied. All routes 200. Verified the
  leak is closed: anon `GET /api/contests/edge-ai-challenge-2026/entries?includeJudgeScores=true`
  returns **zero** `judgeScores`.
- **heatsynclabs.io** — LIVE on layer 0.26.0 / schema 0.19.0 / server 2.60.0.
  Repo is `heatsynclabs/heatsynclabs-io` (org, not `virgilvox` — hence the
  earlier miss); local checkout `~/Projects/heatsync/heatsynclabs-io`. Droplet
  `commonpub-heatsynclabs` = `167.99.13.109`, key
  `secrets/ci_deploy_ed25519`, app at `/opt/commonpub`. All routes 200,
  leak closed.
  - ⚠️ **heatsync deploy is fragile — read before the next schema change.** Its
    deploy does `npm run db:push -- --force` (NOT migration files like
    commonpub/deveco). For this release push **crashed** (it wanted to add the
    `contest_entries_user_content` UNIQUE constraint to a populated table →
    interactive truncate prompt → "Interactive prompts require a TTY"), and the
    `… | tee /tmp/dbpush.log` pipe **masked the failure** (pipeline exit = tee's
    0, no `set -o pipefail`), so the run went GREEN while `judging_criteria` was
    never added → `/api/contests` 500. Fixed by applying migration 0006's
    statement directly on the droplet:
    `docker compose -f docker-compose.prod.yml exec -T postgres sh -lc 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "ALTER TABLE contests ADD COLUMN IF NOT EXISTS judging_criteria jsonb;"'`.
    Also: a macOS-regenerated `package-lock.json` dropped `oxc-parser`'s
    linux-x64-musl native binding and broke the alpine build — keep the
    committed (linux-correct) lock and let `npm install` reconcile the
    `@commonpub` bump. **Operator follow-up:** move heatsync off `db:push --force`
    in CI to the committed-migration runner (`db-migrate.mjs`, baseline the
    existing schema first) and add `set -o pipefail` so failures stop being
    silent. See `[[feedback-heatsync-dbpush-ci-fragile]]`.

## Verify the state

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do echo "  $u home=$(curl -s -o /dev/null -w '%{http_code}' $u/) contests=$(curl -s $u/api/features | grep -o '\"contests\":[a-z]*')"; done
npm view @commonpub/layer version   # expect 0.26.0
npm view @commonpub/schema version  # 0.19.0
npm view @commonpub/server version  # 2.60.0
```

## Resumable work (pick any)

- **Operator: harden heatsync's deploy** — move off `db:push --force` to the
  committed-migration runner + add `set -o pipefail` (heatsync note above).
- **Contest follow-ups:** per-criterion scoring (vs single 1–100), a participants
  tab, surfacing community-vote counts in results, a contest discussion board,
  transaction-safe `judgeScores` jsonb update (current read-modify-write can drop
  a concurrent judge's update — low risk with small panels).
- Layout engine Part A/B/C from `171-kickoff-next` predecessor
  (`170-kickoff-next.md`) still open.

## Conventions reminder

- Publish ONLY via `pnpm publish:layer` / per-package `pnpm --filter … publish`
  (npm publish ships `workspace:*` literals). Poll `npm view` before bumping a
  dependant. `^0.x` caret does NOT cross minors — bump pins by hand. Always
  `curl /` (not just `/api/health`) after a deploy. **`curl /api/features` for
  flag truth — never trust the build-time default.**

---
