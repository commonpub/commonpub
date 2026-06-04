import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { contentItems } from './content.js';
import { contestStatusEnum, judgeRoleEnum, judgingVisibilityEnum, contestVisibilityEnum } from './enums.js';

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
}

/** @v2 — Contest system. Tables defined but not yet referenced in application code. */
export const contests = pgTable('contests', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  /** Short one-line tagline shown in the contest hero (plain text). */
  subheading: varchar('subheading', { length: 300 }),
  /** Long-form body, rendered as Markdown (may contain inline HTML). */
  description: text('description'),
  rules: text('rules'),
  /** Markdown intro shown on the Prizes tab, above the individual prize cards. */
  prizesDescription: text('prizes_description'),
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
// View-only reviewers: can see a contest (even private/draft) without admin-panel
// access or being a judge. Distinct from judges (no scoring, not in judge list).
export const contestStakeholders = pgTable('contest_stakeholders', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
