# Session 253 — operator report triage, plan, and Roll A (count integrity + AA contrast)

An operator (Robert) filed five urgent items against deveco.io. Three of his diagnoses were wrong and
three of his observations were right, which is not a contradiction: he described real symptoms and
guessed at causes. This session established what is actually true, wrote the plan, and shipped the
correctness half of it.

Plan: `docs/plans/contest-cta-metrics-and-analytics.md`.

## What the investigation found

Verified by reading source and by fetching/driving the live page (curl of the SSR HTML, Playwright at
390x844 and 1440x900), not inferred.

**The top-of-page register CTA already exists.** Session 250 added it; it is the first interactive
element in the content area, at y=590 on mobile, and on deveco it computes to 9.35:1. "The buttons are
only in the sidebar and the contrast is low" is false on the site he was looking at.

**But the page is 9,865px tall on mobile** and a register affordance appears once at y=590 and then not
again for ~9,000px. The sidebar registration card is at ~92% of DOM depth, the grid collapses at 768px,
and nothing on the page is sticky. For 89% of the mobile page there is no CTA on screen. The real
defect is persistence, not placement.

**Follow is worse than reported.** The only follow control is authenticated-only and secondary-weight
inside the sidebar card. Anonymous visitors are never offered it at all.

**Three separate causes behind "the 0s":**
1. `registrantCount` was seeded `ref(0)` and fed by a `server: false` fetch, so the SSR HTML of every
   contest page said **"0 makers registered"** while the hero two screens up said "10 following". The
   existing comment at `index.vue:18-24` documents the trade deliberately — a previous session silenced
   the *hydration warning* by making SSR render a consistently wrong number.
2. `CountdownTimer` seeded every unit to 0 and only ran `update()` in `onMounted`, so tiles shipped
   **"00h 00m left"** and the legacy homepage shipped a 4-box grid of zeros. Same SSR class session 252
   spent a day on; nobody had noticed it. Robert found it from the outside.
3. `entryCount` was ungated at all 9 render sites and unpluralized at 2 (the live contest read
   **"1 entries"**).

**The page stated three inconsistent numbers** for one contest: hero "1 entry / 10 following", tabs
"Entries 1 / Participants 1", sidebar "7 makers registered / 10 following". `full` is a *subset* of
`followers` (`registrations.ts:460-482`), so two of those overlap by construction.

**`.cpub-btn-primary` failed WCAG AA in 6 of 7 built-in themes**, not the 2 the first pass found:
base/dark/generics 2.79:1, agora 4.16, agora-dark 3.21, stoa 4.44. Only stoa-dark passed. Both forks
override it, so this was a commonpub.io / apps/reference defect that also shipped to every new instance.

**No account-verification email is sent on any instance** (`requireEmailVerification` is false
everywhere and deveco leaves it off deliberately). The operator confirmed he meant a *contest* email, so
that item is parked pending the actual message.

**The cookie banner cannot render on deveco** — it needs a declared non-essential cookie, and deveco's
`nuxt.config.ts` never wires anything from its `commonpub.config.ts` into `runtimeConfig.public`.
`allowsAnalytics` has zero consumers, and `privacy.vue:90` states "We do not use any analytics
services". All three block GA4.

## Verdict on the proposal

Rejected: bottom drawers (self-refuted: "users should not have to open a drawer to see Register"), the
swipe drawer (no gesture code exists; WCAG 2.1 SC 2.5.1 forces the X anyway, so the swipe is pure cost),
the pulse animation (`base.css:432` clamps animations to 0.01ms under `prefers-reduced-motion`, so it
no-ops for exactly the people who need help), the desktop CTA bar as specified (its premise is wrong:
the admin stage controls are *inside* the hero, not a separate band), and three simultaneous
REGISTER/FOLLOW/SUBMIT buttons (mutually exclusive states, so one would always be dead).

Kept: the diagnosis, the top CTA row with hierarchy imposed, Follow surfaced, preserving logged-out
intent, and "make it stand out" (a real AA bug, though not the one he described).

Recommended instead of drawers: one persistent action bar, sticky under the topbar above 768px and
fixed to the bottom below it. The established pattern, one component, no gesture, no animation.

## Roll A, shipped in this session

Correctness only. No flag, no new component, no layout risk.

- **New `packages/theme-studio/src/__tests__/theme-contrast.test.ts`** asserts the filled-CTA token pair
  clears 4.5:1 in all seven shipped themes, across all four aliases
  (`--color-on-accent` / `--color-accent-text` / `--color-on-primary` / `--color-primary-text`), plus a
  fourth test that the aliases agree. Written first; it failed 13 ways. It lives in theme-studio because
  that package already owns `contrast()`, and copying the luminance math into `packages/ui` is how
  mirrored copies drift.
- **Fixed all six failing themes by moving the LABEL, never `--accent`.** CLAUDE.md locks the blue
  accent, and it drives chips, links, borders and timeline dots, so darkening it was not on the table.
  base/dark `#1a1a1a` (6.24:1), generics `#0c0c0b`, agora `#0a0a0a` (4.76), agora-dark `#0d1a12` (5.58),
  stoa `#ffffff` (4.60). The alias-agreement test immediately caught a drift the manual grep had missed
  (`agora-dark.css:65` was still `#ffffff` in a later block).
- **De-duplicated `.cpub-btn-primary`**, defined in both `components.css` and `layouts.css` at equal
  specificity with *different* label tokens, so the shipped value depended on import order.
- **`min-height: 44px` + explicit `line-height` on `.cpub-btn`.** A `<button class="cpub-btn">` rendered
  ~37px and an `<a class="cpub-btn">` ~44px, side by side in every CTA row. Both now 44, which is the
  height `.cpub-btn-sm` already declared.
- **`CountdownTimer` no longer server-renders zeros.** Follows the `ContestHero.vue:46,149` mounted-gate
  pattern, keeps a `<time datetime>` in the SSR output so the deadline stays machine-readable, and
  reserves the row height so hydration does not shift the card.
- **New `layers/base/utils/contestCounts.ts`** (+ 14 unit tests) holds the display rules, because five
  surfaces render these counts and had drifted into four guards and two labels.
- **One public number, `followerCount`, labelled "registered".** Every row in `contest_registrations` is
  a registration; `tier` only records whether it was to enter or for reminders. It is already on the
  SSR'd `ContestDetail` and on `ContestListItem`, so this **fixed the "0 makers registered" SSR lie with
  no server change** — no new DTO field, no tier split, no extra query. The `full` split stays organiser
  information in the owner-only registrants panel.
- **Entries appear only once submissions close** (judging/completed), pluralized, zero-suppressed.
  `entryCount` counts draft placeholder rows, so it is the wrong number to headline while open.
- Removed the duplicate count rows from the sidebar Status card; the Entries tab badge now suppresses
  zero the way the Judges tab in the same computed already did.
- **Anonymous intent is preserved.** Contest register CTAs now target
  `/auth/login?redirect=/contests/:slug/register` so login lands the visitor *in the registration form*
  rather than back on the contest page unregistered. Also fixed a live bug: `login.vue` and
  `register.vue` cross-link to each other and both honour `?redirect`, but neither passed it, so
  switching between them discarded the intent entirely.
- The page now overlays a `liveFollowerCount` from the register/unregister response onto the DTO, so the
  count still updates after the viewer acts. Starts null on both server and client, so it cannot
  mismatch on hydration.

### Verification

- 1635 layer tests, 113 theme-studio tests, full `pnpm test` (33 tasks), `pnpm typecheck` (28), `pnpm
  lint` (1 pre-existing warning) all green.
- `contest-lifecycle` E2E: 8/8 passed.
- Ran the app and checked the rendered output, per the standing rule. SSR HTML of the detail page now
  reads "3 registered" in **both** the hero and the signup card; the tiles show no `00h 00m` and no
  "0 entries"; completed contests correctly still show their entry count. Measured the buttons in a
  token harness: fill stays `#5b9cf6`, label is `#1a1a1a`, and `<button>`/`<a>`/`.cpub-btn` all render
  at 44px in both light and dark.
- One thing checked and cleared: the reference app's mobile topbar crowds its logo against the Log in
  button. That button is `.cpub-btn-new`, a different class that the new `min-height` rule does not
  match (measured 34px), so it is pre-existing and not a regression.

## Open

1. **Roll B, the action bar.** Spec is in the plan: one `ContestActionBar`, sticky above 768px / fixed
   bottom below, `env(safe-area-inset-bottom)` (first use in the monorepo), `body:has()` occlusion
   compensation, `z-index` below the mobile menu's 99, not mounted for draft/completed. Plus the two
   live bugs it should fix in passing: the `contestSignup`-off fallback labels a **full** registration
   "Follow this contest" (it emits `register` with no payload and the page defaults to `tier: 'full'`,
   bypassing required fields and recorded agreements), and the Entries-tab Submit button bypasses
   `onHeroSubmitEntry()` so it opens the wrong surface on stage-submission contests.
2. **The deveco fork's homepage still prints "N entries"** at `pages/index.vue:184,185,229,230`. It does
   not override the contest pages, so everything else here reaches deveco on a pin bump alone, but the
   homepage is forked and needs the same edit — **after** the layer publishes, since it will use the new
   util.
3. **Analytics.** Decision: GA4 done properly. Prerequisites in plan section 5, in order: fix deveco's
   `runtimeConfig.public` wiring, build the consent gate, make analytics a config block behind a flag,
   derive the CSP allowlist from the provider, Consent Mode v2 default-denied before gtag loads, and
   update `privacy.vue` / the cookie registry in the same commit.
4. **Which contest email** the operator saw, and what was wrong with it.
5. Roll A has not been published. Theme CSS changed, so this is a `@commonpub/ui` minor **and** a
   `@commonpub/layer` minor, both fork pins hand-edited (`^0.13.3` will not cross to `0.14.0`), four
   lockfiles, and `node layers/base/scripts/bundle-theme.mjs` before any local re-verification.

---

## Roll A published

`@commonpub/ui@0.14.0` and `@commonpub/layer@0.129.0` are on npm; the layer's
`workspace:*` was rewritten to an exact `ui@0.14.0`, so the theme fix reaches the
forks on the layer pin alone. Fork PRs opened rather than pushed to their mains,
so the production deploy stays a human decision: deveco #14 (pin + the forked
homepage's own count markup, which the pin cannot deliver), heatsync #25 (pin
only — verified by grep that it references none of the contest count fields, and
its `theme/heatsync.css` already sets its own `--color-on-accent` on the orange
accent, so the AA change is a no-op there). deveco typechecks clean against the
published layer.

## Soft email verification

The operator asked for the standard pattern: signed in immediately, nagged until
confirmed, and a record of who has confirmed. That also resolves a blocker that
had been open since session 237.

The reason it was stuck: the only switch was `auth.requireEmailVerification`,
which gates SIGN-IN, so turning it on locks out every existing unverified
account. The two better-auth options turn out to be independent —
`sign-up.mjs` reads `sendOnSignUp ?? requireEmailVerification`, so an explicit
`true` wins over the fallback — which makes the whole server change one condition
in `createAuth`. New `features.emailVerification`, default OFF (enabling it
starts sending mail from any instance with a transport, which an upgrade should
not do silently).

Verified against a running instance rather than reasoned about: signup returns
200 **with a session** and `emailVerified: false`; sign-in succeeds while
unverified; the banner renders with `role="status"`; clicking a real link flips
the column, clears the banner, and `/api/me` reports `emailVerified: true`.

**Security note.** Enabling this would have armed a mail-bomb relay. better-auth
ships `POST /api/auth/send-verification-email` with no session, taking an
arbitrary address in the body; it was inert only because verification was never
wired. And everything under `/api/auth` is dispatched with `sendWebResponse`,
which ends the response, so the CSRF and rate-limit middleware that run
alphabetically after `auth.ts` never execute for that prefix — better-auth's own
3/60s cap is per-process, per-IP, and off outside production. That route is now
404'd, and resend lives at `POST /api/user/resend-verification`: session-scoped,
address from the session and never the body, 3 per 15 min per user, silent
no-ops so it cannot be used as a config or account oracle. Verified live: the old
route 404s, and the fourth resend in a window returns 429.

The banner renders **in flow from the layouts**, not from the global-overlays
plugin. The audit recommended the plugin because it is the only mount point that
survives deveco's forked layout — but that path then needs a chrome-height token,
six offset edits, a `mount()` change to fix DOM-vs-visual focus order, print
rules and route-based self-suppression: ~15 edits to avoid 3. In flow costs three
mount points and gets all of that for free, plus no collision with the sticky
action bar. The trade: it scrolls away, and a fork with its own layout must
include it.

Also: `emailVerified` on the admin user list with a filter, and a count on the
admin dashboard. Labelled **"Email confirmed"** everywhere, never "Verified" —
`verified` is already a user ROLE two columns over and means an editorial tier.
The filter parses the literal `'true'`/`'false'`; `z.coerce.boolean()` maps the
string `'false'` to TRUE and would have inverted it.

## Roll B — the action bar

Split by viewport, because the two have different problems.

- **Desktop is one CSS rule**: stick the sidebar so the real registration card
  follows the reader. No bar at all, so no duplicate primary button. The first
  attempt did nothing — a sticky element taller than the viewport cannot pin its
  top (measured at `top: -198px` after a 1400px scroll); it is now capped to the
  viewport with internal overflow. Verified on a 9,473px contest: pins at 64px
  and stays on screen at every depth.
- **Mobile gets the bar**, and only mobile — so it never negotiates the topbar
  offset (deveco does not override that token, so it is 12px wrong there) and
  never collides with the verification banner. It measures itself and publishes
  its height; a hardcoded 60px under-reserved by 25px and left it sitting on the
  footer.

It degrades by state rather than rendering dead controls: results for a finished
contest, the judge's action while judging, Edit for an organizer (never "Submit
entry" on their own contest), nothing for a draft or an unaccepted judge invite.
Anonymous visitors get Follow, which did not exist for them anywhere before.

Two live bugs fixed alongside: the `contestSignup`-off fallback's "Follow" button
created a **full** registration (no payload → the page defaulted to `full`),
bypassing required fields and recorded agreements; and the Entries-tab Submit
bypassed the shared handler. Register routing is now one pure resolver — the page
and the card had disagreed, with no anonymous branch in the card and a
short-but-required form opening a modal from one button and a page from another.

The first class namespace collided with `CpubCriteriaBar`; the e2e caught it as a
strict-mode violation, which is what that assertion is for.

## Verification state at the end of the session

- `pnpm exec turbo run test --concurrency=50%` (what CI runs): **33/33**.
  `pnpm typecheck` 28/28. `pnpm lint` clean (warnings only, all pre-existing).
- `contest-lifecycle` E2E **9/9**, including a new 390px test for the bar.
- Layer tests 1599 → **1677**.
- Known flake, NOT caused by this work: under full-monorepo parallel load
  `two-instance-federation` and `mirror-request.integration` intermittently fail.
  Each builds TWO in-memory PGlite instances, making them the heaviest tests in
  the suite. `createTestDB()` is per-file PGlite, so cross-file data coupling with
  the new admin tests is mechanically impossible; the server package passes
  129/129 every time it runs alone.

## Still open

1. **Nothing here is published beyond Roll A.** The verification feature and the
   action bar need config/auth/server/test-utils/layer bumps and a second roll.
2. **deveco's banner mount is stashed** on its branch
   (`git stash list`, "apply after the layer with the component publishes") — it
   references a component that does not exist in 0.129.
3. **deveco should set `--cpub-topbar-height: 60px`** in its theme. Its bar is
   60px and it never overrides the 48px token, so any layer CSS keyed on it lands
   12px off. Not load-bearing for this work (the bar is mobile-only) but it is a
   standing lie.
4. `contestSignup`, `contestEntryRequiresRegistration`, `contestPrivateFiles` and
   `emailUnverified` are still absent from `layers/base/nuxt.config.ts`'s
   `features` block, so their `NUXT_PUBLIC_FEATURES_*` env overrides are silently
   dropped. Left alone deliberately: deveco hand-duplicates that block and a
   default could flip a live value.
5. Analytics (plan section 5) and the contest-email question are untouched.
