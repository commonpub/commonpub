import { pgTable, uuid, varchar, integer, timestamp, boolean, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { hubPosts } from './hub.js';
import { contests, contestEntries } from './contest.js';
import { voteDirectionEnum } from './enums.js';

// --- Hub Post Votes (upvote/downvote) ---

export const hubPostVotes = pgTable('hub_post_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id')
    .notNull()
    .references(() => hubPosts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  direction: voteDirectionEnum('direction').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_hub_post_votes_post_user').on(t.postId, t.userId),
  index('idx_hub_post_votes_post_id').on(t.postId),
  index('idx_hub_post_votes_user_id').on(t.userId),
]);

// --- Polls ---

export const pollOptions = pgTable('poll_options', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id')
    .notNull()
    .references(() => hubPosts.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }).notNull(),
  voteCount: integer('vote_count').default(0).notNull(),
  order: integer('order').default(0).notNull(),
}, (t) => [
  index('idx_poll_options_post_id').on(t.postId),
]);

export const pollVotes = pgTable('poll_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  optionId: uuid('option_id')
    .notNull()
    .references(() => pollOptions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id')
    .notNull()
    .references(() => hubPosts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_poll_votes_post_user').on(t.postId, t.userId),
  index('idx_poll_votes_option_id').on(t.optionId),
  index('idx_poll_votes_user_id').on(t.userId),
]);

// --- Contest Entry Votes ---

export const contestEntryVotes = pgTable('contest_entry_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => contestEntries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_contest_entry_votes_entry_user').on(t.entryId, t.userId),
  index('idx_contest_entry_votes_entry_id').on(t.entryId),
  index('idx_contest_entry_votes_user_id').on(t.userId),
]);

// --- Relations ---

export const hubPostVotesRelations = relations(hubPostVotes, ({ one }) => ({
  post: one(hubPosts, { fields: [hubPostVotes.postId], references: [hubPosts.id] }),
  user: one(users, { fields: [hubPostVotes.userId], references: [users.id] }),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  post: one(hubPosts, { fields: [pollOptions.postId], references: [hubPosts.id] }),
  votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  option: one(pollOptions, { fields: [pollVotes.optionId], references: [pollOptions.id] }),
  user: one(users, { fields: [pollVotes.userId], references: [users.id] }),
  post: one(hubPosts, { fields: [pollVotes.postId], references: [hubPosts.id] }),
}));

export const contestEntryVotesRelations = relations(contestEntryVotes, ({ one }) => ({
  entry: one(contestEntries, { fields: [contestEntryVotes.entryId], references: [contestEntries.id] }),
  user: one(users, { fields: [contestEntryVotes.userId], references: [users.id] }),
}));

// --- Inferred Types ---
export type HubPostVoteRow = typeof hubPostVotes.$inferSelect;
export type NewHubPostVoteRow = typeof hubPostVotes.$inferInsert;
export type PollOptionRow = typeof pollOptions.$inferSelect;
export type NewPollOptionRow = typeof pollOptions.$inferInsert;
export type PollVoteRow = typeof pollVotes.$inferSelect;
export type NewPollVoteRow = typeof pollVotes.$inferInsert;
export type ContestEntryVoteRow = typeof contestEntryVotes.$inferSelect;
export type NewContestEntryVoteRow = typeof contestEntryVotes.$inferInsert;
