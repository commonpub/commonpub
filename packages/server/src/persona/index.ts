/**
 * Persona: schema resolution, answer storage, purpose consent, audience metrics
 * (plan sections 4, 5, 6 and 7) and the opt-in member visibility directory
 * (`docs/plans/member-visibility-directory.md`).
 *
 * The boundary this module sits on (plan 14.3): `@commonpub/persona` is pure TS
 * with `zod` and nothing else and owns every predicate; `@commonpub/schema` owns
 * the tables and imports nothing from persona; this directory owns the queries;
 * the layer owns the routes and the UI. The dependency direction is one way and
 * shallow.
 *
 * TWO MODULES HERE ARE OPPOSITES AND MUST STAY APART (directory plan D1).
 * `metrics.ts` exists to make individuals unidentifiable: suppression below the
 * k-anonymity floor, quantisation, finalised-day reads. `directory.ts`
 * identifies named individuals to a named recipient, with consent and with an
 * audit row per disclosure. Neither imports the other, a source sweep asserts
 * both directions, and this barrel re-exporting both is not permission to merge
 * them: k-anonymity applied to the directory returns nothing, and k-anonymity
 * removed from the aggregates to make the directory work breaks every count on
 * the instance silently.
 */

export {
  PERSONA_AUDIT_ACTIONS,
  PERSONA_DRIFT_ACK_SETTING_KEY,
  PERSONA_DRIFT_AUDITED_SETTING_KEY,
  PERSONA_FIELD_LOCKS_SETTING_KEY,
  PERSONA_LINK_PLATFORMS_SETTING_KEY,
  PERSONA_RETIRED_FIELDS_SETTING_KEY,
  PERSONA_SECTIONS_SETTING_KEY,
  type EffectivePersonaSchema,
  type PersonaAggregatableField,
  type PersonaRetiredField,
  type PersonaSchemaDrift,
  type StoredPersonaSchema,
  acknowledgePersonaDrift,
  clearPersonaFieldRetired,
  clearPersonaSchemaOverride,
  diffPersonaSchema,
  effectivePersonaLinkPlatforms,
  effectivePersonaSchema,
  getPersonaRetiredFields,
  invalidatePersonaSchemaCache,
  listPersonaAggregatableFields,
  parsePersonaConfig,
  sanitizePersonaSchema,
  savePersonaSchemaOverride,
  setPersonaFieldRetired,
} from './registry.js';

export {
  PERSONA_CHECKBOX_VALUE,
  type NormalizedPersonaSection,
  type PersonaSectionAnswers,
  type PersonaValidationResult,
  type PersonaValues,
  type RetiredPersonaValues,
  type SetPersonaSectionArgs,
  type SetPersonaSectionResult,
  countPersonaFieldOptionRows,
  countPersonaFieldRows,
  deletePersonaFieldValue,
  getPersonaValues,
  personaAnswerMap,
  purgePersonaField,
  retirePersonaField,
  setPersonaSection,
  validatePersonaSectionAnswers,
} from './values.js';

// Purpose consent (plan section 6) and audience metrics (plan section 7) ship
// alongside this module. The barrel re-exports them wholesale so a new export
// there needs no edit here.
export * from './consent.js';
export * from './metrics.js';

// The member visibility directory: the consent-gated, per-recipient, AUDITED
// member listing, and the recipient resolution that binds an API key to a named
// party. See the D1 paragraph in this file's header before touching either.
export * from './directory.js';
export * from './recipients.js';
export {
  type PersonaSchemaBlocker,
  type PersonaSchemaBlockerKind,
  type PersonaSchemaChangePlan,
  type PlanPersonaSchemaChangeInput,
  flattenPersonaFields,
  personaSchemaChangeCandidates,
  planPersonaSchemaChange,
} from './schemaChange.js';

/**
 * Pure-brain re-exports (plan 14.3).
 *
 * `@commonpub/persona` owns these outright; nothing is redeclared here. They are
 * re-exported because the layer's server routes take their dependency surface
 * from `@commonpub/server`, and a route that reached past it for a predicate
 * would need a second import edge for no gain. The re-export is one-way and
 * name-for-name, so there is exactly one definition of each.
 *
 * `packages/server/src/index.ts` already does this for `METRICS_MIN_BUCKET`.
 */
export {
  PERSONA_DATA_CLASSES,
  PERSONA_FIELD_SPECS,
  PERSONA_FIELD_TYPES,
  PERSONA_INVITE_DISMISSED_COOKIE,
  PERSONA_INVITE_MAX_DISMISSALS,
  PROCESSING_PURPOSES,
  PROCESSING_PURPOSE_SPECS,
  dataRecipientSchema,
  dataSharingConfigSchema,
  BUILTIN_PERSONA_LINK_PLATFORMS,
  BUILTIN_PERSONA_SECTIONS,
  MIN_AUDIENCE_POPULATION,
  effectiveLinkPlatforms,
  isPersonaFieldAggregatable,
  isPersonaFieldType,
  linkUrlMatchesPlatform,
  personaCompleteness,
  personaFieldSink,
  personaFieldSpec,
  personaSectionsSchema,
  personaSectionSchema,
  purposeCovers,
  purposeIsOfferable,
  purposeScopeDigest,
  renderPurposeOnSummary,
  type DataRecipient,
  type PersonaCompleteness,
  type PersonaDataClass,
  type PersonaField,
  type PersonaFieldSink,
  type PersonaFieldType,
  type PersonaLinkPlatformSpec,
  type PersonaSection,
  type ProcessingPurposeId,
  type ProcessingPurposeSpec,
} from '@commonpub/persona';
