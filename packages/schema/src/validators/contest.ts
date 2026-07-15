import { z } from 'zod';
import { optionalUrl } from './_shared.js';
import {
  contestStatusEnum,
  contestVisibilityEnum,
  contestContentFormatEnum,
  judgingVisibilityEnum,
  userRoleEnum,
} from '../enums.js';

// Derive the enum validators from the pgEnums (single source of truth) so a new
// enum value can't silently bypass validation by being added to the column but
// not these hand-maintained lists. See the drift-guard test in validators.test.ts.
const contentFormatSchema = z.enum(contestContentFormatEnum.enumValues);
const contestVisibilitySchema = z.enum(contestVisibilityEnum.enumValues);
const judgingVisibilitySchema = z.enum(judgingVisibilityEnum.enumValues);
const userRoleSchema = z.enum(userRoleEnum.enumValues);

// Block-editor body (BlockTuple[] = `[type, content][]`) for the contest overview
// + rules — the house editor format (loosely shaped, matches docs content blocks).
// Bounded so a runaway array can't DoS; the 10MB JSON body limit is the backstop.
const contestBlocksSchema = z.array(z.array(z.unknown())).max(1000);

// Non-destructive banner/cover framing (P4): zoom + object-position over the
// original image. zoom 0 = contain (perfect fit); x/y are percent (0..100).
export const contestImageMetaSchema = z.object({
  zoom: z.number().min(0).max(4),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});
export type ContestImageMetaInput = z.infer<typeof contestImageMetaSchema>;

// --- Contest validators ---

export const contestPrizeSchema = z
  .object({
    place: z.number().int().positive().optional(),
    category: z.string().max(120).optional(),
    // Optional: a prize can be description-only (no forced 1st/2nd/3rd title).
    title: z.string().max(255).optional(),
    description: z.string().max(1000).optional(),
    value: z.string().max(128).optional(),
  })
  // Reject a completely empty prize — it must carry at least one meaningful
  // field so flexible (description-only / category-only / place-only) prizes
  // are allowed while blank rows are not.
  .refine(
    (p) =>
      !!(p.title?.trim() || p.description?.trim() || p.category?.trim() || (typeof p.place === 'number' && p.place > 0)),
    { message: 'A prize needs a title, description, category, or place.' },
  );
export type ContestPrize = z.infer<typeof contestPrizeSchema>;

export const contestJudgingCriterionSchema = z.object({
  label: z.string().min(1).max(120),
  weight: z.number().int().min(0).max(100).optional(),
  description: z.string().max(500).optional(),
});
export type ContestJudgingCriterion = z.infer<typeof contestJudgingCriterionSchema>;

// Per-contest email copy override (session 232). Organizers customize the
// subject + body of the two contest participation emails; the CTA, deadline line
// and unsubscribe chrome stay system-owned. `.strict()` rejects unknown keys;
// empty/absent ⇒ the built-in default.
//   - `subject`: plain text, tokenized + HTML-escaped server-side.
//   - `bodyBlocks`: BlockTuple[] body (the house block editor, same jsonb shape as
//     `descriptionBlocks`). Rendered to an EMAIL-SAFE HTML subset by the server's
//     renderEmailBlocks — no organizer raw HTML reaches the wire unsanitized.
//   - `intro`: legacy plain-text body (session 232). Retained for back-compat +
//     rollback; a `bodyBlocks` override supersedes it at render time.
const CONTEST_EMAIL_SUBJECT_MAX = 200;
const CONTEST_EMAIL_INTRO_MAX = 2000;
export const contestEmailTemplateCopySchema = z
  .object({
    subject: z.string().trim().max(CONTEST_EMAIL_SUBJECT_MAX).optional(),
    intro: z.string().trim().max(CONTEST_EMAIL_INTRO_MAX).optional(),
    bodyBlocks: z.array(z.array(z.unknown())).max(200).optional(),
  })
  .strict();
export const contestEmailCopySchema = z
  .object({
    confirmation: contestEmailTemplateCopySchema.optional(),
    reminder: contestEmailTemplateCopySchema.optional(),
  })
  .strict();

// Which of the two contest emails a preview/editor request targets.
export const contestEmailTemplateKeySchema = z.enum(['confirmation', 'reminder']);

// Live-preview request: render one template with the UNSAVED copy. Validated with
// the same field schema as the stored override, so preview can't render arbitrary
// HTML (the branding-preview safety model, applied per-contest).
export const contestEmailPreviewSchema = z
  .object({
    template: contestEmailTemplateKeySchema,
    copy: contestEmailTemplateCopySchema,
  })
  .strict();

// Send-a-test-email request: render one template with the UNSAVED copy (same
// safety model as preview) and deliver it to an arbitrary email OR a chosen user
// (the server resolves that user's email — never trusts a client-supplied address
// for a userId). Exactly one recipient form is required.
export const contestEmailTestSchema = z
  .object({
    template: contestEmailTemplateKeySchema,
    copy: contestEmailTemplateCopySchema,
    toEmail: z.string().trim().email().max(320).optional(),
    toUserId: z.string().uuid().optional(),
  })
  .strict()
  .refine((d) => !!d.toEmail !== !!d.toUserId, {
    message: 'Provide exactly one recipient: an email address or a user',
  });

// Per-stage submission-template field types (Phase 4 extends the original
// text/textarea/url trio). `agreement` + `address` and any field flagged `pii`
// are partitioned OUT of the public `stageSubmissions.fields` artifact at submit
// time (see partitionTemplateFields in @commonpub/server): agreements record an
// immutable acceptance row, PII lands in `contest_entry_private_fields`.
export const SUBMISSION_TEMPLATE_FIELD_TYPES = [
  'text',
  'textarea',
  'url',
  'email',
  'number',
  'select',
  'checkbox',
  'date',
  'agreement',
  'address',
] as const;
export const submissionTemplateFieldTypeSchema = z.enum(SUBMISSION_TEMPLATE_FIELD_TYPES);
export type SubmissionTemplateFieldType = (typeof SUBMISSION_TEMPLATE_FIELD_TYPES)[number];

/** One choice of a `select` template field. */
export const submissionTemplateOptionSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
});

// One field of a `submission` stage's artifact template (per-stage submissions).
// `key` is the stable machine key in `stageSubmissions.fields`.
export const submissionTemplateFieldSchema = z
  .object({
    key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only'),
    label: z.string().min(1).max(120),
    type: submissionTemplateFieldTypeSchema,
    required: z.boolean(),
    help: z.string().max(300).optional(),
    /** `select`-only: the allowed options. Required (non-empty) for `select`. */
    options: z.array(submissionTemplateOptionSchema).max(50).optional(),
    /**
     * Personal data flag. When true the field's value is stored in
     * `contest_entry_private_fields` (never the public `stageSubmissions`
     * artifact) and is readable only with `contest.pii.read` or by the entrant.
     * Forced true for `address`.
     */
    pii: z.boolean().optional(),
    /** `agreement`-only: the terms text the entrant must accept (snapshotted on accept). */
    terms: z.string().max(20_000).optional(),
    /** `agreement`-only: how `terms` is rendered. */
    termsFormat: contentFormatSchema.optional(),
    /** `agreement`-only: require an explicit accept to submit (default true). */
    mustAccept: z.boolean().optional(),
  })
  .refine((f) => f.type !== 'select' || (Array.isArray(f.options) && f.options.length > 0), {
    message: 'A select field needs at least one option',
    path: ['options'],
  })
  .refine((f) => f.type !== 'agreement' || !!f.terms?.trim(), {
    message: 'An agreement field needs terms text',
    path: ['terms'],
  });
export type SubmissionTemplateFieldInput = z.infer<typeof submissionTemplateFieldSchema>;

// Phase B1 — a single ordered stage of a contest's timeline (stored as a jsonb
// array on `contests.stages`). See ContestStage in @commonpub/schema contest.ts.
export const contestStageSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  kind: z.enum(['submission', 'review', 'interim', 'results', 'event', 'custom']),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  core: z.boolean().optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(255).optional(),
  url: optionalUrl(),
  // Per-round rubric (review stages). Reuses the contest-level criterion shape.
  criteria: z.array(contestJudgingCriterionSchema).max(20).optional(),
  // Review stages: how many advance out of this round (the Top-N cut).
  advanceCount: z.number().int().min(1).max(100000).optional(),
  // Submission stages: the per-stage artifact template — fields the entrant
  // fills for THIS stage (proposal vs prototype). Keys must be unique.
  submissionTemplate: z
    .array(submissionTemplateFieldSchema)
    .max(50)
    .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, {
      message: 'Template field keys must be unique',
    })
    .optional(),
  // Submission stages (Phase 4): how an entry is created for this stage.
  // `attach` (default) = the entrant attaches a pre-existing PUBLISHED content
  // item. `proposal` = the entrant submits the form and the server creates a
  // DRAFT placeholder project linked as the entry (gated by features.contestProposals).
  submissionMode: z.enum(['attach', 'proposal']).optional(),
  // Submission stages (P2): an optional block intro shown above the form fields
  // on the public submission form. BlockTuple[] (same loose shape as the contest
  // bodies); capped at 200 blocks so a stage intro can't DoS.
  instructionsBlocks: z.array(z.array(z.unknown())).max(200).optional(),
});
export type ContestStageInput = z.infer<typeof contestStageSchema>;

// Entrant payload for submitting a per-stage artifact. The per-template checks
// (required fields present, url fields are https?://, no unknown keys) happen
// server-side against the stage's `submissionTemplate` — this bounds the shape.
export const stageSubmissionSchema = z
  .object({
    stageId: z.string().min(1).max(64),
    fields: z.record(z.string().max(64), z.string().max(4000)),
  })
  .refine((d) => Object.keys(d.fields).length <= 50, { message: 'Too many fields' });
export type StageSubmissionInput = z.infer<typeof stageSubmissionSchema>;

// Phase B2 — apply an advancement cut at a review stage (the Top-N cull).
export const contestAdvanceSchema = z
  .object({
    reviewStageId: z.string().min(1).max(64),
    mode: z.enum(['topN', 'manual']),
    topN: z.number().int().min(1).max(10000).optional(),
    advancedEntryIds: z.array(z.string().uuid()).max(10000).optional(),
  })
  .refine((d) => (d.mode === 'topN' ? typeof d.topN === 'number' : Array.isArray(d.advancedEntryIds)), {
    message: 'topN mode needs `topN`; manual mode needs `advancedEntryIds`.',
  });

// Contest long-form fields (description/rules/prizes overview) allow genuinely
// large content — a full multi-section brief, not a one-liner. The cap stays
// *bounded* on purpose: an unbounded field is a DoS vector (a multi-MB body is
// buffered + JSON-parsed synchronously at ingest, and rendered through the
// synchronous markdown pipeline on every page view). 50k chars is ~8k words /
// ~16 pages — large by any contest measure — while the body-size guard in
// `parseBody` and the render guard in the markdown parser keep the server safe.
export const CONTEST_RICH_TEXT_MAX = 50_000;

/**
 * Per-contest stakeholder roles (the `contest_stakeholders.role` column).
 * `reviewer` = view-only; `editor` = full edit rights to that single contest
 * with no system-wide access. See packages/schema/src/contest.ts.
 */
export const STAKEHOLDER_ROLES = ['reviewer', 'editor'] as const;
export const stakeholderRoleSchema = z.enum(STAKEHOLDER_ROLES);
export type StakeholderRole = (typeof STAKEHOLDER_ROLES)[number];

export const createContestSchema = z
  .object({
    title: z.string().min(1).max(255),
    subheading: z.string().max(300).optional(),
    description: z.string().max(CONTEST_RICH_TEXT_MAX).optional(),
    rules: z.string().max(CONTEST_RICH_TEXT_MAX).optional(),
    prizesDescription: z.string().max(CONTEST_RICH_TEXT_MAX).optional(),
    // Per-field render mode for the three long-form fields above (independent).
    descriptionFormat: contentFormatSchema.optional(),
    rulesFormat: contentFormatSchema.optional(),
    prizesDescriptionFormat: contentFormatSchema.optional(),
    // Block-editor body (overrides description/rules text when present).
    descriptionBlocks: contestBlocksSchema.optional(),
    rulesBlocks: contestBlocksSchema.optional(),
    prizesBlocks: contestBlocksSchema.optional(),
    bannerUrl: optionalUrl(),
    coverImageUrl: optionalUrl(),
    bannerMeta: contestImageMetaSchema.nullable().optional(),
    coverMeta: contestImageMetaSchema.nullable().optional(),
    coverPlacement: z.enum(['about', 'hero']).nullable().optional(),
    showPrizes: z.boolean().optional(),
    // Optional on create — server slugifies the title when omitted.
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only').max(255).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    judgingEndDate: z.string().datetime().optional(),
    prizes: z.array(contestPrizeSchema).max(50).optional(),
    judgingCriteria: z.array(contestJudgingCriterionSchema).max(20).optional(),
    // Phase B1 — explicit stage timeline. Omitted/empty ⇒ server synthesizes the
    // classic Submissions → Judging → Results flow.
    stages: z.array(contestStageSchema).max(20).optional(),
    currentStageId: z.string().max(64).optional(),
    // Seed-only: populates the contest_judges table. Judges are managed via the
    // dedicated /judges endpoints after creation.
    judges: z.array(z.string().uuid()).max(50).optional(),
    // Seed-only: populates the contest_stakeholders table (view-only reviewers).
    stakeholders: z.array(z.string().uuid()).max(100).optional(),
    communityVotingEnabled: z.boolean().optional(),
    judgingVisibility: judgingVisibilitySchema.optional(),
    eligibleContentTypes: z.array(z.string().max(40)).max(20).optional(),
    maxEntriesPerUser: z.number().int().positive().max(1000).optional(),
    visibility: contestVisibilitySchema.optional(),
    visibleToRoles: z.array(userRoleSchema).max(5).optional(),
    // Per-contest email copy override (session 232). Null clears the override.
    emailCopy: contestEmailCopySchema.nullable().optional(),
  })
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: 'End date must be after the start date',
    path: ['endDate'],
  })
  .refine((d) => !d.judgingEndDate || new Date(d.judgingEndDate) >= new Date(d.endDate), {
    message: 'Judging end date must be on or after the end date',
    path: ['judgingEndDate'],
  });
export type CreateContestInput = z.infer<typeof createContestSchema>;

// `.partial()` is unavailable on a refined object, so derive the update schema
// from the underlying shape and re-apply the cross-field date guards.
export const updateContestSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    subheading: z.string().max(300).optional(),
    description: z.string().max(CONTEST_RICH_TEXT_MAX).optional(),
    rules: z.string().max(CONTEST_RICH_TEXT_MAX).optional(),
    prizesDescription: z.string().max(CONTEST_RICH_TEXT_MAX).optional(),
    descriptionFormat: contentFormatSchema.optional(),
    rulesFormat: contentFormatSchema.optional(),
    prizesDescriptionFormat: contentFormatSchema.optional(),
    descriptionBlocks: contestBlocksSchema.optional(),
    rulesBlocks: contestBlocksSchema.optional(),
    prizesBlocks: contestBlocksSchema.optional(),
    bannerUrl: optionalUrl(),
    coverImageUrl: optionalUrl(),
    bannerMeta: contestImageMetaSchema.nullable().optional(),
    coverMeta: contestImageMetaSchema.nullable().optional(),
    coverPlacement: z.enum(['about', 'hero']).nullable().optional(),
    showPrizes: z.boolean().optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only').max(255).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    judgingEndDate: z.string().datetime().optional(),
    prizes: z.array(contestPrizeSchema).max(50).optional(),
    judgingCriteria: z.array(contestJudgingCriterionSchema).max(20).optional(),
    stages: z.array(contestStageSchema).max(20).optional(),
    currentStageId: z.string().max(64).optional(),
    communityVotingEnabled: z.boolean().optional(),
    judgingVisibility: judgingVisibilitySchema.optional(),
    eligibleContentTypes: z.array(z.string().max(40)).max(20).optional(),
    maxEntriesPerUser: z.number().int().positive().max(1000).optional(),
    visibility: contestVisibilitySchema.optional(),
    visibleToRoles: z.array(userRoleSchema).max(5).optional(),
    // Per-contest email copy override (session 232). Null clears the override.
    emailCopy: contestEmailCopySchema.nullable().optional(),
  })
  // `judges` + `stakeholders` are intentionally NOT updatable here — they are
  // managed via the dedicated /judges and /stakeholders endpoints.
  .refine((d) => !d.startDate || !d.endDate || new Date(d.endDate) > new Date(d.startDate), {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });
export type UpdateContestInput = z.infer<typeof updateContestSchema>;

export const criterionScoreSchema = z
  .object({
    label: z.string().max(120),
    score: z.number().int().min(0),
    max: z.number().int().min(1).max(100),
  })
  .refine((c) => c.score <= c.max, { message: 'Criterion score cannot exceed its max', path: ['score'] });
export type CriterionScore = z.infer<typeof criterionScoreSchema>;

export const judgeEntrySchema = z
  .object({
    entryId: z.string().uuid(),
    // Either an overall 0–100 score, or a per-criterion breakdown (the overall is
    // then derived server-side as a normalized weighted sum). 0 is allowed so the
    // holistic floor matches the per-criterion 0 floor (one 0–100 scale).
    score: z.number().int().min(0).max(100).optional(),
    criteriaScores: z.array(criterionScoreSchema).min(1).max(20).optional(),
    feedback: z.string().max(2000).optional(),
  })
  .refine((d) => d.score !== undefined || (d.criteriaScores && d.criteriaScores.length > 0), {
    message: 'Provide an overall score or per-criterion scores',
    path: ['score'],
  });
export type JudgeEntryInput = z.infer<typeof judgeEntrySchema>;

export const contestTransitionSchema = z.object({
  status: z.enum(contestStatusEnum.enumValues),
});
export type ContestTransitionInput = z.infer<typeof contestTransitionSchema>;

export const contestStatusSchema = z.enum(contestStatusEnum.enumValues);
export type ContestStatus = z.infer<typeof contestStatusSchema>;

// --- Contest signup (two-tier registration + optional self-reported info) ---

/** The two registration tiers. `full` = counted participant; `reminders` = reminders-only opt-in. */
export const contestRegistrationTierSchema = z.enum(['full', 'reminders']);
export type ContestRegistrationTier = z.infer<typeof contestRegistrationTierSchema>;

/**
 * Optional info collected at registration. Every field is optional — registration
 * is never blocked on it; it's the "tell the organizers a bit about you" prompt
 * shown at the high-intent post-register moment. `building` is trimmed and capped;
 * `experience`/`team` are closed sets. An empty/absent object is valid.
 */
export const contestRegistrationFieldsSchema = z.object({
  building: z.string().trim().max(280).optional(),
  experience: z.enum(['first', 'some', 'experienced']).optional(),
  team: z.enum(['solo', 'have', 'looking']).optional(),
});
export type ContestRegistrationFieldsInput = z.infer<typeof contestRegistrationFieldsSchema>;

/**
 * POST body for registering: which tier, plus the optional info. A bare POST with
 * no body (the low-friction one-click register, and the fallback UI) must still
 * parse — the preprocess coerces an absent/empty body to `{}`, which then defaults
 * `tier` to `full`. So an empty request means "register me as a full participant".
 */
export const contestRegisterSchema = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? {} : v),
  z.object({
    tier: contestRegistrationTierSchema.default('full'),
    fields: contestRegistrationFieldsSchema.optional(),
  }),
);
export type ContestRegisterInput = z.infer<typeof contestRegisterSchema>;

// --- Contest filters ---

export const contestFiltersSchema = z.object({
  status: contestStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ContestFilters = z.infer<typeof contestFiltersSchema>;
