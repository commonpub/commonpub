# Session 231 Handoff — security batch (content/hub privacy + GDPR export + RBAC), all committed on-branch

Date: 2026-07-12. Branch **`session-231-content-privacy`** (NOT pushed / published / deployed).
Fix commits: `b6e8049e` (privacy P-1/P-2) + `df0486f3` (P-1b) + `3de11931` (GDPR export) + `e3cf8c8c`
(RBAC ceiling) + `3ae5fc20` (Phase-0 outbox date-bomb, now green) + `4fb0af34` (**pre-roll audit:
forkContent gate + 2e private-hub AP gate**); plus `c6d80423` (plans) + doc commits. **Security batch
COMPLETE, full server suite 1656 pass / 0 fail, and BEHAVIORALLY VERIFIED (app run + unauth curl of
every leak site — see below).** Nothing rolled yet.

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

**Security batch #1-#3 all COMPLETE on-branch** (privacy `b6e8049e`+`df0486f3`, GDPR `3de11931`,
RBAC `e3cf8c8c`). **Next: ROLL the batch.** NOTE: RBAC touched `packages/auth` + `packages/schema`,
so the roll publishes **schema → auth → server → layer** (more than the server+layer of #1/#2) +
CLI re-pin + both consumer lockfiles. No migration. Include the **Meili reindex** step (from #1).
curl the leak sites unauthenticated before/after; RBAC changes are latent behind `features.rbac`
except the `contest.pii` matcher (verify no operator hand-built a `contest.*` role expecting PII). **The eventual
roll** (recommended before too much else stacks up): publish `@commonpub/server` + `@commonpub/layer`,
deploy to all 3 **with the Meili reindex step**, and curl each leak site UNAUTHENTICATED before/after
(esp. `/api/hubs`, `/api/events`, `/api/content/<members-slug>`, `/api/hubs/<private-slug>/posts`).

## Remaining roadmap (verified priority — `session-231-remediation-roadmap.md`)

1. **Content/hub privacy** — P-1/P-2/**P-1b all committed**. **Ready to ROLL** to all 3 (next action).
2. **GDPR data-export completeness** — **DONE (commit `3de11931`).** Added ~15 subject-scoped tables
   (referral, hub posts/replies, videos, learning paths, products, docs, files, content versions,
   certificates, reports + hub flags own-statement, held IPs/terms). Third-party discipline verified
   (report/flag rows projected to own fields; referral never enumerates referred users); secrets
   (keypairs/sessions/accounts) + audit_logs excluded; JSDoc corrected. Tests assert subject-present /
   third-party-absent / secret-absent. No migration.
3. **RBAC** — **DONE (commit `e3cf8c8c`).** Privilege ceiling on createRole/updateRole/
   setUserCustomRoles (+ metadata-only edits + self-assign guard) — a `roles.manage` holder can no
   longer mint/self-assign grants above their own; `contest.pii` is now a wildcard-protected leaf
   (`contest.*` no longer reaches it; admin `*` + staff exact-grant still do). `event.create` left
   ungated on purpose (gating would 403 every member — seeded to staff/admin only); dead keys kept.
   Latent behind `features.rbac` except the matcher. Tests assert deny+allow sides. No migration.
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

---

## Pre-roll deep audit (final turn) — behaviorally verified, 2 more live leaks fixed

A 3-agent deep audit before rolling: (1) whole-branch adversarial re-attack, (2) roll-readiness /
consumer-breaking-change, (3) **behavioral verification (ran the app + unauth curl)**.

**BEHAVIORAL VERIFICATION — PASSED.** The reference app was brought up against a throwaway PG DB,
leak fixtures seeded, and every site hit UNAUTHENTICATED through the real Nitro route layer (not the
helpers the tests use — the known coverage gap). All closed, no over-block: `/api/hubs` omits the
private hub; `/api/content/<members|private-slug>` → 404; public control → 200; `/api/hubs/<priv>/posts`
→ 403; `/api/events` omits private-hub event; legacy AP `/content/<members>` → 404. **This is the
"change medium" gate every methodology audit demanded — the fix works at runtime, not just in units.**

**Two MORE live leaks found + fixed this turn (`4fb0af34`):**
- **forkContent** (`POST /api/content/<id>/fork`) copied a source item's FULL body with no
  visibility check → any authed user could exfiltrate anyone's members/private/draft content by id.
  Gated with `visibleContentWhere(userId)`.
- **2e private-hub AP surface** — the deferral said "latent behind `federateHubs` OFF", but a live
  `curl /api/features` shows **`federateHubs` is ON on commonpub.io + deveco.io**, so a private hub's
  AP Group actor + **follower roster** + outbox were served unauthenticated. Fixed: `buildHubGroupActor`
  null-for-private, the 4 AP routes + webfinger 404/skip private, all 5 outbound `federateHub*` skip
  private. Gate = `privacy==='private'` only (unlisted/public still federate). R9/R10 public↔private
  lifecycle deferred as a follow-up.

**#4 Phase 0** (outbox date-bomb) fixed (`3ae5fc20`) — suite now fully green.

**Live flag state (verified `curl /api/features`, matters for the roll):** `events` ON all 3 (the
events privacy fix is live-relevant); `federateHubs` ON commonpub+deveco (why 2e was live);
`publicApi` ON deveco (public/v1 routes reachable there — spot-check at roll).

**Roll sequence (from the roll-readiness audit — NO migration):** publish **schema 0.56→0.57 → auth
0.9→0.10 → server 2.105→2.106 → layer 0.97→0.98** (order load-bearing; layer via `pnpm publish:layer`).
No consumer-breaking change (the 3 RBAC signature changes only affect the updated layer routes; forks
don't call them; `getHubBySlug`/`hasPermissionPure` are additive/unchanged). Then: CLI re-pin
(schema^0.57/server^2.106/layer^0.98), fork `package.json` pin bumps (0.x carets need hand-edit) +
lockfiles (deveco npm gitignored / heatsync pnpm tracked), and **`POST /api/admin/search/reindex`
IMMEDIATELY post-deploy per Meili instance** (the visibility filter ships with the code that writes
the field, so you reindex after, not before — else search fails closed/empty). Run **full `pnpm test`**
before publishing. Post-deploy, run the unauth **curl checklist** (below) on all 3.

**Curl checklist (per instance, unauthenticated):** `GET /api/hubs` (private slug absent),
`/api/content/<members-slug>` (404), `/api/content/<public-slug>` (200 control),
`/api/hubs/<private-slug>/posts` (403), `/api/events` (private-hub event absent; only if events ON),
`/content/<members-slug>` Accept:activity+json (404), and — new — `/hubs/<private-slug>` +
`/hubs/<private-slug>/followers` Accept:activity+json (404, 2e). Check `/api/features` first.

**Deferred (LOW, tracked): `createComment` write-abuse** into a private hub (content injection;
mitigated — UUID now non-discoverable, notification templated) — "fix next" per the audit; anon
`getHubBySlug` real-id stub; `profileVisibility` (inert). R9/R10 hub-federation lifecycle.

---

## Contest registration + reminders + Callout fix (SEPARATE workstream — branch `contest-registration-reminders`)

Distinct from the security batch above. Committed `faa5bb3f` on branch **`contest-registration-reminders`**
(NOT pushed / rolled). Satisfies a Qualcomm partner ask (via Jinger Zeng): (1) registration
confirmation email, (2) automatic deadline reminders to participants. Plus fixes the editor Callout
("tip block") reversed-text bug from the same thread.

**What shipped (`faa5bb3f`, 35 files, migration 0040 additive-only):**
- **Registration** — new `contest_registrations` (audience concept: sign-up independent of any
  attached content; a `contest_entries` row needs content so it can't be the mail audience). Server
  `contest/registrations.ts`; API `POST/DELETE/GET /api/contests/:slug/register` (`requireAuth` +
  `canViewContest` gated); `ContestSidebar.vue` register card (count, cancel, login-redirect, state via
  text+icon + `aria-pressed`).
- **Confirmation email** — enqueued on a genuinely-new registration, gated `emailNotifications` + a
  mailable target. `contestRegistrationConfirmation` template (templates.ts:99).
- **Deadline reminders** — `contest/reminders.ts` `sweepContestReminders`: one idempotent sweep, safe
  on every replica, mails each registered+verified+not-unsubscribed participant once per milestone
  (7d/48h/24h/1h) via a UNIQUE `(contest,user,milestone)` ledger claim (`contest_reminder_sends`).
  Nitro plugin `contest-reminders.ts` (stagger 18000, ~10min interval) drives it, inert until an
  operator opts in. Gated behind NEW flag **`contestReminders`** (default OFF) AND `emailNotifications`.
  Flag wired at all 7 touchpoints. `contestDeadlineReminder` template (templates.ts:133).
- **Hardened `getNotificationEmailTarget`** to honor `unsubscribedAll` at the source (was verify-only) —
  fixes the one P2 the verifier caught (confirmation would mail a globally-opted-out user) for every
  current + future caller. `notification-email.ts` already pre-filters, so redundant-safe there. New
  regression test.
- **Callout/Quote reversed-text FIX** — root cause: body was a *controlled* `v-html` contenteditable
  that re-assigned `innerHTML` every keystroke → replaced the text node → caret collapsed to offset 0 →
  input reversed ("make"→"ekam"). Now *uncontrolled* (seed once on mount, write back only on genuine
  external change, mirroring TextBlock). Regression test types char-by-char through the real parent
  round-trip and asserts text-node identity is preserved.

**Verified:** server typecheck ✓; full server suite **1674 pass / 0 fail** (incl. new registration +
reminder + the unsubscribedAll regression); editor **245 pass** (incl. Callout regression); server
build ✓; reference (vue-tsc) typecheck exit 0. Working tree clean, no AI attribution.

**Operator enable checklist (to actually deliver mail):** (1) `emailNotifications` ON + wire a real
transport (`NUXT_RESEND_*`) — today only deveco has email on, console sink, so nothing sends yet;
(2) `contestReminders` ON in `/admin/features`; (3) sweep plugin then runs automatically. Qualcomm copy
pastes into `packages/infra/src/email/templates.ts` — confirmation subject :116 / body :118-121;
reminder subject :149 / body :151-154.

**DONE (session 232): per-contest email-template EDITING UI.** Shipped on this same branch
(`contest-registration-reminders`, commits `3398feae` + audit polish `a96197d3`). Organizers can now edit
the confirmation + reminder subject/intro per contest (safe plain-text + fixed token allow-list, override
with built-in fallback), behind a new default-OFF `contestEmailEditor` flag. Audited by 3 independent
reviewers (no P0/P1; byte-identical defaults; no leak; additive migration 0041) and verified live in a
real browser round-trip. See `docs/sessions/232-contest-email-template-editor.md`. **This branch now
bundles THREE unrolled workstreams — the P1 security batch, registration+reminders, and the email editor
— so any roll ships all three (see the roll note below + `docs/sessions/233-kickoff.md`).**
