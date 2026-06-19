# Session 208 — UI/UX + Functionality Gap Audit (whole app)

Date: 2026-06-19. Branch `monolith-splits`. Read-only audit; no app code changed by the audit itself.

> Method: 7 parallel domain-focused audit agents (wiring/dead-ends, content E2E, feature-area
> completeness, auth/profile/comms, accessibility, responsive/design-system/states, admin/chrome),
> each given the live feature-flag ground truth. Top findings adversarially re-verified against
> source by the lead (marked ✅ below). All findings are STATIC source tracing — no live runtime was
> exercised. This audit is the UI/UX + functional-completeness complement to the backend-correctness
> audit of sessions 203-204.

## Overall verdict

The app is in **good structural health**. The wiring is sound (a scripted cross-check of every
`$fetch`/`useFetch` against all 340 routes found **zero phantom calls**; all links resolve, all forms
submit). Design-system tokenization is near-total (3 defensible bare-color literals in 144 components),
dark mode + error.vue theming + nav/editor responsiveness are solid, and copy is clean (zero em dashes).
Historical risks (mobile-nav pathPrefix, theme-on-error, homepage blank-page trap) are closed.

The gaps are **not crashes** — they cluster into four recurring patterns:

1. **Backend-without-UI** — fully-implemented, routed server features with no reachable UI.
2. **Enum/schema drift** — a UI control offers a value the server schema rejects → 400/no-op.
3. **State-not-hydrated** — a toggle/list initializes to a default and never reads server state back.
4. **Error-as-empty + a11y-of-handrolled-markup** — failed fetches masked as empty; forms/tabs/lists
   reimplement markup without the labels/roles/keyboard support the `@commonpub/ui` primitives have.

---

## P0 — hard dead-end for a default-reachable action

| # | Finding | Location | Status |
|---|---|---|---|
| 1 | **Invite-only / approval hubs are unjoinable.** `joinHub` requires an `inviteToken` for any non-open policy, but there is **no invite UI anywhere** (generate/list/redeem) — zero refs in pages/components. Any hub set to Approval/Invite-Only is permanently closed. | `packages/server/src/hub/members.ts:47-59`; missing UI for `hubs/[slug]/invites.{post,get}.ts` | ✅ verified |

---

## P1 — broken core flow / data integrity

| # | Finding | Location | Status |
|---|---|---|---|
| 2 | **"Most Liked" search sort 400s the whole search.** `SortSelect` offers `value:'likes'`; the sort enum doesn't include it → `parseQueryParams` throws 400, results vanish on click. | `pages/search.vue:249` vs `searchQuerySchema` | ✅ verified |
| 3 | **Admin can mint API keys that authenticate nothing.** api-keys page/routes never `requireFeature('publicApi')`; `public-api-auth.ts:35` 404s all `/api/public/*` when the flag is off (off in prod). One-time token copied, then 404s everywhere, no warning. | `pages/admin/api-keys.vue`, `server/api/admin/api-keys/*`, `middleware/public-api-auth.ts:34` | ✅ verified |
| 4 | **"I Built This" state never hydrates.** No `GET /api/content/[id]/build` (only POST, which toggles). `buildMarked` defaults false every load → button shows inactive on reload; re-click *unmarks* + decrements. | `ProjectView.vue:184`; `server/api/content/[id]/build.post.ts` (no GET, local+fed) | ✅ verified |
| 5 | **Author profile tabs empty for prolific authors.** `getUserContent` returns published content; the page splits one mixed page client-side per tab with no pagination — if the newest items are all one type, the other tabs render empty despite published content. | `packages/server/src/profile/profile.ts`, `pages/u/[username]/index.vue` | ⚠ published-only verified; exact cap/type behavior to re-check before fixing |
| 6 | **Learning per-lesson completion never populated.** `getPathBySlug` never stamps `isCompleted` (`getCompletedLessonIds` is exported but called by no endpoint) → "Continue Learning" always jumps to lesson 1, no checkmarks, no resume. | `packages/server/src/learning/learning.ts:169-184`, `server/api/learn/[slug]/index.get.ts` | agent-traced |
| 7 | **Lesson completion gives no feedback.** `markComplete` discards `{progress, certificateIssued}`; finishing the final lesson silently issues a cert; re-opening a done lesson still shows "Mark Complete". | `pages/learn/[slug]/[lessonSlug]/index.vue:39-50` | agent-traced |
| 8 | **Video sort options are dead.** UI offers 4 sorts; `videoFiltersSchema` has no `sort` field, so `listVideos` always orders by `createdAt`. Most-Viewed/Top-Rated/Shortest do nothing. | `pages/videos/index.vue:75-80`, `packages/server/src/video/video.ts:77` | agent-traced |
| 9 | **Video category CRUD has no UI.** Full category backend, no caller; the video filter stays empty without raw SQL. | `server/api/videos/categories*.ts` | agent-traced |
| 10 | **Products are read-only after create.** `[id].put.ts` / `[id].delete.ts` exist, no UI caller → a product can never be edited/deleted in-app. | `server/api/products/[id].{put,delete}.ts`, `HubProducts.vue` | agent-traced |
| 11 | **Hub member management page orphaned.** `pages/hubs/[slug]/members.vue` is the only UI with promote/demote/kick, but nothing links to it (Members tab is display-only). | `pages/hubs/[slug]/members.vue` | agent-traced |
| 12 | **Hub ban backend has no UI.** Full ban/unban routes, zero callers → mods can't ban; kicked members rejoin open hubs immediately. | `server/api/hubs/[slug]/bans*.ts` | agent-traced |
| 13 | **Hub join swallows rejection.** `handleJoin` shows "Joined hub!" on any 200 even when the backend returned `{joined:false}` (banned/invite-required). | `pages/hubs/[slug]/index.vue:254-266` | agent-traced |
| 14 | **Form labels not programmatically associated** (WCAG 1.3.1/4.1.2). 106 `cpub-form-label` tags, **1** has `for=`; the rest (settings + every create/edit form) announce inputs by placeholder only. Auth pages are correctly done. | repo-wide; e.g. `settings/account.vue:75-83` | ✅ verified (106 tags, 1 `for=`) |
| 15 | **SearchSidebar interactive rows are non-interactive markup** (WCAG 2.1.1). Trending/tags/categories are clickable `<li>/<span>/<div>` with no role/tabindex/keydown → keyboard-unreachable. (Also flagged by the wiring agent as a dead-looking "Join" button.) | `SearchSidebar.vue:26-67,82` | a11y+wiring corroborated |
| 16 | **Layout palette tiles keyboard-inert** (WCAG 2.1.1). `<li tabindex=0>` with a focus ring + drag-only handler, no Enter/Space → keyboard users can focus but can't insert a section. | `AdminLayoutsPaletteTile.vue:50-57` | a11y-verified |
| 17 | **Error-as-empty masking.** `[type]/index.vue` (and ~5 sibling listings) destructure only `{data,pending}` (no `error`) → a failed fetch silently shows "No Xs published yet". | `pages/[type]/index.vue:50-54` (+ products/hubs/events/contests/learn index) | ✅ verified |
| 18 | **Follower list always shows "Follow".** `followers.vue` declares `followingState` but never initializes it (unlike following.vue) → every row shows "Follow", re-POSTing an existing follow. | `pages/u/[username]/followers.vue:11` | agent-traced |
| 19 | **Password-reset / verify-email silently swallowed in prod (ops).** Email adapter defaults to `console` unless `NUXT_EMAIL_ADAPTER` is set; UI says "check your inbox" but nothing sends → forgot-password users locked out. Independent of the `emailNotifications` flag. | `server/utils/email.ts:47-51` | needs live config check |
| 20 | **Register dead-end.** `autoSignIn` leaves the user logged in, but register.vue shows "check your email / go to login"; with the console adapter the email never arrives. | `pages/auth/register.vue:24-29` | agent-traced |

---

## P2 — significant degradation (selected; full list in agent transcripts)

- **Homepage legacy fallback (~1000 lines) is effectively dead** — `getHomepageSections` always returns
  non-empty `DEFAULT_SECTIONS`, so the legacy branch only runs on fetch failure; a second hero/contest
  impl that can drift. The session-168 consolidation hazard. `pages/index.vue:148,183`,
  `packages/server/src/homepage/homepage.ts:82-88`. (Ties into the deferred homepage-consolidation backlog item.)
- **RBAC custom-admin roles locked out of admin chrome** — `admin.vue` gates on `role==='admin'` only;
  `useCan()` is used by zero admin pages; the sidebar shows every section unconditionally. Latent in prod
  (live admin holds `*`); breaks the moment custom roles are used. `layouts/admin.vue:60-112`.
- **ProjectView tabs unsemantic** (WCAG 4.1.2) — Overview/Parts/Code/Files/Discussion are plain buttons,
  no `role=tablist/tab`, no `aria-selected`, no arrow keys — while `@commonpub/ui`'s `Tabs.vue` does it
  right but the view reimplements. `ProjectView.vue:290-303`.
- **Error toasts use a polite live region** (WCAG 4.1.3) — `AppToast` is `aria-live=polite`; errors should be assertive. `AppToast.vue:7,13`.
- **TipTap editor suppresses focus outline** with no `:focus-visible` replacement (WCAG 2.4.7). `CpubEditor.vue:68,72,84-86`.
- **Schedule control missing for project/explainer** — the `scheduledAt` toggle exists only in `ArticleEditor.vue`; the server schedule path is fully wired. project/explainer editors.
- **ExplainerView has no comment section** (project/article views do) — explainers are a federating type. `ExplainerView.vue`.
- **`cert/[code].vue` renders a blank white page** for invalid/loading codes (no pending/error branch). `cert/[code].vue:5,15`.
- **notifications.vue not gated by `emailNotifications`** — dead toggles that persist but do nothing (settings/profile.vue gates its duplicate copy). `pages/settings/notifications.vue`.
- **following.vue inverse follow-state bug** — seeds `true` for everyone in the owner's following list, not the viewer's. `following.vue:14-19`.
- **Profile follow is local-only** — federation follow routes exist but no profile UI reaches them; remote actors can't be followed despite federation ON. `u/[username]/index.vue:119`.
- **Admin publish version-history is dead** — `versions` + `revert` routes exist, no UI; the toolbar "history" is undo/redo only. `admin/layouts/[id].vue`.
- **Silent-catch save failures** — `admin/settings.vue:42`, `admin/api-keys.vue:124` (revoke), `HubProducts.vue:32` swallow errors with no toast.
- **OAuth authorize login is email-only** (`sign-in/email`) vs the main login's username-or-email. `auth/oauth/authorize.vue:32`.
- **Messages new-conversation hints remote handles** (`@user@instance`) but DMs are instance-local → confusing 400. `messages/index.vue:140`.
- **explore Content tab re-hand-rolls offset pagination** instead of `useContentFeed` (drift-prone). `explore.vue:19-29`.
- **logged-out like/bookmark** optimistically toggles then silently rolls back on 401 (no sign-in prompt). `useEngagement.ts:111`.
- **`share()` silent no-op** with no copy confirmation toast. `useEngagement.ts:151-164`.
- **Nav "Home" link permanently active** (`router-link-active` prefix-matches `/`). `NavLink.vue:25-31`.
- **Per-type + profile listings have no pagination** — items beyond 20 unreachable. `[type]/index.vue`, `u/[username]/index.vue`.
- **Product cards look clickable but aren't links** (cursor:pointer + hover-lift on bare `<div>`); `/products/[slug]` unreachable from the hub tab. `HubProducts.vue:69-82`.
- **Hub product cards hardcode `border-radius:12px/10px`** (sharp-corners rule). `HubProducts.vue:113-135`.
- **Product/company hub landing renders blank** until a tab is clicked (`initialTab` computed before lazy `hub` loads). `hubs/[slug]/index.vue:41`.

## P3 — polish (representative)

Dead "More options" button on ArticleView; ExplainerView/contest entry-row links missing; learning
drag handle with no reorder; events/RSVP "confirmed" toast when waitlisted; docs double empty-state +
prev/next skips nested pages; video "Featured" duplicates `videos[0]` in the grid; videos routes lack
`requireFeature('video')`; notification rows clickable-but-dead when `link` unset; `markAllRead` leaves a
stale badge; no Article JSON-LD; admin federation raw `alert()`; `LayoutSection` inset focus outline;
NavDropdown not a WAI-ARIA menu / no focus restore.

---

## Verified-clean (no action — false-confidence guards)

Wiring (zero phantom calls), Better Auth proxy routes, design-system tokenization, dark mode, error.vue
theming, scheduled-publishing worker, the `article→blog` alias, all 20 editor block types render,
fork/like AP wiring, contest create→submit→judge→results, docs editor + page-tree CRUD/versions,
event RSVP/capacity/waitlist, `useFocusTrap` (traps + restores on close & unmount), `@commonpub/ui`
primitives (Tabs/EngagementBar/Dialog are exemplary a11y). **Meta-finding:** axe tests cover only the
`ui` primitives, NOT the layer components that render most pages — the a11y defects above all live in
that untested layer.

---

## Recommended fix phasing

**Phase A — quick wins, low-risk, no product decision (do first):**
- #2 search `likes` enum (+ orderBy) · #3 gate api-keys behind `publicApi` + hide link · #4 add `GET
  build` + hydrate · #17 add `v-else-if="error"` to the ~6 listings · #18 init follower follow-state ·
  silent-catch toasts · #2-class: `cert/[code]` loading/error state · ExplainerView CommentSection ·
  AppToast assertive-for-errors · share() toast · Nav Home exact-active · video "Featured" slice.
**Phase B — mechanical but large:**
- #14 form `for=`/`id` sweep (~105 inputs) · ProjectView tabs → adopt `Tabs` primitive · SearchSidebar
  → real buttons · palette-tile keyboard handler · error-as-empty on remaining pages.
**Phase C — feature builds / product decisions (own efforts):**
- #1 hub invite UI (P0) · #11/#12 hub member-management + ban UI · #9 video-category admin · #10 product
  edit/delete UI · #6/#7 learning completion read-back · #5 profile per-tab pagination · federated follow
  from profile · homepage legacy-branch consolidation (ties to the existing backlog item) · RBAC
  `useCan`-driven admin chrome.
**Ops:** #19 confirm `NUXT_EMAIL_ADAPTER` on each instance (per the empirical-flag-check rule).

Each fix needs a test that goes RED on revert (mutation bar). Full per-agent findings + line cites are
in the session-208 agent transcripts.

---

## Fixes SHIPPED this session (branch `monolith-splits`, not yet deployed)

Phase A + B from the plan above, committed + tested + `nuxt typecheck` clean (layer suite 1109 green):

**Phase A (quick wins):**
- #2 search `likes` sort — added end-to-end (schema/route/Meili/PG/listContent) + tests.
- #3 API-keys gated behind `publicApi` (routes + sidebar link + page notice).
- #4 build-state hydration — new `GET /api/content/[id]/build` (+ federated) + ProjectView onMounted + test.
- #17 error-as-empty — `v-else-if="error"` + retry on `[type]`/products/hubs/events/contests/learn.
- #18 follower/following — fixed the `.items` shape bug (lists were rendering empty!) + viewer-aware
  `isFollowing` (server `viewerId` param + test) so the Follow button reflects the viewer.
- Misc: cert loading state, ExplainerView CommentSection, AppToast assertive-for-errors, share() toast,
  Nav Home exact-active, video Featured dedup, 4 silent-catch→toast.

**Phase B:**
- a11y: ProjectView tabs → full tablist/tab/tabpanel + roving arrows (test); SearchSidebar clickable
  li/span/div → real buttons (+ removed dead Join button); layout palette tiles → Enter/Space keyboard
  insert (test).
- Form labels (WCAG 1.3.1/4.1.2): associated **all 7 flagged forms** — settings/account, settings/profile,
  events/create, events/[slug]/edit, contests/create, contests/[slug]/edit, ContestStagesEditor. for/id
  (index-aware in loops), aria-label where no visible label, group captions → `<span>`.

**Still deferred (Phase C — feature builds / decisions, NOT done):** hub invite UI (P0), hub member-mgmt +
ban UI, video sort+category admin, product edit/delete UI, learning completion read-back, profile per-tab
pagination + drafts, federated-follow-from-profile, homepage legacy-branch consolidation, RBAC
`useCan`-driven admin chrome, megalodon TOCTOU. Plus the audit's own NEW P1 (`likeRemoteContent` race,
see `207-kickoff-next.md`). Finding 2 (latent NaN clamps) also open.
