import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { activityDirectionEnum, activityStatusEnum, followRelationshipStatusEnum } from './enums.js';

/** Cache of resolved remote ActivityPub actors */
export const remoteActors = pgTable('remote_actors', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUri: text('actor_uri').notNull().unique(),
  inbox: text('inbox').notNull(),
  outbox: text('outbox'),
  publicKeyPem: text('public_key_pem'),
  preferredUsername: varchar('preferred_username', { length: 64 }),
  displayName: varchar('display_name', { length: 128 }),
  avatarUrl: text('avatar_url'),
  instanceDomain: varchar('instance_domain', { length: 255 }).notNull(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Federation-aware follow relationships (separate from local follows) */
export const followRelationships = pgTable('follow_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  followerActorUri: text('follower_actor_uri').notNull(),
  followingActorUri: text('following_actor_uri').notNull(),
  status: followRelationshipStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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

// --- Relations ---

export const actorKeypairsRelations = relations(actorKeypairs, ({ one }) => ({
  user: one(users, { fields: [actorKeypairs.userId], references: [users.id] }),
}));

// --- Inferred Types ---
export type RemoteActorRow = typeof remoteActors.$inferSelect;
export type NewRemoteActorRow = typeof remoteActors.$inferInsert;
export type ActivityRow = typeof activities.$inferSelect;
export type NewActivityRow = typeof activities.$inferInsert;
export type FollowRelationshipRow = typeof followRelationships.$inferSelect;
export type NewFollowRelationshipRow = typeof followRelationships.$inferInsert;
export type ActorKeypairRow = typeof actorKeypairs.$inferSelect;
export type NewActorKeypairRow = typeof actorKeypairs.$inferInsert;
