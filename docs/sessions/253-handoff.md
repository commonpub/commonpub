# Session 253 — Handoff (state, what shipped, what's open)

One operator report ("the CTAs are invisible, there are 0s everywhere, add analytics, fix the
verification email") turned into three pieces of work, all now **published across two rolls**, with an
adversarial audit between them that caught a refactor I had written, tested, documented and never
actually wired up.

Detail: `docs/sessions/253-cta-audit-and-count-integrity.md`. Plan and the reasoning behind the
rejected proposals: `docs/plans/contest-cta-metrics-and-analytics.md`.

## Where things stand (verified 2026-08-11)

All three instances **healthy** (`/api/health` ok), migration **0045**, **41 flags** (39 → 41: added
`emailVerification`, `contestActionBar`). **Everything in this session is now published.**

| Package | Live on npm | Package | Live on npm |
|---|---|---|---|
| `@commonpub/layer` | **0.131.2** | `@commonpub/ui` | **0.14.2** |
| `@commonpub/server` | **2.129.0** | `@commonpub/config` | **0.38.0** |
| `@commonpub/auth` | **0.12.0** | `@commonpub/test-utils` | **0.5.16** |
| `@commonpub/infra` | **0.20.0** | `@commonpub/schema` | 0.63.0 (unchanged) |

Three rolls: `layer@0.129.0` (Roll A), `layer@0.130.0` after a pre-publish audit, and
`layer@0.131.0` with analytics. The layer pins every sibling exactly, so a fork gets the whole set
from the layer pin alone.

- Branch **`session-253-roll-a`**, PR [commonpub#73](https://github.com/commonpub/commonpub/pull/73).
  Fork PRs open, **not merged**: deveco#14, heatsync#25. **Merging a fork PR deploys that instance** —
  that is the only remaining step to put any of this in front of users.
- `pnpm exec turbo run test --concurrency=50%` (what CI runs) **33/33**; `pnpm typecheck` 28/28; lint
  clean (warnings only, all pre-existing). `contest-lifecycle` E2E **9/9**. Layer tests 1599 → **1680**.
- No migration. 0 AI attribution on every commit (rule #15).

## What shipped, and why it is not what was asked for

The operator's diagnosis was wrong on the headline and right on the symptoms. Worth reading once,
because the same shape will recur:

- **"The CTAs are only in the sidebar and the contrast is low."** False on the site he was looking at.
  The hero CTA has existed since session 250, sits above the fold, and computes to **9.35:1** on deveco.
- **The real defect was persistence.** The contest page is **9,865px** tall at 390px, the sidebar
  registration card is the last grid child at ~92% of DOM depth, and nothing was sticky. A CTA appeared
  once at y=590 and then not again for ~9,000px — nothing to press on 89% of the mobile page.
- **He was right about the zeros**, and found one nobody had: `CountdownTimer` server-rendered
  `00h 00m left` on every contest tile. That is what crawlers indexed.
- **His prescription (swipe drawers + a first-run pulse animation) was rejected** on WCAG grounds and
  because a drawer re-adds the tap and the discovery step that were the complaint. He refuted it himself
  in the same paragraph: "users should not have to open a drawer to see Register".

### Published (roll A): `ui@0.14.0` + `layer@0.129.0`

- **`.cpub-btn-primary` failed WCAG AA in six of seven built-in themes**, not the two a manual pass
  found. Fixed by moving the label token, never `--accent` (the design system locks the blue, and the
  accent drives chips, links, borders, timeline dots). New contrast test in `theme-studio` locks all
  7 themes × 4 label aliases; its alias-agreement assertion caught a drift the grep had missed.
- `.cpub-btn` gained `min-height: 44px` — a `<button>` rendered ~37px next to an `<a>` at ~44px in the
  same row.
- Three separate causes of "the 0s" fixed. One public contest count, `followerCount`, labelled
  "registered", which is **already on the SSR'd DTO** — so the `0 makers registered` lie was fixed with
  no server change at all.
- Anonymous CTAs now land the visitor **in** the registration form after login, and login/register
  cross-links carry `?redirect` (both honoured it; neither passed it).

### Roll 2: soft email verification

Signed in immediately, nagged until confirmed, never locked out. This also clears a task open since
session 237 — the blocker was that the only switch (`auth.requireEmailVerification`) gates **sign-in**,
so enabling it would have locked out every existing unverified account. better-auth's `sendOnSignUp`
and `requireEmailVerification` turn out to be independent, so the server change is one condition.

`features.emailVerification`, **default OFF** — enabling it starts sending mail from any instance with
a transport configured, which an upgrade must not do silently. It is runtime-flippable from the admin
Feature Flags page (the audit caught that it was not, originally) and no-ops loudly on an instance with
no real transport.

> **Security, do not skip.** Enabling verification would have armed a mail-bomb relay. better-auth ships
> `POST /api/auth/send-verification-email` with **no session**, taking an arbitrary address in the body;
> it was inert only because verification was never wired. And everything under `/api/auth` is dispatched
> with `sendWebResponse`, which ends the response — so **the CSRF and rate-limit middleware that run
> alphabetically after `auth.ts` never execute for that prefix**, and better-auth's own 3/60s cap is
> per-process, per-IP, and disabled outside production. That route is now 404'd; resend lives at
> `POST /api/user/resend-verification`, session-scoped, 3 per 15 min per user, silent no-ops so it is
> not a config or account oracle.

Verified against a running instance, not reasoned about: signup returns 200 **with a session** and
`emailVerified: false`; sign-in succeeds unverified; the old relay route 404s; the 4th resend 429s; a
real link clears the banner and flips `/api/me`.

Also: `emailVerified` as a filterable admin column plus a dashboard count. Labelled **"Email
confirmed"** everywhere — `verified` is already a user ROLE two columns over meaning an editorial tier.

### Roll 2: the contest action bar

Split by viewport, because the two have different problems:

- **Desktop is one CSS rule** — stick the sidebar so the *real* registration card follows the reader. No
  bar, so no duplicate primary button.
- **Mobile-only fixed bar**, so it never negotiates the topbar offset or collides with the verification
  banner.

Two live bugs fixed alongside: the `contestSignup`-off fallback's "Follow" button created a **full**
registration (bypassing required fields and recorded agreements), and the Entries-tab Submit bypassed
the shared handler. Register routing collapsed onto one pure resolver — the page and the card had
disagreed, with no anonymous branch in the card at all.

## The pre-publish audit

Before roll 2 went out, a 38-agent adversarial audit of the branch returned **26 confirmed findings**
(7 refuted). All 26 are fixed in `bf17efc9`. The ones worth remembering:

- **`resolveRegistrationAction` was dead code** — written, documented as "the single decision for every
  Register control", ten passing tests, **zero callers**. Four reviewers found it independently. Every
  divergence its docblock claimed to fix was still live, and the new action bar had become a third
  disagreeing implementation. Now wired at all three sites.
- **A runtime flag that wasn't.** The auth instance is memoized per process, so gating
  `emailVerification` at construction froze it at boot: flipping it from the admin page did nothing
  while the UI still said "verification email sent". Policy moved into the sender closure.
- **A console sink is not delivery.** `useEmailAdapter` falls back to logging, so createAuth's "requires
  a real sender" guard was unreachable for every layer app. New `isEmailDeliverable()`; the resend route
  now answers 503 rather than claiming success.
- **The mobile sidebar reset dropped only `position`**, so the desktop sticky treatment survived into
  mobile and trapped the whole sidebar in a nested scroller — at exactly the viewport being fixed.
- **The AA fix had not reached far enough**: `--color-text-inverse` was hardcoded on accent fills in 23
  files, the token *registry* still defaulted to `#ffffff` so Theme Studio's reset would restore the
  failure, and the parity test only covered an allowlist so it could not have caught either. The test
  now checks every registered token base.css declares.

Lesson worth carrying: the audit's highest-value find was not a subtle bug, it was **a refactor that was
never wired up**. Tests passed because they tested the function directly.

## Open — ranked

1. **Merge the three PRs.** Nothing is in front of users until then. commonpub#73 deploys
   commonpub.io; deveco#14 and heatsync#25 deploy the forks (both are warn-only on health, so
   curl `/api/health` and a real route after each).
2. **Turn on `features.emailVerification` on deveco when ready.** It is published but OFF. deveco has a
   real Resend transport, so it will work; the flag is now runtime-flippable from the admin Feature
   Flags page without a redeploy.
3. **Analytics: shipped.** See the section below. All three prerequisites are resolved.
4. **The contest-email question is unanswered.** The operator confirmed he meant a *contest* email, not
   account verification. Which one, and what was wrong with it, is still unknown — contest mail does go
   through `email_outbox`, so there is a durable row to inspect once it is identified.
5. `contestSignup`, `contestEntryRequiresRegistration`, `contestPrivateFiles` and `emailUnverified` are
   still missing from `layers/base/nuxt.config.ts`'s `features` block, so their `NUXT_PUBLIC_FEATURES_*`
   env overrides are silently dropped. Left alone deliberately — deveco hand-duplicates that block and a
   default could flip a live value — but it is a known trap with five victims.
6. Still deferred from 249/250: themed-email redesign, nonce CSP, legacy-URL scrub migration 0046,
   `create-commonpub` pins (~22 minors stale, now 24).

## Notes for whoever picks this up

- **A hydration warning is a symptom, not the bug.** The `0 makers registered` lie existed because a
  previous session silenced a hydration warning by seeding a client-only count to `ref(0)`, making both
  sides agree on a *wrong* value. Grep for `ref(0)` near `server: false`.
- **Measure, do not assume, when a layout misbehaves.** Two things in Roll B were wrong on the first
  attempt and only a browser said so: a sticky element taller than the viewport cannot pin its top (it
  sat at `top: -198px`), and a hardcoded 60px bar reservation under-shot the real 86px and left the bar
  covering the footer. Both fixed by measuring.
- **Pick a CSS namespace by grepping for it first.** The action bar's first namespace (`cpub-cbar`)
  collided with `CpubCriteriaBar`, whose root is also `role="group"`; the e2e caught it as a strict-mode
  violation.
- **Known flake, not from this work.** Under full-monorepo parallel load, `two-instance-federation` and
  `mirror-request.integration` intermittently fail. Each builds **two** in-memory PGlite instances,
  making them the heaviest tests in the suite. `createTestDB()` is per-file PGlite, so cross-file data
  coupling is mechanically impossible, and the server package passes 129/129 every time it runs alone.
- **The forks override real pages.** deveco forks `layouts/default.vue` and `pages/index.vue`; the
  contest pages are *not* forked, so contest work reaches it on a pin bump alone. Anything touching the
  topbar, footer, homepage or default layout must be mirrored by hand.


---

## Analytics (added after the audit, `layer@0.131.0`)

deveco.io asked for Google Analytics. In a shared, self-hostable layer that means never hardcoding one
operator's tag, and never letting the code and the privacy page drift apart.

### How it is put together

Everything derives from **one provider registry**, `packages/config/src/analytics.ts`: the CSP
allowlist, the cookies the policy page discloses, and the processor named on the privacy page. An
operator writes this and nothing else:

```ts
analytics: { provider: 'ga4', measurementId: 'G-XXXXXXXXXX' },
```

They cannot then forget to declare `_ga`, cannot have a live tag behind a CSP that blocks it, and
cannot ship a policy page that contradicts either. `features.analytics` is a separate operator
off-switch; both are required. The registry is a **zero-dependency subpath export**
(`@commonpub/config/analytics`) so the client bundle does not pull zod in to read it, and both the
Nitro CSP middleware and the browser loader import the same file.

### The gate

Nothing loads before the visitor accepts. Not the "default denied" Consent Mode posture, which still
pings Google: no script at all. Verified in a browser rather than argued, at 390px, 320px and desktop:
**zero** requests to the vendor before a choice, **zero** after choosing Essential only including
across a navigation, one after accepting. That is now
`apps/reference/e2e/analytics-consent.spec.ts`, because "no request was made" is not something a unit
test can prove. Consent Mode v2 defaults are still emitted first, so a later grant is well formed.

### Two defects found on the way

- **Consent did not propagate.** Every `useCookieConsent()` call built its own `useCookie` ref, so one
  consumer accepting did not notify another except through Nuxt's async cookie sync. Harmless while
  nothing read `allowsAnalytics`; not harmless once a tag depends on it. The level is now a single
  shared `useState` written through to the cookie, so a grant AND a withdrawal both propagate
  synchronously.
- **A fixed overlay must be opaque.** `--surface` can legitimately carry alpha for in-flow cards (the
  reference theme uses 0.88), and page content was legible through both bottom bars. New
  `.cpub-overlay-surface` composites it over an opaque `--bg`, staying themed without a hardcoded
  value.

### Transparency

`pages/privacy.vue` previously asserted "We do not use any analytics services" and shipped that to every
instance. It is now conditional on the configured provider. Where analytics is on, the page states what
is collected (pages, referrer, city-level location from IP, device, a random id) and what is not
(nothing from the account, no ads, no cross-site tracking, no selling), names Google LLC and the
international transfer, gives consent as the legal basis, and **links to the two source files that
implement it** so a visitor can check rather than trust. Section numbers are derived from the visible
section list, replacing the chain of `federationEnabled ? '7' : '6'` ternaries that adding a conditional
section would otherwise have extended.

The banner now names what it is asking about, and both choices carry equal visual weight. A filled
"Accept all" beside an outlined "Essential only" is the pattern regulators single out; consent is only
freely given if refusing is as easy as accepting.

### To turn it on for another instance

1. Add the `analytics` block to `commonpub.config.ts`.
2. Wire `analytics` (and `instanceCookies`) into `runtimeConfig.public` in the app's `nuxt.config.ts`.
   deveco never wired ANYTHING from its config file, which is why its cookie banner had never once
   rendered.
3. Set `features.analytics: true`.

### Test-suite note

The consent banner is fixed to the bottom of the viewport and intercepts clicks under it, so every e2e
spec now starts from a pre-answered `cpub-consent=essential` (`playwright.config.ts` `storageState`);
`analytics-consent.spec.ts` overrides that back to empty to test the gate. Without this, enabling
analytics on an instance would break its own e2e suite. Related: better-auth only enforces its CSRF
origin check when the request carries a Cookie header, so the lifecycle spec's sign-up call now sends
an `Origin` header, which is what a real browser does anyway.

### Local test-environment note

Four e2e failures on this machine are local DB state, not code, and were confirmed to fail with
analytics switched off too: `instance_settings.theme.default` is a leftover
`cpub-custom-glass-demo-dark` from earlier theme-studio work (three theme specs assume the stock
default), and a seeded hub avatar points at a host that no longer resolves (`/hubs` console-error
smoke). CI runs against a fresh database.


---

## Deployed, and what the deploy verification caught

All three PRs merged; commonpub.io, deveco.io and heatsynclabs.io all deployed and healthy. Two real
defects surfaced only AFTER deploy, both because the verification checked behaviour rather than
stopping at "it deployed".

**1. The CSP opened a vendor origin on an instance with analytics off** (`layer@0.131.1`). The
middleware read the config block alone, so *declaring* a provider was enough. The reference app
declares one precisely so its e2e can exercise the consent gate while the flag stays off, so
commonpub.io went live allowing `googletagmanager` in `script-src` while its own `/privacy` correctly
said it uses no analytics. A CSP and a privacy page disagreeing is exactly what deriving everything
from one registry is supposed to prevent, so the gate belongs in the middleware, not in how the
reference app is configured.

**2. The flag was set in the wrong file, then the tag measured nothing.** Two separate problems in a
row on deveco:

- `features.analytics` was set in `nuxt.config.ts`'s `runtimeConfig.public.features`, which only
  carries `NUXT_PUBLIC_FEATURES_*` env overrides. `useFeatures()` primes from `commonpub.config.ts`
  merged with the DB overrides, so the flag read **false** in production and nothing turned on. **The
  flag belongs in `commonpub.config.ts`.**
- Then, with it on, `gtag.js` loaded and `google_tag_manager` initialised the property, every command
  was present in the `dataLayer` — and no hit was ever sent and no `_ga` cookie was ever set. The shim
  pushed an **array**; Google's canonical shim pushes `arguments`. Not cosmetic: the site looked
  instrumented and measured nothing (`layer@0.131.2`).

The second one is the lesson worth keeping. "The script loaded" is not "it works". The check that
caught it was looking for the collect beacon and the cookie.

### Final live verification (deveco.io, real property)

| | tag requests | `_ga` cookie |
|---|---|---|
| Before any choice | **0** | no |
| After "Essential only", plus a navigation | **0** | no |
| After "Accept all" | 5, incl. 3 collect beacons | `_ga`, `_ga_1BEXT06G60` |

The two cookies set are exactly the two the cookie policy discloses, because both come from the same
registry entry.

commonpub.io is back on the tight default CSP (`script-src 'self' 'unsafe-inline'`), still reports
`analytics: false`, and its privacy page still says it uses no analytics. heatsynclabs.io is a pin
bump only and declares no provider.

### Remaining

- **`features.emailVerification` is still OFF everywhere.** Published and ready; deveco has a real
  Resend transport, so turning it on is an admin toggle now (it is runtime-flippable) rather than a
  redeploy.
- The contest-email question is still unanswered.
- `create-commonpub` pins are now ~26 minors stale.
