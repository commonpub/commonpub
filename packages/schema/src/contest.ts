import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { contentItems } from './content.js';
import { contestStatusEnum, judgeRoleEnum, judgingVisibilityEnum, contestVisibilityEnum, contestContentFormatEnum } from './enums.js';

/**
 * A single ordered stage of a contest's timeline (Phase B1). Stored as a jsonb
 * array on `contests.stages`. Empty array ⇒ the server synthesizes the classic
 * Submissions → Judging → Results stages from `status` + the date columns, so
 * legacy/standard contests render identically (the standard flow is the default).
 *
 * `status` (the coarse enum) remains the behavioural source of truth for gating;
 * `kind` drives DISPLAY and is mapped to a status when the owner advances stages
 * (submission/interim→active, review→judging, results/event→completed). This lets
 * a contest have multiple submission/judging ROUNDS that all gate identically but
 * display as distinct named stages. Per-entry cohort/advancement + per-round
 * scoring (the Top-N cull) are Phase B2 — additive fields on this shape, no migration.
 */
/**
 * Non-destructive framing for a contest banner/cover image (P4). The original
 * upload is never re-cropped; this drives the CSS render:
 * `zoom === 0` ⇒ `object-fit: contain` (perfect fit, letterboxed);
 * `zoom > 0`  ⇒ `object-fit: cover` + `transform: scale(1 + zoom)` +
 *               `object-position: x% y%`. `x`/`y` are percent (0..100).
 */
export interface ContestImageMeta {
  zoom: number;
  x: number;
  y: number;
}

/** Where the cover image renders on the public contest page (P4 follow-up).
 *  `about` (default) = top of the Overview "About" section; `hero` = under the
 *  subheading in the hero bar. */
export type ContestCoverPlacement = 'about' | 'hero';

export interface ContestStage {
  /** Stable id — survives reorder/duplicate/rename. */
  id: string;
  /** Arbitrary display name ("Proposals Open", "Top 50 Selection", "Finale — D.C."). */
  name: string;
  kind: 'submission' | 'review' | 'interim' | 'results' | 'event' | 'custom';
  /** ISO start; optional. */
  startsAt?: string;
  /** ISO deadline; optional — the countdown target while this stage is current. */
  endsAt?: string;
  /** A required default-flow stage — can't be deleted in the editor (≥1 submission). */
  core?: boolean;
  /** Markdown: what happens / what to submit or refine this stage. */
  description?: string;
  /** Event/showcase stages — venue + link. */
  location?: string;
  url?: string;
  /**
   * Per-round judging rubric (Phase B2.5). Only meaningful for `review` stages —
   * lets each judging round score on its own criteria (e.g. a proposal round on
   * "Feasibility" vs a final round on "Deployment readiness"). When omitted, the
   * judge UI falls back to the contest-level `judgingCriteria`.
   */
  criteria?: Array<{ label: string; weight?: number; description?: string }>;
  /**
   * For `review` stages: how many entries advance out of this round (the Top-N
   * "winners" of the round). Defines the cut as part of the contest plan — the
   * Advancement control pre-fills it and the timeline can show "Top N advance".
   * Optional; null/undefined = decided ad-hoc at advance time.
   */
  advanceCount?: number;
  /**
   * Per-stage submission template (per-stage artifacts). Only meaningful for
   * `submission` stages — defines the fields an entrant fills for THIS stage
   * (e.g. a proposal round asks for summary/focus/approach; a prototype round
   * asks for repo URL/demo video). The filled values are snapshotted onto the
   * entry's `stageSubmissions`. Absent/empty ⇒ the stage collects no artifact
   * (classic content-only entry), so this is fully additive.
   */
  submissionTemplate?: ContestSubmissionTemplateField[];
  /**
   * How an entry is created for this `submission` stage (Phase 4). `attach`
   * (default/undefined) = the entrant attaches a pre-existing PUBLISHED content
   * item. `proposal` = the entrant submits the form and the server creates a
   * DRAFT placeholder project as the entry (gated by features.contestProposals).
   */
  submissionMode?: 'attach' | 'proposal';
  /**
   * Optional block intro (P2) shown above the form fields on the public
   * submission form — rich instructions (what to submit, tips, links). Stored as
   * BlockTuple[] (`[type, attrs]`, the same shape as the contest bodies) so it
   * renders through BlockContentRenderer; lives in the `stages` jsonb, no migration.
   * Loosely typed (matches the `unknown[][]` the validator infers + the
   * `descriptionBlocks` body pattern); the layer casts to BlockTuple[] at render.
   */
  instructionsBlocks?: unknown[][];
}

/**
 * One field of a `submission` stage's artifact template. Phase 4 widened the
 * type set; `agreement` and `address` (and any field with `pii: true`) are
 * partitioned out of the public `stageSubmissions.fields` artifact at submit
 * time. Mirror of `submissionTemplateFieldSchema` (validators/contest.ts).
 */
export interface ContestSubmissionTemplateField {
  /** Stable machine key (`^[a-z0-9_]+$`) — the key in `stageSubmissions.fields`. */
  key: string;
  /** Human label shown on the entrant form + artifact views. */
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'url'
    | 'email'
    | 'number'
    | 'select'
    | 'checkbox'
    | 'date'
    | 'agreement'
    | 'address';
  required: boolean;
  /** Optional hint shown under the input. */
  help?: string;
  /** `select`-only: the allowed options. */
  options?: Array<{ value: string; label: string }>;
  /** Personal data — stored in `contest_entry_private_fields`, not the artifact. Forced true for `address`. */
  pii?: boolean;
  /** `agreement`-only: terms the entrant must accept (snapshotted on accept). */
  terms?: string;
  /** `agreement`-only: how `terms` renders. */
  termsFormat?: 'markdown' | 'html';
  /** `agreement`-only: require an explicit accept to submit (default true). */
  mustAccept?: boolean;
}

/**
 * A per-stage artifact on an entry: the filled template values for one
 * `submission` stage, snapshotted at submit time. Replaced (not appended) on
 * re-submit while the stage is open.
 */
export interface ContestStageSubmission {
  stageId: string;
  /** Template-field key → entrant-supplied value. */
  fields: Record<string, string>;
  /** ISO timestamp of the (latest) submit. */
  submittedAt: string;
}

/** Per-contest email copy override (session 232). Organizers customize the
 *  subject + plain-text intro of the two contest participation emails; all other
 *  chrome (unsubscribe link, CTA, deadline line, branded shell) stays system-owned.
 *  Absent/empty per field ⇒ the built-in default. Stored in `contests.email_copy`. */
export interface ContestEmailCopyField {
  subject?: string;
  /** Legacy plain-text body (session 232). Superseded by `bodyBlocks` when set. */
  intro?: string;
  /** BlockTuple[] body — the house block editor, rendered email-safe by the
   *  server's renderEmailBlocks. Untyped jsonb mirrors `content_items.content`. */
  bodyBlocks?: unknown[];
}
export interface ContestEmailCopy {
  confirmation?: ContestEmailCopyField;
  reminder?: ContestEmailCopyField;
}

/** @v2 — Contest system. Tables defined but not yet referenced in application code. */
export const contests = pgTable('contests', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  /** Short one-line tagline shown in the contest hero (plain text). */
  subheading: varchar('subheading', { length: 300 }),
  /** Long-form body, rendered per `descriptionFormat` (Markdown or raw HTML). */
  description: text('description'),
  rules: text('rules'),
  /** Intro shown on the Prizes tab, above the individual prize cards. */
  prizesDescription: text('prizes_description'),
  /** Per-field render mode: `markdown` (default, Markdown + safe inline-HTML) or
   *  `html` (author's raw presentational HTML). Each long-form field is independent. */
  descriptionFormat: contestContentFormatEnum('description_format').default('markdown').notNull(),
  rulesFormat: contestContentFormatEnum('rules_format').default('markdown').notNull(),
  prizesDescriptionFormat: contestContentFormatEnum('prizes_description_format').default('markdown').notNull(),
  /**
   * Block-editor body (BlockTuple[]) for the overview/rules — the house editor
   * format (same as projects/blogs/docs). When present, the viewer renders these
   * INSTEAD of the legacy `description`/`rules` text + `*Format` toggle (which stay
   * for back-compat + rollback; converted into blocks on first block-edit). Null ⇒
   * legacy text. Untyped jsonb mirrors `content_items.content`. */
  descriptionBlocks: jsonb('description_blocks'),
  rulesBlocks: jsonb('rules_blocks'),
  prizesBlocks: jsonb('prizes_blocks'),
  /** Master switch for the Prizes tab. When false the tab is hidden even if
   *  prize data exists (and prizes are optional regardless). */
  showPrizes: boolean('show_prizes').default(true).notNull(),
  /** Wide hero banner shown across the top of the contest page (~4:1). */
  bannerUrl: text('banner_url'),
  /** Non-destructive framing for `bannerUrl` (P4): zoom + object-position over the
   *  original image, never a re-crop. Null ⇒ the legacy `cover` fit. */
  bannerMeta: jsonb('banner_meta').$type<ContestImageMeta>(),
  /** Card/thumbnail cover image (~4:3 / 16:9). Optional — listing cards fall
   *  back to a contained `bannerUrl` then a trophy when this is unset. */
  coverImageUrl: text('cover_image_url'),
  /** Non-destructive framing for `coverImageUrl` (P4); same shape as `bannerMeta`. */
  coverMeta: jsonb('cover_meta').$type<ContestImageMeta>(),
  /** Where the cover image renders on the public contest page: `about` (default —
   *  top of the Overview "About" section) or `hero` (under the subheading in the
   *  hero bar). Null ⇒ `about`. */
  coverPlacement: text('cover_placement').$type<ContestCoverPlacement>(),
  status: contestStatusEnum('status').default('upcoming').notNull(),
  /** Ordered stage timeline (Phase B1). `[]` ⇒ server synthesizes the classic
   *  Submissions → Judging → Results stages from `status` + the dates below. */
  stages: jsonb('stages').$type<ContestStage[]>().default([]).notNull(),
  /** Id of the stage that is currently "now". Null ⇒ not running (draft/paused),
   *  or fall back to the status-derived synthesized stage. */
  currentStageId: text('current_stage_id'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  judgingEndDate: timestamp('judging_end_date', { withTimezone: true }),
  prizes: jsonb('prizes').$type<
    Array<{
      /** Finishing place (1, 2, 3…). Optional — omit for category-only prizes. */
      place?: number;
      /** Optional category label (e.g. "Best in Show", "Robotics"). */
      category?: string;
      /** Optional — a prize can be description-only (no forced placement). */
      title?: string;
      description?: string;
      value?: string;
    }>
  >(),
  /**
   * Judging rubric shown to entrants and judges. Each criterion carries a
   * label, an optional weight (points), and optional guidance. Display + scoring
   * guidance only — judges still submit a single 0–100 score per entry.
   */
  judgingCriteria: jsonb('judging_criteria').$type<
    Array<{
      label: string;
      weight?: number;
      description?: string;
    }>
  >(),
  judgingVisibility: judgingVisibilityEnum('judging_visibility').default('judges-only').notNull(),
  /**
   * Content types eligible for entry (subset of the instance content types).
   * Null/empty = any published content the entrant owns. e.g. ['project'].
   */
  eligibleContentTypes: jsonb('eligible_content_types').$type<string[]>(),
  /** Max distinct entries one user may submit. Null = unlimited. */
  maxEntriesPerUser: integer('max_entries_per_user'),
  /** Who can see this contest. Orthogonal to `status` (lifecycle). */
  visibility: contestVisibilityEnum('visibility').default('public').notNull(),
  /** When visibility = 'private', user roles that may view (e.g. ['staff']). */
  visibleToRoles: jsonb('visible_to_roles').$type<string[]>(),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  communityVotingEnabled: boolean('community_voting_enabled').default(false).notNull(),
  entryCount: integer('entry_count').default(0).notNull(),
  /** Per-contest email copy override (session 232). Organizer-only; never
   *  serialized into public contest responses. Null ⇒ built-in default copy. */
  emailCopy: jsonb('email_copy').$type<ContestEmailCopy>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_contests_created_by_id').on(t.createdById),
  index('idx_contests_status').on(t.status),
]);

/** @v2 — Contest entries. Tables defined but not yet referenced in application code. */
export const contestEntries = pgTable('contest_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  contentId: uuid('content_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /**
   * DENORMALIZED. The source of truth is `judgeScores` (the per-judge inputs).
   * `score` is the mean of the CURRENT round's `judgeScores` entries, re-derived
   * by `judgeContestEntry` on every score write. `rank` is RANK() over `score`
   * DESC across the surviving (non-eliminated) cohort, re-derived by
   * `calculateContestRanks` when the contest completes. `stageState[].{score,rank}`
   * is the IMMUTABLE per-round snapshot of these two, taken at each advancement
   * cut and never recomputed. Flow: judgeScores → score → rank → stageState.
   */
  score: integer('score'),
  rank: integer('rank'),
  judgeScores: jsonb('judge_scores').$type<
    Array<{
      judgeId: string;
      /** Overall 0–100 score (normalized weighted sum when criteriaScores set). */
      score: number;
      feedback?: string;
      /** Per-criterion breakdown when the contest defines a judging rubric. */
      criteriaScores?: Array<{ label: string; score: number; max: number }>;
      /** Review stage this score was given in (per-round isolation, Phase B2.5). */
      roundId?: string;
    }>
  >(),
  /**
   * Phase B2 — per-stage cohort outcome. An entry is "active" (still in the
   * running cohort) unless a row here marks it `eliminated`. `advanceContestStage`
   * writes these at a `review` stage's advancement cut, snapshotting the round's
   * score/rank so multi-round history survives. Empty `[]` ⇒ active.
   */
  stageState: jsonb('stage_state').$type<
    Array<{
      stageId: string;
      status: 'advanced' | 'eliminated';
      score?: number | null;
      rank?: number | null;
    }>
  >().default([]).notNull(),
  /**
   * Per-stage artifacts (per-stage submissions). One row per `submission` stage
   * the entrant has filled — the proposal fields, then the prototype fields —
   * each snapshotted with its template values. `[]` ⇒ no artifacts (classic
   * content-only entry). Upserted by stage while that stage is open.
   */
  stageSubmissions: jsonb('stage_submissions').$type<ContestStageSubmission[]>().default([]).notNull(),
  /**
   * True when this entry's content is a DRAFT placeholder auto-created by the
   * form-first proposal flow (`submitContestProposal`) rather than a real project
   * the entrant attached. On withdraw, a placeholder whose content is still a
   * draft is archived along with the entry, so abandoned proposals don't orphan a
   * stub project in the entrant's drafts list. A developed+published placeholder
   * (status no longer `draft`) is the entrant's real entry and is left untouched.
   */
  placeholder: boolean('placeholder').default(false).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('contest_entries_user_content').on(t.contestId, t.userId, t.contentId),
  index('idx_contest_entries_contest_id').on(t.contestId),
  index('idx_contest_entries_user_id').on(t.userId),
]);

// --- Contest Judges ---

export const contestJudges = pgTable('contest_judges', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: judgeRoleEnum('role').default('judge').notNull(),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
}, (t) => [
  unique('uq_contest_judges_contest_user').on(t.contestId, t.userId),
  index('idx_contest_judges_contest_id').on(t.contestId),
  index('idx_contest_judges_user_id').on(t.userId),
]);

// --- Contest Stakeholders ---
// Per-contest collaborators. `role` distinguishes:
//   'reviewer' (default) — view-only: can see a contest (even private/draft)
//     without admin-panel access or being a judge. Distinct from judges (no
//     scoring, not in judge list). This is the original stakeholder semantics.
//   'editor' — full edit rights to THIS contest only, with NO system-wide
//     access. Gated server-side via isContestEditor + the canManage decision on
//     the edit/advance/transition routes. (Operator decision, session 201:
//     stored as a role column here rather than a separate table.)
export const contestStakeholders = pgTable('contest_stakeholders', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).default('reviewer').notNull(),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_contest_stakeholders_contest_user').on(t.contestId, t.userId),
  index('idx_contest_stakeholders_contest_id').on(t.contestId),
  index('idx_contest_stakeholders_user_id').on(t.userId),
]);

// --- Contest Agreement Acceptances (Phase 4) ---
// Immutable audit log: one row each time an entrant accepts an `agreement`
// template field's terms. The terms text + its sha-256 hash are snapshotted so
// the exact wording the entrant agreed to survives later edits to the template.
// Instance-local (never federated). Captured atomically with the submission.
export const contestAgreementAcceptances = pgTable('contest_agreement_acceptances', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => contestEntries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** The submission stage this acceptance was captured in. */
  stageId: text('stage_id').notNull(),
  /** The agreement template field's key. */
  fieldKey: varchar('field_key', { length: 40 }).notNull(),
  /** sha-256 hex of the exact accepted terms (integrity check vs the snapshot). */
  termsHash: varchar('terms_hash', { length: 64 }).notNull(),
  /** The exact terms text shown to and accepted by the entrant. */
  termsSnapshot: text('terms_snapshot').notNull(),
  /** Best-effort client IP captured at acceptance (audit). */
  ip: varchar('ip', { length: 64 }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_contest_agreements_contest_id').on(t.contestId),
  index('idx_contest_agreements_entry_id').on(t.entryId),
]);

// --- Contest Entry Private Fields (PII, Phase 4) ---
// Entrant-supplied personal data (email/address/etc.) for an entry, stored OUT
// of the public `contest_entries.stageSubmissions` jsonb so it is NEVER returned
// by the normal entries endpoints. Access is gated by the `contest.pii`
// permission (seeded admin + staff) OR the entrant reading their own. One row
// per entry, upserted. `fields` keys are the PII template field keys; `address`
// values are JSON-encoded objects.
export const contestEntryPrivateFields = pgTable('contest_entry_private_fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => contestEntries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** PII template-field key → entrant value (`address` values are JSON strings). */
  fields: jsonb('fields').$type<Record<string, string>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_contest_entry_private_fields_entry').on(t.entryId),
  index('idx_contest_entry_private_fields_contest_id').on(t.contestId),
]);

// --- Contest Registrations (participant sign-up) ---
// Optional, self-reported info collected on registration (all fields optional;
// see `contestRegistrationFieldsSchema` for validation). Kept here (the table
// module) so the jsonb column can be typed without a reverse import from the
// validators. `experience`/`team` are closed sets; `building` is free text.
export interface ContestRegistrationFields {
  /** "What are you thinking of building?" — free text, capped in the validator. */
  building?: string;
  /** Self-reported experience level. */
  experience?: 'first' | 'some' | 'experienced';
  /** Team status — solo, already have a team, or looking for teammates. */
  team?: 'solo' | 'have' | 'looking';
}

// A user's intent to participate in a contest. UNLIKE contest_entries, this needs
// no attached content -- it is the audience record for the registration-confirmation
// and deadline-reminder emails. A user can be registered without having entered.
// Instance-local; never federated (matches every other contest table).
export const contestRegistrations = pgTable('contest_registrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Two-tier signup (session 239). `full` = a counted participant (the audience
  // for confirmation + all updates + reminders); `reminders` = a lower-commitment
  // opt-in that gets deadline reminders but is NOT counted as a participant.
  // Default `full` so every pre-existing row (all counted) keeps its meaning.
  tier: text('tier').notNull().default('full'),
  // Optional, self-reported signup info collected at the high-intent post-register
  // moment (never required, never blocks registration): what they plan to build,
  // experience level, team status. Shape validated by contestRegistrationFieldsSchema.
  fields: jsonb('fields').$type<ContestRegistrationFields>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_contest_registrations_contest_user').on(t.contestId, t.userId),
  index('idx_contest_registrations_contest_id').on(t.contestId),
  index('idx_contest_registrations_user_id').on(t.userId),
]);

// --- Contest Reminder Sends (idempotency ledger) ---
// One row per (contest, participant, milestone) that has been ENQUEUED. The
// UNIQUE constraint + `ON CONFLICT DO NOTHING RETURNING` is the claim: the sweep
// only emails the rows it actually inserts, so a milestone is delivered exactly
// once per participant even across worker ticks and multiple replicas.
export const contestReminderSends = pgTable('contest_reminder_sends', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 'deadline_T7d' | 'deadline_T48h' | 'deadline_T24h' | 'deadline_T1h' */
  milestone: text('milestone').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_contest_reminder_sends_contest_user_milestone').on(t.contestId, t.userId, t.milestone),
  index('idx_contest_reminder_sends_contest_id').on(t.contestId),
]);

// --- Relations ---

export const contestsRelations = relations(contests, ({ one, many }) => ({
  createdBy: one(users, { fields: [contests.createdById], references: [users.id] }),
  entries: many(contestEntries),
  judgeList: many(contestJudges),
  registrations: many(contestRegistrations),
}));

export const contestRegistrationsRelations = relations(contestRegistrations, ({ one }) => ({
  contest: one(contests, { fields: [contestRegistrations.contestId], references: [contests.id] }),
  user: one(users, { fields: [contestRegistrations.userId], references: [users.id] }),
}));

export const contestReminderSendsRelations = relations(contestReminderSends, ({ one }) => ({
  contest: one(contests, { fields: [contestReminderSends.contestId], references: [contests.id] }),
  user: one(users, { fields: [contestReminderSends.userId], references: [users.id] }),
}));

export const contestEntriesRelations = relations(contestEntries, ({ one }) => ({
  contest: one(contests, { fields: [contestEntries.contestId], references: [contests.id] }),
  content: one(contentItems, {
    fields: [contestEntries.contentId],
    references: [contentItems.id],
  }),
  user: one(users, { fields: [contestEntries.userId], references: [users.id] }),
}));

export const contestJudgesRelations = relations(contestJudges, ({ one }) => ({
  contest: one(contests, { fields: [contestJudges.contestId], references: [contests.id] }),
  user: one(users, { fields: [contestJudges.userId], references: [users.id] }),
}));

export const contestStakeholdersRelations = relations(contestStakeholders, ({ one }) => ({
  contest: one(contests, { fields: [contestStakeholders.contestId], references: [contests.id] }),
  user: one(users, { fields: [contestStakeholders.userId], references: [users.id] }),
}));

export const contestAgreementAcceptancesRelations = relations(contestAgreementAcceptances, ({ one }) => ({
  contest: one(contests, { fields: [contestAgreementAcceptances.contestId], references: [contests.id] }),
  entry: one(contestEntries, { fields: [contestAgreementAcceptances.entryId], references: [contestEntries.id] }),
  user: one(users, { fields: [contestAgreementAcceptances.userId], references: [users.id] }),
}));

export const contestEntryPrivateFieldsRelations = relations(contestEntryPrivateFields, ({ one }) => ({
  contest: one(contests, { fields: [contestEntryPrivateFields.contestId], references: [contests.id] }),
  entry: one(contestEntries, { fields: [contestEntryPrivateFields.entryId], references: [contestEntries.id] }),
  user: one(users, { fields: [contestEntryPrivateFields.userId], references: [users.id] }),
}));

// --- Inferred Types ---
export type ContestRow = typeof contests.$inferSelect;
export type NewContestRow = typeof contests.$inferInsert;
export type ContestEntryRow = typeof contestEntries.$inferSelect;
export type NewContestEntryRow = typeof contestEntries.$inferInsert;
export type ContestJudgeRow = typeof contestJudges.$inferSelect;
export type NewContestJudgeRow = typeof contestJudges.$inferInsert;
export type ContestStakeholderRow = typeof contestStakeholders.$inferSelect;
export type NewContestStakeholderRow = typeof contestStakeholders.$inferInsert;
export type ContestAgreementAcceptanceRow = typeof contestAgreementAcceptances.$inferSelect;
export type NewContestAgreementAcceptanceRow = typeof contestAgreementAcceptances.$inferInsert;
export type ContestEntryPrivateFieldsRow = typeof contestEntryPrivateFields.$inferSelect;
export type NewContestEntryPrivateFieldsRow = typeof contestEntryPrivateFields.$inferInsert;
export type ContestRegistrationRow = typeof contestRegistrations.$inferSelect;
export type NewContestRegistrationRow = typeof contestRegistrations.$inferInsert;
export type ContestReminderSendRow = typeof contestReminderSends.$inferSelect;
export type NewContestReminderSendRow = typeof contestReminderSends.$inferInsert;
