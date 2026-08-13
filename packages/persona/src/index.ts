/**
 * `@commonpub/persona` is the persona brain: pure TypeScript, `zod` and nothing
 * else. No framework, no Drizzle, no database, no HTTP.
 *
 * Everything that decides what a persona field IS lives here: the type
 * registry, the storage partition, the link platforms, completeness, the
 * processing-purpose registry, the scope digest, the k-anonymity floors and
 * every Zod schema. `packages/schema` owns the tables, `packages/server` owns
 * the queries, and the layer owns the routes and the UI. The dependency
 * direction is one way and shallow, so this package is trivially testable,
 * publishable and replaceable.
 */

export {
  PERSONA_CHECKBOX_FALSE,
  PERSONA_CHECKBOX_TRUE,
  PERSONA_CHECKBOX_VALUE,
  PERSONA_FIELD_SPECS,
  PERSONA_FIELD_TYPES,
  type PersonaFieldSink,
  type PersonaFieldType,
  type PersonaFieldTypeSpec,
  UnknownPersonaFieldTypeError,
  isPersonaFieldType,
  personaFieldSpec,
} from './fields.js';

export {
  BUILTIN_PERSONA_LINK_PLATFORMS,
  BUILTIN_PERSONA_SECTIONS,
  PERSONA_INVITE_DISMISSED_COOKIE,
  PERSONA_INVITE_MAX_DISMISSALS,
  type PersonaAnswerMap,
  type PersonaCompleteness,
  type PersonaField,
  type PersonaLinkPlatformSpec,
  type PersonaSection,
  type PersonaSectionCompleteness,
  USER_BRIDGE_COLUMNS,
  type UserBridgeColumn,
  effectiveLinkPlatforms,
  findLinkPlatform,
  isPersonaFieldAggregatable,
  linkUrlMatchesPlatform,
  personaCompleteness,
  personaFieldSink,
} from './persona.js';

export { fnv1a32 } from './digest.js';

export {
  DIGEST_INCLUDES_FIELD_KEYS,
  type DataRecipient,
  PERSONA_DATA_CLASSES,
  PROCESSING_PURPOSES,
  PURPOSE_COPY_MAX_LENGTH,
  PROCESSING_PURPOSE_SPECS,
  type PersonaDataClass,
  type ProcessingPurposeId,
  type ProcessingPurposeSpec,
  type PurposeCopyContext,
  type PurposeOfferabilityContext,
  type PurposeScopeDigestInput,
  purposeCovers,
  purposeIsOfferable,
  purposeScopeDigest,
  renderPurposeOnSummary,
} from './purposes.js';

export { METRICS_MIN_BUCKET, MIN_AUDIENCE_POPULATION } from './thresholds.js';

export {
  type DataSharingConfig,
  PERSONA_KEY_MAX_LENGTH,
  PERSONA_KEY_PATTERN,
  PERSONA_MAX_AGGREGATABLE_BUCKETS,
  PERSONA_MAX_FIELDS_PER_SECTION,
  PERSONA_MAX_FIELDS_TOTAL,
  PERSONA_MAX_SECTIONS,
  PERSONA_OPTION_VALUE_MAX_LENGTH,
  type PersonaConfig,
  personaKeySchema,
  dataRecipientSchema,
  dataSharingConfigSchema,
  definePersonaSections,
  personaConfigSchema,
  personaFieldSchema,
  personaLinkPlatformSchema,
  personaSectionSchema,
  personaSectionsSchema,
} from './schemas.js';

export { httpUrl, optionalUrl } from './url.js';
