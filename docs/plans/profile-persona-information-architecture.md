# Plan: profile, persona and sharing — one coherent information architecture

**Status:** PROPOSED (design only). Author context: session 255, after the persona and member-directory
work shipped and the operator asked why `/settings/profile` and `/settings/profile-details` both exist.

Companion to `persona-customization-and-audience-analytics.md` and `member-visibility-directory.md`.
Those built the machinery. This is about making it legible.

---

## 0. The principle that dissolves the confusion

The operator put it exactly right: *"no shit ur profile stuff is public, the persona stuff is like
custom questions we ask for stats."*

That instinct is correct and it has a name. Solove's taxonomy files **aggregation** under information
processing: combining individually innocuous facts "can reveal new facts about a person that she did
not expect would be known about her when the original, isolated data was collected." The companion
idea is **practical obscurity**: information is protected by being hard to find, and centralising it
"destroys this practical obscurity, effectively a privacy loss even though the data was public
before."

So the thing worth controlling was never publication. Your bio and your GitHub link are already
world-readable; you typed them in so people would read them. **What changes when a recruiter queries
`open-to/recruiters?techStack=rust&location=phoenix` is not access to those facts, it is the
destruction of the obscurity that made them harmless one at a time.**

That gives us the one rule the whole design should follow:

> **Toggle the aggregation, not the publication.**

Everything confusing about the current UI comes from violating it. `/settings/profile-details` asks a
member to edit their display name in a screen framed around statistics, and the privacy page asks them
to consent to sharing facts that are already on their public profile. Both feel like theatre because
both are.

---

## 1. Current state, quantified

`/settings/profile-details` ships nine built-in fields. **Six duplicate `/settings/profile` exactly**,
because they are `column:`-bound bridges onto the same `users` columns:

| Field | Storage | Also on /settings/profile | Countable |
|---|---|---|---|
| display_name, headline, location, pronouns, bio | `users` columns | **yes** | no |
| the `links` section | `users.social_links` | **yes** | presence only |
| **industry, interests, tech_stack** | `user_persona_answers` | no | **yes** |

Five fields live only on Profile: avatar, banner, experience, skills, website.

**The bridge worked; the cleanup did not.** `column:` exists so persona would not create a second copy
of your name. It succeeded, there is exactly one storage. Nobody removed the old editor, so there are
two editors over one column. That is a UI defect, not a data defect, and it is why the merge below
costs no migration.

The countability rule is already rigorous, in `personaFieldSink`:

| Shape | Stored | Countable |
|---|---|---|
| `column:` bound | `users` | never |
| select / radio / checkbox / multiselect | `user_persona_answers` | **yes** |
| text / textarea / url / number / date | `user_persona_text` | never (the analytics module does not import that table) |
| `link` | `users.social_links` | presence only, never the address |
| `sensitive: true` | forced to text | never, whatever the type |

Nothing about that needs to change. It needs to become visible.

---

## 2. The model: three layers, one sentence each

| Layer | What it is | Who sees it | Control |
|---|---|---|---|
| **Profile** | Who you are. Name, photo, bio, links, experience. | Everyone, by design | None. You published it. |
| **Questions** | Structured answers to the operator's questions. Shown on your profile too. | Everyone, by design | None on the answers |
| **Sharing** | Whether those answers may be **counted** and whether you may be **found by them** | Statistics, and named recipients | **Everything here** |

The member-facing framing follows from that, and it is the sentence the current UI never says:

> Your profile is public because that is what a profile is. What you choose here is whether it can be
> counted and searched.

---

## 3. Information architecture

Research on privacy UX converges on **both** placements rather than either: centralised dashboards make
controls discoverable, and contextual, just-in-time disclosure at the moment data is collected is more
effective than buried policy. A layered approach avoids overwhelming the user but risks hiding
important details, so the layers must agree.

So: contextual control where the data is, plus one dashboard that shows the whole picture.

### 3.1 Settings navigation

```
Settings
  Profile          <- nested, replaces today's Profile + Profile Details
    Basics           name, headline, location, pronouns, bio, avatar, banner
    Links            the platforms you list
    Experience       roles and history
    <Questions>      the operator's sections; the operator names this tab
  Privacy          <- the dashboard: what is shared, with whom, who looked
  Account
  Notifications
  Appearance
```

Two notes on that.

**The Questions tab takes its label from the config.** The sections are operator-defined, so the
operator names the tab. "Persona" is our internal word and means nothing to a member; "Profile
Details" is vague enough that it reads as a duplicate of Profile, which is exactly how we got here.
Default it to something plain like "About you" and let `persona.tabLabel` override.

**Privacy stays a separate top-level item.** It is a distinct legal act (Art 6(1)(a) consent to
processing) and it is the one screen that answers "what is leaving, and who looked". Folding it into
Profile would bury it.

### 3.2 Where the merge removes work rather than adding it

`/settings/profile-details` **already edits** display name, headline, location, pronouns and bio
correctly, through `updateUserProfile`, verified working in a browser. So the merge is mostly deletion:

- Delete the duplicated inputs from the old Profile form.
- Let the persona `basics` section render those fields in the Basics tab.
- Keep avatar, banner and experience as bespoke widgets, because they are not expressible as persona
  field types.
- Move the `links` section into its own tab, since it now carries per-platform sharing controls.

No data migration. No storage change. The `column:` bridge already guaranteed one copy.

---

## 4. The controls, and their granularity

### 4.1 At the top of Questions: one status line, one toggle

Contextual, and it states the current truth before offering the change:

> **Nothing here is counted.** Your answers show on your profile, like the rest of it. They are not
> included in any statistics and no recruiter can search them.
> `[ Count my answers in community statistics ]`

If it is already on:

> **Counted in community statistics.** Totals only appear once at least five people give the same
> answer, and counts are rounded down. [Manage sharing]

**This does not violate the anti-bundling rule.** Bundling is when saving data implies consent. This
toggle issues its own request and the section Save touches nothing about consent, so the existing test
("save a full persona, assert zero consent rows") still passes unchanged. Co-location is context, not
coercion. Keep them visually separate and never let one button do both.

### 4.2 In the Links tab: per-platform, and only for links you filled in

The operator's instinct here is right and it is the strongest argument for granularity: **GitHub and
Instagram are not the same decision.** One coarse "share my links" toggle forces a member to choose
between handing a recruiter their personal Instagram or withholding the GitHub that is the whole point
of being found.

So: a row per platform the member has actually filled in, each with its own toggle, default off.

```
  GitHub      github.com/alice          [x] include when I am counted or found
  Mastodon    hachyderm.io/@alice       [ ]
  Instagram   instagram.com/alice       [ ]
```

An empty platform shows no toggle, because a control over nothing is noise.

**Storage.** This is the one piece needing new schema. A small additive table matching the normalized
pattern already in use:

```ts
export const userSharedLinks = pgTable('user_shared_links', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.platform] })]);
```

Row present means shared. The directory join and the link-presence aggregate both intersect against
it. Absent rows mean not shared, so the default is off by construction rather than by a default value
somebody can change.

**Cheaper v1 if you want this contained:** keep link sharing all-or-nothing inside the purpose, ship
per-platform later. The table is small enough that I would just do it, but it is the only part of this
plan that touches the database.

### 4.3 On Privacy: the dashboard, unchanged in shape

It already does the right job and needs only to gain the link summary:

- one card per offerable purpose, default off, off-state described first
- recipients named inline with their relationship and policy link
- **who has looked at you**, from `disclosure_events`
- consent history
- profile visibility

---

## 5. Operator versus external: the two audiences

The operator asked for analytics on everything internally, while gating what external key holders see.
That is a reasonable line and mostly already built, but it has one consequence that must be handled
first.

### 5.1 The line

| Audience | Auth | Sees |
|---|---|---|
| **Operator** | session + `audit.read` | Their own members. Unsuppressed counts, and filtering over their own member list. |
| **External** | API key, `read:audience` | Consent-gated, k-anonymous aggregates only |
| **External** | API key, `read:members`, bound to a named recipient | Consent-gated member list, every read logged and shown to the member |

**Why unsuppressed operator counts are defensible.** The operator is the data controller, the answers
are already on each member's public profile, and the operator can run SQL against their own database
whenever they like. k-anonymity on their own dashboard prevents bulk convenience, not access. The
control that matters is on what *leaves*, and that is the directory's per-disclosure log.

### 5.2 The consequence, and it is load-bearing

The current `profile_analytics` copy says:

> "Your name is never attached and **nothing about you leaves this site**."

If the operator dashboard shows individuals, "your name is never attached" stops being true for that
view, and the member agreed to a sentence that no longer describes the system. That is precisely the
failure the scope digest exists to catch.

**So the copy has to change before the behaviour does.** Something like:

> Your answers are counted in group totals. Site administrators can already see your profile, so they
> can see your answers; what this controls is whether you are counted in statistics and whether people
> outside this site can find you by them.

**Do it now, while it is free.** Changing purpose copy moves the scope digest and invalidates every
existing grant, forcing everyone to re-confirm. Today that costs nothing: all four flags are off on all
three instances and **not one person has ever granted anything in production**. After the first real
consent, the same correction costs every member a re-confirmation prompt. This is the single most
time-sensitive item in this plan.

### 5.3 Verification signals

`PersonaLinkPlatformSpec.authenticitySignal` already exists, so "a linked GitHub suggests a real
person" is a registry fact rather than a hardcoded list in a query. Verification is a *derived view*
of links, not a new data type: no schema, just a column in the operator's member view and optionally a
filter on the directory. Worth doing after the rest lands.

---

## 6. What is safest

Ordered by risk, lowest first. Each phase is shippable and reversible.

| Phase | Change | Risk | Why it is safe |
|---|---|---|---|
| **0** | Fix the `profile_analytics` copy | none today, high later | No grants exist. Costs nothing now, costs everyone a re-prompt after the first consent. **Do this first even if nothing else happens.** |
| **1** | Merge the pages: nested nav, delete duplicated inputs | low | No data migration; the `column:` bridge already guarantees one storage. Purely a UI move. |
| **2** | Status line + toggle at the top of Questions | low | New copy and one existing endpoint. The anti-bundling test still passes. |
| **3** | Per-platform link sharing | medium | The only database change. Additive table, absent-means-off, cascades on delete. |
| **4** | Operator unsuppressed view | medium | Only after phase 0. Needs the member copy to already be honest. |
| **5** | Verification signals in the operator view and directory filters | low | Derived from data that already exists |

**What not to do, and why:**

- **Do not add a public "open to work" badge.** LinkedIn's public badge is visible to your current
  boss and colleagues, which is the tradeoff people agonise over, and its private "Recruiters only"
  mode is candidly described as psychological safety rather than real privacy. The existing design
  already decided against a badge; that decision is right and this is the evidence for it.
- **Do not promise more privacy than the architecture delivers.** LinkedIn states plainly that it
  cannot guarantee the private setting stays private. Our equivalent honest sentence already exists on
  the disclosure list: *"It cannot recall what was already shared."* Keep that register.
- **Do not gate the profile fields.** They are published by intent. A toggle over them implies they
  were private, which is worse than no toggle: it misleads.
- **Do not move any data.** Every step above is UI, copy, or one additive table.

---

## 7. Open decisions for the operator

| # | Question | Recommendation |
|---|---|---|
| 1 | Does `skills` (free text, uncountable) survive alongside `tech_stack` (closed vocabulary, countable)? | **Keep both, relabel.** Free text is the escape hatch for a stack nobody has added to the vocabulary; the closed list is what makes counting honest. Label them "What I work with" and "Tech stack" and put them adjacent so the difference is visible. |
| 2 | What does the Questions tab get called? | Operator-configurable, defaulting to "About you". Anything containing "profile" invites the confusion we are removing. |
| 3 | Per-platform link sharing in v1, or all-or-nothing? | **Per-platform.** GitHub versus Instagram is the case that justifies the extra table. |
| 4 | Should the operator's member view be filterable by answer? | Yes, but log it the same way external disclosures are logged. An operator browsing is fine; an operator exporting should leave a trace. |
| 5 | Does the member see the operator's view in "who has looked"? | **Recommend yes.** If the answer is no, the copy must not imply otherwise. |

---

## 8. What this plan does not change

The consent machinery, the scope digest, the k-anonymity floors, the disclosure log, the isolation
between the directory and the aggregate modules, and the storage partition. All of that is built,
tested and correct. This plan is about making the interface tell the truth that the data layer already
enforces.

---

# Revision 2: the model corrected

**This section supersedes sections 0, 2 and 4 above.** The operator corrected two assumptions that
were baked into the shipped code as well as into revision 1, and the corrected model is both simpler
and more defensible. Sections 1, 3, 5, 6 and 7 survive largely intact.

## R2.1 What revision 1 got wrong

**Wrong assumption 1: that persona answers are public.** They are, today — the default is public and
`publicOnProfile === false` is the only exclusion, so every answer renders on `/u/:username` unless
the operator opts a field out. That is backwards. Persona questions are **questions the operator asks
a member**, not profile content. Making them public by default is what made "do you want to share
this?" feel like theatre: the honest answer was "you already are".

**Wrong assumption 2: that being counted needs consent.** The operator's position is better: the
instance holds the aggregate numbers regardless, because they are anonymous counts over its own
members. What a member actually decides is **whether their name appears to third parties**.

Asking for consent you would not honour a refusal of is worse than not asking. If the operator will
compute instance statistics either way, dressing that as a consent toggle is a dark pattern with good
intentions.

## R2.2 The corrected model

| Layer | Visible to | Basis | Member control |
|---|---|---|---|
| **Profile** | everyone | published by intent | none needed |
| **Questions** | **the member and the operator only, by default** | operator asks, member answers | fill in or do not; per-field profile visibility if the operator offers it |
| **Instance statistics** | the operator | legitimate interest, disclosed | an objection switch (see R2.5) |
| **Third-party exposure** | named recipients | **consent, default off** | **the one real toggle** |

The single member-facing question becomes one sentence:

> **Do you want third parties to be able to find you by these answers?**
> Recruiters, sponsors and partners the operator has named. Off unless you turn it on.

One question instead of three fuzzy ones.

## R2.3 The case that proves the model: an instance doing none of this

The operator's sharpest point. A makerspace might ask "which tools are you trained on", "do you have
a key fob", "what is your emergency contact preference". Operational questions. No recruitment, no
sponsors, no analytics ambitions at all.

Under revision 1 that operator got a feature framed around statistics, a public render they did not
want, and a consent page asking members about sharing that never happens. Under the corrected model
they get exactly what they asked for: **custom questions, private answers, no sharing UI anywhere.**

The flags already support this and nothing needs restructuring:

- `persona` alone: questions, private answers, optional per-field profile visibility. **No sharing
  language appears anywhere.**
- `+ dataSharingConsents` and a declared recipient: the third-party question appears.
- `+ personaAnalytics`: the external aggregate API.

The defaults and the copy are what push everyone toward the analytics framing, not the architecture.

## R2.4 Concrete changes to what shipped

| # | Change | Why |
|---|---|---|
| 1 | **Invert the profile-visibility default.** `publicOnProfile` becomes `showOnProfile`, default **false**. The operator opts a field IN. | Answers are private by default. This is the load-bearing change and it inverts a shipped default, so it must happen before any instance turns `persona` on. |
| 2 | **Retire `profile_analytics` as a consent purpose.** Instance statistics move to legitimate interest, disclosed on `/privacy`, with an objection switch. | Do not ask for consent you would process without. |
| 3 | **Reframe the remaining purposes** as one shape: named third-party exposure. `recruiter_visibility`, `sponsor_sharing`, and room for a devrel or partner purpose. | This is the only decision a member actually makes. |
| 4 | **Drop the double consent join** on `/persona/audience`. It existed only because `profile_analytics` was the purpose whose copy mentioned counting. | Falls out of change 2. |
| 5 | **Gate all sharing copy behind the sharing flags.** With `persona` alone, the Questions tab says nothing about statistics, recruiters or sharing. | The makerspace case. |
| 6 | **Rewrite the purpose copy** to describe named exposure rather than counting. | The current copy promises "nothing about you leaves this site", which is exactly backwards for a purpose whose entire function is that something does. |

**Every one of these is free right now and expensive later.** All four flags are off on all three
instances and nobody has consented to anything in production. Change 1 inverts a default, change 2
removes a purpose, and change 6 moves the scope digest; after the first real consent each of those
costs every member a re-confirmation.

## R2.5 The honest complement to legitimate interest

If instance statistics run on legitimate interest rather than consent, the member gets an **objection
right** (GDPR Art 21) instead of an opt-in. That is not a downgrade if it is offered plainly:

> **Community statistics.** This site counts answers into group totals to understand its community.
> No individual is identified and totals only appear once several people give the same answer.
> `[ Leave me out of statistics entirely ]`

Offering that switch is what makes the legitimate-interest basis defensible rather than convenient.
The mechanism already exists: a member excluded from statistics is one whose rows the aggregate query
skips, which is the same shape as the consent join, just inverted.

**Confirm the basis with counsel.** The reasoning is sound and standard, and truly anonymised
aggregate output (k-anonymised, quantised, suppressed, all built) falls outside GDPR's scope
entirely, but the choice of lawful basis for the processing that produces it is the operator's to
make on advice.

## R2.6 Revised sequencing

| Phase | Change | Risk | Note |
|---|---|---|---|
| **0** | Invert `showOnProfile` to default false; gate sharing copy behind sharing flags | low, **urgent** | Inverts a shipped default. Trivial today, a member-visible surprise once anyone has answered. |
| **1** | Retire `profile_analytics`, reframe the remaining purposes, rewrite the copy, add the objection switch | low, **urgent** | Moves the scope digest. Free while zero grants exist. |
| **2** | Merge the pages, nested nav, delete duplicated inputs | low | Unchanged from revision 1. No data migration. |
| **3** | Per-platform link sharing | medium | Unchanged. The only schema addition. |
| **4** | Operator unsuppressed view and member filtering | medium | Now much simpler: no consent promise stands in the way once the copy describes third-party exposure rather than counting. |
| **5** | Verification signals | low | Unchanged. |

Phases 0 and 1 are the ones that get harder with every day the flags stay off but the code sits
shipped. They are also the two smallest.

## R2.7 What this does not change

The storage partition, `personaFieldSink`, the k-anonymity floors, the disclosure log, the
directory-versus-aggregate module isolation, and the per-recipient key binding all stand. k-anonymity
simply changes job: it stops being what protects members from being counted and becomes what makes the
external aggregate output genuinely anonymous. That is a better fit for what it actually does.

---

# Revision 3: implementation spec

Decisions pinned so no implementer has to guess. Facts below were verified in the tree, not assumed.
**Migration number is 0048** (0047 is the last applied).

## R3.1 Decisions, with the reasoning that fixes them

| # | Decision | Why this and not the alternative |
|---|---|---|
| D1 | `publicOnProfile` becomes **`showOnProfile`, default false** | A rename forces every call site to be revisited rather than silently inheriting a flipped default. `publicOnProfile: false` and `showOnProfile: undefined` mean the same thing but read oppositely; keeping the old name would leave a landmine. |
| D2 | **No built-in section sets `showOnProfile: true`** | Questions are private until an operator decides otherwise. The guide will say `showOnProfile: true` on interests and tech stack is the common choice, but it is a choice. |
| D3 | Purposes become exactly **`recruiter_visibility`** and **`sponsor_sharing`**. `profile_analytics` is **removed**. | Do not invent a `devrel_analytics` purpose for a recipient nobody has declared. Adding a purpose is one registry entry; speculating is cruft. R3.6 records how to add one. |
| D4 | Instance statistics run on **legitimate interest with an objection switch**, not consent | Asking consent for processing that happens regardless is a dark pattern. The objection right is what makes the basis defensible. |
| D5 | Objection storage is a table, **not** a `user_purpose_consents` row with `state: 'objected'` | Consent and objection are different legal instruments with different lifecycles. Conflating them would make the consent history unreadable and the digest meaningless. |
| D6 | Per-platform link sharing is **row-present-means-shared** | Default off by construction rather than by a default value somebody can later change. |
| D7 | `/settings/profile` becomes a **parent route with `<NuxtPage/>`** and children; `/settings/profile` redirects to `/settings/profile/basics` | `pages/settings/profile.vue` already exists as a leaf, so Nuxt turns it into the parent layout for free. No route breaks. |
| D8 | `/settings/persona` **redirects** to `/settings/profile/questions` | Old links, the invitation banner and the e2e specs all point at it. A redirect costs one file; a rename breaks all three. |

## R3.2 Migration 0048, additive only

```ts
// packages/schema/src/persona.ts (appended)

/** Row present means the member has objected to being counted (GDPR Art 21).
 *  Absent means no objection. Statistics exclude anyone with a row. */
export const userStatisticsObjections = pgTable('user_statistics_objections', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  objectedAt: timestamp('objected_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Row present means the member shares this link platform with named recipients.
 *  Absent means not shared, so the default is off by construction. */
export const userSharedLinks = pgTable('user_shared_links', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.platform] })]);
```

No alter of any existing table.

## R3.3 The aggregate query changes shape

`packages/server/src/persona/metrics.ts` has **six** consent-join sites. All of them change from
"INNER JOIN a current, digest-matching grant" to "exclude anyone who has objected":

```sql
-- was: JOIN user_purpose_consents c ON ... c.scope_digest = $digest
LEFT JOIN user_statistics_objections o ON o.user_id = u.id
WHERE o.user_id IS NULL
  AND u.deleted_at IS NULL AND u.status = 'active' AND u.profile_visibility = 'public'
```

Three things must survive that change, and each keeps its test:

1. **k-anonymity is unchanged and now load-bearing for a different reason.** It stops being what
   protects a member from being counted and becomes what makes the published output genuinely
   anonymous. Floors, flooring and whole-field suppression all stay exactly as they are.
2. **The free-text table is still never imported** by this module.
3. **The directory is unaffected.** `directory.ts` keeps its consent INNER JOIN with the scope digest
   bound in the join condition, because naming a member to a third party is still consent.

## R3.4 Files, by phase

**Phase 0 — visibility default**
`packages/persona/src/persona.ts` (rename, default), `schemas.ts` (Zod), the built-ins (D2),
`layers/base/server/api/users/[username]/persona.get.ts` (`showOnProfile !== true`),
`apps/reference/commonpub.config.ts` (commented example), `docs/reference/guides/persona-schema.md`.

**Phase 1 — purposes and objection**
`packages/persona/src/purposes.ts` (remove `profile_analytics`, rewrite both remaining copies),
`packages/server/src/persona/consent.ts` (offered set, scope), `metrics.ts` (R3.3),
`layers/base/server/api/consent/*` , `layers/base/pages/settings/privacy.vue`,
`layers/base/pages/privacy.vue`. New: an objection endpoint.

**Phase 2 — nav merge**
`layers/base/pages/settings.vue` (nested), `pages/settings/profile.vue` (becomes parent),
new `profile/basics.vue`, `profile/links.vue`, `profile/experience.vue`, `profile/questions.vue`,
`pages/settings/persona.vue` (becomes a redirect).

**Phase 3 — per-platform links**
`user_shared_links` writes, the Links tab UI, `directory.ts` and the link-presence aggregate
intersecting it.

**Phase 4 — operator view**
`layers/base/server/api/admin/persona-metrics.get.ts` and its page: unsuppressed counts over the
operator's own members, because they are the controller and every answer is already reachable one at a
time.

## R3.5 Cruft rules for this change

This revises shipped code. The failure mode is leaving the old concept half-present.

- **No compatibility shims.** `publicOnProfile` and `profile_analytics` are deleted, not deprecated.
  Nothing in production has consented and no instance has the flag on, so there is nothing to be
  compatible with. A shim here would outlive its reason.
- **Delete the duplicated Profile inputs.** The merge is not finished while two editors exist.
- **Every removed concept must leave no orphan**: no dead copy strings, no unused registry entries, no
  tests asserting the old shape, no doc paragraph describing it. Grep for each removed identifier and
  confirm zero hits outside the migration.
- **Verify contracts before writing against them.** Earlier rounds lost time to agents coding against
  an assumed response shape. Read the route, then write the caller.

## R3.6 Adding a third purpose later

One entry in `PROCESSING_PURPOSES`, one in `PROCESSING_PURPOSE_SPECS` with its copy, one id in the
recipient's `purposes`, and it appears. No schema, no migration. That is why speculating one now would
be cruft rather than foresight.
