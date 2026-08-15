# 030 — Persona package boundary

**Status**: Accepted (session 255), **amended** by the profile/persona information-architecture correction (see [Amendment](#amendment-the-consent-model-narrowed) below, and `docs/plans/profile-persona-information-architecture.md` revisions 2 and 3). Ships flag-gated behind `persona`, `dataSharingConsents` and `personaAnalytics`, all default OFF; migration 0046 is purely additive, so no behavior changes until an operator opts in.

## Context

Persona (operator-defined profile questions, purpose-scoped sharing consent, k-anonymous audience analytics) touches eight live subsystems if built naively: the contest form engine, the cookie-consent composable, the profile DTO, the public API wire shape, the API key model, the shared metrics rollup, the GDPR consent table, and the federation actor route. The plan as first written reached into all of them.

Two questions had to be settled before a line was written. Where do the pieces live, given a monorepo whose house pattern is not obvious from any one package? And how much of the existing form machinery should persona reuse, given that a contest form field and a persona field look superficially alike?

The operator's requirement was that this feature must be changeable later without breaking anything around it.

## Decision

**1. Three layers, one-way dependency, and two verified constraints decide the shape.**

```
@commonpub/persona          pure TS, zod only. No framework, no drizzle, no db.
  field/section types, PERSONA_FIELD_TYPES registry, personaFieldSink,
  completeness, purpose registry, scope digest, every Zod schema, pure predicates.
        |  imported by
        v
packages/schema/src/persona.ts    drizzle tables ONLY; imports nothing from persona
packages/server/src/persona/      registry, values, consent, metrics, schemaChange
layers/base/**                    routes, pages, components
```

The layout was not a preference. `packages/schema/drizzle.config.ts` sets `schema: './src/*.ts'`, a **non-recursive glob over that one package**, so a `pgTable` anywhere else is invisible to `drizzle-kit` and never gets a migration. And **no feature package in this repo owns a `pgTable`**: all 21 table modules are one file each in `packages/schema/src/` (`contest.ts`, `learning.ts`, `docs.ts`, `video.ts`, ...). Tables in schema is the house pattern, not a compromise for persona. `@commonpub/theme-studio` is the precedent for the pure-logic half: a brain package with no framework dependencies. `@commonpub/persona` depends on `zod` and nothing else, which is what makes it trivially testable, publishable and replaceable, and it creates **no new edge between `@commonpub/schema` and `@commonpub/config`**.

**2. Persona does NOT unify with the contest form engine, deliberately.**

Persona has no `required` (a persona is never mandatory; that is the anti-dark-pattern), no `pii` (it partitions by `personaFieldSink` instead), never calls `isFormFieldPii` or `isRequiredFormField`, and has its own renderer. What the two actually share is a list of field type NAMES and three presentational sub-components.

`FormTemplateEditor.vue` cannot be reused for the persona admin editor even if we wanted it: `FormField.required` is a **mandatory** boolean, every preset the editor emits carries it, and `personaFieldSchema` is `.strict()`, so every field that editor produces is rejected at parse time. Making it fit means changing the contest type, which is a live system running a real contest on deveco. Moving `FormField`, `isFormFieldPii` and the URL validators out of `packages/schema/src/contest.ts` to serve cosmetic unity is a large refactor of that system in exchange for nothing behavioural. Requirement "not a disparate system" is satisfied by following the house architecture, which the constraints above verify, not by physically merging two type unions.

Same reasoning, smaller: persona carries its own `fnv1a32` and its own URL predicate rather than lifting them out of `useCookieConsent.ts` and `@commonpub/schema`. Drift in the first would silently invalidate every cookie consent on all three instances; a test pins it byte-identical instead.

**3. Sharing consent is Art. 6(1)(a) processing consent, structurally separate from the ePrivacy cookie consent.**

Separate registry (`PROCESSING_PURPOSES` in `@commonpub/persona`, not `BUILTIN_COOKIES`), separate table (`user_purpose_consents`, not `user_consents`), separate digest (`purposeScopeDigest` over purposes, recipients and the copy the member was shown), and **zero new cookies**. The two are different legal instruments answering different questions, and merging them would have meant an `ALTER` on a live GDPR table to widen `user_consents.kind`, for no gain the new table does not already provide. The one sanctioned crossing is a single `BUILTIN_COOKIES` entry disclosing the invitation-banner dismissal cookie, at `category: 'essential'`, which provably cannot move the cookie digest.

**4. Persona owns its own metrics table.** `persona_metrics_daily`, not `metrics_daily`, so `runDailyRollup`'s hardcoded body is never edited and the `persona.%` back door into `/metrics/timeseries` (guarded by `read:analytics` alone) never exists to be closed.

## Consequences

- **Two field-type registries exist**, and they will keep diverging. That is intended: `PERSONA_FIELD_TYPES` is a persona-only taxonomy with its own `sink` and `aggregatable` facts, and the contest engine must never import it. A shared docblock at the head of `packages/persona/src/fields.ts` says so.
- **A second form host component exists** (`/admin/persona` alongside `FormTemplateEditor.vue`). It is 1802 lines with zero children, against the house pattern for comparable editors, and splitting it is its own change with its own visual verification.
- **The contest engine's own drift was left unfixed.** The `FormTemplateEditor` sub-component extraction is a real dedup and remains worth doing on its own merit. It is not a prerequisite for anything, and gating persona behind it would have coupled a new privacy feature to a refactor of a running contest.
- **Migration 0046 creates four tables and alters nothing.** A purely additive migration cannot break an existing reader, which is what makes the whole feature revertible by flag.
- **The boundary is enforced, not documented.** `packages/persona/src/__tests__/isolation.test.ts` asserts persona imports nothing but `zod` (with a file-count floor, so a broken path cannot pass by walking zero files), that `packages/schema/src/persona.ts` imports nothing from it, that `metricsRollup.ts` and the contest engine contain no reference to persona, and that the cookie composable's one persona line is exactly the essential cookie name. Undoing an isolation decision means deleting an assertion that states why it exists.
- **Cost of the pure package**: `purposeScopeDigest` is still 32-bit FNV-1a, because `node:crypto` is an import the isolation test forbids. It is an authorisation predicate bound into SQL and a collision fails OPEN. The parts are newline-delimited, which removes the constructible half of the problem; a SHA-256 truncation fits the existing `varchar(16)` exactly and needs the isolation rule relaxed for one hashing import.

## Amendment: the consent model narrowed

Recorded as an amendment rather than an edit to the text above, so the decision as taken and the
correction to it both stay readable. Authority: `docs/plans/profile-persona-information-architecture.md`
§R2.2, §R2.4 and §R3.1. Safe to do destructively because all four persona flags are off on all three
instances and nothing in production has ever consented, so the removed concepts are deleted rather
than deprecated (§R3.5).

Two assumptions baked into the shipped release were wrong, and one of them lands inside decision 3.

**Persona answers are private by default.** The release rendered every answer on `/u/:username` unless
a field opted out (`publicOnProfile: false`). That is inverted: `showOnProfile`, default false, and no
built-in field sets it. This changes no package boundary, but it does change what the sentence
"purpose-scoped sharing consent" is protecting. It is not protecting publication, which no longer
happens by default.

**Being counted is not a consent question.** `profile_analytics` is **removed** from
`PROCESSING_PURPOSES`. Instance statistics run on legitimate interest, disclosed, with a GDPR Art. 21
objection switch, because the instance holds those anonymous aggregates over its own members
regardless and asking for consent whose refusal would not be honoured is a dark pattern. The registry
decision 3 describes therefore now holds exactly one shape of purpose: **named third-party exposure**
(`recruiter_visibility`, `sponsor_sharing`). Adding a third is one registry entry plus one recipient
id, no schema (plan §R3.6).

**Decision 3's separation principle is extended, not weakened.** An objection is stored in its own
table (`user_statistics_objections`, row present means excluded), **not** as a `user_purpose_consents`
row carrying a state. Consent and objection are different legal instruments with different lifecycles;
folding one into the other would make the consent history unreadable and the scope digest meaningless,
which is the same argument that kept Art. 6(1)(a) processing consent out of the ePrivacy cookie table.

**Decision 4 stands unchanged.** `persona_metrics_daily` is still persona's own table. What changed is
how it gets filled: the aggregate path swaps its consent inner join for an objection exclusion, and
the digest-bound consent join survives in exactly one place, `packages/server/src/persona/directory.ts`,
because naming a member to a third party is still consent. k-anonymity is untouched and now carries
the whole weight of making the published output anonymous rather than sitting behind a consent gate.

**Nothing here moves a package boundary**, so `packages/persona/src/__tests__/isolation.test.ts`
stands as written, and migration 0046 remains the additive migration this ADR describes. The
correction adds tables; it alters none. The statistics disclosure and its objection copy land in a new
module inside the pure package, alongside `purposes.ts` rather than inside it, which is decision 3's
"different instrument, different home" rule applied one level down: a purpose registry entry carries a
scope digest and a grant lifecycle, and an objection has neither.

## What would have to be true to revisit this

- **Merge the registries** when a third consumer needs the same field taxonomy, or when persona genuinely grows `required` and `pii` semantics. One shared abstraction serving two callers with opposite requirements is worse than two.
- **Move tables out of `packages/schema`** only if `drizzle.config.ts` gains a recursive or multi-package glob AND the other 20 domains move with it. A single feature package owning a `pgTable` would make persona the exception that has to be remembered.
- **Merge the consent registries** only if the ePrivacy and Art. 6 records are ever shown to a member as one decision, which today they deliberately are not.

The opt-in member visibility directory (`docs/plans/member-visibility-directory.md`, planned) is the first real test of the boundary. It is a member-level read surface built on the same consent machinery, and its own first design principle is that it must not share a module with the aggregate metrics pipeline: aggregation exists to make individuals unidentifiable, and a directory identifies individuals on purpose, with consent. Routed through one module, either the directory returns nothing or someone deletes the suppression and silently breaks every aggregate.

## Related

- `docs/plans/profile-persona-information-architecture.md` **revisions 2 and 3**, which are authoritative for the
  corrected visibility and consent model recorded in the amendment above. Where an older plan disagrees with it,
  the older plan is stale.
- `docs/plans/persona-customization-and-audience-analytics.md` **section 14**, which is authoritative for implementation and carries the full verified-constraint table, the do-not-touch list, the isolation test, the sanctioned exception, and the post-build audit. This ADR records the decision; that section holds the detail.
- `docs/reference/guides/persona-schema.md` — the operator guide to declaring sections.
- ADR 029 (contest proposal + PII model), whose `FormField` and PII partition this ADR declines to share.
- `[[feedback_pii_partition_single_source_of_truth]]`, `[[feedback_derive_dont_declare_twice]]`, `[[feedback_guard_needs_its_own_guard]]`.
