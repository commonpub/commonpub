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
