# Session 182 — codebase-analysis deep audit (docs-only)

2026-06-01. Multi-pass exhaustive accuracy audit of the entire `codebase-analysis/`
folder (14 files) plus `CLAUDE.md` and the root `README.md`, verifying every claim
against PRIMARY SOURCE (actual code / migration SQL / package.json / git), not memory.
No code changed — documentation only. ~95 distinct factual corrections; 16 files touched
(691 insertions / 537 deletions).

## Ground truth (verified this session)

- Versions: **schema 0.25.0, server 2.72.0, layer 0.43.3**, config 0.16.0, ui 0.9.2,
  auth 0.7.0, protocol 0.12.0, infra 0.8.0, editor 0.7.11, explainer 0.7.15, learning 0.5.2,
  docs 0.6.3, test-utils 0.5.6. reference 0.5.0, shell 0.1.0.
- Schema: **87 tables, 42 enums, 13 migrations (0000–0012), 125 FKs** (107 cascade / 18 set-null
  / 0 self-ref — self-ref parent cols have NO DB FK), 102 `*Schema` validators, 6 `*FiltersSchema`.
- Layer: **90 pages, 135 components, 34 composables** (non-test), 311 `server/api/` files
  (305 handlers + 6 tests) + 22 AP/site routes, 8 plugins, 11 server middleware, 3 route
  middleware, 17 builtin sections, 10 theme CSS files.
- Server: 25 module dirs + 11 top-level files. **19 boolean feature flags + `identity` (5 sub-flags).**
- **265 git-tracked `*.test.ts` files** (an earlier `find`-based count of 275 was polluted by
  `.stryker-tmp/` sandbox copies — use `git ls-files`).
- 26 ADRs (through 028); 149 session logs (through 181 before this one).

## What the audit corrected (by class)

The original docs were largely accurate for structural shape, but errors clustered in
(a) headline counts that drift each session, and (b) content I had **synthesized from
secondary sources** (drizzle filenames, `facts.md`, memory) instead of reading primary source.

- **Counts/versions** brought current across all files (README banner, 01 version table,
  02/11 headline tables, root README).
- **Migration table (02)** re-derived from the actual `.sql` DDL — several descriptions were
  guessed from filenames and wrong: 0001 is data-only (not a type change), 0004 adds token
  *columns* (the `federated_accounts` table is in baseline 0000), 0006 adds only
  `judging_criteria` (voting/visibility cols are in baseline), 0010=`subheading`,
  0011=`prizes_description`, 0003 is a full (not partial) unique index.
- **Sibling-dir surfaces** were wrong: `@commonpub/editor/vue/` and `@commonpub/explainer/vue/`
  + `explainer/modules/` (10 module types, NOT 11 — `layout` is a `meta.category`, not a module).
- **Behavioral attributions (03)**: content hooks fire from `onContent*` wrappers (not the CRUD
  fns); `submitContestEntry`/`leaveHub` are NOT transactional (only `judgeContestEntry` is);
  RBAC 30s cache is in the layer wrapper, not the resolver; `createHub` doesn't set hubType;
  `createContest` only checks the policy when `options.userRole` is supplied; `generateSlug`
  has no NFD; `import/ssrf.ts` (and infra utils) are re-export shims; 6to4 + NAT64 ARE blocked.
- **Route auth labels (04)**: `oauth2/authorize`/`remote-follow`/`resolve-uri`/`hub-post-likes`
  are `auth` not `pub`; `hub-follow-status` + `/api/me` are effectively `pub`; contest
  judges/stakeholders + events PUT/DELETE are owner/admin; admin routes use
  `requirePermission` not `requireAdmin`; `:username` is exact-match (not case-insensitive);
  events filters are `upcoming`/`featured`/`myEvents` (no `past`, not `mine`); `votes` returns
  `ContestEntryVoteInfo[]` not a map; Better Auth routes (sign-up/email etc.) are served by
  `middleware/auth.ts` calling `auth.handler`, not files.
- **Composables/render (05)**: `useRealtimeCounts` = 2 global counters (not per-target);
  `error.vue` re-applies only `data-theme` (not the inline token CSS); `hideAt` is CSS-side
  not a render-time filter; nuxt `routeRules` is `{}` (the `/docs/**` prerender was removed,
  session 126); `identity.*` is NOT in `runtimeConfig.public.features`.
- **Gotchas (09)** verified ~40 file:line/symbol claims; fixed PGlite skip reasons, the
  "advisory lock"→claim-based-optimistic-locking wording (delivery uses a `lockedAt` timestamp
  + `LOCK_EXPIRY_MS`, not `pg_advisory_lock`), `verifyHttpSignature` header policy (3 + digest-
  if-body), and a stale "80 dist files" magic number.
- **10-doc-audit** regenerated against the real `docs/` tree (the old `reference/server/` +
  `reference/packages/` dirs were removed; 7 top-level docs, 5 reference guides, 11 plans).
- **CLAUDE.md**: "Federation: Fedify" / "protocol = Fedify wrapper" corrected — protocol is
  pure-TS ActivityPub with ZERO Fedify dependency (`jose` for HTTP sigs).

## Decisions / methodology

- Verified the **deterministic layer** by full doc↔source diffs (not sampling): all 42 enum
  values byte-exact, every route maps to a real handler, all 87 tables documented with zero
  phantoms, all 19 flags, all ui/protocol/auth exports, all component/page/section/composable
  names. **Zero remaining discrepancies in that layer.**
- Verified the **behavioral layer** by reading each handler/function/composable/gotcha (agents
  surfaced candidates; every candidate was re-verified against code before any edit — two agent
  false-positives were caught and rejected: editor `vue/` "missing" and shell "13 flags").
- Standing rule honored: no AI attribution in the commit.

## Open questions / next steps

- The audit is docs-only; nothing was published or deployed. No version bumps.
- Residual risk is longest-tail prose wording; the structural layer is exhaustively verified and
  the behavioral layer has now been read against code (03/04/05/06/07/09/12/13 deep-read).
- If `facts.md` is regenerated, note it had its own drift (33 composables / 41 enums) — prefer the
  recomputed numbers above.
- Future doc passes: recompute counts with `grep`/`find`/`git ls-files` and derive "added in
  migration/session/version N" attributions from the actual SQL / git log, never from filenames.

---

## Part 2 — implementation-verification audit (same day)

Follow-up: a strategic "what is CommonPub missing / doing wrong" critique was drafted from the
analysis docs, then **re-checked against primary source + live `curl /api/features`** (not the
docs). Scorecard:

### Confirmed in source (real latent issues)
- **Hooks bus mostly dead.** `hooks.ts` declares 13 events; only 8 ever `emitHook`'d. Never
  emitted: `content:liked`, `content:unliked`, `user:registered`, `federation:hub:post:received`,
  `hub:content:shared`. Only `search-index.ts` calls `onHook` outside tests → thin
  consumer-extension story.
- **Counter integrity, no safety net.** No reconcile/recount script anywhere. `leaveHub`
  (members.ts:129-136) + `submitContestEntry` (contest.ts:49,57) update counters in two
  NON-transactional statements (only `judgeContestEntry`/`voteOnPost`/`voteOnPoll`/`rsvpEvent`/
  `cancelRsvp`/`joinHub`/`createPost` are tx-wrapped).
- **`listContent` (content.ts:389-409)** = `countRows` COUNT(*) every request + in-app O(M²)
  federated merge. Keyset only relieved infinite-scroll.
- **Self-ref trees** (hubs.parentHubId, comments.parentId, hubPostReplies.parentId,
  docsPages.parentId) have NO DB FK — plain `uuid()`, app-managed only.
- **100 of 135 layer components** have no `@media` (docs said ~70 — undercount).
- **`error.vue:16`** re-applies only `data-theme`, NOT `cpub-theme-inline` → custom-themed
  error pages render wrong.
- **`approval` join policy == `invite`** (members.ts:47); `hubMemberStatusEnum('pending')` never
  written.
- **Redis opt-in** via `NUXT_REDIS_URL` (realtime/index.ts:44, security.ts:40); memory default.

### Live flag state (`curl /api/features`, 2026-06-01)
- **federation ON on ALL THREE.** federateHubs + seamlessFederation ON on commonpub + deveco,
  OFF on heatsync. **layoutEngine ON only on commonpub.io** (canary). events ON on all three.
  **rbac + publicApi OFF on every instance** — both subsystems shipped but DARK in prod.

### Corrected / overstated (do NOT repeat)
- **Events are NOT unvalidated.** `POST /api/events` validates with a thorough inline
  `createEventSchema` (`index.post.ts:5,31`). The real point: `validators.ts` lacks a
  *centralized* event validator (decentralized inline), NOT a security gap. Docs 02/03 wording
  ("gap worth closing / unvalidated despite user-facing API") overstates it — a future doc pass
  should reword.
- Federation is live on **3** instances, not 2; heatsynclabs.io is a real hackerspace
  (third-party community), though one operator runs all 3 deploys from one `main`.

Memory: `project-session-182-impl-audit`. Still docs/analysis-only — no code changed, nothing
published.
