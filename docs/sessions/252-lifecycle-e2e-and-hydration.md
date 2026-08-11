# Session 252 — A real lifecycle E2E, and the production-only hydration bug it found

Two asks: make the test suite genuine rather than cosmetic, and walk a whole contest
through the browser. The second turned up a bug that had been live on every instance.

## 1. Test audit — coverage shape, not count

Session 251 shipped two live bugs while 1599 layer tests stayed green. The reason was
not a missing assertion; it was that all three modules involved had **no tests at all**.

| Module | Before | Now |
|---|---|---|
| `useApiError` | none — this is how the `err.data.data.errors` nesting survived | 8, against the real wire shapes |
| `useContentSave.buildSaveBody` | none | 6 (null/`''` stripping, UTC schedule, blank slug) |
| `ContestSubmissionField` number binding | none | 5, asserting the **emitted model value** |
| `EditorTagInput` | none | 8 (comma split, 64/20 caps, dedupe, blur, counter) |

Layer suite 1599 → **1626**. Also replaced one genuinely empty test: `useLayoutEditor`'s
abort case asserted `expect(true).toBe(true)` and said so in its own comment — it would
have passed with an empty function body. It now captures the AbortSignal handed to
`$fetch` and asserts `abort()` flips it.

Examined and deliberately left: 26 source-string "contract" tests (`readFileSync` + regex).
They prove a guard *exists*, not that it works — but each has a behavioural counterpart and
they were written where no harness exists. The `describe.skipIf(!reachable)` suites are
correct conditional skips, not disabled tests.

## 2. The lifecycle spec — `apps/reference/e2e/contest-lifecycle.spec.ts`

One 5-stage contest, walked end to end: anonymous visitor → follow (which must NOT count as
registering and must NOT permit entry) → upgrade through the rich registration form with every
input type → an unregistered entrant routed through registration then submitting → a
proposal-mode form entry → organizer registrant review + CSV export (participant refused the
PII export) → judge invite/accept/rubric scoring → top-N advancement → ranked public results →
closed registration → 390px.

CI's e2e job gains `FEATURE_CONTEST_{PROPOSALS,PII,PRIVATE_FILES}` so the spec exercises the
same contest a real instance runs.

**Audit findings, fixed in the spec rather than papered over:**
- Every "sleep then assert" was a flake generator → replaced with a polling helper.
- The judge invite banner is server-rendered, so it is clickable **before** Vue hydrates and an
  early click is swallowed (failed 2/2). Now retries the click until the banner clears.
- The auth-gate check redirects client-side, which aborts the navigation — and an abort can
  leave the page where it was, so a single `goto` has nothing left to settle. It stayed flaky
  in CI at a 60s budget, proving the timeout was never the problem. Now retries the
  navigate-and-check as a unit.

Collateral fixed: `navigation.spec`'s sidebar contest locator matched a bare
`.cpub-sb-head a[href="/contests"]`, which fails strict mode with more than one match. It only
ever passed because CI's database had no contests — this spec creates one. Now `.first()`.

**One product bug found by looking at the screenshots:** the judge page said *"Score each entry
from 0 to 100"* while rendering per-criterion inputs capped at their own max. A judge following
the instruction would have their score rejected. The copy is now rubric-aware. (Related, and
NOT a bug: `weight` doubles as a criterion's max points — the contest editor labels that field
"pts", and the judge UI and server agree.)

## 3. The bug the spec found on its first CI run

The spec creates a contest, and the homepage smoke test immediately began reporting
**"Hydration completed but contains mismatches"**. CI had never seen it because its database had
no contests — it had been latent on every instance running one.

It is **invisible in local development**: the dev server and the browser share a timezone. In
production the container is UTC and the viewer is not. Reproduced by running the dev server under
`TZ=UTC` with the browser in `America/Los_Angeles` — 10 warnings across 5 loads,
`rendered on server: "Aug 11" / expected on client: "Aug 10"`.

Three causes, all fixed:
- **`ContentCard`** formatted its byline with `toLocaleDateString`, so **every page that lists
  content** mismatched for any viewer whose zone crosses a day boundary against UTC. This is the
  most-rendered component in the app. The human string now renders after mount; the `datetime`
  attribute carries the raw ISO value so crawlers and assistive tech still get the date from SSR.
- **The legacy homepage** had three more of the same (two locale dates, one `Date.now()`
  countdown), now mounted-gated — with the countdown span gated on its own *label*, since
  emitting the element with empty text server-side is itself a children mismatch.
- **`ContestsSection`** deduped against `cpub:hero-contest-id`, published by a sibling's
  `watchEffect`. Whether that had run by render time differed between server and client, so the
  server emitted a contest list **shifted by one** against the client's — mismatched contest
  links on any instance with more than one active contest. The dedupe now applies after hydration.
  (Both homepage contest fetches also dropped `lazy: true`, so SSR no longer races the data.)

deveco's forked homepage carried the same two anti-patterns and was fixed in its own repo.

Verified with a UTC server against browsers in Tokyo, Los Angeles and UTC across `/`, `/contests`,
`/feed`, `/projects`, `/hubs`: **0 warnings in every combination** (was 10–17 on `/` alone).

## Roll — shipped to all 3

`@commonpub/layer` **0.125 → 0.128** across four increments (rubric-aware judging copy; then the
homepage contest widgets; then ContentCard + the legacy homepage + the dedupe), plus deveco's
fork homepage. No schema/config/server change, no migration.

Post-deploy: health ok and `/`, `/contests`, `/feed`, `/about` all 200 on all three; live
hydration re-checked from two timezones — **commonpub.io 0, deveco.io 0**.

## Open

- **heatsynclabs.io still logs one hydration mismatch per load** (Tokyo and LA alike). It is not
  any of the causes fixed here: heatsync has no homepage override, and its own `HeroSection` does
  not publish the dedupe key or render dates. Production builds strip the detailed warning, so
  identifying it needs heatsync's app run in dev mode locally.
- **~10 other components still format locale dates during SSR** (comments, messages, events, feed
  items, author rows). None are on the homepage; each needs the same mounted gate. This is the
  documented class, not an unknown.
- Server integration tests flaked once in CI on a `pg-protocol` parse error (Postgres connection
  during teardown) — same family as the docs worker-RPC flake fixed in session 251.
