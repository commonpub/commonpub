# Resume prompt — CommonPub (after session 174)

Paste between the `---` rules as the FIRST message when you return. The contest
feature is overhauled, hardened, access-controlled, fully tested, and LIVE on all
three instances. Clean state.

---

Fresh Claude Code session on the CommonPub monorepo
(`/Users/obsidian/Projects/ossuary-projects/commonpub`). commonpub.io builds from
workspace `main`; deveco.io (`ossuary-projects/deveco-io`) + heatsynclabs.io
(`heatsynclabs/heatsynclabs-io`, local `~/Projects/heatsync/heatsynclabs-io`) are
npm consumers. **No AI attribution in commits. pnpm (never npm) for publishing.**

## Latest published + live (sessions 171–174)

- `@commonpub/schema@0.22.0`, `@commonpub/server@2.63.0`, `@commonpub/layer@0.29.0`.
- Migrations through **0008** (0006 judging_criteria; 0007 eligible_content_types
  + max_entries_per_user; **0008 contest `visibility` + `visible_to_roles` +
  `contest_stakeholders` table**).
- **All three live + verified**: `/`, `/contests`, `/api/contests` 200.

## Contest feature state (complete)

Lifecycle FSM upcoming→active→judging→completed (+cancelled); `RANK()` on
completion. **Judges** live in `contest_judges` (jsonb is dead); accept flow;
per-criterion rubric scoring → normalized weighted overall; row-locked writes;
**no self-judging**. **Score privacy** via `shouldRevealScores`. **Customization:**
prizes (place AND/OR category), judging visibility, community voting (+
Community-Choice on results), eligible content types, max entries per user.
**Winners alerted** on completion. **Access control (session 174):** `visibility`
(public / unlisted / private — orthogonal to status, changeable any time) +
`visibleToRoles` role-gate + **stakeholders** (named view-only reviewers, managed
on Edit). `canViewContest(db, contest, user)` gates every read endpoint (404 on
block). Public v1 API exposes only `public`. **Participants tab** lists entrants.
Tabbed detail (Overview/Rules/Prizes/Entries/Participants/Judges) + phase timeline.
Delete = `DELETE /api/contests/:slug`; hide = set visibility unlisted/private.

## Verify the state

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do echo "  $u home=$(curl -s -o /dev/null -w '%{http_code}' $u/) contests=$(curl -s $u/api/features | grep -o '\"contests\":[a-z]*') api=$(curl -s -o /dev/null -w '%{http_code}' $u/api/contests)"; done
npm view @commonpub/layer version   # 0.29.0
```

## ⚠️ heatsync deploy — read before ANY schema bump

heatsynclabs.io syncs schema with `npm run db:push -- --force` (NOT migrations),
which crashes on the `contest_entries` UNIQUE-constraint TTY prompt; the `| tee`
pipe masks the failure → green deploy, but new columns/tables/types are NOT
applied → `/api/contests` 500. **After every `@commonpub/schema` bump that adds
DDL, apply it manually** on the droplet (`167.99.13.109` = `commonpub-heatsynclabs`,
key `~/Projects/heatsync/heatsynclabs-io/secrets/ci_deploy_ed25519`, app
`/opt/commonpub`). Robust pattern (clean nested heredocs; container evaluates its
own env):
```bash
ssh -i <key> root@167.99.13.109 'bash -s' <<'OUTER'
cd /opt/commonpub
docker compose -f docker-compose.prod.yml exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' <<'SQL'
-- idempotent DDL: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;
SQL
OUTER
```
(Session 174 applied 0008's `contest_visibility` type + 2 columns + `contest_stakeholders`
this way.) Also: regenerate heatsync's `package-lock.json` ONLY on linux (a macOS
lock drops `oxc-parser`'s linux-x64-musl binding → alpine build fails) — leave the
committed lock; `npm install` reconciles. See `[[feedback-heatsync-dbpush-ci-fragile]]`.

## Resumable work

- **Operator: fix heatsync's deploy permanently** — move off `db:push --force` to
  `db-migrate.mjs` (baseline existing schema in `__drizzle_migrations` first) +
  add `set -o pipefail`. Eliminates the recurring manual DDL above.
- **Remaining additive contest item:** a contest **discussion board** (threaded
  posts + moderation + notifications) — a substantial sub-system, deferred so it
  gets its own focused effort.
- **Global custom roles (open question):** session 174 delivered contest-scoped
  access (visibility + role-gate using the existing 5-role enum + per-contest
  stakeholders), which covers preview-before-publish, role-based visibility, and
  review-only stakeholders. A *global* custom-role/RBAC system (create arbitrary
  named roles, assign, enforce everywhere) is a separate large auth effort — build
  only if explicitly wanted.
- Layout-engine Part A/B/C still open (see `170-kickoff-next.md`).

## Conventions reminder

Publish via `pnpm publish:layer` / per-package `pnpm --filter … publish`. Poll
`npm view` before bumping a dependant. `^0.x` caret does NOT cross minors — bump
pins by hand. Always `curl /` after a deploy. **`curl /api/features` for flag truth.**

---
