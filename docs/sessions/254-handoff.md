# Session 254 — Handoff (state, what shipped, what's open)

A deep audit of what session 253 shipped, then an audit of the audit's fixes, then an audit of those.
Three rounds. **Every round found real defects in the previous round's work**, which is the single most
useful fact in this document.

Detail: `docs/sessions/254-deep-audit-and-fixes.md`. Session 253's context: `253-handoff.md`.

## Where things stand

| Package | This roll | Package | This roll |
|---|---|---|---|
| `@commonpub/layer` | **0.132.0** | `@commonpub/ui` | **0.15.0** |
| `@commonpub/server` | **2.130.0** | `@commonpub/auth` | **0.13.0** |
| `@commonpub/infra` | **0.21.0** | `@commonpub/theme-studio` | **0.7.0** |
| `@commonpub/editor` | **0.17.1** | `@commonpub/explainer` | **0.8.1** |
| `@commonpub/config` | 0.38.0 (unchanged) | `@commonpub/schema` | 0.63.0 (unchanged) |

No migration. Still **42 flags**. 6013 unit tests, typecheck clean, lint 0 errors.

## What shipped

### Consent was not specific to what it was given for (P1, was live)

Between `0967da84` (2026-04-04) and `929eeba9` (2026-06-10) the only non-essential cookie was
`cpub-color-scheme`, a dark-mode preference, so "Accept all" meant "remember my theme". Those cookies
last a year. Reproduced against the live property: a seeded `cpub-consent=all` on deveco.io produced
two vendor requests, a `/collect` beacon and both `_ga` cookies, with the banner never shown.

`cpub-consent` now stores `<level>|<scope>`, where scope digests the non-essential **purposes and their
processors**, derived from the registry that renders the policy page. A stale grant counts for nothing;
a stale refusal is honoured, which is also what keeps the shared e2e `storageState` working.

### The privacy page promised three things the code did not do (P1, was live)

Search terms reached Google in `dl`; `page_view` fired on private routes carrying titles like
`Message, <person>`; withdrawal left both `_ga` cookies and kept emitting beacons. All three are now
true in code rather than in intention.

### A `-1` sentinel was reaching real users (P1, was live)

`/api/search?...&offset=24` returned `{total: -1, items: 11}`. The page printed "-1 results" and the
pager unmounted, taking Previous with it, with no page number in the URL to recover from.

### WCAG AA on every coloured fill (P2, was live on the default theme)

The session-253 sweep matched class names, so it missed the identical `.submit-btn` on login and
register: **2.79:1** on the shipped default. Fixed, plus green (**2.28:1**, worse, and unreported) and
25 further blocks using `--surface` as text on a fill. There is now a real per-fill token family
(`--color-on-accent` / `-red` / `-green` / `-yellow`), every pairing >= 4.62:1 in all six themes, emitted
by Theme Studio and registered in the canonical token list.

### Every branded link preview on a custom instance said "CommonPub" (P1, was live)

`useSeoMeta({ title: () => ... })` passes a GETTER, evaluated by the head resolver outside the
component setup context. `useSiteName()` reads `useState()`, which throws there, and its `catch`
returns the `'CommonPub'` fallback. The failure splits cleanly by call style, measured on live
deveco.io:

| page | title | how it was built |
|---|---|---|
| `/privacy`, `/explore`, `/terms` | `..., devEco.io` | eager template literal |
| `/contests/<slug>` | `..., CommonPub` | `title: () => ...` getter |

`og:site_name` was correct throughout, because the seo-brand plugin resolves it eagerly — so the page
advertised two different brands at once, and the tag people check was the one that was fine. The tag
that actually renders in Slack, Discord and iMessage is `og:title`, which carried another product's
name on every contest, project, hub, doc and video page.

Fixed at all 27 call sites in 25 files by resolving once in setup. **The durable fix is a
`titleTemplate` in the head**, so pages never append the brand at all and the guard becomes
unnecessary rather than enforced — see open items.

### Tests that could not fail

Three were rewritten after proving they could not detect their own bug. The CSP decision moved into
`buildPageCsp`, a pure function, because a test that regexes a source file cannot see behaviour.

## The two decisions, taken

1. **`--color-on-red` (and `-green`, `-yellow`).** Not deferred: CLAUDE.md rule 12 makes AA the
   minimum, so 3.99:1 is not an option. Reusing an existing token was impossible — on agora
   `--color-on-accent` is 3.99:1 on red while `--color-text-inverse` is 4.51:1, and on base the ranking
   inverts, so the suggested revert would have *moved* the failure.
2. **The `auth.requireEmailVerification` ship gate is cleared.** `emailVerification.sendOnSignIn` is
   armed, so a blocked sign-in mails a fresh link. Verified in better-auth's source, not assumed:
   `sign-in.mjs:228` validates the password and throws before the verification branch at `:235`, and
   the address comes from the stored user record, never the request body — so it cannot name a victim
   and is not a relay.

   **Still required before flipping that flag:** a real mail transport. With a console sink a blocked
   sign-in mails nothing and the user is stuck exactly as before.

## What each round found in the previous round

This is the part worth internalising.

**Round 2, in round 1's fixes:** the pagination routes re-derived `limit` instead of sharing
`normalizePagination`, so `?limit=500` made `hasMore` false and hid the pager — **reintroducing the
exact bug being fixed**. Making `total` nullable violated the published openapi schema. Seven more
public routes still emitted the old envelope, one of them (`/api/public/v1/search`) an untraced
sentinel producer. The new contrast scanner matched `var(--accent-bg)` because `\b` sits at the hyphen.
The "derived" private-route check had no coverage: the e2e only ever reached the prefix backstop.

**Round 3, in round 2's fixes:** the generator and token registry gained `color-on-yellow` while no
built-in theme defined it, so a custom theme would carry a token every stock theme resolved to nothing.
The Theme Studio picker **measured `#000000` but emitted `#0a0a0a`**, shipping a 4.40:1 token while its
own check reported 4.67:1.

## Open — ranked

1. **Adopt a `titleTemplate`** so pages set only their own title and the head appends the brand. That
   removes 27 call sites where the site name is appended by hand and makes the "never resolve the site
   name in a getter" rule unnecessary instead of merely enforced by a lint-style test. Also worth
   normalising the separator while doing it: `/hubs` used ` -- ` where everything else uses `, `.
2. **The openapi document has no test coverage at all**, and this session changed its pagination
   contract (`total` nullable, `hasMore` required). The fix is to extract the document builder into a
   pure function the way `buildPageCsp` was, which was too large to bundle into this roll. Until then a
   route added without `toPageMeta` will violate the published schema silently.
3. **The resend rate limiter fails open on a Redis blip** and is the only guard on a metered side
   effect. Fail-open is a documented codebase-wide invariant, so overriding it for the mail path is an
   operator policy call, not a bug fix.
4. **Flag mirrors**: one flag is declared in seven places, four unguarded and drifted. Nothing is wrong
   live. Same root cause as the `create-commonpub` drift.
5. **`create-commonpub` must not publish another release** until its four confirmed defects are fixed;
   it hand-mirrors `apps/reference` config as Rust string literals and the mirrors have rotted.
6. **`/api/notifications` and the hub product routes** are converted but not covered by the class e2e,
   which probes only unauthenticated endpoints.
7. Still deferred from 249/250: themed-email redesign, nonce CSP, legacy-URL scrub migration 0046.

## Notes for whoever picks this up

- **Audit your own fixes.** Every round here found defects in the previous round, including one that
  reintroduced the bug being fixed. A fix is new, unreviewed code.
- **A fan-out audit finds the defect and understates its extent.** It reported 3 producers of the `-1`
  sentinel; there were 13. Grep the mechanism yourself, then write a class-level test and let it find
  the rest — that is what caught `/api/content?offset=20&featured=true`.
- **Mutation-test every new assertion.** Nine separate mutations were used here; three tests were
  rewritten after mutation showed they could not fail.
- **A scanning test must assert it scanned something.** The accent guard resolved the repo root one
  level short, walked zero files, and reported a clean sweep. Its own file-count assertion caught it.
- **Measure the value you emit, not a proxy for it.** See the Theme Studio picker above.
- **`var(--accent\b` also matches `var(--accent-bg)`.** The word boundary sits at the hyphen, and a
  tint is not a fill.
- The local e2e environment failures from 253 persist and are not code: a leftover custom theme in
  `instance_settings` and a dead seeded avatar host.
