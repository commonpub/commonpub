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

**All three production instances are running a Nuxt inside an unauthenticated RCE
advisory range, and the affected endpoint answers.** That is the single most urgent thing
in this handoff.

```
[high] nuxt >=3.4.0 <3.21.10   patched >=3.21.10
  Server-Side Remote Code Execution via Runtime Template Injection
  in Nuxt Server Island Props
```

Both forks' `package-lock.json` — the file their Dockerfile builds from — resolve **nuxt
3.21.5**. `GET /__nuxt_island/x.json` returns **204** on commonpub.io, deveco.io and
heatsynclabs.io, so the endpoint is anonymously reachable. Three more unauthenticated
highs sit in the same range (island OOM, island CPU exhaustion before hash validation,
unauthorized component instantiation).

**The monorepo half is fixed and green**: `^3.16.0` already permitted the patch, so it was
a lockfile re-resolve to **3.21.11**, with `undici` to **7.29.0** at the same time. `pnpm
audit` now reports zero nuxt and zero undici advisories; repo totals fell from 6 critical
/ 76 high to 3 / 51, and what remains is mostly devDependencies that never enter the
image.

**The forks are not fixed.** They install independently. Each needs `nuxt` re-resolved to
`>=3.21.10` in **both** lockfiles (`package-lock.json` is what Docker builds from,
`pnpm-lock.yaml` is what CI frozen-installs; both are tracked in both forks) and a deploy.

Worth noting while you are in there: deveco's two lockfiles currently disagree about nuxt
— 3.21.2 in `pnpm-lock.yaml`, 3.21.5 in `package-lock.json`. That is P1-15 from the
previous audit, visible in the wild.

## What this session did

Re-verified all 28 open P1s from scratch, swept eight dimensions the previous audit never
covered, and fixed seven things. Every fix is covered by a test that discovers its targets
by scanning, and every test was mutation-tested against the pre-fix state.

| | what | reaches prod via |
| --- | --- | --- |
| F-1 | stored XSS in the explainer conclusion CTA | republish `@commonpub/explainer` |
| F-2 | members' `emailNotifications` readable by anyone | `@commonpub/server` → layer |
| F-3 | three credentials in the Docker build context | next image build |
| F-4 | 557 `.vue` files nothing linted, and five real defects in them | developer-facing |
| F-5 | README package table, `facts.md`, ROADMAP | developer-facing |
| F-6 | twelve unguarded external hrefs, incl. a reflected query param | `@commonpub/layer` |
| F-7 | nuxt + undici off their advisories | monorepo image; forks separately |

**Two are live defects right now.** The `emailNotifications` leak was reproduced against
deveco.io during this session — `curl https://deveco.io/api/users/<member>` returns digest
cadence and per-event toggles with no credentials. And the Nuxt version above.

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

- Build 17/17, typecheck 30/30, lint 31/31. Layer suite 206 files / 2,967 tests green on
  the bumped tree. Server suite green when run serially.
- All three instances healthy; **nothing published, nothing deployed**.
- The 28 P1s from the previous audit are still counted separately from its 3 fixed
  entries, so this session's work does not reduce that number — it re-verified it.

## Next, in order

1. **Nuxt on the forks.** Both lockfiles, then deploy.
2. **Rotate the crates.io token** — the only exposure that has already happened.
3. **Roll F-1, F-2, F-6** through the `--tag next` prerelease gate that worked in 257.
4. **`sharp` to >=0.35.0** — needs a hand-edited range (`^0.34.5` cannot cross to 0.35)
   and its own verification, since it processes every upload.
5. **Make deveco's deploy able to fail** (P1-10, P1-11).
6. **`profileVisibility`** (P1-1) — a shared predicate plus a scanning guard, not 28 edits.
