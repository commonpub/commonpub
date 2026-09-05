# Session 258 — second full audit, seven fixes, nothing shipped

Full report: `docs/reviews/2026-08-30-full-audit.md`.
Previous: `docs/sessions/257-handoff.md`, `docs/reviews/2026-08-23-full-audit.md`.

## Roll status at handoff (2026-08-31)

**Published to `latest`:** protocol 0.15.3, auth 0.13.3, explainer 0.9.1, learning 0.5.5,
server 2.134.0, layer 0.137.5. Gated by publishing to `--tag next` first and letting
deveco's CI typecheck the real tarballs before `latest` moved.

**commonpub.io** builds from source and has everything: the XSS gates, the privacy fix,
and nuxt 3.21.11.

**deveco.io** was rolled in TWO steps after a combined attempt caused an outage (see
below). Both are live and verified after their swaps: all 7 routes 200, the
`emailNotifications` leak closed, the banner intact, both feeds parsing, and nuxt now
3.21.11.

**heatsynclabs.io** followed last with the same two steps, because it has no CI at all --
merging there IS deploying, so a local build-and-run was the only gate besides the new
one below. Step 1 verified live; step 2 shipped after a local build + run + SSR probe.

Every step was verified against the live instance AFTER its swap, never during the
deploy. A 200 mid-deploy is the old container answering.

**A guard now exists in both forks:** `scripts/check-single-vue.mjs` fails the build when
`package-lock.json` resolves more than one `vue` or `@vue/server-renderer`. On deveco it
is a CI step; on heatsync it runs inside `deploy.yml` before the Docker build.

### The outage, because the mechanism generalises

Rolling nuxt and the layer together took **every SSR page on deveco.io to 500 for about
twelve minutes**, while `/api/health` and the feeds kept serving and the deploy reported
success.

Three copies of Vue in the npm tree. The root declared `vue: ^3.4.0`, locked at 3.5.34;
nuxt 3.21.11 requires `^3.5.40`, so npm **nested** 3.5.42 under `nuxt` and
`@nuxt/nitro-server` rather than upgrading the first. Two Vue runtimes makes every
`renderToString` throw; API routes never touch Vue, which is why nothing looked wrong.

**CI could not have caught it.** deveco's CI installs with **pnpm** from `pnpm-lock.yaml`;
its Dockerfile installs with **npm** from `package-lock.json`. Two resolvers, two trees.
That is P1-15, and this session re-verified P1-15 hours before walking into it.

Two mistakes worth carrying forward: two independent changes went out in one deploy, so
the cause could not be attributed until the lockfiles were diffed; and a green fork CI was
treated as sufficient when this repo's own audit says it only typechecks the published
`.d.ts` surface. It does not run the app.

The retry ships nuxt and layer separately, and every step is now built AND RUN locally
against the npm tree with SSR probed before the PR opens. **A build passing is not a page
rendering.**

Note in passing: heatsync's Dependabot PR #22 (nuxt 3.21.10) handles this correctly -- it
raises the vue requirement alongside nuxt and resolves to a single copy. Dependabot got
the coupling right where I did not.

## Read this first

**Everything in this session shipped and is verified live on all three instances.** The
urgent item this handoff originally led with -- an unauthenticated Nuxt island RCE on
every instance -- is closed: all three run **nuxt 3.21.11**.

What is worth carrying forward instead is *how* it shipped, because the first attempt
caused an outage:

- **Roll nuxt and the layer as separate deploys.** Combined, they took every SSR page on
  deveco.io to 500 and the cause could not be attributed to either until the lockfiles
  were diffed.
- **Raise the root `vue` range whenever nuxt moves.** nuxt 3.21.11 requires `vue ^3.5.40`;
  a root pinned at `^3.4.0` makes npm nest a second Vue instead of upgrading the first.
  `overrides.vue` does not work while a direct dependency on vue exists (`EOVERRIDE`).
- **Fork CI proves nothing about the tree that ships.** CI installs with pnpm; the
  Dockerfile installs with npm. Both forks now run `scripts/check-single-vue.mjs` against
  `package-lock.json` before the install -- on heatsync, inside `deploy.yml`, since it has
  no CI at all.
- **Build AND RUN the npm tree locally, and probe an SSR route, before opening the PR.**
  A build passing is not a page rendering. That gap is exactly what shipped the outage,
  and it is the only check that would have caught it.

## What this session did

Re-verified all 28 open P1s from scratch, swept eight dimensions the previous audit never
covered, and fixed seven things. Every fix is covered by a test that discovers its targets
by scanning, and every test was mutation-tested against the pre-fix state.

| | what | status |
| --- | --- | --- |
| F-1 | stored XSS in the explainer conclusion CTA | **live, all three** (explainer 0.9.1) |
| F-2 | members' `emailNotifications` readable by anyone | **live, all three** (server 2.134.0) |
| F-3 | three credentials in the Docker build context | **live** at the next image build |
| F-4 | 557 `.vue` files nothing linted, and five real defects in them | merged, developer-facing |
| F-5 | README package table, `facts.md`, ROADMAP | merged, developer-facing |
| F-6 | twelve unguarded external hrefs, incl. a reflected query param | **live, all three** (layer 0.137.5) |
| F-7 | nuxt + undici off their advisories | **live, all three** (nuxt 3.21.11) |

Both defects that were live when this session started are closed. The
`emailNotifications` leak -- `curl https://deveco.io/api/users/<member>` returning a
member's digest cadence with no credentials -- was re-checked against each instance after
its deploy swap and returns nothing.

## Re-verification: the extent was understated almost everywhere

Of the 28 open P1s: **25 still real, 2 mis-stated, 1 fixed** (P1-19, the STATUS header).

- **P1-1** said `profileVisibility` was absent from "~13" public paths. Scanning all 198
  `from(users)`/`join(users` sites gives **at least 28 across 18 files**. Also:
  `listFollowers`/`listFollowing` apply no users predicate at all, and an admin
  *suspending* an account explicitly writes `deletedAt = null`, so a suspended profile is
  fully public.
- **P1-22** — `getConversationMessages` *does* check membership, contrary to the report.
  The real defect is that it then returns every message with no limit.
- **P1-3** has an amplification nobody recorded: an inbound federated DM is stored with
  `senderId` = the recipient, and `MessageThread.vue` renders any message whose senderId
  matches the viewer as the viewer's own outgoing bubble with the sender row suppressed.
  A remote attacker's text therefore appears **as words the victim wrote**.

## Things that will bite the next person

**The local test gate fails for reasons unrelated to your change.** `pnpm test` exits 1
with **zero failing assertions**: six suites die in `beforeAll` on a 30s hook timeout, and
under extra load that becomes 33 of 143. Run serially it is 143 files / 2,138 tests /
`rc=0`. The cause, measured: `createTestDB()` builds a fresh PGlite and pushes all 110
tables on every call — ~780ms on an idle machine — and **107 suites call it**. Treat the
cost, not the timeout.

**The authenticated editor E2E has never run.** `editor.spec.ts:113` skips on `TEST_AUTH`,
which is set nowhere, for the stated reason "to avoid failures in CI without a DB". CI
provisions Postgres, and a working `signUp` helper exists and is used by the persona and
member-directory specs. The blocker expired; the comment did not.

**`.vue` files are linted now.** If you add a component, `pnpm lint` will look at it. The
`vue/multi-word-component-names` rule is off on purpose (Nuxt resolves by file path) and
the `.vue` block deliberately does not spread the full `@typescript-eslint` recommended
set — that surfaced 19 findings of one stylistic rule and buried the five real ones.

## What I got wrong, since the pattern matters

**The credential fix shipped incomplete and my own guard did not catch it.** The first
pass excluded `secrets/`, `.secrets/` and key material, and I wrote a paragraph in
`.dockerignore` explaining that `.env*` matches only the repo root — then failed to apply
that sentence to `.env` itself. `apps/reference/.env`, holding `NUXT_AUTH_SECRET`, was
still entering the build context. The guard passed because I had scoped its scan to
`secrets/` directories. An independent re-verification of P1-8 found it.

**I truncated a class sweep and declared the class clean.** Sweeping for unguarded
`:href` sinks, I piped the output through `head -40`. There are 52 bindings; the unguarded
ones sorted below the cut. An independent agent found twelve, including the reflected
query parameter. That is F-6, and it exists because of the truncation.

**Five results were vacuous before being caught**: `--include=*.test.ts` eaten by zsh
globbing (reported 0 skipped tests for a repo with 37), a probe with a wrong import path
reporting "no tests", an eslint run whose stderr went to `/dev/null`, `rc=$?` capturing
`tail`'s exit code rather than pnpm's, and an exporter test passing against an empty
string because its fixture lacked `version: 2`.

## State at handoff

- Build 17/17, typecheck 30/30, lint 31/31. Layer suite 206 files / 2,967 tests. Server
  suite 144 files / 2,143 tests, green **when run serially** (see the gate note above).
- **All three instances healthy and fully rolled**, each verified after its own swap:
  `/`, `/about`, the feeds and `/api/health` all 200, feeds parsing, deveco's banner
  intact.
- Published to `latest`: protocol **0.15.3**, auth **0.13.3**, explainer **0.9.1**,
  learning **0.5.5**, server **2.134.0**, layer **0.137.5**.
- The 28 P1s from the previous audit are counted separately from its 3 fixed entries, so
  this session's work does not reduce that number -- it re-verified it (25 still real).

### Machine state

- **~34 GB of Docker reclaimed** at the end of the session, at the operator's request:
  images 39.24 GB (123) to 10.23 GB (28), build cache 5.15 GB to 0. Those are the figures
  *at the moment of the prune*; normal work rebuilds cache immediately, so do not read
  them as current. **Volumes were deliberately not pruned** -- they hold the data,
  including `commonpub_cpub_postgres`. Expect the first `docker compose up` or build per
  project to re-pull or rebuild.
- All 27 containers stayed up through the prune, 0 unhealthy.
- Session scratch cleaned (~672 MB): the local reproduction builds under `/tmp`, the
  lockfile copies, and the `deveco-repro` tree. No dev servers or test runners left.
- **Leftover databases on the dev Postgres at :5433**, checked rather than assumed --
  session 257's `cpub_audit_0825` and `cpub_audit_push` are already GONE. What remains
  from earlier sessions: `cc_test_09d5b1bc85f94b0d`, `cc_test_51cffda984004c17`,
  `cc_test_63d4945fdd664621`, `commonpub_verify`, `cpub_tz`, `cpub_v2`, `fork_repro`.
  None were created by this session; drop whichever you no longer want.
- `npm@11` now sits in `~/.npm/_npx` (16 MB). Keep it -- npm 10.9 crashes in arborist on
  the fork lockfiles and that is the working way to regenerate them.

## Next, in order

The roll is done; everything below is what it did NOT cover.

1. **Rotate the crates.io publish token.** The only exposure that has already happened
   rather than merely being possible -- it entered every Docker build layer until F-3.
2. **`sharp` to >=0.35.0** (four libvips CVEs). Needs a hand-edited range, because
   `^0.34.5` cannot cross to 0.35, and its own verification: it is the native module that
   processes every member upload, so it wants its own change rather than a ride-along.
3. **Make deveco's deploy able to fail** (P1-10, P1-11). Its post-deploy check curls a
   port the container only `expose`s and ends in `|| echo ::warning::`; the 2026-08-28 log
   prints "Health check failed" and the job still succeeds. Every verification in this
   session had to be done by hand from outside because of it.
4. **`profileVisibility`** (P1-1). Honoured on 7 of at least 35 relevant paths against a
   UI that promises otherwise. No instance has a non-public row yet, so this is a race
   between the fix and the first member who trusts the setting. It needs a shared
   predicate and a scanning guard, not 28 individual edits.
5. **The test gate** (N-1). `pnpm test` exits 1 with zero failing assertions;
   `createTestDB()` builds a fresh PGlite and pushes all 110 tables on each of 107 suites.
   Treat the cost, not the timeout.
6. **The remaining 28 P1s and 34 surviving new findings**, in
   `docs/reviews/2026-08-30-full-audit.md`. Three anonymous 500s and an anonymous slug
   oracle are the cheapest wins there.

### A limit worth knowing

`check-single-vue.mjs` guards `vue` and `@vue/server-renderer` specifically, because those
are what broke. It is **not** a general duplicate-dependency check -- another package
duplicating the same way would still ship.
