import { z } from 'zod';

import { PERSONA_FIELD_TYPES, personaFieldSpec } from './fields.js';
import {
  type PersonaField,
  type PersonaLinkPlatformSpec,
  type PersonaSection,
  USER_BRIDGE_COLUMNS,
  isPersonaFieldAggregatable,
} from './persona.js';
import { type DataRecipient, PROCESSING_PURPOSES } from './purposes.js';
import { METRICS_MIN_BUCKET, MIN_AUDIENCE_POPULATION } from './thresholds.js';
import { httpUrl, optionalUrl } from './url.js';

/** Caps, in one place, so the schema and the error copy cannot disagree. */
export const PERSONA_MAX_SECTIONS = 12;
export const PERSONA_MAX_FIELDS_PER_SECTION = 24;
export const PERSONA_MAX_FIELDS_TOTAL = 300;
/**
 * A bucket is one publishable row of a distribution: one option of one
 * aggregatable field (a checkbox contributes exactly one, the count of people
 * who ticked it). The cap bounds both the rollup cost and how finely the
 * population can be sliced.
 */
export const PERSONA_MAX_AGGREGATABLE_BUCKETS = 120;

/**
 * THE persona key alphabet, exported because five surfaces guard on it: this
 * schema, two `[fieldKey]` route params, the section-key check on
 * `PUT /api/persona`, and the admin editor's client-side machine-key input.
 *
 * It is also load bearing for a SAFETY argument elsewhere:
 * `PERSONA_SUPPRESSED_DIMENSION` (`'*suppressed'`) can never collide with a real
 * analytics dimension precisely because every option value and platform key
 * matches this pattern and `*` does not. That argument holds only while every
 * copy agrees, so there is one copy.
 */
export const PERSONA_KEY_PATTERN = /^[a-z0-9_]+$/;
export const PERSONA_KEY_MAX_LENGTH = 40;
export const PERSONA_OPTION_VALUE_MAX_LENGTH = 64;

export const personaKeySchema = z
  .string()
  .min(1)
  .max(PERSONA_KEY_MAX_LENGTH)
  .regex(PERSONA_KEY_PATTERN);

const keySchema = personaKeySchema;
const optionValueSchema = z
  .string()
  .min(1)
  .max(PERSONA_OPTION_VALUE_MAX_LENGTH)
  .regex(PERSONA_KEY_PATTERN);

/**
 * A persona field.
 *
 * `.strict()` is load bearing. It is what enforces the deliberate omissions
 * versus a contest form field: no `required` (a persona is never mandatory,
 * which is the anti-dark-pattern) and no `pii` (the persona surface partitions
 * by `personaFieldSink`, so a per-field PII toggle would render a control that
 * does nothing).
 */
export const personaFieldSchema = z
  .object({
    key: keySchema,
    label: z.string().min(1).max(120),
    type: z.enum(PERSONA_FIELD_TYPES),
    help: z.string().max(300).optional(),
    maxLength: z.number().int().min(1).max(2000).optional(),
    options: z
      .array(
        z.object({
          value: optionValueSchema,
          label: z.string().min(1).max(120),
        }),
      )
      .max(64)
      .optional(),
    maxSelections: z.number().int().min(1).max(64).optional(),
    platform: z
      .string()
      .regex(/^[a-z0-9_]{1,32}$/)
      .optional(),
    points: z.number().int().min(0).max(100).optional(),
    pointsPerSelection: z.number().int().min(0).max(100).optional(),
    analytics: z.boolean().optional(),
    sensitive: z.boolean().optional(),
    // Opt IN, absent means not shown. There is no `publicOnProfile`, and
    // `.strict()` is what makes that a boot-time error with a path rather than
    // an operator quietly getting the opposite of what their config says.
    showOnProfile: z.boolean().optional(),
    column: z.enum(USER_BRIDGE_COLUMNS).optional(),
  })
  .strict()
  // Every rule below reads the registry rather than a hand-written type list, so
  // what the builder can express and what the validator accepts cannot drift.
  .refine((f) => !personaFieldSpec(f.type).supportsOptions || (f.options?.length ?? 0) > 0, {
    message: 'A choice field needs at least one option',
    path: ['options'],
  })
  .refine((f) => personaFieldSpec(f.type).supportsOptions || f.options === undefined, {
    message: 'This field type does not accept options',
    path: ['options'],
  })
  .refine((f) => f.type !== 'link' || !!f.platform, {
    message: 'A link field needs a platform',
    path: ['platform'],
  })
  .refine((f) => f.type === 'link' || f.platform === undefined, {
    message: 'Only a profile link field has a platform',
    path: ['platform'],
  })
  .refine(
    (f) => f.maxSelections === undefined || personaFieldSpec(f.type).supportsMaxSelections,
    {
      message: 'maxSelections applies to a multiple choice grid only',
      path: ['maxSelections'],
    },
  )
  .refine(
    (f) => f.pointsPerSelection === undefined || personaFieldSpec(f.type).supportsMaxSelections,
    {
      message: 'pointsPerSelection applies to a multiple choice grid only',
      path: ['pointsPerSelection'],
    },
  )
  .refine((f) => f.maxLength === undefined || personaFieldSpec(f.type).supportsMaxLength, {
    message: 'This field type does not accept a maximum length',
    path: ['maxLength'],
  })
  // A multi-value field cannot be routed anywhere but the `answers` sink. The
  // three flags below each move a field out of it (`personaFieldSink`), and the
  // three destination sinks all store ONE value per field, so a member ticking a
  // second chip would be refused at write time with an error naming a constraint
  // no UI expressed. Refusing the DECLARATION is the only place an operator can
  // act on it: the schema is the work.
  .refine((f) => personaFieldSpec(f.type).cardinality !== 'set' || f.sensitive !== true, {
    message:
      'A multiple choice grid cannot be marked sensitive, because a sensitive field is stored as free text and free text holds one value. Use single-choice fields for special-category data.',
    path: ['sensitive'],
  })
  .refine((f) => personaFieldSpec(f.type).cardinality !== 'set' || f.analytics !== false, {
    message:
      'A multiple choice grid cannot turn analytics off, because that stores it as free text and free text holds one value. Remove the field instead, or make it a single choice.',
    path: ['analytics'],
  })
  .refine((f) => personaFieldSpec(f.type).cardinality !== 'set' || f.column === undefined, {
    message: 'A multiple choice grid cannot bind to a profile column, which holds one value',
    path: ['column'],
  });

export const personaSectionSchema = z
  .object({
    key: keySchema,
    label: z.string().min(1).max(120),
    help: z.string().max(300).optional(),
    collapsedByDefault: z.boolean().optional(),
    order: z.number().int().min(0).max(999).optional(),
    fields: z.array(personaFieldSchema).max(PERSONA_MAX_FIELDS_PER_SECTION),
  })
  .strict();

function countBuckets(field: PersonaField): number {
  if (!isPersonaFieldAggregatable(field)) return 0;
  // A checkbox has no options: its single bucket is "people who ticked it".
  return personaFieldSpec(field.type).supportsOptions ? (field.options?.length ?? 0) : 1;
}

export const personaSectionsSchema = z
  .array(personaSectionSchema)
  .max(PERSONA_MAX_SECTIONS)
  .superRefine((sections, ctx) => {
    const seenSectionKeys = new Set<string>();
    // Field keys are unique across the WHOLE template, not per section, because
    // `user_persona_answers.field_key` is a global namespace and two fields
    // sharing a key would silently share a user's answers and an analytics
    // bucket.
    const seenFieldKeys = new Set<string>();
    // Two fields bound to ONE `users` column are two questions over one datum:
    // saving the section with the second one empty clears the first, and
    // `personaAnswerMap` reports both as answered from a single value, so
    // completeness double counts it.
    const seenColumns = new Set<string>();
    let totalFields = 0;
    let totalBuckets = 0;

    sections.forEach((section, sectionIndex) => {
      if (seenSectionKeys.has(section.key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate section key: ${section.key}`,
          path: [sectionIndex, 'key'],
        });
      }
      seenSectionKeys.add(section.key);

      section.fields.forEach((field, fieldIndex) => {
        totalFields += 1;
        totalBuckets += countBuckets(field);

        if (seenFieldKeys.has(field.key)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate field key: ${field.key}. Field keys must be unique across every section.`,
            path: [sectionIndex, 'fields', fieldIndex, 'key'],
          });
        }
        seenFieldKeys.add(field.key);

        if (field.column !== undefined) {
          if (seenColumns.has(field.column)) {
            ctx.addIssue({
              code: 'custom',
              message: `Two fields bind to the profile column "${field.column}". One column holds one answer.`,
              path: [sectionIndex, 'fields', fieldIndex, 'column'],
            });
          }
          seenColumns.add(field.column);
        }

        const seenOptionValues = new Set<string>();
        (field.options ?? []).forEach((opt, optionIndex) => {
          if (seenOptionValues.has(opt.value)) {
            ctx.addIssue({
              code: 'custom',
              message: `Duplicate option value: ${opt.value}`,
              path: [sectionIndex, 'fields', fieldIndex, 'options', optionIndex, 'value'],
            });
          }
          seenOptionValues.add(opt.value);
        });
      });
    });

    if (totalFields > PERSONA_MAX_FIELDS_TOTAL) {
      ctx.addIssue({
        code: 'custom',
        message: `Too many fields: ${totalFields}. The maximum is ${PERSONA_MAX_FIELDS_TOTAL}.`,
      });
    }

    if (totalBuckets > PERSONA_MAX_AGGREGATABLE_BUCKETS) {
      ctx.addIssue({
        code: 'custom',
        message: `Too many countable answers: ${totalBuckets}. The maximum is ${PERSONA_MAX_AGGREGATABLE_BUCKETS}.`,
      });
    }
  });

export const personaLinkPlatformSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_]{1,32}$/),
    label: z.string().min(1).max(64),
    // Lowercase host suffixes only, max 8. An empty list means any http(s) host,
    // which is what a federated platform needs. No RegExp: a pattern is neither
    // serialisable nor safe to accept from an operator.
    hostSuffixes: z
      .array(
        z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, {
            message: 'A host suffix is a lowercase hostname such as github.com',
          }),
      )
      .max(8),
    placeholder: z.string().max(120),
    authenticitySignal: z.boolean(),
  })
  .strict();

export const dataRecipientSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    name: z.string().min(1).max(120),
    // `.optional()` on top of `optionalUrl` so the KEY may be absent as well as
    // empty. `optionalUrl` alone maps '' to undefined but still requires the key.
    url: optionalUrl(512).optional(),
    // REQUIRED: you cannot disclose to a party with no policy to link.
    privacyPolicyUrl: httpUrl(512),
    purposes: z.array(z.enum(PROCESSING_PURPOSES)).min(1),
    relationship: z.enum(['processor', 'joint_controller', 'independent_controller']),
    /** URL or reference to the signed Art. 26 / Art. 28 instrument. */
    agreementRef: z.string().max(512).optional(),
    country: z.string().max(64).optional(),
    transferMechanism: z.enum(['adequacy', 'scc', 'bcr', 'derogation']).optional(),
  })
  .strict()
  .refine((r) => r.relationship === 'processor' || !!r.agreementRef, {
    message: 'A joint or independent controller needs an agreementRef',
    path: ['agreementRef'],
  });

export const dataSharingConfigSchema = z
  .object({
    recipients: z.array(dataRecipientSchema).max(50).default([]),
    policyVersion: z.string().min(1).max(32).default('1'),
    /**
     * k-anonymity bucket floor. The constant is the FLOOR, never the value, so
     * an operator staring at thin numbers cannot dial it below it. Appendix B5:
     * `.min()` references the constant, never a literal, which is the whole
     * reason both constants live in this package.
     */
    minBucket: z.number().int().min(METRICS_MIN_BUCKET).max(100).default(METRICS_MIN_BUCKET),
    /** Whole-surface population floor. */
    minPopulation: z
      .number()
      .int()
      .min(MIN_AUDIENCE_POPULATION)
      .max(10_000)
      .default(MIN_AUDIENCE_POPULATION),
    /**
     * How long a `disclosure_events` row is kept: one row per (recipient,
     * member) disclosure, which is what answers "who has seen me" for the
     * member and Art. 15 for everyone else.
     *
     * A retention period nobody enforces is a retention period nobody has, so
     * this number is not documentation. The purge job reads it and deletes
     * rows older than it, on the same pass that handles the other retention
     * job. The member-facing "who has looked" list is therefore bounded by
     * this window too, which is the honest reading of it: past that point the
     * instance has genuinely forgotten, including on the member's behalf.
     *
     * Bounds rather than a free number: below a year the accountability record
     * expires before an annual review or a DSAR round trip can use it, and
     * above ten years it is an indefinite log of who looked at whom.
     */
    disclosureRetentionYears: z.number().int().min(1).max(10).default(2),
  })
  .strict();

export const personaConfigSchema = z
  .object({
    sections: personaSectionsSchema.default([]),
    linkPlatforms: z.array(personaLinkPlatformSchema).max(24).default([]),
    /**
     * 'progress' is the default. 'points' exists because the community's norms
     * are the operator's call, but the default is the respectful one: points
     * badges are manufactured scarcity attached to voluntarily disclosing
     * personal data, which is the thing this feature was asked not to be.
     */
    completeness: z.enum(['progress', 'points', 'none']).default('progress'),
    firstRun: z.enum(['offer', 'off']).default('offer'),
  })
  .strict();

export type PersonaConfig = z.infer<typeof personaConfigSchema>;
export type DataSharingConfig = z.infer<typeof dataSharingConfigSchema>;

/**
 * What an operator calls in `commonpub.config.ts` to declare persona sections.
 *
 * It parses and returns, so a mistake is a boot-time error with a path rather
 * than a runtime surprise, and it is the reason `@commonpub/config` never needs
 * to learn what a persona section is: config carries the value as an opaque
 * passthrough and this helper owns the meaning.
 */
export function definePersonaSections(sections: PersonaSection[]): PersonaSection[] {
  return personaSectionsSchema.parse(sections);
}

// --- Compile-time parity guards -------------------------------------------------
// The hand-written interfaces in `persona.ts` and `purposes.ts` are mirrors of
// the Zod schemas here, and mirrors drift (session 243). These assignments fail
// to compile if either side gains or loses a key, so `pnpm typecheck` catches
// what vitest's esbuild transpile cannot. Type-only: erased at build.

/** Drops `readonly` one level deep so a readonly interface can be compared. */
type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K];
};

type _FieldFromSchema = z.infer<typeof personaFieldSchema>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _fieldParityForward: PersonaField = null as unknown as _FieldFromSchema;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _fieldParityBackward: _FieldFromSchema = null as unknown as PersonaField;

type _SectionFromSchema = z.infer<typeof personaSectionSchema>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sectionParityForward: PersonaSection = null as unknown as _SectionFromSchema;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sectionParityBackward: _SectionFromSchema = null as unknown as PersonaSection;

type _PlatformFromSchema = z.infer<typeof personaLinkPlatformSchema>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _platformParityForward: Mutable<PersonaLinkPlatformSpec> =
  null as unknown as _PlatformFromSchema;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _platformParityBackward: _PlatformFromSchema =
  null as unknown as Mutable<PersonaLinkPlatformSpec>;

type _RecipientFromSchema = z.infer<typeof dataRecipientSchema>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _recipientParityForward: DataRecipient = null as unknown as _RecipientFromSchema;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _recipientParityBackward: _RecipientFromSchema = null as unknown as DataRecipient;
