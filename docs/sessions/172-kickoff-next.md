# Resume prompt — CommonPub (after session 171)

Paste everything between the `---` rules as the FIRST message when you come back.
Session 171 overhauled + shipped the **contest feature** and is in a clean,
published, deployed state on the two instances we directly operate. One
follow-up (heatsynclabs.io) is pending a deploy-source decision — see below.

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
- **heatsynclabs.io** — ⚠️ **NOT updated.** Still on layer 0.24.0. It is a live
  CommonPub/Nuxt deploy (Caddy + `x-powered-by: Nuxt`, `contests:true`) but its
  deploy SOURCE is not discoverable: no repo under `virgilvox` pins
  `@commonpub/layer` (all 60 scanned), and `virgilvox/heatsync-org` now holds
  only a Vite SPA (`heatsync-website`) on `main`. Likely a server-side checkout or
  a repo under an org I can't see. **To finish: get the heatsynclabs.io deploy
  repo/path, bump its pins to layer `^0.26.0` + schema `^0.19.0` + server
  `^2.60.0`, `pnpm install` (regen lockfile — watch
  [[feedback-pnpm-install-drops-files]]), push.** It runs the OLD (leaky) contest
  code until then — non-trivial given contests is on.

## Verify the state

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do echo "  $u home=$(curl -s -o /dev/null -w '%{http_code}' $u/) contests=$(curl -s $u/api/features | grep -o '\"contests\":[a-z]*')"; done
npm view @commonpub/layer version   # expect 0.26.0
npm view @commonpub/schema version  # 0.19.0
npm view @commonpub/server version  # 2.60.0
```

## Resumable work (pick any)

- **Finish heatsynclabs.io** (above) once the deploy source is known.
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
