import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index, unique, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { activityDirectionEnum, activityStatusEnum, followRelationshipStatusEnum, mirrorStatusEnum, mirrorDirectionEnum, hubFollowStatusEnum } from './enums.js';

/** Cache of resolved remote ActivityPub actors */
export const remoteActors = pgTable('remote_actors', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUri: text('actor_uri').notNull().unique(),
  inbox: text('inbox').notNull(),
  outbox: text('outbox'),
  sharedInbox: text('shared_inbox'),
  publicKeyPem: text('public_key_pem'),
  preferredUsername: varchar('preferred_username', { length: 64 }),
  displayName: varchar('display_name', { length: 128 }),
  summary: text('summary'),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  /** AP actor type: 'Person', 'Group', 'Service', etc. */
  actorType: varchar('actor_type', { length: 32 }).default('Person').notNull(),
  instanceDomain: varchar('instance_domain', { length: 255 }).notNull(),
  followerCount: integer('follower_count'),
  followingCount: integer('following_count'),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Log of inbound/outbound AP activities */
export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 64 }).notNull(),
  actorUri: text('actor_uri').notNull(),
  objectUri: text('object_uri'),
  payload: jsonb('payload').notNull(),
  direction: activityDirectionEnum('direction').notNull(),
  status: activityStatusEnum('status').default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  error: text('error'),
  /** Advisory lock timestamp for multi-worker delivery safety */
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  /** Set when activity permanently fails after max retries (dead letter) */
  deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_activities_direction_status').on(t.direction, t.status),
  index('idx_activities_actor_uri').on(t.actorUri),
  index('idx_activities_created_at').on(t.createdAt),
]);

/** Federation-aware follow relationships (separate from local follows) */
export const followRelationships = pgTable('follow_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  followerActorUri: text('follower_actor_uri').notNull(),
  followingActorUri: text('following_actor_uri').notNull(),
  /** The original Follow activity URI — used by Undo to target the correct relationship */
  activityUri: text('activity_uri'),
  status: followRelationshipStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  unique('follow_relationships_pair').on(t.followerActorUri, t.followingActorUri),
]);

/** RSA signing keys per user for ActivityPub HTTP Signatures */
export const actorKeypairs = pgTable('actor_keypairs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  publicKeyPem: text('public_key_pem').notNull(),
  privateKeyPem: text('private_key_pem').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Federated content received from remote instances via inbox Create activities */
export const federatedContent = pgTable('federated_content', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** Canonical AP object URI on the origin instance — unique to prevent duplicates */
  objectUri: text('object_uri').notNull().unique(),
  /** URI of the remote actor who authored this content */
  actorUri: text('actor_uri').notNull(),
  /** FK to cached remote actor (nullable if actor was purged) */
  remoteActorId: uuid('remote_actor_id').references(() => remoteActors.id, { onDelete: 'set null' }),
  /** Domain of the origin instance — used for filtering and loop prevention */
  originDomain: varchar('origin_domain', { length: 255 }).notNull(),
  /** Standard AP object type: 'Article', 'Note', 'Page', etc. */
  apType: varchar('ap_type', { length: 32 }).notNull(),
  title: text('title'),
  /** Sanitized HTML content */
  content: text('content'),
  summary: text('summary'),
  /** Canonical URL on origin instance (for linking back) */
  url: text('url'),
  coverImageUrl: text('cover_image_url'),
  /** AP tags/hashtags */
  tags: jsonb('tags').$type<Array<{ type: string; name: string }>>().default([]),
  /** AP attachments (images, files) */
  attachments: jsonb('attachments').$type<Array<{ type: string; url: string; name?: string }>>().default([]),
  /** If this is a reply, the URI of the parent object */
  inReplyTo: text('in_reply_to'),
  /** CommonPub-specific content type (if from another CommonPub instance) */
  cpubType: varchar('cpub_type', { length: 32 }),
  /** CommonPub-specific metadata (BOM, specs, learning data, etc.) */
  cpubMetadata: jsonb('cpub_metadata'),
  /** Original block tuples from CommonPub instances — preserves full content structure */
  cpubBlocks: jsonb('cpub_blocks'),
  /** Local engagement counters */
  localLikeCount: integer('local_like_count').default(0).notNull(),
  localCommentCount: integer('local_comment_count').default(0).notNull(),
  localBoostCount: integer('local_boost_count').default(0).notNull(),
  localViewCount: integer('local_view_count').default(0).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  /** Soft delete timestamp (set on inbound Delete activity) */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  /** FK to mirror config if content arrived via instance mirroring */
  mirrorId: uuid('mirror_id'),
  /** Admin can hide specific mirrored content */
  isHidden: boolean('is_hidden').default(false).notNull(),
}, (t) => [
  index('idx_fedcontent_actor_uri').on(t.actorUri),
  index('idx_fedcontent_origin_domain').on(t.originDomain),
  index('idx_fedcontent_received_at').on(t.receivedAt),
  index('idx_fedcontent_ap_type').on(t.apType),
  index('idx_fedcontent_cpub_type').on(t.cpubType),
  index('idx_fedcontent_mirror_id').on(t.mirrorId),
  index('idx_fedcontent_object_uri').on(t.objectUri),
]);

/** "I Built This" marks on federated content (separate from local contentBuilds which has FK to contentItems) */
export const federatedContentBuilds = pgTable(
  'federated_content_builds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    federatedContentId: uuid('federated_content_id')
      .notNull()
      .references(() => federatedContent.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('fed_content_builds_user_content').on(t.userId, t.federatedContentId),
    index('idx_fed_content_builds_content_id').on(t.federatedContentId),
  ],
);

/** Instance-level mirror subscriptions */
export const instanceMirrors = pgTable('instance_mirrors', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** Domain of the remote instance being mirrored */
  remoteDomain: varchar('remote_domain', { length: 255 }).notNull().unique(),
  /** AP actor URI of the remote instance actor */
  remoteActorUri: text('remote_actor_uri').notNull(),
  status: mirrorStatusEnum('status').default('pending').notNull(),
  /** 'pull' = we mirror them, 'push' = they mirror us */
  direction: mirrorDirectionEnum('direction').notNull(),
  /** Filter: only accept these content types (null = all) */
  filterContentTypes: jsonb('filter_content_types').$type<string[] | null>(),
  /** Filter: only accept content with these tags (null = all) */
  filterTags: jsonb('filter_tags').$type<string[] | null>(),
  /** Stats */
  contentCount: integer('content_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  lastError: text('last_error'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  /** When the mirror was paused — used for gap-fill on resume */
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  /** Last processed outbox page URL for backfill resume */
  backfillCursor: text('backfill_cursor'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const actorKeypairsRelations = relations(actorKeypairs, ({ one }) => ({
  user: one(users, { fields: [actorKeypairs.userId], references: [users.id] }),
}));

export const federatedContentRelations = relations(federatedContent, ({ one }) => ({
  remoteActor: one(remoteActors, {
    fields: [federatedContent.remoteActorId],
    references: [remoteActors.id],
  }),
  mirror: one(instanceMirrors, {
    fields: [federatedContent.mirrorId],
    references: [instanceMirrors.id],
  }),
}));

// --- Federated Hubs (Seamless Hub Mirroring) ---

/** Remote hubs mirrored from other CommonPub instances via Group actor follows */
export const federatedHubs = pgTable('federated_hubs', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** AP Group actor URI of the remote hub — unique to prevent duplicates */
  actorUri: text('actor_uri').notNull().unique(),
  /** FK to cached remote actor (Group type) */
  remoteActorId: uuid('remote_actor_id').references(() => remoteActors.id, { onDelete: 'set null' }),
  /** Domain of the origin instance */
  originDomain: varchar('origin_domain', { length: 255 }).notNull(),
  /** Hub slug on the remote instance */
  remoteSlug: varchar('remote_slug', { length: 128 }).notNull(),
  /** Hub name */
  name: varchar('name', { length: 256 }).notNull(),
  description: text('description'),
  iconUrl: text('icon_url'),
  bannerUrl: text('banner_url'),
  /** Remote hub type (community, product, company) */
  hubType: varchar('hub_type', { length: 32 }).default('community').notNull(),
  /** Remote member count (snapshot from Group actor) */
  remoteMemberCount: integer('remote_member_count').default(0).notNull(),
  /** Remote post count (snapshot) */
  remotePostCount: integer('remote_post_count').default(0).notNull(),
  /** Count of posts mirrored locally */
  localPostCount: integer('local_post_count').default(0).notNull(),
  /** Follow relationship status (pending = follow sent, active = accepted) */
  status: followRelationshipStatusEnum('status').default('pending').notNull(),
  /** The outbound Follow activity URI — for Undo */
  followActivityUri: text('follow_activity_uri'),
  /** Canonical URL to the hub on the origin instance */
  url: text('url'),
  /** Remote hub's rules (JSON or text) */
  rules: text('rules'),
  /** Remote hub categories/tags */
  categories: jsonb('categories').$type<string[] | null>(),
  /** Admin can hide a mirrored hub */
  isHidden: boolean('is_hidden').default(false).notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_fedhubs_origin_domain').on(t.originDomain),
  index('idx_fedhubs_status_hidden').on(t.status, t.isHidden),
  index('idx_fedhubs_name').on(t.name),
  index('idx_fedhubs_remote_actor_id').on(t.remoteActorId),
]);

/** Posts from federated hubs, received via Announce activities from remote Group actors */
export const federatedHubPosts = pgTable('federated_hub_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** FK to the federated hub this post belongs to */
  federatedHubId: uuid('federated_hub_id').notNull().references(() => federatedHubs.id, { onDelete: 'cascade' }),
  /** AP object URI of the original Note/Article — unique to prevent duplicates */
  objectUri: text('object_uri').notNull().unique(),
  /** URI of the remote actor who authored the post */
  actorUri: text('actor_uri').notNull(),
  /** FK to cached remote actor */
  remoteActorId: uuid('remote_actor_id').references(() => remoteActors.id, { onDelete: 'set null' }),
  /** Post content (text, HTML, or JSON share payload) */
  content: text('content').notNull(),
  /** Post type from remote (text, discussion, question, showcase, share, etc.) */
  postType: varchar('post_type', { length: 32 }).default('text').notNull(),
  /** Is pinned on the remote hub */
  isPinned: boolean('is_pinned').default(false).notNull(),
  /** Local engagement counters */
  localLikeCount: integer('local_like_count').default(0).notNull(),
  localReplyCount: integer('local_reply_count').default(0).notNull(),
  /** Remote engagement snapshot */
  remoteLikeCount: integer('remote_like_count').default(0).notNull(),
  remoteReplyCount: integer('remote_reply_count').default(0).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  /** Shared content metadata (title, coverImage, type, originUrl) when post is a content share */
  sharedContentMeta: jsonb('shared_content_meta'),
  /** Soft delete (set on inbound Delete activity) */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('idx_fedhubposts_hub_id').on(t.federatedHubId),
  index('idx_fedhubposts_received_at').on(t.receivedAt),
]);

/** Known members of federated hubs — populated from post authors and followers collection */
export const federatedHubMembers = pgTable('federated_hub_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** FK to the federated hub */
  federatedHubId: uuid('federated_hub_id').notNull().references(() => federatedHubs.id, { onDelete: 'cascade' }),
  /** FK to the cached remote actor */
  remoteActorId: uuid('remote_actor_id').notNull().references(() => remoteActors.id, { onDelete: 'cascade' }),
  /** How this member was discovered: 'post' (posted in hub), 'followers' (from followers collection), 'mention' */
  discoveredVia: varchar('discovered_via', { length: 32 }).default('post').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_fed_hub_members_hub_actor').on(t.federatedHubId, t.remoteActorId),
  index('idx_fed_hub_members_hub').on(t.federatedHubId),
]);

/** Per-user likes on federated hub posts — tracks who liked what for unlike toggle */
export const federatedHubPostLikes = pgTable('federated_hub_post_likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull().references(() => federatedHubPosts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_fed_hub_post_likes_post_user').on(t.postId, t.userId),
]);

/** Replies to federated hub posts — both local user replies and remote replies received via AP.
 * Local replies have authorId set + remoteActorUri null.
 * Remote replies have authorId null + remoteActorUri/remoteActorName set. */
export const federatedHubPostReplies = pgTable('federated_hub_post_replies', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** FK to the federated hub post this reply is on */
  federatedHubPostId: uuid('federated_hub_post_id').notNull().references(() => federatedHubPosts.id, { onDelete: 'cascade' }),
  /** Local user who wrote the reply (null for remote/federated replies) */
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'cascade' }),
  /** Remote actor URI for federated replies (null for local replies) */
  remoteActorUri: text('remote_actor_uri'),
  /** Remote actor display name for federated replies */
  remoteActorName: text('remote_actor_name'),
  /** Self-referencing for threaded replies */
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (t) => [
  index('idx_fed_hub_post_replies_post').on(t.federatedHubPostId),
  index('idx_fed_hub_post_replies_author').on(t.authorId),
]);

/** Per-user join tracking for federated hubs.
 * When a user clicks "Join" on a federated hub, a record is created here.
 * The instance-level Follow is shared — this tracks which users are personally joined. */
export const userFederatedHubFollows = pgTable('user_federated_hub_follows', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  federatedHubId: uuid('federated_hub_id').notNull().references(() => federatedHubs.id, { onDelete: 'cascade' }),
  /** pending = waiting for instance-level Accept; joined = fully active */
  status: hubFollowStatusEnum('status').default('pending').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('uq_user_fed_hub_follow').on(t.userId, t.federatedHubId),
  index('idx_user_fed_hub_follow_user').on(t.userId),
  index('idx_user_fed_hub_follow_hub').on(t.federatedHubId),
]);

// --- Federated Hub Relations ---

export const federatedHubsRelations = relations(federatedHubs, ({ one, many }) => ({
  remoteActor: one(remoteActors, {
    fields: [federatedHubs.remoteActorId],
    references: [remoteActors.id],
  }),
  posts: many(federatedHubPosts),
}));

export const federatedHubMembersRelations = relations(federatedHubMembers, ({ one }) => ({
  federatedHub: one(federatedHubs, {
    fields: [federatedHubMembers.federatedHubId],
    references: [federatedHubs.id],
  }),
  remoteActor: one(remoteActors, {
    fields: [federatedHubMembers.remoteActorId],
    references: [remoteActors.id],
  }),
}));

export const federatedHubPostsRelations = relations(federatedHubPosts, ({ one, many }) => ({
  federatedHub: one(federatedHubs, {
    fields: [federatedHubPosts.federatedHubId],
    references: [federatedHubs.id],
  }),
  remoteActor: one(remoteActors, {
    fields: [federatedHubPosts.remoteActorId],
    references: [remoteActors.id],
  }),
  replies: many(federatedHubPostReplies),
}));

export const federatedHubPostRepliesRelations = relations(federatedHubPostReplies, ({ one, many }) => ({
  federatedHubPost: one(federatedHubPosts, {
    fields: [federatedHubPostReplies.federatedHubPostId],
    references: [federatedHubPosts.id],
  }),
  author: one(users, { fields: [federatedHubPostReplies.authorId], references: [users.id] }),
  parent: one(federatedHubPostReplies, {
    fields: [federatedHubPostReplies.parentId],
    references: [federatedHubPostReplies.id],
    relationName: 'fedReplyThread',
  }),
  children: many(federatedHubPostReplies, { relationName: 'fedReplyThread' }),
}));

export const userFederatedHubFollowsRelations = relations(userFederatedHubFollows, ({ one }) => ({
  user: one(users, { fields: [userFederatedHubFollows.userId], references: [users.id] }),
  federatedHub: one(federatedHubs, { fields: [userFederatedHubFollows.federatedHubId], references: [federatedHubs.id] }),
}));

// --- Instance Health (Circuit Breaker) ---

/** Tracks delivery health per remote instance for circuit breaker pattern */
export const instanceHealth = pgTable('instance_health', {
  /** Remote instance domain (e.g., 'deveco.io') */
  domain: varchar('domain', { length: 255 }).primaryKey(),
  /** Consecutive delivery failures to this instance */
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  /** Total successful deliveries (lifetime) */
  totalDelivered: integer('total_delivered').default(0).notNull(),
  /** Total failed deliveries (lifetime) */
  totalFailed: integer('total_failed').default(0).notNull(),
  /** When the circuit was opened (stop attempting delivery) — null = closed */
  circuitOpenUntil: timestamp('circuit_open_until', { withTimezone: true }),
  /** Last successful delivery */
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  /** Last failed delivery */
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Inferred Types ---
export type RemoteActorRow = typeof remoteActors.$inferSelect;
export type NewRemoteActorRow = typeof remoteActors.$inferInsert;
export type ActivityRow = typeof activities.$inferSelect;
export type NewActivityRow = typeof activities.$inferInsert;
export type FollowRelationshipRow = typeof followRelationships.$inferSelect;
export type NewFollowRelationshipRow = typeof followRelationships.$inferInsert;
export type ActorKeypairRow = typeof actorKeypairs.$inferSelect;
export type NewActorKeypairRow = typeof actorKeypairs.$inferInsert;
export type FederatedContentRow = typeof federatedContent.$inferSelect;
export type NewFederatedContentRow = typeof federatedContent.$inferInsert;
export type InstanceMirrorRow = typeof instanceMirrors.$inferSelect;
export type NewInstanceMirrorRow = typeof instanceMirrors.$inferInsert;
export type FederatedHubRow = typeof federatedHubs.$inferSelect;
export type NewFederatedHubRow = typeof federatedHubs.$inferInsert;
export type FederatedHubPostRow = typeof federatedHubPosts.$inferSelect;
export type NewFederatedHubPostRow = typeof federatedHubPosts.$inferInsert;
export type FederatedHubMemberRow = typeof federatedHubMembers.$inferSelect;
export type NewFederatedHubMemberRow = typeof federatedHubMembers.$inferInsert;
export type UserFederatedHubFollowRow = typeof userFederatedHubFollows.$inferSelect;
export type NewUserFederatedHubFollowRow = typeof userFederatedHubFollows.$inferInsert;
export type FederatedHubPostReplyRow = typeof federatedHubPostReplies.$inferSelect;
export type NewFederatedHubPostReplyRow = typeof federatedHubPostReplies.$inferInsert;
