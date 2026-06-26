import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';

/**
 * Durable email outbox (session 227, email Phase 1). Every non-transactional email
 * (notification, digest, broadcast) is ENQUEUED here instead of sent inline; a
 * throttled batch worker drains it (claim → Resend batch endpoint → retry/backoff).
 * This replaces the previous fire-one-fetch-per-recipient path that had no queue,
 * batching, throttle, or retry and silently dropped mail past Resend's 5 req/s cap.
 *
 * Transactional auth mail (verify/reset) intentionally does NOT use the outbox — it
 * is low-volume and latency-sensitive (the user is waiting), so it sends directly.
 *
 * `status`: pending → sending (claimed) → sent | failed (dead-letter after maxAttempts).
 * Claim is `FOR UPDATE SKIP LOCKED` with a lock expiry so a crashed worker's rows
 * are reclaimable. `user_id` is nullable + cascade so a deleted user's queued mail
 * is cleaned up.
 */
export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  toEmail: varchar('to_email', { length: 255 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text'),
  /** Extra SMTP/Resend headers, e.g. List-Unsubscribe (RFC 8058). */
  headers: jsonb('headers').$type<Record<string, string>>(),
  // 'notification' | 'digest' | 'broadcast'
  category: varchar('category', { length: 32 }).notNull(),
  // 'pending' | 'sending' | 'sent' | 'failed'
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).defaultNow().notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  lockExpiresAt: timestamp('lock_expires_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('idx_email_outbox_claim').on(t.status, t.scheduledAt)]);

export const emailOutboxRelations = relations(emailOutbox, ({ one }) => ({
  user: one(users, { fields: [emailOutbox.userId], references: [users.id] }),
}));

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type NewEmailOutboxRow = typeof emailOutbox.$inferInsert;

/**
 * Admin broadcast audit log (email Phase 3). One row per operator-sent broadcast,
 * recording who sent what to whom (the audience spec) and how many recipients were
 * enqueued. The emails themselves are delivered via `email_outbox`.
 */
export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').defaultRandom().primaryKey(),
  subject: text('subject').notNull(),
  bodyText: text('body_text').notNull(),
  ctaLabel: text('cta_label'),
  ctaUrl: text('cta_url'),
  /** `'all'` | `{ role }` | `{ userIds }` — the resolved audience spec. */
  audience: jsonb('audience').$type<unknown>().notNull(),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentById: uuid('sent_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('idx_broadcasts_created_at').on(t.createdAt)]);

export const broadcastsRelations = relations(broadcasts, ({ one }) => ({
  sentBy: one(users, { fields: [broadcasts.sentById], references: [users.id] }),
}));

export type BroadcastRow = typeof broadcasts.$inferSelect;
export type NewBroadcastRow = typeof broadcasts.$inferInsert;
