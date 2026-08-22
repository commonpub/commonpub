# Session 256 — Handoff

Contest funnel, conditional form fields, two audit rounds, four security fixes.

**ROLLED AND LIVE on all three instances, 2026-08-21.** schema 0.66.0, config
0.40.0, protocol 0.15.2, auth 0.13.1, editor 0.17.2, explainer 0.8.2, learning
0.5.3, test-utils 0.5.17, server 2.133.0, layer 0.137.0. **47 flags.** No
migration. Verified on each instance, not from a workflow badge.

The cascade was derived from the dependency graph after confirming on the
registry that `workspace:*` publishes as an EXACT pin — so protocol, auth,
editor, explainer and learning were republished purely to refresh pins, with no
source change. Skipping them would have left consumers resolving two copies of
schema.

The prerelease gate earned its place: layer went out as `0.137.0-rc.1` under
`next`, the deveco fork's CI verified the published artifact, and only then was
it promoted.

Detail: `256-contest-funnel-and-conditional-fields.md`. Design:
`docs/plans/conditional-form-fields.md`. Audits:
`docs/reviews/platform-audit-2026-08-21.md` (round 1) and
`platform-audit-round-2-2026-08-21.md` (round 2).

## Why this session happened

Real feedback from deveco's live Resilient America contest: *"people aren't sure
how to submit a project; they may not know you need to register."* 19 registered,
2 entered.

Two causes, and neither was a broken control.

**Registration is not entry.** `registrationMode` is `light` on every live
contest, so registering creates a participant record and the entry is a separate
act. The sidebar said *"Registering enters you into the contest"*. A maker
registered, read that they were entered, and never submitted. One string.

**The proposal path was switched off.** deveco's current stage was proposal-mode
with an EMPTY `submissionTemplate`, and both `currentProposalStage` and
`ContestProposalForm` guard on `template.length`, so the whole path rendered
nothing and nobody was told. The operator has since added fields (see below).

## State of the working tree

| Gate | Result (uncached, end of session) |
|---|---|
| `pnpm turbo run typecheck --force` | 30/30 |
| `pnpm turbo run lint --force` | 29/29, 0 errors |
| layer | 199 files / 2,901 tests |
| schema · config · editor · infra · protocol | 587 · 39 · 267 · 183 · 431 |
| persona · ui · explainer · learning · docs · test-utils | 169 · 272 · 191 · 101 · 131 · 13 |
| public API OpenAPI route parity | 36 |
| `packages/server` | green **apart from 7 pre-existing persona failures** |

Those 7 are not from this work: identical failures, same files, same line
numbers, with the session's changes stashed.

**Correction (verified, replacing an earlier claim in this document).** These 7
failures are NOT caused by session 255's leftover rows in the shared dev database.
That explanation was asserted without testing it. Running both suites against a
freshly created, completely EMPTY database reproduces all 7 identically, and
`realpgdb.ts` already creates and drops a fresh schema per test file. They are a
genuine pre-existing defect in the persona metrics logic on `main` — the
assertions that fail are about k-anonymity re-flooring and finalised-day reads
(`raised.suppressed` expected 1, got 0), not about row counts. Still unrelated to
this session's changes (identical with the work stashed), but they are a real bug
to fix, not cruft to clear.

## What shipped in the tree

**Conditional form fields.** `showWhen` on a field or a whole section, keyed on an
earlier `select`/`radio`/`checkbox`. Hidden means not shown, not required, not
stored. `visibleFormFieldKeys` in `@commonpub/schema` is the single source of
truth for the renderer, the client gate, the payload builder and the server
validator. **No migration** — it lives in the existing jsonb. Flag
`contestConditionalFields`, default ON, gates what the builder offers; a stored
rule is always honoured. Documented in `docs/reference/guides/contests.md`.

**Funnel fixes.** Mode-aware registration copy; a "Next: submit your project" step
for a registered participant with no entry; errors no longer rendered on a
pristine form (deveco's showed 20 on load, each in a `role="alert"`); a
missing-answers summary that focuses the first offender; `aria-invalid` /
`aria-describedby` / `aria-required` on the controls; a warning when a stage is
proposal-mode with no fields.

**Field keys frozen once saved.** A key is what every stored answer, private-field
row and agreement acceptance hangs off. It is no longer regenerated from a label
edit for server-supplied fields, across all three producers of `FormField[]` — the
registration builder, each stage's template, and the markdown importer.
`lockedKeysWiring.test.ts` pins the wiring, because a declared-but-unpassed prop
looks exactly like a working fix.

**Sanitizer balances tags.** Both layer sanitizers close what the author left open
and drop close tags matching nothing, with implied-end-tag handling for `p`, `li`,
`dt`/`dd`, `td`/`th`/`tr`, `option`. This is what stopped deveco's truncated rules
corrupting the contest page (3 hydration mismatches → 0). `sanitizeBlockHtml`
included, because the same gap guards remote federated content.

**Cover-image notice.** *"Please do not use generative AI for your cover image.
It's tacky and lame."* One constant in `utils/coverImageNotice.ts`, on all four
cover-upload surfaces, scoped to `purpose === 'cover'`.

**One proposal per entrant.** `submitContestProposal` only capped when
`maxEntriesPerUser` was set, and it is `null` on the live contest — so a double
submit created two entries and two draft projects. The rule now defaults to 1
(an explicit cap still wins) and refuses before `createContent`, so no orphan
draft. Demonstrated on a replica of the live contest, then fixed.

**Four security fixes** — image-proxy SVG neutralization, inbox DM fan-out bounds,
hub-post AP Note scoping, and the private-project BOM leak. Plus a behaviour
change: `POST /api/auth/oauth2/register` no longer returns an existing client's
`client_secret` on a repeat registration.

## Rolling it

No migration. Flags **46 → 47**; `MIN_FLAGS` and `ENV_FLAG_MAP` are both updated.

Cascade — `workspace:*` publishes as an EXACT pin, so anything above a bumped
package must be republished or consumers resolve two copies:

```
schema  →  server  →  layer
config  →──────────────┘
test-utils (mockConfig needs the new flag, or a consumer's typecheck fails)
```

```bash
pnpm publish:check                       # build + typecheck + test
pnpm publish:all
pnpm --filter @commonpub/layer publish --no-git-checks --access public --tag next
```

Then a **draft PR on the deveco fork pinned to the rc** — that fork's CI is the
only thing that typechecks the published layer — then `npm dist-tag add … latest`
and repin.

## Open, ranked

1. **deveco's Official Rules.** Truncated at exactly 50,000 characters mid-word,
   and carrying **31 unresolved `[CONFIRM: …]` placeholders** including the
   proposal submission deadline and the sponsor's legal entity name, in a document
   19 people have accepted. The full text exceeds the cap, so this needs a
   decision: move the long form to a docs page (recommended), shorten it, or raise
   `CONTEST_RICH_TEXT_MAX`. Only that one contest is affected across all three
   instances — checked via the DETAIL endpoint, since the list serializer omits
   `rules` and a list-level scan reads 0.
2. **`registrationTier` seeds `null`, so `mustRegisterFirst` is true for everyone
   during SSR.** A registered entrant is served *"Register for this contest"* on
   every page load. Deliberately not fixed here: the correct change is one
   pending-state rule across all 23 `server: false` sites, not a patch on the
   contest page.

   **This is worse than a flash, and the sanitizer fix already masks it.** On a
   contest whose body HTML is unbalanced, the hydration mismatch makes Vue abandon
   patching that subtree, so the Entries CTA stays frozen at its SSR state and the
   Submit Entry button never appears there at all. Proven by reaching the same page
   by client-side navigation, where it renders correctly. Balancing the sanitizer
   removes the mismatch and the freeze — but the underlying zero-seed remains, and
   any future mismatch on that page will resurface it.
3. **Contest entries fetch has no `limit`** — the server defaults to 20 and
   nothing paginates, so past 20 entries a participant's own `myEntries` empties,
   their stage-submission form vanishes, and the proposal form reappears inviting
   a duplicate entry. deveco has 2 today, but that changes fast now the proposal
   form is live.
4. **Fix the 7 failing persona metrics tests — CI on `main` is red because of
   them.** Established by re-running `main`'s own CI at the unchanged commit
   `e4694a97`: green on 2026-08-17, red today with the identical 7. So it is
   neither this release nor test-data pollution. The tests are date-anchored
   (`'2026-08-12'`, finalised-day reads), so the fixtures appear to age out of a
   roughly week-wide window — a time bomb in the tests. deveco has the persona
   flags ON, so the underlying behaviour is worth checking too, not just the
   fixtures.
5. From round 2, unfixed: OAuth aside, `sitemap.xml` publishes `members`/`private`
   profile URLs, RSS emits raw C0 control characters (one bad title makes the whole
   feed a fatal parse error), and lesson slugs are unique per module but resolved
   per path.

## deveco contest config, as of end of session

The operator applied the proposal form and the non-US fix. Verified live:

- **Done:** `title` is the first field's key (drafts are named from the entrant's
  answer, not `"<Contest> proposal"`); the US-residence checkbox is no longer
  required, so a non-US maker can register and the "I don't qualify" checkbox
  below it is reachable.
- **Still outstanding:** `details_2` and `details_3` are the keys on *Focus area*
  and *Repository or project link*, and the CSV export prints `key: value`
  (`export.ts:36`), so those columns read `details_2: …`. Renaming the label will
  NOT fix them — their keys no longer track their labels — so they must be
  **deleted and re-added**. There is also a duplicate question (`approach` and
  `your_technical_approach_including_hardwa`), and 7 labels carry a leading space
  from pasting.

## Local dev-DB cruft left by this session

Not removed, since deleting rows is destructive and it is your database:

- contest `resilient-america-local` (a copy of deveco's, 3 registrations, 2 entries)
- 6 test accounts matching `%1787%@example.com`, `fresh+%`, `dev+%`

~~Independently, session 255's persona rows are what make the persona suites fail
locally.~~ **That was wrong, and is now fixed.** See "The persona suites were
not failing because of your database" below.

## Two things worth carrying forward

**A fix lands at the symptom's location unless you go looking for the cause.**
Three times this session a fix reached one of several call sites: `canSave` kept
its `dirty` gate after the missing-field gate was removed; `lockedKeys` reached
one of three `FormField[]` producers; the focus repair covered 10 of 12 field
types. Each was caught by auditing the fix, not the original code. After fixing
something, enumerate every producer and consumer of what you changed, then pin the
enumeration with a wiring guard.

**The browser harness stopped delivering pointer events mid-session**, twice, and
the first time it produced a confident false report of a broken control. Probe it
(attach a `pointerdown` listener and assert the event arrives) before trusting a
"this button does nothing" observation.

---

# Addendum: after the roll

## The signup outage, and what caused it

Shortly after the 0.137.0 roll, signup returned **500 on deveco.io and
heatsynclabs.io** while commonpub.io was fine. The user row was never written,
so both new and existing accounts looked broken.

Root cause, reproduced locally against an `npm install` tree:

```
[Better Auth]: The field "issuer" does not exist in the "account" Drizzle schema.
```

`@commonpub/auth` declared `better-auth: "^1.2.0"`. Regenerating the forks'
lockfiles during the pin bump floated better-auth **1.6.29 -> 1.7.1**, and 1.7.1
expects an `account.issuer` column that `@commonpub/schema` does not declare.
better-auth's Drizzle adapter asserts that every field it knows about exists on
our tables, so a MINOR bump can hard-break authentication.

**commonpub.io escaped only because it builds from the pnpm workspace** rather
than from npm. That is the discriminator worth remembering: the forks consume
*published* packages, and the production Dockerfile builds them with
`npm install` against `package-lock.json`, not the pnpm lockfile CI uses.

Fixed in two layers:

- Immediate, in both forks: `overrides` + `pnpm.overrides` pinning
  `better-auth: "1.6.29"`.
- Upstream, so it cannot recur: `@commonpub/auth@0.13.2` narrows the range to
  **`~1.6.29`**, which still takes patches but cannot cross to 1.7.x. The
  reasoning is recorded next to `createAuth` so a future bump does not have to
  rediscover it. Crossing to 1.7.x needs a schema migration first.

All three instances verified after the fix: signup 200, session cookie set,
`/api/me` 200, and `emailVerified: false` on a working session, which is the
behaviour the operator asked for (an unverified account can still sign in).

## The persona suites were not failing because of your database

The earlier note in this handoff blamed session 255's leftover rows. **That was
wrong.** Settled by re-running main's own CI at unchanged commit `e4694a97`:
green on 17 Aug, red on 21 Aug with the identical 7 failures. Nothing about the
code changed between those runs; the calendar did.

`snapshotIsUsable` refuses a finalised day older than
`PERSONA_SNAPSHOT_MAX_AGE_DAYS` (7). The fixtures hardcoded `2026-08-12` and
`2026-08-13`, so the suite passed for about a week after it was written and then
failed every day after that. Day keys are now derived from the current UTC day.

The month/year boundary test keeps its literals on purpose: there the arithmetic
is the subject, not the fixture, so expressing it via the helper it pins would
make it vacuous.

Scanned for the same rot class elsewhere. `PERSONA_SNAPSHOT_MAX_AGE_DAYS` is the
only staleness window in the codebase, and the two other persona-adjacent
fixtures (`persona-public-routes.test.ts`, `admin/persona-metrics.test.ts`) feed
mocked dates that never reach the gate, so they cannot rot the same way.

## The mobile menu could not be scrolled

`.cpub-mobile-menu` is `position: fixed; inset: 0`, which caps its height at the
viewport, and it declared no `overflow`. Every row past the fold was
**unreachable by any gesture**, not merely hidden.

The nav gets there easily: `MobileNavRenderer` flattens each dropdown into a
section label plus its children, and signing in appends Create, Dashboard,
Messages and Notifications. Measured signed in against the reference config:

| viewport | content | space | result |
| --- | --- | --- | --- |
| 375x667 | 802px | 619px | Fediverse, Search, Create, Dashboard unreachable |
| 360x640 | 802px | 592px | worse |
| 390x844 | 802px | 796px | overflows by 6px |

Fixed in the layer (`0.137.2`) and, separately, in deveco's `layouts/default.vue`
fork, which has its own `.de-mobile-menu` with 44px rows under a 60px bar and so
bites sooner. `overscroll-behavior: contain` stops a gesture that reaches the end
from scrolling the page behind the overlay; the `dvh` height keeps the last row
clear of mobile browser chrome.

Verified at all three sizes: the menu scrolls, the last row comes into view, and
the page behind does not move. Pinned by
`layers/base/layouts/__tests__/mobileMenuScroll.test.ts`, which is source-level
because the defect lives in the layout's own `<style>` block, which a mounted
component test never applies.

**The avatar dropdown was checked and is fine** at these sizes: it fits on
screen with no clipping.

## Open follow-ups

- **`@commonpub/docs@0.6.3` pins stale `@commonpub/config@0.12.0` and
  `@commonpub/schema@0.16.0`.** Visible as duplicate versions in the forks'
  lockfiles. Pre-existing, not from this session, and docs works today, but it
  is the exact split-brain the exact-pin cascade rule warns about: npm consumers
  get two copies while the workspace never sees it. Republishing docs cascades
  another layer publish, so it was not done mid-deploy.
- **Test accounts created on production during diagnosis** and not removed
  (deleting is destructive and they are the operator's instances):
  `authprobe+1787358990729@example.com` (commonpub.io),
  `authprobe+1787360201472@example.com` (deveco.io),
  `authprobe+1787360573552@example.com` (heatsynclabs.io), plus one
  `authprobe+1787364...@example.com` per instance from the final verification
  pass, and `ba630_...@example.com` on the local dev DB.
- The deveco contest items in the section above are still outstanding on the
  operator's side: Required on *Focus Area*, the duplicate `approach` question,
  the leading-space labels, and the Official Rules truncated at 50,000 chars
  with 31 `[CONFIRM: ...]` placeholders including the proposal deadline.

## Final state, verified live on all three

| | commonpub.io | deveco.io | heatsynclabs.io |
| --- | --- | --- | --- |
| mobile menu scrolls | yes | yes | yes |
| flags | 47 | 47 | 47 |
| health | ok | ok | ok |
| signup / session / sign-in | 200 | 200 | 200 |

Shipped: `@commonpub/auth@0.13.2`, `@commonpub/server@2.133.1`,
`@commonpub/layer@0.137.2`.

One thing to carry forward from the roll itself: **the first deveco verification
polled the wrong workflow run.** Listing runs immediately after a merge returns
the PREVIOUS deploy, which was already green, and it reported success for a build
that did not contain the change. The served CSS is what caught it. Match the run
to the merge commit's SHA before believing a deploy, and check the artifact, not
the workflow's colour.

---

# Addendum 2: post-roll audit

Everything below was found by auditing the session's own work after it shipped.

## CI on main was red, and it was not the persona tests

After the persona date fix, CI stayed red. The obvious reading was that the fix
had not worked. It had: **2138 server tests passed, zero failed.** The job still
exited 1, on a vitest `Unhandled Errors` block:

```
Uncaught Exception: error: terminating connection due to administrator command
(57P01), originating in src/__tests__/concurrency.integration.test.ts
```

`createRealTestDB().cleanup()` ends the pool and then drops the throwaway
database `WITH (FORCE)`, which terminates any connection that outlived
`pool.end()`. `pg` raises that on the pool's behalf as an `'error'` event, and
**an `'error'` event with no listener is an uncaught exception**, which vitest
treats as a run failure regardless of test results. On a loaded CI runner the
race is wide enough to fire reliably; locally it never did.

None of the four pools in `helpers/realpgdb.ts` had a listener. They do now. The
long-lived one distinguishes teardown (expected, dropped) from anything earlier
(logged rather than swallowed, since an idle-client error mid-suite is real
signal). Corroborating evidence: leaked `cc_test_*` databases on the local dev
Postgres, which is the same teardown not finishing.

The lesson is narrow and worth keeping: **a green test count is not a green
run.** Read the exit reason, not the summary line.

## A live privacy leak in sitemap.xml

`users.profileVisibility` is a real setting (`public` / `members` / `private`).
`sitemap.xml` filtered on `users.status = 'active'` **alone**, so a member who
set their profile to members-only or private still had their profile URL handed
to crawlers. Live on all three instances until this fix.

What makes it a clean example: the correct predicate already existed in two
places and both were right. `publicApi/serializers.ts:isPublicUser` checks
`deletedAt === null && profileVisibility === 'public'`, and
`public/v1/users/index.get.ts` carries the same three conditions.
`persona/directory.ts` gates on it too. The sitemap was the one enumeration that
drifted from a predicate everyone else shared.

Checked and correct, so this was a single site and not a class:
`public/v1/users/index.get.ts`, `public/v1/users/[username].get.ts`,
`persona/directory.ts`. `public/v1/instance.get.ts` counts active users for
instance stats, which is an aggregate rather than an enumeration of identities,
and was left alone.

## The scroll-trap class, measured rather than assumed

Having fixed the mobile menu, I enumerated every full-viewport fixed overlay in
the layer and `@commonpub/ui` (37 candidates) and checked whether each has a
scrollable inner panel.

- **Genuinely broken, fixed:** `.cpub-mobile-menu` and deveco's
  `.de-mobile-menu` (already shipped).
- **Real but minor, fixed, ships with the next release:**
  `PublishErrorsModal`. Its overlay centres the card with `align-items: center`
  and has no overflow, and the card had no height cap, so a card taller than the
  viewport is clipped at *both* ends with nothing to scroll, including the
  "Got it" button, and a phone has no Escape key to fall back on. The validator
  emits at most 5 short messages, so a portrait phone clears it comfortably;
  landscape, or messages wrapping to two lines, is where it bites.
- **Checked, already correct:** `ContentPicker`, `ImportUrlModal`,
  `AdminLayoutsHelpOverlay`, `MarkdownImportDialog`, `ui/Dialog`,
  `MirrorDetailModal`, `MirrorRequestApproveModal`, `ProductEditModal`,
  `ShareToHubModal`, `ContestSignup`, `HubProjects`, the contest submit overlay
  and the docs settings overlay. All cap the panel and scroll it.
- **Bounded content, cannot overflow:** `ImageCropperModal`,
  `RemoteFollowDialog`, `TermsReacceptanceGate`,
  `AdminLayoutsConflictModal`, and the messages new-conversation dialog (its
  only list is recipient chips the user adds themselves). I flagged the last
  one on a first pass and it does not hold up.

## XML validity in both feeds

`sitemap.xml` and `feed.xml` each carry their own copy of `escapeXml`, and
neither stripped C0 control characters. XML 1.0 permits only #x9, #xA, #xD and
#x20 upward, and a control character is illegal **even written as a numeric
reference**, so one stray character in a title makes the whole document
malformed and readers reject the entire feed rather than skipping that item.
Both copies now strip them, and the guard asserts the two implementations stay
byte-identical.

## Dependency ranges: better-auth really was the only one

Audited every schema-coupled dependency across all packages.

| dep | range | verdict |
| --- | --- | --- |
| `better-auth` | was `^1.2.0`, now `~1.6.29` | the one real hazard, fixed |
| `drizzle-orm` | `^0.45.1` everywhere | safe: caret on 0.x cannot cross a minor |
| `drizzle-kit` | `^0.31.10` | same |
| `@electric-sql/pglite` | `^0.3.16` | same |
| `pg` | `^8.13.0` | a driver, not schema-coupled |

Worth noting **why** the others are safe: not by intent, but because caret on a
`0.x` version is already minor-locked. If drizzle-orm ever ships 1.0, `^1.x`
becomes exactly as dangerous as `^1.2.0` was for better-auth.

## Calendar-fused fixtures beyond persona

`PERSONA_SNAPSHOT_MAX_AGE_DAYS` is the only staleness window in the codebase, so
the two persona suites were the only ones that could rot that way, and they are
fixed. Scanning every test fixture for a date literal combined with a live clock
turned up two more with **future** dates:

- `contest-combined-mode.integration.test.ts` and
  `contest-registration-template.integration.test.ts` both build a contest with
  `endDate: 2026-12-01`.

Neither is broken today and neither asserts on an open/closed window (they set
`status` explicitly, and contest status is stored rather than derived), so this
is latent, not live. Recording the date so that if CI turns red in early
December the answer is one line away rather than a day of misdiagnosis.

The good pattern already exists in `contest/reminders.ts`: `ctx.now ?? new
Date()`, an injectable clock, which is what makes those suites immune.

## A red gate hid a red gate hid a stale test

Worth reading as one story, because each layer masked the next:

1. The persona fixtures rotted against the 7-day snapshot window, so `check`
   went red on the calendar.
2. Fixing that left `check` red on the pg teardown race, with **zero failing
   tests** — a fact I misread twice before reading the exit reason instead of
   the summary line.
3. `e2e` has `needs: check`, so through both of those it was **skipped**. Fixing
   `check` is what finally ran it, and it immediately caught a `toBeDisabled()`
   assertion contradicting a deliberate change made earlier this same session:
   removing the disabled-save gate from the registration form, which is the
   funnel fix ("a greyed button that does not say why is what people report as
   'it does nothing'"). The unit tests covered the new behaviour; the e2e test
   still pinned the old one and had no chance to say so.

Two things to carry forward. **A skipped job is not a passing job** — while
`check` is red, nothing downstream of it is being verified, and work merges with
a whole tier of coverage silently absent. And **`pnpm audit` in this workflow is
`continue-on-error: true`**: it prints `##[error]` and a 171-vulnerability
summary on every run without failing anything. It cost time twice this session
to rediscover that, because it looks exactly like a failure in the log.

Also unstuck `heroCtas` in the same spec: it used `$$eval`, which resolves its
handles once and dies with "Execution context was destroyed" when the CTA
settling races a client-side navigation. A locator re-resolves. The suite is
serial, so that flake took every test after it down as "did not run". All 9 pass.

# What remains

Ordered by who has to do it and how much it matters.

## Needs a release (code is on main, not yet published)

| item | where | note |
| --- | --- | --- |
| sitemap privacy fix | `server/routes/sitemap.xml.ts` | **live leak until rolled**; non-public profiles are in the sitemap on all three instances right now |
| XML control-char strip | `sitemap.xml.ts`, `feed.xml.ts` | malformed feed if any title carries a control character |
| publish-errors modal cap | `PublishErrorsModal.vue` | landscape / wrapped-text only |

These are all layer-only changes, so one `@commonpub/layer` patch plus the usual
three deploys. The sitemap one is the reason not to sit on it.

## Decisions for the operator

- **The forks pin `better-auth: "1.6.29"` exactly via `overrides`, and the
  workspace now resolves 1.6.30.** Upstream `~1.6.29` already prevents the 1.7.x
  break, so the overrides no longer add protection and instead **block patch
  releases** from reaching deveco and heatsynclabs. Recommendation: drop both
  overrides at the next fork touch and let `~1.6.29` do the work. Not urgent,
  but it is the kind of thing that quietly matters when a security patch lands.
- **`@commonpub/docs@0.6.3` pins stale `@commonpub/config@0.12.0` and
  `@commonpub/schema@0.16.0`**, visible as duplicate versions in both forks'
  lockfiles. Pre-existing, docs works today, and republishing cascades another
  layer publish. Worth clearing deliberately rather than during a deploy.
- **`pnpm audit` reports 171 advisories** (6 critical, 76 high), all transitive
  through dev and build tooling (`@stryker-mutator/core > ajv > fast-uri`,
  `nuxt > ... > @mapbox/node-pre-gyp > tar`). The step is `continue-on-error`, so
  it has been reporting into a void. Either triage it or make it fail on a
  curated allowlist, but leaving a permanently-red-looking step in the log has
  already cost time twice.

## Still on the operator's side, deveco contest

Unchanged from the earlier section, none of it code:

- re-tick **Required** on *Focus Area* (lost in the re-add)
- the duplicate question (`approach` and `your_technical_approach_including_hardwa`)
- 7 labels carrying a leading space from pasting
- **the Official Rules**: truncated at 50,000 characters, and 31
  `[CONFIRM: ...]` placeholders remain, including the proposal deadline

## Latent, with a date on it

`contest-combined-mode.integration.test.ts` and
`contest-registration-template.integration.test.ts` both build a contest ending
**2026-12-01**. Neither asserts on an open/closed window today, so neither is
broken; if CI turns red in early December, start here rather than assuming a
regression. The fix pattern already exists in `contest/reminders.ts`:
`ctx.now ?? new Date()`.

## Cruft

Nothing here was deleted, since it is all destructive and all on the operator's
machines and instances.

- Production test accounts from diagnosis: `authprobe+1787358990729@…`
  (commonpub.io), `authprobe+1787360201472@…` (deveco.io),
  `authprobe+1787360573552@…` (heatsynclabs.io), plus one
  `authprobe+1787364…@…` per instance from the final verification pass.
- Local dev DB: contest `resilient-america-local` and `rac-shipped`, accounts
  matching `%1787%@example.com`, `fresh+%`, `dev+%`, `mob…@example.com`,
  `reach…@example.com`, `ba630_…@example.com`.
- Local Postgres: scratch databases `fork_repro`, `cpub_v2`, `cpub_tz`, and
  leaked `cc_test_*` databases from the teardown race (harmless, and they will
  stop accumulating now that the race is handled).

## Earlier round-2 findings, re-verified

Checked rather than inherited:

- **Contest entries fetch has no limit — CLOSED.** The route caps at 100 and
  `normalizePagination` supplies a default. This was fixed at some point and the
  note was stale.
- **Sitemap publishing private profiles — CONFIRMED, fixed above.**
- **RSS control characters — CONFIRMED, fixed above.**
- **`server: false` zero-seed across ~23 sites — still open**, not re-audited
  this session. It is a pattern sweep rather than a single defect.
