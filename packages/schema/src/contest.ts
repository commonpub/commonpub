import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { contentItems } from './content.js';
import { contestStatusEnum, judgeRoleEnum, judgingVisibilityEnum, contestVisibilityEnum } from './enums.js';

/** @v2 — Contest system. Tables defined but not yet referenced in application code. */
export const contests = pgTable('contests', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  rules: text('rules'),
  bannerUrl: text('banner_url'),
  status: contestStatusEnum('status').default('upcoming').notNull(),
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
