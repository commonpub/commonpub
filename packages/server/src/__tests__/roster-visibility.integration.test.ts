/**
 * Hub rosters and event attendee lists honour profile visibility (session 262).
 *
 * Session 261 enforced `profileVisibility` on the profile, its follower lists,
 * people search and the actor, but a hub's member list and an event's attendee
 * list still named every member, including private and suspended ones. The
 * people who run a roster (hub moderators and stewards, the event's creator,
 * platform admins) still see everyone, because that is where they act on them.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { users, eventAttendees } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createHub } from '../hub/hub.js';
import { joinHub, listMembers, hubRoleSeesFullRoster } from '../hub/members.js';
import { createEvent, listEventAttendees } from '../events/events.js';

let db: DB;
const id: Record<string, string> = {};
let hubId = '';
let eventId = '';

beforeAll(async () => {
  db = await createTestDB();
  const stamp = Date.now();
  const people: Array<[string, 'public' | 'members' | 'private', 'active' | 'suspended']> = [
    ['owner', 'public', 'active'],
    ['pub', 'public', 'active'],
    ['mem', 'members', 'active'],
    ['priv', 'private', 'active'],
    ['susp', 'public', 'active'],
    ['viewer', 'public', 'active'],
  ];
  for (const [name, vis] of people) {
    const u = await createTestUser(db, { username: `${name}-${stamp}` });
    id[name] = u.id;
    await db.update(users).set({ profileVisibility: vis }).where(eq(users.id, u.id));
  }

  const hub = await createHub(db, id.owner!, { name: `Roster ${stamp}`, hubType: 'community' });
  hubId = hub.id;
  const event = await createEvent(db, {
    title: `Meetup ${stamp}`,
    slug: `meetup-${stamp}`,
    startDate: new Date(Date.now() + 86_400_000).toISOString(),
    endDate: new Date(Date.now() + 90_000_000).toISOString(),
    createdBy: id.owner!,
  });
  eventId = event.id;

  for (const name of ['pub', 'mem', 'priv', 'susp']) {
    await joinHub(db, id[name]!, hubId);
    await db.insert(eventAttendees).values({ eventId, userId: id[name]!, status: 'registered' });
  }
  // Suspended after joining, as a moderator would.
  await db.update(users).set({ status: 'suspended' }).where(eq(users.id, id.susp!));
}, 120_000);

afterAll(async () => {
  await closeTestDB(db);
});

const named = (ids: string[]): string[] => ids.map((u) => Object.keys(id).find((k) => id[k] === u)!).sort();

describe('hub roster', () => {
  const roster = async (opts: Parameters<typeof listMembers>[2]): Promise<{ names: string[]; total: number }> => {
    const r = await listMembers(db, hubId, opts);
    return { names: named(r.items.map((i) => i.userId)), total: r.total };
  };

  it('signed out: only public, active members, and the total counts the same people', async () => {
    expect(await roster({})).toEqual({ names: ['owner', 'pub'], total: 2 });
  });

  it('signed in: members-only profiles appear too, private and suspended ones do not', async () => {
    expect(await roster({ viewerId: id.viewer })).toEqual({ names: ['mem', 'owner', 'pub'], total: 3 });
  });

  it('a private member still sees themself', async () => {
    expect((await roster({ viewerId: id.priv })).names).toContain('priv');
  });

  it('the people who moderate the roster see everyone', async () => {
    expect(await roster({ viewerId: id.owner, seesEveryone: true })).toEqual({
      names: ['mem', 'owner', 'priv', 'pub', 'susp'],
      total: 5,
    });
  });

  it('which hub roles moderate the roster', () => {
    for (const role of ['owner', 'admin', 'moderator', 'steward']) expect(hubRoleSeesFullRoster(role), role).toBe(true);
    for (const role of ['member', '', null, undefined, 'something-new']) expect(hubRoleSeesFullRoster(role), String(role)).toBe(false);
  });
});

describe('event attendees', () => {
  const attendees = async (opts: Parameters<typeof listEventAttendees>[2]): Promise<{ names: string[]; total: number }> => {
    const r = await listEventAttendees(db, eventId, opts);
    return { names: named(r.items.map((i) => i.userId)), total: r.total };
  };

  it('signed out: only public, active attendees, counted the same way', async () => {
    expect(await attendees({})).toEqual({ names: ['pub'], total: 1 });
  });

  it('signed in: members-only profiles appear too, private and suspended ones do not', async () => {
    expect(await attendees({ viewerId: id.viewer })).toEqual({ names: ['mem', 'pub'], total: 2 });
  });

  it('the event creator sees everyone, and the status filter still applies', async () => {
    expect(await attendees({ viewerId: id.owner, seesEveryone: true })).toEqual({
      names: ['mem', 'priv', 'pub', 'susp'],
      total: 4,
    });
    expect((await attendees({ seesEveryone: true, status: 'waitlisted' })).total).toBe(0);
  });
});
