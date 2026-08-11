# Contest CTA, count integrity, analytics, and email verification

Status: proposed
Date: 2026-08-10
Baseline: layer 0.128.0 / server 2.127.0 / ui 0.13.3 / config 0.36.0, migration 0045, 39 flags, CI green on `6bda625b`
Origin: operator (Robert) report against `https://deveco.io/contests/qualcommforamoreresilientamerica`

This plan restates the operator's four asks against what the code and the live site actually do, then
specifies the work. Every claim below was verified by reading source or by fetching/driving the live
page, not inferred. Where the operator's diagnosis is wrong the plan says so and says what the real
defect is; where it is right it says that too, because on three of five points he is right and on one
he found a bug we had shipped and not noticed.

---

## 1. What is actually true today

Measured on the live page (curl of the SSR HTML + Playwright at 390x844 and 1440x900, 2026-08-10).

**The top-of-page register CTA already exists and is above the fold.** Session 250 added it.
`ContestHero.vue:286-302` renders it as the first interactive element in the content area, at y=590 on
a 390px viewport and y=680 on desktop. On deveco it computes to `#004e53` on `#ffffff` = **9.35:1**,
comfortably AA. The operator's stated diagnosis, "the buttons are only in the sidebar and the contrast
is low", is measurably false on the site he was looking at.

**But the page is 9,865px tall on mobile and 8,151px on desktop**, and a register affordance appears at
y=590 and then does not appear again for roughly 9,000px. The sidebar `Registration` card is the second
grid child, the grid collapses to one column at `max-width: 768px` (`index.vue:761-767`), nothing on the
page is `position: sticky`, and the card lands at ~92% of DOM depth. So for 89% of the mobile page and
76% of the desktop page there is **no call to action on screen at all**. That is the real defect, and it
is a persistence problem, not a placement or contrast problem.

**Follow is worse off than he thinks.** The only follow control is `ContestSignup.vue:209-217`:
secondary weight, `--text-dim`, inside the sidebar card, and **authenticated-only**. Every anonymous
branch on the page renders exactly one thing, "Log in to register". An anonymous visitor is never
offered the low-friction action at all.

**The zeros are real, and there are three distinct causes.**

| Symptom | Cause | Where |
|---|---|---|
| `0 makers registered` in the SSR HTML, next to `10 following` in the hero | `registrantCount` is `ref(0)` fed by a `useLazyFetch(..., { server: false })`; SSR and first paint always render 0 | `index.vue:25,302-303`; `ContestSignup.vue:179-181` |
| `00h 00m left` on the contest tile | `CountdownTimer` seeds `timeLeft` to all zeros and only calls `update()` in `onMounted` | `CountdownTimer.vue:7,26` |
| `0 entries` / `1 entries` | `entryCount` is ungated at all 9 render sites and unpluralized at 2 of them | `contests/index.vue:89`, `ContestEntries.vue:95`, +7 |

The countdown one is the interesting find: it is a member of exactly the SSR/hydration class session 252
spent a day on, it is what a crawler sees, and nobody had noticed it. He spotted it from the outside.

**The page states three mutually inconsistent numbers for the same contest.** Hero: "1 entry, 10
following". Tabs: "Entries 1, Participants 1". Sidebar: "7 makers registered, 10 following". The
underlying semantics (`packages/server/src/contest/registrations.ts:460-482`) are that `full` is a
**subset** of `followers`, not a disjoint group, so "registered" and "following" overlap by
construction and on a contest with no reminders-only signups they are the same number printed twice
under two labels. Consolidating is a correctness fix.

**`entryCount` is not what any of these labels claim.** It counts entry *rows* including draft
placeholders created at registration time in `combined` mode
(`packages/server/src/contest/submissions.ts:497-500,549`), so it is already larger than the entries a
visitor can see in the grid.

**`.cpub-btn-primary` fails WCAG AA in the base layer**: `#ffffff` on `--accent: #5b9cf6` = **2.79:1**,
below even the 3:1 large-text floor, defined twice with conflicting label tokens
(`components.css:27-37` vs `layouts.css:383-392`, the latter wins). Both forks override it and pass, so
this is a commonpub.io / apps/reference bug, not a deveco bug. It still ships to every new instance.

**No account-verification email is sent on any instance.** `createAuth.ts:73` wires Better Auth's
`emailVerification` block only when `auth.requireEmailVerification === true`; it defaults false
(`config/src/schema.ts:170`) and deveco deliberately leaves it off with a comment saying enabling it
would lock out every existing unverified user (`../deveco-io/commonpub.config.ts:40-42`). There is no
resend endpoint, no resend UI, no admin mark-verified action, and auth mail bypasses `email_outbox`, so
there is no record anywhere of whether anything was ever sent.

**The cookie banner cannot render on deveco.** It shows only when the instance declares a non-essential
cookie via `runtimeConfig.public.instanceCookies` (`useCookieConsent.ts:94-96`), and
`../deveco-io/nuxt.config.ts` never wires anything from its `commonpub.config.ts` into
`runtimeConfig.public`. Separately, `allowsAnalytics` has **zero consumers** in the layer or either
fork, and `pages/privacy.vue:90` states "We do not use any analytics services, advertising networks, or
tracking technologies" on a page that is in the layer and is not instance-conditional.

**Production CSP is `script-src 'self' 'unsafe-inline'; connect-src 'self'`**
(`layers/base/server/middleware/security.ts:92,99`). It hard-blocks both `gtag/js` and the collect
beacon. Note `security.ts:96` *replaces* `connect-src` in dev, so a naive edit drops the HMR sockets.

---

## 2. Verdict on the proposal

| Proposed | Ruling | Why |
|---|---|---|
| Bottom drawers for Status + Registration | **Reject** | Self-refuted in the same paragraph ("users should not have to open a drawer to see Register/Follow"). A drawer is a container *for* the action; it re-adds the tap and the discovery step that are the reported defect. Status is reference info, not a thumb-reach action. |
| Side drawer, ~2/3 width, swipe to retract | **Reject** | Zero gesture code exists in the monorepo. WCAG 2.1 SC 2.5.1 requires a single-pointer alternative for any path-based gesture, so the X is mandatory and the swipe is pure cost. It also duplicates `.cpub-mobile-menu` at a conflicting stacking level. |
| First-time pulse animation | **Reject** | `base.css:432-440` globally clamps `animation-duration` to `0.01ms` under `prefers-reduced-motion`, so it is a guaranteed no-op for the cohort most likely to need help. If a CTA needs motion to be found, the layout is wrong. |
| `REGISTER \| FOLLOW \| SUBMIT` at the top, short copy | **Keep, with hierarchy** | Right pattern. But Register and Submit are mutually exclusive states (`ContestHero.vue:222` vs `:223-228`), so three co-equal buttons means at least one is always dead or lying. Ship one filled primary + one outlined secondary + one ghost Share. |
| Same row on desktop, leftmost aligned with the copy | **Keep** | Already aligned; `.cpub-hero-bar-inner` establishes that gridline for the `<h1>`. Free. |
| Put it where the admin stage bar is | **Reject, premise wrong** | The stage controls are *inside* the hero, directly below the CTA row (`ContestHero.vue:306-315`). There is no empty band for non-admins, and the stacked-bar awkwardness he wanted to avoid is what adding a second bar would create. |
| Logged-out clicks go to signup | **Keep the instinct, fix the mechanism** | Today every anonymous CTA goes to `/auth/login?redirect=/contests/:slug` and returns the user to an unregistered page with the intent discarded. Also live: `login.vue:286` and `register.vue:173` cross-link to each other **without carrying `?redirect`**, so a visitor who switches between them loses the intent entirely. |
| "Notably stand out" colour | **Keep, different reason** | Real AA violation in the base layer (2.79:1). Not the deveco problem, where the issue is rank: the primary button is 160x38px at 13px while a single tab 116px below it is 151x58px in bold uppercase mono. |
| Hide zeros / merge the numbers "to look like it's doing better" | **Split** | Suppressing an *unloaded* count and pluralizing correctly are bug fixes. Merging registered+following is legitimate because they overlap by construction. Blanket zero-hiding so a contest reads busier is not: "0 entries with 3 days left" is material information to someone deciding whether to enter, and this ships to every instance including community contests where the honest zero is the point. |
| GA4 snippet | **Keep the snippet, reject the placement** | His snippet is technically correct, including `send_page_view: false` with manual per-route pageviews, which is the right call for an SPA. It must not be hardcoded into a shared layer for one operator's tag. |

---

## 3. The design

**One pattern solves mobile and desktop: a persistent contest action bar.** This is what Eventbrite,
Kickstarter, Luma, Devpost and every product detail page converge on for a long page with a single
primary conversion. No drawer, no gesture, no animation, no scroll listener.

One component, `layers/base/components/contest/ContestActionBar.vue`, mounted **once** by
`pages/contests/[slug]/index.vue` between `<ContestHero>` and the tab band. One DOM node, therefore one
tab stop group and one accessible name. Only `position` flips across the breakpoint.

```css
.cpub-contest-actions {                    /* >768px: sticks under the topbar */
  position: sticky;
  top: var(--cpub-topbar-height, 48px);
  z-index: 90;                             /* below mobile menu 99 and topbar 100 */
}
@media (max-width: 768px) {                /* <=768px: thumb-reach bottom bar */
  .cpub-contest-actions {
    position: fixed; inset: auto 0 0 0; top: auto;
    border-top: var(--border-width-default) solid var(--border);
    box-shadow: 0 -2px 0 var(--border);    /* mirrors CookieConsent.vue:30 */
  }
  .cpub-cab-inner { padding: 8px 12px calc(8px + env(safe-area-inset-bottom)) 12px; }
}
```

390x844, anonymous, active contest:

```
 y=0   ┌──────────────────────────────────────┐
       │ ☰  devEco                     ⌕   ⬤ │  48  fixed topbar, z 100
       ├──────────────────────────────────────┤
       │ ░░░░░░░  banner 4/1  ░░░░░░░░░░░░░░ │  ~97
       │ ▪CONTEST ▪ACTIVE ▪PROPOSALS          │
       │ ⏱ SUBMISSIONS CLOSE IN 26d 12h       │
       │ The Resilient America Preparedness   │  h1
       │ Challenge                            │
       │ The Resilient America Preparedness…  │  tagline, 5-line clamp
       │ SHOW MORE                            │
       │ 📅 Aug 3 to Dec 18   👥 7 registered │  meta, zero-gated
       ├──────────────────────────────────────┤
       │ OVERVIEW │ RULES │ PRIZES │ ENTRIE▸  │  tabs (+ overflow fade)
       │                                      │
       │            ⋮ 9,000px ⋮               │
       │  body reserves 60px + safe area so   │
       │  nothing is permanently occluded     │
       ├──────────────────────────────────────┤  y = 844 - 60 - safe-area
       │ ┏━━━━━━━━━━━━━┓ ┌──────────┐ ┌────┐ │  .cpub-contest-actions
       │ ┃  Register   ┃ │ 🔔 Follow│ │ ⤴  │ │  z 90
       │ ┗━━━━━━━━━━━━━┛ └──────────┘ └────┘ │
       └──────────────────────────────────────┘
```

Occlusion is compensated with one global rule, no JS:

```css
@media (max-width: 768px) {
  body:has(.cpub-contest-actions) { padding-bottom: calc(60px + env(safe-area-inset-bottom)); }
}
```

`env(safe-area-inset-bottom)` is the first use in the monorepo; it is required or the bar sits under the
iOS home indicator.

### State matrix

One filled primary at all times, never two. `canRegister` is `upcoming|active` only.

| Viewer | upcoming / active | judging | completed / cancelled |
|---|---|---|---|
| Anonymous | **Register** (primary) · Follow · Share | Share only | **View Results** · Share |
| Authed, unregistered | **Register** · Follow · Share | Share | View Results · Share |
| Follower (`reminders`) | **Register** · Following (pressed) · Share | Following · Share | View Results · Share |
| Full registrant | **Submit Entry** · Registered (status, not a button) · Share | Registered · Share | View Results · Share |
| Organizer / admin | **Submit Entry** suppressed; Edit Contest · Share (stage controls stay in the hero, unchanged) | Edit · Share | Edit · View Results |
| Judge (accepted, judging) | n/a | **Judge Entries** · Share | View Results |
| Judge with pending invite | bar suppressed; the invite banner is their only action | same | same |

The bar does not mount for `draft`. For `completed`/`cancelled` it degrades to results + share rather
than rendering dead buttons, which matters because completed is the permanent state of every contest
and the one that keeps accruing traffic.

### The hydration rule for this component

`registrationTier` comes from a deliberate `server: false` fetch, because per-viewer state must not be
baked into cacheable HTML. So the CTA set is unknown through SSR and first hydration. Making that row
big, sticky and the loudest thing on the page turns today's invisible flip into a visible one.

**Rule: render the anonymous/unregistered state during SSR (it is correct for the majority visitor),
reserve the bar's height so nothing shifts, and swap in place on load.** Do not SSR per-viewer state.
Do not render a wrong state first. This is the trap session 252 fixed a whole class of; it is easy to
walk back into here.

### Anonymous intent

- Register, anonymous, goes to `/auth/login?redirect=/contests/:slug/register`. That route already has
  `middleware: 'auth'` and round-trips `to.fullPath`, so login lands the user **in the registration
  form**, not back on an unregistered page.
- Follow, anonymous, goes to `/auth/login?redirect=/contests/:slug?follow=1`, handled on mount in ~8
  lines.
- Thread `?redirect` across the `login.vue:286` / `register.vue:173` cross-links. Both pages already
  honour the param; neither passes it. This is a live bug and it is the cheapest conversion fix on the
  whole list.

### Consolidate register routing

`startRegistration()` (`index.vue:353-376`) branches on `templateHasRequiredField` alone;
`onRegisterCta()` (`ContestSignup.vue:140-144`) branches on `templateHasRequiredField` **and**
`isRichRegistrationForm`. A short-but-required form therefore opens a modal from the sidebar and
navigates to the full page from the hero. Extract one pure `contestCtaState()` + `registrationRoute()`
into `layers/base/utils/contestCta.ts` and have all three surfaces call it, or the new bar becomes a
fourth divergent path.

### Two live bugs to fix in the same pass

- `ContestSidebar.vue:197-209` (the `contestSignup`-off fallback) renders a button labelled "Follow this
  contest" that emits `register` with **no payload**, and `index.vue:322` defaults
  `tier = payload?.tier ?? 'full'`. Clicking Follow therefore creates a **full registration**, bypassing
  required fields and recorded agreements, then reports "You're following this contest". Delete that
  fallback branch as part of the consolidation.
- `index.vue:595-597` the Entries-tab Submit button sets `showSubmitDialog = true` directly instead of
  calling `onHeroSubmitEntry()`, so on a stage-submission contest it opens the wrong surface.

### Flag

`features.contestActionBar`, default `true`. Rule #2 aside, there is a real reason: the bar permanently
occupies 60px of a mobile viewport, and an operator running a small community contest may legitimately
not want it. 39 -> 40 flags. Six files per the established chain, and the `ENV_FLAG_MAP` entry must land
**before** running tests or the parity test fails the build.

---

## 4. Count integrity

Principle: **suppress a count that has not loaded, pluralize correctly, show each number once, and never
relabel a number as something it does not measure.** Do not suppress a genuinely-zero primary count.

**Decision (2026-08-10): one public number, `followerCount`, labelled "registered".** Every row in
`contest_registrations` is a registration; `tier` records whether that person registered to enter
(`full`) or only for reminders. So "N registered" over all rows is accurate, and the `full`/`reminders`
split is organizer information, which the owner-only `ContestRegistrantsPanel` already surfaces.

This is strictly simpler than splitting the tier out, and it lands three fixes for free:

- `followerCount` is **already on the SSR'd `ContestDetail` and on `ContestListItem`**, so binding to it
  eliminates the `0 makers registered` SSR lie **with no server change at all**. No new DTO field, no
  tier split in `listContests`, no extra query.
- It collapses the hero's "10 following" / sidebar's "7 makers registered" contradiction into one
  number that agrees with itself everywhere.
- It is already zero-gated at all 8 of its render sites, so the gating work is done.

1. **Tile: `N registered`, not `N entries`**, bound to `followerCount`, zero-gated. This is the
   operator's ask and it is right for a reason he did not give: `entryCount` counts draft placeholder
   rows, so it is the wrong number, and for an open contest registrations are the meaningful momentum
   signal anyway. For `completed` contests show `N entries`, where it is finally meaningful.
2. **`ContestSignup` reads `contest.followerCount` from the DTO**, not the client-only `registrantCount`
   ref. The client fetch stays, but only to drive the viewer's own tier. Delete the `registrantCount`
   display path and the `> registrantCount` secondary-following line with it.
3. **Detail page: one number per fact.** Hero shows `N registered` plus `M entries` when `M > 0`. Delete
   the duplicate `Entries:` / `Following:` rows from the Status card. Three simultaneous renderings of
   the same people is the actual incoherence.
4. **Fix `CountdownTimer` SSR zeros.** Gate on `mounted` exactly as `ContestHero.vue:46,149` already
   does, and keep a `<time datetime>` in the SSR output so crawlers and no-JS get the real deadline
   instead of `00h 00m`. Two call sites (`contests/index.vue:86`, `pages/index.vue:259`).
5. **Pluralize** `ContestEntries.vue:95` and `contests/index.vue:89`.
6. **Entries tab badge** suppresses zero the way the Judges tab in the same computed already does
   (`index.vue:452`).
7. **Mirror the homepage changes into `../deveco-io/pages/index.vue`** (lines 184, 185, 229, 230). deveco
   forks the homepage; a layer fix does not reach it. It does **not** fork the contest pages, so
   everything else lands on a pin bump alone.

Refused: blanket zero-hiding across hubs/profiles/content cards to match. There is no house convention
to hide zeros (`StatBar.vue:8-12`, `ContentCard.formatCount` literally `if (!n) return '0'`), and
changing it globally to make one contest look busier is a vanity metric shipping to every instance.

---

## 5. Analytics: do not ship the snippet as written

The snippet itself is fine and the `send_page_view: false` plus manual per-route pageview approach is
correct for Nuxt. What is not fine is pasting one operator's measurement ID into a shared, self-hostable
layer, and turning on a third-party tracker on an instance whose own privacy policy currently says it
does not use one and whose consent banner is structurally incapable of appearing.

Prerequisites, in order. None of them are optional and none are large.

1. **Fix deveco's `runtimeConfig.public` wiring.** It never copies anything from its
   `commonpub.config.ts`. Until it does, the consent banner cannot render and no new config key reaches
   the client. This is a deveco-side bug that also blocks the `instanceCookies` feature that already
   shipped.
2. **Build the consent gate.** `allowsAnalytics` exists and has zero consumers. Decide binary
   (accept-all grants analytics) versus granular per category. Recommendation: stay binary for now,
   because going granular means migrating `cpub-consent` values already in browsers with a 1-year
   maxAge, and the added value is small with one analytics provider.
3. **Make analytics a config block, not a constant.** `analytics: { provider, measurementId, ... }` in
   `@commonpub/config` (types + Zod + factory), declared in `layers/base/nuxt.config.ts`
   `runtimeConfig.public` with a safe empty default so `NUXT_PUBLIC_*` override works, behind a
   `features.analytics` flag, read by one `layers/base/plugins/analytics.client.ts` that no-ops when
   unset.
4. **Derive the CSP allowlist from the configured provider.** A small provider registry maps
   `ga4 -> { script: ['https://www.googletagmanager.com'], connect: ['https://*.google-analytics.com', ...] }`.
   Editing a layer-owned, all-instances CSP by hand for one operator's vendor is the wrong shape. Watch
   `security.ts:96`, which currently *replaces* `connect-src` in dev; union it or HMR breaks.
5. **Consent Mode v2 ordering**, which is not optional and is easy to get wrong: create `dataLayer` and
   the `gtag` shim, then `gtag('consent','default',{...'denied', wait_for_update:500})`, **then** load
   `gtag/js`, then `gtag('js')` / `gtag('config', id, { send_page_view: false })`, then
   `gtag('consent','update',...)` when consent is given. The default block must execute before the
   library evaluates. Today's `'unsafe-inline'` CSP permits it; the deferred nonce-CSP work will not, so
   note the coupling.
6. **Update the legal surfaces in the same commit.** `privacy.vue:90` and `:72` become false the moment
   GA loads and are not instance-conditional; make them analytics-aware the way they are already
   federation-aware. Declare `_ga` and `_ga_<id>` in deveco's config so they appear in `/cookies` and so
   the banner can finally render. Bump "Last updated".

**Cheaper alternative worth putting on the table first.** A first-party route pageview counter following
the existing `metrics_daily` aggregate pattern needs no banner, no CSP change, no privacy rewrite and no
third-party processor, and it answers "which pages get traffic". It does not answer attribution or
funnels. The honest framing: nobody can currently state the contest page's conversion rate, which is
both the only real argument for GA4 and the reason the cheap counter may be enough.

---

## 6. Email

**Decision (2026-08-10): the operator was looking at a contest email, not an account-verification
email.** That matches the evidence: no account-verification mail can be sent on any instance, and the
contest emails are exactly what sessions 249 and 250 were repairing.

**This item is therefore not yet actionable and no code should be written for it.** What is needed is
the actual message: which contest email (registration confirmation, deadline reminder, stage
advancement, organizer broadcast), sent to whom, and what was wrong with it. Auth mail bypasses
`email_outbox` but contest mail does not, so once the message is identified there is a durable row to
inspect. Note there is no email preview surface beyond `POST /api/admin/email-preview`, so reproducing a
rendering complaint means either that route or sending a real message.

### Account verification, for the record

Not the reported problem, but worth recording since the audit established it and it is a live ship
hazard. Nothing is broken; nothing is sent. If it is ever turned on, the order matters and getting it
wrong takes signup down:

1. **Make the send failure-tolerant first.** With the flag on, Better Auth awaits
   `sendVerificationEmail` during sign-up; `auth.ts:41-50` calls the adapter with no try/catch and
   `adapters.ts:104-107` throws on any non-2xx. The user row is created before the send, so a Resend
   hiccup, an unverified sending domain or a rate limit yields an orphaned account and a **500 at
   signup**. Catch, log, and either swallow or route through the outbox.
2. **Add a resend endpoint and UI.** Absent today; `POST /api/auth/send-verification-email` 400s while
   the flag is off. Named as the standing blocker across sessions 237-240.
3. **Add an admin mark-verified / backfill action.** Without it, flipping the flag locks out every
   existing deveco account. This is why it was reverted before push in session 237.
4. **Verify the Resend sending domain** (SPF/DKIM/DMARC for `noreply@deveco.io`). Nothing in any repo
   proves it is done; three session logs list it as an unconfirmed prerequisite.
5. **Then** flip `auth.requireEmailVerification`, remembering it lives in two places that must agree:
   `commonpub.config.ts` for behaviour and the `public.requireEmailVerification` runtimeConfig mirror
   for the register page copy. deveco sets neither.

Also worth doing regardless: the token is a 1-hour JWT and the copy never says so, unlike the
password-reset template which does. Add the expiry sentence and a resend link to the template.

If instead the ask is "the email looked wrong", that is the deferred themed-email redesign, it shares
almost no code with the above, and there is no preview surface to reproduce it without sending real mail.

---

## 7. Sequencing

Three rolls. Each is independently shippable and independently valuable.

**Roll A, correctness. No flag, no design input, no layout risk.**

1. `min-height: 44px` + explicit `line-height` on `.cpub-btn` (`layouts.css:357-372`). Fixes the WCAG
   2.5.5 touch-target failure and the ~44px `<a>` vs ~37px `<button>` height mismatch visible in the
   hero row today. Touches every button, so verify with a screenshot pass.
2. Fix base `.cpub-btn-primary` to AA and de-duplicate the two conflicting definitions. Lock it with a
   test: `packages/theme-studio/src/color.ts:158-211` already exports `contrast()` and `wcag()`, and
   `packages/ui/src/__tests__/tokens.test.ts` already reads theme CSS from disk. Assert the CTA pair
   clears 4.5:1 in base, dark, agora and stoa. Does not affect deveco, which already passes.
3. Anonymous intent: retarget the anonymous CTAs at `/contests/:slug/register` and carry `?redirect`
   across the login/register cross-links.
4. Count integrity items 1, 2, 5, 6, 7 plus the deveco homepage mirror.

**Roll B, the action bar.** Sections 3 and 4 items 3 and 4. New flag, new component, one pure util,
routing consolidation, the two live bugs.

**Roll C, decoupled.** Analytics prerequisites 1-6, then GA4 or the first-party counter. Email
verification 1-5. Neither should ride the CTA batch.

### Release chain (per roll)

Contest pages are not forked by deveco, so contest-only changes reach deveco.io on a pin bump alone.
Theme changes are the expensive ones.

```
# if packages/ui/theme/*.css changed:
node layers/base/scripts/bundle-theme.mjs        # dev server reads the bundled copy, not your edit
# bump versions (ui 0.13.3 -> 0.14.0 AND layer 0.128.0 -> 0.129.0 for a theme change)
git diff --stat main...HEAD -- packages/         # verify scope; the glob has false-negatived before
pnpm build && pnpm test && pnpm typecheck && pnpm lint
pnpm publish:all                                 # never `npm publish` from layers/base
pnpm publish:layer
# hand-edit BOTH fork pins: ^0.13.3 will NOT cross to 0.14.0 on a 0.x caret
# regenerate 4 lockfiles (deveco package-lock is gitignored; heatsync pnpm-lock is tracked)
# push both forks, then curl /api/health and the changed surface on each instance
```

Traps that have bitten this repo before and apply here: a new theme class forces the `ui` bump and both
fork pin edits; any base `.cpub-btn-primary` change is invisible on deveco, which redefines it outside
`@layer`; and anything mounted from `layouts/default.vue` is silently dropped by deveco's forked layout,
so mount the bar from the page.

---

## 8. Testing

- **Component**, `layers/base/components/contest/__tests__/ContestActionBar.test.ts`, modelled on
  `ContestHero.registerCta.test.ts`: every cell of the state matrix in section 3 (auth x tier x status),
  flag on and off, in-flight disabled state, the `registrationLoaded` gate proving no wrong state renders
  first, plus an explicit `axe.run(container)`.
- **Unit**, `layers/base/utils/__tests__/contestCta.test.ts`: the pure `contestCtaState()` and
  `registrationRoute()` separately from any render.
- **Theme regression**, in `packages/ui/src/__tests__/tokens.test.ts`: the CTA foreground/background pair
  clears 4.5:1 in all four built-in themes. This is the assertion whose absence let 2.79:1 ship.
- **E2E**, appended to `apps/reference/e2e/contest-lifecycle.spec.ts` rather than a new spec (CI runs one
  worker). Three existing assertions will need updating, not deleting: `heroCtas()` at `:66-75` selects
  `.cpub-hero-cta a, .cpub-hero-cta button` and is asserted at `:165, :212, :245-246, :252`;
  `.cpub-entries-cta` text at `:258-259`; and `:403-409` asserts
  `document.documentElement.scrollWidth <= 390`, which a `100vw` fixed bar will fail. Add: the bar is
  visible at 390px after scrolling to the page foot, the body reserves its height, and it does not
  overlap the cookie banner.
- **Manual**, per the standing rule that green tests miss broken CSS: 390px and 1440px screenshots of
  every persona state, iOS safe-area check, and a `TZ=UTC` server against Tokyo and Los Angeles browser
  contexts for the `CountdownTimer` fix (a hydration fix verified in one zone can still fail in the
  other).

---

## 9. Decisions and open questions

Resolved 2026-08-10:

1. **The email item is a contest email**, not account verification. Blocked pending the actual message.
2. **GA4, done properly** (section 5), with the tag in deveco's own config and never in the shared layer.
3. **The tile's "registered" is `followerCount`**, every registration row. Simpler, honest, and it fixes
   the SSR-zero with no server change.
4. **Roll A first**, reviewed before Roll B.

Still open:

- **Binary or granular consent?** Recommendation: binary. Granular means migrating `cpub-consent` values
  already in browsers on a 1-year maxAge, for little gain with one provider.
- **Which contest email is at issue**, and what was wrong with it.
- **Does Roll B's action bar need the flag?** The plan says yes on occlusion grounds. Reasonable people
  could call it a re-placement of existing CTAs rather than a feature and skip flag number 40.
