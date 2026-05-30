# Resume prompt — CommonPub (after session 172)

Paste between the `---` rules as the FIRST message when you return. The contest
feature is overhauled, hardened, audited, fully tested, and LIVE on all three
instances. Clean state — pick up anything below when ready.

---

Fresh Claude Code session on the CommonPub monorepo
(`/Users/obsidian/Projects/ossuary-projects/commonpub`). commonpub.io builds from
workspace `main`; deveco.io (`ossuary-projects/deveco-io`) + heatsynclabs.io
(`heatsynclabs/heatsynclabs-io`, local `~/Projects/heatsync/heatsynclabs-io`) are
npm consumers. **No AI attribution in commits. pnpm (never npm) for publishing.**

## Latest published + live (sessions 171–172)

- `@commonpub/schema@0.20.0`, `@commonpub/server@2.61.0`, `@commonpub/layer@0.27.0`.
- Migrations through **0007** (0006 = contest `judging_criteria`; 0007 = contest
  `eligible_content_types` + `max_entries_per_user`).
- **All three instances live + verified**: `/`, `/contests`, `/api/contests` 200;
  `contests: true`; judge-score leak closed; self-vote blocked.

## Contest feature state (complete)

Judges live in `contest_judges` (the `contests.judges` jsonb is dead). Score
privacy via `shouldRevealScores(visibility, status, privileged)`. Customization:
prizes (place AND/OR category), judging-criteria rubric, judging visibility,
community voting (+ Community-Choice on results), eligible content types, max
entries per user. Tabbed detail + phase timeline. Lifecycle FSM
upcoming→active→judging→completed (+cancelled); `RANK()` ranking on completion.

## Verify the state

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do echo "  $u home=$(curl -s -o /dev/null -w '%{http_code}' $u/) contests=$(curl -s $u/api/features | grep -o '\"contests\":[a-z]*') api=$(curl -s -o /dev/null -w '%{http_code}' $u/api/contests)"; done
npm view @commonpub/layer version   # 0.27.0
```

## ⚠️ heatsync deploy — read before ANY schema bump

heatsynclabs.io syncs schema with `npm run db:push -- --force` (NOT migrations),
which crashes on the `contest_entries` UNIQUE-constraint TTY prompt and the
`| tee` pipe masks the failure → green deploy, but new columns are NOT applied →
`/api/contests` 500. **After every `@commonpub/schema` bump, apply the new
column(s) manually** (droplet `167.99.13.109` = `commonpub-heatsynclabs`, key
`~/Projects/heatsync/heatsynclabs-io/secrets/ci_deploy_ed25519`, app `/opt/commonpub`):
```bash
ssh -i <key> root@167.99.13.109 'cd /opt/commonpub && docker compose -f docker-compose.prod.yml exec -T postgres sh -lc "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c \"ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <c> <type>;\""'
```
Also: regenerate heatsync's `package-lock.json` ONLY on linux (a macOS lock drops
`oxc-parser`'s linux-x64-musl binding → alpine build fails) — prefer leaving the
committed lock and letting the Dockerfile's `npm install` reconcile.
See `[[feedback-heatsync-dbpush-ci-fragile]]`.

## Resumable work

- **Operator: fix heatsync's deploy permanently** — move off `db:push --force` to
  the committed-migration runner (`db-migrate.mjs`; baseline existing schema in
  `__drizzle_migrations` first) + add `set -o pipefail`. Eliminates the recurring
  manual ALTER above.
- **Contest follow-ups:** per-criterion scoring (vs single 1–100), participants
  tab, contest discussion board, transaction-safe `judgeScores` jsonb update.
- Layout-engine Part A/B/C still open (see `170-kickoff-next.md`).

## Conventions reminder

Publish via `pnpm publish:layer` / per-package `pnpm --filter … publish`. Poll
`npm view` before bumping a dependant. `^0.x` caret does NOT cross minors — bump
pins by hand. Always `curl /` (not just `/api/health`) after a deploy. **`curl
/api/features` for flag truth.**

---
