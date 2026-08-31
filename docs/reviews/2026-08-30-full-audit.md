# CommonPub — full audit, 2026-08-30

> Second full pass, seven days after `2026-08-23-full-audit.md`. That report left 28
> production-reachable findings open. This one **re-verified every one of them from
> scratch** rather than trusting it, swept eight dimensions it never covered, and fixed
> what could be fixed unambiguously and covered by a test.
>
> Nothing here is quoted from the previous report. Every status below was reproduced
> against the tree at `53bb929c` or against a live instance on 2026-08-30.

## Method, and why it is worth stating

The instruction was to make no assumptions. Three things follow from that, and each one
caught something:

**A passing check is not evidence until you know what it ran against.** Five results in
this session were vacuous and had to be thrown away: a `grep` whose `--include=*.test.ts`
was eaten by the shell as a glob and reported `0 skipped tests` for a repo that has 37; a
timing probe that printed `no tests` because its import path was wrong; an eslint run
whose stderr I had sent to `/dev/null`; a `pnpm --filter @commonpub/layer lint` that
returned `rc=0` from `tail` rather than from pnpm; and an exporter test that passed
against an empty string because its fixture was missing `version: 2` and silently took
the legacy path. Every one of those looked like a green result.

**Guards must discover their targets.** Every test added here scans for what it protects
instead of listing it, and every one was mutation-tested — reverted to the pre-fix state
to confirm it actually fails. One of them caught a defect in its own author's work
(below).

**The class, not the instance.** This repo's recurring failure is that a fix lands on the
site somebody noticed while the rest of the class ships. It recurred four times in this
session's own work.

---

## Fixed this session

Each of these was unambiguous, is covered by a test that discovers its targets by
scanning, and the test was mutation-tested against the pre-fix state.

### F-1 — Stored XSS in the explainer conclusion CTA, the sink 0.9.0 missed

`explainerConclusionSchema` types the call-to-action as `url: z.string()` with no format
check. `sanitizeExplainerDocument` in `@commonpub/server` enumerates the fields it cleans
by hand and never visits `conclusion.callToAction`. So the value reaches both renderers
exactly as its author typed it, and **any member who can write an explainer can type
`javascript:`**.

The 0.9.0 hardening (session 257) closed this package's two HTML sinks and did not reach
this one, because it is an *attribute binding* rather than a blob of HTML:

- `ConclusionRenderer.vue:21` bound `:href` straight to `callToAction.url`;
- `htmlExporter.ts:191` passed it through `escapeAttr`, which neutralises quote-breaking
  and leaves the scheme untouched.

The exported file is the worse of the two: it is opened from disk, with no CSP and no
origin.

Both now route through the `isSafeUrl` that 0.9.0 added to this same package, dropping
the attribute while keeping the label — matching what `sanitizeHtml` already does with a
bad href. 23 tests, covering ten encodings a single-pass replace would miss and six
legitimate URLs that must survive.

**I swept the rest of the class before fixing.** Every `:href` and `:src` bound to a
non-literal across `layers/base`, `packages/ui`, `editor` and `explainer`. The other
dangerous sinks were already guarded and were left alone: `toEmbedUrl` only ever returns
https/http, `buildRegistrationHref` uses `URL_LINK_STRICT` and explicitly blocks
protocol-relative open redirects, `ContentAttachments` filters on its own `isSafeUrl`,
and `EmbedBlock` requires an `https` prefix. `<img src>` is not a script sink and was not
treated as one.

### F-2 — Members' notification preferences were readable by anyone

`UserProfile` is what the unauthenticated `GET /api/users/:username` returns — that route
has no `requireAuth`, it reads the viewer opportunistically in a try/catch only to compute
a follow flag. The DTO carried `emailNotifications`, and it was live:

```
$ curl -s https://deveco.io/api/users/<member>          # no credentials
{"username":"...","emailNotifications":{"likes":true,"digest":"none",...}}
```

Sampled twelve profiles per instance; only two came back populated, because most members
never configured preferences. **That is exactly why it hid** — a spot check of one or two
profiles reads as harmless.

Worse than the field itself: the `users.email_notifications` JSONB column also carries an
`unsubscribedAll` key that appears in no TypeScript type. The old cast passed the whole
object through, so an unsubscribed member's suppression flag was published too — a field
nobody could have found by reading the interface.

Removed from `UserProfile` and from `getUserByUsername`. The owner's own copy now comes
from a new owner-only `getOwnEmailNotificationPrefs`, added to `/api/profile` the same way
and for the same documented reason `profileVisibility` already was. The guard is a
denylist checked against the *runtime* shape, so adding an innocuous public field does not
fail it while re-adding a private one does.

### F-3 — Credentials in the Docker build context

`Dockerfile:13` is `COPY . .`, so everything the daemon receives lands in a build-stage
layer. **Three credentials were in that set**, where the previous audit named one:

| path | holds |
| --- | --- |
| `.secrets/cargo-registry-token` | the crates.io publish token |
| `secrets/CPUB_FED_TOKEN_KEYS.md` | federation token keys |
| `apps/reference/.env` | `NUXT_AUTH_SECRET`, `NUXT_DATABASE_URL` |

All three got through rules that *read* as general and are not. `.env*` matches only the
root `.env` family. `*.md` matches only root-level markdown, because Docker matches a
pattern against the whole relative path and `*` does not cross a `/` — so the federation
key file was never even a candidate for the rule that appears to cover it.

Verified by really running `docker build` against a throwaway context carrying this repo's
`.dockerignore`, with dummy values standing in for the real secrets. The positive control
matters: `index.js`, `package.json` and `.env.example` still arrive, so the new rules are
not simply excluding everything.

**This stops future leaks; it does not un-leak the past. The crates.io token has been
entering build layers on every build and should be rotated.**

### F-4 — 557 single-file components that nothing linted

Three independent reasons no `.vue` file was ever linted:

- `eslint.config.js` declared `files: ['**/*.ts']` and had no `.vue` block, so eslint
  never loaded one;
- `@commonpub/layer`, which owns 306 of the 557, had **no `lint` script at all**;
- `eslint src/` in the editor and explainer packages was true and empty — their
  components live in `vue/`, not `src/`.

That last one is the repo's shape again: the script existed, the task went green, and it
inspected nothing.

Turning it on surfaced 111 findings, of which 104 were a single naming rule that is wrong
for a Nuxt codebase (now off, with the reason recorded). The **five real ones**: two CSV
export routes carrying the UTF-8 BOM as a *literal invisible* U+FEFF (now `﻿` —
identical bytes, survives a formatter, visible in a diff, and guarded); an unused `v-for`
index; a genuinely useless escape; a bare `Function` cast; and a stale
`eslint-disable import/first` naming a plugin this repo does not install, which is itself
an error.

Three were documented rather than changed, because each is deliberate: `LayoutRow` splices
`props.row.sections` in place and the parent watches that same array (emitting upward is a
real refactor of the layout editor's data flow); `EngagementBar`'s `likeCount` shadows its
prop on purpose; and `custom-html/Viewer.vue`'s escaped closing script tag is load-bearing
— unescaped it would terminate the SFC's own script block. Writing one out in the
explanatory comment did exactly that, twice, before it was worded around.

Layer: **0 errors over 1,082 files.** Repo lint and typecheck both green, 31 lint tasks
where there were 29.

### F-5 — The README's package table, and the numbers in `facts.md`

Thirteen of fifteen version cells in the root README were wrong — `schema` read `0.35.0`
against an actual `0.66.0`, `server` `2.82.0` against `2.133.2`, `layer` `0.64.1` against
`0.137.4`. `@commonpub/persona` was missing from the table entirely and
`@commonpub/theme-studio` was still marked "not yet published" nine minors after it
shipped, so the prose count was wrong too. The non-version counts had drifted the same
way: 90 tables (110), 45 enums (50), 23 feature flags (47), 111 Zod validators (166), 25
server modules (29), 20 editor blocks (21), ~2,850 tests (7,815 counted passing).

Two claims were already right and were left alone: **7 built-in themes and 22 UI
components**, both re-measured rather than assumed.

`docs/llm/facts.md` — the file `CLAUDE.md` points future work at — was carrying
session-224 numbers from 2026-06-24, including a fork layer pin of `^0.86.4` against a
real `^0.137.4`. Corrected and re-dated.

`docs/ROADMAP.md` called itself "the single source of truth for what's left, consolidated
from all 24 `docs/plans/`". There are **41** plan files now, six of which postdate it
entirely — the persona, member-directory and conditional-field work all shipped without
ever appearing in it. Its header now says what it actually covers.

---

## Re-verification of all 28 open P1s

Seven agents re-checked every finding from scratch against the current tree and live
instances, and every `STILL_REAL` verdict was then handed to an independent agent
instructed to refute it. **Nothing was carried over from the previous report.**

| verdict | count |
| --- | --- |
| still real | 25 |
| mis-stated (real defect, wrong description) | 2 |
| already fixed | 1 |

The one closed is **P1-19** (`docs/STATUS.md` wrong on 27 of 38 claims) — the header was
rewritten on 2026-08-23 and re-checked here across 19 present-tense claims.

**The extent was understated on almost every one.** Re-derived by scanning rather than by
reading the prior report:

- **P1-1** said `profileVisibility` was "absent from ~13" public read paths. Scanning all
  198 `from(users)` / `join(users` sites gives **at least 28 across 18 files**, and 54 of
  the 60 files touching the `users` table contain no reference to `users.deletedAt` at
  all. Two aggravating details also reproduce: `listFollowers`/`listFollowing` apply no
  users predicate whatsoever, and an admin *suspending* an account explicitly writes
  `deletedAt = null`, which makes a suspended profile fully public.
- **P1-26** — the count of 73 unnamed form controls is wrong, but there is a live
  unauthenticated critical axe violation.
- **P1-22** — `getConversationMessages` *does* enforce membership, contrary to the
  report; the real and still-present defect is that it returns every message in a
  conversation with no limit.
- **P1-23** — the federation double-delivery window is wider than described: the 30s
  scheduler has no in-flight guard.
- **P1-3** carries a UI amplification the report missed. An inbound federated DM is
  stored with `senderId` = the *recipient*, and `MessageThread.vue` renders any message
  whose `senderId` matches the viewer as the viewer's own outgoing bubble with the sender
  row suppressed — so a remote attacker's text appears **as words the victim wrote**.

| id | today | class found | fixable | one-line |
| --- | --- | --- | --- | --- |
| P1-1 | still real | 28 | design call | profileVisibility is enforced on exactly 7 sites; the UserProfile DTO still omits the column, so no public user-identi... |
| P1-2 | still real | 3 | yes | Unauthenticated GET /api/users/[username] still returns another member's emailNotifications preferences — reproduced l... |
| P1-3 | still real | 3 | design call | Inbound federated DMs are still stored with senderId = the recipient; the remote author survives only as an attacker-c... |
| P1-4 | still real | 3 | yes | getPlatformStats is still unfiltered by status/visibility/deletedAt and still served on two unauthenticated surfaces; ... |
| P1-5 | still real | 3 | yes | Self-serve account deletion still throws an audit_logs FK violation after the delete transaction has already committed... |
| P1-6 | mis stated | 2 | yes | Federated cpub:blocks is still ingested and forked with zero sanitisation, but the report's third clause ("reaches a v... |
| P1-7 | still real | 6 | yes | The write path still stores section.module verbatim, and the 0.9.0 render fix does NOT close it — conclusion.callToAct... |
| P1-8 | still real | 5 | yes | Confirmed by an actual docker build — and the blast radius is larger than reported: apps/reference/.env (NUXT_AUTH_SEC... |
| P1-9 | still real | 3 | yes | All three reproduced against production with GET requests only — and the search one 500s specifically on the Postgres ... |
| P1-10 | still real | 3 | yes | deveco's post-deploy health check still cannot pass and cannot fail — proven from the 2026-08-28 deploy log, which pri... |
| P1-11 | still real | 3 | yes | deveco's deploy still lacks `set -o pipefail`, so a failed migration is masked by tee's exit 0 — and it is now the onl... |
| P1-12 | still real | 3 | yes | Confirmed, and the report's downward correction still holds: no CI job anywhere runs `migrate`, but nothing has change... |
| P1-13 | still real | 3 | yes | Confirmed by direct execution: eslint reports "File ignored because no matching configuration was supplied" for .vue f... |
| P1-14 | still real | 3 | design call | Confirmed today from GitHub's own run data: exactly the three SHAs the report named deployed to production with a red ... |
| P1-15 | still real | 3 | yes | Both forks' CI installs from pnpm-lock.yaml while the Dockerfile builds from package-lock.json; the two locks now disa... |
| P1-16 | still real | 2 | yes | heatsynclabs.io still has exactly one workflow (deploy.yml) and no CI; deveco's Deploy Production still has no `needs:... |
| P1-17 | still real | 7 | yes | Both forks' server/utils/config.ts is still a drifted copy. The admin-set instance name/description genuinely never re... |
| P1-18 | still real | 2 | yes | Verified against the artifact a new self-hoster actually downloads, not the repo source: crates.io create-commonpub 0.... |
| P1-19 | already fixed | 2 | yes | The header was rewritten and is now substantially accurate. I re-checked 19 distinct present-tense claims in lines 1-1... |
| P1-20 | still real | 7 | yes | commonpub.io and deveco.io still serve every response uncompressed; heatsynclabs.io is the only instance with `encode`... |
| P1-21 | still real | 9 | yes | Search is still an unindexable leading-wildcard ILIKE and Postgres confirms a Seq Scan; but on 2 of 3 instances the ho... |
| P1-22 | still real | 11 | yes | getConversationMessages DOES enforce membership; the real and still-present defect is that it then returns every messa... |
| P1-23 | still real | 7 | yes | Delivery is still fully serial and unbounded, and the double-delivery window is far wider than the report says: the 30... |
| P1-24 | still real | 9 | yes | Focus indicator still derives from unfloored --accent and fails WCAG 1.4.11 (3:1) — reproduced live at 1.54:1 on devec... |
| P1-25 | still real | 8 | design call | --text-faint is still unfloored and below 4.5:1 in 6 of 7 built-in themes and on both live CommonPub instances; theme-... |
| P1-26 | still real | 23 | yes | Form controls with no accessible name are still shipping, including a live unauthenticated critical axe violation — bu... |
| P1-27 | still real | 4 | yes | deveco.io still fails WCAG 1.4.10 Reflow at 320px with the hamburger entirely outside the visual viewport — reproduced... |
| P1-28 | mis stated | 5 | yes | The InteractiveContainer defect is real and unchanged in source — it remaps --surface/--bg/--text but declares no `col... |

---

## Found here, not in the previous audit

### N-1 — The local test gate is unreliable under its own fan-out, and it is not a flake

`pnpm test` exits **1 with zero failing assertions**. Six test *files* died in `beforeAll`
on `Hook timed out in 30000ms`; under additional load the same run lost **33 of 143**
server suites the same way. Re-run serially, all of them pass — 106 tests, `rc=0`.

The mechanism, measured rather than guessed: `createTestDB()` constructs a **fresh PGlite
instance and pushes all 110 tables** on every call, and **107 suites call it**. Timed on
an idle machine: 2,091ms for the first, then ~780ms steady. Under fan-out that exceeds
the 30s hook timeout, which a previous session had already raised from 15s for the same
reason.

This matters beyond local annoyance. A gate that fails for reasons unrelated to the change
under test is a gate people learn to re-run rather than read, and this one fails with a
tidy summary that says nothing is wrong.

**Recommended:** treat the cost, not the timeout. Build the schema once per worker process
and clone it (PGlite can load from a dumped data directory), which keeps per-test
isolation while removing 106 redundant schema pushes. Raising the timeout again is the
cheap fallback and should be labelled as such.

### N-2 — The authenticated editor E2E has never run, for a reason that expired

`apps/reference/e2e/editor.spec.ts:113` skips its whole authenticated block on
`TEST_AUTH`, which is set nowhere. The stated reason is "to avoid failures in CI without a
DB" — but the CI `e2e` job **provisions a Postgres service**, and a working `signUp`
helper exists at `e2e/helpers/account.ts` and is used by the persona and member-directory
specs to obtain real sessions in CI.

So the editor — a core feature — has no authenticated end-to-end coverage, and the
blocker that justified it no longer exists.

For contrast, `member-directory.spec.ts` documents its own CI limits precisely and
honestly, naming exactly why properties 2 to 4 cannot run and what an operator must supply.
That header is the model; `editor.spec.ts` is a stale comment.

**Recommended:** rewire `editor.spec.ts` onto the `signUp` helper. Not done here because
it converts skipped tests into running ones whose failure modes are unknown, and that
belongs in a change whose whole purpose is to watch them.

### N-3 — E2E flag hygiene is good, and worth not breaking

Noted because it is easy to regress: `ci.yml` deliberately turns on fourteen feature flags
for the `e2e` job, each with a comment explaining that the spec would otherwise ship and
never run. That is the right instinct and the opposite of the `editor.spec.ts` problem
above.

### N-4 — `useLazyFetch` classification: a closed question

The previous report counted "79 `useLazyFetch` sites" and left them unclassified. The real
number across every fetch composable in the repo is **47** (8 `useLazyFetch`, 38
`useFetch`, 1 `useAsyncData`). Classifying them found **no new hydration risk on public
SSR paths**: `pages/index.vue` fetches only viewer-independent data, and every fetch on
`pages/u/[username]/index.vue` is keyed on the route's username rather than on the
visitor. Recorded so nobody re-opens it.

---

## What this session got wrong

Recorded because the pattern is the point, and because a report that only lists other
people's mistakes is not an audit.

**The credential fix shipped incomplete, and its guard did not catch it.** The first pass
excluded `secrets/`, `.secrets/` and key material, and I wrote a paragraph in the
`.dockerignore` explaining that `.env*` matches only the repo root. Then I did not apply
that sentence to `.env` itself: `apps/reference/.env`, holding `NUXT_AUTH_SECRET`, was
still entering the build context. The guard passed because I had scoped its scan to
`secrets/` directories and key extensions — I derived the class narrowly in the same
commit where I described the class correctly. It took an independent re-verification of
P1-8 to find it.

**The guard's own matcher was wrong, and the empirical run caught it.** It used `.some()`
over the ignore patterns and reported `apps/reference/.env.example` as excluded — which
contradicted what a real `docker build` did with that exact file. Docker is last-match-wins
with `!` re-including. The observation was right and the code was wrong; the matcher now
pins the observed behaviour as test cases.

**Five vacuous results were reported before being caught**, listed under Method above. The
one worth singling out: `pnpm --filter @commonpub/layer lint` printed `rc=0`, which was
`tail`'s exit code. The message beside it — "None of the selected packages has a lint
script" — was the actual finding, and it was P1-13.

**A stale memory nearly caused a real defect.** A note recorded deveco's
`package-lock.json` as gitignored. It is tracked. Acting on it would have left CI
verifying one dependency tree while the Dockerfile built another — which is P1-15, a
finding from the previous audit.

---

## Release status

**Nothing has been published or deployed.** Two of the fixes above change published
package source and therefore do not reach production until someone rolls them:

| package | change | reaches production via |
| --- | --- | --- |
| `@commonpub/explainer` | F-1, the CTA scheme gate | version bump + republish + fork pin bump |
| `@commonpub/server` | F-2, `emailNotifications` off the public DTO | same, then `@commonpub/layer` |

`@commonpub/layer` also changed (the `/api/profile` owner-only field, the BOM escapes, the
lint fixes). Because `workspace:*` publishes as an exact pin, the cascade is
`explainer → learning → server → layer`, and both forks need **both** lockfiles bumped.

The other three fixes are repo-local and take effect without a release: the
`.dockerignore` change applies at the next image build, and the lint and documentation
changes are developer-facing.

**The `emailNotifications` leak is live on deveco.io and heatsynclabs.io right now.** It
was reproduced against production during this session.

## What I would do next, in order

1. **Rotate the crates.io publish token** (F-3). Independent of any release, and the only
   item here where the exposure already happened.
2. **Roll the two package fixes.** Follow the prerelease gate that worked in session 257:
   publish to `--tag next`, prove it against a fork's CI, then promote. The
   `emailNotifications` leak is the reason not to sit on this.
3. **Make deveco's deploy able to fail** (P1-10, P1-11). Its post-deploy check curls a
   port the container only `expose`s and ends in `|| echo ::warning::`; the deploy log
   from 2026-08-28 prints "Health check failed" and the job still succeeds. Two small
   edits, strictly safer, and they turn every future roll from hand-verified into
   self-verifying.
4. **`profileVisibility`** (P1-1). The setting is offered in the UI with the words "Only
   people signed in to this site can see your profile" and is honoured on 7 of at least 35
   relevant paths. No instance has a non-public row yet, so this is a race between the fix
   and the first member who trusts the setting. It needs a shared predicate and a scanning
   guard, not 28 individual edits.
5. **The test gate** (N-1). Everything above is harder to land confidently while `pnpm
   test` fails for reasons unrelated to the change under test.

## Left alone deliberately

- **26 MB of untracked screenshot directories** (`contest-gallery/`,
  `contest-e2e-screens/`, `contest-criteria-redesign/`, `contest-block-showcase/`). All
  gitignored, none tracked, none referenced by any test. They look like deliberate visual
  records rather than build output, so they are reported rather than deleted.
- **The two audit databases at :5433** from the previous session (`cpub_audit_0825`,
  `cpub_audit_push`).
- **`LayoutRow`'s prop mutation and `EngagementBar`'s shadowed key** — both deliberate,
  both now documented at the site with the reasoning, neither safe to "fix" mechanically.
