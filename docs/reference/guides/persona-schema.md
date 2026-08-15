# Persona schema

> The questions your instance asks its members, who can see the answers, and what leaves the site.
> Written for an operator configuring an instance. For why the code is laid out the way it is, see
> [ADR 030](../../adr/030-persona-package-boundary.md).

**Source**: `packages/persona/src/` (types, registry, caps, Zod), `packages/server/src/persona/` (resolution, values, consent, metrics), `apps/reference/commonpub.config.ts` (the worked example)

**Flags**: `persona` turns the member and admin surfaces on: your own questions, private answers, and the per-field option to publish one. `dataSharingConsents` adds the third-party sharing question on `/settings/privacy`. `personaAnalytics` adds the public audience API. All three default OFF, because turning them on starts collecting personal data that was not collected before.

**This guide describes the corrected model**, set out in `docs/plans/profile-persona-information-architecture.md`, revisions 2 and 3. Two things changed after the first release and before any instance switched a flag on. Answers are **private by default**; they used to render on the public profile unless a field opted out. And being counted in instance statistics is **not a consent question** any more. Anything you read elsewhere that says otherwise, including revision 1 of that plan, is describing a model that no longer exists.

---

## Contents

1. [The instance that shares nothing](#the-instance-that-shares-nothing)
2. [The three layers](#the-three-layers)
3. [Visibility: answers are private until a field opts in](#visibility-answers-are-private-until-a-field-opts-in)
4. [The two places a schema can live](#the-two-places-a-schema-can-live)
5. [Precedence, and why it is whole-document](#precedence-and-why-it-is-whole-document)
6. [The rules that actually bite](#the-rules-that-actually-bite)
7. [Field properties](#field-properties)
8. [What can be counted and what cannot](#what-can-be-counted-and-what-cannot)
9. [Drift, Purge and Retain](#drift-purge-and-retain)
10. [Instance statistics, and the objection switch](#instance-statistics-and-the-objection-switch)
11. [Why a small instance sees an empty dashboard](#why-a-small-instance-sees-an-empty-dashboard)
12. [Third-party sharing: the one consent](#third-party-sharing-the-one-consent)
13. [Key files](#key-files)

---

## The instance that shares nothing

Start here, because it is the case most operators are in.

Turn `persona` on, leave `dataSharingConsents` and `personaAnalytics` off, and you have a question engine. Your own sections and fields, answers that only the member and your administrators can see, and **no sharing language anywhere**: no statistics copy, no recruiters, no sponsors, no consent toggles, nothing telling a member that something leaves the site. Nothing does.

A makerspace asking which tools a member is trained on, whether they hold a key fob, and how they would rather be reached in an emergency is asking operational questions. There is no audience to publish and no cohort to sell. That instance should never see a word about any of it, and with the two sharing flags off it does not.

The other two flags are additive on top:

- **`dataSharingConsents`** adds the one consent question, whether named third parties may find this member by their answers, plus the recipient disclosure that makes the question answerable. Doubly inert without a declared recipient covering the purpose: nothing is offered, so nobody is asked.
- **`personaAnalytics`** adds the public aggregate API (`/api/public/v1/metrics/persona/*`), the only surface that publishes numbers off the instance. As shipped, those endpoints demand `dataSharingConsents` as well; that gate was justified by counts being consent-derived, which they no longer are, and the plan does not say whether it stays. Check `docs/public-api.md` against the running instance before you promise a key holder anything.

## The three layers

| Layer | Who sees it | Legal basis | What the member controls |
|---|---|---|---|
| **Profile** | everyone | published by intent | nothing, and nothing should pretend otherwise. They typed it in so people would read it. |
| **Questions** | the member and your administrators | the operator asks, the member answers | whether to answer. Per-field publication if you offer it. |
| **Instance statistics** | you, the operator | legitimate interest, disclosed | an objection switch, not an opt-in |
| **Named third parties** | the recipients you declare | **consent, default off** | **the one real toggle** |

The sentence that holds it together, and the one the first release never managed to say:

> A profile is public because that is what a profile is. The answers to your questions are not, unless a
> field says so. The only thing a member is asked to agree to is whether people outside this site may
> find them by those answers.

## Visibility: answers are private until a field opts in

`GET /api/users/:username/persona` returns a field only when that field declares `showOnProfile: true`. Absent, or `false`, means not returned. There is no way to publish an answer by accident.

**No built-in field opts in.** A default instance, running the built-in sections (Basics, Interests, Tech stack, Links), publishes no persona answers at all. That is deliberate: the built-ins are the path every operator gets without deciding anything, and an undeclared decision should not publish somebody's data.

**Marking interests and tech stack visible is the common choice, and it is a choice.** They read like profile content, members generally expect them to show, and an instance built around discovering what other people are into probably wants them public. Write `showOnProfile: true` on those two fields and they render. Nothing else changes.

**An operational question should usually stay private.** "Which tools are you trained on" is a question you ask so you can run the space. It is not something the wider internet asked, and publishing it turns your member roster into a skills index you never intended to hand out. Leave it alone and it stays where it belongs.

Three kinds of field ignore `showOnProfile` entirely, and knowing which saves an argument later:

| Field | On the public persona route? | Why |
|---|---|---|
| `sensitive: true` | **never**, whatever `showOnProfile` says | It is the Art. 9 hatch. A special-category answer does not get published by a config typo. |
| `column`-bound | never | The answer lives on the `users` row and the profile hero already renders it. Returning it would print it twice. |
| `link` | never | It writes to `users.social_links`, the same column `/settings/profile` writes. Link publication is the profile's business, not persona's. |

One thing this control does **not** do, and the copy must not imply it does: it does not hide answers from you. Administrators can read what members answered, because you hold the database and the answers are yours to act on. `showOnProfile` governs the public route. If your member-facing copy suggests staff cannot see an answer, the copy is wrong.

## The two places a schema can live

Omit the `persona` key from `commonpub.config.ts` entirely and every instance gets the four built-in sections: Basics, Interests, Tech stack, Links. Most operators should start there and change nothing.

**In the config file**, committable to git, reviewable in a pull request, and deployed with the app:

```ts
export default defineCommonPubConfig({
  features: { persona: true, dataSharingConsents: true, personaAnalytics: true },
  persona: {
    sections: [
      {
        key: 'workshop',
        label: 'Your workshop',
        help: 'None of this is required, and none of it is shared unless you say so.',
        order: 4,
        fields: [
          {
            // A COUNTED field: closed vocabulary, so it can become a cohort.
            // Answers are PRIVATE by default. This one opts in to the public
            // profile, which is a choice, not a formality.
            key: 'workshop_space',
            label: 'Where do you build?',
            type: 'select',
            showOnProfile: true,
            options: [
              { value: 'home', label: 'At home' },
              { value: 'makerspace', label: 'A makerspace' },
              { value: 'work', label: 'At work' },
            ],
          },
          {
            // NEVER counted, and never on the public profile: `sensitive` is the
            // Art. 9 hatch, so it overrides `showOnProfile` even if somebody sets
            // it. No visibility flag needed here, private is already the default.
            // Note the closed vocabulary is still enforced.
            key: 'accessibility_needs',
            label: 'Anything we should know to make events work for you?',
            type: 'select',
            sensitive: true,
            options: [
              { value: 'step_free', label: 'Step-free access' },
              { value: 'quiet', label: 'A quiet space' },
              { value: 'other', label: 'Something else, I will get in touch' },
            ],
          },
          {
            // Collected, private like everything else, and deliberately kept out
            // of statistics.
            key: 'shop_notes',
            label: 'What is on your bench right now?',
            type: 'textarea',
            maxLength: 500,
            analytics: false,
          },
          {
            // An OPERATOR-DECLARED platform, which needs the entry below.
            key: 'link_gitlab',
            label: 'GitLab',
            type: 'link',
            platform: 'gitlab',
          },
        ],
      },
    ],
    linkPlatforms: [
      {
        key: 'gitlab',
        label: 'GitLab',
        // An EMPTY list means any http(s) host, which is what a self-hosted or
        // federated platform needs. Every other entry should name its hosts.
        hostSuffixes: ['gitlab.com'],
        placeholder: 'https://gitlab.com/yourname',
        // A registry FACT, decided once where the platform is named: is a link
        // here evidence the account is really theirs?
        authenticitySignal: true,
      },
    ],
    completeness: 'progress',
    firstRun: 'offer',
  },
});
```

That block is copied from `apps/reference/commonpub.config.ts`, where it ships commented out. Uncomment it to see the whole thing work locally.

A malformed `persona` key is a parse error with a path, reported on `/admin/persona`, not a silent fall back to the built-ins.

**In the admin editor**, at `/admin/persona`, which needs `settings.manage`. It saves the whole document into `instance_settings['persona.sections']` and shows which source is live. The editor validates the draft against the same Zod schema the server enforces, so a choice field with a blank option is flagged inline rather than 400ing after you press Save.

Two things behave differently between the two:

- **Machine keys are locked in the editor.** Once the server has persisted a key, the label can be renamed freely and the key cannot. The advanced unlock names the count it is about to discard. The config file has no such protection, which is what the drift reconciler exists for.
- **`linkPlatforms` merges; `sections` does not.** The effective platform set is the seven built-ins, then the file, then the database, deduped by key with the built-in always winning, so an operator cannot redefine `github` to point at a host they control.

`dataSharing` (recipients and the k-anonymity floors) is **file only**. There is no runtime override route for it in this release.

## Precedence, and why it is whole-document

```
database override  >  commonpub.config.ts  >  built-in sections
```

Declaring `persona.sections` **replaces** the built-ins wholesale. Saving in `/admin/persona` **replaces** the file wholesale. There is never a key-by-key merge in either direction.

That is deliberate. Merging key by key means an operator deletes a section in git, deploys, and the database resurrects it, with no screen anywhere that explains why. `PUT /api/admin/features` merges and never removes, which is exactly the trap: a flag touched once through the portal can never be won back by the git file. Persona does not repeat it.

The way back is one click. `/admin/persona` shows a persistent banner whenever a database override is live, and **Revert** deletes the override so the file (or the built-ins) governs again. Saves carry `If-Match` on the override timestamp, so two admins editing at once get a 409 rather than one silently overwriting the other.

Sections render in `order` (0 to 999, default 500, ties keep declaration order). The sort happens once, where the schema resolves, so every surface agrees.

The resolved schema is cached for 60 seconds per database and invalidated by every writer in the persona module. Writing `persona.sections` through the generic `PUT /api/admin/settings` route bypasses that invalidation and every guard below, so do not do it; the reader re-validates and drops anything malformed, but the dedicated route is the supported path.

## The rules that actually bite

| Rule | Detail |
|---|---|
| A field `key` is `^[a-z0-9_]+$`, max 40 | Lowercase, digits and underscore. No dashes, no capitals. |
| Field keys are unique across **every** section, not per section | `user_persona_answers.field_key` is one global namespace. Two fields sharing a key would silently share every member's answers and one analytics bucket. |
| Keys are **immutable once answers exist** | Renaming a key in the config file does not migrate anything. It orphans every member's rows for that field: nobody can see, correct or erase what they answered, and the cohort drops to zero in analytics with no error anywhere. The admin editor locks the key; the config file cannot, so a rename surfaces as `missing_field` drift instead. |
| An option `value` is `^[a-z0-9_]+$`, max 64, and must be unique within its field | The value is what is stored. Relabelling an option never rewrites user data, so change `label` freely and treat `value` as permanent. |
| Section keys follow the same alphabet and must be unique | |
| 12 sections, 24 fields per section, 300 fields per template | |
| 120 countable buckets per template | One bucket per option of each counted field, plus one for each counted checkbox. It bounds both the rollup cost and how finely the population can be sliced. |
| 64 options per field, 24 link platforms, 50 data recipients | |
| A `link` field must name a declared platform | The built-in seven are `github`, `twitter`, `linkedin`, `youtube`, `instagram`, `mastodon`, `discord`. Anything else needs a `linkPlatforms` entry. A link field naming an undeclared platform is a 400 on save, not a warning: it would write nowhere. |
| Two fields cannot bind the same `column` | One column holds one answer, so the second question would clear the first and completeness would double count it. |
| `sensitive`, `analytics: false` and `column` are all refused on a `multiselect` | All three route the field to a store that holds ONE value, so the member would tick three chips and get back "takes a single value", naming a constraint no UI expressed. The config parse refuses the declaration at boot instead. |

A save that would discard stored answers is refused with a 409 that names the row counts. Changing a field's `type`, `column`, `sensitive` or storage destination, or dropping an option members have chosen, needs `?force=true` (logged as `cpub.audit.persona.schema.force-save`). Dropping a field entirely needs an explicit Purge or Retain decision, which `force` never waives.

## Field properties

| Property | What it does |
|---|---|
| `key` | The stored identifier and the analytics namespace. See above. |
| `label` | What the member reads. Max 120. Safe to change at any time. |
| `type` | See [the next section](#what-can-be-counted-and-what-cannot). |
| `help` | Hint under the input. Max 300. |
| `maxLength` | 1 to 2000. Accepted only by `text`, `textarea` and `url`. Not by `number` or `date`. |
| `options` | `{ value, label }` pairs for `select`, `radio` and `multiselect`. Required for those, refused for everything else. |
| `maxSelections` | `multiselect` only, 1 to 64. |
| `points`, `pointsPerSelection` | Optional completeness weights. They never unlock anything, and the completeness figure takes no consent input of any kind, so a member's progress cannot move when they flip a sharing toggle. |
| `analytics: false` | Moves the field into the free-text store. It is **silently removed from every count**, permanently, with no other visible change. Use it for a question you want to collect but never aggregate. |
| `sensitive: true` | The Art. 9 escape hatch, for special-category data. Does everything `analytics: false` does, and additionally **never** appears on the public profile route, whatever `showOnProfile` says. The closed vocabulary of a `select` is still enforced. |
| `showOnProfile: true` | Opts this one field in to `GET /api/users/:username/persona`. **The default is private**: a field that does not declare it is not returned, and no built-in field declares it. This is the only way an answer becomes public. |
| `column` | Binds the field to an existing `users` column: `displayName`, `headline`, `location`, `pronouns`, `bio`. The answer is written to the profile row and **nothing is stored in the persona tables**, so today's profile becomes section one of the persona schema rather than a parallel system. Column-bound fields are not returned by the public persona route, because the profile hero already renders them and they would print twice. |
| `platform` | `link` fields only. Names a declared link platform. |

Two consequences worth stating plainly. First, `sensitive: true` and `analytics: false` are not reversible in effect: flipping either one back does not move answers already written to the free-text store, and the mismatch surfaces as `sink_changed` drift. Second, a `link` field writes to `users.social_links`, the same column `/settings/profile` writes, so link answers are not persona-owned storage and are deliberately not repeated on the public persona route. An operator-declared eighth platform therefore collects and shows in settings but renders on no public surface yet.

## What can be counted and what cannot

| Type | Stored in | Countable |
|---|---|---|
| `select` | `user_persona_answers` | Yes, one bucket per option |
| `radio` | `user_persona_answers` | Yes, one bucket per option |
| `checkbox` | `user_persona_answers` | Yes, exactly one bucket, "people who ticked it" (stored as `yes`) |
| `multiselect` | `user_persona_answers` | Yes, one bucket per option |
| `text` | `user_persona_text` | Never |
| `textarea` | `user_persona_text` | Never |
| `url` | `user_persona_text` | Never |
| `number` | `user_persona_text` | Never |
| `date` | `user_persona_text` | Never |
| `link` | `users.social_links` | Presence only, per platform. The address itself is never a bucket. |
| `section` | nothing | No, it is a heading |

Countability and visibility are independent. A field can be counted and private, which is the normal case, or public and never counted, which `analytics: false` gives you. Neither setting moves the other.

Two rows surprise people. **`number` and `date` are free text**: declaring "how many years have you been making?" as a `number` gets you an answer you can read and never a distribution you can publish. If you want it counted, declare it as a `select` over bands. And a field bound to a `column` is never counted either, whatever its type, because its answer lives on the `users` row.

Free text is never aggregated, and that is structural rather than a policy setting: the registry marks every free-text type `aggregatable: false` and the write path routes it to a different table. An open-ended answer is written in the member's own words, so a "count" over it is a list of quotes, and one sentence is very often enough to identify who wrote it. A closed vocabulary is what makes a count a count.

## Drift, Purge and Retain

**Drift** is the reconciler's name for "the schema and what members actually stored disagree". It exists because a config-file edit bypasses every admin-route guard: git does not know how many answers a field has. Four kinds:

| Kind | Cause |
|---|---|
| `missing_field` | A key with stored answers is no longer in the schema. Usually a rename. |
| `sink_changed` | The field is still there but now stores its answer somewhere else, so the existing rows are in the wrong table. Usually `analytics: false` or `sensitive: true` added or removed. |
| `type_changed` | The field was one type when its answers were stored and is another now. |
| `missing_option` | Stored answers use options the field no longer offers. |

A drifted field is **excluded from every aggregate until it is acknowledged**, so a silent rename cannot quietly drop a cohort to zero while the API keeps answering. Drift is written to `audit_logs` once per distinct drift set, and an acknowledgement is bound to the facts it acknowledged, so a new problem on an already-acknowledged key asks again.

`/admin/persona` shows each one with two buttons:

- **Purge** deletes every stored answer for that field key, from both persona tables, in one transaction, with the count in `audit_logs`. The data is gone. The key is also cleared from the retired list, so re-adding the field later starts clean.
- **Retain** keeps every stored answer, records the key as retired with the date it left the schema, and records the count in `audit_logs`. Retained keys are excluded from the aggregatable list, so nothing keeps counting a question you withdrew. The answers remain readable and erasable through the member's own data export and account deletion, which is the point: retiring a question is not a reason to lose someone's Art. 15 and Art. 17 rights over what they already told you.

Bringing the key back in a later saved schema un-retires it. Counts shown anywhere on this path are floored to your k-anonymity bucket setting and read "fewer than 5" below it, because a per-option census of who chose what is exactly the distribution the metrics module refuses to publish.

## Instance statistics, and the objection switch

Your instance counts answers into group totals. That is your own processing, over your own members, producing numbers with no name attached, and it runs on **legitimate interest**, disclosed on `/privacy`. It is not a consent question. You would compute those totals either way, and asking for permission you would not honour a refusal of is a dark pattern with good intentions.

What a member gets instead is the objection right (GDPR Art. 21), offered as one plain switch:

> **Community statistics.** This site counts answers into group totals to understand its community.
> No individual is identified and totals only appear once several people give the same answer.
> `[ Leave me out of statistics entirely ]`

Offering that switch is what makes the basis defensible rather than merely convenient. An objection is a row in `user_statistics_objections`, one per member: **row present means excluded, absent means no objection**. Nothing has to be backfilled and no default can drift. Every aggregate query left-joins that table and drops anyone holding a row, on top of the conditions that were already there: the member is active, not deleted, and their profile is public.

Three consequences worth stating.

**Consent grants no longer feed the counts.** No consent purpose covers being counted, and there is no consent join anywhere in the aggregate path. The digest-bound consent join survives in exactly one place, the member directory, because naming a member to a third party is still consent.

**k-anonymity did not change, but its job did.** It used to sit behind consent as a second line. Now it is the entire reason the published output is anonymous: the floors, the downward flooring and the whole-field suppression are what stand between a bucket and a person. Treat the defaults as a floor, not a target.

**Confirm the lawful basis with counsel.** The reasoning is standard, and genuinely anonymised aggregate output falls outside GDPR's scope anyway, but the basis for the processing that produces it is yours to choose on advice.

An instance that computes no statistics says none of this. The copy lives in one place and the surface that renders it checks the flag first, so the operational-questions-only instance from the top of this guide never mentions group totals, and never offers an objection to processing it does not do.

**Not settled by the plan**, so check your running instance rather than assuming: exactly which flag that rendering check reads, and whether a finalised day keeps its `scope_changed` guard now that the copy governing that digest is not the copy behind the counts. Revision 3 left both open.

## Why a small instance sees an empty dashboard

This is the most common "is it broken?" report, and it is the feature working.

Two floors, both defined in `@commonpub/persona` and both **minimums, not values**. An operator can raise them in `dataSharing` and cannot dial them below:

- `minBucket`, default and hard floor **5**. A published bucket must contain at least this many people. A bucket of 3 on a 40 person instance re-identifies.
- `minPopulation`, default and hard floor **25**. Below this many counted members the whole audience surface stays dark and reports `insufficient_population`. Repeated single-field marginals across 18 interests and 16 stack entries narrow membership by intersection even when every individual bucket clears the bucket floor, so this is a separate defence rather than a duplicate of the first.

On top of the floors:

- Published counts are **floored to a multiple of `minBucket`**, so a bucket of 12 publishes as 10. Rounded down, never up.
- A scalar field (`select`, `radio`, `checkbox`) with **any** withheld bucket withholds the entire field, reported as `insufficient_bucket_diversity`. A partial list plus a total is a differencing oracle.
- Only members whose profile is **public** are counted, and anyone who has objected is excluded.
- Public endpoints serve a **finalised UTC day** from the rollup, never a live count, so nobody can watch the exact moment a bucket crosses the floor. Before the first rollup runs they report `no_snapshot_yet`. `/admin/persona-metrics` reads live, because it shows an operator their own instance rather than publishing.

So on a new instance, expect: nothing at all until 25 members are countable, then only the buckets that reach 5, and only from the day after. If you publish to key holders you do not control, raise both numbers well above the defaults.

## Third-party sharing: the one consent

With `dataSharingConsents` on, `/settings/privacy` puts one kind of decision to the member, and it is the only one they are asked to agree to:

> **Do you want third parties to be able to find you by these answers?**
> Recruiters, sponsors and partners this site has named. Off unless you turn it on.

Two purposes are registered: **`recruiter_visibility`** and **`sponsor_sharing`**. Both describe named exposure. There is no `profile_analytics` purpose; it was removed with the model it belonged to, so if you find it named in an older document or an older config, that document is stale.

Every toggle is off until the member turns it on, each one states in plain language what turning it on does, and refusing costs the member nothing anywhere else in the product. A purpose with no covering recipient is **not offered**, and the member-facing screen says so out loud rather than leaving somebody to guess whether it was never built or is quietly on.

Recipients are declared in `dataSharing.recipients`, file only, up to 50. Each needs an `id`, a `name`, a `privacyPolicyUrl` (you cannot disclose to a party with no policy to link), the `purposes` it covers, and a `relationship`. A `joint_controller` or `independent_controller` also needs an `agreementRef`, and a purpose whose recipient is an unpapered non-processor is refused: you cannot switch the choice on before papering the transfer.

Changing `policyVersion`, the recipient list, or the disclosure copy moves the **consent scope digest**, and every existing grant stops authorising anything until each member confirms again. That is the mechanism that stops a member's old yes from covering a recipient they never read about, so treat a copy edit here as a re-consent event, not a typo fix.

Adding a third purpose later is one entry in `PROCESSING_PURPOSES`, one in `PROCESSING_PURPOSE_SPECS` with its member-facing copy, and one id in the recipient's `purposes`. No schema, no migration. That is why there is no speculative third purpose sitting in the registry waiting for a recipient nobody declared.

Member-level exposure itself, the directory a recipient actually queries, is a separate feature behind `memberDirectory`. See `docs/plans/member-visibility-directory.md`. It shares no code with the aggregate metrics above, on purpose: aggregation exists to make individuals unidentifiable, and a directory identifies individuals with their consent.

## Key files

| Path | What is in it |
|---|---|
| `packages/persona/src/fields.ts` | The field-type registry: sink, countability, what each type supports |
| `packages/persona/src/persona.ts` | `personaFieldSink`, `isPersonaFieldAggregatable`, completeness, the built-in sections and link platforms |
| `packages/persona/src/schemas.ts` | Every Zod schema and every cap |
| `packages/persona/src/thresholds.ts` | The two k-anonymity floors |
| `packages/persona/src/purposes.ts` | The purpose registry (named third-party exposure only) and the member-facing copy |
| `packages/persona/src/statistics.ts` | The legitimate-interest disclosure and the objection copy, deliberately not a purpose |
| `packages/server/src/persona/registry.ts` | Resolution, precedence, the drift reconciler, Revert |
| `packages/server/src/persona/values.ts` | Read and write, Purge and Retain |
| `packages/server/src/persona/metrics.ts` | Objection exclusion, suppression, quantisation, the rollup |
| `packages/server/src/persona/directory.ts` | The member directory, and the one surviving digest-bound consent join |
| `layers/base/pages/admin/persona.vue` | The schema editor |
| `layers/base/pages/admin/persona-metrics.vue` | The operator dashboard |
| `apps/reference/commonpub.config.ts` | The worked example, shipped commented out |
