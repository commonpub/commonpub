# Session 231 Handoff — audit (6 rounds) + content/hub privacy fix (item #1, committed, INCOMPLETE)

Date: 2026-07-12. Branch **`session-231-content-privacy`** (NOT pushed / published / deployed).
Commits: `c6d80423` (plans) + `b6e8049e` (P-1/P-2 privacy fix) + `891b86b3` (handoff) + `df0486f3`
(**P-1b — remaining leak sites, round-7/8 audit**). Nothing rolled to instances yet.

## TL;DR

A deep audit (6 rounds, each of which found real problems in the prior round's output) established
that the federation/email cores are sound but the **generic content read layer has a live,
unauthenticated, systemic privacy leak** — content `visibility` (members/private) and private-hub
data were readable by anyone across many read paths. This session implemented the fix for the main
sites (committed, verified) and a round-7 adversarial audit then found the fix is **correct but
incomplete** (more leak sites of the same class remain). Full remediation sequencing lives in
`docs/plans/session-231-remediation-roadmap.md`.

## What shipped (committed on the branch, NOT rolled)

**Commit `b6e8049e` — content/hub privacy enforcement (P-1 + P-2).** Server + layer only, **no
schema/migration**. New: `content/visibility.ts` (`visibleContentWhere(requesterId)` = `deletedAt IS
NULL AND ((published+public) OR authorId=requester)`), `hub/access.ts` (`canReadHub` +
`REDACTED_HUB_ID`), `utils/hubAccess.ts` (`requireHubReadAccess`), membership-aware `getHubBySlug`.
Threaded through ~19 sites (content detail, feeds, search Postgres+Meili, profile listing, product/
gallery, learning lesson, comments; hub posts/members/gallery/resources/products). Also fixed a
**regression the fix introduced** (5 hub WRITE routes now use `getHubIdBySlug`, the real-id write
helper, so a platform admin can still edit/delete a private hub; `updateHub`/`index.get` thread
`asPlatformAdmin`). Comments: `post` targets gated on hub membership, `lesson` on path status
(`video` has no privacy field).

**Verified:** server + reference (vue-tsc) typecheck clean; new suites `content-visibility-p1` (20) +
`hub-privacy-p2` (17) + `social.integration` (15) = 52 pass; full server suite **1613 pass / 5 fail**,
the 5 being ONLY the pre-existing outbox date-bomb (session-231 Phase 0, untouched — see roadmap).

**The correct predicate (verified round 6):** `contentItems` has NO `hubId`; NO code grants `members`
content to non-authors → `members` and `private` are BOTH author-only. Non-owner sees only
published+public+not-deleted; author sees own. Do NOT add a "logged-in sees members" branch. Hub
privacy (private → active-member-only) is a SEPARATE gate.

## Round-7 adversarial audit — the committed fix is CORRECT but INCOMPLETE

Two adversarial agents + direct verification. **The diff is sound** (all 4 risk axes clean): no
status over-block (archived still served via the untouched `resolveContentQuery`/`PUBLIC_STATUSES`;
scheduled hidden), predicate safe on the anon/null edge (correct AND/OR grouping; `authorId` NOT
NULL), no over-block of legit access (public served, members served, public content still federates,
author sees own), and the 5 write routes each self-authorize (no hole from `getHubIdBySlug`).

**But the original 19-site list was INCOMPLETE.** Additional still-live leaks (full detail + fix loci
in `content-privacy-enforcement.md` → "Phase P-1b"):
- **HIGH, unauth:** `GET /api/hubs` (+ `public/v1/hubs`, sitemap) lists **private hubs** with full
  metadata (`listHubs` has no privacy filter) — worst miss, trivial. And `getLessonBySlug`'s linked
  **content body** fetch has no visibility filter (the P-1 lesson fix only gated path status).
- **MEDIUM:** related-content INSIDE the "fixed" `getContentBySlug` (metadata leak); `search/trending`;
  `listContestEntries`; hub `poll-options` (no membership check); `sitemap.xml`; private-hub events.
- **LOW / pre-existing:** `listUserBookmarks`; `createComment` WRITE lets a non-member post into a
  private hub (notification injection); `public/v1/hubs/[slug]` existence oracle; `listContentProducts`;
  `listPosts` share-enrichment; anon gets real hub id in the private-hub stub (defense-in-depth).
- **Deferred to federation 2e:** the hub ActivityPub surface (latent behind `federateHubs`, OFF).

**P-1b is now DONE (commit `df0486f3`).** An ultracode workflow (completeness-audit → implement →
adversarial verify) closed all HIGH+MEDIUM sites: listHubs privacy filter, getLessonBySlug linked
content, related-content in getContentBySlug, search/trending, listContestEntries (viewer-own
exempt), poll-options, bookmarks + listPosts share-enrichment, product detail/search, profile stat
aggregates, and — the HIGH residual the verifiers caught — the **bare `/api/events` feed** (private-
hub events incl. `onlineUrl`). 72 privacy tests pass; both typechecks clean; full suite green except
the outbox date-bomb. A completeness re-sweep found NO un-catalogued sites. **Deferred (LOW):** anon
`getHubBySlug` stub still returns the real hub id (no-requesterId path is shared by write/AP callers;
needs a read-scoped resolver); `createComment` write-abuse into a private hub (write-behavior change).

**Privacy fix is COMPLETE and roll-ready.** Continuing on-branch with the next roadmap items
(**GDPR export #2**, then **RBAC #3**) so the whole security batch can roll together. **The eventual
roll** (recommended before too much else stacks up): publish `@commonpub/server` + `@commonpub/layer`,
deploy to all 3 **with the Meili reindex step**, and curl each leak site UNAUTHENTICATED before/after
(esp. `/api/hubs`, `/api/events`, `/api/content/<members-slug>`, `/api/hubs/<private-slug>/posts`).

## Remaining roadmap (verified priority — `session-231-remediation-roadmap.md`)

1. **Content/hub privacy** — P-1/P-2/**P-1b all committed**. **Ready to ROLL** to all 3 (next action).
2. **GDPR data-export completeness** (P2, live) — export omits ~15 tables of subject data (referral
   graph, all hub forum posts/replies, videos, learning paths, products, reports, certificates, files,
   edit history, held IPs); JSDoc falsely claims Art. 20 parity. Fix loci in the roadmap. MUST exclude
   keypairs/sessions/audit_logs.
3. **RBAC** — `roles.manage` has no privilege ceiling (self-escalation, full exploit path);
   `contest.*` subsumes `contest.pii`; `event.create` unenforced (any user creates events);
   `contest.create`/`content.read` are dead keys.
4. **Phase 0** — email-outbox test date-bomb (test-only; also correct the STATUS/230-handoff "PGlite
   flake" note).
5-7. **Federation** live P2s + latent hardening + mirror-quota (deeper: storage ungated entirely) —
   behind BEHAVIORAL harnesses, not green units (see roadmap doctrine).
8. **Contest communications** (feature) — `contest-communications.md`.

## Rollout notes (when rolling the privacy fix)
- **Meilisearch reindex sequencing:** `contentSearch.ts` now filters `visibility="public"`;
  `configureContentIndex` must re-run (adds `visibility`/`authorId` filterable) AND a full reindex must
  populate the field BEFORE the filter is trusted, or search returns empty/500s (fail-closed, no leak).
  Put this in the deploy step.
- Publish `@commonpub/server` + `@commonpub/layer`, roll to all 3 per the STATUS runbook; **curl each
  leak site UNAUTHENTICATED before/after on every instance** (esp. `/api/hubs`, `/api/content/<slug>`
  of a members item, `/api/hubs/<private-slug>/posts`). deveco has live email + federation is on in
  prod, so verify no legit flow regresses.

## Landmines / lessons (session 231)
- **Every audit round found problems in the prior round's output** — static review bottoms out; the
  crypto/network/concurrency/UI boundaries are all mocked, so "SOLID" = "static-reviewed, behaviorally
  unverified." The fix is to CHANGE MEDIUM (real signed request / real-Postgres concurrency / real
  browser), not add a round. See the roadmap's behavioral doctrine.
- **The 19-site list (from one agent) was incomplete** — a completeness/critic pass found 2 HIGH more.
  Trust-but-verify agent enumerations; run a dedicated completeness pass for "did we cover ALL of X."
- **A fix can introduce a regression** — the workflow's own diff broke admin edit of private hubs; the
  adversarial verifiers caught it pre-commit. Always adversarially verify a security diff.
- **Never assume schema semantics** — `contentItems` has no `hubId`, so "Hub members only" was never
  wired; the first fix design (hub-membership resolution) was wrong. Read the schema.
- **deveco email is LIVE** (`emailNotifications=true`, console sink, no transport) — "OFF on all 3" is
  stale. `curl /api/features` before any flag claim. (Memory: `project_email_flag_state_2026_07`.)
- **No AI attribution in commits** (CLAUDE.md rule 15) — the harness default adds `Co-Authored-By`;
  strip it. (Amended `b6e8049e` for exactly this.)

## Docs
Plans: `session-231-remediation-roadmap.md` (master), `content-privacy-enforcement.md` (P-1/P-2/P-1b),
`federation-email-audit-fixes.md` (rounds 2-5 corrections + GDPR/RBAC), `contest-communications.md`.
Memory: `project_session_231_privacy_leak.md`, `project_email_flag_state_2026_07.md`.
