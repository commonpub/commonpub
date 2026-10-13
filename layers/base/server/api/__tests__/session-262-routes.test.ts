/**
 * Session 262 route behaviour, run through the shipped handlers on PGlite with the
 * real `requireAuth` / `getOptionalUser` / `hasPermission` / `requireHubReadAccess`.
 *
 * - Account deletion refuses while the account owns a contest (it used to cascade
 *   the contest and every entry away), says why, and federates nothing first.
 * - Admin deletion refuses the same way.
 * - Hub rosters and event attendee lists leave out members whose profile the
 *   viewer may not see; the people who run them still see everyone.
 * - An unknown attendee `?status=` is a 400, not a 500 (audit N5).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { users, eventAttendees } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../packages/server/src/types';
import { createContest } from '../../../../../packages/server/src/contest/index';
import { createHub } from '../../../../../packages/server/src/hub/hub';
import { joinHub } from '../../../../../packages/server/src/hub/members';
import { createEvent, updateEvent } from '../../../../../packages/server/src/events/events';
import { harness, installNitroStubs, makeEvent, expectStatus } from '../../../test-helpers/nitroStubs';

type Handler = (event: ReturnType<typeof makeEvent>) => Promise<unknown>;

let db: DB;
const ids: Record<string, string> = {};
const names: Record<string, string> = {};
const h: Record<string, Handler> = {};
let hubSlug = '';
let eventSlug = '';
const purged: string[] = [];

function as(who: string | null, init: { params?: Record<string, string>; query?: Record<string, string>; role?: string } = {}) {
  return makeEvent({
    method: 'GET',
    params: init.params ?? {},
    query: init.query ?? {},
    context: who ? { auth: { user: { id: ids[who], username: names[who], role: init.role ?? 'member' } } } : {},
  });
}

beforeAll(async () => {
  await installNitroStubs();
  const g = globalThis as unknown as Record<string, unknown>;
  const auth = await import('../../utils/auth');
  g.requireAuth = auth.requireAuth;
  g.getOptionalUser = auth.getOptionalUser;
  // The harness's requirePermission calls requireAuth() with no event, which only
  // its own stub accepts; with the real requireAuth installed, pass the event on.
  g.requirePermission = (event: ReturnType<typeof makeEvent>, needed: string) => {
    const user = auth.requireAuth(event as never);
    if (!harness.permissions.includes(needed)) {
      throw (g.createError as (o: object) => Error)({ statusCode: 403, statusMessage: `Missing permission: ${needed}` });
    }
    return user;
  };
  g.hasPermission = (await import('../../utils/requirePermission')).hasPermission;
  g.requireHubReadAccess = (await import('../../utils/hubAccess')).requireHubReadAccess;
  g.collectUserPrivateFileKeys = async (_db: unknown, userId: string) => [userId];
  g.deleteUserPrivateFileBytes = async (keys: string[]) => { purged.push(...keys); };
  g.deleteCookie = (): void => {};
  g.setCookie = (): void => {};
  g.useRuntimeConfig = () => ({ public: { siteUrl: 'https://test.example' } });
  harness.config = { instance: { domain: 'test.example', name: 'Test' } };
  harness.features = { ...harness.features, events: true, federation: false, federateHubs: false };

  db = await createTestDB();
  harness.db = db;
  const stamp = Date.now();
  for (const [key, vis] of [['organizer', 'public'], ['pub', 'public'], ['priv', 'private'], ['viewer', 'public'], ['leaver', 'public']] as const) {
    const u = await createTestUser(db, { username: `${key}${stamp}` });
    await db.update(users).set({ profileVisibility: vis }).where(eq(users.id, u.id));
    ids[key] = u.id;
    names[key] = u.username;
  }

  await createContest(db, {
    title: `Live ${stamp}`,
    slug: `live-${stamp}`,
    description: 'x',
    startDate: new Date(Date.now() - 86_400_000).toISOString(),
    endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    createdBy: ids.organizer!,
  });

  const hub = await createHub(db, ids.organizer!, { name: `Roster ${stamp}`, hubType: 'community' });
  hubSlug = hub.slug;
  const ev = await createEvent(db, {
    title: `Meetup ${stamp}`,
    slug: `meetup-${stamp}`,
    startDate: new Date(Date.now() + 86_400_000).toISOString(),
    endDate: new Date(Date.now() + 90_000_000).toISOString(),
    createdBy: ids.organizer!,
  });
  await updateEvent(db, ev.slug, ids.organizer!, { status: 'published' });
  eventSlug = ev.slug;
  for (const k of ['pub', 'priv']) {
    await joinHub(db, ids[k]!, hub.id);
    await db.insert(eventAttendees).values({ eventId: ev.id, userId: ids[k]!, status: 'registered' });
  }

  h.selfDelete = (await import('../auth/delete-user.post')).default as unknown as Handler;
  h.adminDelete = (await import('../admin/users/[id].delete')).default as unknown as Handler;
  h.members = (await import('../hubs/[slug]/members.get')).default as unknown as Handler;
  h.attendees = (await import('../events/[slug]/attendees.get')).default as unknown as Handler;
}, 120_000);

afterAll(async () => {
  await closeTestDB(db);
  vi.restoreAllMocks();
});

const exists = async (key: string): Promise<boolean> =>
  (await db.select({ id: users.id }).from(users).where(eq(users.id, ids[key]!))).length > 0;

describe('POST /api/auth/delete-user', () => {
  it('an organizer who still owns a contest and a hub is refused with a 409 that says what to do', async () => {
    const err = await expectStatus(h.selfDelete!, as('organizer'));
    expect(err?.statusCode).toBe(409);
    expect(err?.statusMessage).toContain('1 contest');
    expect(err?.statusMessage).toContain('1 hub');
    expect(err?.statusMessage).not.toMatch(/[–—]/);
    expect(await exists('organizer')).toBe(true);
    expect(purged).not.toContain(ids.organizer);
  });

  it('a member who owns nothing shared is deleted and their private files purged', async () => {
    expect(await h.selfDelete!(as('leaver'))).toEqual({ success: true });
    expect(await exists('leaver')).toBe(false);
    expect(purged).toContain(ids.leaver);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('refuses an account that owns a contest, and leaves it in place', async () => {
    harness.permissions = ['users.delete'];
    const err = await expectStatus(h.adminDelete!, as('viewer', { params: { id: ids.organizer! }, role: 'admin' }));
    expect(err?.statusCode).toBe(409);
    expect(err?.statusMessage).toContain('1 contest');
    expect(await exists('organizer')).toBe(true);
  });
});

describe('GET /api/hubs/:slug/members', () => {
  const listed = (res: unknown): string[] =>
    (res as { items: Array<{ userId: string }> }).items.map((i) => Object.keys(ids).find((k) => ids[k] === i.userId)!).sort();

  it('the public sees public members only', async () => {
    expect(listed(await h.members!(as(null, { params: { slug: hubSlug } })))).toEqual(['organizer', 'pub']);
  });

  it('the hub owner sees everyone, including the private member', async () => {
    expect(listed(await h.members!(as('organizer', { params: { slug: hubSlug } })))).toEqual(['organizer', 'priv', 'pub']);
  });

  it('a platform admin sees everyone', async () => {
    expect(listed(await h.members!(as('viewer', { params: { slug: hubSlug }, role: 'admin' })))).toEqual(['organizer', 'priv', 'pub']);
  });
});

describe('GET /api/events/:slug/attendees', () => {
  const listed = (res: unknown): string[] =>
    (res as { items: Array<{ userId: string }> }).items.map((i) => Object.keys(ids).find((k) => ids[k] === i.userId)!).sort();

  it('the public sees public attendees only, and the total agrees', async () => {
    const res = (await h.attendees!(as(null, { params: { slug: eventSlug } }))) as { total: number };
    expect(listed(res)).toEqual(['pub']);
    expect(res.total).toBe(1);
  });

  it("the event's creator sees every attendee", async () => {
    expect(listed(await h.attendees!(as('organizer', { params: { slug: eventSlug } })))).toEqual(['priv', 'pub']);
  });

  it('an unknown status is a 400, not a 500', async () => {
    const err = await expectStatus(h.attendees!, as(null, { params: { slug: eventSlug }, query: { status: 'bogus' } }));
    expect(err?.statusCode).toBe(400);
  });
});
