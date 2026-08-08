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
  (new: 8 `ContestHero` CTA cases, 10 route-contract cases for the gate).
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

## Open / next

- Deploy note: the gate is a behaviour change on upgrade. On deveco the live contest
  keeps working for existing entrants; new ones must complete the 41-field form
  before entering (intended).
- Still deferred from 249: themed-email redesign, nonce CSP, legacy-URL scrub
  migration 0046, the long-red `e2e` CI job.
