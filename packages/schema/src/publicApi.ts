import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';

/**
 * Public API keys. Admin-provisioned, scoped, read-only (v1).
 *
 * Only a SHA-256 hash of the token is stored; the raw token is shown to the
 * admin exactly once at creation time. `prefix` is the first 16 chars of the
 * raw token (e.g. `cpub_live_ak_xF`) and is indexed for O(1) lookup — after
 * lookup we compare the hash with timingSafeEqual.
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  prefix: varchar('prefix', { length: 32 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  description: text('description'),
  allowedOrigins: jsonb('allowed_origins').$type<string[]>(),
  rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(60),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_api_keys_prefix').on(t.prefix),
  index('idx_api_keys_active').on(t.revokedAt),
]);

/**
 * Per-request usage log for analytics and abuse detection.
 * Fire-and-forget insert from middleware on response finish; keep indexes
 * narrow and plan a retention policy (cron-drop rows older than 30–90 days).
 */
export const apiKeyUsage = pgTable('api_key_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  keyId: uuid('key_id')
    .notNull()
    .references(() => apiKeys.id, { onDelete: 'cascade' }),
  endpoint: varchar('endpoint', { length: 200 }).notNull(),
  method: varchar('method', { length: 10 }).notNull().default('GET'),
  statusCode: integer('status_code').notNull(),
  latencyMs: integer('latency_ms'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_api_key_usage_key_time').on(t.keyId, t.timestamp),
]);

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  createdByUser: one(users, { fields: [apiKeys.createdBy], references: [users.id], relationName: 'apiKeysCreatedBy' }),
  revokedByUser: one(users, { fields: [apiKeys.revokedBy], references: [users.id], relationName: 'apiKeysRevokedBy' }),
  usage: many(apiKeyUsage),
}));

export const apiKeyUsageRelations = relations(apiKeyUsage, ({ one }) => ({
  key: one(apiKeys, { fields: [apiKeyUsage.keyId], references: [apiKeys.id] }),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsageRow = typeof apiKeyUsage.$inferSelect;
