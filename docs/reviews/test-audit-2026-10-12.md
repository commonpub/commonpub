# Test audit, 2026-10-12 (session 261)

Three parallel passes over every test in the repo:
- **Infrastructure:** does each suite run, in CI, and exit clean?
- **Quality:** which tests would stay green with the feature broken?
- **Coverage:** what has no test at all?

Each finding was checked against the code before it went into this report. The ones fixed this session are marked **fixed**.

## Where things stand

- **8,163 tests in 18 workspaces, all passing and all exiting 0 locally.** Every package with tests is reached by root `pnpm test` (turbo) and by CI. Server takes 262 s and the layer 156 s; everything else is under 20 s.
- **Routes:** only **72 of 405 API routes are actually run by any test** (26 of the 210 that mutate data). Another 85 have only source-text checks, which read the route file and look for a word. 171 rely on the `@commonpub/server` function they call being tested. 43 have nothing.
- **Components:** 88 of 193 layer components have a test. Of the 36 with real logic, 16 are untested.
- **Well covered:**
  - SSRF;
  - inbox actor binding;
  - sanitizers and `safeHref`;
  - persona and consent routes (real handlers, refusals tested);
  - contest judging and advancement server logic;
  - messaging participant checks.

## Fixed this session

| Finding | Fix |
|---|---|
| The contest personal-data routes had no behaviour test, only source-text checks: `registrants`, `registrants-export`, `export`, `entries/:id/private` | `layers/base/server/api/contests/__tests__/contest-pii-routes.test.ts`: 13 tests running the real handlers on PGlite with the real `requireAuth`/`hasPermission`. Mutation-checked: removing the per-contest scope on `private.get`, the shipping-list `contest.pii` check, or the accepted-judge check on `export` turns 4 tests red |
| `fetchAllPages` test pinned the bug it should catch (a clamped page read as the end) | Fixed in #94 with the loop |
| e2e "entries close when judging starts" passed on a duplicate-entry 400 | Asserts the reason text |
| e2e "a completed contest accepts no registrations" passed on a validation 400 | Asserts the reason text |
| `contest-proposals` "listing never leaks PII" could pass with zero assertions | Asserts the submit succeeded, exactly one entry and submission, and that the email and address values are absent anywhere in the payload |
| Real-Postgres suites (`concurrency`, `messaging`, `hub.integration`) skip silently if the DB is unreachable, including in CI | `realPgReachable()` throws under `CI` |
| `ContestActionBar` label checks: `toContain('Register')` matched "Registered" | Labels compared as whole strings |
| **Product bug.** `shouldSkipRateLimit` exempted any path ending `.png/.js/.css/...`, including `/api/users/alice.png` and every other API route whose last segment is a parameter | `/api/*` is never exempt. Test added first and failed. Ships with the next `@commonpub/infra` release (exact-pin cascade: infra, then server, then layer) |

## Open, ranked

### P1: green while users would hit the bug

1. **Profile visibility is promised but not enforced.**
   - `settings/privacy.vue` tells a member "Only you can see your profile", but `GET /api/users/:username` (`layers/base/server/api/users/[username].get.ts`) returns the full profile whatever the setting. So do its followers, following and content routes, and `/u/[username]`. Only the sitemap, the public API, the directory and the metrics honour it.
   - **This is a live privacy defect, not just a test gap.** Fix: one shared predicate for every public read of `users`, plus a sweep test that asserts it walked every read path (the same lesson as the sitemap fix).
2. **Federation signature tests can't catch a broken signing rule.**
   - `verifyHttpSignature.test.ts` checks "missing required header" by editing an already-signed request, so the signature fails for its own reason. Deleting the required-header rule in `keypairs.ts:78-92` leaves every test green.
   - Signing and verifying share the same string builder, so a bug in both is invisible.
   - Fix: sign chosen header sets with `crypto.subtle`, and add the draft-cavage Appendix C vector plus one captured Mastodon request.
3. **`inbox.test.ts:77` mocks `verifyHttpSignature` to pass and never checks what it was given.** A regression to re-serialized JSON (breaking digest checks on all inbound federation) stays green. Fix: a body with non-canonical spacing, and assert the raw bytes reach the verifier.
4. **`persona-profile-route.test.ts`: the fake DB's `where()` ignores its filter.** Dropping `isNull(users.deletedAt)` would publish a deleted member's persona, and the test still passes. Fix: PGlite with a soft-deleted user.
5. **`files/.../private-files-route.test.ts` only regex-checks the source.** The per-contest scoping in `raw.get.ts:48-62` could be deleted (any `contest.pii` holder reading every contest's uploads) with the test green. Fix: a behaviour test in the style of `contest-pii-routes.test.ts`.
6. **No behaviour test for:**
   - judge and stakeholder management: `judges` POST/DELETE, `stakeholders`, `user-search`;
   - `auth/sign-in-username`: the ban path, and not revealing which accounts exist;
   - the middleware ban downgrade and the `resolvePermissions` cache invalidation on role change;
   - Mastodon login state single use;
   - `admin.deleteUser`;
   - the `auto-admin` production gate.

### P2: weak, vacuous or flaky

- **259 test files are never typechecked.** Nine packages exclude `src/__tests__` from `tsc`. Including them gives 199 errors, mostly `noUncheckedIndexedAccess`. Real ones include:
  - `activityTypes.test.ts:171`, a type test that never imports its type;
  - `hooks-integration.test.ts`, which passes `status: 'published'` to `createContent`, where the field is ignored, so the content stays a draft.

  Fix: a `tsconfig.test.json` per package, run by `typecheck`.
- **e2e:**
  - Only the `chromium` project runs in CI; `mobile-chrome` (real Pixel 5 emulation) never does.
  - `member-directory.spec.ts` tests 2-4 always skip (no admin can be minted in CI), and they cover the only public surface that returns identified people.
  - `editor.spec.ts` authed block is dead: `TEST_AUTH` is never set, and it uses the removed `/article/` route.
  - 29 `waitForTimeout` sleeps sit before positive assertions.
  - `if (await x.isVisible())` branches in `responsive`/`navigation` can skip the whole check.
  - `api.spec.ts` accepts `[200, 404]` although CI turns the features on.
  - `retries: 2` hides all of this.
- **Source-scan tests that check words:** about 30 layer route tests. Examples: `entry-registration-gate.test.ts:53` (finds the import on line 1, so it is always true) and `by-route-draft-leak.test.ts` (satisfied by a comment). Replace them with behaviour tests on the `nitroStubs` + PGlite pattern.
- **Tests that test a copy:**
  - `betterAuthCookie.test.ts` checks against a hand copy of better-call 1.3.5; the lockfile has 1.4.0.
  - `features-override-cap.test.ts` validates its own schema.
  - `apps/reference/__tests__/*`: `auth-middleware-routing` has already drifted from the real middleware.
- **Contest:**
  - the `ContestHero` deadline gate on **Submit Entry** is never exercised;
  - "scores hidden during judging" runs before judging;
  - refusals asserted as bare `null`;
  - `contest.integration.test.ts:1209` waits a fixed 200 ms.
- **Federation and privacy:**
  - the members-only comment gates assert a bare `rejects.toThrow()`;
  - `content-injection.test.ts` is titled "rejects actor with script" but asserts it is accepted;
  - `javascript:`/`data:` avatar URLs are stored raw. Inert in `<img src>`, but there is no test.
- **`purposeConsent` history ordering is flaky.** It uses a same-millisecond timestamp with a random UUID tiebreak. It is a small product ordering bug as well.
- **Layer test output:**
  - 50 "Failed to resolve component" warnings, so some component tests don't render what they claim. Examples: `AdminThemePreviewPane` (27), `ContestStagesEditor.phase4` (7), `settingsProfileTabs` (7).
  - axe's colour-contrast rule never runs in jsdom (`getContext` not implemented). Disable it explicitly where that is the intent.

### P3: hygiene

- 89 lint warnings in test files (79 unused vars).
- Always-true assertions, e.g. `toBeDefined()` on `Headers.get()`.
- Loops with no minimum count.
- `packages/auth` guards redirect to a route that does not exist.
- `seo-meta.spec` depends on alphabetical spec order.
- `docs` vitest retries in CI.

## Suggested order

1. Profile visibility enforcement and its sweep test. It is a privacy promise the site currently breaks.
2. Behaviour tests for private files, judge and stakeholder routes, and sign-in.
3. The federation signature and inbox tests.
4. `tsconfig.test.json` per package.
5. e2e: mobile-chrome in CI, a CI admin bootstrap so the directory and editor specs run, then replace sleeps with `expect.poll`.
6. Convert source-scan route tests to behaviour tests as each area is touched.
