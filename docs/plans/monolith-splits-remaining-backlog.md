# Plan — remaining backlog on `monolith-splits`

Created 2026-06-22. Branch `monolith-splits` is **30 commits ahead of main**, NOT pushed / NO PR /
NOT deployed / NOT published. Gates at creation: **server 1445, layer 1124, `nuxt typecheck` clean.**
Companion docs: `docs/sessions/209-kickoff-next.md` (branch state), `docs/STATUS.md` (operator runbook),
`docs/sessions/208-ui-ux-functionality-audit.md` (original audit).

> Every gap below was re-verified against source on 2026-06-22 (file:line cited). **Line numbers drift —
> the executor MUST re-confirm each citation before editing (no assumptions).** Several items are smaller
> than the 208 audit implied (backends + API routes already exist; the gap is UI wiring).

---

## Standing rules (apply to EVERY item — do not skip)

- **Tests-first, mutation bar**: each change needs a test that goes RED when the change is reverted. Prove
  it (revert → run → see RED → restore). Pure logic → unit; DB logic → real-Postgres harness
  (`packages/server/src/__tests__/helpers/realpgdb.ts`, PG reachable locally on :5433, `describe.skipIf`
  otherwise); composables with lifecycle → host-component mount (see `useScrollSpy.test.ts`).
- **Gates per change**: `pnpm -C packages/server exec vitest run` (or the relevant suite), `pnpm -C
  layers/base exec vitest run`, and `pnpm typecheck` (vue-tsc strict). After a `packages/*` **type**
  change, rebuild it (`pnpm --filter @commonpub/<pkg> build`) so the layer typecheck sees it.
- **Edit needs a prior Read** of the file (a Bash `grep`/`sed`/`cat` does NOT register it).
- **Composable consumed by a unit-tested component → import it explicitly** (not Nuxt auto-import); the
  SFC unit test mounts without the auto-import transform (see `ProjectView.vue` importing `useScrollSpy`
  / `projectBlocks`). Pages (not unit-tested) can rely on auto-import.
- **No `__tests__` under a bracketed route dir** (`[slug]`, `[id]`) in the layer — npm-packlist mis-globs
  bracketed dirs and ships the test → consumer typecheck breaks. Put route-handler tests elsewhere or use
  a static-contract test in a non-bracketed dir.
- **Committed migrations only** (never `db:push`). **No feature without a flag** in `commonpub.config.ts`.
  **`var(--*)` only** (no hardcoded colors/fonts). **TS strict, no `any`.** **No em dashes in user-facing
  copy** (labels/hints/toasts/titles; code comments exempt). **`cpub-` class prefix.** Per-view layout
  classes uniquely named (`cpub-{view}-*`). **No AI co-author** in commits (any repo).
- **`dist/` is gitignored** — never commit build artifacts.
- **Outward-facing actions are gated on the user**: pushing to main auto-deploys commonpub.io; publishing
  npm + rolling deveco/heatsync is irreversible. Do NOT do these without explicit go-ahead.
- **Adversarially verify** agent findings AND your own work against source before claiming done.

### Per-item execution template
1. Read the cited files; **confirm the gap still exists** (it may have been fixed; line numbers may differ).
2. If the item is flagged **DECISION NEEDED**, ask the user before building (don't guess the UX shape).
3. Write the failing test(s); prove RED.
4. Implement the smallest correct change.
5. Run the gates; make them green.
6. One atomic commit (conventional message, no AI co-author).
7. Update `docs/sessions/209-kickoff-next.md` (flip the item to DONE with the commit hash).

---

## Phase 0 — Re-ground (start of every session)

- `git -C <repo> log --oneline main..HEAD` (expect 30+), `git status` (clean), branch `monolith-splits`.
- `pnpm -C packages/server exec vitest run` (expect 1445+), `pnpm -C layers/base exec vitest run`
  (expect 1124+), `pnpm typecheck` (EXIT 0). If red, stop and fix before new work.
- Re-derive the changed publishable set: `git diff --name-only main..HEAD | grep -E '^(packages/|layers/base/)'`.
  At creation: **schema, server, layers/base (`@commonpub/layer`)**.
- **Ask the user the landing decision** (see Phase 5). It gates nothing in Phases 1–4 (all stay on the
  branch), but the user has been holding — confirm they still want to iterate vs land.

---

## Phase 1 — Low-risk wiring + safe refactors (no/low decision, do first)

Each is its own commit. Ordered roughly easiest-first.

### 1a. Link the hub member-management page  ·  risk: LOW  ·  decision: NO
- **Gap (verified):** `layers/base/pages/hubs/[slug]/members.vue` is a full management page (role change
  `:25`, kick `:38`, gated `canManage` owner/admin `:12`) but **nothing links to `/hubs/[slug]/members`**
  — only reachable via the "new member" notification (`packages/server/src/hub/members.ts:95`). The hub
  page's Members tab renders read-only `components/hub/HubMembers.vue` (no controls).
- **Approach:** Add a "Manage members" `NuxtLink` to the hub header next to Invites/Settings
  (`layers/base/pages/hubs/[slug]/index.vue:318-319`), gated `['owner','admin'].includes(hub?.currentUserRole)`.
  Mirror the existing Invites link exactly (`cpub-btn cpub-btn-sm`, `aria-label`, icon).
- **Test:** the page itself isn't unit-tested; verify via typecheck + the link's v-if expression. (Optional:
  a small render test of the hub header is out of scope.) Lowest-value test surface — rely on typecheck.

### 1b. Wire video sort  ·  risk: LOW  ·  decision: MINOR (relabel "rated")
- **Gap (verified):** UI offers `recent/viewed/rated/shortest` (`pages/videos/index.vue:78-83`, sent as
  `sort` `:18`); `videoFiltersSchema` (`packages/schema/src/validators/video.ts:30-35`) has **no `sort`**
  → Zod strips it; `listVideos` (`packages/server/src/video/video.ts:77`) is hardcoded
  `orderBy(desc(createdAt), desc(id))`. Every option returns identical results.
- **Approach:** Add `sort: z.enum(['recent','viewed','liked']).optional()` to `videoFiltersSchema`; add
  `sort?` to the server `VideoFilters` (`video.ts:34-39`); branch `.orderBy()` (`viewed`→`viewCount`,
  `liked`→`likeCount`, `recent`→`createdAt`), **always ending `desc(videos.id)`** (pagination tiebreaker
  rule). Update the UI option labels accordingly. **DECISION:** "Top Rated" has no rating column — relabel
  to "Most Liked" (recommended) and **drop "Shortest"** (duration is `varchar(16)`, can't sort numerically
  without a column-type migration — defer that to its own item).
- **Test:** server unit/integration — `listVideos` with each sort returns the expected order; schema test
  that `sort` survives validation. RED before the schema/query change.
- **Migration:** none (for recent/viewed/liked).

### 1c. Product edit/delete UI  ·  risk: LOW  ·  decision: MINOR (placement)
- **Gap (verified):** `updateProduct` (`packages/server/src/product/product.ts:113`, owner-scoped),
  `deleteProduct` (`:164`), and routes `products/[id].put.ts` + `products/[id].delete.ts` all exist; **no UI
  calls PUT/DELETE**. Create UI is `components/hub/HubProducts.vue` (`:19-36`); cards (`:71-84`) have
  `cursor:pointer` but no controls. Detail page `pages/products/[slug].vue` is read-only.
- **Approach:** Add edit (reuse the `HubProducts.vue` create-form markup as an edit modal posting PUT
  `/api/products/[id]`) + delete (DELETE `/api/products/[id]`, confirm dialog) controls, gated on ownership
  (`createdBy.id === currentUser.id`) or `content.moderate`. The detail page already has `createdBy`.
- **Test:** server side is covered; the UI is the gap — verify via typecheck. If feasible, a small test of
  the ownership-gate computed. **DECISION:** edit on the detail page vs inline on the hub card — recommend
  the detail page (one canonical edit surface).
- **Migration:** none.

### 1d. Video-category admin UI  ·  risk: LOW  ·  decision: MINOR (page vs tab)
- **Gap (verified):** Full backend CRUD (`video.ts` `listVideoCategories:186`/`create:199`/`update:225`/
  `delete:258`) + admin-gated routes (`videos/categories.post.ts`, `categories/[id].put.ts`,
  `categories/[id].delete.ts`, all `requirePermission(event,'categories.manage')`). **No UI** — note
  `pages/admin/categories.vue` is a decoy (manages CONTENT categories via `/api/admin/categories`).
- **Approach:** New admin page modeled on `pages/admin/categories.vue` (same form/list pattern), pointed
  at `/api/videos/categories*`. **Routes use PUT (not PATCH) for update — match that.** Add a sidebar link
  in `layers/base/layouts/admin.vue`. **DECISION:** standalone page vs a tab on the content-categories page
  — recommend standalone `/admin/video-categories` for clarity.
- **Migration:** none.

### 1e. Learning completion read-back  ·  risk: LOW-MED  ·  decision: MINOR (enrich type vs new endpoint)
- **Gap (verified):** `getCompletedLessonIds` (`packages/server/src/learning/learning.ts:946`) has **zero
  runtime callers** (only re-exports). Write path works (`markLessonComplete:643` → `lessonProgress`). But
  `getPathBySlug` (`:169-185`) never sets per-lesson `isCompleted`, so `pages/learn/[slug]/index.vue:69-81`
  ("next incomplete lesson") treats every lesson as incomplete; and the lesson page's `completed` is a
  local `ref(false)` (`[lessonSlug]/index.vue:37`) never initialized from server → a completed lesson shows
  "Mark as Complete" after reload.
- **Approach (recommended):** Enrich `getPathBySlug` to accept an optional `requesterId`; when set, call
  `getCompletedLessonIds(db, requesterId, path.id)` and tag each lesson `isCompleted`. This satisfies both
  the path page AND lets the lesson page derive its initial `completed` from the `path` fetch it already
  makes (`[lessonSlug]/index.vue:25`). Touches `LearningPathDetail` in `packages/server/src/types.ts`
  (add `isCompleted?` to the lesson shape). Alternative: a dedicated `GET /api/learn/[slug]/progress`.
- **Test:** real-PG integration — mark a lesson complete, then `getPathBySlug(requesterId)` returns that
  lesson `isCompleted:true` and others false. RED before the enrichment.
- **Migration:** none (data already in `lessonProgress`).

### 1f. Extract `useDocsSiteSettings` from edit.vue  ·  risk: LOW  ·  decision: NO
- **Gap:** continues the monolith split. `docs/[siteSlug]/edit.vue` (now 1323 lines) still inlines
  `saveSiteSettings` (`:348`), `deleteSite` (`:364`), `createVersion` (`:375`) + their dialog state.
- **Approach:** Extract to `layers/base/composables/useDocsSiteSettings.ts` mirroring `useDocsPageTree`
  (page supplies context via getters/callbacks; composable uses `$fetch`). ~70 lines. Locate the dialog
  state refs (names differ from the fn names) and move only the cohesive cluster.
- **Test:** `composables/__tests__/useDocsSiteSettings.test.ts`, `$fetch` stubbed via `vi.stubGlobal`
  (see `useDocsPageTree.test.ts`). edit.vue is a page (not unit-tested) → auto-import is fine there.

### 1g. RBAC `useCan`-driven admin chrome  ·  risk: LOW (flag off = no-op)  ·  decision: NO
- **Gap (verified):** `composables/useCan.ts:11` exists but has **zero call sites**. Admin chrome
  (`layouts/admin.vue`) gates on `isAdmin` (`:2`) + flat `NuxtLink`s; only Layouts/`publicApi` links are
  flag-gated. RBAC flag default OFF (`packages/config/src/schema.ts:58`), Phase 0/1 inert (admins get the
  admin floor; non-admins `EMPTY`), so `useCan` returns `true` for admins / `false` otherwise → identical
  visible chrome today.
- **Approach:** Replace per-link gating with `useCan('<perm>')` matching each route's server
  `requirePermission` key (e.g. Users→`user.manage`, Layouts→`layout.manage`, Roles→`roles.manage`). With
  the flag OFF this is a pure no-op refactor; it makes the eventual RBAC flag-flip drive the UI. **Verify
  each key against the actual `requirePermission` on the link's target route.**
- **Test:** component test of `admin.vue` chrome — mock `useCan` to return false for one perm, assert that
  link hidden; true → shown. RED before conversion.

---

## Phase 2 — Ban UI  ·  risk: LOW-MED  ·  decision: MINOR

- **Gap (verified):** `banUser:21`/`unbanUser:101`/`listBans:150` (`hub/moderation.ts`) + **3 working
  routes** (`bans.get.ts`, `bans.post.ts`, `bans/[userId].delete.ts`). **Zero UI** references ban/unban.
- **Approach:** On the member-management surface (the page from 1a), add a "Ban" action (POST
  `/api/hubs/[slug]/bans` `{userId, reason?}`) beside kick, gated `canManage`; add a "Banned users"
  section/tab (GET `/api/hubs/[slug]/bans`) with unban (DELETE `/api/hubs/[slug]/bans/[userId]`).
- **DECISION (minor):** separate tab vs section within members page; whether to collect a ban reason
  (the route accepts an optional reason). Recommend: a "Banned" section on members.vue + an optional reason.
- **Test:** the routes/backend are testable; add a server integration test for ban→listBans→unban if not
  already covered (`hub.integration.test.ts` already covers ban/unban — confirm, extend if thin).

---

## Phase 3 — Feature builds needing real product decisions (gate each on the user)

### 3a. Profile per-tab pagination + own-drafts  ·  risk: MED (drafts = authz)  ·  decision: YES
- **Gap (verified):** `pages/u/[username]/index.vue:26` does ONE `useLazyFetch` to `/content` (no params),
  tabs `.filter()` it client-side (`:61-73`); server `getUserContent` (`profile.ts:151-162`) hardcodes
  `limit:20`, no offset/cursor, `status:'published'` (`:158`). `isOwnProfile` (`:96`) is computed but only
  swaps the Edit-Profile button — **not passed to the fetch**, so owners never see their drafts.
- **Approach:** (1) Extend the content API to accept `limit`/`cursor` + resolve viewer identity; when the
  authenticated user IS the profile owner, allow drafts (separate "Drafts" tab or `status=all`), else force
  `published`. Mirror the keyset pattern (`listContentKeyset`, `desc(publishedAt) NULLS LAST, desc(id)`).
  (2) Switch the page to a per-tab `useContentFeed`-style fetch with `loadMore`/`canLoadMore`.
- **SECURITY (load-bearing):** the draft-visibility decision MUST be made server-side from the
  authenticated viewer, NEVER from a client `status` param (a passthrough leaks every user's drafts —
  same class as the validate-domain-not-shape memory). Test the negative: a non-owner requesting drafts
  gets only published.
- **DECISION:** separate "Drafts" tab vs inline draft badges; pagination UX (load-more vs pages).
- **Test:** real-PG integration — owner sees own draft, non-owner does not; pagination returns distinct
  non-overlapping pages with the id tiebreaker. RED before.
- **Migration:** none.

### 3b. Real "approval" join workflow  ·  risk: MED  ·  decision: YES (net-new)
- **Gap (verified):** `joinHub` (`hub/members.ts:22`) has only `if (policy !== 'open')` (`:47`) → BOTH
  `approval` and `invite` require a token and insert an **active** member immediately. `hubMemberStatus`
  enum has `'pending'` (`schema/src/enums.ts:95`, default `'active'` `hub.ts:73`) but it is **never
  written/read for hub members** — the column is dead.
- **Approach (net-new):** (1) `joinHub` `'approval'` branch: insert `hubMembers` row `status:'pending'`,
  role `member`, do NOT increment `memberCount`, notify admins. `'invite'` keeps the token path. (2) Member
  queries filter `status='active'` (so pending don't count/appear); add `listJoinRequests` (status
  pending). (3) New routes `GET /api/hubs/[slug]/requests`, `POST .../requests/[userId]/approve`, `.../deny`.
  (4) Admin UI section (co-locate with member mgmt). (5) Approve = flip to active + `memberCount++` + emit
  `hub:member:joined` + notify requester; deny = delete pending + notify. **Move memberCount accounting to
  approve-time for the approval policy.**
- **DECISION:** where requests live (tab vs members page); requester message; notification copy; whether
  request state is shown back to the requester.
- **Test:** real-PG — approval-policy join creates a pending row, no memberCount bump, not in active list;
  approve activates + bumps; deny removes. RED before each.
- **Migration:** none (enum value exists); verify member-list callers don't already assume all-active.

### 3c. Federated follow from profile  ·  risk: MED  ·  decision: YES (net-new surface)
- **Gap (verified):** federation backend ready — `federation/follow.post.ts` (`{actorUri}`→`sendFollow`),
  `federation/remote-follow.post.ts` (`{uri}`→resolve→follow), `resolveRemoteActor`. Invoked only from
  `pages/authorize_interaction.vue:60` (inbound) and `pages/mirror/[id].vue:29`. The local profile follow
  (`u/[username]/index.vue:107` → `/api/users/[username]/follow`) is **local-only**, gated `social` not
  `federation`; `[username].get.ts` does no WebFinger resolution; **no remote-actor profile page exists**.
- **Approach:** (1) A "follow remote" entry: a handle/URI input (WebFinger resolve → `remote-follow`) or a
  follow button on federated search/actor results calling `federation/follow`. (2) Optionally a remote-actor
  profile view (resolve `@user@domain`, read-only render + federation follow button). Profile page branches:
  local user → existing endpoint; remote actor → federation endpoint.
- **DECISION:** full remote-actor profile page vs a lighter "follow remote" input/search affordance; how a
  remote handle is discovered/entered. Gate behind `features.federation`.
- **Test:** route/resolution unit tests; the UX surface per the decision.

---

## Phase 4 — High-risk / multi-instance (do last, with extra care)

### 4a. Homepage 3-path consolidation  ·  risk: HIGH (blank-page)  ·  decision: YES + deploy ordering
- **Gap (verified):** three branches in `pages/index.vue` — `v-if="layoutEngineActive"` (`:135`, LayoutSlot),
  `v-else-if="hasCustomSections"` (`:148`), `v-else` legacy fallback (`:184-453`). `layoutEngineActive =
  layoutEngineFlag && homepageLayout!==null` (`:29-31`). Seed endpoint exists
  (`server/api/admin/layouts/seed-homepage.post.ts`, idempotent, `layout.manage`).
- **Approach (STRICT 3-phase, per instance — NOT a single deploy):** (A) POST `seed-homepage` on every
  instance (commonpub.io, deveco.io, heatsynclabs.io) so a published `('route','/')` layout exists; flag
  still off → no visible change. (B) Flip `features.layoutEngine` per instance; verify each homepage
  renders. (C) ONLY after A+B verified on ALL instances, remove the `v-else-if`/`v-else` legacy blocks +
  dead CSS/handlers.
- **RISK:** removing the fallback before an instance is seeded → **blank homepage**. The
  `homepageLayout!==null` guard is the current safety net; removal deletes it. This is outward-facing and
  multi-instance — gate hard on the user and do C only after curl-verifying every instance.

### 4b. Extract `inboxHandlers.onCreate`  ·  risk: HIGH  ·  decision: NO (but anchor with tests first)
- **Gap:** `packages/server/src/federation/inboxHandlers.ts` (1512 lines); `onCreate` is ~550 lines
  (`:496-1047`) inside the `createInboxHandlers` factory (`:146`), closure-capturing deps. Biggest single
  function in the federation layer.
- **Approach:** Extract to a standalone `handleInboxCreate(ctx, actorUri, object)` taking an explicit
  context object (the closure-captured deps). **PREREQUISITE:** add inbound-activity integration coverage
  (real-PG) for the Create paths FIRST, so the extraction is behavior-anchored — only then refactor. This
  is hot federation ingestion; a regression silently corrupts inbound content/counters.
- **Defer unless** there's appetite + time for the test-anchoring; it's the riskiest item here.

> Leave `hubMirroring.ts` (1608) as-is — the elegance audit judged it cohesive (26 flat single-purpose
> exports); splitting is churn with no testability gain.

---

## Phase 5 — Landing & roll (OUTWARD-FACING — explicit user go-ahead required)

Follow `docs/STATUS.md` §Runbook exactly. Re-derive the changed set at execution time; do NOT trust the
list below (it will be stale).

1. **Merge → deploy commonpub.io:** PR + squash-merge `monolith-splits` → `main`. `deploy.yml` runs on
   push (Docker → droplet → `db-migrate.mjs` hard-fail → `smoke.mjs` hard-fail). Then curl-verify
   `/api/health`, `/api/features`, a content route, and exercise a couple of this branch's fixes (search
   "Most Liked", a project's "I Built This", a followers list, hub invite create+redeem).
2. **Publish npm** (dependency order, poll `npm view` between): `schema → config → protocol → auth →
   server → ui → theme-studio → layer`. Only the **changed** ones (branch: schema, server, layer; plus
   whatever 203/204 left unpublished — re-derive). **Layer ONLY via `pnpm run publish:layer`.**
3. **Roll deveco/heatsync + CLI:** bump caret pins (hand-edit across 0.x minor boundaries) + regen BOTH
   lockfiles (deveco's npm lock is gitignored; heatsync's is tracked) + bump CLI `template.rs`/`tests/cli.rs`
   + `cargo publish`. Push each `main`. **deveco + heatsync deploys are WARN-ONLY on health → curl-verify
   `/api/health` + a real route after each.** This also clears the still-pending **203/204 security roll**
   to the other two instances.

---

## Phase 6 — Residuals (ops decisions, low priority)

- **megalodon SSRF TOCTOU residual** — DNS-resolve guard in place, fail-closed; residual is the
  check-then-connect rebinding window (full fix = pinned axios transport). Flag-gated OFF in prod
  (`identity.*` all false). Low priority.
- **pg_trgm search ranking** — search uses Postgres FTS + `ilike` fallback, no relevance ranking. The
  PGlite contrib ext won't load in the layer vitest runtime; re-adding needs a portable load or a
  prod-only raw migration with a documented drift exception. Ops decision.

---

## Suggested order

Phase 0 every session. Then **Phase 1 (1a→1g) for momentum** (low-risk, mostly no-decision), then Phase 2,
then Phase 3 items as the user makes the UX calls, then Phase 4 with extra care, then Phase 5 when the user
says land. Phase 6 is opportunistic. Each item = its own tested commit; update `209-kickoff-next.md` as you go.
</content>
</invoke>
