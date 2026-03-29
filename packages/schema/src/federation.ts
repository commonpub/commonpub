import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index, unique, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { activityDirectionEnum, activityStatusEnum, followRelationshipStatusEnum, mirrorStatusEnum, mirrorDirectionEnum } from './enums.js';

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
  /** Local engagement counters */
  localLikeCount: integer('local_like_count').default(0).notNull(),
  localCommentCount: integer('local_comment_count').default(0).notNull(),
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
  index('idx_fedcontent_mirror_id').on(t.mirrorId),
]);

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
