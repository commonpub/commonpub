# Plan: Persona customization, an operator-defined profile schema, purpose-scoped sharing consent, and k-anonymous audience analytics

**Status:** PROPOSED (design only). Author context: session 255. Revision 2, incorporating a full adversarial review; every disposition of that review is recorded in Appendix A.

> **SUPERSEDED IN PART (session 256).** `docs/plans/profile-persona-information-architecture.md`
> revisions 2 and 3 are authoritative wherever they disagree with this document. Two of this plan's
> assumptions were corrected in shipped code: persona answers are **private by default**
> (`showOnProfile: true` opts one field in; there is no `publicOnProfile`), and being counted in
> instance statistics is **not a consent purpose** (`profile_analytics` was removed; statistics run
> on legitimate interest with an objection recorded in `user_statistics_objections`). Read the
> machinery here, take the model from there.


---

## 0. TL;DR, the shape of the answer

1. **One field-definition layer, three consumers.** `FormField` and its type registry move out of `packages/schema/src/contest.ts` into `packages/config/src/forms.ts` (not schema: see §4.1 for the dependency argument), gaining an exhaustive `FIELD_TYPE_SPECS` closed with `satisfies`, so the union-versus-array drift between `packages/schema/src/contest.ts:102-118` and `packages/schema/src/validators/contest.ts:121-137` becomes a typecheck failure. Contest registration forms, contest entry forms and the new persona form all read from it. Adding `multiselect` once gives contest forms chip grids too.
2. **Persona sections are operator-defined data, not code.** `PersonaSection[]` lives in `commonpub.config.ts` (committable to git) and/or `instance_settings['persona.sections']` (admin portal), resolved by one pure function in `@commonpub/server` so no fork has to edit its own `server/utils/config.ts`. The config-file path gets its own drift reconciler, because it can reach the database without passing through the admin route's guards.
3. **Existing profile fields are section one, not a parallel system.** `displayName`, `bio`, `headline`, `location`, `pronouns` stay as `users` columns and are addressed by a `column:` binding on the field spec. No duplicate storage.
4. **Storage follows queryability.** Closed-vocabulary answers become one row per selected value in `user_persona_answers` (indexed on `field_key, value`). Free text goes to `user_persona_text`, a table the analytics module never imports, so free-text leakage is a missing import rather than a forgotten rule. Profile links become normalized rows in `user_profile_links` indexed on `platform`, retiring the seven-key `socialLinks` jsonb in one commit that also fixes the two published contracts that read it.
5. **Sharing consent is Art 6(1)(a) processing consent, not ePrivacy cookie consent.** Different legal basis, different subject, different granularity. It gets its own registry (`packages/config/src/purposes.ts`), its own table (`user_purpose_consents`) with supersede-then-insert history and a `scopeSnapshot` of exactly what was shown, and zero new cookies. The cookie banner gains one sentence and no button. `consentInputSchema` is **not** widened.
6. **Consent is an INNER JOIN with the scope digest bound in the join condition.** There is no version of the aggregate query without it. Add a sponsor, the digest changes, every stale grant drops out of every aggregate at once, with no migration and no backfill.
7. **k-anonymity is real, not a constant.** `METRICS_MIN_BUCKET` (declared at `packages/server/src/publicApi/metrics.ts:41` with zero call sites today) becomes a floor for an operator-resolved `minBucket`, joined by a `minPopulation` floor, total suppression, count quantisation, whole-field suppression on single-valued fields, and rollup-snapshot serving so hourly polling cannot watch a bucket cross the threshold. No aggregate response ever returns `eligibleUsers` beside a suppressed bucket.
8. **Adding a section adds a cohort with no code.** `GET /api/public/v1/metrics/persona/fields` derives itself from the effective schema; the distribution endpoint validates `field` against that list. New scope `read:audience`, wildcard-protected, because `hasScope` at `packages/server/src/publicApi/scopes.ts:9-12` grants any `read:*` holder every read scope. Persona series are deliberately **not** registered in `TIMESERIES_METRICS`, because `/metrics/timeseries` is guarded by `read:analytics` alone and would route around every gate above.
9. **Nothing federates.** The AP Person document is a hand-written literal; a source sweep pins it. Phase 0's `profileVisibility` enforcement on the actor and WebFinger routes ships behind its own flag, because it changes federation-visible behaviour.
10. **First run is an offer, not a gate and not a signup step**, with a persistent dismissal so it cannot become a recurring nag.
11. **Default off, everywhere, enforced by a literal `false` type plus eight named dark-pattern tests**, two of which the review correctly identified as unfalsifiable in the draft and which are strengthened here.
12. **Phase 0 ships no feature.** It fixes the profile privacy defects (one DTO for owner, stranger and fediverse; `profileVisibility` honoured by nothing; `emailNotifications` clobber) that persona data would otherwise amplify.
13. **One migration, `0046`.** Everything schema-shaped lands in it, including `api_keys.purposes` and the `user_consents` column widening, because §11.2's direct-pin hazard doubles with every additional migration.

---

## 1. Current state (verified)

Every row below was read in the tree at the cited line.

### 1.1 The profile today

| Fact | Evidence |
|---|---|
| Profile is a single wide `users` row: 11 scalar columns plus 3 jsonb (`social_links`, `skills`, `experience`) plus `email_notifications` | `packages/schema/src/auth.ts:5-58` |
| Exactly one write path: `PUT /api/profile` then `updateProfileSchema` then `updateUserProfile` | `layers/base/server/api/profile.put.ts:1-24`, `packages/schema/src/validators/auth.ts:40-70`, `packages/server/src/profile/profile.ts:116-172` |
| Exactly one whole-profile read: `getUserByUsername` producing the `UserProfile` DTO | `packages/server/src/profile/profile.ts:36-114`, `packages/server/src/types.ts:108-155` |
| That one DTO is served to the owner, to any anonymous visitor, and to the AP actor route | `layers/base/server/api/profile.get.ts:1-15`, `layers/base/server/api/users/[username].get.ts:22`, `layers/base/server/routes/users/[username].ts:15-19` |
| It carries `emailNotifications`, a private preference, to every viewer | `packages/server/src/profile/profile.ts:100`, `packages/server/src/types.ts:136-142` |
| `profileVisibility` is honoured on exactly two read paths and ignored by the app's own | honoured: `packages/server/src/publicApi/serializers.ts:75`, `packages/server/src/publicApi/metrics.ts:285`. ignored: `layers/base/server/api/users/[username].get.ts:8-25`, `layers/base/server/api/users/index.get.ts:24-46`, `layers/base/server/routes/users/[username].ts:15-19`, `layers/base/server/routes/.well-known/webfinger.ts:51-85` |
| No route or UI can set `profileVisibility`; the column defaults to `'public'` | absent from `packages/schema/src/validators/auth.ts:40-69`; zero `.vue` hits repo-wide; default at `packages/schema/src/auth.ts:29` |
| `getUserByUsername` filters only `deletedAt`, so suspended users stay publicly readable and federatable | `packages/server/src/profile/profile.ts:36-40` |
| `emailNotifications` is a whole-object replace; both editors reconstruct 5 of 6 keys, resurrecting `unsubscribedAll` | `packages/server/src/profile/profile.ts:169`, `layers/base/pages/settings/profile.vue:117-123`, `layers/base/pages/settings/notifications.vue:30-40`, set by `layers/base/server/api/unsubscribe.post.ts:42` |
| `socialLinks` is a 7-key shape hand-mirrored in four places and rendered in five of seven (instagram and discord are collected and never shown) | `packages/schema/src/auth.ts:18-26`, `packages/schema/src/validators/auth.ts:21-31`, `packages/server/src/types.ts:118-126`, `layers/base/pages/settings/profile.vue:445-458` versus `layers/base/pages/u/[username]/index.vue:305-311` |
| **`socialLinksSchema` calls `optionalUrl()` with NO max length**, unlike `website: optionalUrl(512)` on the same object | `packages/schema/src/validators/auth.ts:21-31` versus `:45` (verified) |
| `users.timezone` is write-only dead weight: validated, persisted, exported, zero readers | `packages/schema/src/validators/auth.ts:58`, `packages/server/src/profile/profile.ts:168`, `packages/server/src/profile/export.ts:128` |
| `toPublicUser` returns `socialLinks` on the versioned public API | `packages/server/src/publicApi/serializers.ts:53-71` (verified) |
| The DSAR profile allow-list selects `users.socialLinks` and `users.website` by column | `packages/server/src/profile/export.ts:115-122` (verified) |
| No profile-completeness concept anywhere | repo-wide grep for `profileComplete|completeness` returns only layout, learning and GDPR hits |
| No feature flag gates the profile system | `packages/config/src/schema.ts:25-176` |
| Only three fields federate: `preferredUsername`, `name`, `summary`. Hand-written literal, no `buildPersonActor()` | `layers/base/server/routes/users/[username].ts:34-61` |

### 1.2 The form engine (the thing to reuse)

| Fact | Evidence |
|---|---|
| 15 field types, declared twice, no compile-time parity guard | `packages/schema/src/contest.ts:102-118` (TS union) versus `packages/schema/src/validators/contest.ts:121-137` (Zod tuple) |
| `isFormFieldPii` is a genuine single source of truth, 6 non-test call sites | `packages/schema/src/contest.ts:169-174`. Verified rule: `address` and `file` always; `email` and `signature` unless `pii === false`; anything else only on `pii === true` |
| **`required` is mandatory (not optional) on the contest field validator**, alongside `pii`, `terms`, `accept`, `maxSizeKb` | `packages/schema/src/validators/contest.ts:149-184` |
| `FormField` already exists as the neutral alias | `packages/schema/src/contest.ts:148-155` |
| `validateSubmissionFields` is pure, DB-free, and tri-partitions into artifact, pii and agreements | `packages/server/src/contest/validation.ts:41-172` |
| `FormTemplateEditor.vue` is already shared by two hosts, controlled, keyboard-reorderable | `layers/base/components/contest/FormTemplateEditor.vue:51-56, 117-149` |
| **BUG:** the PII toggle emits `pii: checked \|\| undefined`; `isFormFieldPii` treats `undefined` as personal for `email`, so unchecking an email field silently does nothing. Scope correction (re-verified in the tree): the toggle is not rendered at all for `address`, `file`, `signature`, `agreement` or `section`, so `email` is the only affected type, not `email` and `signature` | `layers/base/components/contest/FormTemplateEditor.vue:398-403` versus `packages/schema/src/contest.ts:170-173` |
| **DRIFT:** the builder offers `maxLength` for 5 types; validation enforces it for all | `FormTemplateEditor.vue:113-115` versus `packages/server/src/contest/validation.ts:97-100` |
| **FOOTGUN:** renaming a label rewrites the machine key and orphans stored answers | `layers/base/utils/contestStages.ts:154-160` |
| **PRE-EXISTING ODDITY, out of scope:** `tel` is not default-partitioned as personal data, so a phone number lands in the public artifact partition unless the operator ticks `pii` | `packages/schema/src/contest.ts:169-174` |

### 1.3 Consent and analytics

| Fact | Evidence |
|---|---|
| `packages/config/src/analytics.ts` derives CSP origins, cookie disclosures and the named processor from one pure record per provider | `packages/config/src/analytics.ts:1-105` |
| Cookie consent stores `"<level>\|<scopeDigest>"`; a stale grant degrades to null, a stale refusal is honoured | `layers/base/composables/useCookieConsent.ts:72-84, 194-231` |
| `fnv1a` and `scopeDigest` are private, unexported locals in that composable | `layers/base/composables/useCookieConsent.ts:72-84` |
| `CookieDefinition.category` is a closed 3-value union in both TS and Zod | `packages/config/src/types.ts:302-303`, `packages/config/src/schema.ts:271-277` |
| `user_consents.kind` and `.version` are both `varchar(32)`; `documentHash` is `varchar(64)`; the row cascades on user delete | `packages/schema/src/auth.ts:172-185` (verified) |
| `recordConsent` dedups by version, so it cannot express a withdrawal | `packages/server/src/profile/consent.ts:58-77` |
| `consentInputSchema` is `.strict()` with a 2-value enum | `packages/schema/src/validators/comms.ts:59-62` |
| `METRICS_MIN_BUCKET = 5` is declared, exported, documented, and has **zero call sites** | `packages/server/src/publicApi/metrics.ts:41` (verified, with the reserving comment at :34-38); `docs/public-api.md:313` |
| **`hasScope` grants any `read:*` holder every `read:` scope, with no protected-leaf branch** | `packages/server/src/publicApi/scopes.ts:9-12` (verified). Contrast `WILDCARD_PROTECTED_PERMISSIONS` at `packages/auth/src/permissions.ts:44-57` |
| **`/metrics/timeseries` is guarded by `requireApiScope(event, 'read:analytics')` and nothing else**, and derives its `metric` enum from `Object.keys(TIMESERIES_METRICS)` | `layers/base/server/api/public/v1/metrics/timeseries.get.ts:8, :24` (verified) |
| The rollup worker upserts **today's** row every 6h from a 15s post-boot start, skips on `NODE_ENV=test` and when `features.publicApi` is off, and backfills only when the table is empty | `layers/base/server/plugins/metrics-rollup.ts:13-46` (verified). There is no end-of-day finalisation write |
| `PUBLIC_API_SCOPES` is a const tuple driving the validator, `requireApiScope`'s type and the admin checkbox list | `packages/schema/src/validators/publicApi.ts:5-23`; `layers/base/pages/admin/api-keys.vue:49` |
| `api_keys` has `scopes`, `allowed_origins`, `rate_limit_per_minute` and **no `purposes` column** | `packages/schema/src/publicApi.ts:13-33` (verified) |
| `metrics_daily.dimension` is `varchar(64) NOT NULL DEFAULT ''` and has never carried a real value. NULL would break the unique index | `packages/schema/src/metrics.ts:17-39` |
| The public OpenAPI doc is a hand-written 405-line literal with no parity test, already drifted | `layers/base/server/api/public/v1/openapi.json.get.ts:379-399` |
| `PUT /api/admin/settings` takes `{key: string, value: z.unknown()}` and validates nothing | `packages/schema/src/validators/admin.ts:6-10` |
| `PUT /api/admin/features` merges and never removes, so a portal-touched flag can never be won back by the git file | `layers/base/server/api/admin/features/index.put.ts:38` |
| `audit_logs.target_id` is `varchar(255)` with no FK and no cascade; `audit_logs.user_id` cascades; `instance_settings.updated_by` is `set null` | `packages/schema/src/admin.ts:9, 15-21` (verified) |
| Last applied migration is `0045_oval_rhodey.sql` | `packages/schema/migrations/` (verified) |
| Published versions: `@commonpub/schema` 0.63.0, `@commonpub/config` 0.38.0 | `packages/schema/package.json:3`, `packages/config/package.json:3` (verified) |
| **Neither package imports the other today.** Both depend on `zod` alone | `packages/config/package.json:53-55`, `packages/schema/package.json:66-68`; `grep -rn "@commonpub/config" packages/schema/src` and the inverse both return nothing (verified) |
| `@commonpub/config` exports only `"."` and `"./analytics"`; `@commonpub/schema` exports `"."`, `"./validators"`, `"./enums"` | `packages/config/package.json:29-38`, `packages/schema/package.json:29-42` (verified) |
| `httpUrl` and `optionalUrl` live in schema and take an optional `maxLen` | `packages/schema/src/validators/_shared.ts:11-26` (verified) |

---

## 2. Design principles

Each is tied to a specific incident in this repo.

| # | Principle | The lesson behind it |
|---|---|---|
| P1 | **Derive, do not declare twice.** One record per subject; every downstream list is a pure function of it. | `analytics.ts` proves it works. `FormTemplateEditor`'s four hand-written type lists prove the alternative drifts: `hasMaxLength` already disagrees with the validator. |
| P2 | **Consent must record its scope.** A grant stores a digest of purposes, data classes, recipients and aggregatable field keys, plus a human-readable snapshot of what was shown. | A level-only cookie consent silently authorised GA4 fourteen months later. |
| P3 | **Degrade stale grants, always honour stale refusals.** | Same incident. Erring toward the refusing answer is what stops a disclosure change becoming an accidental opt-in. |
| P4 | **One partition predicate, imported by every consumer.** `personaFieldSink()` decides storage; nobody re-derives it. | `isFormFieldPii` has 6 call sites and zero copies, and that is why store-side and read-side cannot drift. |
| P5 | **Structural beats conventional.** Free text lives in a table the analytics module does not import. Consent is a JOIN, not a WHERE helper. A protected scope is a branch in `hasScope`, not a code review comment. | A filter in a shared helper is a filter a new endpoint author can omit. |
| P6 | **Shared pure logic lives in a package, never in `layers/base/utils/`.** | Nitro routes do not auto-import from `utils/`; the failure is invisible to typecheck and vitest and 500s in production. |
| P7 | **A guard needs its own guard.** Every scanning test asserts it walked N greater than a floor. | A broken walk returns zero files and passes green. |
| P8 | **Never seed a client-only count to zero for first paint.** | Session 253 shipped "0 makers registered" into the HTML and into crawlers. |
| P9 | **No feature without a flag**, and the flag lands in every mirror with a parity sweep. | `useFeatures.ts` is already missing four existing flags; a flag omitted from `nuxt.config.ts` silently loses its env override. |
| P10 | **Fix the substrate before building on it.** Phase 0 ships no feature. | Adding persona fields to a DTO that already leaks `emailNotifications` inherits the leak. |
| P11 | **No em dashes, no dark patterns, no fake scarcity.** Points never attach to sharing. Withdrawal is one click with no confirm. Dismissal is permanent. | Operator constraint, made testable in §8.6. |
| P12 | **A back door counts as a front door.** Every alternative path to the same data gets the same gate, or the gate is closed. | The draft gated `/metrics/persona/*` five ways and then registered the same numbers in a `read:analytics` endpoint that already ships. |
| P13 | **Every legal claim in the design must be defensible as written.** | A pseudonym the controller can re-link is still personal data (Recital 26). Writing "not personal data" in a plan does not make it so. |

---

## 3. The persona registry, the typed source of truth

### 3.1 Prerequisite: the neutral form layer, and where it lives

The draft put `forms.ts` in `@commonpub/schema` and `personaConfigSchema` in `@commonpub/config`, which is a cycle: config would need schema's `personaSectionSchema`, while schema would need config's URL validator. Both packages depend on `zod` alone today and neither imports the other (verified), so nothing absorbs it.

**Resolution: the field and section type layer lives in `@commonpub/config`, and `@commonpub/schema` depends on `@commonpub/config`, never the reverse.**

Reasons, in order:

1. The operator declares persona sections in `commonpub.config.ts`, exactly as they declare `cookies` and `analytics`. `defineCommonPubConfig()` must be able to parse them, and it has no database and no Drizzle (`packages/config/src/config.ts:20-83`).
2. `@commonpub/config` is already the dependency-free pure-data home. `packages/config/src/analytics.ts` is the precedent: server middleware, SSR pages and client plugins all import it.
3. The dependency-direction test then states something true and useful in one direction only: `packages/config/src/**` contains zero `@commonpub/schema` imports.
4. `@commonpub/schema` keeps everything Drizzle-shaped (the five tables) plus its existing validators, and re-exports the form and persona types so **zero existing import sites change**.

New files:

| File | Contents |
|---|---|
| `packages/config/src/url.ts` | `httpUrl`, `optionalUrl`, moved verbatim from `packages/schema/src/validators/_shared.ts:11-26` |
| `packages/config/src/forms.ts` | `FORM_FIELD_TYPES`, `FormFieldType`, `FormSurface`, `FormFieldSink`, `FormFieldTypeSpec`, `FIELD_TYPE_SPECS`, `FormField`, `isFormFieldPii`, `isRequiredFormField`, `templateHasRequiredField` |
| `packages/config/src/persona.ts` | `PersonaField`, `PersonaSection`, `personaFieldSink`, `isPersonaFieldAggregatable`, `personaCompleteness`, `PERSONA_LINK_PLATFORMS`, `BUILTIN_PERSONA_SECTIONS`, `personaFieldSchema`, `personaSectionSchema`, `personaSectionsSchema` |
| `packages/config/src/purposes.ts` | `PROCESSING_PURPOSES`, `ProcessingPurposeSpec`, `PROCESSING_PURPOSE_SPECS`, `purposeIsOfferable`, `purposeScopeDigest`, `DataRecipient`, `dataRecipientSchema` |
| `packages/config/src/digest.ts` | `fnv1a32`, lifted from `layers/base/composables/useCookieConsent.ts:72-84` |
| `packages/schema/src/forms.ts` | thin re-export of `@commonpub/config/forms` |
| `packages/schema/src/persona.ts` | the five Drizzle tables, plus a re-export of `@commonpub/config/persona` |
| `packages/schema/src/validators/_shared.ts` | thin re-export of `@commonpub/config/url` |

`packages/config/package.json` `exports` gains `./forms`, `./persona`, `./purposes`, `./digest`, `./url`. Without those entries the subpaths do not resolve for consumers; the package currently declares only `"."` and `"./analytics"` (verified).

Ship with:

- a test asserting the URL validator still rejects `javascript:`, `data:`, `vbscript:` and `blob:` and still accepts `http://` and `https://`;
- a dependency-direction test asserting `packages/config/src/**` contains zero `@commonpub/schema` imports, with a file-count floor (P7);
- a subpath-resolution test importing each new subpath from a fixture that resolves through `exports`.

### 3.2 The type registry, closed with `satisfies`

The draft closed the literal with `as Record<FormFieldType, FormFieldTypeSpec>`, which suppresses the very missing-key check it was relying on, and then omitted five entries. `satisfies` performs the check and preserves the literal's narrow types.

```ts
// packages/config/src/forms.ts

/** The ONE type tuple. `FormFieldType` derives from it, and so does every Zod
 *  enum, so the hand-mirrored union-versus-array pair (packages/schema/src/contest.ts:102-118
 *  against packages/schema/src/validators/contest.ts:121-137) can no longer diverge. */
export const FORM_FIELD_TYPES = [
  'text', 'textarea', 'url', 'email', 'number', 'select', 'radio', 'checkbox',
  'date', 'tel', 'agreement', 'address', 'file', 'signature', 'section',
  'multiselect',   // NEW: the chip grid. Serves contests and personas alike.
  'link',          // NEW: a profile link. Persona surface only.
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export type FormSurface = 'contest' | 'persona';

/** Where an answer to this field is stored on the PERSONA surface.
 *  SINGLE SOURCE OF TRUTH (P4). */
export type FormFieldSink = 'answers' | 'text' | 'links' | 'private' | 'none';

export interface FormFieldTypeSpec {
  readonly label: string;
  readonly group: 'basic' | 'choice' | 'contact' | 'layout' | 'personal' | 'links';
  readonly cardinality: 'none' | 'scalar' | 'set';
  /** Contest partition: always personal data, no opt-out. */
  readonly alwaysPii: boolean;
  /** Contest partition: personal unless `pii: false`. */
  readonly piiByDefault: boolean;
  readonly requiresFlag: 'contestPii' | 'contestPrivateFiles' | null;
  readonly surfaces: readonly FormSurface[];
  /** Can an answer of this type ever become an aggregate bucket?
   *  FALSE for every free-text type: that is the structural guarantee (P5). */
  readonly aggregatable: boolean;
  readonly supportsOptions: boolean;
  readonly supportsMaxLength: boolean;
  readonly supportsMaxSelections: boolean;
  /** Persona storage sink. The contest surface keeps its own artifact/pii
   *  tri-partition and ignores this field. */
  readonly personaSink: FormFieldSink;
}

/** `satisfies`, NOT `as`. A missing key is a typecheck failure; an excess key is
 *  a typecheck failure; the literal keeps its narrow inferred types. */
export const FIELD_TYPE_SPECS = {
  text: {
    label: 'Short text', group: 'basic', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: true, supportsMaxSelections: false,
    personaSink: 'text',
  },
  textarea: {
    label: 'Long text', group: 'basic', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: true, supportsMaxSelections: false,
    personaSink: 'text',
  },
  url: {
    label: 'Web address', group: 'basic', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: true, supportsMaxSelections: false,
    personaSink: 'text',
  },
  email: {
    label: 'Email address', group: 'contact', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: true, requiresFlag: null,
    surfaces: ['contest'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: true, supportsMaxSelections: false,
    personaSink: 'none',
  },
  number: {
    label: 'Number', group: 'basic', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'text',
  },
  select: {
    label: 'Dropdown', group: 'choice', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: true,
    supportsOptions: true, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'answers',
  },
  radio: {
    label: 'Single choice', group: 'choice', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: true,
    supportsOptions: true, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'answers',
  },
  checkbox: {
    label: 'Single checkbox', group: 'choice', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: true,
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'answers',
  },
  date: {
    label: 'Date', group: 'basic', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'text',
  },
  tel: {
    label: 'Phone number', group: 'contact', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: true, supportsMaxSelections: false,
    personaSink: 'none',
  },
  agreement: {
    label: 'Agreement', group: 'personal', cardinality: 'none',
    alwaysPii: false, piiByDefault: false, requiresFlag: 'contestPii',
    surfaces: ['contest'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'none',
  },
  address: {
    label: 'Postal address', group: 'personal', cardinality: 'scalar',
    alwaysPii: true, piiByDefault: true, requiresFlag: 'contestPii',
    surfaces: ['contest'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'none',
  },
  file: {
    label: 'File upload', group: 'personal', cardinality: 'scalar',
    alwaysPii: true, piiByDefault: true, requiresFlag: 'contestPrivateFiles',
    surfaces: ['contest'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'none',
  },
  signature: {
    label: 'Signature', group: 'personal', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: true, requiresFlag: 'contestPii',
    surfaces: ['contest'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: true, supportsMaxSelections: false,
    personaSink: 'none',
  },
  section: {
    label: 'Section heading', group: 'layout', cardinality: 'none',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: false,
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'none',
  },
  multiselect: {
    label: 'Multiple choice grid', group: 'choice', cardinality: 'set',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['contest', 'persona'], aggregatable: true,
    supportsOptions: true, supportsMaxLength: false, supportsMaxSelections: true,
    personaSink: 'answers',
  },
  link: {
    label: 'Profile link', group: 'links', cardinality: 'scalar',
    alwaysPii: false, piiByDefault: false, requiresFlag: null,
    surfaces: ['persona'], aggregatable: false,   // presence is counted separately
    supportsOptions: false, supportsMaxLength: false, supportsMaxSelections: false,
    personaSink: 'links',
  },
} satisfies Record<FormFieldType, FormFieldTypeSpec>;

export function isFormFieldPii(f: Pick<FormField, 'type' | 'pii'>): boolean {
  const spec = FIELD_TYPE_SPECS[f.type];
  if (spec.alwaysPii) return true;
  if (f.pii === true) return true;
  return spec.piiByDefault && f.pii !== false;
}
```

`isFormFieldPii` keeps its exact current behaviour, verified line by line against `packages/schema/src/contest.ts:169-174`, and now derives from the registry instead of an if-chain. `isRequiredFormField` and `templateHasRequiredField` move unchanged.

Four hand-written lists in `FormTemplateEditor.vue` collapse into `FIELD_TYPE_SPECS`: `FIELD_TYPE_GROUPS` (:82-94), `hasMaxLength` (:113-115), the PII-toggle hide list (:399), and the removed if-chain. A runtime floor test asserts `Object.keys(FIELD_TYPE_SPECS).length === FORM_FIELD_TYPES.length` and that the length is at least 17, so a `satisfies` regression cannot pass silently either (P7).

### 3.3 The persona field and section shapes

```ts
// packages/config/src/persona.ts

export type UserBridgeColumn =
  | 'displayName' | 'bio' | 'headline' | 'location' | 'pronouns' | 'website';

export interface PersonaField {
  /** ^[a-z0-9_]+$, max 40. THE analytics namespace. Unique across the whole
   *  template, not per section, because user_persona_answers.field_key is global.
   *  IMMUTABLE once answers exist (see §5.5). */
  key: string;
  label: string;                 // max 120
  type: FormFieldType;           // must have 'persona' in FIELD_TYPE_SPECS[type].surfaces
  help?: string;                 // max 300
  maxLength?: number;            // text/textarea/url/number/date only, <= 2000
  options?: Array<{ value: string; label: string }>;  // max 64; value ^[a-z0-9_]{1,64}$
  maxSelections?: number;        // multiselect only, 1..64 (the screenshot's "MAX 5")
  platform?: string;             // type 'link' only; validated against the merged platform set
  /** Optional completeness weight for the whole field. NEVER unlocks anything. */
  points?: number;
  /** Per-selection weight for a multiselect, capped by maxSelections.
   *  Expresses the screenshot's "+4 PTS EACH (MAX 5)". */
  pointsPerSelection?: number;
  /** Operator scoping. User consent is the actual gate; this only lets an
   *  operator keep a closed-vocabulary field out of statistics entirely. */
  analytics?: boolean;
  /** Art 9 escape hatch. Forces the field out of the aggregatable partition,
   *  out of the public serializer, and into the never-counted text sink. */
  sensitive?: boolean;
  showOnProfile?: boolean;       // CORRECTED: was `publicOnProfile`, default true. Now opt IN, absent means private.
  /** Binds this field to an EXISTING users column so the current profile is
   *  section one of the persona schema rather than a parallel system. */
  column?: UserBridgeColumn;
}

export interface PersonaSection {
  key: string;                   // ^[a-z0-9_]+$, max 40
  label: string;
  help?: string;
  collapsedByDefault?: boolean;
  order?: number;
  fields: PersonaField[];        // max 24
}
```

**Deliberate omissions versus `FormField`:** no `required` (a persona is never mandatory; that is the anti-dark-pattern), no `pii` (the persona surface partitions by `personaFieldSink`, never by a per-field PII toggle, so exposing one would render a control that does nothing), no `terms`, no `accept`, no `maxSizeKb`.

**How the omission is enforced, stated correctly:** by `.strict()` on `personaFieldSchema`, which rejects any unknown key including `required` and `pii`. `FIELD_TYPE_SPECS[type].surfaces` enforces something different, namely which **types** a surface may use; it says nothing about properties. Two negative tests ship: a section containing `{ required: true }` is rejected, and a section containing `{ pii: true }` is rejected.

### 3.4 The one partition predicate

```ts
/** SINGLE SOURCE OF TRUTH for where a persona answer is stored, imported by the
 *  write path, the reader, the public serializer, the DSAR export builder, the
 *  analytics field list and the admin editor. Nobody re-derives it (P4). */
export function personaFieldSink(
  f: Pick<PersonaField, 'type' | 'analytics' | 'sensitive' | 'column'>,
): FormFieldSink {
  if (f.column) return 'none';                        // lives on the users row
  const spec = FIELD_TYPE_SPECS[f.type];
  if (spec.personaSink === 'none') return 'none';
  if (f.sensitive === true) return 'text';            // Art 9: never aggregatable
  if (spec.personaSink === 'answers' && f.analytics === false) return 'text';
  return spec.personaSink;                            // 'answers' | 'text' | 'links'
}

export function isPersonaFieldAggregatable(
  f: Pick<PersonaField, 'type' | 'analytics' | 'sensitive' | 'column'>,
): boolean {
  return personaFieldSink(f) === 'answers' && FIELD_TYPE_SPECS[f.type].aggregatable;
}
```

### 3.5 The link-platform registry, operator-extensible and ReDoS-free

The draft declared `hostPattern: RegExp` in a code `Record` while simultaneously promising that "an operator who adds a platform decides its signal status once, where they name it". A `RegExp` is not serialisable into a config file that must round-trip through JSON export, and an operator-supplied pattern is a denial-of-service vector.

**Resolution: no regex.** A platform declares `hostSuffixes`, a bounded list of lowercase host suffixes, and validation is `URL(url).hostname === s || hostname.endsWith('.' + s)`. Serialisable, linear-time, and expressible in `commonpub.config.ts`.

```ts
export interface PersonaLinkPlatformSpec {
  readonly key: string;                       // ^[a-z0-9_]{1,32}$
  readonly label: string;                     // max 64
  readonly hostSuffixes: readonly string[];   // max 8, each max 64, lowercase
  readonly placeholder: string;               // max 120
  /** The operator's stated reasoning ("a linked GitHub or LinkedIn correlates
   *  with an authentic account") is a REGISTRY FACT, not a hardcoded platform
   *  list inside an analytics query. An operator who adds a platform decides
   *  its signal status once, where they name it. */
  readonly authenticitySignal: boolean;
}

export const BUILTIN_PERSONA_LINK_PLATFORMS: readonly PersonaLinkPlatformSpec[];

/** Union of built-ins and operator-declared platforms, deduped by key with the
 *  built-in winning, so an operator cannot silently redefine `github`. */
export function effectiveLinkPlatforms(
  configured: readonly PersonaLinkPlatformSpec[],
): readonly PersonaLinkPlatformSpec[];
```

Seeded with the existing seven (`github`, `twitter`, `linkedin`, `youtube`, `instagram`, `mastodon`, `discord`) plus `gitlab` and `website`. `instagram` and `discord`, collected today and rendered nowhere (`layers/base/pages/settings/profile.vue:445-458` versus `layers/base/pages/u/[username]/index.vue:305-311`), become real rendered platforms for free.

`PersonaField.platform` is `z.string().regex(/^[a-z0-9_]{1,32}$/)` at the field level, cross-validated against the effective platform set by `validatePersonaRegistry`, so an operator adding a platform in config needs no schema release.

### 3.6 Built-in sections

`BUILTIN_PERSONA_SECTIONS` expresses today's profile plus the inspiration screenshot's structure, so requirement 3 is met literally:

| Section | Fields |
|---|---|
| `basics` | `display_name` (`column: 'displayName'`), `headline` (`column: 'headline'`, labelled "Job title"), `location` (`column: 'location'`), `pronouns` (`column: 'pronouns'`), `bio` (`column: 'bio'`), `industry` (**`select`, closed vocabulary, aggregatable**) |
| `interests` | `interests` (`multiselect`, 18 options matching the screenshot: hardware, software, iot, embedded, open_source, ai_ml, developer_tools, cloud, security, maker, electronics, pcb, robotics, printing_3d, game_dev, web_dev, mobile, devops) |
| `tech_stack` | `tech_stack` (`multiselect`, 16 options: rust, python, typescript, javascript, go, c_cpp, vue, react, node, arduino, raspberry_pi, esp32, docker, kubernetes, terraform, postgres), `maxSelections` unset by default |
| `links` | one `link` field per built-in platform |

`industry` was missing from the draft despite appearing in the inspiration screenshot, and it is one of the more useful cohorts on a maker instance. An operator can relabel, reorder or hide any of these without a schema change. Only unbound fields touch the new tables.

### 3.7 Zod and the parity guard

`personaFieldSchema` drives its enum off `FORM_FIELD_TYPES` filtered by surface, so a new persona-capable type needs one edit:

```ts
const PERSONA_FIELD_TYPES = FORM_FIELD_TYPES.filter(
  (t) => FIELD_TYPE_SPECS[t].surfaces.includes('persona'),
) as [FormFieldType, ...FormFieldType[]];

export const personaFieldSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(120),
  type: z.enum(PERSONA_FIELD_TYPES),
  help: z.string().max(300).optional(),
  maxLength: z.number().int().min(1).max(2000).optional(),
  options: z.array(z.object({
    value: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(120),
  })).max(64).optional(),
  maxSelections: z.number().int().min(1).max(64).optional(),
  platform: z.string().regex(/^[a-z0-9_]{1,32}$/).optional(),
  points: z.number().int().min(0).max(100).optional(),
  pointsPerSelection: z.number().int().min(0).max(100).optional(),
  analytics: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  showOnProfile: z.boolean().optional(), // CORRECTED: was `publicOnProfile`. `.strict()` now REJECTS the old key.
  column: z.enum(USER_BRIDGE_COLUMNS).optional(),
}).strict()
  .refine((f) => !['select', 'radio', 'multiselect'].includes(f.type) || (f.options?.length ?? 0) > 0,
          { message: 'A choice field needs at least one option' })
  .refine((f) => f.type !== 'link' || !!f.platform,
          { message: 'A link field needs a platform' })
  .refine((f) => !f.maxSelections || f.type === 'multiselect',
          { message: 'maxSelections applies to a multiple choice grid only' })
  .refine((f) => !f.pointsPerSelection || f.type === 'multiselect',
          { message: 'pointsPerSelection applies to a multiple choice grid only' })
  .refine((f) => !f.maxLength || FIELD_TYPE_SPECS[f.type].supportsMaxLength,
          { message: 'This field type does not accept a maximum length' });

export const personaSectionSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(120),
  help: z.string().max(300).optional(),
  collapsedByDefault: z.boolean().optional(),
  order: z.number().int().min(0).max(999).optional(),
  fields: z.array(personaFieldSchema).max(24),
}).strict();

export const personaSectionsSchema = z.array(personaSectionSchema).max(12)
  .superRefine((sections, ctx) => {
    // section keys unique; FIELD keys unique ACROSS ALL SECTIONS; option values
    // unique per field; <= 300 fields total; <= 120 aggregatable buckets total.
  });
```

The last refinement is the fix for the `maxLength` drift noted at `FormTemplateEditor.vue:113-115` versus `packages/server/src/contest/validation.ts:97-100`: on the persona surface the registry decides, and the validator enforces what the builder can express.

Plus the two-mutual-assignment compile-time guard copied verbatim from `packages/config/src/schema.ts:165-176`, applied to `PersonaField`, `PersonaSection`, `ProcessingPurposeSpec`, `DataRecipient` and `PersonaLinkPlatformSpec`.

---

## 4. Data model and migrations

### 4.1 Package dependency prerequisite

Covered in §3.1: `@commonpub/schema` gains a dependency on `@commonpub/config`; the URL validator moves down into config; `_shared.ts` becomes a re-export so every existing import site is unchanged. The direction is enforced by test.

### 4.2 New schema module and tables

New file `packages/schema/src/persona.ts`, exported from `packages/schema/src/index.ts`. Migration **`0046_persona_and_purposes.sql`** (last applied is `0045_oval_rhodey.sql`, verified). Everything schema-shaped in this whole plan lands in this single migration, including `api_keys.purposes` and the `user_consents` column widening, because §11.2's direct-pin hazard scales with the number of migrations a fork can skip.

```ts
// (1) Closed-vocabulary answers. One row per selected value.
export const userPersonaAnswers = pgTable('user_persona_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sectionKey: varchar('section_key', { length: 40 }).notNull(),
  fieldKey: varchar('field_key', { length: 40 }).notNull(),
  value: varchar('value', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_persona_answer').on(t.userId, t.fieldKey, t.value),
  index('idx_persona_answer_field_value').on(t.fieldKey, t.value),  // THE aggregate index
  // No separate (userId) index: uq_persona_answer already leads with userId.
]);

// (2) Free text. The analytics module NEVER imports this table (P5).
export const userPersonaText = pgTable('user_persona_text', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sectionKey: varchar('section_key', { length: 40 }).notNull(),
  fieldKey: varchar('field_key', { length: 40 }).notNull(),
  value: text('value').notNull(),          // capped by the field's maxLength at write
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_persona_text').on(t.userId, t.fieldKey),
]);

// (3) Profile links, normalized. Replaces users.social_links.
//     `url` is TEXT, not varchar(512): socialLinksSchema has no length cap today
//     (packages/schema/src/validators/auth.ts:21-31), so a varchar backfill can
//     abort the whole migration on one long stored link. New writes are capped
//     at 512 by Zod; existing longer values are preserved, not truncated.
export const userProfileLinks = pgTable('user_profile_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 32 }).notNull(),
  url: text('url').notNull(),
  position: smallint('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_profile_link').on(t.userId, t.platform),
  index('idx_profile_link_platform').on(t.platform),   // "how many have GitHub"
]);

// (4) Purpose consent. Append-only history WITH an O(1) current-state lookup.
export const userPurposeConsents = pgTable('user_purpose_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: varchar('purpose', { length: 24 }).notNull(),
  /** 'granted' | 'revoked'. There is deliberately no 'denied' state: never asking
   *  and declining are the same absence, and a stored "no" is a nag hook. */
  state: varchar('state', { length: 16 }).notNull(),
  /** Digest of {policyVersion, dataClasses, recipientIds, aggregatableFieldKeys}
   *  at the moment of the act. A grant whose digest differs from the current scope
   *  authorises NOTHING; it is bound into the analytics JOIN, not checked in
   *  app code (P2, P5). */
  scopeDigest: varchar('scope_digest', { length: 16 }).notNull(),
  /** Bounded snapshot of exactly what was shown. Art 7(1) demonstrability and
   *  the DSAR answer to "what did I actually agree to". Shape and size cap in §6.4. */
  scopeSnapshot: jsonb('scope_snapshot').$type<PurposeScopeSnapshot>().notNull(),
  policyVersion: varchar('policy_version', { length: 32 }).notNull(),
  source: varchar('source', { length: 24 }).notNull(),   // 'settings' | 'api'
  actedAt: timestamp('acted_at', { withTimezone: true }).defaultNow().notNull(),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
}, (t) => [
  uniqueIndex('uq_purpose_current').on(t.userId, t.purpose).where(sql`superseded_at IS NULL`),
  index('idx_purpose_consent_lookup').on(t.purpose, t.state, t.scopeDigest),
]);

// (5) Erasure-surviving consent proof. Pseudonymised, NOT anonymised. See §6.7
//     for the honest legal position and the retention basis.
export const consentProofs = pgTable('consent_proofs', {
  id: uuid('id').defaultRandom().primaryKey(),
  subjectRef: varchar('subject_ref', { length: 64 }).notNull(),  // HMAC(secret, user_id)
  purpose: varchar('purpose', { length: 24 }).notNull(),
  state: varchar('state', { length: 16 }).notNull(),
  scopeDigest: varchar('scope_digest', { length: 16 }).notNull(),
  policyVersion: varchar('policy_version', { length: 32 }).notNull(),
  actedAt: timestamp('acted_at', { withTimezone: true }).notNull(),
  erasedAt: timestamp('erased_at', { withTimezone: true }).defaultNow().notNull(),
  /** Set by the purge job so retention is enforced, not just documented. */
  purgeAfter: timestamp('purge_after', { withTimezone: true }).notNull(),
}, (t) => [
  index('idx_consent_proof_purpose').on(t.purpose, t.actedAt),
  index('idx_consent_proof_purge').on(t.purgeAfter),
]);
```

`purpose` is `varchar(24)`, not 40, so that `'sharing:' + purposeId` (8 + 24 = 32) fits the `user_consents.kind` column even before the widening below. A Zod refinement caps `ProcessingPurposeId` at 24 characters, with a test.

Three further statements in the same migration:

```sql
-- api_keys gains purpose limitation (§7.5). Default empty array means
-- "no purpose declared", which the audience routes treat as "no field allowed".
ALTER TABLE api_keys ADD COLUMN purposes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- user_consents carries the sharing audit rows (§6.4). `kind` becomes
-- 'sharing:<purpose>' and `version` becomes '<policyVersion>:<state>', both of
-- which can exceed the current varchar(32). Widening is safe: every consumer
-- compares exact strings (packages/server/src/profile/consent.ts:99-118).
ALTER TABLE user_consents ALTER COLUMN kind TYPE varchar(64);
ALTER TABLE user_consents ALTER COLUMN version TYPE varchar(64);
```

**No `idx_users_audience_eligible`.** The draft proposed a partial index on `users (id)`; the planner needs the filter columns for the semi-join, and the aggregate query's selectivity is dominated by the consent join. Phase 5 runs `EXPLAIN ANALYZE` against a seeded 10k-user test database and adds an index only if it measurably helps, with the plan recorded in the session log.

The `''`-sentinel discipline of `metrics_daily.dimension` (`packages/schema/src/metrics.ts:17-20`) is honoured wherever persona code writes that table: **always a non-empty string, never NULL**, because NULLs are distinct in a Postgres unique index and would silently duplicate rows.

### 4.3 Why normalized, not jsonb

| Question | jsonb on `users` | normalized rows |
|---|---|---|
| "How many are interested in iot" | `jsonb_array_elements` scan of every user, unindexable | `GROUP BY field_key, value` on `idx_persona_answer_field_value` |
| "How many have GitHub" | key-existence scan of every `social_links` blob | `count(*) WHERE platform='github'` on `idx_profile_link_platform` |
| New operator section | needs a hand-written extractor per field | already queryable; the discovery endpoint finds it |
| Removing one answer | read-modify-write race with a concurrent save | one `DELETE` |
| Multiselect membership | substring match, so "3d printing" matches a query for "printing" | exact row equality |
| Erasure of one field's data | rewrite the blob | `DELETE WHERE field_key = ...` |

The `socialLinks` column is the counter-example already in the tree: seven keys hand-mirrored in four places, rendering five.

### 4.4 Backfill from the existing columns

Set-based, in migration 0046, with pre and post row-count assertions in the migration test. Because `user_profile_links.url` is `text`, no row can be too long to insert and the migration cannot abort mid-way.

```sql
-- users.social_links -> user_profile_links, restricted to the seven known keys.
INSERT INTO user_profile_links (user_id, platform, url)
SELECT u.id, e.key, e.value
FROM users u, jsonb_each_text(u.social_links) e
WHERE u.social_links IS NOT NULL
  AND e.value <> ''
  AND e.key IN ('github','twitter','linkedin','youtube','instagram','mastodon','discord')
ON CONFLICT (user_id, platform) DO NOTHING;

-- users.website -> a 'website' link row.
INSERT INTO user_profile_links (user_id, platform, url)
SELECT u.id, 'website', u.website
FROM users u
WHERE u.website IS NOT NULL AND u.website <> ''
ON CONFLICT (user_id, platform) DO NOTHING;
```

Release-note pre-check, run per instance before the roll, because the new **write** cap is 512 and any legacy link longer than that will fail its next edit:

```sql
SELECT count(*) FROM users u, jsonb_each_text(u.social_links) e
WHERE length(e.value) > 512;
```

In the same roll, `socialLinksSchema` gains `optionalUrl(512)` on all seven keys (`packages/schema/src/validators/auth.ts:21-31`), so no new write can recreate the condition.

| Legacy column | Disposition | Reason |
|---|---|---|
| `users.social_links` | migrated to `user_profile_links`; **all readers and writers flipped in the same commit** (see §4.4.1); column retained unread for one minor release as the rollback path, dropped in a later numbered migration | hard cutover, not dual-write. Seeding one entity through two APIs is the documented split-brain trap. |
| `users.website` | migrated as `platform = 'website'`; same treatment | same |
| `users.skills` | **NOT migrated to the aggregatable partition.** Stays a free-text `string[]` rendered as chips, and becomes a persona field with `analytics: false` so it lands in `user_persona_text` | aggregating an open string array produces a long tail of near-duplicates ("Rust", "rust", "Rust-lang") that makes every cohort count wrong in a way no threshold detects. The screenshot's TECH STACK grid is a **new** closed-vocabulary `multiselect` field named `tech_stack`. Conflating the two silently poisons the analytics the feature exists to provide. |
| `users.experience` | **not migrated.** Stays jsonb | a repeated composite record (title, company, dates, description), never aggregatable, and no design here offers a repeatable-group field type. Moving it buys nothing. |
| `users.timezone` | not migrated; flagged for removal in a separate change | write-only dead weight with zero readers (verified) |
| `users.profile_visibility` | not migrated; **enforced** in Phase 0 and made settable in Phase 2 | a live column honoured by two paths and ignored by four |

#### 4.4.1 The cutover commit, in full

The draft said the columns would be "retained unread for one minor release" while flipping the DTO, which leaves the settings form writing a column nobody reads and breaks two contracts that do read it. All of the following ship in **one commit** in Phase 3:

1. `getUserProfileForViewer` and `getOwnProfile` build `socialLinks` from `user_profile_links`, keyed by platform, so the `UserProfile` DTO wire shape is unchanged.
2. `toPublicUser` (`packages/server/src/publicApi/serializers.ts:53-71`, verified to return `socialLinks`) takes the links from the same source, so `/api/public/v1/users/*` responses are byte-compatible. A serializer test pins the wire shape before and after.
3. `exportUserData` (`packages/server/src/profile/export.ts:115-122`, verified to select `users.socialLinks` and `users.website`) drops those two columns from the profile allow-list and gains the `profileLinks` section instead, so the DSAR neither breaks nor silently loses data.
4. `socialLinks` and `website` are removed from `updateProfileSchema` and from `updateUserProfile`'s input handling, and the corresponding inputs at `layers/base/pages/settings/profile.vue:445-458` are removed, so there is no window in which the form writes a dead column.
5. The seven-key shape is deleted from the Drizzle `$type<>` at `packages/schema/src/auth.ts:18-26`, from `socialLinksSchema`, and from the `UserProfile` DTO at `packages/server/src/types.ts:118-126`. The **columns** remain in the database, unread, for one minor release.

### 4.5 Write path

`PUT /api/persona` takes `{ sectionKey, answers }` and writes **one section per request** in one transaction:

1. Resolve the effective schema; reject unknown field keys outright (the `validateSubmissionFields` rule at `packages/server/src/contest/validation.ts:41-50`).
2. Route each value by `personaFieldSink(field)`:
   - `none` with a `column:` binding: funnel through `updateUserProfile`, so the existing validated path stays the only writer of `users` columns;
   - `answers`: upsert rows;
   - `text`: upsert one row;
   - `links`: upsert one row in `user_profile_links`, validating the URL against the platform's `hostSuffixes` and through `optionalUrl(512)`.
3. **Delete scoped to the section's TEMPLATE field keys, never to the submitted keys.** Scoping from the payload makes "uncheck every box in this section" a no-op, so a user could never empty a multiselect and could never withdraw an answer they regret. That is a data-subject-rights bug wearing an off-by-one costume.

```ts
// per field key f declared in THIS section's template:
await tx.delete(userPersonaAnswers).where(and(
  eq(userPersonaAnswers.userId, userId),
  eq(userPersonaAnswers.fieldKey, f.key),
  submitted[f.key]?.length ? notInArray(userPersonaAnswers.value, submitted[f.key]) : sql`true`,
));
```

Private-field merges (contest surface) use `mergePrivateFields(tx, table, keyColumn, keyValue, userId, pii)`, extracted from `recordPrivateAndAgreements` (`packages/server/src/contest/submissions.ts:203-232`) as a table-parameterised FOR-UPDATE merge-upsert. `recordPrivateAndAgreements` itself stays contest-scoped: its whole contract is an entry-XOR-registration invariant enforced by a DB CHECK, and it is not gaining a third branch.

### 4.6 Orphaned data when a field is removed

A field deleted from the schema is never iterated by the template-scoped delete, is never rendered on the profile, and would not resolve a label in the DSAR export. The result would be personal data the user provided that they can no longer see, rectify (Art 16) or erase (Art 17) short of deleting the account. That is not acceptable and the draft did not address it.

**Removal semantics, enforced on every write path that can remove a field (the admin route, the config reconciler in §5.3, and the markdown import):**

| Choice | Behaviour |
|---|---|
| Purge (default offered) | rows for that `field_key` are deleted in the same transaction as the schema save, and an `audit_logs` entry records the count |
| Retain | rows are kept and the field key is added to a `persona.retiredFields` setting; an `audit_logs` entry records the count |

Consequences of Retain, all shipped:

- `GET /api/persona` returns a `retired` block listing the raw `field_key`, the stored values, and the date the field left the schema.
- `/settings/persona` renders a "Data from removed fields" section with a per-field Delete control and this copy: "This was collected under a question that is no longer part of this profile. You can delete it."
- The DSAR export always emits the raw `field_key` when no label resolves, so nothing is invisible in a subject access request.
- Retired keys are **excluded** from `listPersonaAggregatableFields`, so nothing keeps counting a question the operator withdrew.

Integration tests cover all three (purge, retain-then-user-delete, retain-then-export).

### 4.7 What does NOT federate

Nothing persona-shaped touches `layers/base/server/routes/users/[username].ts:34-61`, which hand-builds the AP Person literal with exactly `preferredUsername`, `name`, `summary`, the collection URIs and the public key.

Two guards ship in Phase 3:

1. A test pinning that document's exact key set, so adding a field means deleting an assertion that says why not.
2. A source sweep asserting that route file contains zero references to `persona`, `user_persona_`, or `user_profile_links`, with a discovery floor asserting it read a non-empty file (P7).

Rationale, recorded so nobody re-litigates it: there is no `Update(Person)` activity path anywhere, so remote copies refresh only on re-fetch. A user revoking a sharing consent could not have that revocation propagate. Revocability and federation are in direct tension, and instance-local is the honest answer.

### 4.8 Erasure

All five new tables cascade on `users.id`. The existing single `tx.delete(users)` (`packages/server/src/admin/admin.ts:612-660`) therefore erases everything with no new deletion code, except the `consent_proofs` tombstone, which is written **before** the cascade (§6.7).

---

## 5. Operator configuration

### 5.1 Feature flags

Four flags, because they gate four different risk surfaces: collecting, disclosing, aggregating, and changing federation-visible behaviour.

| Flag | Default | Gates |
|---|---|---|
| `persona` | `false` | the editor, `/api/persona/*`, persona rendering on the public profile, the admin schema editor |
| `dataSharingConsents` | `false` | the purpose toggles, `/settings/privacy`, the derived privacy-page section, `/api/consent/purposes` |
| `personaAnalytics` | `false` | the aggregate endpoint family, the rollup pass, the admin audience dashboard. Inert without `persona` and `publicApi` |
| `strictProfileVisibility` | `false` | Phase 0's enforcement of `profileVisibility` and `status` on the **WebFinger and ActivityPub actor** routes only. App-side enforcement is unflagged. See §9 Phase 0 for why. |

`publicApiMetricsFederation` (`packages/config/src/schema.ts:149`) is the precedent for a separately-opted-in sensitive metrics surface.

**Every mirror must be updated:** `packages/config/src/schema.ts`, `packages/config/src/types.ts` (guarded by the assertion pair at :165-176), `layers/base/nuxt.config.ts` `public.features`, `layers/base/composables/useFeatures.ts` (interface plus `DEFAULT_FLAGS`), and **each fork's own** `server/utils/config.ts` env-flag map. That last one is per-fork, not shared: `apps/reference/server/utils/envFlagMap.ts` is the reference app's copy, and deveco and heatsync carry their own because `layers/base/README.md:47` instructs every fork to write its own config bridge. The parity sweep in §10.4 can only walk the reference app, so the fork copies appear in the §11.5 adoption checklist instead.

Phase 0 adds the source-sweep parity test across the four in-repo mirrors, and fixes the four flags already missing from the `useFeatures` mirror (`seamlessFederation`, `federateHubs`, `adminBroadcast`, `requireTermsAcceptance`).

### 5.2 Config file schema

```ts
// packages/config/src/schema.ts
export const personaConfigSchema = z.object({
  sections: z.array(personaSectionSchema).max(12).default([]),
  linkPlatforms: z.array(personaLinkPlatformSchema).max(24).default([]),
  /** 'progress' is the default. 'points' exists because the community's norms
   *  are the operator's call, but the default is the respectful one: PTS badges
   *  are manufactured scarcity attached to voluntarily disclosing personal data,
   *  which is the thing this feature was asked not to be. */
  completeness: z.enum(['progress', 'points', 'none']).default('progress'),
  firstRun: z.enum(['offer', 'off']).default('offer'),
}).strict();

export const dataRecipientSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  name: z.string().min(1).max(120),
  url: optionalUrl(512),
  privacyPolicyUrl: httpUrl(512),          // REQUIRED: you cannot disclose to a
                                           // party with no policy to link.
  purposes: z.array(z.enum(PROCESSING_PURPOSES)).min(1),
  /** The compliance shape most operators have not thought about. */
  relationship: z.enum(['processor', 'joint_controller', 'independent_controller']),
  /** URL or reference to the signed Art 26 / Art 28 instrument. */
  agreementRef: z.string().max(512).optional(),
  country: z.string().max(64).optional(),
  transferMechanism: z.enum(['adequacy', 'scc', 'bcr', 'derogation']).optional(),
}).strict()
  .refine((r) => r.relationship === 'processor' || !!r.agreementRef, {
    message: 'A joint or independent controller needs an agreementRef',
    path: ['agreementRef'],
  });

export const dataSharingConfigSchema = z.object({
  recipients: z.array(dataRecipientSchema).max(50).default([]),
  policyVersion: z.string().min(1).max(32).default('1'),
  /** k-anonymity bucket floor. `METRICS_MIN_BUCKET` (5) is the FLOOR, never the
   *  value, so an operator staring at thin numbers cannot dial it below 5. */
  minBucket: z.number().int().min(5).max(100).default(5),
  /** Whole-surface population floor. See §7.3. */
  minPopulation: z.number().int().min(20).max(10_000).default(25),
}).strict();
```

Both thresholds live in exactly one place. `METRICS_MIN_BUCKET` and a new `MIN_AUDIENCE_POPULATION` remain in `@commonpub/server` as **floors only**, referenced by the Zod `.min()` calls and never read as values by any query. Every aggregation function takes the resolved config numbers as parameters. This is the "derive, do not declare twice" rule applied to the plan's own constants, which the draft violated by hard-coding 25 in §7.3 while proposing a config value in its open questions.

`purposeIsOfferable()` (§6.2) refuses to offer any purpose whose recipient list contains an entry lacking a required `agreementRef`. An operator cannot deploy past an unpapered onward transfer; it becomes a config validation error.

### 5.3 Precedence between file and DB, and the config-file drift reconciler

Two semantics already coexist in this codebase and look alike (overrides for features, instance name and terms version; unions for `trustedInstances` and the theme picker). Choosing wrong fails no test, so both are chosen explicitly:

| Setting | Rule | Reason |
|---|---|---|
| `persona.sections` | **DB is a whole-document override of the file.** `effectivePersonaSchema(db, config)` returns `{ sections, source: 'database' \| 'config' \| 'builtin' }` | a section list is one coherent document. A key-by-key merge produces incoherent forms: the operator deletes a section in git and the DB resurrects it. |
| `persona.linkPlatforms` | **UNION of built-ins and file and DB**, deduped by key with the built-in winning | a platform is an additive fact, and a built-in must not be silently redefinable |
| `dataSharing.recipients` | **UNION of file and DB**, like `auth.trustedInstances` (`packages/server/src/federation/oauth.ts:476-489`) | a recipient is an additive fact, and both sources feed the digest so either one appearing re-asks |
| `dataSharing.policyVersion` | **DB override wins**, via `getEffectiveDataSharingPolicyVersion(db, fallback)` | mirrors `getEffectiveTermsVersion` (`packages/server/src/profile/consent.ts:18-31`), the cleanest dual-source idiom in the tree |
| `dataSharing.minBucket`, `minPopulation` | **DB override wins**, both re-floored server-side | an operator may raise them at runtime without a deploy; they can never be lowered past the floor |

**Resolution lives in `@commonpub/server`, never in the fork's `server/utils/config.ts`.** That merge point lives in the consumer app and `layers/base/README.md:47` tells every fork to write its own copy, so threading persona precedence through `refreshDbOverrides()` would make commonpub.io, deveco and heatsync each edit their own file or silently get file-only sections.

```ts
// packages/server/src/persona/registry.ts
export async function effectivePersonaSchema(
  db: DB, config: CommonPubConfig,
): Promise<{
  sections: PersonaSection[];
  source: 'database' | 'config' | 'builtin';
  savedAt: Date | null;
  drift: PersonaSchemaDrift[];      // see below
}>;
```
with a 60s in-process cache keyed on a digest, invalidated on write.

#### 5.3.1 The config-file path bypasses every admin-route guard

`validatePersonaRegistry(effective, { rowCountsByFieldKey })` needs the database to count orphaned rows, and `defineCommonPubConfig()` has none (`packages/config/src/config.ts:20-83`). An operator who edits `commonpub.config.ts`, which requirement 2 explicitly asks for, can rename a key, change a `multiselect` to `text`, or drop an option, deploy, and silently orphan every user's rows with no error, no audit line and no force flag. This is the single largest data-loss path in the design and the draft did not mention it.

**Resolution: a reconciler runs on the first `effectivePersonaSchema` call after boot, and on every schema write.**

```ts
export interface PersonaSchemaDrift {
  kind: 'missing_field' | 'type_changed' | 'sink_changed' | 'missing_option';
  fieldKey: string;
  detail: string;
  affectedRows: number;
  acknowledgedAt: Date | null;
}
```

It diffs the effective schema against `SELECT DISTINCT field_key FROM user_persona_answers` (union the text table) and the distinct stored option values per field, and then:

1. writes one `audit_logs` entry per drift, with `action: 'persona.schema.drift'`, the field key and the affected row count;
2. surfaces the list on `/admin/persona` as a **blocking warning banner** with a per-drift Purge or Retain control (the §4.6 semantics), and on the admin dashboard as a badge;
3. **excludes every drifted field key from `listPersonaAggregatableFields` until it is acknowledged**, so a silent key rename cannot quietly drop a cohort to zero while the endpoint keeps answering;
4. never mutates data on its own. A config deploy can never delete a user's answers without an explicit operator action.

An integration test renames a key in the config source, boots the registry, and asserts the drift row, the audit line, and the field's absence from the aggregatable list.

#### 5.3.2 The revert path is mandatory

`PUT /api/admin/features` merges and never removes (`layers/base/server/api/admin/features/index.put.ts:38`), so a portal-touched flag can never be won back by the git file and the Reset button in `/admin/features` silently does nothing. Persona does not repeat this:

- the DB row stores `{ source: 'admin', savedAt, sections }`;
- `DELETE /api/admin/persona/schema` removes it so the file wins again;
- the editor renders a persistent banner while a DB override exists: "This instance is using an admin edited persona schema. The version in commonpub.config.ts is not applied.";
- each section carries a provenance badge ("from commonpub.config.ts" versus "overridden here") so an operator can see what diverges before pressing Revert.

The same `DELETE`-overrides handler ships for `features.overrides` in the same phase, since the bug is one line away and the fix is identical.

### 5.4 Admin routes and validation

**Never the generic settings route.** `PUT /api/admin/settings` takes `{key: string, value: z.unknown()}` (`packages/schema/src/validators/admin.ts:6-10`, verified) and is how `theme.token_overrides` already bypasses Zod entirely.

| Route | Guard | Notes |
|---|---|---|
| `GET /api/admin/persona/schema` | `requirePermission('settings.manage')` | returns `{ file, db, effective, savedAt, drift }` so the UI shows provenance and drift |
| `PUT /api/admin/persona/schema` | same | `personaSectionsSchema` plus `validatePersonaRegistry()`; `If-Match` on `savedAt` giving 409 `PERSONA_SCHEMA_CONFLICT` with both timestamps, copied from `layers/base/server/api/admin/layouts/[id].put.ts:42-69`; per-field structured errors shaped like `layers/base/server/utils/validateSectionConfigs.ts:88-98`; accepts `removal: Record<fieldKey, 'purge' \| 'retain'>` for every field the save drops |
| `DELETE /api/admin/persona/schema` | same | revert to file |
| `POST /api/admin/persona/drift/:fieldKey` | same | acknowledge a drift with `purge` or `retain` |
| `GET \| PUT /api/admin/data-sharing/recipients` | same | returns `{ configRecipients, storedRecipients }` separately so file-sourced ones render non-editable, like `layers/base/server/api/admin/federation/trusted-instances.get.ts:9-14` |

Three additional guards, because `settings.manage` can still write `instance_settings['persona.sections']` through the generic route:

1. **Sink-side sanitizer.** `effectivePersonaSchema` runs `sanitizePersonaSchema()` on READ, dropping unknown types, over-long options, duplicate keys and any section that fails `personaSectionSchema`, falling back to the config source. This is the `getEmailBranding` defence-in-depth pattern (`packages/server/src/comms/branding.ts:9-19`), not the `getNavItems` raw cast.
2. **Key-lock enforcement on read.** The reader also rejects a DB section whose field key set contradicts the last persisted lock record, so a well-formed template written through the generic route cannot rename a machine key behind the locking UI's back. Anything it rejects surfaces as drift.
3. The generic settings route rejects any key starting with `persona.` with a 400 pointing at the dedicated route.

`validatePersonaRegistry(effective, { rowCountsByFieldKey, platforms })` enforces beyond Zod:

- section keys unique; **field keys unique across all sections** (they are the analytics namespace);
- option values unique per field; every `link` field's `platform` exists in the effective platform set;
- 12 sections maximum, 24 fields per section, 300 fields total, 120 aggregatable buckets total (this bounds the `/metrics/persona/fields` payload and the consent snapshot);
- **key immutability:** a `field_key` with stored rows cannot change `type`, `column` or `sensitive`, and cannot drop an option with stored values, without `?force=true` plus an audit line naming the orphaned row count;
- **`personaFieldSink` stability:** a change that would move a field from `answers` to `text` (or the reverse) is treated as a sink change and requires the same force plus a removal decision, because the existing rows live in the wrong table.

### 5.5 Machine keys are explicit and locked

The contest builder auto-derives the machine key from the label and silently rewrites it on rename (`layers/base/utils/contestStages.ts:154-160`). In a contest that orphans one contest's answers; in a persona it orphans **every user's** rows for that field and drops the cohort to zero in analytics with no error anywhere.

So the persona builder:

- shows the key read-only after first save (the server stamps a lock record on first persist);
- never rewrites it from a label change; renaming a label is free;
- offers an advanced unlock whose confirmation **names the count**: "Change the machine key? This discards 412 stored answers.";
- shows the same count when removing an option that has stored values, and requires an explicit choice between retain (orphan, per §4.6) and purge, with the audit line recording which.

### 5.6 Copy as config

Two affordances, so the operator's stated GitOps loop actually closes:

1. **`layers/base/utils/personaMarkdown.ts`**, mirroring `registrationMarkdown.ts`: a forgiving text DSL parsed to `PersonaSection[]` client-side and saved through the same validated PUT, plus `schemaToPersonaMarkdown` for round-tripping. The parser lives in the layer only as a client-side authoring convenience; the server never trusts it, exactly as the contest DSL is re-validated by the normal contest PUT.
2. **Export**, mirroring `layers/base/utils/themeIO.ts:9-84`: a versioned `persona.sections.json` with `formatVersion: 1` and explicit unsupported-version rejection, plus an "Export for commonpub.config.ts" button emitting a paste-able TypeScript literal.

Workflow: edit in admin, export, commit to the repo, deploy, then `DELETE` the DB override so the file is authoritative. The reconciler in §5.3.1 catches the case where the committed file has drifted from what the DB was serving. Auto-committing to a git repo from the app is explicitly out of scope.

---

## 6. Consent and GDPR

### 6.1 The legal claim, stated once

| | Cookie consent (existing) | Sharing consent (new) |
|---|---|---|
| Basis | ePrivacy: consent to store or read on a device | GDPR Art 6(1)(a): consent to process submitted personal data |
| Subject | anonymous visitor | logged-in user |
| Granularity | one tri-state over all non-essential cookies | one decision per purpose |
| Revocation | change the banner answer | one click, per purpose, any time |
| Storage | `cpub-consent` cookie | `user_purpose_consents` row |
| Surface | banner | `/settings/privacy` |

Modelling the sharing toggles as `CookieDefinition` entries would be a serious error: `category` is a closed 3-value union in both `packages/config/src/types.ts:302-303` and `schema.ts:271-277`, so a fourth category is a breaking change to every operator's `cookies: []` array; and any new non-essential definition changes the cookie scope digest and force-re-prompts every visitor on all three instances for something that sets no cookie at all. **The persona feature introduces zero new cookies.** The one exception, `cpub-persona-invite-dismissed`, is classified `essential` for the same documented reason as `cpub-verify-dismissed`: an explicitly requested preference with no identifier and no tracking, so it does not move the digest.

### 6.2 The purpose registry

New file `packages/config/src/purposes.ts`, exported at the `./purposes` subpath (the `./analytics` subpath is the precedent). Dependency-free so server middleware, SSR pages and the client can all import it.

```ts
export const PROCESSING_PURPOSES = [
  'profile_analytics', 'recruiter_visibility', 'sponsor_sharing',
] as const;                      // every id is <= 24 chars; a test asserts it
export type ProcessingPurposeId = (typeof PROCESSING_PURPOSES)[number];

export const PERSONA_DATA_CLASSES = [
  'persona_selections', 'profile_links', 'location_coarse', 'public_identity',
] as const;

export interface ProcessingPurposeSpec {
  readonly label: string;
  /** What is true while it is OFF. Rendered FIRST, always, and asserted by test. */
  readonly offSummary: string;
  /** What starts happening if it is turned on. */
  readonly onSummary: string;
  readonly covers: readonly PersonaDataClass[];
  readonly disclosedTo: 'this_instance' | 'named_recipients';
  /** Rendered verbatim into the derived privacy-page block, so it has a consumer. */
  readonly legalBasis: 'consent';
  readonly revocationEffect: string;
  /** What happens to the ANSWERS after a revocation. They stay on the user's own
   *  profile; what stops is the processing. Rendered into the privacy block. */
  readonly answersAfterRevocation: 'kept_on_your_profile';
  readonly requiresRecipients: boolean;
  readonly requiresAggregatableField: boolean;
  /** Literal `false`, not `boolean`: shipping a purpose that defaults on is a
   *  typecheck failure, not a test failure. */
  readonly defaultGranted: false;
}

export const PROCESSING_PURPOSE_SPECS: Record<ProcessingPurposeId, ProcessingPurposeSpec>;

/** A purpose that cannot yet do anything is not offered, not listed on
 *  /settings/privacy, and not listed in the derived privacy-page section. */
export function purposeIsOfferable(
  id: ProcessingPurposeId,
  ctx: {
    recipients: readonly DataRecipient[];
    aggregatableFieldKeys: readonly string[];
    /** Purposes whose READ surface does not exist yet (§6.10). */
    enabledPurposes: readonly ProcessingPurposeId[];
  },
): boolean;

export function purposeScopeDigest(input: {
  policyVersion: string;
  dataClasses: readonly string[];
  recipientIds: readonly string[];
  aggregatableFieldKeys: readonly string[];
}): string;
```

The draft declared `legalBasis` and `retentionAfterRevocation` and consumed neither, which is exactly the `METRICS_MIN_BUCKET` failure mode the plan exists to avoid. Both are now rendered into the derived privacy-page block, and `retentionAfterRevocation: 'immediate'` is replaced by `answersAfterRevocation: 'kept_on_your_profile'`, because the previous value was also factually wrong: revoking consent stops the counting, it does not delete the user's own profile answers.

**`contact_email` is in no purpose's `covers`.** Recruiters contact people through instance messaging. An email-bearing consent turns this into a lead-generation product, which is the thing the operator said must not be cringe.

### 6.3 The scope digest

`fnv1a32` moves out of `layers/base/composables/useCookieConsent.ts:72-84` (where it is a private unexported local) into `packages/config/src/digest.ts`, and the cookie composable imports it. Both consent systems then share one hash and one test.

**Byte identity is a hard requirement.** Any drift changes the cookie scope digest and silently invalidates every stored consent on all three instances, forcing a global re-prompt for a refactor with zero user-visible benefit. The move ships with a locked test pinning the exact digest values already asserted in `layers/base/composables/__tests__/useCookieConsent.analytics.test.ts`, and is verified on commonpub.io before deveco.

`purposeScopeDigest` hashes `[policyVersion, ...sorted dataClasses, ...sorted recipientIds, ...sorted aggregatableFieldKeys]`. Including the field keys means adding an aggregatable section also degrades stale `profile_analytics` grants, so consent tracks what is actually counted, not just who receives it.

**The purpose digest is computed server-side only**, unlike the cookie digest, because it is bound into a SQL predicate. `useConfig()` has a 60s TTL and returns base config on the first request after boot (`apps/reference/server/utils/config.ts:102-118`), so a client-computed digest could legitimately disagree for up to a minute.

### 6.4 The consent record

Storage is supersede-then-insert in one transaction: set `superseded_at = now()` on the prior current row, insert the new one. History is complete; "current" is a single indexed row via the partial unique index.

**The writer is explicit: a direct `tx.insert(userConsents)` from the purpose service, never `recordConsent`.** `recordConsent` dedups on "latest row of this kind already has this version" (`packages/server/src/profile/consent.ts:58-77`), so a grant then revoke then grant sequence at one policy version would collapse to a single row, and §13 already rejects `user_consents` as the primary store for exactly that reason. The audit row is written as:

| Column | Value |
|---|---|
| `kind` | `sharing:<purposeId>`, at most 32 characters given the 24-character purpose cap, and the column is widened to `varchar(64)` in 0046 regardless |
| `version` | `<policyVersion>:<state>`, so a revocation is representable, widened to `varchar(64)` in 0046 |
| `documentHash` | the `scopeDigest` (the column is `varchar(64)`, verified) |
| `ipAddress`, `userAgent` | as supplied by the request |

These rows then appear in the DSAR export's existing consents section with no new code.

**`consentInputSchema` is NOT widened.** The draft proposed widening the `.strict()` two-value enum at `packages/schema/src/validators/comms.ts:59-62` so `POST /api/consent` could accept `sharing:*` kinds. Nothing needs that: the sharing audit row is written server-side from `PUT /api/consent/purposes`. Widening it would let any authenticated client POST `{kind: 'sharing:sponsor_sharing'}` to a route that supplies the version itself and records **no scope digest and no state**, producing a row that reads as a grant and authorises nothing. That is the worst of both worlds and it removes a `@commonpub/schema` change from the critical path.

`scopeSnapshot` is a bounded shape, not an arbitrary blob:

```ts
export interface PurposeScopeSnapshot {
  purposeLabel: string;          // <= 120
  offSummary: string;            // <= 400
  onSummary: string;             // <= 400
  recipients: Array<{ id: string; name: string; relationship: string }>;  // <= 50
  dataClasses: string[];         // <= 8 ids, not their descriptions
  aggregatableFieldKeys: string[];   // <= 300 KEYS, never their option lists
  policyVersion: string;
}
```
with `.max()` constraints in Zod and a test asserting a worst-case serialised snapshot is under 8 KB.

**Audit append is deduped on a genuine no-op:** skip both inserts when the incoming `(state, scopeDigest, policyVersion)` triple equals the current row's, so a user toggling a switch to the value it already holds does not write unbounded rows. That is the one piece of `recordConsent`'s dedup worth keeping, and it is narrower: it compares state as well as version.

### 6.5 Degradation

| Prior state | Digest matches | Effect |
|---|---|---|
| granted | yes | authorised. Counted. |
| granted | no | **authorises nothing.** Excluded by the SQL join. Settings shows a passive card: "This needs your confirmation again because we added a recipient." No modal, no email, no nag. |
| revoked | either | still refused. Never re-asked automatically. |
| absent | not applicable | not consented. Never asked twice. |

### 6.6 Endpoints

| Route | Guard | Body and return |
|---|---|---|
| `GET /api/consent/purposes` | `requireAuth`, `requireFeature('dataSharingConsents')` | `{ scopeDigest, policyVersion, purposes: [{ id, label, offSummary, onSummary, recipients, revocationEffect, legalBasis, answersAfterRevocation, state, needsReconfirmation, actedAt }] }`. Server owns every decision, like `/api/consent/status`. Only offerable purposes appear. |
| `PUT /api/consent/purposes` | same | `{ purpose, grant: boolean, scopeDigest }`, `.strict()`. The server supplies `policyVersion`, `scopeSnapshot`, IP and user agent itself, the same reason `layers/base/server/api/consent.post.ts:17-20` supplies the version. **One purpose per request**: a bulk endpoint invites an "enable all" affordance and there will not be one. |

**409 `SCOPE_CHANGED` recovery is specified, not left to chance.** The 409 body carries the full new purpose list plus a diff against the digest the client sent. The settings page renders the diff inline above the affected card ("A recipient was added while you were reading this page: Contoso Tools"), leaves the toggle where the user left it, and requires one more click to confirm against the new scope. Never auto-retry, never auto-apply the pending grant, because that would grant against a disclosure the user has not read.

### 6.7 Erasure and proof, stated honestly

The draft asserted that `subject_ref = HMAC(server_secret, user_id)` is "not personal data under Art 4(1) because the operator holds no means to reverse it to a person". That is false as written, and the review is right to reject it. The operator holds the secret, and user UUIDs survive the account cascade in at least one place: `audit_logs.target_id` is a `varchar(255)` with no FK and no cascade (`packages/schema/src/admin.ts:21`, verified), so an admin action targeting a user leaves that user's id in a row owned by the admin. Given a surviving identifier and the secret, the HMAC is recomputable. Under Recital 26 that makes it pseudonymised personal data, not anonymous data.

**The honest position, which is the one shipped:**

- `consent_proofs` rows are **pseudonymised personal data**. The HMAC is data minimisation, not anonymisation, and the plan says so.
- They are retained under **Art 17(3)(e)** (establishment, exercise or defence of legal claims) together with the Art 7(1) obligation to be able to demonstrate that consent was obtained for the period during which processing occurred. Erasure of the account does not retroactively extinguish that.
- Retention is **bounded and enforced**, not just documented: every row carries `purge_after`, set at write time from a configurable `dataSharing.proofRetentionYears` (default 6, matching the usual contractual limitation period), and a Nitro plugin purges expired rows on the same cadence as the metrics worker. A retention period nobody enforces is a retention period nobody has.
- The row carries `purpose`, `state`, `scope_digest`, `policy_version`, `acted_at` and nothing else: no name, no email, no IP, no user agent, no answers.
- It is listed in the DSAR export's exclusion comment block (`packages/server/src/profile/export.ts:40-49`) **with the Art 17(3)(e) reason written out**, and the retention period appears in the derived privacy-page section.

The rejected alternative, a per-erasure random salt discarded after use, would make the value genuinely one-way but also unlinkable across a single subject's several purposes, which destroys the only thing the record is for. That trade is recorded here so it is not re-proposed.

### 6.8 Surfacing

| Surface | Change |
|---|---|
| Cookie banner (`layers/base/components/CookieConsent.vue`) | **one sentence**, rendered only when at least one purpose is offerable. No third button, no pre-check, no new `CookieDefinition`, no change to the cookie scope digest. |
| `/privacy` | a new **derived** section, added as a key in the existing `sectionKeys` array so numbering stays derived (`layers/base/pages/privacy.vue:15-19`). One block per offerable purpose, rendering `label`, `offSummary`, `onSummary`, recipients with relationship and policy link, `legalBasis`, `revocationEffect`, `answersAfterRevocation`, and the `consent_proofs` retention period. Every sentence that could drift comes from the registry (P1). |
| `/settings/privacy` (**new tab**; Settings has none today, `layers/base/pages/settings.vue:7-33`) | one card per offerable purpose, default off, `offSummary` rendered above `onSummary`; `profileVisibility`, finally settable; Download my data; Delete my account; and a **consent history table** listing every grant and revoke with its date and what was shown at the time. |
| Persona editor | one non-blocking line, no inline toggle. Bundling a consent ask into a Save button is the pattern being avoided. |
| First run | **no consent ask at all** (§8.3). |

### 6.9 Exact plain-language copy

Cookie banner addition:

> We also let you choose what your profile shares. Sharing your details for statistics or with recruiters is a separate choice and is always off unless you turn it on. You can manage it in Privacy settings.

`profile_analytics`:

> **Count my answers in community statistics**
> Right now your answers are only visible on your profile and are not counted anywhere.
> If you turn this on: your interests and tech stack are counted in group totals. Totals are only shown when at least five people share an answer, and counts are rounded. Your name is never attached and nothing about you leaves this site.
> You can turn this off at any time. Turning it off stops your answers being counted in new statistics, usually within a day. Statistics already published for past days are group totals and are not recalculated. Your answers stay on your profile until you change or delete them.

`recruiter_visibility` (registry entry written now, offered only when its read surface ships, see §6.10):

> **Let people hiring see my profile in the members directory**
> Right now nobody outside this site can see your profile through the hiring directory.
> If you turn this on: people the operator has approved for hiring can see what is already on your public profile, plus your interests and tech stack. They cannot see your email address. They contact you through messages on this site.
> You can turn this off at any time. Your answers stay on your profile.

`sponsor_sharing` (rendered only when recipients exist, with each name inline):

> **Share my answers with contest sponsors**
> Right now nothing about you is shared with sponsors.
> If you turn this on: your interests, your tech stack and your public profile links are shared with the sponsors named below.
> Shared with: Acme Robotics, Contoso Tools. Each of these has a privacy policy linked below.
> You can turn this off at any time. Your answers stay on your profile.

Stale-grant card:

> This needs your confirmation again. We added a recipient since you agreed. Nothing is being shared in the meantime.

Suppression explainer, on the admin dashboard and in the API docs:

> Answers are only shown as totals when at least five people chose them, and totals are rounded. On a small instance most answers will be hidden. That is working correctly.

No-snapshot-yet explainer, on the admin dashboard:

> Statistics are worked out once a day. The first set will appear after the next daily run.

**Banned strings**, enforced by a copy-lint test over the persona and privacy component tree: "Help us improve", "Get the most out of", "Unlock", "Boost", "You are missing out", any em dash, any exclamation mark in a consent surface, and any confirm-shaming decline label such as "No thanks, I do not want to be found".

### 6.10 Which purposes actually ship, and when

The draft contradicted itself: an open question recommended shipping `profile_analytics` only, while the phasing table said "purpose cards" without restriction and §6.9 wrote full copy for all three. An implementer would have shipped whichever section they read last.

**Resolution, recorded in the phasing table and not in the open questions:**

| Purpose | Registry entry | Offerable | Prerequisite |
|---|---|---|---|
| `profile_analytics` | Phase 2 | **Phase 2**, once at least one aggregatable field exists | none |
| `recruiter_visibility` | Phase 2 (spec plus copy) | **deferred** | a member-level read surface: per-recipient API keys, `disclosure_events`, and the fourth purpose in §7.3 |
| `sponsor_sharing` | Phase 2 (spec plus copy) | **deferred** | the same read surface, plus at least one declared recipient with a valid `agreementRef` |

`purposeIsOfferable` returns false for the two deferred purposes because `enabledPurposes` does not contain them, so they are absent from `/settings/privacy`, absent from the derived privacy section, and absent from `GET /api/consent/purposes`. Nothing is collected that cannot yet be acted on, which is what Art 4(11) specificity requires and also what keeps the one ask a user will read from being spent on nothing.

**This is a deliberate, named deviation from the literal text of requirement 5**, which asked for all three toggles. The design carries all three; only the offering is staged. The operator should be told this explicitly at review time, and the deferred table in §9 names the exact prerequisite so it does not become an indefinite shelf.

### 6.11 GDPR export

`exportUserData` (`packages/server/src/profile/export.ts:111-134`) is an allow-list where omission is silent. It gains five sections, each added to `UserDataExport`:

| Section | Content |
|---|---|
| `personaAnswers` | section key, field key, value, plus their **labels** resolved from the effective schema, and the **raw key** whenever no label resolves (a retired or drifted field), so nothing is invisible |
| `personaText` | free-text answers, same label-or-raw-key rule |
| `profileLinks` | platform, url, position |
| `purposeConsents` | full history including `scopeSnapshot`, `policyVersion`, IP, user agent |
| (existing consents section) | picks up the `sharing:*` audit rows for free |

The profile section simultaneously **drops** `socialLinks` and `website` (see §4.4.1), so the export neither breaks on a removed column nor double-reports.

Plus a **parity guard** (P7): a test that enumerates the persona tables carrying `user_id` and the `users` profile columns, asserts each appears as a key in `UserDataExport`, and asserts it walked at least 5 tables so a broken path fails red.

---

## 7. Analytics

### 7.1 The automatic-pickup mechanism

A new operator-defined section produces rows in `user_persona_answers` keyed by `field_key`, and the analytics layer reads the effective schema to learn which keys exist. There is therefore no per-section endpoint and no code change when a section is added. This works **only** because answers are normalized; a jsonb blob would need a hand-written extractor per field.

```ts
// packages/server/src/publicApi/personaMetrics.ts
export async function listPersonaAggregatableFields(
  db: DB, config: CommonPubConfig,
): Promise<PersonaFieldDescriptor[]>;   // { sectionKey, sectionLabel, fieldKey, fieldLabel, options, multiValued }

export async function getPersonaFieldDistribution(
  db: DB,
  input: {
    fieldKey: string; limit: number;
    minBucket: number; minPopulation: number;
    scopeDigest: string; source: 'rollup' | 'live';
  },
): Promise<PersonaDistribution>;

export async function getPersonaLinkPresence(
  db: DB,
  input: { minBucket: number; minPopulation: number; scopeDigest: string; source: 'rollup' | 'live' },
): Promise<PersonaLinkPresence>;

export async function getAudienceCounts(
  db: DB,
  input: { minBucket: number; minPopulation: number; scopeDigest: string },
): Promise<AudienceCounts>;
```

`getPersonaFieldDistribution` validates `fieldKey` against `listPersonaAggregatableFields` first, so an arbitrary key is a clean 400 and never a raw SQL bind (validate the domain, not the shape). Drifted and retired keys are already excluded from that list by §5.3.1 and §4.6.

### 7.2 The one query shape

```sql
SELECT a.value, count(*)::int AS n
FROM user_persona_answers a
JOIN users u ON u.id = a.user_id
JOIN user_purpose_consents c
  ON c.user_id       = a.user_id
 AND c.purpose       = 'profile_analytics'
 AND c.state         = 'granted'
 AND c.superseded_at IS NULL
 AND c.scope_digest  = $currentDigest
WHERE a.field_key = $fieldKey
  AND u.deleted_at IS NULL
  AND u.status = 'active'
  AND u.profile_visibility = 'public'
GROUP BY a.value
HAVING count(*) >= $minBucket
ORDER BY n DESC, a.value ASC
LIMIT $limit
```

Six structural guarantees, in order of importance:

1. **Consent is an INNER JOIN, not a post-filter.** A non-consenting user has no row to join to. There is no version of this query without the join, so no code path can forget it.
2. **The digest is bound in the join condition.** Add a sponsor, bump the policy version, or add an aggregatable field, and every stale grant drops out of every aggregate at once, with no migration and no backfill.
3. **`HAVING count(*) >= $minBucket`** is the first real consumer of the `METRICS_MIN_BUCKET` floor (verified: declared at `packages/server/src/publicApi/metrics.ts:41`, zero callers today). Suppressed counts never enter the Node process, so no log or serialisation can leak them.
4. **Free text is in a table this module does not import.** Leakage is a missing import, not a forgotten rule. A source-sweep test asserts `personaMetrics.ts` contains no reference to `userPersonaText`.
5. **`eligibleUsers` is never returned on a distribution.** The draft returned it whenever it cleared the population floor, which is a differencing oracle: for a single-valued field the visible quantised counts plus an exact or near-exact total bound the residual, and with one suppressed bucket the hidden count is recoverable to within a quantum. The population figure appears only on `/persona/audience`, quantised.
6. **Whole-field suppression on single-valued fields.** When `suppressed > 0` and the field's `cardinality` is `'scalar'` (that is, `select`, `radio` or `checkbox`), the entire field returns `{ available: false, reason: 'insufficient_bucket_diversity' }` rather than a partial list. For `multiselect` the sum of buckets does not equal the population, so a partial list is returned with `suppressed` as a bare **bucket count** and no total.

The identical query with `user_profile_links` joined instead of `user_persona_answers`, grouped by `platform`, answers "how many have GitHub, how many have LinkedIn" on `idx_profile_link_platform`.

`/persona/audience` uses a **double** consent join, described in §7.4.

### 7.3 k-anonymity, in four layers

| Layer | Value | Why |
|---|---|---|
| Bucket floor | `dataSharing.minBucket`, default 5, Zod floor `METRICS_MIN_BUCKET` (5) | a bucket of 3 on a 40-person instance re-identifies |
| Population floor | `dataSharing.minPopulation`, default 25 consenting users, Zod floor 20. Below it the whole surface returns `{ available: false, reason: 'insufficient_population' }` | repeated single-field marginals across 18 interests and 16 stack entries narrow membership by intersection even when every individual bucket clears 5 |
| Quantisation | published counts round to the nearest multiple of `minBucket` (report 5, 10, 15, never 7), stated in the payload and in `docs/public-api.md` | a single-person transition becomes invisible unless it crosses a quantum |
| Temporal | the **public** distribution, link and audience endpoints serve from a completed UTC-day `metrics_daily` snapshot, not live SQL. Suppression and quantisation are applied at rollup write | polling a live endpoint hourly lets a caller observe the exact moment a bucket crosses 5 from below, identifying that one person |

**The rollup must actually produce a completed day.** The existing worker upserts *today's* row every 6h from a 15s post-boot start and never writes a "yesterday is final" row (`layers/base/server/plugins/metrics-rollup.ts:13-46`, verified). So the persona pass adds an explicit **end-of-day finalisation**: on every run, if a row for `today - 1` exists and is not marked final, recompute it and set `final = true` in the same upsert; if no row exists for that day at all (the instance was down, or the feature was only just enabled), write nothing and let the endpoint say so. The API always returns `asOf` (the day it served) and, when there is no finalised day yet, `{ available: false, reason: 'no_snapshot_yet' }` with the §6.9 explainer copy.

Two deliberate refusals, documented in `docs/public-api.md` with their reasons:

- **No cross-tabulation** ("rust AND open to recruiters"). A two-dimensional breakdown over a few hundred people re-identifies trivially even above k=5, and `validatePersonaRegistry` rejects any attempt to declare a composite facet. Any future cross-tab needs a much higher threshold, a query budget or a noise model, plus its own flag, not an added query param.
- **No endpoint returns the members of a consenting cohort.** Member-level disclosure is a separate feature needing its own flag, one API key per **named** recipient with the recipient id stamped on the key row, a `disclosure_events` row per (recipient, member, timestamp) written synchronously with the response, a fourth purpose distinct from the aggregate one (consenting to be counted and consenting to be contacted are different asks), and a deletion-surviving tombstone. Naming that boundary is part of this design, and it is the named prerequisite for the two deferred purposes in §6.10.

**The admin dashboard gets no exemption.** The consent is with the user, not with the API, and "3 people are interested in PCB" on a 40-person instance re-identifies regardless of who is looking. The admin page says so in its own help text.

### 7.4 Endpoint family

All under `layers/base/server/api/public/v1/metrics/persona/`, inheriting key auth, per-key rate limiting, CORS and usage logging from the `/api/public/` prefix middleware with zero route-level code.

| Path | Scope | Feature gates | Returns |
|---|---|---|---|
| `GET .../persona/fields` | `read:audience` | `persona` plus `personaAnalytics` | `{ items: PersonaFieldDescriptor[] }` |
| `GET .../persona/distribution?field=interests&limit=20` | `read:audience` | same | `{ field, label, items: [{value,label,count}], suppressed, quantum, available, reason?, asOf }`. **No `eligibleUsers`.** |
| `GET .../persona/links` | `read:audience` | same | `{ items: [{platform,label,count,authenticitySignal}], suppressed, quantum, available, reason?, asOf }` |
| `GET .../persona/audience` | `read:audience` | same plus `dataSharingConsents` | `{ sharingAnalytics, openToRecruiters, openToSponsorSharing, quantum, available, reason?, asOf }`. Quantised counts only, never a roster. |
| `GET /api/admin/persona-metrics` | session plus `requirePermission('audit.read')` | same | same functions, same joins, same suppression |

**`/persona/audience` requires a double consent join.** The draft counted users who granted `recruiter_visibility` or `sponsor_sharing` into an aggregate that neither purpose's copy describes; only `profile_analytics` mentions being counted in group totals. So `openToRecruiters` counts users holding a current, digest-matching grant for **both** `profile_analytics` and `recruiter_visibility`, and likewise for sponsors. No copy change is needed and nobody is counted into a statistic they were not told about.

Route validation copies `layers/base/server/api/public/v1/metrics/content/top.get.ts:4-21` verbatim: Zod `querySchema`, `limit` coerced and bounded 1 to 100 default 20, `safeParse` producing 400 with `error.flatten()`. Response shape follows the family convention `{ items, ... }` with no `toPageMeta` pagination. Feature gates use `requireFeature`, which throws **404** not 403 (`layers/base/server/utils/validate.ts:96-102`), following the `/metrics/federation` double-gate precedent, so a non-participating instance does not reveal the surface exists.

### 7.5 API-key scopes, wildcard protection, purpose limitation, and the timeseries back door

**New scope `read:audience`**, one edit to the `PUBLIC_API_SCOPES` const tuple (`packages/schema/src/validators/publicApi.ts:5-20`), from which the Zod validator, `requireApiScope`'s type and the admin checkbox list all derive. It is deliberately not `read:analytics`: a key already issued for content metrics must not silently gain member cohort data.

**And it must be wildcard-protected.** Verified at `packages/server/src/publicApi/scopes.ts:9-12`: `hasScope` returns true for any `read:` check when the key holds `read:*`, with no protected-leaf branch, unlike `hasPermission` which carves out `contest.pii` (`packages/auth/src/permissions.ts:44-57`). So:

```ts
// packages/server/src/publicApi/scopes.ts
export const WILDCARD_PROTECTED_SCOPES: ReadonlySet<PublicApiScope> = new Set(['read:audience']);

export function hasScope(granted: readonly string[], needed: PublicApiScope): boolean {
  if (granted.includes(needed)) return true;
  if (WILDCARD_PROTECTED_SCOPES.has(needed)) return false;   // NEW
  if (needed.startsWith('read:') && granted.includes('read:*')) return true;
  return false;
}
```

The tuple edit and the protection edit ship in the **same commit**; the tuple edit alone is the regression. The admin key UI derives its disclaimer from the constant (`read:*` renders with "Does not include: read:audience"), and the same line is generated into the `docs/public-api.md` scope table (:49-70) so UI and published contract cannot drift.

**The timeseries back door is closed by not opening it.** The draft registered `persona.field.<fieldKey>` and `persona.link.presence` in a derived `TIMESERIES_METRICS` registry and generated the `/metrics/timeseries` route enum from it. That route is guarded by `requireApiScope(event, 'read:analytics')` and nothing else (`layers/base/server/api/public/v1/metrics/timeseries.get.ts:24`, verified), and `read:*` satisfies it, so every gate above (new scope, wildcard protection, `personaAnalytics`, `persona`, `minPopulation`, `api_keys.purposes`) would have been reachable around through an endpoint that already ships.

So: **persona rollup rows are written to `metrics_daily` but are not registered in `TIMESERIES_METRICS`.** `getMetricsTimeseries` gains an explicit rejection of any metric matching `persona.%`, in addition to its existing unknown-metric guard at `packages/server/src/publicApi/metricsRollup.ts:178`, and the route enum stays `Object.keys(TIMESERIES_METRICS)` (static, which is also what keeps that guard from throwing a plain `Error`). An integration test asserts a `read:analytics` key requesting `metric=persona.field.interests` gets 400, and a second asserts a `read:*` key gets 403 on `/persona/*`.

**Purpose limitation at the read boundary.** Declaring purposes in a registry and then letting any audience key read every field means consent to one purpose functionally authorises all of them. `api_keys` gains a **`purposes` jsonb array** (added in migration 0046, §4.2), populated in the admin key UI from the purpose registry. The aggregation functions take the calling key's purposes, intersect each requested field's data class against the union of those purposes' `covers`, and 404 a field the key's purposes do not cover. A key with an empty `purposes` array reads nothing. A recruiting key and a sponsor key then read different fields, and "your interests are shared with recruiters" becomes a statement the system enforces.

Rate limiting is unchanged (per-key fixed window, `api_keys.rate_limit_per_minute`, default 60). Because the public persona endpoints serve from the rollup snapshot rather than live SQL, the expensive query runs once per day per field, not once per request, which is also why no per-endpoint weighting is needed.

### 7.6 Rollups

`runDailyRollup` gains a persona pass writing:

- `metric = 'persona.field.<fieldKey>'`, `dimension = <option value>`;
- `metric = 'persona.link.presence'`, `dimension = <platform>`;
- `metric = 'persona.audience.<purposeId>'`, `dimension = 'count'`.

**Suppression and quantisation are applied at WRITE**, so the rollup table itself never stores a re-identifying count and the series cannot be differenced across days to recover a small bucket. Revocation therefore never requires rewriting history.

`dimension` is **always a non-empty string**, never NULL (`packages/schema/src/metrics.ts:17-20`).

Gate the pass on `features.personaAnalytics` in addition to the existing `publicApi` and `NODE_ENV !== 'test'` conditions, add the end-of-day finalisation described in §7.3, and document two behaviours: day keys are UTC, and the worker skips entirely when `publicApi` is off, so history is missing on an instance that enables the API later.

### 7.7 OpenAPI and docs

The public spec is a hand-written 405-line literal inside its route handler with nothing testing parity, and it has already drifted (`getTopContent` accepts the deprecated `article` type; the route enum does not).

Persona adds **four static path entries** to that literal, not generated ones. The draft proposed looping `listPersonaAggregatableFields` inside `openapi.json.get.ts`, which would make a published API contract differ per instance and would make the parity test database-dependent. The per-instance field list belongs in the `/persona/fields` response, which is exactly what that endpoint is for.

A new **pure-source** sweep walks `layers/base/server/api/public/v1/**/*.get.ts`, derives each path, and asserts it appears in the emitted spec, with a discovery floor (`expect(routes.length).toBeGreaterThanOrEqual(25)`). **Budget for fixing the pre-existing drift the new test will surface**, in the same roll.

`docs/public-api.md` gets the `read:audience` scope-table row (generated from `WILDCARD_PROTECTED_SCOPES` so the "not covered by read:*" line cannot drift), four endpoint sections, and a rewritten privacy-contract section (:304-313) that describes real behaviour instead of a reserved constant.

---

## 8. UX

### 8.1 The persona editor

`/settings/persona`, a new tab in `layers/base/pages/settings.vue`, gated on `features.persona`. Components live in `layers/base/components/persona/` and are imported **by path**: `components/persona/SectionEditor.vue` auto-registers as `<PersonaSectionEditor>`, and a bare `<SectionEditor>` renders empty with no error and no test failure.

- **Sections** render as `<section>` with a `<button aria-expanded aria-controls>` heading toggling a region. Not a div with `role="button"` (a `role=button` container with button children is a spec violation this codebase has already shipped once), and not `<details>` (the state must be controllable for deep-linking). First two open by default, honouring `collapsedByDefault`.
- **Chip grids** (`multiselect`) are a `<fieldset>` with a `<legend>` (the field label) containing real `<input type="checkbox">` elements in `display: grid` with `grid-template-columns: repeat(auto-fill, minmax(var(--cpub-chip-min), 1fr))`, class `cpub-chip-grid`, `role="group"` and nothing else. Explicitly **not** `role="listbox"` with `aria-selected`, which needs an option, tab or row role prerequisite it will not have. Real checkboxes give keyboard, assistive-technology and form semantics for free.
- Selected state is a 2px border plus `var(--cpub-chip-selected-bg)` plus the sharp offset shadow, **and** the checkbox's own checked state, so it is never colour-only (AA 1.4.1). Minimum 44px target. Focus ring on `:focus-visible` reaching the label via `:has()`.
- **`maxSelections`**: on reaching the cap, unchecked inputs get `disabled` plus a polite live region reading "5 of 5 selected. Clear one to choose another." A click that silently does nothing is worse than a disabled control that explains itself.
- **`link` fields** render one labelled URL input per platform with the platform's placeholder and inline validation against its `hostSuffixes`.
- Every control has `aria-describedby` for help text. Tokens go in `packages/ui/theme/components.css`, never the gitignored `layers/base/theme/`. `var(--*)` only, `cpub-` prefix, `--radius: 0px`, 2px borders, offset shadows with no blur.
- A **"Data from removed fields"** block appears at the bottom when retired data exists (§4.6), with a per-field Delete control.

**Save is per section**, dirty-gated, explicit. Not one giant form (a 34-checkbox page must not lose everything on a validation error) and **not autosave** (a silent background write on a privacy-relevant surface is the wrong affordance).

### 8.2 The operator schema editor, and why it is not `FormTemplateEditor`

The draft said `/admin/persona` would reuse `FormTemplateEditor.vue` with a `lockKeys` prop. It cannot. That component is a controlled component over `FormField[]` and emits whole `FormField` objects including a **mandatory** `required: boolean` plus `pii`, `terms`, `accept` and `maxSizeKb` (`packages/schema/src/validators/contest.ts:149-184`, verified). `personaFieldSchema` is `.strict()` and rejects all of them (§3.3), so every save would 400. Worse, the editor's PII toggle would render a control that `personaFieldSink` never reads, which is the exact drift class §3.4 exists to prevent.

**Resolution: share the sub-components, not the host.** Three presentational pieces are extracted from `FormTemplateEditor.vue` into `layers/base/components/formbuilder/`:

| Extracted | Contents |
|---|---|
| `FormBuilderFieldShell.vue` | the card chrome, the up/down reorder chevrons with edge `:disabled`, the aria-live position announcement, the delete control |
| `FormBuilderOptionList.vue` | the option add/edit/remove list with unique-value validation |
| `FormBuilderTypePicker.vue` | the grouped type menu, **driven by `FIELD_TYPE_SPECS` filtered by a `surface` prop**, with the aria-haspopup menu semantics and the "Current (feature disabled)" group |

`ContestFormTemplateEditor` keeps its exact current behaviour and composes these three. `PersonaSchemaEditor` composes the same three over `PersonaField[]`, adds key locking (§5.5), provenance badges, drift acknowledgement, and the pre-save validation the contest builder lacks (a choice field with a blank option, which today 400s server-side with nothing flagged in the UI).

This is **not** the "second persona-only field taxonomy" that §13 rejects: the taxonomy is one, `FIELD_TYPE_SPECS`, shared by both editors through the type picker. What is duplicated is a host component, which is exactly what a `.strict()` schema difference requires.

### 8.3 Completeness

`personaCompleteness(schema, answers)` is a pure exported function in `@commonpub/config` returning `{ perSection, filledFields, totalFields, percent, points }`.

Default rendering (`completeness: 'progress'`) is a neutral meter: `role="progressbar"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`, plus the text equivalent "4 of 9 sections filled in", plus one honest line: "This is all optional. Fill in what you want people to see." No score, no streak, no leaderboard, no percentage shaming, no red state, no decay.

`'points'` exists because the community's norms are the operator's call, and renders per-field `points` as badges plus per-selection `pointsPerSelection` capped by `maxSelections`, which is what the inspiration screenshot's "+4 PTS EACH (MAX 5)" actually expresses. Three rules make it not-cringe, all testable:

1. Points never unlock anything.
2. Points never appear on the public profile in v1 (a visible score becomes social pressure to over-share).
3. **Points never increase for enabling a sharing toggle.** Sharing is not an achievement.

The meter binds to the SSR'd persona DTO. If answers are not in the SSR payload it renders a skeleton with `aria-busy`. It is never seeded to `ref(0)`: shipping a false zero to first paint is a lie in the HTML and in crawlers, not just a hydration warning (P8).

### 8.4 First run: the decision and the rationale

**Decision: a dismissible, resumable invitation shown after first sign-in, in-flow on `/dashboard`, plus a permanent `/settings/persona` route and one contextual offer after a successful contest registration. Not a signup step. Not a blocking gate.**

Four reasons, in weight order:

1. **Registration is already a consent-critical surface.** `layers/base/pages/auth/register.vue:165-176` has one **required** checkbox covering Terms, Code of Conduct and Privacy. Putting 34 optional checkboxes and three sharing toggles on the same form makes it impossible to tell which of it is mandatory. Consent bundled with getting the service is not freely given (Art 7(4)), and persona data collected in a signup flow reads as mandatory no matter how it is labelled. That alone settles it.
2. **Registration is not the only door.** `layers/base/server/api/auth/federated/callback.get.ts:47-63` sends OAuth and federated signups straight to `/dashboard` without ever rendering `register.vue`. Referral attribution already needed a server-side backstop middleware for exactly this hole. On an ActivityPub platform, a first-run step that exists only on the register page is invisible to the growth path.
3. **A blocking overlay self-locks and is a dark pattern here.** `TermsReacceptanceGate.vue:13-20` had to add `/terms`, `/privacy`, `/cookies` suppression once it became plugin-mounted, and it is backed by real write-blocking server middleware because it enforces a legal obligation. A persona gate would need to exempt all of `/settings/*`, `/auth/*` and sign-out, and would still block someone who came to read one article, for data that is optional by definition.
4. **An empty form is the worst first impression.** Someone who has seen nothing of the instance does not know what "pcb" or "embedded" mean in *this* community's context. The natural high-intent moment on deveco is contest registration, which comes later.

**Mechanism.** The server owns the decision, mirroring `/api/consent/status`: `GET /api/persona/status` returns `{ enabled, hasAnyAnswer, completeness: { filled, total }, dismissals }`. No client-side inference, because `ClientAuthUser` carries no profile fields at all (`layers/base/composables/useAuth.ts:4-14`).

**SSR handling is specified, not left implicit.** The status call is per-viewer data, so it uses `useLazyFetch('/api/persona/status', { server: false })` and the banner renders nothing (not a zero, not a skeleton meter with a number) until it resolves. Alternatively the dashboard's own SSR payload carries the status object and the banner derives from it with `computed`. Either is acceptable; a `watch(fetch, { immediate: true })` seed is not, and neither is `ref(0)`. This is the documented recurring class that shipped "0 makers registered" in session 253.

**`PersonaInvitationBanner.vue` renders in-flow on `/dashboard` only**, modelled on `EmailVerificationBanner.vue`: `role="status"`, 44px targets, print-suppressed.

**Dismissal is persistent, not per-session.** A session-scoped cookie would re-ask a user who has answered nothing every single session, forever, which is a soft nag and violates P11. The rule is: dismissal writes `cpub-persona-invite-dismissed` with a one-year maxAge (classified `essential`, §6.1), and after the **second** dismissal the server records `personaInviteDismissedTwice` in the user's `emailNotifications`-adjacent preference (via the merge-safe writer from Phase 0) and `GET /api/persona/status` never offers it again on any device. It also never returns once any answer is saved, and `firstRun: 'off'` disables it entirely.

It is **deliberately not plugin-mounted**, inverting this codebase's usual rule with a stated reason: `global-overlays.client.ts` exists so a consumer fork that overrides `layouts/default.vue` cannot drop things it must not drop (deveco lost both the cookie banner and the terms gate that way). An optional invitation is precisely the case where a fork **should** be able to drop it. And plugin mounting appends last in the DOM, making the element the last tab stop, which is correct for a non-blocking offer only if it must not steal focus. Living in one page rather than every layout also keeps the fork-copy cost to a single file. Verify before shipping that deveco does not fork `pages/dashboard.vue`; if it ever does, the card moves to the overlay plugin and takes the tab-order hit.

`user:registered` (`packages/server/src/hooks.ts:103-109`) is emitted on every account creation and has zero subscribers. Persona does not need it (eligibility is derived from `hasAnyAnswer === false`), but it is noted as the fork-free hook for a future welcome email.

### 8.5 Empty states

| Surface | Copy |
|---|---|
| Persona editor, nothing filled | "Nothing here yet. Pick whatever you want people to see. You can change it at any time." |
| Public profile, owner viewing, no persona | "You have not filled in your profile details yet. Add your interests and tech stack" (link) |
| Public profile, visitor, no persona | render nothing. No empty scaffolding, no "this user has not completed their profile" |
| Admin audience dashboard, below population floor | "There are not enough people sharing statistics yet to show totals safely. Totals appear once at least 25 people have turned sharing on." |
| Admin audience dashboard, all buckets suppressed | "No answer has been chosen by at least five people yet." |
| Admin audience dashboard, no finalised day | "Statistics are worked out once a day. The first set will appear after the next daily run." |
| Admin persona editor, drift detected | "Some questions in the config file no longer match the answers already stored. Choose what to do with each before these questions are counted again." |

### 8.6 Accessibility

WCAG 2.1 AA throughout. Specific commitments:

- Contrast is scored against the **literal token values** in `packages/ui/theme/`, across every theme, not against the intended hex. A scorer that measured `#000000` while the code emitted `#0a0a0a` shipped 4.40:1 once already.
- `@testing-library/vue` plus axe-core on the editor, the invitation card, the admin schema editor and the privacy tab.
- Chip selection is additionally verified at 390px in Playwright, because `dispatchEvent` in jsdom bypasses `pointer-events` hit-testing entirely.
- jsdom needs the `PointerEvent` polyfill (MouseEvent subclass) already in the test setup.
- Live regions are `aria-live="polite"`, never `assertive`.

### 8.7 Anti-cringe rules as tests

Two of the draft's eight tests were satisfiable while broken; both are strengthened.

| # | Rule | Test |
|---|---|---|
| 1 | No pre-checked sharing box | mount `/settings/privacy` with zero consent rows, assert every switch is unchecked. Plus the `defaultGranted: false` literal type. |
| 2 | No bundling | save a full persona with no consent rows, assert `user_purpose_consents` has zero rows |
| 3 | No nag on refusal | a `revoked` row produces no prompt anywhere; a digest change produces only a passive card, never a modal and never an email |
| 4 | Symmetric friction | assert no confirmation dialog on revoke |
| 5 | No consequence for declining | **strengthened:** sweep `layers/base/**` for the symbol `PROCESSING_PURPOSES` and for imports of the persona consent module, excluding `components/persona/**`, `pages/settings/privacy.vue` and `pages/privacy.vue`; assert zero hits, with `files.length >= 40` (the draft's route-only import sweep passed if the gating moved into a component or a shared helper) |
| 6 | Equal-weight choices | both buttons are real buttons of the same size; the refuse action is never a text link beside a filled button |
| 7 | Points never attach to sharing | **strengthened:** call `personaCompleteness` for a fixture user, then again with every purpose granted, and assert the two results are **deep-equal**; the draft's signature check was satisfiable by smuggling consent inside an existing object argument |
| 8 | No banned strings | copy lint over the persona and privacy component tree, with a file-count floor |
| 9 | **NEW:** off-state first | assert `offSummary` appears before `onSummary` in DOM order on every purpose card, so the strongest anti-dark-pattern rule in the design is a test rather than a convention |
| 10 | **NEW:** dismissal is terminal | dismiss the invitation twice, assert `GET /api/persona/status` never offers it again for that user, on a fresh cookie jar |

---

## 9. Phasing

### Phase 0: profile privacy prerequisites
**Flags:** one new, `strictProfileVisibility` (default false). **Migration:** none. **Ships:** no user-visible feature.

- Split `getUserByUsername` into `getOwnProfile` and `getUserProfileForViewer` (an allow-list serializer in the `toPublicUser` style, so new columns are private by default), stopping `emailNotifications` reaching anonymous viewers.
- Enforce `profileVisibility` and `status !== 'suspended'` on `/api/users/:username` and `/api/users` (member directory), **unflagged**, because those are app-internal surfaces with no remote consumers.
- Enforce the same on WebFinger and the AP actor route **behind `strictProfileVisibility`, default false for one release, then flipped**. This changes federation-visible behaviour and standing rule 2 requires a flag for it. The chosen status code is **404**, not 410: Mastodon and most implementations treat 410 Gone as a tombstone and delete the remote actor, while 404 leads to retry and backoff, which is the right semantics for a suspension that may be lifted. No `Delete(Actor)` activity is emitted. Blast radius today is near zero because `profile_visibility` defaults `'public'` and nothing can set it (verified), which is precisely why the flag must exist before Phase 2 makes it settable.
- Fix the `emailNotifications` whole-object clobber (`packages/server/src/profile/profile.ts:169`) to a merge, so `unsubscribedAll` survives a profile save.
- Move `httpUrl` and `optionalUrl` into `packages/config/src/url.ts`; re-export from `_shared.ts`; add the dependency-direction test and the subpath-resolution test.
- Move `FormField`, `isFormFieldPii`, `isRequiredFormField`, `templateHasRequiredField` into `packages/config/src/forms.ts` with `FIELD_TYPE_SPECS` closed by `satisfies`; re-export through `packages/schema/src/forms.ts`; derive the four hand-written lists in `FormTemplateEditor.vue` from it; **fix the `pii: checked || undefined` bug at `FormTemplateEditor.vue:402`**.
- Extract `FormBuilderFieldShell`, `FormBuilderOptionList` and `FormBuilderTypePicker` (§8.2) with `ContestFormTemplateEditor` behaviour unchanged.
- Extract `mergePrivateFields` from `recordPrivateAndAgreements`.
- Cap `socialLinksSchema` at `optionalUrl(512)`.
- Add the flag-mirror parity sweep and fix the four flags missing from `useFeatures.ts`.
- Add the `DELETE`-overrides handler for `features.overrides`.
- Add the DSAR parity guard over the existing profile column allow-list.

**Acceptance:** every existing contest test passes unchanged; the contest builder screenshot-diffs clean. Pre-roll count of `profile_visibility <> 'public'` and `status = 'suspended'` rows per instance, plus a release note, because flipping the flag later hides profiles that have been publicly visible for months.

### Phase 1: registry, schema, migration
**Flags:** three added (`persona`, `dataSharingConsents`, `personaAnalytics`), all inert. **Migration:** `0046_persona_and_purposes.sql`.

- `packages/config/src/persona.ts` (`PersonaField`, `PersonaSection`, `personaFieldSink`, `isPersonaFieldAggregatable`, `personaCompleteness`, `PERSONA_LINK_PLATFORMS`, `effectiveLinkPlatforms`, `BUILTIN_PERSONA_SECTIONS`, the Zod schemas) plus the compile-time parity guards.
- `packages/schema/src/persona.ts`: the five Drizzle tables and the re-export.
- `multiselect` and `link` added to `FORM_FIELD_TYPES` and `FIELD_TYPE_SPECS`, with `maxSelections` on `FormField`, one case in `validateSubmissionFields` (JSON parse to a string array, subset of options, dedupe, cap, canonical sorted re-serialisation), client `parseMultiselect` and `serializeMultiselect`, and a type alias in the `registrationMarkdown` DSL so its round trip stays lossless. **Contest forms gain chip grids here.**
- `packages/config/src/digest.ts` (`fnv1a32` lifted, pinned by the existing cookie digest assertions) and `packages/config/src/purposes.ts`.
- Migration 0046: five tables, `api_keys.purposes`, the two `user_consents` column widenings, and the set-based backfill with pre and post row-count assertions.
- `personaConfigSchema` and `dataSharingConfigSchema`, with both thresholds resolved from config and floored by the constants.
- New `exports` subpaths on `packages/config/package.json`.

**Publish order:** `@commonpub/config`, then `@commonpub/schema`.

### Phase 2: consent core
**Flag:** `dataSharingConsents` (default false). **Migration:** none.

- `recordPurposeConsent` (supersede-then-insert, direct `tx.insert(userConsents)` audit row, dedup on a genuine no-op), `getPurposeConsentState`, `currentPurposeScope`, `effectivePurposeGrant`.
- `GET` and `PUT /api/consent/purposes` with the 409 `SCOPE_CHANGED` diff handshake.
- **Only `profile_analytics` is offerable** (§6.10). `recruiter_visibility` and `sponsor_sharing` ship as registry entries with copy and `purposeIsOfferable` returning false.
- `/settings/privacy`: purpose cards (default off, `offSummary` first, recipients inline), `profileVisibility` made settable, export and delete links, consent history table.
- Derived `data-sharing` section on `/privacy`, keyed into `sectionKeys`, rendering `legalBasis`, `answersAfterRevocation` and the `consent_proofs` retention period.
- One sentence in the cookie banner; no new `CookieDefinition`.
- `consent_proofs` write on erasure plus the retention purge plugin.
- DSAR export gains `purposeConsents`. `consentInputSchema` is **not** touched.
- **All ten dark-pattern tests land here**, before any UI can violate them.

Ships before collection so there is never a window where persona data exists without a revocation path.

### Phase 3: persona editor and rendering
**Flag:** `persona` (default false). **Migration:** none.

- `packages/server/src/persona/`: `registry.ts` (`effectivePersonaSchema`, the cache, the drift reconciler), `values.ts` (read and write with the template-scoped delete and the removal semantics), `completeness.ts`. Barrel exports through `packages/server/src/index.ts`.
- `GET` and `PUT /api/persona`, `GET /api/persona/status`, `DELETE /api/persona/retired/:fieldKey`.
- `/settings/persona` editor, chip grids, per-section save, live region, retired-data block, axe pass.
- Public rendering on `/u/:username` through the Phase 0 viewer projection, honouring `showOnProfile` (opt IN, so a default instance renders nothing) and `sensitive`.
- Completeness meter bound to the SSR'd DTO.
- `PersonaInvitationBanner` on `/dashboard`, with persistent two-strike dismissal and `server: false` status fetching.
- AP Person key-set pin and the persona-free source sweep on the actor route.
- **The whole §4.4.1 cutover in one commit**: DTO, `toPublicUser`, DSAR allow-list, `updateProfileSchema`, the settings form inputs and the three hand-mirrored shape declarations, with a public-API wire-shape test on both sides of the change.
- DSAR export gains `personaAnswers`, `personaText`, `profileLinks`; parity guard extended.

**deveco turns `persona` on here.**

### Phase 4: operator schema editing
**Flag:** `persona`. **Migration:** none.

- `GET`, `PUT` and `DELETE /api/admin/persona/schema` with `If-Match` 409, per-field errors and the `removal` map; `POST /api/admin/persona/drift/:fieldKey`; `GET` and `PUT /api/admin/data-sharing/recipients`.
- `/admin/persona` built on the extracted form-builder sub-components, with key locking, provenance badges, the drift banner, the working Revert, and the pre-save validation the contest builder lacks.
- `personaMarkdown` DSL round trip, `persona.sections.json` export and import, and the "Export for commonpub.config.ts" literal.
- `sanitizePersonaSchema` on read plus the `persona.` prefix rejection on the generic settings route.
- The boot-time reconciler wired to the admin dashboard badge.
- New permission checked by `all-routes-gated.test.ts` for free.

### Phase 5: analytics
**Flag:** `personaAnalytics` (default false). **Migration:** none (`metrics_daily.dimension` and `api_keys.purposes` both already exist).

- `packages/server/src/publicApi/personaMetrics.ts` with the consent inner join, the digest in the join, `HAVING >= minBucket`, the population floor, quantisation, whole-field suppression on scalar fields, and no `eligibleUsers` on distributions.
- Four routes under `/api/public/v1/metrics/persona/`, plus `/api/admin/persona-metrics`.
- `read:audience` **and** `WILDCARD_PROTECTED_SCOPES` in the same commit; `api_keys.purposes` enforcement at the read boundary.
- The `persona.%` rejection in `getMetricsTimeseries`, with its two negative tests.
- Rollup pass writing suppressed, quantised, non-empty-dimension rows, plus the end-of-day finalisation.
- Four static OpenAPI path entries, the pure-source route-versus-spec parity sweep with its discovery floor, and the pre-existing drift it surfaces.
- `docs/public-api.md` scope row, endpoint sections, rewritten privacy contract.
- `EXPLAIN ANALYZE` on a seeded 10k-user database; add an index only if measured.

### Deferred, named explicitly

| Deferred | Prerequisite before it can be considered |
|---|---|
| `recruiter_visibility` and `sponsor_sharing` becoming offerable | the member-level disclosure surface below |
| Member-level disclosure to a recipient | per-recipient API keys with the recipient id on the key row, `disclosure_events` written synchronously with the response, a fourth purpose, the erasure-surviving tombstone, its own flag |
| Cross-facet intersection queries | a query budget or noise model, a much higher floor, its own flag |
| Federating persona fields as AP `attachment` or PropertyValue | an `Update(Person)` activity path, without which a revocation cannot propagate |
| Dropping `users.social_links`, `users.website`, `users.timezone` | one minor release of read-dead soak, then a numbered scrub migration |
| Per-key schema registry for `instance_settings` | separate work; filed |
| Making `tel` default-partitioned as personal data on the contest surface | a contest-side behaviour change with its own migration of existing answers |

---

## 10. Test plan

### 10.1 Unit (`@commonpub/config`, `@commonpub/schema`)

- `FIELD_TYPE_SPECS` keys equal `FORM_FIELD_TYPES` (the `satisfies` clause makes an omission a typecheck failure; a runtime assertion with a floor of 17 catches a regression that reintroduces `as`).
- `isFormFieldPii` behaviour is byte-identical to today, including `email` and `signature` with `pii: false` and with `pii: undefined`, and `address` and `file` with `pii: false`.
- `personaFieldSink`: `sensitive: true` forces `'text'`; `analytics: false` forces `'text'`; a `column:` binding forces `'none'`; a `link` forces `'links'`.
- `personaFieldSchema` rejects `{ required: true }` and `{ pii: true }` (the `.strict()` guarantee stated in §3.3).
- `personaSectionsSchema`: duplicate field keys across sections rejected; blank option values rejected; a `multiselect` with zero options rejected; a `link` with no platform rejected; `maxLength` on an unsupported type rejected; the 120-bucket cap enforced.
- `effectiveLinkPlatforms`: an operator platform with a built-in key does not override the built-in; a URL is validated against `hostSuffixes` with exact-host and dot-suffix matching, and `evilgithub.com` does **not** match `github.com`.
- `fnv1a32` produces the exact digests already pinned in `useCookieConsent.analytics.test.ts` (**locked contract**).
- `purposeScopeDigest` changes when a recipient is added, when the policy version bumps, and when an aggregatable field key is added; does not change on field label edits.
- `purposeIsOfferable`: false for `sponsor_sharing` with zero recipients; false for `profile_analytics` with zero aggregatable fields; false for any purpose absent from `enabledPurposes`.
- `effectivePurposeGrant`: stale grant gives false; stale refusal stays refused; matching grant gives true.
- `dataRecipientSchema`: a `joint_controller` without `agreementRef` fails.
- `dataSharingConfigSchema`: `minBucket: 3` fails the floor; `minPopulation: 10` fails the floor.
- Every `ProcessingPurposeId` is at most 24 characters, so `'sharing:' + id` fits `user_consents.kind`.
- `personaCompleteness` output is deep-equal with and without every grant.
- `PurposeScopeSnapshot` at worst case serialises under 8 KB.

### 10.2 Component (`@testing-library/vue` plus axe)

- Chip grid: real checkboxes, `fieldset` and `legend`, no `aria-selected`, 44px targets, `maxSelections` disables and announces.
- Section toggle uses `<button aria-expanded aria-controls>`, no nested-button violation.
- `/settings/privacy` with zero consent rows: every switch unchecked; `offSummary` precedes `onSummary` in DOM order.
- Revoke path has no confirmation dialog.
- `PersonaInvitationBanner` renders nothing until status resolves, never a zero meter; second dismissal is terminal.
- `PersonaSchemaEditor` blocks a save with a blank choice option and names the field, rather than 400ing server-side.
- `ContestFormTemplateEditor` after the sub-component extraction: reorder, type change and PII toggle behave exactly as before, and unchecking PII on an `email` field now emits `pii: false`.
- Copy lint over the persona and privacy trees: no em dash, no banned string, with a file-count floor.

### 10.3 Integration (`packages/server`, real test DB via `createTestDB`)

`packages/server/src/__tests__/personaMetrics.integration.test.ts`:

| Case | Expected |
|---|---|
| user with answers, no consent row | absent from every aggregate |
| granted then revoked | absent |
| granted with a stale digest | absent |
| `profile_visibility <> 'public'` | absent even when granted |
| suspended or soft-deleted | absent |
| four consenting users in one bucket of a `multiselect` | bucket suppressed, `suppressed: 1`, no total returned |
| four consenting users in one bucket of a `select` | **whole field** suppressed, `available: false, reason: 'insufficient_bucket_diversity'` |
| five consenting users | bucket visible, count quantised to a multiple of `minBucket` |
| eligible population below `minPopulation` | whole surface `available: false, reason: 'insufficient_population'` |
| no finalised rollup day | `available: false, reason: 'no_snapshot_yet'`, `asOf: null` |
| any distribution response | contains no `eligibleUsers` key at all (arithmetic differencing case) |
| a free-text answer | never appears in any distribution |
| a `sensitive: true` field | absent from `/persona/fields` |
| a drifted or retired field key | absent from `/persona/fields` |
| `/persona/audience` for a user holding only `recruiter_visibility` | not counted in `openToRecruiters` (double-join case) |
| a `read:*` key | 403 on `/persona/*` |
| a `read:analytics` key requesting `metric=persona.field.interests` | 400 on `/metrics/timeseries` |
| a key whose `purposes` exclude the field's data class | 404 on that field |
| a key with an empty `purposes` array | 404 on every field |

`personaValues.integration.test.ts`: unchecking every box in a section clears the rows (the template-scoped delete); a partial save of section A does not touch section B; an unknown field key is rejected; the 0046 backfill produces exactly `count(social_links keys in the seven) + count(non-empty website)` link rows and preserves a link longer than 512 characters; a field removed with `purge` deletes its rows in the same transaction; a field removed with `retain` keeps them, surfaces them in `GET /api/persona`, exports them by raw key, and can be deleted by the user.

`purposeConsent.integration.test.ts`: grant, revoke, grant writes three `user_purpose_consents` rows and three `user_consents` audit rows and leaves exactly one row with `superseded_at IS NULL`; a no-op toggle writes nothing; `kind` and `version` fit their widened columns; deletion writes `consent_proofs` before the cascade with a populated `purge_after` and leaves zero `user_purpose_consents` rows; the purge job deletes an expired proof.

`personaRegistry.integration.test.ts`: a DB override wins whole-document; `DELETE` reverts to file; a malformed DB row falls back to config through `sanitizePersonaSchema`; a key renamed in the config source produces a drift row, an audit line, and exclusion from `listPersonaAggregatableFields` until acknowledged.

### 10.4 Scanning tests, each with its own guard (P7)

| Test | Floor |
|---|---|
| Flag mirror parity across `packages/config/src/schema.ts`, `types.ts`, `apps/reference/server/utils/envFlagMap.ts`, `layers/base/nuxt.config.ts`, `layers/base/composables/useFeatures.ts` | asserts it parsed all 5 files and found at least 45 flags |
| Every `layers/base/server/api/public/v1/**/*.get.ts` path appears in the emitted OpenAPI (pure source, no DB) | `routes.length >= 25` |
| DSAR export covers every persona table and profile column | `tables.length >= 5` |
| AP actor route contains no persona reference | asserts the file read is non-empty |
| `layers/base/**` outside the persona and privacy trees contains no `PROCESSING_PURPOSES` symbol and no persona-consent import | `files.length >= 40` |
| `packages/config/src/**` contains no `@commonpub/schema` import | `files.length >= 8` |
| `personaMetrics.ts` contains no `userPersonaText` reference | asserts the file read is non-empty |
| Copy lint | `files.length >= 10` |

### 10.5 E2E (Playwright, `apps/reference/e2e/`)

- Persona fill at 390px: check chips, hit the `maxSelections` cap, save one section, reload, answers persist.
- Privacy tab: all toggles off on a fresh account; grant `profile_analytics`; revoke it in one click with no dialog; consent history shows two entries with dates.
- A user who never grants: their answers never appear in `/api/admin/persona-metrics`.
- The cookie banner still shows two buttons and its stored value still matches `/^all(%7C|\|)\w+$/`, proving the digest lift changed nothing.
- Admin: rename a field label (key unchanged, no warning), then attempt a key change and see the orphan count in the confirmation.
- Dev server restart discipline: `@commonpub/config`, `@commonpub/schema` and `@commonpub/server` run from `dist`, so every persona server or config change needs a dist rebuild **and** a dev-server restart before any browser check. Layer files HMR live and will look correct against stale package code.

---

## 11. Rollout

### 11.1 Publish order

Dependency order is strict:

1. `@commonpub/config` (URL validator, digest, forms, persona, purposes, config schemas, four flags, new export subpaths)
2. `@commonpub/schema` (persona tables, migration 0046, `read:audience` in the scope tuple, `socialLinksSchema` cap, re-export shims)
3. `@commonpub/server` (persona registry, values, consent, personaMetrics, scope protection, timeseries rejection)
4. `@commonpub/ui` (chip grid tokens in `packages/ui/theme/components.css`)
5. `@commonpub/layer` via `pnpm publish:layer` (never `npm publish` from `layers/base`, which would ship the literal `workspace:*`)

Verify a package actually changed before publishing; a glob false-negative once shipped a broken layer.

### 11.2 Version pins

**A schema change requires each fork's DIRECT `^@commonpub/schema` pin to be bumped**, because a `0.x` caret will not cross a minor. A fork that takes the layer without bumping the schema pin gets a layer whose routes query five tables that do not exist, because `db-migrate` silently skips 0046. This is the reason everything schema-shaped is in one migration.

Mitigation in code: the persona server module probes for `user_persona_answers` on first use and, if absent, logs an operator message and lets `requireFeature` return 404 rather than 500ing. The same probe covers `api_keys.purposes`.

Current baselines to bump from: `@commonpub/config` 0.38.0, `@commonpub/schema` 0.63.0 (both verified).

### 11.3 Prerelease verification

For each phase that touches a published package:

1. `pnpm publish --tag next` for the changed packages.
2. Open a **draft PR** on the fork pinned to the rc (fork CI needs a PR, not a branch push). The fork's CI is the only thing that typechecks the published layer; local tarballs do not work because of `workspace:*` and package-manager contamination.
3. Green CI, then promote to `latest`.
4. Consumer lockfiles: bump **both** `package-lock.json` (deveco, gitignored) and `pnpm-lock.yaml` (heatsync, tracked).
5. Post-publish, poll `npm view` rather than masking an install behind `&&`; the registry replica lags.

### 11.4 Instance sequence

| Instance | Order | Notes |
|---|---|---|
| commonpub.io | first | all flags off after Phase 0 to 2; canary for the digest lift, the `socialLinks` cutover and the `profileVisibility` enforcement |
| deveco | second | turns on `persona` at Phase 3, `dataSharingConsents` at Phase 3 completion, `personaAnalytics` at Phase 5, and `strictProfileVisibility` one release after Phase 0. Forks `layouts/default.vue`, so verify it does not also fork `pages/dashboard.vue` before shipping the invitation banner. |
| heatsync | third | flags off; takes the roll for the Phase 0 fixes only |

Migrations are applied via `db-migrate.mjs` or `db:push`. Never hand-edit a production database over SSH.

Verify flag state empirically with `curl /api/features` before making any claim about what is on. After deploy, verify **behaviour**, not presence: a green deploy with a 200 on the route proved nothing the last time analytics silently measured nothing. For this feature specifically, the post-deploy check is: create a throwaway account, fill one chip grid, confirm zero rows in `user_purpose_consents`, grant analytics, confirm the row and its digest, and confirm the aggregate endpoint still says `insufficient_population`.

### 11.5 What an operator must do to adopt

1. Upgrade `@commonpub/config`, `@commonpub/schema` and the layer; **bump the direct `^@commonpub/schema` pin**, because a `0.x` caret will not cross a minor and `db-migrate` will otherwise skip 0046 in silence.
2. Run migrations via `db-migrate.mjs`. Confirm `user_persona_answers`, `user_persona_text`, `user_profile_links`, `user_purpose_consents` and `consent_proofs` exist, and that `api_keys.purposes` is present.
3. **Add the four new flags to this fork's own env-flag map.** `apps/reference/server/utils/envFlagMap.ts` is the reference app's copy only; deveco and heatsync each carry their own, because `layers/base/README.md:47` instructs every fork to write its own `server/utils/config.ts`. The in-repo parity sweep cannot see a fork's copy, so a missing entry fails silently at env-override time and the flag simply never responds to `FEATURE_PERSONA`.
4. Set `features.persona = true`.
5. Either accept `BUILTIN_PERSONA_SECTIONS` or add a `persona: { sections: [...] }` block to `commonpub.config.ts`, or build sections in `/admin/persona` and export them back to the file. If both exist, the database wins whole-document and the editor says so; `DELETE /api/admin/persona/schema` hands authority back to the file.
6. After any config-file edit that changes a field key, an option value or a field type, **check `/admin/persona` for the drift banner**. Drifted fields stop being counted until the operator chooses Purge or Retain for each. This is the only guard between a one-line config edit and every user's answers for that field becoming unreachable.
7. To offer sharing: declare `dataSharing.recipients` with a `relationship` and, for non-processors, an `agreementRef`; set `features.dataSharingConsents = true`. In this release only `profile_analytics` is offerable; `recruiter_visibility` and `sponsor_sharing` are registered and documented but not shown, pending the member-level disclosure surface (§6.10).
8. To read aggregates: set `features.publicApi = true` and `features.personaAnalytics = true`, mint an API key with `read:audience` (it is **not** covered by `read:*`), and set the key's `purposes`. A key with an empty `purposes` array reads nothing.
9. Expect nothing to appear until at least `minPopulation` people have opted in, at least `minBucket` have chosen the same answer, and one full UTC day has been finalised by the rollup worker. That is correct behaviour, and the dashboard says so in all three cases.
10. If the instance federates, plan the `strictProfileVisibility` flip as its own release, one release after Phase 0, with the pre-roll count from §9 in the release notes.

### 11.6 Rollback

| Change | Rollback |
|---|---|
| Any flag | flip it off; every route 404s via `requireFeature`, no data is touched |
| Persona schema edit | `DELETE /api/admin/persona/schema` reverts to the config file; stored answers are untouched |
| `socialLinks` cutover (Phase 3) | the `users.social_links` and `users.website` columns remain populated and unread for one minor release; reverting the layer restores the old readers with no data loss. This is the entire reason for the read-dead soak period |
| Migration 0046 | not reversible in place. Rolling back the layer while leaving the tables is safe (nothing reads them when `persona` is off). A down migration is written but is expected never to run |
| `strictProfileVisibility` | flip it off; remote instances that received 404s retry and recover, which is why 404 was chosen over 410 |

---

## 12. Open questions

Resolved items have moved into the body of the plan and are marked as such; what remains are genuine decisions for the operator or for counsel.

| # | Question | Recommendation |
|---|---|---|
| 1 | `minPopulation` default 25. Too high for deveco's first months? | **Keep 25, floored at 20 in Zod, operator-adjustable.** Under-suppressing on a small maker community is the failure that cannot be undone; a dashboard that says why it is empty is recoverable. Now a config value in `dataSharingConfigSchema`, not a constant (§5.2). |
| 2 | Should `points` completeness ship at all? | **Yes, as opt-in, default `'progress'`.** The operator's community norms are their call. `pointsPerSelection` plus `maxSelections` expresses the screenshot's "+4 PTS EACH (MAX 5)" (§8.3). The config comment records why the default is the plain meter. |
| 3 | `consent_proofs` retention period. | **Six years by default**, matching the usual contractual limitation period, enforced by `purge_after` and a purge job rather than only documented. Confirm with the operator's counsel; the value is `dataSharing.proofRetentionYears`. |
| 4 | ~~Should `recruiter_visibility` ship in v1?~~ | **Resolved in §6.10 and the Phase 2 entry, not here.** All three purposes are registered with copy; only `profile_analytics` is offerable; the other two are deferred behind the named member-level disclosure prerequisite. Flag this deviation from requirement 5's literal text at review. |
| 5 | Does deveco fork `pages/dashboard.vue`? | **Verify before Phase 3.** If yes, the invitation moves to the overlay plugin and accepts the tab-order cost (§8.4). |
| 6 | Should the persona editor allow an operator to mark a field aggregatable without an Art 9 acknowledgement? | **No.** Require an explicit acknowledgement checkbox naming the nine special categories, and write the acknowledgement to `audit_logs`. No code can detect that a field named "health_conditions" is special-category data; the record is the only mitigation. |
| 7 | Quantisation to the nearest `minBucket` reduces precision. Acceptable? | **Yes, and state it in the payload as `quantum`.** A caller who needs exact counts on a small community is asking for re-identification. |
| 8 | Should `users.skills` eventually be retired in favour of a `tech_stack` multiselect? | **No. Keep both.** Free text is the escape hatch for a stack nobody has added to the vocabulary yet; the closed vocabulary is what makes counting honest. |
| 9 | Does `instance_settings` need a per-key schema registry? | **Yes, but not here.** File it. Persona defends itself with a sink-side sanitizer, a key-lock check on read, and a `persona.` prefix rejection on the generic route. |
| 10 | Should the `strictProfileVisibility` flip be announced to affected users? | **Yes.** Pre-roll count per instance, plus a note on the settings page for anyone whose profile becomes hidden, plus a release note for federating peers. |
| 11 | **NEW.** Should a suspended actor return 404 or a tombstoned actor document? | **404, no `Delete` activity.** 410 Gone causes most implementations to delete the remote actor permanently, which is wrong for a suspension that may be lifted; 404 leads to retry and backoff. Revisit only if a peer implementation is observed to purge on 404. |
| 12 | **NEW.** Should `tel` become default-partitioned as personal data on the contest surface? | **Not in this work.** It is a real defect (a phone number lands in the public artifact partition unless the operator ticks `pii`), but fixing it changes stored contest data and needs its own migration of existing answers. Filed in the deferred table. |
| 13 | **NEW.** Is HMAC-with-a-held-secret an acceptable minimisation for `consent_proofs`, given it is not anonymisation? | **Yes, with the honest framing in §6.7.** The alternative (a discarded per-erasure salt) is genuinely one-way but unlinkable across one subject's several purposes, which destroys the record's only use. Confirm the Art 17(3)(e) framing with counsel. |
| 14 | **NEW.** Should the `metrics_daily` persona rows be readable at all outside the persona family? | **No, and the plan enforces it** by rejecting `persona.%` in `getMetricsTimeseries` and never registering the series. If a future operator wants persona time series, they get a persona-family timeseries endpoint behind `read:audience`, not a registration in the shared registry. |

---

## 13. Rejected alternatives

| Alternative | Why rejected |
|---|---|
| **A single `users.persona` jsonb blob** | Kills the automatic-analytics requirement: a `jsonb_array_elements` scan per query with no usable index, and every new operator section needs a hand-written extractor. Repeats the exact failure already in the tree (`socialLinks`: seven keys hand-mirrored across four files, two collected and never rendered), and makes deleting one answer a read-modify-write race against a concurrent save. Multiselect membership degrades to substring matching, so "3d printing" matches a query for "printing". |
| **Putting the field and section type layer in `@commonpub/schema` while `personaConfigSchema` lives in `@commonpub/config`** | A package cycle. `personaConfigSchema` needs `personaSectionSchema`, which needs `FORM_FIELD_TYPES`; and the config-side `dataRecipientSchema` needs the URL validator that lives in schema. Neither package imports the other today (verified), so nothing absorbs the edge. The type layer goes down into config; schema depends on config; a test pins the direction (§3.1). |
| **Reuse the contest answer tables by relaxing `contest_agreements_one_scope`** | `contest_entry_private_fields`, `contest_registration_private_fields` and `contest_agreement_acceptances` all carry a NOT NULL `contest_id` with an entry-XOR-registration CHECK; `recordPrivateAndAgreements` hard-codes both branches and demands a `contestId`; file fields are welded to the literal purpose `'contest'` with no non-contest read path; every PII type sits behind contest-named flags and the `contest.pii` permission. Migrating a live legal-consent audit table on three instances buys nothing the new tables do not. |
| **Reuse `FormField` verbatim with a 16th type and no registry** | Drags `contestPii` and `contestPrivateFiles` gating and contest-shaped PII routing into the profile, and leaves the unguarded hand-mirrored type union in place. The answer is to extract the field layer **and** add `FIELD_TYPE_SPECS`, so persona narrows by `surfaces` rather than by declaring a rival union. |
| **Closing `FIELD_TYPE_SPECS` with `as Record<FormFieldType, FormFieldTypeSpec>`** | A trailing `as` assertion suppresses exactly the missing-key check the registry exists to provide, which is why the draft's own literal was missing five types and stubbed five more. `satisfies` performs the check and preserves the literal's narrow types (§3.2). |
| **A second persona-only field taxonomy alongside the extracted `FormField`** | That is the disparate-system outcome requirement 3 forbids. Note the distinction: the plan does ship a **second host component** (`PersonaSchemaEditor`), because `personaFieldSchema` is `.strict()` and rejects the mandatory `required` the contest editor emits. The **taxonomy** stays single, shared through `FIELD_TYPE_SPECS` and the extracted type picker (§8.2). |
| **Reusing `FormTemplateEditor.vue` wholesale for the persona schema** | It emits whole `FormField` objects including a mandatory `required: boolean` plus `pii`, `terms`, `accept` and `maxSizeKb` (`packages/schema/src/validators/contest.ts:149-184`). Every persona save would 400, and its PII toggle would render a control `personaFieldSink` never reads. Share the three sub-components instead. |
| **Model the three sharing toggles as `CookieDefinition`s or a fourth cookie category** | Wrong legal basis. `category` is a closed 3-value union in both TS and Zod, so a fourth is a breaking change to every operator's `cookies` array. Any new non-essential definition changes the cookie scope digest and force-re-prompts every visitor on every instance for something that sets no cookie. And it places the ask beside an "Accept all" button, which is bundling. |
| **Extend `user_consents` with new `kind` values instead of a new table** | It is accept-only and deduped by version (`packages/server/src/profile/consent.ts:58-77`), so it cannot express a revocation or a current state at all. Keep it as the append-only audit trail, which is exactly what it is good at, written by a direct `tx.insert` rather than through `recordConsent`. |
| **Widening `consentInputSchema` so `POST /api/consent` accepts `sharing:*` kinds** | Nothing needs it: the audit row is written server-side by the purpose service. Widening it would let any authenticated client POST a `sharing:` kind to a route that records no state and no scope digest, producing a row that reads as a grant and authorises nothing. It also removes a `@commonpub/schema` change from the critical path (§6.4). |
| **Reuse `contest_agreement_acceptances` and an `agreement` field for the sharing consents** | Accept-only with no withdrawal representation, and revocability is the entire point of a data-sharing permission. Reusing it would produce a consent record that cannot express "no". |
| **Claiming `consent_proofs` rows are not personal data** | A pseudonym the controller can re-link is still personal data (Recital 26), and user UUIDs survive the account cascade in `audit_logs.target_id`, a `varchar(255)` with no FK and no cascade (verified). The retention is defended on Art 17(3)(e) plus Art 7(1) with an enforced `purge_after`, not on a false anonymisation claim (§6.7). |
| **Save the persona schema through the generic `PUT /api/admin/settings`** | That route accepts `{key, value: z.unknown()}` and is exactly how the theme token map already bypasses Zod. Dedicated validated routes, plus a sink-side sanitizer and a `persona.` prefix rejection, because the generic hole still exists. |
| **Key-by-key merge of file and DB persona sections** | A section list is one coherent document; merging produces forms no operator authored, and resurrects sections deleted in git. |
| **Trusting the config file to be as safe as the admin route** | `defineCommonPubConfig()` has no database and cannot count orphaned rows, so a one-line config edit can silently orphan every user's answers for a field. The reconciler in §5.3.1 diffs, audits, warns and stops counting drifted keys, and never deletes data on its own. |
| **Registering persona series in `TIMESERIES_METRICS`** | `/metrics/timeseries` is guarded by `read:analytics` alone and `read:*` satisfies it (verified), so this would route around the new scope, its wildcard protection, both feature flags, the population floor and the per-key purpose limitation at once. Write the rollup rows; do not register the series; reject `persona.%` explicitly (§7.5). |
| **Returning `eligibleUsers` beside a distribution** | A differencing oracle. For a single-valued field the visible quantised buckets plus the population bound the suppressed residual to within one quantum. The population appears only on `/persona/audience`, quantised, and a scalar field with any suppressed bucket is suppressed entirely (§7.2). |
| **Counting `recruiter_visibility` and `sponsor_sharing` grants into `/persona/audience` on their own** | Neither purpose's copy says the holder will be counted in statistics; only `profile_analytics` does. The endpoint requires both grants via a double inner join, which needs no copy change and counts nobody into a statistic they were not told about (§7.4). |
| **Generating the OpenAPI persona paths from the database** | A published API contract that differs per instance is not a contract, and it would make the parity sweep database-dependent and unable to keep an honest file-count floor. Four static path entries; the per-instance field list lives in `/persona/fields` (§7.7). |
| **Serving persona aggregates live** | Polling a live endpoint hourly lets a caller watch a bucket cross the threshold from below, which identifies the one person who crossed it. Serve a finalised UTC day from `metrics_daily`, with suppression applied at write, and say `no_snapshot_yet` when there is not one (§7.3). |
| **Collect the persona at registration** | Bundles optional collection with the one required terms consent on a form where the user cannot tell what is mandatory (Art 7(4)), and misses every OAuth and federated signup, which never render `register.vue`. |
| **A blocking first-run gate in the `TermsReacceptanceGate` shape** | That pattern exists for a legal obligation and is backed by write-blocking middleware. Blocking on optional data is a dark pattern, and the gate would need `/settings/*`, `/auth/*` and sign-out exempted or it self-locks the user. |
| **Plugin-mounting the invitation card** | `global-overlays.client.ts` exists so a fork **cannot** drop what it must not drop. An optional invitation is the one case where a fork should be able to. Plugin mounting also makes it the last tab stop. |
| **A session-scoped dismissal for the invitation** | Re-asks a user who has answered nothing every session, forever, which is a nag. Persistent cookie plus a server-recorded second dismissal that is terminal (§8.4). |
| **PTS badges as the default completeness affordance** | Manufactured scarcity attached to voluntarily disclosing personal data. Available as an operator choice; not the default. |
| **`hostPattern: RegExp` in the link-platform registry** | Not serialisable into a config file that must round-trip through JSON export, and an operator-supplied pattern is a denial-of-service vector. `hostSuffixes: string[]` with exact-host and dot-suffix matching is serialisable, linear-time and operator-declarable (§3.5). |
| **Federating persona data as AP `attachment` or PropertyValue** | There is no `Update(Person)` path, so remote copies refresh only on re-fetch and a revocation could never propagate. Revocability and federation are in direct tension; instance-local is the honest answer. The actor literal is pinned by a guard test so a later careless edit cannot change that silently. |
| **Cross-tab queries in v1** | Two suppressed marginals plus one intersection reconstruct individuals. Needs a query budget or a noise model, not a query param. |
| **Differential-privacy noise instead of suppression** | Dishonest at these magnitudes: noise on a count of 6 produces a number that is neither true nor safe, and invites callers to average it away over repeated polls. |
| **Dual-writing `users.social_links` alongside `user_profile_links` until a later read-flip** | Seeding one entity through two APIs is the documented split-brain trap, and the draft's version would have left the settings form writing a column nobody reads while `toPublicUser` and the DSAR export still read it. One cutover commit covering all five readers and writers, with the columns retained unread for one minor release as the rollback path (§4.4.1). |
| **`varchar(512)` for `user_profile_links.url`** | `socialLinksSchema` has no length cap today (verified), so the set-based backfill would throw `value too long` on the first offending row and roll back the whole migration on a production instance. The column is `text`; new writes are capped at 512 by Zod; a pre-migration count query goes in the release notes. |
| **A second migration for `api_keys.purposes`** | §11.2's direct-pin hazard scales with the number of migrations a fork can silently skip. Everything schema-shaped lands in 0046. |
| **Hard-coding `MIN_AUDIENCE_POPULATION = 25` in the query module** | The plan's own P1. Both thresholds are operator-resolved config values; the constants are Zod floors only, never read as values by a query (§5.2). |

---

## Appendix A: critique dispositions

Thirty-one findings were raised. Twenty-nine are accepted in full and are reflected in the body above. Two are accepted in substance with a correction to the stated reasoning, and are recorded here rather than silently altered. Nothing was ignored.

### Accepted in full

| # | Finding | Where it landed |
|---|---|---|
| 1 | config↔schema cycle | §3.1 (type layer moves to `@commonpub/config`; schema depends on config; direction test), §13 |
| 2 | Backfill aborts on a long social link | §4.2 (`url text`), §4.4 (pre-check query, `optionalUrl(512)` cap), §13 |
| 3 | Persona series bypass every gate via `/metrics/timeseries` | §7.5, §7.6, §10.3, §12 Q14, §13, P12 |
| 5 | `api_keys.purposes` had no migration | §4.2 (folded into 0046), §9 Phase 1, §11.2 |
| 6 | `consent_proofs` "not personal data" is false | §6.7 rewritten on Art 17(3)(e) with an enforced `purge_after`; §12 Q13; §13 |
| 7 | `FormTemplateEditor` cannot be reused | §8.2 (three extracted sub-components, separate host), §9 Phase 0 and Phase 4, §13 |
| 8 | `surfaces` does not enforce property omission | §3.3 (restated as `.strict()`), §10.1 negative tests |
| 9 | Removed fields orphan personal data | §4.6 (purge or retain, retired block, raw-key export), §5.4 `removal` map, §10.3 |
| 10 | Config-file path bypasses every guard | §5.3.1 (reconciler, audit, blocking banner, exclusion from the aggregatable list), §11.5 step 6, §13 |
| 11 | `socialLinks` retirement breaks two contracts | §4.4.1 (one cutover commit covering five readers and writers), §6.11, §9 Phase 3 |
| 12 | `eligibleUsers` is a differencing oracle | §7.2 guarantees 5 and 6, §7.4 payload shape, §10.3, §13 |
| 13 | `/persona/audience` counts non-consenting users | §7.4 double consent join, §10.3 |
| 14 | Rollup freshness makes the copy untrue | §7.3 end-of-day finalisation, `asOf`, `no_snapshot_yet`; §6.9 copy amended to "usually within a day"; §8.5 |
| 15 | OQ4 contradicted Phase 2 | §6.10 (resolution table), §9 Phase 2, §12 Q4 marked resolved, deferred table |
| 16 | Widening `consentInputSchema` opens a hole | §6.4 (not widened), §9 Phase 2, §13 |
| 17 | Audit writer unspecified and would dedup; length overflow | §6.4 (direct `tx.insert`, `kind`/`version` scheme), §4.2 (both columns widened to 64, purpose capped at 24), §10.1 |
| 18 | Link platforms closed despite the promise | §3.5 (`hostSuffixes`, operator-declarable, no RegExp), §5.3 union rule, §10.1, §13 |
| 19 | Phase 0 changed federation behaviour unflagged | §5.1 and §9 Phase 0 (`strictProfileVisibility`), §11.4, §11.6, §12 Q11 |
| 20 | Thresholds declared twice | §5.2 (config values; constants are floors only), §7.3, §12 Q1, §13 |
| 21 | Redundant indexes | §4.2 (three prefix indexes dropped, `idx_users_audience_eligible` dropped pending `EXPLAIN`), §9 Phase 5 |
| 22 | Missing `exports` subpaths | §3.1, §9 Phase 1, §10.1 subpath-resolution test |
| 23 | `envFlagMap` is per-fork | §5.1, §10.4 floor note, §11.5 step 3 |
| 24 | Two registry fields unconsumed | §6.2 (`legalBasis` and `answersAfterRevocation` rendered into the privacy block; the wrong `retentionAfterRevocation: 'immediate'` removed), §6.8 |
| 25 | Two anti-cringe tests were unfalsifiable | §8.7 rules 5 and 7 strengthened (symbol sweep with exclusions; deep-equal completeness) |
| 26 | DB-generated OpenAPI | §7.7 (four static entries, pure-source sweep), §13 |
| 27 | Timeseries route enum would go async | Moot after finding 3; the explicit `persona.%` guard ships anyway (§7.5) |
| 28 | Invitation re-nags every session | §8.4 (persistent cookie plus terminal second dismissal), §8.7 rule 10, §13 |
| 29 | No SSR guidance for `/api/persona/status` | §8.4 (`server: false` or SSR-seeded; never `ref(0)`) |
| 30 | `industry` and per-selection points unmodelled | §3.3 (`pointsPerSelection`), §3.6 (`industry` select), §8.3 |
| 31 | Copy reads clean; make the off-first rule a test | §8.7 rule 9 |

### Accepted with a corrected rationale

**Finding 4, on `FIELD_TYPE_SPECS`.** The substance is entirely right: `as Record<...>` suppresses the missing-key check, the draft's literal was missing five types, and this was the plan's only parity mechanism for the drift it claimed to fix. All of that is adopted in §3.2, using `satisfies` and writing out all seventeen entries.

One clause is inaccurate and should not propagate: the critique says the cast "also violates the strict-mode/no-cast conventions". `CLAUDE.md` forbids `any`; it does not forbid type assertions, and assertions appear throughout the tree (for example `packages/server/src/navigation/navigation.ts:106-112` returns `raw as NavItem[]`). The reason to reject the cast here is specific and sufficient: it defeats the exhaustiveness guarantee. Framing it as a blanket convention violation would license the wrong generalisation.

**Finding 19, on the federation blast radius.** The recommendation is adopted in full: the WebFinger and actor-route enforcement ships behind `strictProfileVisibility`, and the 404-versus-410 question is answered explicitly (§9 Phase 0, §12 Q11).

The stated consequence overshoots slightly. "Existing follows and delivery break" is stronger than the protocol behaviour warrants: a 404 on actor re-fetch is treated as a transient failure by the common implementations, which retry with backoff, whereas 410 Gone is the response that causes a remote instance to purge the actor and its follow relationships. That distinction is not a reason to skip the flag, it is the reason 404 is the correct code and no `Delete(Actor)` is emitted, so the correction strengthens the fix rather than weakening it. The critique's own parenthetical, that the blast radius is near zero today because nothing can set `profile_visibility`, is correct and is why the flag exists before Phase 2 rather than after.

### One addition the critique did not raise

While verifying finding 4, `tel` was found to be absent from `isFormFieldPii`'s default-personal set (`packages/schema/src/contest.ts:169-174`), so a phone number collected on a contest form lands in the public artifact partition unless the operator ticks the PII box. It is a real defect on an existing surface, it is out of scope for this work because fixing it moves stored contest answers between tables, and it is recorded in §1.2, §3.2, the §9 deferred table and §12 Q12 so it is not lost.

---

## Appendix B: second-pass audit (2026-08-12)

A second review pass over the finalised document, verifying its claims against the tree rather than
against the first critique. Sixteen findings. None invalidate the architecture; five change what an
implementer must build, and are marked accordingly. Every code claim below was read at the cited line.

### Must fix before Phase 1

**B1. `column: 'website'` is dead on arrival, and `website` has two homes.**
`UserBridgeColumn` (§3.3) includes `'website'`. But §4.4 migrates `users.website` into a
`platform = 'website'` row, §4.4.1 step 4 removes `website` from `updateProfileSchema` and from
`updateUserProfile`'s input handling, and §4.5 routes every `column:`-bound field through
`updateUserProfile`. After Phase 3 a persona field declaring `column: 'website'` writes nowhere.
§3.5 also seeds `website` as a link platform, so the same datum is addressable two ways.
**Fix:** drop `'website'` from `UserBridgeColumn`. It is a link platform, not a bridge column.
Evidence: `packages/schema/src/validators/auth.ts:45` (`website: optionalUrl(512)`),
`packages/schema/src/auth.ts:17`.

**B2. Purpose limitation has nothing to key on.**
§7.5 says the aggregation functions "intersect each requested field's data class against the union of
those purposes' `covers`", and concludes that "a recruiting key and a sponsor key then read different
fields". `PersonaField` (§3.3) carries no data-class property, and every aggregatable persona field is a
closed-vocabulary selection, so all of them map to the single class `persona_selections`.
`api_keys.purposes` is therefore all-or-nothing and the differentiated-keys claim is unachievable as
written.
**Fix:** either add `dataClass?: PersonaDataClass` to `PersonaField` (defaulting from
`personaFieldSink`, validated against `PERSONA_DATA_CLASSES`, included in `purposeScopeDigest`), or
restate §7.5 as a per-purpose on/off gate and delete the differentiated-keys sentence. The first is
better and costs one optional property.

**B3. The consent copy does not disclose the `profile_visibility` exclusion.**
§7.2 filters `u.profile_visibility = 'public'` and §10.3 tests "absent even when granted". So a user who
grants `profile_analytics` and later sets their profile to non-public is silently not counted, having
been told "your interests and tech stack are counted in group totals" (§6.9) with no caveat. This lands
exactly when Phase 2 makes `profileVisibility` settable for the first time.
**Fix:** add one sentence to the `profile_analytics` copy, and surface an inline note on the toggle when
the viewer's own profile is not public. Suggested: "While your profile is set to private, your answers
are not counted, even with this turned on."

**B4. The generic-settings hole is closed for `persona.` and left open for `dataSharing.`.**
§5.4 adds a sink-side sanitizer plus a `persona.` prefix rejection on `PUT /api/admin/settings`
(`packages/schema/src/validators/admin.ts:6-10`, `{key: string, value: z.unknown()}`, verified). The
`dataSharing.*` keys are DB-overridable per §5.3 and get neither. `dataSharing.recipients` written
through the generic route bypasses `dataRecipientSchema` entirely, including the `agreementRef` refine
that §5.2 relies on to stop an unpapered onward transfer, and recipients feed both the scope digest and
the rendered disclosure copy. A malformed recipient is strictly worse than a malformed persona section.
**Fix:** extend the prefix rejection to `dataSharing.`, and add a recipients sanitizer on read.
`minBucket` and `minPopulation` are already re-floored on read and need nothing further.

**B5. `dataSharingConfigSchema`'s floors are the plan's own P1 violation.**
§5.2 prose says `METRICS_MIN_BUCKET` is "referenced by the Zod `.min()` calls". The code block writes
the literals `.min(5)` and `.min(20)`, and it cannot do otherwise: `METRICS_MIN_BUCKET` lives in
`@commonpub/server` (`packages/server/src/publicApi/metrics.ts:41`) and `@commonpub/config` must not
import it, since §3.1 fixes the dependency direction as schema and server depending on config.
**Fix:** move both floors into `@commonpub/config` as pure numbers and re-export from
`@commonpub/server`, so `packages/server/src/publicApi/metrics.ts`'s existing export site is unchanged
and the Zod `.min()` calls can reference the real constants.

### Should fix

**B6. The hand-written `ALTER`s will be reverted by the next `drizzle-kit generate`.**
§4.2 widens `user_consents.kind` and `.version` to `varchar(64)` and adds `api_keys.purposes` in raw SQL,
but does not say to update the Drizzle definitions. `packages/schema/src/auth.ts:178-179` still declares
`{ length: 32 }` for both, and `packages/schema/src/publicApi.ts:13-33` has no `purposes` column
(both verified). The next generate emits a down-alter.
**Fix:** state that the Drizzle column definitions change in the same commit as the SQL.

**B7. `FIELD_TYPE_SPECS[f.type]` throws where today's code returns `false`.**
§3.2 claims the refactored `isFormFieldPii` "keeps its exact current behaviour, verified line by line".
It does not for an unrecognised `type` read out of a stored template jsonb: the current if-chain falls
through to `return false` (`packages/schema/src/contest.ts:169-174`), while the registry lookup
dereferences `undefined` and throws.
**Fix:** `const spec = FIELD_TYPE_SPECS[f.type]; if (!spec) return true;` and a test. Fail closed, since
this is the predicate that decides whether an answer is personal data. Note the change explicitly rather
than describing it as behaviour-preserving.

**B8. Quantisation rounds to nearest, which can overstate.**
§7.3 publishes counts "rounded to the nearest multiple of `minBucket`", so a true 8 is published as 10.
On a small instance that is a false statement, and it inflates every cohort an operator is using to make
recruiting and sponsorship decisions. Flooring to the multiple never overstates and is equally
protective.
**Fix:** floor, and say so in the payload description and in `docs/public-api.md`.

**B9. `/persona/audience` ships two structurally-zero fields.**
§7.4 returns `openToRecruiters` and `openToSponsorSharing`, while §6.10 makes both purposes
non-offerable in this release. Nobody can grant them, so both counts are permanently 0. Publishing a
hard zero that means "not implemented" rather than "nobody opted in" is the session-253 false-zero class
(P8) on an API surface.
**Fix:** omit the keys, or return `{ available: false, reason: 'purpose_not_offered' }` per purpose.

**B10. The scope digest's field-key sensitivity has an unexamined cost.**
§6.3 includes every aggregatable field key in the digest, which is correct in principle: consent should
track what is actually counted. The consequence is not analysed. On an instance where the operator tunes
sections, which this feature exists to encourage, every added aggregatable field degrades every
`profile_analytics` grant and puts a re-confirm card in front of every consenting user. Repeated
re-asking is how people are trained to click through consent, which is the failure mode P11 exists to
prevent.
**Fix:** make it an explicit decision in §12. Either accept the churn and say so, or digest data classes
and recipients only, treating a new field inside an already-consented class as covered, and re-ask only
when a class or a recipient changes.

### Minor

**B11.** §4.8 states "all five new tables cascade on `users.id`", then exempts `consent_proofs` in the
same sentence. `consent_proofs` has no `user_id` column by design (§4.2). Say "four of the five".

**B12.** The §4.4 backfill calls `jsonb_each_text(u.social_links)`, which errors on a non-object jsonb
value and would roll back the whole migration on one bad legacy row. Every current writer goes through
`socialLinksSchema`, so the risk is low, but this is the one place where low risk is still a production
rollback. Add `AND jsonb_typeof(u.social_links) = 'object'`, in the same spirit as the `url text`
decision.

**B13.** §4.5's template-scoped delete is specified only for `user_persona_answers`. `user_persona_text`
and `user_profile_links` need the same treatment, or clearing a text field or removing a link silently
leaves the old value, which is the Art 16 and Art 17 argument the section makes for itself.

**B14.** §3.3's `maxLength` comment says "text/textarea/url/number/date only". `FIELD_TYPE_SPECS` sets
`supportsMaxLength: false` for `number` and `date`, and the §3.7 refine enforces the registry. Fix the
comment, not the registry.

**B15.** §8.4 parks the terminal-dismissal flag in "the user's `emailNotifications`-adjacent preference".
`users.email_notifications` is the column whose whole-object clobber Phase 0 exists to fix, it is typed
as an email-preference shape, and it is exported to the DSAR under that name. "Adjacent" will be read as
"in it". Give the flag a real home.

**B16.** Supersede-then-insert under the partial unique index `uq_purpose_current` races: two concurrent
writes for one `(user, purpose)` both update zero rows and both insert, and one takes a unique violation.
Map it to a retry or a 409, not a 500.

### Verified sound, for the record

Spot-checked and confirmed correct as written: the `isFormFieldPii` registry refactor is behaviourally
identical for every known type; every existing reader of `user_consents` filters by `kind`
(`packages/server/src/profile/consent.ts:66`) or dumps all rows (`export.ts:231-237`), so the
`sharing:*` rows are safe to add; the `read:*` wildcard hole, the `/metrics/timeseries` scope gap, the
unused `METRICS_MIN_BUCKET`, the uncapped `socialLinksSchema`, the `emailNotifications` leak in the
profile DTO and the `FormTemplateEditor` PII-toggle bug are all real and correctly cited; and the
document contains zero em dashes.

---

## Section 14: Isolation, separation of concerns, and the v1 build spec

**This section is AUTHORITATIVE for implementation and supersedes any earlier section it contradicts.**
Sections 3 through 13 remain the reasoning record. Where this section says "do not", the earlier
section describing that work is deferred, not cancelled.

Written after an isolation review (2026-08-12) against a verified reading of the tree. The goal the
operator set: this feature must be changeable later without breaking anything around it.

### 14.1 The problem with the plan as written

Sections 3 through 9 reach into eight live subsystems: the contest form engine, the cookie consent
composable, the profile DTO, the public API wire shape, the API key model, the shared metrics rollup,
the GDPR consent table, and the federation actor route. Most of that reach buys persona very little.

The decisive observation: **persona shares almost nothing behavioural with the contest form engine.**
Persona has no `required` (section 3.3), no `pii` (it partitions by `personaFieldSink`, section 3.4),
never calls `isFormFieldPii`, never calls `isRequiredFormField`, has its own renderer, and section 8.2
already concluded it cannot reuse `FormTemplateEditor`. What the two actually share is a list of field
type NAMES and three presentational sub-components. Moving `FormField`, `isFormFieldPii` and the URL
validators out of `packages/schema` to serve that is a large refactor of a live system in exchange for
cosmetic unity.

Requirement 3 ("not a disparate system") is satisfied by following the house architecture, not by
physically merging two type unions. The house architecture is verified below.

### 14.2 Verified constraints that decide the boundaries

| Fact | Consequence |
|---|---|
| `packages/schema/drizzle.config.ts` sets `schema: './src/*.ts'`, a non-recursive glob over that one package | Persona tables MUST be `packages/schema/src/persona.ts`. They cannot live in a feature package and still be seen by `drizzle-kit`. |
| No feature package owns a `pgTable`. All 20 domains are one file each in `packages/schema/src/` (`contest.ts`, `learning.ts`, `docs.ts`, `video.ts`, ...) | Tables in schema is the house pattern, not a compromise. Schema is a pure table catalog. |
| `packages/server/src/` is organised as domain directories (`contest/`, `learning/`, `profile/`, `publicApi/`, ...) | Server logic goes in `packages/server/src/persona/`. |
| `@commonpub/theme-studio` is a pure-TS brain package with no framework deps | The precedent for a pure logic package. `@commonpub/persona` follows it. |
| `runDailyRollup` (`packages/server/src/publicApi/metricsRollup.ts:66-96`) is a hardcoded body with one `upsertRows` call and no pass registry | Persona must not edit that function body. |
| `TIMESERIES_METRICS` is a flat `Record<string, MetricKind>` and `/metrics/timeseries` is guarded by `read:analytics` alone | If persona writes to its own table instead of `metrics_daily`, the whole `persona.%` back door and its rejection hack cease to exist. |

### 14.3 The boundary

```
@commonpub/persona        pure TS. zod only. NO framework, NO drizzle, NO db.
  field + section types, FIELD registry, personaFieldSink, completeness,
  purpose registry, scope digest, all Zod schemas, all pure predicates.
        |
        |  imported by
        v
packages/schema/src/persona.ts     drizzle tables ONLY. no imports from persona.
packages/server/src/persona/       resolution, values, consent, metrics.
layers/base/**                     routes, pages, components.
```

Dependency direction is one way and shallow. `@commonpub/persona` depends on `zod` and nothing else,
so it is trivially testable, publishable, and replaceable. **No new edge is created between
`@commonpub/schema` and `@commonpub/config`.**

### 14.4 What v1 deliberately does NOT touch

Each line here removes a way this feature could break something else. Every one of them is recoverable
later as its own change.

| Do NOT | Instead | Why |
|---|---|---|
| Move `FormField`, `isFormFieldPii`, `isRequiredFormField` out of `packages/schema/src/contest.ts` (section 3.1) | `@commonpub/persona` declares its own `PERSONA_FIELD_TYPES` registry | Persona uses none of them. A live contest is running on deveco. |
| Refactor `FormTemplateEditor.vue` into three sub-components (section 8.2) | The persona admin editor is its own component | The extraction is a real dedup, worth doing on its own merit, not as a prerequisite for an unrelated feature. |
| Move `httpUrl` / `optionalUrl` into `@commonpub/config` (section 3.1) | `@commonpub/persona` carries its own URL predicate, with a test asserting it rejects the same schemes | Avoids a permanent `schema -> config` package edge created for one validator. |
| Lift `fnv1a32` out of `layers/base/composables/useCookieConsent.ts` (section 6.3) | `@commonpub/persona` has its own `fnv1a32`, and a test pins it byte-identical to the composable's | Section 6.3 itself warns that any drift silently invalidates every cookie consent on all three instances. That risk is not worth deduplicating eight lines of FNV-1a. |
| Widen `user_consents.kind` / `.version` and write a `sharing:*` audit row (sections 4.2, 6.4) | `user_purpose_consents` holds the full history on its own; the DSAR gains a `purposeConsents` section | The audit row bought nothing the new table does not already have, and cost an `ALTER` on a live GDPR table. |
| Add `api_keys.purposes` and per-key purpose limitation (section 7.5) | `read:audience` plus wildcard protection only | Appendix B2: the mechanism cannot differentiate fields as specified because no field carries a data class. Ship the scope, defer the differentiation. |
| Normalize `users.social_links` into `user_profile_links` and cut over five readers (section 4.4.1) | Persona `link` fields bind to the existing seven `socialLinks` keys and write through `updateUserProfile`; link analytics reads `users.social_links` in the daily rollup | This was the single most invasive item in the plan: it changes the public API serializer, the DSAR allow-list, the DTO, the settings form and the Drizzle type. The normalization exists for query speed, which a once-a-day rollup makes moot. Operator-extensible platforms arrive with the table, later, behind its own flag. |
| Ship Phase 0's profile privacy fixes as part of this feature (section 9) | They ship as their own change, with their own session log and their own release | They are pre-existing defects (`emailNotifications` leaking to every viewer, `profileVisibility` ignored, `hasScope` wildcard). They stand on their own and must not be gated behind a feature. `strictProfileVisibility` is not a persona flag. |
| Write persona rows into `metrics_daily` and reject `persona.%` in `getMetricsTimeseries` (sections 7.5, 7.6) | Persona owns `persona_metrics_daily` | An own table means the timeseries back door never exists, `runDailyRollup`'s body is never edited, and the `dimension` sentinel discipline is persona's own concern. |

Net effect on the database: **migration 0046 creates four new tables and alters nothing.** A purely
additive migration cannot break an existing reader.

### 14.5 v1 scope

**Ships**

1. `@commonpub/persona`: types, `PERSONA_FIELD_TYPES` with `satisfies`, `personaFieldSink`,
   `isPersonaFieldAggregatable`, `personaCompleteness`, `BUILTIN_PERSONA_SECTIONS`, link platforms,
   `PROCESSING_PURPOSES` and specs, `purposeScopeDigest`, `fnv1a32`, every Zod schema, full unit tests.
2. `packages/schema/src/persona.ts`: `user_persona_answers`, `user_persona_text`,
   `user_purpose_consents`, `persona_metrics_daily`. Migration `0046_jazzy_frog_thor.sql` (drizzle-kit
   names migrations; only the `0046` prefix is stable, and this document originally guessed
   `0046_persona.sql`).
3. Config: three flags (`persona`, `dataSharingConsents`, `personaAnalytics`), plus `persona` accepted
   as an opaque passthrough so `@commonpub/config` never learns what a persona section is.
4. `packages/server/src/persona/`: `registry.ts` (file and DB resolution, precedence, drift
   reconciler), `values.ts` (read and write, template-scoped delete), `consent.ts` (purpose grants,
   supersede-then-insert, effective grant), `metrics.ts` (consent inner join, k-anonymity, rollup).
5. Layer: `/api/persona`, `/api/persona/status`, `/api/consent/purposes`,
   `/api/admin/persona/schema`, `/api/admin/persona-metrics`, and the public
   `/api/public/v1/metrics/persona/*` family behind `read:audience`.
6. Layer UI: `/settings/persona` editor with chip grids, `/settings/privacy` purpose toggles,
   `/admin/persona` schema editor, and the dashboard invitation banner.
7. DSAR export gains `personaAnswers`, `personaText`, `purposeConsents`.

**Deferred, each recoverable on its own**

`user_profile_links` and the `socialLinks` cutover; `api_keys.purposes`; the `FormTemplateEditor`
sub-component extraction; the `forms.ts` type-layer unification; `recruiter_visibility` and
`sponsor_sharing` becoming offerable; `consent_proofs` (there is no erasure-surviving proof in v1
because there is no onward disclosure in v1 to defend); Phase 0's profile privacy fixes.

### 14.6 Appendix B fixes that apply to this build

B1 is moot (no `column: 'website'`; `website` is a link platform). B2 is resolved by deferring
`api_keys.purposes`. B4 extends the prefix rejection to `dataSharing.`. B5 puts both k-anonymity floors
in `@commonpub/persona` as the single source. B6 is moot (no `ALTER`s). B9 omits the deferred purposes
from the audience payload rather than returning zero. B11, B12, B13 apply as written. B3, B7, B8, B10,
B14, B15, B16 apply as written.

**Corrections to this paragraph, from the post-build audit (see 14.10):**

- **B5 was overstated.** `packages/server/src/publicApi/metrics.ts` still declares its own
  `METRICS_MIN_BUCKET = 5` for the Phase 2 content metrics. There are TWO declarations, pinned equal
  by `minBucketParity.test.ts`. Persona's own module re-exports the constant and declares nothing;
  collapsing the Phase 2 copy is a follow-up on that surface. `packages/persona/src/thresholds.ts`
  now says this rather than claiming a resolution.
- **B3 shipped half.** The sentence in the copy landed; the inline note on the TOGGLE did not, and
  the note that did exist was suppressed until a grant already existed, so the person who most needs
  it (profile already private, deciding whether to turn counting on) never saw it. Now rendered
  inside each purpose card, independent of grant state, and wired into the switch's
  `aria-describedby`.
- **B8's copy did not follow B8's code.** The implementation floors; the consent copy still said
  "counts are rounded". It now says "rounded down", and the sentence is rendered from
  `renderPurposeOnSummary` against the operator's resolved floors rather than hardcoding five.
- **B10 is now an input, not a module constant.** `DIGEST_INCLUDES_FIELD_KEYS` is the default of
  `PurposeScopeDigestInput.includeFieldKeys`, so both branches are reachable and testable without a
  `boolean`-annotated constant keeping a dead branch alive for the compiler.

### 14.7 The isolation test

One scanning test, `packages/persona/src/__tests__/isolation.test.ts`, asserts:

- `packages/persona/src/**` imports nothing but `zod` (file-count floor, P7);
- `packages/schema/src/persona.ts` imports nothing from `@commonpub/persona`;
- `packages/server/src/publicApi/metricsRollup.ts` contains no reference to `persona`;
- `packages/schema/src/contest.ts` and `layers/base/components/contest/**` contain no reference to
  `persona` (the contest engine is untouched by this feature);
- `layers/base/composables/useCookieConsent.ts` is byte-identical to its pre-feature content.

If a future change wants to undo an isolation decision, it deletes an assertion that says why it exists.


### 14.8 Decisions taken during the build that this document did not settle

Recorded here because each one contradicts, extends or fills a gap in an earlier section, and section
14 is the authoritative reading. Written after the build, from what shipped.

| Question | What shipped, and why |
|---|---|
| §5.2 writes `minPopulation` floor 20, default 25. B5 says the floors must BE the constants. | The floor is `MIN_AUDIENCE_POPULATION` (25). A literal 20 alongside a constant 25 is the exact B5 violation, and the audience surface is the more sensitive of the two. `minPopulation: 10` still fails, as §10.1 requires. |
| §6.4's "8 KB worst case" is unreachable under its own element caps (50 recipients at maximum lengths is ~11 KB before a single field key). | The BUDGET is authoritative: `PURPOSE_SCOPE_SNAPSHOT_MAX_BYTES = 8192`, enforced by truncating `aggregatableFieldKeys` only. Recipients and copy are never truncated, because they are what the user was shown. Copy plus recipients alone exceeding the budget throws rather than storing a snapshot that misrepresents the disclosure. Operator-facing consequence: roughly 35+ maximum-length recipients makes consent unrecordable. |
| `aggregatableFieldKeys` cap: §6.4 says 300. | 120 (`PERSONA_MAX_AGGREGATABLE_BUCKETS`). An aggregatable field contributes at least one bucket and a template is capped at 120 buckets, so more than 120 is structurally impossible. |
| §3.6 names the `industry` field and its type but enumerates no options, unlike `interests` and `tech_stack`. | An 18-value vocabulary ships in `BUILTIN_PERSONA_SECTIONS`. It is an operator-editable default, not a contract. |
| Nothing said what a ticked `checkbox` stores. | `PERSONA_CHECKBOX_VALUE = 'yes'`, the single bucket the count query already assumes. |
| §5.3.1 lists `type_changed` drift but a config file carries no record of what a field used to be. | A `persona.fieldLocks` instance setting, written once per key when its first answers are observed and moved only by an explicit operator action. It is the one piece of state a config-file-only design cannot carry. |
| A link platform with no host suffix list. | An EMPTY `hostSuffixes` means "any http(s) host", which is what `mastodon` needs since the account can live on any instance. Every other built-in carries a real suffix list. |
| §8.4 classifies `cpub-persona-invite-dismissed` as an essential cookie, which implies a `BUILTIN_COOKIES` entry, while §14.7 asserts `useCookieConsent.ts` is unchanged. | Unresolved and OPEN. The cookie ships and is NOT disclosed in the built-in registry. 14.7's rationale is the FNV body, not the whole file, so the disclosure entry should land as its own small change alongside `cpub-verify-dismissed`, which is the precedent for an essential dismissal cookie. |
| §8.4 says the second dismissal never returns on any device. | Cookie-only in v1. There is no per-user column (migration 0046 adds four tables and no user column, and B15 rules out `emailNotifications`), so the promise holds per browser. Recorded rather than quietly weakened. |
| §7.5 wants the `read:*` disclaimer generated from `WILDCARD_PROTECTED_SCOPES`, which lived in `@commonpub/server`. | The list moved to `@commonpub/schema` beside `PUBLIC_API_SCOPES`; `hasScope` builds its Set from it. Three surfaces read it and one is a browser, so a server-only home would have forced a hand-written second copy into the admin key screen. |
| Making `profileVisibility` settable (§8.5) versus 14.4 deferring Phase 0. | Settable ships here (validator, `updateUserProfile`, and an owner-only read on `GET /api/profile`); ENFORCEMENT on the app's own read paths and the federation actor routes remains Phase 0, unflagged and separate. Without settability, B3's disclosure describes a state nobody can reach. `UserProfile` is deliberately NOT widened: it is shared with the public user route and the federation serializer. |

### 14.9 The one sanctioned exception to 14.4: disclosing the invitation cookie

Section 14.4 says do not touch `layers/base/composables/useCookieConsent.ts`, and the build honoured
that. The consequence, caught in post-build verification: `PersonaInvitationBanner.vue` writes
`cpub-persona-invite-dismissed` and `layers/base/server/api/persona/status.get.ts` reads it, while
`BUILTIN_COOKIES` never declared it. **A privacy feature was shipping an undisclosed cookie**, so
`/cookies` was wrong for anyone who dismissed the invitation.

Resolved by adding one `BUILTIN_COOKIES` entry, `category: 'essential'`, on the `cpub-verify-dismissed`
precedent. That is the whole change to the file: 17 added lines, no logic.

**Why this does not reopen the risk 14.4 was protecting against.** The rule exists to protect two
things: the FNV-1a body, and the consent scope digest. `currentScope` in that same file digests
`cookies.value.filter((c) => c.category !== 'essential')`, so an essential entry provably cannot move
the digest and cannot re-prompt a single visitor. Verified empirically: the pinned digest assertions in
`useCookieConsent.analytics.test.ts` and all 174 layer test files still pass.

The isolation test was updated to pin the exception rather than ban the word. Assertion 5 now requires
that the composable imports nothing from `@commonpub/persona`, that no purpose-consent identifier
appears in it, that exactly ONE non-comment line mentions persona, that the line is the cookie name,
and that its category is `essential`. Both halves were mutation-tested: changing the category to
`functional` and injecting `profile_analytics` each turned the right assertion red, and both were
reverted and re-verified.

The general rule this records: an isolation boundary protects a mechanism, not a vocabulary. When
honouring it literally would ship something wrong, state the exception, prove it cannot reach the
mechanism, and pin the exception in the test.

### 14.10 Post-build audit (2026-08-12) and what it changed

A five-dimension fan-out audit of the shipped, unrolled tree. Recorded here rather
than folded into the sections above, because the sections above are the reasoning
record and the value of an audit is knowing what the reasoning missed.

The finding that repeats, and the rule it produces: **a rule stated in a docblock,
enforced in one place, and quietly violated in another does not fail loudly.** All
6800 tests were green for every defect below.

#### Fixed

| Where | What was wrong | Fix |
|---|---|---|
| `packages/persona/src/schemas.ts` | `sensitive: true`, `analytics: false` and `column` were accepted on a `multiselect`. All three route a field out of the `answers` sink, and all three destinations hold ONE value, so the field was unfillable: the chip grid rendered, the member ticked three chips, and the save came back `"takes a single value"`, naming a constraint no UI expressed. `sensitive` is the Art. 9 hatch, so this was the exact shape an operator would reach for. | Refused at declaration time, with the reason in the message. |
| `packages/server/src/persona/values.ts` | `validatePersonaSectionAnswers` branched on the SINK, so a `select` with `sensitive: true` lost its option-vocabulary check entirely and any member could store an arbitrary 2000-character string under a declared closed vocabulary. | Vocabulary is checked from the field TYPE; only the storage destination follows the sink. |
| `packages/server/src/persona/values.ts` | A field whose SINK changed left its rows unreadable and un-erasable: `getPersonaValues` reported orphans only for keys ABSENT from the schema, and a sink-changed key is still present. Art. 15 and Art. 17 both failed from a one-line config edit. | `retired[]` is keyed on "the rows are not in the sink this key now uses", with `reason: 'sink_changed'`. |
| `layers/base/server/api/admin/persona/schema.put.ts` | A dry-run 409 returned exact per-option counts over every member, including those who had revoked consent, from a request that writes nothing and needs only `settings.manage`. Eighteen requests reconstructed an eighteen-option distribution. | Counts go through `bandPersonaCount` (floored, "fewer than k" below the floor) and option VALUES are no longer named. Same treatment applied to `PersonaSchemaDrift.affectedRows`, which also reaches `audit_logs`. |
| `packages/server/src/persona/metrics.ts` | Guarantee 1 (the digest bound in the join) held on the LIVE path only. `persona_metrics_daily` stored no digest, so after an operator added a recipient the public endpoints kept publishing yesterday's buckets, built from grants that authorised nothing, for up to ~30 hours or forever with the worker stopped. | Each day stores `scope:<digest>` as a meta dimension; every rollup read refuses a day whose digest is not the live one (`reason: 'scope_changed'`), plus a 7-day recency bound. |
| `packages/persona/src/purposes.ts` | `getPersonaLinkPresence` aggregated `users.social_links` off a `profile_analytics` grant whose `covers` listed only `persona_selections` and whose copy named only interests and tech stack. `covers` was declared, digested, shown, and enforced nowhere. | `profile_links` added to `covers`, the copy names link counting, and `metrics.ts` READS `purposeCovers` so the surface goes dark if a future edit narrows the purpose. |
| flags | `personaAnalytics` kept publishing while `dataSharingConsents` was off, which removed the only revocation surface. | The four public routes and the rollup plugin require `dataSharingConsents`; `PUT /api/consent/purposes` gates only the GRANT direction; and `recordPurposeConsent` no longer refuses a WITHDRAWAL for a stale digest. Degrade stale grants, honour stale refusals. |
| `layers/base/pages/dashboard.vue` | `PersonaInvitationBanner` was mounted nowhere. `/api/persona/status` had zero callers and the newly-disclosed cookie could never be set, so the whole feature was discoverable only by opening Settings and noticing a tab. | Mounted in flow, with a source-sweep test so the mount cannot be lost again. |
| `PersonaFieldInput.vue` | The canonical ticked-checkbox value lived in `@commonpub/server`, where a component cannot import it, so the component hardcoded `'true'`. The write path normalised it to `'yes'`, so a saved answer read back UNTICKED and the component test pinned the wrong constant. | `PERSONA_CHECKBOX_VALUE` moved to `@commonpub/persona`, with a round-trip test. |
| `socialLinksSchema` | `PUT /api/profile` sends the whole object and a plain `z.object` strips unknown keys, so editing anything on `/settings/profile` deleted an operator-declared link platform a member had filled in at `/settings/persona`. | `.catchall(optionalUrl())`, and the profile form seeds from every stored key. |
| `metrics.ts` | The audience payload's three keys were re-encoded by hand in four places, so the fourth purpose the handoff anticipates was four silent edits the compiler could not point at. | `PERSONA_AUDIENCE_PAYLOAD_KEYS` with `satisfies`, and `PersonaAudienceCounts` derived from it. |
| `metrics.ts` | `computePersonaRows` never read `input.day`, so `{ ...input, day: previous }` read as time-scoping and was a no-op. | `day` dropped from the compute step, and the type says it is a label. |
| `registry.ts` | `PersonaSection.order` was validated, set on all three built-ins and read by nothing. `savePersonaSchemaOverride` never cleared `persona.retiredFields`, so a retired-then-re-added field stayed permanently excluded from every aggregate. | `order` sorted once, where the schema resolves; a key present in a saved document is un-retired. |
| stored rollup | Suppression and quantisation were applied at write only, so raising `minBucket` served a stale 5 under a payload declaring a quantum of 20. | The floor is re-applied on read, and a raised `minPopulation` refuses the day. |
| `values.ts` | Two concurrent saves of one section left the UNION of both answer sets: a READ COMMITTED `DELETE ... NOT IN` cannot see rows another transaction inserted after its snapshot. | One row lock, taken before anything is read. |

#### Fixed in the same pass, on the surfaces built after that audit

| Where | What was wrong | Fix |
|---|---|---|
| `layers/base/server/api/users/[username]/persona.get.ts` | The new public-profile route returned `link` fields, and the profile hero's `.cpub-profile-social` icon row already renders `users.social_links`. So GitHub, X, LinkedIn, YouTube and Mastodon printed TWICE on one page — for every member who had ever used `/settings/profile`, with no action of their own, the moment the flag went on. The route's own header already stated the rule ("already rendered by the profile hero... repeating them here would print each one twice") for `column:`-bound fields and simply did not apply it to the sink that is also a `users` column. | `link` fields excluded, with the argument for which surface yields written down: `persona` defaults to `false`, so deleting the hero row would strip the icons from every instance that never enables this feature in order to fix a collision only instances that DO enable it can have. `'link'` was also removed from the `PublicPersonaDisplay` union and the component's anchor branch deleted, so the payload carries no `users.social_links` value at all — strictly stronger than the `safeHref` that was sanitising one. Mutation-tested: reintroducing both halves turns 5 route tests red. |

#### Verified against a real PostgreSQL 16 (2026-08-12)

Handoff blocker 1 said 0046 had never been applied to a live database and that every integration
test ran on PGlite. The full 47-migration chain was applied to the `docker compose` instance on
:5433 with `drizzle-kit migrate`, and the real `@commonpub/server` persona functions were then run
against it. Confirmed on the real planner: the partial unique index keeps a full history while
rejecting a second current row; all three FK cascades fire on account delete while
`persona_metrics_daily` survives; the consent inner join with `HAVING count(*) >= minBucket` drops a
3-person bucket and reports `suppressed: 1`; a 12-person bucket publishes as 10, so the quantisation
floors; the rollup writes both the `*suppressed` sentinel and the `scope:<digest>` meta row; and the
finalised day is refused with `scope_changed` under a different digest and with
`insufficient_population` under a raised floor. The two scope-digest audit fixes above were therefore
verified on stored rows rather than on a mock. A browser pass remains outstanding and is now the
roll blocker.

#### Recorded, not fixed

- **`personaMetricsContext` still lives in `layers/base/server/utils/`.** It is domain logic and belongs in `@commonpub/server`; the move was attempted and reverted. Every route test in the layer stubs the persona resolution with `vi.mock('@commonpub/server')`, and a module inside that package reaches its dependencies by relative import, so the stubs stop applying and 68 tests would have to hand-assemble the very context they exist to check the routes agree on. Moving it needs those tests restructured first.
- **`admin/persona.vue` is 1802 lines with zero child components**, against the house pattern for every comparable editor. A split is real work with no visual test coverage to catch a regression; it should be its own change.
- **`purposeScopeDigest` is still 32-bit FNV-1a.** It is an authorisation predicate bound into SQL, and a collision fails OPEN. A SHA-256 truncation fits the existing `varchar(16)` exactly, but `node:crypto` is an import the isolation test forbids in this package. The parts are now newline-delimited, which removes the constructible half of the problem.
- **`GET /api/admin/persona-metrics` is deliberately NOT gated on `dataSharingConsents`**, unlike the four public routes. Those publish; this one shows an operator their own instance.
