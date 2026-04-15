import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { contentItems } from './content.js';
import {
  hubTypeEnum,
  hubPrivacyEnum,
  hubRoleEnum,
  hubJoinPolicyEnum,
  hubMemberStatusEnum,
  postTypeEnum,
  followRelationshipStatusEnum,
  resourceCategoryEnum,
} from './enums.js';
import { unique } from 'drizzle-orm/pg-core';

// Step B complete: pgTable names now match the renamed DB tables.
// Run deploy/migrations/001-rename-communities-to-hubs.sql before deploying this code.

export const hubs = pgTable('hubs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  description: text('description'),
  rules: text('rules'),
  iconUrl: text('icon_url'),
  bannerUrl: text('banner_url'),
  hubType: hubTypeEnum('hub_type').default('community').notNull(),
  privacy: hubPrivacyEnum('privacy').default('public').notNull(),
  joinPolicy: hubJoinPolicyEnum('join_policy').default('open').notNull(),
  parentHubId: uuid('parent_hub_id'),
  website: varchar('website', { length: 512 }),
  categories: jsonb('categories').$type<string[]>(),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  isOfficial: boolean('is_official').default(false).notNull(),
  memberCount: integer('member_count').default(0).notNull(),
  postCount: integer('post_count').default(0).notNull(),
  apActorId: text('ap_actor_id'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  index('idx_hubs_created_by_id').on(t.createdById),
  index('idx_hubs_hub_type').on(t.hubType),
]);

export const hubMembers = pgTable(
  'hub_members',
  {
    hubId: uuid('hub_id')
      .notNull()
      .references(() => hubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: hubRoleEnum('role').default('member').notNull(),
    status: hubMemberStatusEnum('status').default('active').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.hubId, t.userId] })],
);

export const hubPosts = pgTable('hub_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  hubId: uuid('hub_id')
    .notNull()
    .references(() => hubs.id, { onDelete: 'cascade' }),
  /** Nullable for federated posts where the author has no local user record */
  authorId: uuid('author_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  type: postTypeEnum('type').default('text').notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  replyCount: integer('reply_count').default(0).notNull(),
  /** Remote actor URI for federated posts (null for local posts) */
  remoteActorUri: text('remote_actor_uri'),
  /** Display name of remote actor (cached at insert time) */
  remoteActorName: text('remote_actor_name'),
  lastEditedAt: timestamp('last_edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  index('idx_hub_posts_hub_id').on(t.hubId),
  index('idx_hub_posts_author_id').on(t.authorId),
]);

export const hubPostReplies = pgTable('hub_post_replies', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id')
    .notNull()
    .references(() => hubPosts.id, { onDelete: 'cascade' }),
  /** Nullable for federated replies where the author has no local user record */
  authorId: uuid('author_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  // Self-referencing FK handled via relations; DB-level constraint added via migration
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  /** Remote actor URI for federated replies (null for local replies) */
  remoteActorUri: text('remote_actor_uri'),
  /** Display name of remote actor (cached at insert time) */
  remoteActorName: text('remote_actor_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  index('idx_hub_post_replies_post_id').on(t.postId),
  index('idx_hub_post_replies_author_id').on(t.authorId),
]);

export const hubPostLikes = pgTable('hub_post_likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id')
    .notNull()
    .references(() => hubPosts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_hub_post_likes_post_user').on(t.postId, t.userId),
  index('idx_hub_post_likes_post_id').on(t.postId),
  index('idx_hub_post_likes_user_id').on(t.userId),
]);

export const hubBans = pgTable('hub_bans', {
  id: uuid('id').defaultRandom().primaryKey(),
  hubId: uuid('hub_id')
    .notNull()
    .references(() => hubs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bannedById: uuid('banned_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_hub_bans_hub_id').on(t.hubId),
  index('idx_hub_bans_user_id').on(t.userId),
]);

export const hubInvites = pgTable('hub_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  hubId: uuid('hub_id')
    .notNull()
    .references(() => hubs.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).notNull().unique(),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_hub_invites_hub_id').on(t.hubId),
]);

export const hubShares = pgTable('hub_shares', {
  id: uuid('id').defaultRandom().primaryKey(),
  hubId: uuid('hub_id')
    .notNull()
    .references(() => hubs.id, { onDelete: 'cascade' }),
  contentId: uuid('content_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  sharedById: uuid('shared_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_hub_shares_hub_id').on(t.hubId),
  index('idx_hub_shares_content_id').on(t.contentId),
  unique('uq_hub_shares_hub_content').on(t.hubId, t.contentId),
]);

/** RSA keypairs for hub Group actors (separate from user keypairs) */
export const hubActorKeypairs = pgTable('hub_actor_keypairs', {
  id: uuid('id').defaultRandom().primaryKey(),
  hubId: uuid('hub_id')
    .notNull()
    .references(() => hubs.id, { onDelete: 'cascade' })
    .unique(),
  publicKeyPem: text('public_key_pem').notNull(),
  privateKeyPem: text('private_key_pem').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Remote actors following a hub's Group actor */
export const hubFollowers = pgTable('hub_followers_fed', {
  id: uuid('id').defaultRandom().primaryKey(),
  hubId: uuid('hub_id')
    .notNull()
    .references(() => hubs.id, { onDelete: 'cascade' }),
  followerActorUri: text('follower_actor_uri').notNull(),
  /** Original Follow activity URI for Undo matching */
  activityUri: text('activity_uri'),
  status: followRelationshipStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  unique('hub_followers_fed_pair').on(t.hubId, t.followerActorUri),
  index('idx_hub_followers_fed_hub').on(t.hubId),
]);

// --- Hub Resources ---

export const hubResources = pgTable('hub_resources', {
  id: uuid('id').defaultRandom().primaryKey(),
  hubId: uuid('hub_id').notNull().references(() => hubs.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  url: text('url').notNull(),
  description: text('description'),
  category: resourceCategoryEnum('category').default('other').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  addedById: uuid('added_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  index('idx_hub_resources_hub_id').on(t.hubId),
  index('idx_hub_resources_added_by_id').on(t.addedById),
]);

// --- Relations ---

export const hubResourcesRelations = relations(hubResources, ({ one }) => ({
  hub: one(hubs, { fields: [hubResources.hubId], references: [hubs.id] }),
  addedBy: one(users, { fields: [hubResources.addedById], references: [users.id] }),
}));

export const hubActorKeypairsRelations = relations(hubActorKeypairs, ({ one }) => ({
  hub: one(hubs, { fields: [hubActorKeypairs.hubId], references: [hubs.id] }),
}));

export const hubFollowersRelations = relations(hubFollowers, ({ one }) => ({
  hub: one(hubs, { fields: [hubFollowers.hubId], references: [hubs.id] }),
}));

export const hubsRelations = relations(hubs, ({ one, many }) => ({
  createdBy: one(users, { fields: [hubs.createdById], references: [users.id] }),
  parentHub: one(hubs, {
    fields: [hubs.parentHubId],
    references: [hubs.id],
    relationName: 'hubHierarchy',
  }),
  childHubs: many(hubs, { relationName: 'hubHierarchy' }),
  members: many(hubMembers),
  posts: many(hubPosts),
  bans: many(hubBans),
  invites: many(hubInvites),
  shares: many(hubShares),
  resources: many(hubResources),
}));

export const hubMembersRelations = relations(hubMembers, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubMembers.hubId],
    references: [hubs.id],
  }),
  user: one(users, { fields: [hubMembers.userId], references: [users.id] }),
}));

export const hubPostsRelations = relations(hubPosts, ({ one, many }) => ({
  hub: one(hubs, {
    fields: [hubPosts.hubId],
    references: [hubs.id],
  }),
  author: one(users, { fields: [hubPosts.authorId], references: [users.id] }),
  replies: many(hubPostReplies),
  likes: many(hubPostLikes),
}));

export const hubPostRepliesRelations = relations(hubPostReplies, ({ one, many }) => ({
  post: one(hubPosts, {
    fields: [hubPostReplies.postId],
    references: [hubPosts.id],
  }),
  author: one(users, { fields: [hubPostReplies.authorId], references: [users.id] }),
  parent: one(hubPostReplies, {
    fields: [hubPostReplies.parentId],
    references: [hubPostReplies.id],
    relationName: 'replyThread',
  }),
  children: many(hubPostReplies, { relationName: 'replyThread' }),
}));

export const hubPostLikesRelations = relations(hubPostLikes, ({ one }) => ({
  post: one(hubPosts, { fields: [hubPostLikes.postId], references: [hubPosts.id] }),
  user: one(users, { fields: [hubPostLikes.userId], references: [users.id] }),
}));

export const hubBansRelations = relations(hubBans, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubBans.hubId],
    references: [hubs.id],
  }),
  user: one(users, { fields: [hubBans.userId], references: [users.id] }),
  bannedBy: one(users, { fields: [hubBans.bannedById], references: [users.id] }),
}));

export const hubInvitesRelations = relations(hubInvites, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubInvites.hubId],
    references: [hubs.id],
  }),
  createdBy: one(users, { fields: [hubInvites.createdById], references: [users.id] }),
}));

export const hubSharesRelations = relations(hubShares, ({ one }) => ({
  hub: one(hubs, {
    fields: [hubShares.hubId],
    references: [hubs.id],
  }),
  content: one(contentItems, {
    fields: [hubShares.contentId],
    references: [contentItems.id],
  }),
  sharedBy: one(users, { fields: [hubShares.sharedById], references: [users.id] }),
}));

// --- Inferred Types ---
export type HubRow = typeof hubs.$inferSelect;
export type NewHubRow = typeof hubs.$inferInsert;
export type HubMemberRow = typeof hubMembers.$inferSelect;
export type NewHubMemberRow = typeof hubMembers.$inferInsert;
export type HubPostRow = typeof hubPosts.$inferSelect;
export type NewHubPostRow = typeof hubPosts.$inferInsert;
export type HubPostReplyRow = typeof hubPostReplies.$inferSelect;
export type NewHubPostReplyRow = typeof hubPostReplies.$inferInsert;
export type HubPostLikeRow = typeof hubPostLikes.$inferSelect;
export type NewHubPostLikeRow = typeof hubPostLikes.$inferInsert;
export type HubBanRow = typeof hubBans.$inferSelect;
export type NewHubBanRow = typeof hubBans.$inferInsert;
export type HubInviteRow = typeof hubInvites.$inferSelect;
export type NewHubInviteRow = typeof hubInvites.$inferInsert;
export type HubShareRow = typeof hubShares.$inferSelect;
export type NewHubShareRow = typeof hubShares.$inferInsert;
export type HubActorKeypairRow = typeof hubActorKeypairs.$inferSelect;
export type NewHubActorKeypairRow = typeof hubActorKeypairs.$inferInsert;
export type HubFollowerRow = typeof hubFollowers.$inferSelect;
export type NewHubFollowerRow = typeof hubFollowers.$inferInsert;
export type HubResourceRow = typeof hubResources.$inferSelect;
export type NewHubResourceRow = typeof hubResources.$inferInsert;
