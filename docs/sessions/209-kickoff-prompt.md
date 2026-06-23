# Kickoff prompt — paste this to start the next session

> A ready-to-paste prompt for carrying the `monolith-splits` work forward. Full status is in
> `docs/sessions/209-kickoff-next.md`; the UI/UX audit is `208-ui-ux-functionality-audit.md`; the
> deep-audit findings are `207-kickoff-next.md`. Copy everything below the line.

---

Kickoff — continue the commonpub work on branch `monolith-splits` (in `commonpub/commonpub`).

CONTEXT. The branch is **17 commits ahead of main, fully green (layer suite 1109 tests, `nuxt
typecheck` clean), adversarially self-audited, but NOT pushed / NO PR / NOT deployed / NOT published.**
It holds three bodies of work: (1) two TDD refactors — `useEditorAutosave` (from docs `[siteSlug]/edit.vue`)
and `projectBlocks.ts` (from `ProjectView.vue`); (2) a verified deep audit of the live 203/204 deploy;
(3) a 7-agent UI/UX + functionality audit (`docs/sessions/208-ui-ux-functionality-audit.md`) plus its
Phase A+B remediation — search "Most Liked" 400 fix, API-keys publicApi gate, "I Built This" hydration,
error-as-empty fixes on 6 listings, follower/following shape + viewer-follow-state fix, full a11y pass
(ProjectView tablist, SearchSidebar buttons, layout-palette keyboard insert, all 7 forms' labels
associated), and misc toast/state polish. The server-package changes (schema sort enum, listContent/
contentSearch orderBy, listFollowers `viewerId`) were audited as purely additive + consumer-safe.
commonpub.io is LIVE on 203/204; deveco.io/heatsynclabs.io are not rolled.

FIRST — re-confirm the branch is still green before deciding anything:
1. `git -C <repo> log --oneline main..HEAD` (expect 17 commits, newest `df40f6b7`), `git status` (clean).
2. `cd layers/base && pnpm exec vitest run` (expect 1109 pass) and `cd apps/reference && pnpm typecheck`
   (expect EXIT 0). If a `packages/*` type was touched, rebuild it first (`pnpm --filter @commonpub/<pkg>
   build`) so the layer typecheck sees it.

THEN — the decision is how to LAND this branch (ask me if unsure; this is outward-facing):
- **Merge → deploy commonpub.io**: push `main` (deploy.yml runs on push; `pipefail` migration gate +
  hard-fail smoke). Verify no new migration is needed this cycle. Ships all UX/a11y fixes live. Then
  `curl https://commonpub.io/api/health` + `/api/features` + a content route, and exercise one fixed
  flow (search "Most Liked", a project's "I Built This", a followers list).
- **Roll to deveco/heatsync** (separate, outward-facing — needs my go-ahead): publish changed packages
  in dependency order, bump consumer pins + CLI. The 203/204 SECURITY fixes ALSO still need this roll.
  Follow `docs/STATUS.md` runbook; confirm the changed-package set against the diff.

NEXT WORK (pick per priority / my direction — each its own focused, tested effort):
- **P1 (highest-value correctness)**: fix `likeRemoteContent` non-transactional like race in
  `packages/server/src/federation/timeline.ts:225-281` (tx + unique index + `onConflictDoNothing`; also
  `boostRemoteContent` has no dedup). Test via the real-Postgres harness. Details in `207-kickoff-next.md`.
- **P0 UX gap**: hub invite UI — invite-only/approval hubs are currently unjoinable (no invite UI). Needs
  a UX decision (generate/list/revoke + redeem flow). Details in `208`.
- Other Phase C (decisions/features): hub member-mgmt + ban UI, video sort+category admin, product
  edit/delete UI, learning completion read-back, homepage 3-path consolidation, RBAC `useCan` admin
  chrome. Plus a latent P2: route the 10 hand-rolled `Math.min(limit ?? N,100)` clamps through
  `normalizePagination`.

RULES / LANDMINES (MUST follow):
- Tests-first, **mutation bar**: a fix needs a test that goes RED when reverted. PG is reachable in this
  env so real-Postgres integration tests run locally; use `describe.skipIf` for portability.
- The Edit tool needs a prior **Read** of each file (a Bash `grep`/`sed` does NOT register it).
- Committed migrations only (never `db:push`). commonpub.io deploys on push to main. **Never deploy
  deveco/heatsync without curl-verifying** (their deploy health is warn-only).
- CLAUDE.md: **no AI co-author / `Co-Authored-By` in any commit**; no feature without a flag; `var(--*)`
  only (no hardcoded colors/fonts); TS strict; **no em dashes in user-facing copy**; `cpub-` class prefix.
- `dist/` is gitignored — don't commit build artifacts.
- **Adversarially verify** agent findings AND your own work against source before claiming done. This
  session, that caught a silently-failed `grep` (which had me add a duplicate function) and a
  self-introduced undo-stack desync — both before they shipped.

ultrathink
