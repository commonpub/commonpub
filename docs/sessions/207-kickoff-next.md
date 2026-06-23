# Session 207 — kickoff / handoff (next)

Date: 2026-06-19
Prepared at the end of session 206 (monolith splits + a deep verification audit).

> Companion docs: `docs/STATUS.md` (operator runbook — current as of 203-204),
> `docs/sessions/206-monolith-split-docs-autosave.md` (this session's work),
> `docs/sessions/205-kickoff-next.md` (prior handoff),
> `docs/sessions/203-full-codebase-audit.md` + `204-deep-audit-round2.md` (the merged audit).

---

## Where things stand

**commonpub.io is healthy and LIVE on the sessions 203-204 audit remediation** (merge
`d32e773f`, deploy run `27812795608` ✅, smoke passed, migrations 0026/0027 applied). Verified
this session: health/features/content routes 200; the two audit-P1 fixes confirmed live
(`events?hubId=notauuid` → 400, `content?limit=abc` → 400, both formerly 500). STATUS.md is
already accurate for 203-204; no edit needed. **deveco.io / heatsynclabs.io are NOT rolled** —
nothing was published this cycle (see backlog item 1).

**Active branch: `monolith-splits`** (NOT pushed, NO PR — per user direction, all remaining
work continues on this branch). Built this session, all green, NOT deployed/published:

| Commit | Change |
|---|---|
| `6f0c7f65` | docs editor autosave → `useEditorAutosave` composable (edit.vue 1434→1397; 11 tests) |
| `2ea0a50b` | ProjectView block parsers → `projectBlocks` util (ProjectView 1656→1522; 16 tests) |
| (pending) | TOC slug fix + stale-comment nit (audit Finding 3 below) + this handoff |

Gate status on the branch: full layer suite **1105/1105 green**, `nuxt typecheck` (vue-tsc
strict) **clean**. That completes the "monolith splits" backlog item (both named targets).

---

## Deep audit (session 206) — 3 parallel agents, findings adversarially re-verified

The 7-round 203-204 audit **holds up**: no P0s, no new security holes. The branch refactors are
behavior-faithful. Three correctness findings surfaced (all verified against source):

### NEW — Finding 1 (P1, recommended next action): `likeRemoteContent` non-transactional like race
`packages/server/src/federation/timeline.ts:225-281` (route `layers/base/server/api/federation/like.post.ts`).
A local user liking REMOTE federated content runs `SELECT existingLike` → `localLikeCount + 1`
→ `insert(activities)` on **bare `db`, no transaction, no unique constraint** backing the dedup.
Two concurrent likes (double-click/retry) both pass the check → counter double-incremented **and**
two duplicate outbound `Like` activities federated. The counter drift is **unrecoverable** (this
path is not in `reconcile-counters.mjs`). Exact shape the audit fixed in `toggleFederatedHubPostLike`
/ `onLike` — but this path was missed.
- **Fix:** wrap check+increment+insert in `db.transaction`; add a `unique(type,actorUri,objectUri,direction)`
  index + `onConflictDoNothing`, increment only when a row was actually inserted. Mirror the audit's
  `toggleFederatedHubPostLike` fix. Test with the real-Postgres concurrency harness
  (`packages/server/src/__tests__/helpers/realpgdb.ts`) so it goes RED on revert.
- **Adjacent (lower sev):** `boostRemoteContent` (timeline.ts:286) has **no dedup at all** — every
  boost queues another Announce. Worth folding into the same fix.

### NEW — Finding 2 (P2, latent): 10 hand-rolled limit clamps repeat the `??`-misses-NaN footgun
`Math.min(opts.limit ?? N, 100)` in `search/contentSearch.ts:71,140`, `social/social.ts:184`,
`admin/admin.ts:136`, `federation/timeline.ts:71,447`, `federation/federation.ts:919`,
`hub/moderation.ts:159,282`, `messaging/messaging.ts:37`. The 203 fix only hardened
`normalizePagination`; these hand-roll their own clamp. `Number('abc') ?? 50 = NaN` → `LIMIT NaN`
→ 500. **Not currently live** — every route feeding them validates with `z.coerce.number().max(100)`
at the edge (400s bad input first). But it's a footgun for any future route. **Fix:** route all 10
through `normalizePagination`, or `Number.isFinite(...) ? clamp : N`.

### FIXED this session — Finding 3 (P2): ProjectView TOC anchors diverged from rendered ids
`extractTocEntries` (in the newly-extracted `projectBlocks.ts`) stripped HTML *before* slugging,
but `BlockHeadingView.vue:6` (the renderer) and `ArticleView.vue:37` slug the **raw** text — so a
heading containing literal HTML produced a TOC `id` ≠ the rendered `<h2 id>`, breaking the link +
scroll-spy. Pre-existing (the extraction was byte-faithful); fixed in the pending commit:
`extractTocEntries` now slugs raw text for the `id` (keeps stripped text as the label), with a test
asserting it matches the renderer. **Follow-up (not done):** the cleaner long-term fix is to share
one `headingSlug` source across `BlockHeadingView` + `ArticleView` + `projectBlocks` and decide once
whether HTML is stripped — currently 3 copies of the slug regex agree by convention only.

### Documented, no fix needed — two low-severity autosave drifts (Finding from diff review)
The `useEditorAutosave` extraction has two observable-but-arguably-better changes vs the old inline
code (so the commit's "behavior preserved" is slightly overstated): (a) a `refreshPages()` failure
now leaves the page dirty/error instead of clean (more correct; largely theoretical since the
`useFetch` refresh resolves-with-error rather than throwing); (b) the new re-entrancy guard makes
`selectPage`'s save-before-switch non-blocking when an autosave is already in flight (no data loss —
the in-flight PUT already captured its body). Both sit in the untested page-level seam.

---

## Backlog (fact-checked against source this session)

1. **Roll security fixes to deveco/heatsync** — STILL OPEN. Nothing published this cycle.
   **Corrected publish chain (only changed packages, in dependency order):**
   `schema → protocol → server → infra → explainer → layer`.
   - Changed `src` in the audit merge (verified `git diff d32e773f^1 d32e773f`): schema (23),
     server (34/40), protocol (3), infra (4), **explainer (2: htmlExporter.ts + sectionRenderer.ts —
     the XSS fix)**, plus layer (layers/base, 92).
   - NOT changed / skip: ui, config, auth, theme-studio, learning (no src). `docs` = package.json-only.
     **`editor` = test-file-only since 0.7.12** (`parser.test.ts` timeout bump, no dist impact) — skip.
   - Then bump deveco/heatsync pins (hand-edit caret-on-0.x won't cross minors) + regenerate BOTH
     lockfiles per consumer (deveco's npm lock gitignored, heatsync's tracked), bump CLI `template.rs`
     + `tests/cli.rs`, `cargo publish`. Their deploys apply migrations 0026/0027 via their
     `db-migrate.mjs`; their deploy health is WARN-ONLY → curl-verify. Layer via `pnpm run publish:layer`.
   - Outward-facing (npm publish hard to reverse) — needs explicit go-ahead.
2. **Homepage 3-path consolidation** — STILL OPEN. Three render paths in `layers/base/pages/index.vue`:
   `v-if="layoutEngineActive"` (:135, LayoutSlot), `v-else-if="hasCustomSections"` (:148), `v-else`
   (:184, **legacy hardcoded fallback**). `layoutEngineActive = flag && homepageLayout !== null` (:29-31),
   so removing the `v-else` without a seeded layout = blank homepage. 2-phase deploy: `POST
   /api/admin/layouts/seed-homepage` on all 3 first (idempotent; `…/server/api/admin/layouts/seed-homepage.post.ts`),
   flip `layoutEngine` on, THEN remove the fallback.
3. **user-block feature** — STILL OPEN / does not exist (verified: no table, no routes, no enforcement;
   the only "blocked" in code is instance-level registry blocking). Net-new; needs UX decisions
   (block scope, federation behavior, UI placement) before building. Enforcement surfaces: messaging
   (`server/api/messages/*`, `packages/server/src/messaging/*`), social (`server/api/social/*`), follow.
4. **pg_trgm search index** — reverted/DONE (zero refs anywhere; search uses Postgres FTS + `ilike`
   fallback, no relevance ranking, in `packages/server/src/search/contentSearch.ts`). To re-add: the
   PGlite contrib extension won't load in the layer vitest runtime (`a.arrayBuffer is not a function`) —
   needs a portable load or a prod-only raw migration with a documented drift exception. Ops decision.
5. **megalodon SSRF TOCTOU residual** — guard in place (`assertPublicHost` DNS-resolve, fail-closed, at
   `mastodonFactory.ts:87` + `mastodonLogin.ts:138,242`); residual is the check-then-connect rebinding
   window (full fix = pinned axios transport). **Flag-gated OFF in prod** (all `identity.*` sub-flags
   default false, confirmed false on live `/api/features`; entry routes gated on
   `identity.signInWithRemote`). Low priority.

---

## Suggested next steps (in priority order)
1. **Fix Finding 1 (P1)** on `monolith-splits` — tx-wrap `likeRemoteContent` (+ dedup `boostRemoteContent`),
   test via the real-Postgres concurrency harness. Highest-value, well-scoped, known fix shape.
2. **Finding 2 (P2)** — route the 10 clamps through `normalizePagination` (cheap, removes the footgun).
3. Then a backlog item (1-5) per user decision. The deveco/heatsync roll (item 1) is the highest user
   value (security reaches the other instances) but is the outward-facing one.

## Repo conventions / landmines (unchanged)
Mutation-test bar (a fix needs a test that goes RED on revert); real-Postgres harness needs a reachable
PG (docker :5433 / CI) with `describe.skipIf` otherwise; committed migrations only (never `db:push`);
never deploy deveco/heatsync without curl-verifying (warn-only health); CLAUDE.md standing rules (no AI
co-author in commits, flags for features, `var(--*)` only, TS strict, no em dashes in user-facing copy).
