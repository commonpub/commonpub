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
}

/** One field of a `submission` stage's artifact template. */
export interface ContestSubmissionTemplateField {
  /** Stable machine key (`^[a-z0-9_]+$`) — the key in `stageSubmissions.fields`. */
  key: string;
  /** Human label shown on the entrant form + artifact views. */
  label: string;
  type: 'text' | 'textarea' | 'url';
  required: boolean;
  /** Optional hint shown under the input. */
  help?: string;
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

/** @v2 — Contest system. Tables defined but not yet referenced in application code. */
export const contests = pgTable('contests', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  /** Short one-line tagline shown in the contest hero (plain text). */
  subheading: varchar('subheading', { length: 300 }),
  /** Long-form body, rendered per `contentFormat` (Markdown or raw HTML). */
  description: text('description'),
  rules: text('rules'),
  /** Intro shown on the Prizes tab, above the individual prize cards. */
  prizesDescription: text('prizes_description'),
  /**
   * @deprecated Superseded by the per-field `*Format` columns below (session 197).
   * Kept as an inert column to avoid a rename-ambiguous migration; safe to drop
   * in a later interactive `db:generate`. No code reads it.
   */
  contentFormat: contestContentFormatEnum('content_format').default('markdown').notNull(),
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
  /** Master switch for the Prizes tab. When false the tab is hidden even if
   *  prize data exists (and prizes are optional regardless). */
  showPrizes: boolean('show_prizes').default(true).notNull(),
  /** Wide hero banner shown across the top of the contest page (~4:1). */
  bannerUrl: text('banner_url'),
  /** Card/thumbnail cover image (~4:3 / 16:9). Optional — listing cards fall
   *  back to a contained `bannerUrl` then a trophy when this is unset. */
  coverImageUrl: text('cover_image_url'),
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
   * @deprecated Vestigial. Judges are stored in the `contest_judges` table (the
   * single source of truth); `createContest` seeds that table from create input.
   * This column is no longer read or written — retained only to avoid a
   * destructive DROP migration. Do not use.
   */
  judges: jsonb('judges').$type<string[]>(),
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

// --- Relations ---

export const contestsRelations = relations(contests, ({ one, many }) => ({
  createdBy: one(users, { fields: [contests.createdById], references: [users.id] }),
  entries: many(contestEntries),
  judgeList: many(contestJudges),
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

// --- Inferred Types ---
export type ContestRow = typeof contests.$inferSelect;
export type NewContestRow = typeof contests.$inferInsert;
export type ContestEntryRow = typeof contestEntries.$inferSelect;
export type NewContestEntryRow = typeof contestEntries.$inferInsert;
export type ContestJudgeRow = typeof contestJudges.$inferSelect;
export type NewContestJudgeRow = typeof contestJudges.$inferInsert;
export type ContestStakeholderRow = typeof contestStakeholders.$inferSelect;
export type NewContestStakeholderRow = typeof contestStakeholders.$inferInsert;
