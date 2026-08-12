# Session 254 — deep audit of what session 253 shipped, and the fixes

Two halves. Dimension 1 (privacy, consent, legal) was audited by hand against the **live deveco.io
property**, because it is the one that is regulated and the one no test could settle. Dimensions 2-7
ran as a 33-agent adversarial fan-out where every finding had to survive an independent refutation
attempt with a distinct lens; 23 survived.

Everything below was re-verified before being acted on, including the audit's own output. Two of its
claims were wrong or overstated, and one of its lists was materially incomplete.

## What was found and fixed

### 1. Consent was not specific to what was disclosed (P1, live)

Between `0967da84` (2026-04-04) and `929eeba9` (2026-06-10) the only non-essential cookie was
`cpub-color-scheme`, a dark-mode preference. "Accept all" in that window meant "remember my theme".
The cookie lasts a year, so when GA4 shipped in session 253 those visitors were tracked on their next
visit with no banner and no new ask. Reproduced live: a seeded `cpub-consent=all` produced two vendor
requests, a `/collect` beacon and both `_ga` cookies, banner never shown.

`cpub-consent` now stores `<level>|<scope>`. Scope is a digest of the non-essential **purposes and
their processors**, derived from the same registry that renders the policy page, so adding a provider
re-asks by itself and an operator has nothing to remember. Switching GA4 property ids does not re-ask;
switching provider or adding a category does.

A stale answer **degrades** rather than being discarded. A stale `all` grants something never shown, so
it counts for nothing and is asked again. A stale `essential` already refuses, so it is honoured. That
asymmetry is also what keeps the pre-answered `storageState` every e2e spec relies on working across a
disclosure change; the first version of this fix would have broken every spec in the suite.

`instance.cookiePolicyVersion` now reaches the client as the manual lever for a wording change, the one
thing the registry cannot see. It previously existed but was read only by `consent.post.ts`, so bumping
it re-prompted nobody.

### 2. The privacy page promised three things the code did not do (P1, live)

- **"Anything you type into a form" is not collected.** `/search?q=my+secret+search+term` reached
  Google in the `dl` parameter of a `view_search_results` hit. Query and fragment are now stripped, and
  `set` runs before `config` so GA4's enhanced measurement inherits the sanitised location instead of
  reading `document.location` and restoring the query.
- **"Anything on a page you need to be logged in to see."** `page_view` fired on every route with its
  title, and `pages/messages/[conversationId].vue:81` renders `Message, <participant>`. Routes
  declaring the `auth` middleware now send nothing. That signal is derived, so new pages are covered
  automatically; a small prefix list backstops pages that omit it. Private routes get a **placeholder**
  location rather than being skipped, because skipping is not neutral: with nothing set, gtag falls
  back to `document.location`.
- **"Withdrawing stops any further collection."** A withdrawn visitor kept both `_ga` cookies and
  emitted two more beacons on the next navigation. Withdrawal now purges the provider's cookies, using
  names from the registry that disclosed them, and reloads, because a resident tag cannot be unloaded.

Also: the essential-cookie list is derived rather than typed out (it had drifted, omitting
`cpub-verify-dismissed` and describing the theme cookie as local storage, which the same page's section
5 contradicted); enhanced measurement is disclosed; `anonymize_ip` was dropped as a documented no-op in
GA4, where IP anonymisation is always on and cannot be configured.

### 3. A `-1` "count not computed" sentinel was reaching real users (P1, live)

The list helpers skip `COUNT(*)` past the first page and report `-1`. Nothing translated it back, and
`?? 0` cannot: nullish coalescing fires only on null and undefined.

On deveco.io, `/api/search?q=a&dateFrom=2000-01-01&offset=24` returned `{total: -1, items: 11}`. The
page printed "-1 results" and `Math.ceil(-1 / pageSize)` collapsed `totalPages` to 1, so the pager's
`v-if` went false: a visitor who clicked to page 2 lost **Previous as well as Next**, and `page` is not
in the URL. The events page navigates with `router.replace`, so Back did not recover it either.

The root cause was one type describing two things. `PaginatedResponse` stays internal and may carry the
sentinel; `PaginatedPage` is what a route returns and cannot. `toPageMeta` converts, reporting
`total: null` so a consumer can tell "not counted" from "none", plus `hasMore`, which a pager can bind
to either way.

**The audit's list was incomplete and this is the lesson worth keeping.** It traced 3 producers and 4
consumers. The real surface is 13 producers, including six in `product.ts` plus federation and
notifications, and routes it never mentioned were still returning `-1` after the first round of fixes.
`/api/content?offset=20&featured=true` was one: any of authorId/featured/editorial/categoryId/
difficulty/tag bypasses the federated merge, which is what forces `localOffset` past zero. The
class-level e2e is what found it, not the report.

### 4. The AA sweep was keyed on class names (P2, live)

Session 253 converted `--color-text-inverse` to `--color-on-accent` by matching class names, so it
caught `.cpub-submit-btn` on forgot-password and missed the identical `.submit-btn` on login and
register. Measured:

| theme | text-inverse on accent | on-accent |
|---|---|---|
| base | **2.79:1** (below even the 3:1 large-text floor) | 6.24:1 |
| agora | **3.78:1** | 4.76:1 |
| stoa | **4.44:1** | 4.60:1 |
| dark themes | unchanged (the tokens are equal there) | |

28 blocks converted via a **block-scoped** scan, two more than the audit listed, including the
hardcoded `, #000` fallback on `.cpub-notif-badge` that would have survived the token change.

`--red` was left alone in round 1. On agora, `on-accent` scores 3.99:1 against `--red` versus 4.51:1
for `text-inverse`; on base it is 4.62 versus 3.76. Exactly one theme fails either way, so the audit's
suggested revert would have **moved** the failure rather than fixed it. Resolved in round 2 below with
a real per-fill token family.

### 5. Tests that could not fail (P2)

Each was checked by breaking the thing it guards.

- `security-analytics-csp.test.ts` regex-matched the middleware's **source**. Inverting the ternary so
  the CSP opened the vendor origin exactly when analytics was OFF — the production defect it was
  written to prevent — left all three assertions green, because the inverted code still contained every
  string they matched. The decision moved into `buildPageCsp`, a pure function in `@commonpub/infra`;
  the same inversion now fails 4 of 7. (The audit claimed deleting the gate while keeping the comment
  would also pass. It would not: the comment does not contain the literal. The weakness was real, the
  stated mechanism was not.)
- `ContestActionBar.test.ts:184` searched for `cpub-cbar"` with a trailing quote, which a two-class root
  can never produce. Now compares class tokens.
- `contestCounts.test.ts` stated the SSR-zero countdown was "covered by its own test". Nothing rendered
  `CountdownTimer` at all. Added a test through the SSR path where the bug appeared.

Two guards carry a guard of their own, because the failure being fixed is a test that reports success
while checking nothing. The accent scan asserts it walked a plausible number of files, and **caught a
real bug in itself immediately**: it resolved the repo root one level short, walked zero files, and
reported a clean sweep.

## Versions

`ui 0.15.0` · `auth 0.13.0` · `theme-studio 0.7.0` · `infra 0.21.0` · `server 2.130.0` · `editor 0.17.1` · `explainer 0.8.1` · `layer 0.132.0`. No migration.
PR [#76](https://github.com/commonpub/commonpub/pull/76).

## Round 2: re-auditing this session's own work

"The fixes to the audit findings were never themselves audited" is the failure this session exists to
correct, so the session's own changes were then audited the same way. **Four defects were in my work.**

1. **The pagination routes re-derived `limit`** instead of sharing `normalizePagination`. `/api/events`
   and the attendees route take a raw `Number(query.limit)` with no schema, so `?limit=500` left the
   route comparing against 500 while the helper clamped to 100: `hasMore` goes false and the pager
   disappears, **reintroducing the exact bug being fixed**. `?limit=abc` was worse, as NaN fails every
   comparison.
2. **Making `total` nullable violated the published openapi schema**, which declares a required
   integer. Seven more public routes still emitted the old envelope, and `/api/public/v1/search` was an
   untraced sentinel producer returning `total: -1` through the versioned contract.
3. **The contrast scanner matched `var(--accent-bg)`**, the tint token, because `\b` sits at the hyphen.
   Verified no tinted background was wrongly converted (all 83 on-colour usages sit on solid fills), so
   nothing shipped wrong, but the guard would have false-positived.
4. **The private-route rule had no real coverage.** The e2e exercised only the prefix backstop, because
   logged out `/settings/profile` redirects to `/auth/login` and `/auth` is in the list. The derived
   middleware check was never executed by any test. Extracted and tested; typecheck then caught that
   Nuxt's `middleware` may be a FUNCTION, which cannot be matched by name.

## Both decisions, taken

**1. `--color-on-red` and `--color-on-green` (done).** Not deferred, because CLAUDE.md rule 12 makes AA
the minimum, so knowingly shipping 3.99:1 is not an option the codebase allows. Reusing an existing
token cannot work: on agora `--color-on-accent` is 3.99:1 on `--red` while `--color-text-inverse` is
4.51:1, and on base the ranking inverts, so the audit's suggested revert would have **moved** the
failure. Re-auditing also found the same defect on **green** (2.28:1 on base, worse than accent, and
unreported by anyone) plus **25 further blocks** using `--surface` as text on a solid fill, failing on
the shipped default. Every pairing is now >= 4.62:1 across all six themes. Theme Studio emits the
tokens too, and they are in the canonical token registry, which is what rejected them until updated.
The generator's first version measured `#000000` but emitted `#0a0a0a`, shipping a 4.40:1 token while
its own check said 4.67:1 — measuring a proxy for what you ship. Verified over 72 generated pairs.

**2. The email-verification gate (cleared).** `emailVerification.sendOnSignIn` is now armed, so a
blocked sign-in mails a fresh link. Safe unconditionally, verified in better-auth's source rather than
assumed: sign-in.mjs validates the password at `:228` and throws before the verification branch at
`:235`, and the address comes from the stored user record, never the request body. It cannot name a
victim and is not a relay. Inert until an operator enables the hard gate, and the dead
`|| config.auth.requireEmailVerification` disjunct is gone from the resend route.

**Still true:** do not enable the hard gate without a real mail transport. With a console sink a
blocked sign-in mails nothing and the user is stuck exactly as before.

## Open questions

1. **The resend rate limiter fails open on a Redis blip** and is the only guard on a metered side
   effect. Fail-open is a documented codebase-wide invariant, so overriding it for the mail path is an
   operator policy call.
2. **Flag mirrors**: one flag is declared in seven places, four unguarded and drifted. Nothing is wrong
   live. Same root cause as the `create-commonpub` drift.
3. **`create-commonpub` should not publish another release** until four confirmed defects are fixed;
   it hand-mirrors `apps/reference` config as Rust string literals and the mirrors have rotted.
4. Remaining `-1` producers behind auth (`/api/notifications`) and hub product routes are converted but
   not covered by the class e2e, which probes only unauthenticated endpoints.

## Method notes

- **Verify the effect, not the presence.** Carried from 253 and it kept paying: a `nuxt typecheck` that
  printed nothing and exited 0 was confirmed to actually check by planting a type error.
- **Mutation-test every new assertion.** Six separate mutations were used to prove the new tests fail
  when the bug returns. Two tests were rewritten after mutation showed they could not.
- **Do not trust the audit's list, only its mechanism.** The fan-out is excellent at finding a real
  defect and unreliable about its full extent.
