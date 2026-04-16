import { pgTable, uuid, varchar, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { hubs } from './hub.js';
import { eventStatusEnum, eventTypeEnum, eventAttendeeStatusEnum } from './enums.js';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  coverImage: text('cover_image'),
  eventType: eventTypeEnum('event_type').default('in-person').notNull(),
  status: eventStatusEnum('status').default('draft').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  timezone: varchar('timezone', { length: 64 }).default('UTC').notNull(),
  location: varchar('location', { length: 500 }),
  locationUrl: varchar('location_url', { length: 500 }),
  onlineUrl: varchar('online_url', { length: 500 }),
  capacity: integer('capacity'),
  attendeeCount: integer('attendee_count').default(0).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  hubId: uuid('hub_id').references(() => hubs.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_events_created_by_id').on(t.createdById),
  index('idx_events_status').on(t.status),
  index('idx_events_start_date').on(t.startDate),
  index('idx_events_hub_id').on(t.hubId),
]);

export const eventAttendees = pgTable('event_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: eventAttendeeStatusEnum('status').default('registered').notNull(),
  registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_event_attendees_event_id').on(t.eventId),
  index('idx_event_attendees_user_id').on(t.userId),
]);

// --- Relations ---

export const eventsRelations = relations(events, ({ one, many }) => ({
  createdBy: one(users, { fields: [events.createdById], references: [users.id] }),
  hub: one(hubs, { fields: [events.hubId], references: [hubs.id] }),
  attendees: many(eventAttendees),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, { fields: [eventAttendees.eventId], references: [events.id] }),
  user: one(users, { fields: [eventAttendees.userId], references: [users.id] }),
}));

// --- Inferred Types ---
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type EventAttendeeRow = typeof eventAttendees.$inferSelect;
export type NewEventAttendeeRow = typeof eventAttendees.$inferInsert;
