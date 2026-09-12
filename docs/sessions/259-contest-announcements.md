# Session 259 — contest announcements (organizer "message participants")

Plan: `docs/plans/contest-announcements.md`. Previous: `docs/sessions/258-handoff.md`.

## What was asked

An audit of where things stand, then a contest feature that lets an organizer send an
arbitrary email to all participants, "with the templating and all".

## Audit findings

The tree was clean on `main` and every package version matched what is published
(schema 0.66.0, config 0.40.0, server 2.134.0, layer 0.137.5, editor 0.17.2, infra 0.21.0,
migrations through 0048). Session 258's roll is complete and verified.

**One memory was materially stale, and it is the one that matters most for an email
feature.** `curl /api/features` on all three instances, 2026-09-12:

| | emailNotifications | contestReminders | contestEmailEditor | adminBroadcast |
| --- | --- | --- | --- | --- |
| commonpub.io | false | false | false | false |
| deveco.io | **true** | **true** | **true** | **true** |
| heatsynclabs.io | false | false | false | false |

**deveco.io delivers real mail.** `deveco-io/.github/workflows/deploy-prod.yml:54-57` writes
`NUXT_EMAIL_ADAPTER=resend` plus the key and from-address into the box `.env` from a CI
secret, and `gh secret list` shows `NUXT_RESEND_API_KEY` present since 2026-07-15. The old
"console sink, nothing is actually delivered" framing in `project_email_flag_state_2026_07`
was true in July and is not true now. Memory corrected.

The mirror of that fact: on the other two instances the outbox drain worker returns
immediately (`layers/base/server/plugins/email-outbox.ts:24`), so anything enqueued there is
never delivered and never errors.

Still open from 258: rotate the crates.io publish token, `sharp` to >= 0.35.0, and make
deveco's deploy able to fail.

## What was built

**v1 scope, chosen by the operator: send-now, registrants only.** Per-contest opt-out (P7),
the in-app notification (P8) and scheduling were deferred, not cancelled.

Most of the feature already existed for a neighbouring purpose. `renderEmailBlocks` already
turns a `BlockTuple[]` into email-safe HTML with `{token}` interpolation, escape-once,
http(s)-only URLs and absolutization; the outbox already chunks, throttles, retries and
dead-letters; `ContestEmailEditor.vue` was already an organizer block composer with a
sandboxed-iframe preview; `reminders.ts` already had the claim-first exactly-once idiom.
This was a composition job.

| | what | where |
| --- | --- | --- |
| P1 | `contest_announcements` + `contest_announcement_sends` + `contest_registrations.email_opt_out_at`, validators, **migration 0049** | `packages/schema` |
| P2 | audience resolver: ONE predicate shared by the count, the send and the claim | `packages/server/src/contest/announcements.ts` |
| P3 | `emailTemplates.contestAnnouncement` + the extracted shared email-safe palette | `packages/infra`, `layers/base/utils/contestEmailBlocks.ts` |
| P4 | `sendContestAnnouncement`, one transaction, ledger claim, chunked enqueue | `packages/server` |
| P5 | five routes under `/api/contests/:slug/announcements` | `layers/base/server/api` |
| P6 | `ContestAnnouncementComposer.vue` + an Announcements body tab | `layers/base/components/contest` |

Flag `contestBroadcast`, default OFF, taking the instance flag count from 47 to 48.

## Decisions worth carrying

**No new permission.** The plan sketch in `contest-communications.md` §4b proposed a
contest-scoped `contest.message`. Dropped. The same people already control
`contests.email_copy`, which is the copy of the reminder that automatically mails every
registrant on a schedule. The blast radius is already theirs; a second key would have added
a schema change and an admin surface while gating nothing new. The routes reuse the exact
organizer expression the two existing contest email routes use.

**The send refuses when `emailNotifications` is off (409).** Without it the drain worker
returns immediately, so enqueueing would produce a queue nobody delivers and a UI that says
"sent". Refusing beats a silent success.

**Two different guards for two different hazards.** A repeated REQUEST (double-click, a
client retry after a timeout) is caught by `UNIQUE(contest_id, idempotency_key)`: the second
call returns the first announcement and mails nobody. A repeated SEND of the same
announcement is caught by the ledger's `UNIQUE(announcement_id, user_id)` claim, which also
leaves the per-recipient record that answers "did Ada get this?". `broadcasts` has neither,
so a double-clicked admin blast still mails everyone twice.

**One predicate, three callers.** `audienceWhere` backs the count endpoint, the send, and
the ledger claim. Every audience test asserts `count === resolve().length` for the same
input, so a predicate that drifts in one place fails immediately rather than shipping an
organizer who approves 42 recipients and mails 51.

## What the local run found that the tests could not

The unit and integration suites were entirely green while two real defects were live.

**Every toast in the contest editor was invisible.** `AppToast` is mounted by
`layouts/default.vue`, and both contest editor routes are `layout: false`. So the send
confirmation, the existing "test email sent" toast, and every save error were created and
rendered nowhere. The E2E caught it by asserting on a success message after a real send.
**The class, not the instance:** of the four `layout: false` pages, three raised toasts and
only one (the content editor) hosted them. The docs editor had the same defect. Both fixed,
and pinned by `layers/base/__tests__/layoutlessToastHost.test.ts`, which scans the
layout-less pages, asserts a floor of four so it cannot pass vacuously, and was
mutation-tested against the pre-fix state.

**The editor tab row dragged the whole page into a horizontal scroll on a phone.**
`.cpub-cbc-tablist` was a bare `display: flex` with no wrap and no scroll; at 390px the row
is ~657px, so `scrollWidth` was 677. Pre-existing (it overflowed on the Overview tab too),
made worse by a seventh tab with a long label. Now scrolls inside its own box:
`min-width: 0` is the part that actually lets a flex item shrink below its content, and
`flex: 0 0 auto` on the tabs keeps the labels on one line.

## Verification

- schema 601, infra 194 (+4 skipped), config 39, server **2166**, layer **3015** — all
  green. Server and layer run serially, per the 258 note about `createTestDB()` cost.
- build 17/17, typecheck 30/30, lint 31/31 with zero errors.
- The audience predicate was mutation-tested: removing any of the opt-out, soft-delete or
  suspended-status clauses fails a test that exists specifically for it.
- New E2E `apps/reference/e2e/contest-announcements.spec.ts`, 6 tests, run against a real
  dev server and real Postgres: the count narrows with the tier; a participant gets 403 on
  all four routes and anonymous gets 401/403; the organizer composes, previews, confirms and
  sends, and both registrants land in `email_outbox` with the subject token resolved per
  recipient; a repeated idempotency key mails nobody twice; the composer does not scroll
  horizontally at 390px.
- Also verified in the DB directly: `contest_announcements` recorded 2 recipients, and both
  outbox rows carried `Kickoff for Announcement Cup <id>`, i.e. the `{contestTitle}` token
  resolved in the SUBJECT, not just the body.
- The README package table was stale from 258's release commit (it bumped six package.json
  files and not the table), so `readmeVersionParity` was red on `main`. Fixed.

## Self-audit pass (same session)

The feature was re-audited adversarially after it was "done". Every suite was green and
the E2E passed at that point; the audit still found **nine defects**, three of them real
bugs rather than comment or hygiene problems. Recording them because the pattern repeats
(memory `feedback_audit_your_own_fixes`).

| | what | how it was proven |
| --- | --- | --- |
| A-1 | **The ledger claim was decorative.** The send built its messages from the RESOLVED list, not the rows the claim inserted, while the doc comment asserted "a repeated SEND is caught by the ledger". The code did not do that. | Read the code against its own comment |
| A-2 | **Email subjects were double-escaped.** Token values were HTML-escaped before interpolation, so a contest called `Q&A Jam` shipped as `Q&amp;A Jam`. Both pre-existing contest templates pass raw values, and `interpolateTokens` documents that it must only be used where no HTML is emitted. | A probe rendering the same subject through both templates side by side |
| A-3 | **The token map was hand-built in four places** (send, preview, test, UI list) and had ALREADY drifted: the composer advertised five tokens while the server resolved six. `{deadline}` and `{timeRemaining}`, promised by the plan and offered by both existing contest emails, were not implemented at all. | Grep for the token literals |
| A-4 | **Five casts with no precedent in the repo** (`tx as DB` twice, `as never` twice, `as Promise<...>` once). `reminders.ts` passes `tx` bare. | Removed all five; the server typechecks clean, so they silenced nothing real |
| A-5 | **The new E2E would have skipped in CI forever.** It self-skips when `contestBroadcast` is off, and the e2e job sets neither that flag, nor `emailNotifications` (the send refuses without it), nor `emailUnverified` (an e2e signup is never verified, so the audience resolves to zero). | Read `ci.yml`; confirmed `email_verified = false` for e2e users in the dev DB |
| A-6 | The `status` column comment claimed a crash mid-send would be visible as `sending`. One transaction makes that impossible. **This one was identified in the second pass and then not actually fixed** -- a THIRD pass, run before publishing, found the comment still there. Finding a defect and closing it are two different events. | Read the code |
| A-7 | **The abuse bound was checked before the idempotency short-circuit**, so a client retrying an already-sent announcement could get a 429 for work it was not repeating. | Moved into the send; pinned by a test that fails when the order is swapped |
| A-8 | A dead `contestTitle` prop on the composer, and two dead exports. | Grep for callers |
| A-9 | The composer never surfaced `emailNotifications` being off, so an organizer on commonpub.io would write a whole email and meet a 409 at the end. | Reading the flag gate against the UI |

**Cleared on inspection, rather than assumed:** the `role="radiogroup"`/`role="radio"` button
pattern and the inline `role="alertdialog"` confirm both match established repo precedents
(`BlockQuizView`, `admin/persona.vue`); the extracted email palette is byte-identical to the
inline one it replaced; the migration journal has 50 unique entries with a contiguous idx
chain and `db:generate` reports no pending changes; the multi-root `<AppToast />` produces
zero console warnings and no hydration mismatch, measured in a real browser.

### The part worth carrying: a guard I wrote was vacuous, and mutation testing caught it

The first claim-first test passed **with the fix reverted**. It asserted the current
behaviour without distinguishing claimed-from-resolved, because v1's single selector cannot
resolve the same person twice (`contest_registrations` is UNIQUE on contest+user) so the
distinction has no reachable failure path through the public API. That is exactly how a
guard ends up decorative with a green test sitting on top of it.

The fix was to extract `claimAnnouncementRecipients` and test it directly with the duplicate
input the planned audience UNION will produce. Two real mutants now fail (disabling the
claim filter, removing the duplicate dedupe) and a no-op edit still passes.

**Verified after the audit:** server 2178, layer 3019, schema 601, infra 197, config 39,
editor 267, ui 272, protocol 431, auth 98 - all green. Build 17/17, typecheck 30/30, lint 0
errors. The 6 E2E tests re-run against a dev server restarted on the rebuilt `dist`. And an
end-to-end probe through the real stack confirmed the two user-visible fixes in a queued
email: subject `News about Q&A Jam ...` (raw ampersand) and body
`Closes September 14, 2026 at 07:50 UTC, about 36 hours left.`

A note on the cycle: `vue-tsc` caught a stale prop in a test file that vitest's esbuild
happily compiled (memory `feedback_vue_tsc_strict_vs_vitest`), and the dev server had to be
restarted to pick up the rebuilt package `dist` (memory `feedback_dev_server_dist_restart`).

## Found while auditing, not fixed

- `broadcastInputSchema.subject` has no CRLF guard, and `adminBroadcast` is ON on deveco
  with a live transport. One line; the announcement schema guards it.
- `sendBroadcast` has no idempotency ledger.
- `memory: project_email_flag_state_2026_07` was stale and has been rewritten.
- `broadcastInputSchema` also has no idempotency key, so the admin blast can still
  double-send on a double-click. The announcement schema now requires one.

## Release runbook (session 259)

**The cascade is the part that bites.** Internal deps are declared `workspace:*`, which
publishes as an EXACT pin -- verified against the live registry: `@commonpub/auth@0.13.3`
pins `@commonpub/schema` at exactly `0.66.0`. So a package that pins a CHANGED package must
republish, or the consumer resolves two copies of it and keeps the old content.

Source changes: **config, schema, infra, server, test-utils, layer**.
Cascade republishes (pin refresh only): **protocol, auth, editor, explainer, learning**.
Unaffected (no changed deps): docs, persona, theme-studio, ui.

| package | from | to | why |
| --- | --- | --- | --- |
| config | 0.40.0 | 0.41.0 | `contestBroadcast` flag |
| schema | 0.66.0 | 0.67.0 | announcement tables + migration 0049 |
| infra | 0.21.0 | 0.22.0 | `contestAnnouncement` template |
| server | 2.134.0 | 2.135.0 | audience / send / tokens |
| test-utils | 0.5.17 | 0.5.18 | mock config flag |
| layer | 0.137.5 | 0.138.0 | composer, routes, editor tab, two fixes |
| protocol | 0.15.3 | 0.15.4 | cascade: pins config |
| auth | 0.13.3 | 0.13.4 | cascade: pins config, protocol, schema |
| editor | 0.17.2 | 0.17.3 | cascade: pins config, schema |
| explainer | 0.9.1 | 0.9.2 | cascade: pins config, editor, schema |
| learning | 0.5.5 | 0.5.6 | cascade: pins config, editor, explainer, schema |

Publish in dependency order: config, schema, infra, protocol, auth, editor, explainer,
learning, test-utils, server, layer.

### The fork pins must be hand-edited

Both forks caret-pin on 0.x, and **a caret on 0.x does not cross a minor**:

```
@commonpub/config: ^0.40.0   ->  will NOT reach 0.41.0
@commonpub/layer:  ^0.137.5  ->  will NOT reach 0.138.0
@commonpub/schema: ^0.66.0   ->  will NOT reach 0.67.0
@commonpub/server: ^2.134.0  ->  WILL reach 2.135.0 (2.x caret allows minor)
```

The `schema` pin is the dangerous one: the fork's deploy runs `db-migrate.mjs` against the
migrations folder shipped INSIDE `@commonpub/schema`. Leave it at `^0.66.0` and there is no
`0049` in that folder, so the migration is silently skipped and the tables never exist.

### Resolvers differ per fork, so both lockfiles matter

- **deveco**: CI is `pnpm install --frozen-lockfile` (so `pnpm-lock.yaml` gates CI) and the
  Dockerfile is `npm install` (so `package-lock.json` is what actually ships). Update BOTH.
  `scripts/check-single-vue.mjs` reads `package-lock.json`.
- **heatsync**: no CI; the Dockerfile is `npm install` and `deploy.yml` runs the same guard
  against `package-lock.json`. Merging IS deploying there.
- `npm@10.9` crashes in arborist on these graphs; use `npx npm@11` for the lock update.

### commonpub.io deploys itself on merge

`.github/workflows/deploy.yml` triggers on push to `main` (paths-ignore is docs-only, and
this touches code). It runs `scripts/db-migrate.mjs` with a hard failure, then
`scripts/smoke.mjs` which waits on `/api/health` and verifies real pages. That is a properly
gated deploy, unlike deveco's warn-only post-deploy check (P1-10/P1-11, still open).

### Order

1. PR green (all jobs, read per job -- `e2e` has `needs: check` and SKIPS on a red gate).
2. Squash merge -> `main`. commonpub.io deploys itself; verify AFTER its swap.
3. Release commit on `main` (version bumps only), push, CI.
4. Publish all eleven to `--tag next`.
5. Draft PR in deveco pinned to the rc; let its CI typecheck the REAL tarballs.
6. Promote to `latest`.
7. deveco, then heatsync. Verify each AFTER its swap, never during.

**deveco ships `contestBroadcast: false`.** It has a live Resend transport, `emailNotifications`
on and a live contest. Nothing in this roll changes send behaviour there, but the first real
announcement must be a test to the operator's own address, then one small audience.

## Next

1. **Nothing is published or rolled.** Release order: schema, config, infra, server, layer.
   Publish to `--tag next` and let deveco's CI typecheck the real tarballs before `latest`
   moves. Ship nothing else in the same deploy.
2. **Roll with `contestBroadcast: false` everywhere, deveco last.** deveco has a live Resend
   transport and `emailNotifications: true`, so the first send there reaches real inboxes.
   Test-send to the operator's own address, then one small audience, before any full blast.
3. P7 (per-contest opt-out) needs no migration: the column ships in 0049 and the predicate
   already reads it. Only the scoped unsubscribe token, the route branch and the footer link
   remain.
4. P8 (the in-app notification) is what makes this feature do anything at all on
   commonpub.io and heatsynclabs.io, where the send currently refuses.
