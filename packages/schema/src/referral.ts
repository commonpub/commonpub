import { pgTable, uuid, varchar, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { referralLinkStatusEnum, referralAttributionStatusEnum } from './enums.js';
import type { ReferralAction } from './validators/referral.js';

/**
 * Referral links (session 229). A user-owned, instance-wide growth link: a short
 * `code` (auto-generated or custom) that attributes new signups to the owner and
 * runs a bounded list of onboarding `actions` (auto-join a hub, land on a path).
 * Distinct from hub invites (`hub_invites`) — those are hub-scoped moderation
 * tooling. Instance-local; never federates. See docs/plans/referral-links.md.
 *
 * `code` is stored lowercased (codes are case-insensitive) with a plain UNIQUE
 * index, so custom and generated codes share one namespace without a functional
 * index. `click_count`/`signup_count` are denormalized counters so stats never
 * need a per-request COUNT(*).
 */
export const referralLinks = pgTable('referral_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 40 }).notNull(),
  label: varchar('label', { length: 80 }),
  /** Bounded, Zod-validated onboarding actions (join_hub | redirect). */
  actions: jsonb('actions').$type<ReferralAction[]>().notNull().default([]),
  /** Optional same-origin landing path override for the post-signup redirect. */
  landingPath: varchar('landing_path', { length: 512 }),
  status: referralLinkStatusEnum('status').notNull().default('active'),
  attributionWindowDays: integer('attribution_window_days').notNull().default(60),
  clickCount: integer('click_count').notNull().default(0),
  signupCount: integer('signup_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
}, (t) => [
  uniqueIndex('uq_referral_links_code').on(t.code),
  index('idx_referral_links_owner').on(t.ownerId, t.createdAt.desc(), t.id.desc()),
]);

export const referralLinksRelations = relations(referralLinks, ({ one, many }) => ({
  owner: one(users, { fields: [referralLinks.ownerId], references: [users.id] }),
  attributions: many(referralAttributions),
}));

export type ReferralLinkRow = typeof referralLinks.$inferSelect;
export type NewReferralLinkRow = typeof referralLinks.$inferInsert;

/**
 * One row per attributed signup. `UNIQUE(referred_user_id)` enforces first-touch
 * attribution and makes the claim idempotent + race-proof (ON CONFLICT DO
 * NOTHING). `owner_id` is denormalized from the link (owner is immutable) so the
 * "people I referred" view needs no join. `status` is `confirmed` in v1; the
 * other values are reserved for a future verify-gate (plan §10).
 */
export const referralAttributions = pgTable('referral_attributions', {
  id: uuid('id').defaultRandom().primaryKey(),
  referralLinkId: uuid('referral_link_id').notNull().references(() => referralLinks.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  referredUserId: uuid('referred_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: referralAttributionStatusEnum('status').notNull().default('pending'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_referral_attr_user').on(t.referredUserId),
  index('idx_referral_attr_owner').on(t.ownerId, t.createdAt.desc(), t.id.desc()),
  index('idx_referral_attr_link').on(t.referralLinkId),
]);

export const referralAttributionsRelations = relations(referralAttributions, ({ one }) => ({
  link: one(referralLinks, { fields: [referralAttributions.referralLinkId], references: [referralLinks.id] }),
  owner: one(users, { fields: [referralAttributions.ownerId], references: [users.id] }),
  referredUser: one(users, { fields: [referralAttributions.referredUserId], references: [users.id] }),
}));

export type ReferralAttributionRow = typeof referralAttributions.$inferSelect;
export type NewReferralAttributionRow = typeof referralAttributions.$inferInsert;
