# Session 250 — Absolute email links + contest register CTA + registration-before-entry

Three operator-reported items on the live deveco contest, all in the contest
participation path.

## 1. Email links dropped the domain (`https://auth/register`)

**Symptom.** A contest email (the registration confirmation, and the same body sent
as a test from the email editor) carried a CTA that landed on `https://auth/register`
instead of the instance.

**Root cause.** `renderEmailBlocks` (`packages/server/src/emailBlocks.ts`) emitted a
registration-link block's href exactly as authored, and that block's default is the
**root-relative** `/auth/register` (`packages/editor/src/blocks/registrationLink.ts`).
Root-relative is correct *in the app* — it resolves against whatever host serves the
page — but an email has no document base. A mail client that prepends the scheme
produces `https:///auth/register`, and the URL parser normalizes the empty authority
by promoting the first path segment to the host: `https://auth/register`. Exactly the
reported string. Session 249's verify-email fix was a different link (that one was a
GET/POST method mismatch); this one had never been absolutized.

Same class, silently: an **image** block pointing at instance-hosted media
(`/uploads/…`) failed `HTTP.test()` and was **dropped** from the mail entirely.

**Fix.** One shared helper, applied at the single render choke point:
- `absolutizeHref(href, origin)` in `@commonpub/editor` — resolves `/…` (and a bare
  `#fragment`) against the origin; leaves `http(s)`/`mailto:`/`tel:` untouched;
  ignores a hostless origin (a misconfigured instance can produce `https://`) rather
  than corrupting the href.
- `renderEmailBlocks(blocks, { …, siteUrl })` runs the registration CTA and
  root-relative image srcs through it.
- Threaded from every send path: `buildContestEmailCopyOverride` →
  `registrations.ts` (`email.siteUrl`), `reminders.ts` (`ctx.siteUrl`),
  `email-test.post.ts` + `email-preview.post.ts` (request `origin`). The preview now
  shows the same absolute URL the inbox gets — previously a relative href "worked" in
  the preview iframe and broke only in the mail client.

Audited the other email surfaces: broadcast `ctaUrl` is schema-forced to http(s),
notification links are already `${siteUrl}${link}`, `{contestUrl}` is absolute. The
registration block was the only relative-URL leak into mail.

## 2. Register CTA at the top of the contest page

The register action lived only in the sidebar signup card, below the fold on a
contest with a long description. `ContestHero` now carries it in the same CTA row as
Submit Entry:

- anonymous + registration open ⇒ **Log in to register** (returns to the contest)
- authenticated, not a `full` registrant ⇒ **Register for this contest**
  (a `reminders` follower gets "Register for the contest")
- `full` registrant + active ⇒ **Submit Entry** (as before)
- registration closed (judging/completed/cancelled) ⇒ Share only

The page owns the flow decision (`startRegistration`), mirroring the signup card: a
template with any required field or must-accept agreement routes to the full-width
`/contests/:slug/register` page; an all-optional template (incl. the legacy default)
one-click registers.

## 3. Registration is now a precondition for entering

Session 249 documented this hole and left it: `submitContestEntry` /
`submitContestProposal` **auto-register** the entrant as a counted `full` participant
with no agreement acceptance, so the API let someone become a participant without
accepting the contest's required agreements. It was left as-is because "the UI
requires register-then-enter". That is now enforced, both sides.

**Server** (`features.contestEntryRequiresRegistration`, default **ON** — rule #2):
`POST /api/contests/:slug/entries` and `/proposal` read `getRegistrationTier(db,
contestId, userId)` and 403 unless it is `full`. A `reminders`-tier follower has
accepted nothing, so following is not enough. Off ⇒ legacy behaviour.

**Client:** the hero, the Entries-tab CTA ("Register to enter this contest"), the
submit dialog, and the proposal form all route an unregistered viewer into
registration instead of letting them reach a submit they'd be refused. The editor's
publish-time auto-enter (`?contest=slug`) now surfaces a 403 as "Published. Register
for the contest to enter this project." instead of swallowing it silently.

**Note on existing entrants:** anyone who already entered has a `full` row from the
old auto-registration, so they keep entering; only new participants are routed
through the form. Their historical rows still carry no consent record — the gate
stops the hole growing, it does not retroactively collect consent.

## Verification

- Unit/integration: editor 13 registrationLink (5 new absolutize cases), server
  **1790/1790** (incl. a new `getRegistrationTier` integration case and an
  email-copy case asserting the **delivered outbox row** carries
  `href="https://test.example/auth/register"` in both MIME parts), layer 1591
  (new: 8 `ContestHero` CTA cases, 10 route-contract cases for the gate); full
  monorepo `pnpm test` 33/33 tasks; layer suite 1598/1598.
- Typecheck: `pnpm typecheck` 28/28 (both apps' `nuxt typecheck` over the layer).
- Browser E2E against a local reference instance, **12/12**: absolute CTA in the
  email preview + test-send; hero shows Register→Submit Entry across
  unregistered / following / registered; entries-tab CTA; direct `POST /entries`
  403 while unregistered **and** while only following, 400-on-content after
  registering (gate passed); required-form contest routes to `/register`; 390px
  with no horizontal overflow. Screenshots reviewed.
- Drive-by: fixed the pre-existing red `contestEntryDetailPage` suite (7 failing) —
  session 249's `safeHref` render guard is used in the page TEMPLATE, so the test's
  `globalThis` auto-import stubs couldn't reach it; provided via VTU `mocks`.

## CI — both long-red jobs fixed

CI had been red on `main` since ≥2026-07-17. Two independent causes, both fixed here:

- **`check` (gating) — Test step.** Failing on the `contestEntryDetailPage` suite (7 tests). Session
  249's `safeHref` render guard is used in the page **template**, which compiles to `_ctx.safeHref` and
  resolves through the render proxy — the test's `globalThis` auto-import stubs (which work for
  script-scope imports) can't reach it. Supplied via VTU `mocks`.
- **`e2e`.** `auth.spec.ts` asserted the register submit button is enabled on load as a hydration
  barrier. The GDPR affirmative-consent checkbox made it correctly `disabled` until ticked, so the
  assertion had been wrong ever since. Replaced with tick-until-enabled (retried as a unit) — which is
  a *better* hydration barrier, since the button can only flip once v-model is live — plus an explicit
  assertion of the real behaviour (disabled before consent).

Result: `check` + `rust` + `e2e` all green.

## Roll — SHIPPED to all 3 (2026-08-07)

**config 0.35→0.36 · editor 0.14→0.15 · server 2.125→2.126 · layer 0.122→0.123**, no migration, no
schema/infra change.

- Published in dependency order (config → editor → server → layer, polling `npm view` between each;
  layer via `pnpm run publish:layer`). Verified the published tarballs' internal pins resolved to the
  new exact versions.
- Pushed `main` → **commonpub.io**. The first deploy attempt failed on an SSH handshake reset (droplet
  connection, not code); re-ran and it went green through `smoke.mjs`.
- Bumped **deveco** + **heatsync** pins (config/server/layer; hand-edited — 0.x carets don't cross a
  minor) + regenerated BOTH lockfiles in each fork → pushed.
- Post-deploy verification (their workflows are warn-only on health, so this is the real gate):
  `/api/health` ok + `/api/features` **39 flags with `contestEntryRequiresRegistration: true`** on all
  three; `/`, `/contests`, `/about`, `/feed` all 200 on all three; the live deveco contest page SSRs the
  new hero CTA ("Log in to register") and `POST /entries` refuses unauthenticated callers.

## Open / next

- **Behaviour change now live on deveco:** existing entrants keep working; new ones
  must complete the 41-field registration form before an entry/proposal is accepted.
- Still deferred from 249: themed-email redesign, nonce CSP, legacy-URL scrub
  migration 0046. (The long-red `e2e` CI job is no longer deferred — fixed above.)
- Known local-only e2e noise (NOT CI): 3 theme SSR specs + 1 homepage-sidebar spec
  fail against a dev DB that has a custom default theme / more than one active
  contest (`.cpub-sb-head a[href="/contests"]` then matches twice → strict-mode
  violation). Data-dependent, green on CI's fresh DB; the sidebar locator would be
  worth a `.first()` some day.
