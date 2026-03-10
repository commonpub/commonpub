import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth';
import { contentItems } from './content';
import {
  communityRoleEnum,
  communityJoinPolicyEnum,
  postTypeEnum,
} from './enums';

export const communities = pgTable('communities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  description: text('description'),
  rules: text('rules'),
  iconUrl: text('icon_url'),
  bannerUrl: text('banner_url'),
  joinPolicy: communityJoinPolicyEnum('join_policy').default('open').notNull(),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  isOfficial: boolean('is_official').default(false).notNull(),
  memberCount: integer('member_count').default(0).notNull(),
  postCount: integer('post_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityMembers = pgTable(
  'community_members',
  {
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: communityRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })],
);

export const communityPosts = pgTable('community_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: postTypeEnum('type').default('text').notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  replyCount: integer('reply_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityPostReplies = pgTable('community_post_replies', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id')
    .notNull()
    .references(() => communityPosts.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityBans = pgTable('community_bans', {
  id: uuid('id').defaultRandom().primaryKey(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bannedById: uuid('banned_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityInvites = pgTable('community_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).notNull().unique(),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityShares = pgTable('community_shares', {
  id: uuid('id').defaultRandom().primaryKey(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  contentId: uuid('content_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  sharedById: uuid('shared_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const communitiesRelations = relations(communities, ({ one, many }) => ({
  createdBy: one(users, { fields: [communities.createdById], references: [users.id] }),
  members: many(communityMembers),
  posts: many(communityPosts),
  bans: many(communityBans),
  invites: many(communityInvites),
  shares: many(communityShares),
}));

export const communityMembersRelations = relations(communityMembers, ({ one }) => ({
  community: one(communities, {
    fields: [communityMembers.communityId],
    references: [communities.id],
  }),
  user: one(users, { fields: [communityMembers.userId], references: [users.id] }),
}));

export const communityPostsRelations = relations(communityPosts, ({ one, many }) => ({
  community: one(communities, {
    fields: [communityPosts.communityId],
    references: [communities.id],
  }),
  author: one(users, { fields: [communityPosts.authorId], references: [users.id] }),
  replies: many(communityPostReplies),
}));

export const communityPostRepliesRelations = relations(communityPostReplies, ({ one, many }) => ({
  post: one(communityPosts, {
    fields: [communityPostReplies.postId],
    references: [communityPosts.id],
  }),
  author: one(users, { fields: [communityPostReplies.authorId], references: [users.id] }),
  parent: one(communityPostReplies, {
    fields: [communityPostReplies.parentId],
    references: [communityPostReplies.id],
    relationName: 'replyThread',
  }),
  children: many(communityPostReplies, { relationName: 'replyThread' }),
}));

export const communityBansRelations = relations(communityBans, ({ one }) => ({
  community: one(communities, {
    fields: [communityBans.communityId],
    references: [communities.id],
  }),
  user: one(users, { fields: [communityBans.userId], references: [users.id] }),
  bannedBy: one(users, { fields: [communityBans.bannedById], references: [users.id] }),
}));

export const communityInvitesRelations = relations(communityInvites, ({ one }) => ({
  community: one(communities, {
    fields: [communityInvites.communityId],
    references: [communities.id],
  }),
  createdBy: one(users, { fields: [communityInvites.createdById], references: [users.id] }),
}));

export const communitySharesRelations = relations(communityShares, ({ one }) => ({
  community: one(communities, {
    fields: [communityShares.communityId],
    references: [communities.id],
  }),
  content: one(contentItems, {
    fields: [communityShares.contentId],
    references: [contentItems.id],
  }),
  sharedBy: one(users, { fields: [communityShares.sharedById], references: [users.id] }),
}));
