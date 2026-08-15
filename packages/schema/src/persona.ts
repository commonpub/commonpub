import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  bigint,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './auth.js';
import { apiKeys } from './publicApi.js';

/**
 * Persona customization and audience analytics (migration 0046).
 *
 * Four tables, all new, nothing altered — see the plan's section 14.4: a purely
 * additive migration cannot break an existing reader.
 *
 * This module is a pure table catalog and deliberately imports NOTHING from
 * `@commonpub/persona` (plan section 14.7). The registry, the field types, the
 * purpose specs, the digest and every predicate live in that pure-TS package;
 * only the storage shape lives here. The dependency edge runs one way:
 * `@commonpub/persona` -> `@commonpub/schema` consumers, never back.
 *
 * Nothing here federates. Persona answers, free text, purpose consents and the
 * persona rollup are all instance-local (plan section 4.7).
 *
 * Migration 0047 appends a fifth table, `disclosure_events`, for the opt-in
 * member visibility directory (`docs/plans/member-visibility-directory.md`
 * section 3). It is likewise additive; the only column that migration adds to an
 * existing table is the nullable `api_keys.recipient_id`.
 *
 * Migration 0048 appends `user_statistics_objections` and `user_shared_links`
 * (plan revision 3, section R3.2). Also additive: it alters no existing table.
 */

// --- (1) Closed-vocabulary answers ---

/**
 * One row per selected value. A `multiselect` with three options checked is
 * three rows, so membership is exact row equality rather than a substring match
 * over a jsonb blob, and erasing one answer is one DELETE.
 *
 * `value` is the stable option KEY from the effective persona schema, not its
 * display label, so relabelling an option never rewrites user data.
 */
export const userPersonaAnswers = pgTable('user_persona_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sectionKey: varchar('section_key', { length: 40 }).notNull(),
  fieldKey: varchar('field_key', { length: 40 }).notNull(),
  value: varchar('value', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_persona_answer').on(t.userId, t.fieldKey, t.value),
  // THE aggregate index: `GROUP BY field_key, value` is the only analytics query shape.
  index('idx_persona_answer_field_value').on(t.fieldKey, t.value),
  // No separate (user_id) index: uq_persona_answer already leads with user_id.
]);

export const userPersonaAnswersRelations = relations(userPersonaAnswers, ({ one }) => ({
  user: one(users, { fields: [userPersonaAnswers.userId], references: [users.id] }),
}));

export type UserPersonaAnswerRow = typeof userPersonaAnswers.$inferSelect;
export type NewUserPersonaAnswerRow = typeof userPersonaAnswers.$inferInsert;

// --- (2) Free text ---

/**
 * Open-ended persona answers. The analytics module NEVER imports this table:
 * leakage of free text into an aggregate is then a missing import rather than a
 * forgotten rule, and a source sweep asserts the import is absent.
 *
 * `value` is `text`, not a capped varchar — the per-field `maxLength` is enforced
 * by Zod at write time, so the column never has to reject a legacy value.
 */
export const userPersonaText = pgTable('user_persona_text', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sectionKey: varchar('section_key', { length: 40 }).notNull(),
  fieldKey: varchar('field_key', { length: 40 }).notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_persona_text').on(t.userId, t.fieldKey),
]);

export const userPersonaTextRelations = relations(userPersonaText, ({ one }) => ({
  user: one(users, { fields: [userPersonaText.userId], references: [users.id] }),
}));

export type UserPersonaTextRow = typeof userPersonaText.$inferSelect;
export type NewUserPersonaTextRow = typeof userPersonaText.$inferInsert;

// --- (3) Purpose consent ---

/**
 * Bounded snapshot of exactly what the user was shown at the moment they acted.
 * Art 7(1) demonstrability, and the honest DSAR answer to "what did I agree to".
 *
 * Declared here, in the table module, so the jsonb column can be typed without a
 * reverse import from `@commonpub/persona` (the same reason `ContestRegistrationFields`
 * is declared in `contest.ts`). `@commonpub/persona` owns the Zod schema and its
 * `.max()` caps; this interface is the structural mirror the column stores.
 */
export interface PurposeScopeSnapshot {
  /** The purpose's display label as rendered. */
  purposeLabel: string;
  /** What happens with the toggle off, as rendered. */
  offSummary: string;
  /** What happens with the toggle on, as rendered. */
  onSummary: string;
  /** The named recipients disclosed at the moment of the act. */
  recipients: Array<{ id: string; name: string; relationship: string }>;
  /** Data class ids, not their descriptions. */
  dataClasses: string[];
  /** Aggregatable field KEYS, never their option lists. */
  aggregatableFieldKeys: string[];
  /** The policy version the copy was published under. */
  policyVersion: string;
}

/**
 * Append-only consent history WITH an O(1) current-state lookup.
 *
 * Storage is supersede-then-insert in one transaction: the prior current row
 * gets `superseded_at = now()`, the new row is inserted. The partial unique index
 * makes "current" a single indexed row while keeping the full history queryable.
 * Concurrent writes for one (user, purpose) can collide on that index; the caller
 * maps the unique violation to a retry or a 409, never a 500 (audit B16).
 */
export const userPurposeConsents = pgTable('user_purpose_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /**
   * A `ProcessingPurposeId`. Capped at 24 characters by Zod so `'sharing:' + id`
   * fits `user_consents.kind` without widening that live GDPR table.
   */
  purpose: varchar('purpose', { length: 24 }).notNull(),
  /**
   * 'granted' | 'revoked'. There is deliberately no 'denied' state: never asking
   * and declining are the same absence, and a stored "no" is a nag hook.
   */
  state: varchar('state', { length: 16 }).notNull(),
  /**
   * Digest of {policyVersion, dataClasses, recipientIds, aggregatableFieldKeys}
   * at the moment of the act. A grant whose digest differs from the current scope
   * authorises NOTHING; it is bound into the analytics JOIN, not checked in app
   * code, so a stale grant cannot be counted by a caller who forgot the check.
   */
  scopeDigest: varchar('scope_digest', { length: 16 }).notNull(),
  scopeSnapshot: jsonb('scope_snapshot').$type<PurposeScopeSnapshot>().notNull(),
  policyVersion: varchar('policy_version', { length: 32 }).notNull(),
  /** 'settings' | 'api'. */
  source: varchar('source', { length: 24 }).notNull(),
  actedAt: timestamp('acted_at', { withTimezone: true }).defaultNow().notNull(),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
}, (t) => [
  uniqueIndex('uq_purpose_current')
    .on(t.userId, t.purpose)
    .where(sql`${t.supersededAt} IS NULL`),
  index('idx_purpose_consent_lookup').on(t.purpose, t.state, t.scopeDigest),
]);

export const userPurposeConsentsRelations = relations(userPurposeConsents, ({ one }) => ({
  user: one(users, { fields: [userPurposeConsents.userId], references: [users.id] }),
}));

export type UserPurposeConsentRow = typeof userPurposeConsents.$inferSelect;
export type NewUserPurposeConsentRow = typeof userPurposeConsents.$inferInsert;

// --- (4) Persona rollup ---

/**
 * Persona's OWN daily rollup, deliberately not `metrics_daily` (plan section 14.4).
 *
 * An own table means the `/metrics/timeseries` back door never exists — that route
 * is guarded by `read:analytics` alone, which `read:*` satisfies, so a persona row
 * in the shared table would be reachable around every gate this feature adds. It
 * also means `runDailyRollup`'s body is never edited and `TIMESERIES_METRICS` never
 * learns a persona key.
 *
 * Suppression and quantisation are applied at WRITE, so the table itself never
 * stores a re-identifying count and the series cannot be differenced across days
 * to recover a small bucket. `suppressed` records that a bucket was withheld;
 * `final` marks a completed UTC day, which is the only thing the public endpoints
 * serve (polling a live count reveals the moment a bucket crosses the floor).
 *
 * `dimension` is NOT NULL with `''` meaning "no dimension", exactly as
 * `metrics_daily` does: NULLs are distinct in a Postgres unique index, which would
 * silently allow duplicate rows and break the idempotent upsert. It is varchar(120)
 * rather than 64 because a dimension can be a persona option value, capped at 120.
 */
export const personaMetricsDaily = pgTable('persona_metrics_daily', {
  id: uuid('id').defaultRandom().primaryKey(),
  day: date('day').notNull(),
  metric: varchar('metric', { length: 64 }).notNull(),
  dimension: varchar('dimension', { length: 120 }).notNull().default(''),
  value: bigint('value', { mode: 'number' }).notNull(),
  /** True when the underlying bucket fell below the k-anonymity floor and was withheld. */
  suppressed: boolean('suppressed').notNull().default(false),
  /** True once the UTC day is complete and the row has been recomputed for the last time. */
  final: boolean('final').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_persona_metrics_daily_day_metric_dim').on(t.day, t.metric, t.dimension),
  index('idx_persona_metrics_daily_metric_day').on(t.metric, t.day),
]);

export type PersonaMetricsDailyRow = typeof personaMetricsDaily.$inferSelect;
export type NewPersonaMetricsDailyRow = typeof personaMetricsDaily.$inferInsert;

// --- (5) Disclosure audit (migration 0047) ---

/**
 * One row per (recipient, member) disclosure through the opt-in member
 * visibility directory. Written synchronously with the response that disclosed
 * them, BEFORE the payload is returned: an unlogged disclosure must fail the
 * request rather than ship (directory plan D3, section 8).
 *
 * This table is the OPPOSITE of `persona_metrics_daily` above. That one exists
 * to make individuals unidentifiable — suppression below the k-anonymity floor,
 * quantisation, completed-day-only reads. This one identifies a named individual
 * to a named recipient, on purpose, with that person's consent. The two must
 * never share a code path: k-anonymity applied to the directory returns nothing,
 * and k-anonymity deleted from the aggregates to make the directory work breaks
 * every count silently (directory plan D1).
 *
 * `disclosure_events` is instance-local. Nothing here federates.
 */
export const disclosureEvents = pgTable('disclosure_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  /**
   * The named recipient from `dataSharing.recipients`. Deliberately NOT an FK:
   * recipients are config/DB data resolved at request time, not a table this
   * package owns. Validated against the effective recipient list by the caller.
   */
  recipientId: varchar('recipient_id', { length: 40 }).notNull(),
  /**
   * Which key made the request, so a revoked key's history stays attributable.
   * SET NULL rather than CASCADE: deleting a key must not erase the record that
   * it read somebody.
   */
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  /** The member disclosed. Cascades: erasure removes the member's disclosure rows. */
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /**
   * The `ProcessingPurposeId` that authorised the disclosure
   * ('recruiter_visibility' | 'sponsor_sharing'). Same varchar(24) cap as
   * `user_purpose_consents.purpose`, for the same reason.
   */
  purpose: varchar('purpose', { length: 24 }).notNull(),
  /**
   * The grant's digest at the moment of disclosure, so an audit can prove the
   * consent that authorised it was current and not a stale grant.
   */
  scopeDigest: varchar('scope_digest', { length: 16 }).notNull(),
  disclosedAt: timestamp('disclosed_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  // "Who has seen me", on /settings/privacy (directory plan D6).
  index('idx_disclosure_user_time').on(t.userId, t.disclosedAt),
  // Operator view: members disclosed per recipient per month, so bulk
  // extraction is visible without reading the table row by row.
  index('idx_disclosure_recipient_time').on(t.recipientId, t.disclosedAt),
  // Deliberately NOT unique on (recipient, user): a repeat pull is a repeat
  // disclosure and the count is the useful signal.
]);

export const disclosureEventsRelations = relations(disclosureEvents, ({ one }) => ({
  user: one(users, { fields: [disclosureEvents.userId], references: [users.id] }),
  apiKey: one(apiKeys, { fields: [disclosureEvents.apiKeyId], references: [apiKeys.id] }),
}));

export type DisclosureEventRow = typeof disclosureEvents.$inferSelect;
export type NewDisclosureEventRow = typeof disclosureEvents.$inferInsert;

// --- (6) Statistics objection (migration 0048) ---

/**
 * Row present means the member has objected to being counted in instance
 * statistics (GDPR Art 21). Absent means no objection, so aggregates include
 * them: the instance holds those anonymous numbers under legitimate interest,
 * not consent (plan revision 3, decision D4).
 *
 * The primary key on `user_id` IS the design. One objection per member, so a
 * double submit cannot create a second row, "has this member objected" is an
 * index probe, and withdrawing the objection is one DELETE. There is no `state`
 * column for the same reason `user_purpose_consents` has no 'denied': the
 * absence of a row is the whole of "not objected".
 *
 * Deliberately NOT a `user_purpose_consents` row with `state: 'objected'`
 * (decision D5). Consent and objection are different legal instruments with
 * different lifecycles; conflating them would make the consent history
 * unreadable and its scope digest meaningless — an objection has no scope to
 * digest, because there is nothing the member was asked to agree to.
 *
 * Instance-local. Nothing here federates.
 */
export const userStatisticsObjections = pgTable('user_statistics_objections', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  objectedAt: timestamp('objected_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userStatisticsObjectionsRelations = relations(userStatisticsObjections, ({ one }) => ({
  user: one(users, { fields: [userStatisticsObjections.userId], references: [users.id] }),
}));

export type UserStatisticsObjectionRow = typeof userStatisticsObjections.$inferSelect;
export type NewUserStatisticsObjectionRow = typeof userStatisticsObjections.$inferInsert;

// --- (7) Per-platform link sharing (migration 0048) ---

/**
 * Row present means the member shares this one profile link platform with the
 * named recipients. Absent means not shared (decision D6), so the default is off
 * BY CONSTRUCTION rather than by a `default(false)` somebody can later flip in a
 * migration and silently opt every existing member in.
 *
 * The composite primary key on (`user_id`, `platform`) makes a second row for
 * the same platform impossible, so "shared" is exact row equality rather than a
 * flag that can disagree with itself. Sharing is per platform, never all-or-
 * nothing: a member may hand a recruiter a portfolio without handing over a
 * personal account.
 *
 * `platform` is the stable platform KEY from the member's links, not a URL and
 * not a display label — the URL itself stays in the profile row, so revoking a
 * share never rewrites the link and relabelling a platform never rewrites this
 * table. varchar(32) matches the key cap; Zod enforces the vocabulary at write
 * time, so the column never has to reject a legacy value.
 *
 * Instance-local. Nothing here federates.
 */
export const userSharedLinks = pgTable('user_shared_links', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.platform] }),
  // No separate (user_id) index: the primary key already leads with user_id,
  // which is the only lookup shape ("which platforms does this member share").
]);

export const userSharedLinksRelations = relations(userSharedLinks, ({ one }) => ({
  user: one(users, { fields: [userSharedLinks.userId], references: [users.id] }),
}));

export type UserSharedLinkRow = typeof userSharedLinks.$inferSelect;
export type NewUserSharedLinkRow = typeof userSharedLinks.$inferInsert;
