# Session 255 — Handoff (state, what shipped, what's open)

Persona customization: an operator-defined profile schema, purpose-scoped sharing consent, and
k-anonymous audience analytics. Planned, audited twice, then built as an **isolated package**.

**ROLLED AND LIVE on all three instances, 2026-08-14, with every flag OFF.**

persona 0.1.0 (first publish), config 0.39.0, schema 0.64.0, server 2.131.0, ui 0.16.0,
layer **0.134.1**, migrations 0046 and 0047. commonpub.io, deveco.io and heatsynclabs.io all report
health 200 and 46 flags with the four new ones `false`. Nothing collects, counts or discloses until
an operator opts in.

The roll followed the prerelease pattern: layer published as `0.134.0-rc.1` under the `next` tag,
verified by the deveco fork's CI on a draft PR (the only place the PUBLISHED layer is typechecked),
then promoted and the forks repinned. **0.134.1 is a hotfix rolled immediately after**, see
"Post-roll hotfix" below. See "Roll notes" below.

Detail: `docs/sessions/255-persona-customization-plan.md`. Plan and both audits:
`docs/plans/persona-customization-and-audience-analytics.md` (2130 lines). Session 254's context:
`254-handoff.md`.

## Where things stand

| Package | State | Package | State |
|---|---|---|---|
| `@commonpub/persona` | **0.1.0 NEW, unpublished** | `@commonpub/server` | 2.130.0 + persona domain |
| `@commonpub/schema` | 0.63.0 + 4 tables, **mig 0046** | `@commonpub/config` | 0.38.0 + 3 flags |
| `@commonpub/ui` | 0.15.0 + chip tokens | `@commonpub/layer` | 0.133.0 + 16 routes, 3 pages |

Those are the versions **currently published**, not targets. Nothing in this work
bumped a version, so the roll order below starts with a `chore(release)` commit.

**45 flags** (three new: `persona`, `dataSharingConsents`, `personaAnalytics`, all
default `false`). The number is pinned by `MIN_FLAGS` in
`layers/base/composables/__tests__/featureFlagParity.test.ts`, so quote it from
there rather than from here.
Migration **0046_jazzy_frog_thor.sql**: four `CREATE TABLE`, seven indexes, three FKs on its own
tables, **zero `ALTER`s on any existing table**.

Local gates, all re-run and confirmed independently of the build agents:

| Gate | Result (final, re-run on a quiet machine) |
|---|---|
| `pnpm typecheck` | 30/30 tasks, zero errors |
| `pnpm turbo run test` | **exit code 0**, zero suites reporting a failure. layer 187 files / 2612 tests, server 141 files / 2086 tests |
| `pnpm lint` | 29/29, 0 errors (pre-existing warnings unchanged) |

One test was fixed during this pass: the axe check on `/admin/persona-metrics` ran 2.7s alone and
5.16s under full-suite load, exceeding vitest's 5s default, so a TIMEOUT was presenting as an
accessibility violation. Both admin axe tests now carry an explicit 30s budget. The work is unchanged.

## What this feature is

An operator declares profile sections and fields, in `commonpub.config.ts` (committable, for repo
deploys) or in `/admin/persona` (DB override, revertible). Members fill them in at
`/settings/persona`: chip grids for interests and tech stack, plus the existing name/bio/location
fields bound through to their `users` columns. Members separately opt in, per purpose and default off,
at `/settings/privacy`. Consenting answers become k-anonymous cohort counts on a public metrics API.

Adding a section adds a cohort with **no new endpoint code**, because answers are normalized rows
rather than a blob.

## The architecture, and why it is shaped this way

`@commonpub/persona` is a zod-only pure-TS package (the `theme-studio` precedent). Tables live in
`packages/schema/src/persona.ts` because `drizzle.config.ts` is a **non-recursive** `./src/*.ts` glob,
and because no feature package in this repo owns a `pgTable`. Server logic is
`packages/server/src/persona/`, matching the domain-directory layout.

The decisive call was **not** unifying with the contest form engine. Persona has no `required`, no
`pii`, never calls `isFormFieldPii`, has its own renderer, and the plan had already concluded
`FormTemplateEditor` cannot be reused. Extracting `FormField` and the URL validators out of
`packages/schema` would have been a large refactor of a live system, with a contest running on deveco,
for cosmetic unity.

So this feature touches **none** of: the contest engine, `FormTemplateEditor`, the URL validators,
`user_consents`, `api_keys`, the `socialLinks` cutover, `metrics_daily`, `runDailyRollup`. Persona
owns `persona_metrics_daily`, which is why the `/metrics/timeseries` back door never exists.

`packages/persona/src/__tests__/isolation.test.ts` pins all of that. Undoing an isolation decision
means deleting an assertion that says why it exists.

## Two audits, before a line was written

**Appendix A** dispositions all 31 findings from the design critique. **Appendix B** is a second pass
that found 16 more, five of which changed the build: a `column: 'website'` binding that would have
written nowhere, a purpose-limitation mechanism with no field property to key on, consent copy that
hid the `profile_visibility` exclusion, a settings back door closed for `persona.` but open for
`dataSharing.`, and the plan's own "declare twice" violation in its k-anonymity floors.

## The isolation rule was wrong once (section 14.9)

The build honoured "do not touch `useCookieConsent.ts`" and therefore shipped
`cpub-persona-invite-dismissed` with no `BUILTIN_COOKIES` entry: **a privacy feature shipping an
undisclosed cookie**. Fixed with one `essential` entry, 17 lines, no logic. Safe because
`currentScope` digests non-essential cookies only, so it cannot move the consent digest; verified by
all 174 layer test files still passing.

The test now pins the exception rather than banning the word, and both halves were mutation-tested.
Recorded rule: **an isolation boundary protects a mechanism, not a vocabulary.**

## The live run (2026-08-12)

Migration 0046 applied to the dev Postgres on :5433, which already held 103 tables and 589 users.
Purely additive, so it landed with zero disruption. Flags enabled in
`apps/reference/commonpub.config.ts`, then a real account registered through the real signup form and
driven through the whole feature in Chrome.

**Two blockers that typecheck, ~7,300 tests and lint all passed through.**

1. **`vitest` reached the Nitro server bundle, so EVERY API route returned 500.**
   `layers/base/server/api/admin/persona/__tests__/nitroStubs.ts` is a shared test helper. Nitro skips
   `*.test.ts` when it scans `server/**` but skips nothing else, so it bundled the helper, vitest threw
   on import, and `/api/features`, `/api/persona` and `/api/consent/purposes` all 500'd. The app was
   dead and no gate noticed, because nothing in the toolchain boots Nitro. Fixed by moving it to
   `layers/base/test-helpers/`. Guarded by `layers/base/server/__tests__/no-vitest-in-nitro-scan.test.ts`,
   which walks every non-test `.ts` under the five scanned directories, carries a 100-file floor and a
   positive control, and is mutation-verified.

2. **The entire persona UI rendered unstyled.** `layers/base/nuxt.config.ts:8` prefers the local
   `layers/base/theme/` bundle over `packages/ui/theme/`, and this checkout had a stale gitignored
   copy, so chip grids rendered as inline checkboxes flowing as a paragraph. Fixed with
   `node layers/base/scripts/bundle-theme.mjs`. A local-dev trap rather than a shipping defect, but it
   makes any local visual check of a theme change worthless until the bundle is refreshed.

**Verified working, against real Postgres through the real UI:**

| Check | Result |
|---|---|
| Chip grid renders and selects | 3-column auto-fill grid; selected = checkbox + 2px border + tint, never colour alone |
| Save persists | 4 normalized rows in `user_persona_answers`, survive reload |
| Saving a persona grants no consent | zero rows in `user_purpose_consents` (the no-bundling rule) |
| Sharing toggle defaults off | `OFF` on a fresh account, `offSummary` above `onSummary` |
| Grant writes a correct record | `granted`, scope digest, snapshot, `source: settings`, current |
| Revoke is one click, no dialog | grant row superseded, new `revoked` row current, history intact |
| Answers survive revoke | all 4 rows present, exactly as the copy promises |
| Public profile renders persona | `/u/:username` About tab shows the four chosen chips |
| Private profile hides it | `profile_visibility = 'private'` gives anonymous a **404**, not a 403 |
| Population floor | with 1 consenting user the dashboard refuses to show anything |
| Aggregation past the floor | 31 consenting users: hardware 13 -> **10**, iot 9 -> **5**, open source 8 -> **5** |
| Quantisation floors, never rounds up | 13 published as 10, not 15 (Appendix B8) |
| Suppression | pcb (3) and robotics (1) hidden as "2 answers are hidden", values never sent |
| Deferred purposes are honest | "Not offered on this site." rather than a fake `0` (Appendix B9) |
| Tap targets | `--cpub-chip-min-height: 44px` via `min-height` on `.cpub-chip`, so AA holds at every width |
| Mobile | no horizontal overflow at 390px; tab strip scrolls in its own container |

**Test data left in the dev database on purpose:** the `personatester` account (promoted to admin)
plus 30 seeded consent rows and answers, so `/admin/persona-metrics` shows real numbers. Clear with
`DELETE FROM user_purpose_consents; DELETE FROM user_persona_answers;` when finished. The three flags
are also left ON in `apps/reference/commonpub.config.ts`.

**Not covered:** axe on the two composed pages in a real browser, and a 390px pass on the
authenticated pages. Playwright could not authenticate (better-auth signs its session cookie, so a
seeded token does not validate) and the Chrome extension's window resize did not reflow the viewport.
The 44px requirement is settled by construction from the CSS regardless.

## The member visibility directory (2026-08-13)

Follow-on feature, planned in `docs/plans/member-visibility-directory.md` and built in the same
session. Members can opt in to being listed for named recruiters or sponsors. Recipients cannot
contact them directly and email is never exposed: contact stays on-instance through the DMs that
already work between any two accounts.

**The finding that shaped it.** `GET /api/public/v1/users` already ships and already returns, with a
`read:users` key and no consent of any kind, a searchable list of every public-profile member
including `skills` and `socialLinks`. The recruiter database already existed in embryo. So this work
is narrower and more consensual than the status quo: an explicit opt-in, filtering by persona
answers, a protected scope, and a per-recipient disclosure log. Filed separately: `read:users`
handing over everyone's social links with no opt-out short of going fully private.

**What shipped:** migration 0047 (`disclosure_events` plus a nullable `api_keys.recipient_id`, the
only alter of an existing table), `read:members` wildcard-protected, `packages/server/src/persona/
directory.ts`, `GET /api/public/v1/members/open-to/{recruiters|sponsors}`, recipients CRUD and admin
pages, the "who has looked at you" member surface, and phase 4 making all three purposes offerable.
Also the two documentation gaps an audit had found: `docs/adr/030-persona-package-boundary.md` and
`docs/reference/guides/persona-schema.md`.

**Verified live against real Postgres, full loop:**

| Check | Result |
|---|---|
| Endpoint without the flags | 404, not revealing the surface exists |
| Endpoint with flags, no key | 401 |
| Bound key, nobody opted in | `items: 0, disclosed: 0` |
| Declaring a recipient | the recruiter toggle appears on `/settings/privacy`, default off, recipient rendered inline with its relationship in plain language |
| Granting | consent row written with digest `1fyzpg6`, DIFFERENT from the earlier `sxznik`, because declaring a recipient changed the disclosure scope. Older analytics grants correctly went stale |
| Directory query | the consenting member returned with public fields plus persona answers |
| **Email** | **zero occurrences of the address, and zero occurrences of the word "email", in the raw body** |
| Disclosure log | one `disclosure_events` row: recipient, purpose, digest, member |
| Revoking | member gone from the very next response (`items: 0`) |
| Audit trail | disclosure history survives the revoke |
| Member surface | "Acme Robotics, 1 time, most recently August 13, 2026." plus "Turning this off removes you from future results. It cannot recall what was already shared." |

**Isolation held:** `directory.ts` and `metrics.ts` do not import each other, in either direction. That
is what stops k-anonymity being applied to a directory that must identify people, or being deleted
from the aggregates that must not.

**Local config:** the `dataSharing.recipients` block used for this run was reverted to a commented
worked example. A committed config must not assert a partnership that does not exist.

## Roll notes (2026-08-14)

**One new failure mode, worth knowing before the next first-publish.** `@commonpub/persona` published
fine and `npm` resolved it, but every `pnpm install` in the forks failed with
`ERR_PNPM_FETCH_404 ... is not in the npm registry, or you have no permission to fetch it`. It is
neither a permissions nor an `--access` problem. npm serves two metadata documents: `npm` reads the
full one, `pnpm` reads the ABBREVIATED one (`Accept: application/vnd.npm.install-v1+json`), and on a
first publish the registry generates the abbreviated one minutes later. Diagnose it by curling both
and comparing status codes against an established package in the same scope. `pnpm view` succeeds
throughout because it reads the full doc, so it is NOT a valid readiness check.

**Verification actually performed, and its limits.** All three instances were confirmed live by
`/api/health` and by `/api/features` reporting 46 flags with the four new ones `false`, and by
`/api/persona` returning 404. deveco's build log shows the persona route chunks in the bundle, and
its deploy reported `db:migrate succeeded` with `database: ok`. That migrations 0046 and 0047
specifically applied is an inference from a sound chain (the lockfile resolves `@commonpub/schema` to
0.64.0, so the migration files were in the image, and db-migrate succeeded) rather than a direct
observation: with the flags off there is no endpoint that touches the new tables, so nothing can be
queried to prove it. Confirm directly before turning any flag on.

**heatsync has no PR CI**, only deploy-on-push, which is why the deveco draft PR is the sole place the
published layer gets typechecked before it reaches an instance. Worth fixing separately.

## Post-roll hotfix: layer 0.134.1 (admin feature flags)

Reported from deveco right after the roll: **every save on `/admin/features` returned 400.** An
operator could not toggle anything at all.

**Cause, and it was not really persona.** The page posts the ENTIRE accumulated override set on every
save (`{ ...currentOverrides, ...pendingChanges }`), so the payload grows with the instance rather
than with the edit. The validator capped it at a literal `20`, written when the config had far fewer
flags. There are now 46 and deveco had 38 on. The cap was already below the flag count before this
session added four more; persona pushed it further past a line it had already crossed.

The cap now derives from the known flag list. Every key was already validated against that same list,
so the largest legitimate payload IS that count and the literal was pure rot.

**A latent second bug found while fixing it.** `features.identity` is a nested OBJECT of sub-flags,
and the GET route iterated every key in `config.features`, so `/admin/features` rendered a TOGGLE for
it. Flipping it would have posted `identity: true`, and the override merge is a shallow spread, so
the whole object would have been replaced by a boolean and every identity sub-flag destroyed. It only
ever surfaced as a 400 because the PUT's `z.boolean()` rejected the non-boolean. Both routes now
filter to booleans.

**Verified by reproducing the failure**, not by inspection: 25 overrides seeded into a local instance
(past the old cap), logged in, toggled a flag, saved. It persisted, the toggled flag flipped, no
console error. Before the fix that request was a guaranteed 400. The regression test derives its
fixture from the real config rather than a number copied out of the source, and asserts there are more
than 20 flags so it cannot quietly stop proving anything; mutation-tested both ways.

## Audit finding still OPEN: "reset to default" does nothing

Found while auditing the hotfix, in the same screen. **Not fixed, because it was not what was
reported.** It is user-visible and should be next.

Each overridden flag on `/admin/features` shows a reset control. Clicking it fires a success toast and
changes nothing. The page sends the override set MINUS that key, and the handler does:

```ts
const merged = { ...existing, ...body.overrides };   // index.put.ts:69
```

A merge cannot remove. Demonstrated:

| | |
|---|---|
| stored | `video, docs, hubs` |
| page sends (video reset) | `docs, hubs` |
| handler stores | `video, docs, hubs` |

The route's own docblock says "To remove an override, omit the key from overrides", which is false,
and a comment further down already proposes the fix: "Future reset-to-default can be a separate
DELETE-overrides handler." That handler does not exist. A previous audit in this session recorded it
as delivered; it was not, which is worth remembering about agent self-reports.

Consequence beyond the dead button: an override can never be removed through the UI, so a corrupt
value (an `identity: true` written before the boolean filter, say) is unreachable. The GET's new
filter hides such a value from the page but the PUT's merge preserves it in storage.

Fix: add `DELETE /api/admin/features` taking the keys to clear, point the page's `resetOverride` at
it, and correct the PUT docblock. Roughly one route plus a two-line page change.

## The bug class, recorded because it will recur

A literal size cap written against yesterday's data set rots silently and surfaces later as an outage
somewhere unrelated. Nothing fails when the cap is written, nothing fails when the 21st flag is added,
and the break appears in the browser console as a bare 400 that reads like an auth problem.

**When a validator bounds a collection the codebase already enumerates, derive the bound from that
enumeration.** The rest of the tree was swept for both shapes: no other code iterates
`config.features` (every other read is a single named key), and the remaining numeric caps bound
user-supplied content (tags, prizes, criteria, participants), not domains the code enumerates.
`api_keys.scopes` is `.min(1)` with no max and validates each entry against the enum, so it is safe.

## Wider audit, 2026-08-15

Five dimensions, each checked against the code rather than against an agent report. Two of the five
turned up something; the other three are recorded as clean so the next reader does not redo them.

**1. Authorization on everything new. Clean.** Every route under `/api/admin/**` in the whole tree
carries `requirePermission`, verified by sweep, not sampling. The persona and directory routes carry
the guards their design calls for: member routes `requireAuth`, admin routes `settings.manage` except
`/admin/persona-metrics` which correctly uses `audit.read`, public routes `read:audience` and the
directory `read:members`.

Two anomalies surfaced and both cleared on reading the code. `persona/status.get.ts` has no
`requireFeature`, which is deliberate and documented at the code: the banner asks "should I offer
this?", a 404 is indistinguishable from a routing bug, so it answers `enabled: false` instead.
`users/[username]/persona.get.ts` has no auth guard because it is the public profile render; it is
flag-gated and was verified live to 404 a non-public profile for an anonymous viewer.

**2. The class behind the 0.134.1 outage. Confined.** Swept for both shapes across the tree.
No other admin page posts whole state back (`/admin/features` is the only one), and no other route
merges instead of replaces (`index.put.ts:69` is the only `{ ...existing, ...body }`). The remaining
numeric caps in validators bound user-supplied content (tags, prizes, criteria, participants), not
domains the code enumerates. `api_keys.scopes` was the one real candidate and is safe: `.min(1)`, no
max, each entry validated against the enum. No other code iterates `config.features`; every other read
is a single named key. **The reset-to-default bug above is the last open instance of the class.**

**3. The generic settings back door. Properly closed, but its error message had rotted.**
`RESERVED_SETTING_PREFIXES` rejects `persona.` and `dataSharing.` in the VALIDATOR rather than the
route, so every caller inherits the refusal, and `sanitizePersonaSchema` runs on read as
defence-in-depth. Both are real.

The operator-facing message was wrong, though, and had been wrong in both directions. It once pointed
at `/api/admin/data-sharing` before that route existed; it was rewritten to say recipients are
config-file only; then the member-directory work shipped `/api/admin/data-sharing/recipients` and the
`/admin/data-sharing` screen, making it stale again. An operator hitting it was told to edit a config
file and redeploy when a screen for the job had just shipped. **Fixed**, and the comment now says to
check both routes still exist before editing the string.

**4. The two new timer plugins, which run in production right now. Correct, with one asymmetry worth
a decision.** Both re-check their flags on EVERY run rather than only at startup, explicitly fixing
the weakness in `metrics-rollup.ts` that would keep a worker running for up to six hours after an
operator switched a feature off. `persona-rollup` additionally requires `dataSharingConsents`, on the
argument that counting must die with the consent surface that manages it (Art. 7(3)).

The asymmetry: `disclosure-purge` gates on `memberDirectory` the same way, so **switching the
directory off also switches off retention enforcement**, and `disclosure_events` rows then persist
past `disclosureRetentionYears` indefinitely. That is backwards. Counting should stop with the
feature; deletion should not. Currently moot, since no disclosure has ever been written on a live
instance, but it should be inverted before the flag is ever switched on: the purge should run whenever
there are rows to purge, regardless of the flag.

**5. Dead exports, the `METRICS_MIN_BUCKET` class. None.** Fifteen `@commonpub/persona` exports have
no consumer outside the package, and all of them are legitimate: parameter types, limit constants used
by the Zod schemas, `personaKeySchema` (used internally at `schemas.ts:48`), and
`DIGEST_INCLUDES_FIELD_KEYS`, which exists deliberately so the plan's open question B10 is one
flippable line rather than a rewrite. No finished-but-unwired refactor.

## Unpublished on main after the audit

`@commonpub/schema` **0.64.1** is bumped on main and NOT published. It carries one change: the
`RESERVED_SETTING_PREFIXES` refusal message now names `/api/admin/data-sharing/recipients`, which
exists, instead of telling operators to edit `commonpub.config.ts`.

The bump exists to stop a specific trap. The message fix landed on main without one, so
`@commonpub/schema@0.64.0` on npm and `0.64.0` on main were the same version number with different
code, and npm forbids republishing a version, so the mismatch could not have been resolved in place.

Who has the fix today: **commonpub.io only**, because it builds from the monorepo source. deveco and
heatsync consume the package from npm, so they still show the stale message until schema is published
and their pins move. That is acceptable: the message is only ever seen by an admin attempting a
blocked write through the generic settings route, so it does not warrant a roll of its own. Ship it
with whatever goes next.

## Deploy safety analysis

The question a reviewer will ask is what happens to the three live instances the moment this layer is
published, BEFORE any operator touches a flag. Answered by inspection, not by assertion.

**All six flags default `false`.** `persona`, `dataSharingConsents`, `personaAnalytics`,
`memberDirectory` are new and off; nothing collects, counts or discloses until an operator opts in.
So the interesting question is only about code that runs regardless of a flag.

| Always-on change | Blast radius |
|---|---|
| `hasScope` gains a protected-leaf branch (`packages/server/src/publicApi/scopes.ts`) | **None.** The exact-match check runs FIRST, so an explicitly granted scope is unaffected. The new branch fires only for `read:audience` and `read:members`, and no pre-existing endpoint requires either: the scopes actually demanded across `/api/public/v1` are content, contests, docs, events, federation, hubs, instance, learn, search, tags, users, videos, analytics. An existing `read:*` key therefore loses access to nothing that exists. |
| `exportUserData` gains persona and disclosure sections | Additive keys on the DSAR payload. An export on an instance with the flags off yields empty arrays. |
| `useCookieConsent.ts` gains one `essential` cookie disclosure | Cannot move the consent scope digest: `currentScope` digests non-essential cookies only. Verified by the pinned digest assertions and all 187 layer test files still passing. |
| `createApiKeySchema` gains an optional `recipientId` plus a refine | The refine only fires when `scopes` includes `read:members`, which no existing key has. |
| `settings.vue` gains two tabs, admin nav gains three links | All flag-gated; render nothing when off. |
| Migrations 0046 and 0047 | Five new tables, and exactly one alter of an existing table: a NULLABLE `api_keys.recipient_id`. A purely additive migration cannot break an existing reader. Both were applied to a real PostgreSQL 16 with 103 pre-existing tables and 589 users, with no disruption. |

**Conclusion: the deploy risk is low, and the residual risk is concentrated in what has NOT been done
rather than in what has.** See the blockers below. In particular nothing here has run on a published
layer inside a fork, and the fork's CI is the only thing that typechecks the published artifact.

## Open, and blocking a roll

1. ~~**Never applied to real Postgres.**~~ **CLOSED.** The full 47-migration chain, 0046 included,
   was applied to the `docker compose` PostgreSQL 16 on :5433 with `drizzle-kit migrate`, and the
   real `@commonpub/server` persona functions were then run against that database. Confirmed against
   the real planner, none of which PGlite could answer:

   - `uq_purpose_current` keeps a three-row history and REJECTS a second `superseded_at IS NULL` row
     for the same `(user_id, purpose)`, while allowing a different purpose to be current.
   - All three FKs cascade: deleting the account leaves zero rows in `user_persona_answers`,
     `user_persona_text` and `user_purpose_consents`, and `persona_metrics_daily` survives, because
     it holds no `user_id`.
   - The consent inner join with `HAVING count(*) >= minBucket` runs in SQL: a 3-person bucket is
     dropped and reported as `suppressed: 1`, and a 12-person bucket publishes as `10`, so the
     quantisation floors rather than rounds.
   - `recordPurposeConsent` supersede-then-insert holds under the partial unique index across 30
     users (30 rows, 30 current).
   - An option value the field does not offer is REFUSED (`"... does not offer that option"`) and
     leaves the prior answer intact, rather than being silently dropped.
   - The rollup writes the `*suppressed` sentinel row and the `scope:<digest>` meta row, finalises
     the previous UTC day on the next run, and the finalised day is then served by the rollup read.
   - That finalised day is REFUSED with `scope_changed` under a different digest, and with
     `insufficient_population` under a raised `minPopulation` — the two audit fixes whose whole point
     is the stored read path, verified on stored rows rather than on a mock.

   Not covered by this: a multi-replica cache-invalidation race, and anything about load or index
   selectivity at real row counts.
2. **Partial browser coverage.** A full manual pass ran in Chrome and is recorded under "The live
   run" above: register, fill, save, reload, grant, revoke, public profile, admin dashboard, and the
   k-anonymity thresholds against real data. What is still missing is axe on the two composed pages
   (`/settings/persona`, `/admin/persona`) in a real browser, a 390px pass on the authenticated
   pages, and section 10.5's five automated E2E specs. Playwright cannot currently log in because
   better-auth signs its session cookie, so an E2E spec needs a real form login helper written first.
3. ~~**Persona renders nowhere public.**~~ **BUILT.** `GET /api/users/:username/persona` +
   `<PersonaPublicDisplay>`, mounted in the About tab of `/u/:username`. `UserProfile` is untouched,
   per 14.8. `publicOnProfile` now has its reader, so the control means something.

   Two things a reader should know about it. It enforces `profile_visibility` itself (public, or
   `members` with a session, or the owner; everything else 404s alongside soft-deleted and
   suspended) — `getUserByUsername` and therefore the profile PAGE still do not, which stays Phase 0
   work. And it returns NO `link` fields: a persona `link` lives in `users.social_links`, which the
   profile hero has rendered as its icon row since long before this feature, so returning them
   printed the same five URLs twice on one page for every member who had ever used
   `/settings/profile` — with no action of their own, the moment the flag went on. The route's
   header argues why the new surface yields to the live one rather than the reverse. Cost, recorded:
   an operator-declared eighth link platform renders on no public surface, which was already true
   and is the deferred `user_profile_links` work.
4. ~~**The analytics have no dashboard.**~~ **BUILT.** `/admin/persona-metrics`, nav-gated on
   `persona && personaAnalytics && canAudit` — `audit.read`, NOT `settings.manage`, because that is
   what the route enforces and a link copied from the schema-editor entry would 403.

   The route also grew `?fields=a,b,c` -> `distributions[]`, and the page deliberately does not use
   it: the field KEYS arrive in the first response, so batching cannot save the round trip it looks
   like it saves. It pays off only for a version of that screen which renders every field at once
   instead of one behind a picker, which is a layout change nobody has seen in a browser. Both files
   say so, so the next reader does not "fix" the picker and find the request count unchanged.
5. **Only `profile_analytics` is offerable.** `recruiter_visibility` and `sponsor_sharing` are
   registered with full copy but switched off, because no member-level read surface exists and
   consent for an unactionable purpose fails Art 4(11). **Named deviation from the literal ask; needs
   the operator to confirm or override.**

## Also not built (deferred, each recoverable on its own)

`validatePersonaRegistry` key-lock-on-read; plan 5.6's markdown DSL; `completeness: 'points'`; the
cross-device dismissal record; `/api/admin/data-sharing/recipients`; `user_profile_links` and the
`socialLinks` cutover; `api_keys.purposes`; the `FormTemplateEditor` sub-component extraction; Phase
0's profile privacy fixes (which ship as their own change, not gated behind this feature).

## Roll order, when it is time

0. **A `chore(release)` commit first.** No package version changed in this work,
   so following the steps below literally fails on npm's "cannot publish over an
   existing version" at step 2, and step 4 has no new minor to pin a fork to,
   which is the exact condition that makes `db-migrate` silently skip 0046.
   Bump: `@commonpub/persona` 0.1.0 (first publish), `@commonpub/schema` to a new
   MINOR (new tables + migration 0046), `@commonpub/config`, `@commonpub/server`,
   `@commonpub/ui`, `@commonpub/layer`.
1. `@commonpub/persona` (new package, first publish)
2. `@commonpub/config`, then `@commonpub/schema`, then `@commonpub/server`, then `@commonpub/ui`
3. `@commonpub/layer` via `pnpm publish:layer`, never `npm publish` from `layers/base`
4. Bump each fork's **direct** `@commonpub/schema` pin: a `0.x` caret will not cross a minor and
   `db-migrate` will silently skip 0046
5. Verify the consumer through a `--tag next` prerelease and a fork draft PR before promoting
6. Flags stay `false` everywhere until a browser pass on the target instance
