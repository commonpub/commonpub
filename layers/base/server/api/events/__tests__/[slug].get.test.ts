/**
 * Draft-gating proving test for `GET /api/events/:slug` (audit session 204).
 *
 * Draft/cancelled/completed events must be visible only to the creator or an
 * admin; everyone else gets 404 (not 403, so the slug's existence isn't leaked).
 *
 * Drives the REAL route handler (which calls the REAL `getEventBySlug` against a
 * PGlite DB) with the Nitro auto-imports stubbed: requireFeature/useDB/
 * getRouterParam/getOptionalUser/createError. `getOptionalUser` reads a per-test
 * `currentUser`, so the handler's actual canView branch is exercised.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { H3Event } from 'h3';
import {
  createTestDB,
  createTestUser,
} from '../../../../../../packages/server/src/__tests__/helpers/testdb';
import { events } from '@commonpub/schema';
import type { DB } from '../../../../../../packages/server/src/types';

interface HttpError extends Error {
  statusCode: number;
}
type Viewer = { id: string; role: string } | null;

let db: DB;
let creatorId: string;
let reqSlug: string;
let currentUser: Viewer;

{
  const g = globalThis as Record<string, unknown>;
  g.defineEventHandler = (fn: unknown): unknown => fn;
  g.createError = (opts: { statusCode: number; statusMessage: string }): HttpError => {
    const e = new Error(opts.statusMessage) as HttpError;
    e.statusCode = opts.statusCode;
    return e;
  };
  g.requireFeature = (): void => {}; // events feature assumed enabled
  g.useDB = (): DB => db;
  g.getRouterParam = (_event: H3Event, _name: string): string => reqSlug;
  g.getOptionalUser = (_event: H3Event): Viewer => currentUser;
}

const handlerMod = await import('../[slug].get');
const handler = handlerMod.default as (event: H3Event) => Promise<unknown>;
const fakeEvent = {} as H3Event;

function statusOf(p: Promise<unknown>): Promise<number | 'no-throw'> {
  return p.then(
    () => 'no-throw' as const,
    (e: HttpError) => e.statusCode,
  );
}

beforeAll(async () => {
  db = await createTestDB();
  const creator = await createTestUser(db, { username: 'host' });
  creatorId = creator.id;
  const now = new Date();
  await db.insert(events).values([
    {
      title: 'Secret Draft',
      slug: 'secret-draft',
      status: 'draft',
      startDate: now,
      endDate: now,
      createdById: creator.id,
    },
    {
      title: 'Live Meetup',
      slug: 'live-meetup',
      status: 'published',
      startDate: now,
      endDate: now,
      createdById: creator.id,
    },
  ] as never);
}, 30_000); // PGlite pushSchema is heavy; generous setup timeout under parallel load

describe('events/[slug].get — draft gating', () => {
  it('draft event + anonymous viewer → 404 (existence not leaked)', async () => {
    reqSlug = 'secret-draft';
    currentUser = null;
    expect(await statusOf(handler(fakeEvent))).toBe(404);
  });

  it('draft event + unrelated non-admin viewer → 404', async () => {
    reqSlug = 'secret-draft';
    currentUser = { id: 'random-user', role: 'member' };
    expect(await statusOf(handler(fakeEvent))).toBe(404);
  });

  it('draft event + the creator → 200 (returns the event)', async () => {
    reqSlug = 'secret-draft';
    currentUser = { id: creatorId, role: 'member' };
    const result = (await handler(fakeEvent)) as { slug: string; status: string };
    expect(result.slug).toBe('secret-draft');
    expect(result.status).toBe('draft');
  });

  it('draft event + an admin → 200', async () => {
    reqSlug = 'secret-draft';
    currentUser = { id: 'admin-user', role: 'admin' };
    const result = (await handler(fakeEvent)) as { slug: string };
    expect(result.slug).toBe('secret-draft');
  });

  it('published event + anonymous viewer → 200 (publicly viewable)', async () => {
    reqSlug = 'live-meetup';
    currentUser = null;
    const result = (await handler(fakeEvent)) as { slug: string; status: string };
    expect(result.slug).toBe('live-meetup');
    expect(result.status).toBe('published');
  });
});
