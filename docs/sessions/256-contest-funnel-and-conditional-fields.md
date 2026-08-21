# Session 256 — the contest entry funnel, walked as real people, and conditional form fields

**Not rolled.** Everything below is on `main` in the working tree, gates green
(typecheck 30/30, lint 0 errors, the touched suites all passing). No version bump
yet, so the roll starts with a `chore(release)` commit.

Trigger: real feedback from deveco's live Resilient America contest — *"people
aren't sure how to submit a project; they may not know you need to register"* —
plus a request for registration fields that appear conditionally.

## What was actually done

1. Stood up a local instance carrying a **byte-identical copy of deveco's live
   contest** (fetched from `deveco.io/api/contests/qualcommforamoreresilientamerica`:
   42 registration fields, 20 required, the same 7 stages, `registrationMode: light`).
2. Walked the funnel in a real browser as four people: an anonymous visitor, a
   maker with no published project, a maker with one, and an entrant outside the US.
3. Built conditional form fields.
4. Fixed the copy that, on the evidence, is causing the reported confusion.

## The funnel, as it actually reads

`registrationMode` is `light` on every live contest. Registration creates a
participant record; the entry is a **separate act**. With
`contestEntryRequiresRegistration` ON (it is, everywhere), the real path is:

```
land → log in → register (42 fields) → publish a project → Entries tab → Submit Entry → pick it
```

Six steps. Here is what each persona saw.

### Anonymous

The whole page contains no call to action about submitting a project. The hero
says **"Log in to register"**. The sidebar hint said:

> Registering enters you into the contest and gets you every update.

**That sentence is false on a `light` contest, and false in the way that costs
entries.** A maker registers, reads that they are entered, and never submits
anything. This is the single most likely cause of the feedback, and it is one
string. Fixed: the copy is now `registrationMode`-aware.

Second-order: the word "register" means two different things one click apart. The
hero says "Log in to register" (register *for the contest*); the login page it
lands on says "Don't have an account? **Register**" (create an *account*).

### Registered maker, nothing submitted

The card said **"You're registered"** and stopped. No next step, no link, nothing
naming the thing they still had to do. Fixed: a "Next: submit your project" block
appears for a `full` registrant on a `light` contest with no entry, saying
plainly that registering does not enter you, with a button to the Entries tab.

### The registration form itself

- **20 "This field is required." errors render on a pristine, untouched form**,
  each in a `role="alert"` live region, on a page 5,677px tall. A screen reader
  gets 20 alerts on load. `ContestRegistrationForm` computes `missing` from the
  empty model and renders the error immediately.
- The inputs carry **no `aria-invalid` and no `aria-describedby` pointing at the
  error**; the error paragraph is a sibling the input never references. Required
  fields carry neither `required` nor `aria-required`.
- **Save is disabled with no explanation and no summary of what is missing.**
  The button sits at the bottom of seven screens; a participant who missed one
  field finds a grey button and no way to learn why.
- Every entrant must supply **Recipient, Phone and a full Shipping Address**,
  all required, under a heading that says *"Where should we ship a dev kit **if
  you are selected**?"* — before they have decided to enter.
- "I confirm my country of residence is the United States" is `required: true`,
  so a non-US entrant **cannot complete registration truthfully at all**. The
  form also offers, optionally, "I would like to participate, even though I know
  I do not qualify" — which the required checkbox above makes unreachable.

### The proposal path is silently off

deveco's current stage is `kind: submission`, `submissionMode: proposal`, and
`submissionTemplate: []`. Both `currentProposalStage` (the page) and
`ContestProposalForm` require a non-empty template, so **the whole proposal path
disappears and nothing tells the organizer**. Entrants fall through to
"attach a published project", which needs them to author and publish one first.

Fixed: the stage editor now warns when a stage is in proposal mode with no fields.

### The rules body is truncated, and it breaks hydration

The contest page reported **three hydration mismatches on every load** —
`ContestRules` ("server rendered element contains more child nodes than client
vdom"), `div.cpub-contest-body`, and `ContestSidebar`. Root-caused, with a clean
A/B: a contest without unbalanced author HTML reported none; the same page with
it reported three.

The chain:

1. deveco's `rules` is stored at **exactly 50,000 characters** —
   `CONTEST_RICH_TEXT_MAX` — and ends mid-word, mid-tag:
   `"…our sole point of c"`. It leaves **three unclosed `<div>` and one unclosed
   `<p>`**. The Zod cap only `.max()`es, so it rejects rather than truncates;
   whatever wrote this sliced it to fit. **The tail of the official rules is
   missing from the live page and nothing warned anyone.**
2. `sanitizeRichHtml` is a regex string transform, not a parser, so it **cannot
   balance tags** and passed the imbalance through to `v-html`.
3. The browser's parser repaired it by closing the dangling elements at the
   container boundary, relocating nodes.
4. Vue found an element with more children than its client vdom had: a hydration
   mismatch, after which every later warning on the page is unreliable.

**Fixed at (2)**, which is the platform-level cause: both layer sanitizers
(`sanitizeRichHtml` and `sanitizeBlockHtml`) now end with a `balanceTags` pass
that closes what the author left open and drops close tags matching nothing. It
is pure string work, deliberately identical in Node and the browser — a balancer
that behaved differently on the two sides would cause the very mismatch it
prevents. Verified in the browser: **3 mismatches → 0**, `.cpub-rules-section`
back to its correct 2 children. 11 tests, including no-regression cases asserting
already-balanced HTML comes back byte-identical.

`sanitizeBlockHtml` was included because the same gap guards **remote federated
content** (`pages/federated-hubs/[id]/posts/[postId].vue`, `pages/mirror/[id].vue`),
where the imbalance is not an accident of truncation but something a remote
instance can send on purpose: a stray `</div>` in a federated post closes the
card it was rendered into and hoists the rest of the post out into the page.
Scripts are already stripped, so this is layout spoofing rather than XSS, but it
is attacker-controlled and it is now closed on the render side — which also
covers rows stored before the fix.

**Noted, not changed:** `@commonpub/protocol`'s `sanitizeHtml` (the federation
INGEST sanitizer) is regex-based and does not balance either. Fixing it would
rewrite stored content and touch the federation package, so it wants its own
pass; the render-side guard above is what actually protects the page today.

(1) is deveco content and is listed under Open.

### A retracted observation

Earlier in this session I recorded that **"Create a new project" in the Submit
Entry dialog does nothing** on a real click. That was wrong, and the correction
matters because it would have sent someone hunting a bug that is not there.

Instrumenting the button showed the reason: with listeners attached for
`pointerdown`/`mousedown`/`click`, a harness click on it produced **no events at
all** — and neither did a click aimed at a tab elsewhere on the page. The browser
automation had stopped delivering pointer input to that tab. The clicks that
"worked" earlier landed; the ones that "failed" were never delivered.

So there is no evidence of a defect here, and none of a clean bill of health
either: the path is simply **unverified**. The `href` resolves and the route
renders when opened directly.

## Conditional form fields

Full design in `docs/plans/conditional-form-fields.md`.

```ts
interface FormFieldCondition { field: string; equals: string[] }
interface FormField { /* … */ showWhen?: FormFieldCondition }
```

A field, or a whole section, appears only while an **earlier**
`select`/`radio`/`checkbox` holds one of `equals`. Hidden means not shown, not
required, and not stored.

`visibleFormFieldKeys` in `@commonpub/schema` is the single source of truth,
called by the renderer, the client required-gate, the payload builder and the
server's validate-and-partition. It also absorbed the acceptance-marker set that
had been declared three times (`FORM_ACCEPTANCE_VALUES`).

The part that needed the most care is not the resolution — it is keeping rules
coherent while the operator edits. Deleting the source, moving it below its
dependent, retyping it, renaming an option value or deleting the matched option
each leave a rule that can never hold, and the operator's *next* save would then
fail Zod with an error about a field they were not editing. Every builder op
routes through `templateConditionsRepaired`. Renaming a source's **label**
re-keys it, so dependents are carried to the new key — without that, one
keystroke silently orphans every rule pointing at it.

Flag `contestConditionalFields`, default ON, gating what the builder **offers**
(mirroring `contestPii`). A stored rule is always honoured: a flag flip that
stopped hiding fields would resurrect required questions the entrant was never
shown and block every submission.

The markdown DSL round-trips rules as `show=key:a|b`, on fields and on section
headings, with import-time validation mirroring the server's.

### Verified end to end

On the local copy of the live contest, with two rules added — the entity upload
gated on the "registered US entity" checkbox, and the whole Dev Kit Shipping
section gated on the Startup track:

| Check | Result |
| --- | --- |
| Pristine form | 38 inputs → 29; page 5,677px → 5,007px; required errors 20 → 17 |
| Section rule | recipient + phone + address all gone; the next section still shows |
| Ticking the source | field returns; back to 38 inputs |
| Switching the track back | shipping block hides again, entity upload stays (independent rules) |
| `POST /register` as a Developer, no shipping fields | **200** |
| Same answers on the Startup track | **400 "Recipient / Attention is required"** |
| Stale answer to a hidden field | dropped, not stored |
| Builder | control on 40 of 42 cards (the first two have no eligible source above them) |

Tests added: 27 (schema), 10 (server), 31 (layer utils), 8 (registration form
component, incl. axe), 6 (builder component). The layer's flag-parity guard
caught a missing `ENV_FLAG_MAP` entry, which is the guard doing its job.

## Rolling this

**No migration.** `showWhen` lives inside the existing `registration_template`
and `stages` jsonb columns; adding an optional property to a TS type does not
touch a column. An instance that takes the roll and authors no conditions is
byte-identical to one that does not.

Packages changed, and therefore the pin cascade (`workspace:*` publishes as an
EXACT pin, so a leaf change means republishing everything above it):

```
schema  →  server  →  layer
config  →──────────────┘
```

- `@commonpub/schema` — `FormFieldCondition`, `showWhen`, `visibleFormFieldKeys`,
  `isConditionSourceField`, `FORM_ACCEPTANCE_VALUES`, `formFieldConditionSchema`,
  `applyTemplateConditionRules`
- `@commonpub/config` — `contestConditionalFields`
- `@commonpub/server` — `validateSubmissionFields` honours visibility
- `@commonpub/layer` — the builder UI, the three entrant forms, the signup copy,
  the stage warning, `balanceTags`
- `@commonpub/test-utils` — `mockConfig` gains the flag (a consumer's tests fail
  to typecheck without it)

Flags go **46 → 47**; `MIN_FLAGS` in `featureFlagParity.test.ts` is bumped to
match, and `ENV_FLAG_MAP` gains `FEATURE_CONTEST_CONDITIONAL_FIELDS`.

Follow the prerelease pattern from session 255: publish the layer under `next`,
verify against the deveco fork's CI on a draft PR (the only place the PUBLISHED
layer is typechecked), then promote and repin.

## The platform audit

Twelve dimension auditors + refute-by-default verification, 142 agents. Full
report: **`docs/reviews/platform-audit-2026-08-21.md`**. 128 raw findings, 114
survived, no P0.

An 89% survival rate is high for refute-by-default, so the report says plainly
that P1 is well-evidenced and P2/P3 are leads.

**Three confirmed P1s were fixed here rather than filed**, and two of them landed
on code this session had just written:

- **Renaming a field label silently rekeys it**, orphaning every stored answer,
  private-field entry and agreement acceptance recorded under the old key. The
  builder never exposes `key`, so the "key tracks label" branch is live for every
  field an operator has not hand-keyed. Fixed: keys that arrived from the server
  are snapshotted at hydrate and frozen; keys added this session still track their
  label. This is the same function the conditional-fields work had modified to
  carry `showWhen` across a rename — that change was correct and incomplete, and
  the audit found the half that was missing.
- **"Log in to register" dead-ended on a permanently disabled button.** Every
  contest created through the editor stores an empty `registrationTemplate` and
  falls back to the default three fields, all optional. A pristine form collects
  `{}`, which is not dirty, so the only CTA on the page a new arrival lands on was
  greyed with no explanation. The errors-before-input work earlier in this session
  had removed the missing-fields gate from `canSave` but left the `dirty` gate, so
  it fixed half of this without noticing the other half. Now a first registration
  is always submittable; editing saved details still needs a change.
- **Contest entries fetch has no `limit`** — the server defaults to 20 and nothing
  paginates, so past 20 entries a participant's own `myEntries` empties, their
  stage-submission form vanishes, and the proposal form reappears inviting a
  duplicate entry. Deveco has 2 entries today. **Filed, not fixed** — it needs a
  pagination decision, not a one-liner.

Also worth acting on, from the report: `GET /api/users` and
`/api/search?type=people` enumerate every account ignoring `profileVisibility`
and `status`; `GET /api/users/:username` serves a "Only me" profile in full to
anonymous callers; the federated OAuth callback has no CSRF binding between the
`state` token and the browser that started the flow; WebFinger actor search lets
any host claim any actor URI; and the public v1 `/events` and `/videos` routes
500 on every non-empty result.

## Round 2 of the audit, and the proposal question

Full report: **`docs/reviews/platform-audit-round-2-2026-08-21.md`**. 113 agents,
99 findings, 78 survived (79%, down from round 1's 89% — verifiers had to write
down the exact reachable input or refute). No P0.

### Is it clear how to submit a proposal?

**Not on deveco. On a correctly configured contest, yes.**

deveco's Proposals stage is `submissionMode: 'proposal'` with an **empty**
`submissionTemplate`. Both `currentProposalStage` (`index.vue:253`) and
`ContestProposalForm` guard on `template.length`, so the entire proposal path is
off, silently. The rules tell entrants *"Stage One: Submit a Proposal. Register
on deveco.io and publish your Proposal there"*, but no such control exists —
their only path is attach-a-published-project, which means authoring and
publishing a project first. Of 18 mentions of "proposal" on the anonymous page,
all 18 are the operator's own rules prose; the platform generates one bare badge.

I configured a template locally and walked it. It works, and the good parts are
good: the form is clear, both entry paths sit side by side sensibly labelled, and
returning later shows "Proposals: your submission" fully prefilled and editable.

**The one change worth making is a config edit, not code:** put fields on the
Proposals stage form. Name the first field exactly **Title** — `submissions.ts:459`
titles the created draft from a field whose key is `title` and otherwise falls
back to `"<Contest> proposal"`, so the stock starter template ("Project name")
gives every entrant an identically-named draft.

Remaining code gaps, all filed: nothing outside the Entries tab names proposals;
after submitting you land in a blank editor with no confirmation; and a rejected
proposal fires only a 3-second toast with no inline error, no `aria-invalid` and
no focus move — the gap `ContestRegistrationForm` was fixed for in this session
and its two siblings were not.

### The first-paint lie, confirmed

`registrationTier` is seeded `null`, so `mustRegisterFirst` is **true for everyone
during SSR**. Fetching the page with a registered user's cookie returns HTML whose
hero says "Register for this contest" with no "Submit Entry" anywhere, and whose
Entries panel says "Register to enter this contest — Registration comes first".
An already-registered entrant is told to register on every load. I dismissed this
earlier in the session as a loading artifact; round 1's critic was right and I was
wrong. **Not fixed** — it wants the pending-state rule applied across all 23
`server: false` sites, not a patch here.

### The self-audit found five defects in this session's own work

All five fixed, including a **P1 that was a half-fix of a round-1 P1**: key
locking was wired to the registration builder only, so per-stage submission
templates still rekeyed on a label edit. There are three producers of
`FormField[]` — the registration builder, the stage template, and the markdown
importer — and the first fix reached one. The synthesis calls this "the clearest
case in the whole audit of a fix applied to a symptom's location rather than the
cause's location", which is fair. A source-level wiring guard now pins all three.

Detail in the report's "Fixed in this session" table.

### Worth acting on from round 2

1. **`GET /api/image-proxy` serves attacker-controlled SVG same-origin with no
   CSP** — anonymous, no flag, no cookie. Effectively XSS on the instance origin.
2. One signed inbox POST fans out into thousands of message rows (unbounded `to`,
   no dedupe, no body cap) — remote DoS from an actor with no relationship.
3. Dynamic OAuth client registration hands an existing client's `client_secret`
   to any unauthenticated caller.
4. `GET /api/content/:id/products` is unauthenticated and ungated — a private
   project's bill of materials is public.
5. Hub post AP Note lookup is not scoped to the hub in the URL — a private hub
   post leaks anonymously.
6. `sitemap.xml` publishes profile URLs for `members`/`private` users, and RSS
   emits raw C0 control characters, making the whole feed a fatal parse error.

## Security fixes and the cover-image notice (after round 2)

### Cover-image notice

A note now sits beside every cover-image upload: *"Please do not use generative AI
for your cover image. It's tacky and lame."* (The apostrophe was added; the rest
is verbatim.) One exported constant in `utils/coverImageNotice.ts`, because cover
images are uploaded from **four** surfaces sharing no component — the shared
`ImageUpload` (content starter form + both event forms) and the two editors'
hand-rolled inline covers. `components/__tests__/coverImageNotice.test.ts` pins
all three files, since a notice added to two of three looks exactly like a notice
that shipped. Scoped to `purpose === 'cover'`: avatars and hub banners are a
separate decision.

### Four security fixes from round 2

| Finding | Fix |
|---|---|
| **[P1]** `image-proxy` served attacker-controlled SVG same-origin with no CSP | Refuses scriptable image types; matches on the MIME with parameters stripped (so `image/svg+xml; charset=utf-8` cannot pass); echoes the normalized MIME rather than the upstream header; adds `nosniff`, a `default-src 'none'; sandbox` CSP and `Content-Disposition`. Raster-only is right here because the proxy exists for `<img>` cards, which never execute SVG script anyway. |
| **[P1]** One signed inbox POST fanned out into unbounded message rows | `to` is deduped and capped at 20 local recipients, and the body is capped at 10,000 chars — the same limit `sendMessageSchema` holds the local compose box to. Excess recipients are dropped rather than the activity rejected, so an honest-but-sloppy sender still delivers. |
| **[P2]** Hub post AP Note lookup not scoped to its hub | `.where(and(eq(hubPosts.id, postId), eq(hubPosts.hubId, hub.id)))`. The privacy check was made about one hub and the row read from another, so a private hub's post was served unauthenticated under any public hub's slug. |
| **[P2]** `GET /api/content/:id/products` exposed a private project's BOM | Gated **inside `listContentProducts`**, not in the route, so every caller inherits it. Two existing tests were asserting the leak (they listed a draft's products anonymously and expected rows); they now pass the owner, and a new test pins that anonymous and a third party get nothing. |

**Behaviour change worth knowing:** `POST /api/auth/oauth2/register` no longer
returns an existing client's `client_secret` on a repeat registration — it was an
unauthenticated endpoint treating an attacker-supplied `instance_domain` as an
idempotency key, so anyone who could name a peer instance could ask for its
credentials. A repeat now refuses with a message telling the caller to contact an
administrator. The cost is that an instance which loses its secret cannot silently
re-acquire it; auto-rotating instead would be worse, since an attacker could then
invalidate the real peer's credentials at will and receive the replacement.

The layer's own content-read privacy guard (`contentReadGuard.test.ts`) caught the
first version of the products fix, which had put the visibility predicate in the
route. It was right: the fix belonged one level down.

## Verification pass (the "double check everything" turn)

Re-audited this session's own work rather than trusting the earlier green runs.
Four defects found in it, all fixed:

1. **Markdown import silently deleted conditions.** `withPreservedKeys` restored a
   field's saved key but did not re-point `showWhen.field` at it, so the repair
   pass then deleted the orphaned rule without a word. Reproduced with a failing
   test first. Conditions are now carried to the restored key, the same move
   `templateFieldLabelChanged` makes.
2. **The focus fix only worked for 10 of 12 field types.** A probe across every
   type showed `agreement` and `file` still went nowhere, because their id sits
   on a `<span>` with no focusable child and no `aria-labelledby` wrapper. The
   claim in the previous write-up was wrong for those two. Resolution is now
   type-agnostic (the id'd element if focusable, else the first focusable control
   in its `.cpub-subfield` container), covered by a per-type test.
3. **`focusField` threw on `scrollIntoView`.** Absent in jsdom; an exception there
   aborted the handler after focus had moved, for a purely cosmetic step. Guarded.
4. **The image-proxy fix was a degradation.** Refusing `image/svg+xml` would have
   broken federated vector cover images, since the proxy's only consumers are
   `<img>` and CSS `background-image` on content cards (`utils/imageProxy.ts`) —
   neither of which executes SVG script. Changed to serve SVG under the same
   sandbox CSP `serveFile.ts` uses for stored files, with a test asserting the two
   policies are byte-identical so they cannot drift. Residual risk is stated in
   the route: it leans on the CSP surviving the edge.

Also: two em dashes had reached operator-facing validation messages (house rule
bans them in user-facing copy; comments are exempt). Both rewritten as sentences.

**Gates, all uncached and re-run this turn:** typecheck 30/30, lint 29/29, layer
199 files / 2,901 tests, and every package suite green — schema 587, config 39,
editor 267, infra 183, protocol 431, persona 169, ui 272, explainer 191,
learning 101, docs 131, test-utils 13. The public API OpenAPI route-parity suite
(36) passes, so none of the server-side signature changes moved the v1 contract.
`packages/server` is green apart from the 7 pre-existing persona failures.

**Local dev-DB cruft left by this session** (not touched, since deleting rows is
destructive and this is your database): the seeded contest
`resilient-america-local` with 3 registrations and 2 entries, and 6 test accounts
matching `%1787%@example.com` / `fresh+%` / `dev+%`. Independently, session 255's
47 `user_purpose_consents` + 56 `user_persona_answers` are what make the persona
integration suites fail locally.

## Browser test against an exact replica of the live contest

Earlier browser work in this session was **not** against the current live config:
a copy was made early, then both diverged (the operator added a 12-field proposal
form; the local copy had four invented fields). And it only ever ran the modified
code, so it never showed what entrants hit today. Redone properly.

A replica was seeded from a fresh `GET /api/contests/qualcommforamoreresilientamerica`
and verified identical to live by deep JSON comparison on `registrationTemplate`
(42 fields), the proposal `submissionTemplate` (12 fields, 7 required including a
required `agreement` and a required `select`), `stages`, and `registrationMode`.
It was then driven twice: once with the working tree **stashed and packages
rebuilt at HEAD** (what entrants hit now), once on this session's code.

**Caveat on method:** the browser harness delivered zero pointer events again
(probed with a `pointerdown` listener), so interactions were driven through the
components' own handlers. Real-mouse hit-testing is unverified.

### The finding this turn exists for

On shipped code, the contest page's hydration mismatch is not merely a console
warning. Vue abandons patching the affected subtree, so **part of the Entries tab
stays frozen in its server-rendered state**:

| Same registered entrant, same page | Shipped code | This session's code |
|---|---|---|
| Entries CTA after a **full page load** | "Register to enter this contest. Registration comes first." + a Register button | "Enter with an existing project… Submit Entry" |
| Entries CTA after **client-side navigation** (no hydration) | correct | correct |
| `.cpub-rules-section` children | corrupted | 2 |
| Hydration mismatches in console | 3 | 0 |

So a registered entrant is told to register, permanently, on the exact tab where
they would submit — and the Submit Entry button never appears there. The
client-side-navigation control is what proves hydration is the cause rather than
a state bug. The tag-balancing sanitizer fixes it.

### Registration page, exact 42-field live template

| Fresh unregistered entrant | Shipped | This session |
|---|---|---|
| "This field is required." on load | **19** | **0** |
| `role="alert"` regions on load | **19** | **0** |
| Save button on load | disabled, no explanation | enabled |
| Pressing Save while incomplete | nothing happens | "19 answers are still needed", all 19 listed and linked, errors revealed, focus moved to the first, `aria-invalid="true"` |

### A defect the replica demonstrated

Submitting the proposal form twice produced **two entries and two draft projects**
for one entrant. `submitContestProposal` only enforced a cap when
`maxEntriesPerUser` was set, and it is `null` on the live contest. The "one
proposal" rule existed only in the client (`ContestProposalForm` renders while
`myEntries` is empty), and `myEntries` derives from an entries fetch the server
caps at 20 — so a double submit, or any contest past 20 entries, duplicates.

Fixed: the proposal path defaults to a cap of **1**, with an explicit
`maxEntriesPerUser` still winning. Refusal happens before `createContent`, so no
orphan draft. Verified on the replica: the third submit returns 400 *"You have
already entered this contest. Edit your existing entry instead of submitting a new
one."* and the entry count does not move.

The end-to-end also confirmed the `title` fix: a proposal submitted through the
real form creates a draft named from the entrant's `title` answer.

## Pre-existing red, not caused by this work

`pnpm turbo run test` fails **7 tests in 2 persona integration suites**
(`personaMetrics.integration.test.ts`, `personaAuditFixes.integration.test.ts`).
Confirmed pre-existing: identical failures, same line numbers, with this session's
changes stashed.

**Correction (verified, replacing an earlier claim in this document).** These 7
failures are NOT caused by session 255's leftover rows in the shared dev database.
That explanation was asserted without testing it. Running both suites against a
freshly created, completely EMPTY database reproduces all 7 identically, and
`realpgdb.ts` already creates and drops a fresh schema per test file. They are a
genuine pre-existing defect in the persona metrics logic on `main` — the
assertions that fail are about k-anonymity re-flooring and finalised-day reads
(`raised.suppressed` expected 1, got 0), not about row counts. Still unrelated to
this session's changes (identical with the work stashed), but they are a real bug
to fix, not cruft to clear.

## Open

Ranked, highest value first:

1. **deveco's rules body is cut off mid-sentence at 50,000 characters.** The
   sanitizer no longer lets the imbalance corrupt the page, but the missing text
   is still missing from a document participants legally accept. Find what
   sliced it, restore the tail, and add a warning when a rich-text body lands
   exactly on its cap — a body at the limit is almost always a truncated one.

   Blast radius checked across all three live instances, via the DETAIL endpoint
   (the list serializer omits `rules`, so a list-level scan reads 0 and misses
   this entirely): deveco `qualcommforamoreresilientamerica` rules **50,000**;
   heatsynclabs `t-shirt-contest` rules 101; commonpub.io has no contests. One
   contest, one body.
2. **Re-check the Submit Entry dialog with working browser input**, since this
   session could not deliver a trusted click to it.
3. **Isolate the persona integration suites** from the shared dev DB (per-suite
   schema, or truncate in `beforeEach`).
4. **Give the anonymous contest page a sentence about submitting**, not only
   about registering, and resolve the "register" word collision with the account
   signup link.
5. deveco content, not platform: the required "country of residence is the United
   States" checkbox makes truthful registration impossible for a non-US entrant,
   and the dev-kit address is required of everyone. Both are now expressible as
   conditions instead.
