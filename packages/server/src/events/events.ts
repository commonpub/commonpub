import { eq, and, desc, asc, gte, sql, or } from 'drizzle-orm';
import { events, eventAttendees, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { normalizePagination, countRows } from '../query.js';

export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled';
export type EventType = 'in-person' | 'online' | 'hybrid';
export type AttendeeStatus = 'registered' | 'waitlisted' | 'cancelled' | 'attended';

export interface EventListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  eventType: EventType;
  status: EventStatus;
  startDate: Date;
  endDate: Date;
  timezone: string;
  location: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  attendeeCount: number;
  isFeatured: boolean;
  hubId: string | null;
  createdAt: Date;
}

export interface EventDetail extends EventListItem {
  locationUrl: string | null;
  createdById: string;
  createdByName: string;
  createdByUsername: string;
  createdByAvatar: string | null;
  updatedAt: Date;
}

export interface EventFilters {
  status?: EventStatus;
  hubId?: string;
  upcoming?: boolean;
  featured?: boolean;
  /** Show events the user is attending or created */
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateEventInput {
  title: string;
  slug: string;
  description?: string;
  coverImage?: string;
  eventType?: EventType;
  startDate: string;
  endDate: string;
  timezone?: string;
  location?: string;
  locationUrl?: string;
  onlineUrl?: string;
  capacity?: number;
  hubId?: string;
  createdBy: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  coverImage?: string | null;
  eventType?: EventType;
  status?: EventStatus;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  location?: string;
  locationUrl?: string;
  onlineUrl?: string;
  capacity?: number;
  isFeatured?: boolean;
}

export interface AttendeeItem {
  id: string;
  eventId: string;
  userId: string;
  status: AttendeeStatus;
  registeredAt: Date;
  userName: string;
  userUsername: string;
  userAvatar: string | null;
}

export async function listEvents(
  db: DB,
  filters: EventFilters = {},
): Promise<{ items: EventListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(events.status, filters.status));
  }
  if (filters.hubId) {
    conditions.push(eq(events.hubId, filters.hubId));
  }
  if (filters.upcoming) {
    conditions.push(gte(events.startDate, new Date()));
  }
  if (filters.featured) {
    conditions.push(eq(events.isFeatured, true));
  }

  // "My Events" — events the user created OR is attending (non-cancelled)
  if (filters.userId) {
    conditions.push(
      or(
        eq(events.createdById, filters.userId),
        sql`${events.id} IN (SELECT ${eventAttendees.eventId} FROM ${eventAttendees} WHERE ${eventAttendees.userId} = ${filters.userId} AND ${eventAttendees.status} != 'cancelled')`,
      )!,
    );
  }

  // Only show published/active events in public listing (unless status filter or userId is explicit)
  if (!filters.status && !filters.userId) {
    conditions.push(
      sql`${events.status} IN ('published', 'active')`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const { limit, offset } = normalizePagination(filters);

  const [rows, total] = await Promise.all([
    db.select().from(events).where(where).orderBy(asc(events.startDate)).limit(limit).offset(offset),
    countRows(db, events, where),
  ]);

  return {
    items: rows.map(mapEventListItem),
    total,
  };
}

export async function getEventBySlug(
  db: DB,
  slug: string,
): Promise<EventDetail | null> {
  const rows = await db
    .select({
      event: events,
      author: {
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(events)
    .innerJoin(users, eq(events.createdById, users.id))
    .where(eq(events.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const { event, author } = rows[0]!;
  return {
    ...mapEventListItem(event),
    locationUrl: event.locationUrl,
    createdById: event.createdById,
    createdByName: author.displayName ?? author.username,
    createdByUsername: author.username,
    createdByAvatar: author.avatarUrl,
    updatedAt: event.updatedAt,
  };
}

export async function createEvent(
  db: DB,
  input: CreateEventInput,
): Promise<EventDetail> {
  const [row] = await db
    .insert(events)
    .values({
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      coverImage: input.coverImage ?? null,
      status: 'published',
      eventType: input.eventType ?? 'in-person',
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      timezone: input.timezone ?? 'UTC',
      location: input.location ?? null,
      locationUrl: input.locationUrl ?? null,
      onlineUrl: input.onlineUrl ?? null,
      capacity: input.capacity ?? null,
      hubId: input.hubId ?? null,
      createdById: input.createdBy,
    })
    .returning();

  return (await getEventBySlug(db, row!.slug))!;
}

export async function updateEvent(
  db: DB,
  slug: string,
  userId: string,
  data: UpdateEventInput,
  isAdmin = false,
): Promise<EventDetail | null> {
  const existing = await db
    .select({ createdById: events.createdById })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  if (existing.length === 0) return null;
  if (!isAdmin && existing[0]!.createdById !== userId) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
  if (data.eventType !== undefined) updates.eventType = data.eventType;
  if (data.status !== undefined) updates.status = data.status;
  if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);
  if (data.timezone !== undefined) updates.timezone = data.timezone;
  if (data.location !== undefined) updates.location = data.location;
  if (data.locationUrl !== undefined) updates.locationUrl = data.locationUrl;
  if (data.onlineUrl !== undefined) updates.onlineUrl = data.onlineUrl;
  if (data.capacity !== undefined) updates.capacity = data.capacity;
  if (data.isFeatured !== undefined) updates.isFeatured = data.isFeatured;

  await db.update(events).set(updates).where(eq(events.slug, slug));
  return getEventBySlug(db, slug);
}

export async function deleteEvent(
  db: DB,
  eventId: string,
  userId: string,
  isAdmin = false,
): Promise<boolean> {
  const existing = await db
    .select({ createdById: events.createdById })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (existing.length === 0) return false;
  if (!isAdmin && existing[0]!.createdById !== userId) return false;

  await db.delete(events).where(eq(events.id, eventId));
  return true;
}

// --- Attendees ---

export async function listEventAttendees(
  db: DB,
  eventId: string,
  opts: { limit?: number; offset?: number; status?: AttendeeStatus } = {},
): Promise<{ items: AttendeeItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);
  const conditions = [eq(eventAttendees.eventId, eventId)];
  if (opts.status) {
    conditions.push(eq(eventAttendees.status, opts.status));
  }
  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db
      .select({
        attendee: eventAttendees,
        user: {
          displayName: users.displayName,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(eventAttendees)
      .innerJoin(users, eq(eventAttendees.userId, users.id))
      .where(where)
      .orderBy(desc(eventAttendees.registeredAt))
      .limit(limit)
      .offset(offset),
    countRows(db, eventAttendees, where),
  ]);

  return {
    items: rows.map(({ attendee, user }) => ({
      id: attendee.id,
      eventId: attendee.eventId,
      userId: attendee.userId,
      status: attendee.status,
      registeredAt: attendee.registeredAt,
      userName: user.displayName ?? user.username,
      userUsername: user.username,
      userAvatar: user.avatarUrl,
    })),
    total,
  };
}

export async function rsvpEvent(
  db: DB,
  eventId: string,
  userId: string,
): Promise<{ success: boolean; status: AttendeeStatus; error?: string }> {
  return db.transaction(async (tx) => {
    // Validate event exists and is published/active
    const [event] = await tx
      .select({ status: events.status, capacity: events.capacity, attendeeCount: events.attendeeCount })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) return { success: false, status: 'cancelled' as AttendeeStatus, error: 'Event not found' };
    if (event.status !== 'published' && event.status !== 'active') {
      return { success: false, status: 'cancelled' as AttendeeStatus, error: 'Event is not accepting registrations' };
    }

    // Check if already registered (fast path — skips the insert attempt
    // for repeat RSVP clicks).
    const [existing] = await tx
      .select({ id: eventAttendees.id, status: eventAttendees.status })
      .from(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)))
      .limit(1);

    if (existing) {
      return { success: false, status: existing.status, error: 'Already registered' };
    }

    // Determine status based on capacity (atomic within transaction)
    const attendeeStatus: AttendeeStatus =
      event.capacity && event.attendeeCount >= event.capacity ? 'waitlisted' : 'registered';

    // `onConflictDoNothing` handles the double-click race: the new UNIQUE
    // (event_id, user_id) constraint would otherwise surface as a 500. If
    // a parallel request won the race, `returning()` is empty and we
    // fall back to the existing row without double-incrementing
    // attendee_count.
    const inserted = await tx
      .insert(eventAttendees)
      .values({ eventId, userId, status: attendeeStatus })
      .onConflictDoNothing({ target: [eventAttendees.eventId, eventAttendees.userId] })
      .returning({ id: eventAttendees.id });

    if (inserted.length === 0) {
      const [current] = await tx
        .select({ status: eventAttendees.status })
        .from(eventAttendees)
        .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)))
        .limit(1);
      return { success: false, status: current?.status ?? 'registered', error: 'Already registered' };
    }

    if (attendeeStatus === 'registered') {
      await tx
        .update(events)
        .set({ attendeeCount: sql`${events.attendeeCount} + 1` })
        .where(eq(events.id, eventId));
    }

    return { success: true, status: attendeeStatus };
  });
}

export async function cancelRsvp(
  db: DB,
  eventId: string,
  userId: string,
): Promise<{ cancelled: boolean; promoted?: string }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: eventAttendees.id, status: eventAttendees.status })
      .from(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)))
      .limit(1);

    if (!existing) return { cancelled: false };

    await tx.delete(eventAttendees).where(eq(eventAttendees.id, existing.id));

    if (existing.status === 'registered') {
      await tx
        .update(events)
        .set({ attendeeCount: sql`GREATEST(${events.attendeeCount} - 1, 0)` })
        .where(eq(events.id, eventId));

      // Auto-promote the oldest waitlisted attendee (FIFO)
      const [nextWaitlisted] = await tx
        .select({ id: eventAttendees.id, userId: eventAttendees.userId })
        .from(eventAttendees)
        .where(and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.status, 'waitlisted'),
        ))
        .orderBy(asc(eventAttendees.registeredAt))
        .limit(1);

      if (nextWaitlisted) {
        await tx
          .update(eventAttendees)
          .set({ status: 'registered' })
          .where(eq(eventAttendees.id, nextWaitlisted.id));

        // Re-increment count for the promoted attendee
        await tx
          .update(events)
          .set({ attendeeCount: sql`${events.attendeeCount} + 1` })
          .where(eq(events.id, eventId));

        return { cancelled: true, promoted: nextWaitlisted.userId };
      }
    }

    return { cancelled: true };
  });
}

export async function getUserRsvpStatus(
  db: DB,
  eventId: string,
  userId: string,
): Promise<AttendeeStatus | null> {
  const [row] = await db
    .select({ status: eventAttendees.status })
    .from(eventAttendees)
    .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)))
    .limit(1);

  return row?.status ?? null;
}

// --- Helpers ---

function mapEventListItem(row: typeof events.$inferSelect): EventListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImage: row.coverImage,
    eventType: row.eventType,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    timezone: row.timezone,
    location: row.location,
    onlineUrl: row.onlineUrl,
    capacity: row.capacity,
    attendeeCount: row.attendeeCount,
    isFeatured: row.isFeatured,
    hubId: row.hubId,
    createdAt: row.createdAt,
  };
}
