/**
 * federateContent must only ever federate PUBLIC content. members-only / private content must
 * never produce an outbound Create activity (the outbound side of the same gate the public
 * outbox enforces — session 183). This locks the security claim directly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, sql } from 'drizzle-orm';
import { activities, contentItems } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContent } from '../content/content.js';
import { federateContent } from '../federation/federation.js';

const DOMAIN = 'gate.example.com';

describe('federateContent visibility gate', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const u = await createTestUser(db, { username: 'gateuser' });
    userId = u.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // createContent derives its own slug from the title, so we assert on the DELTA in outbound
  // Create activities around each federateContent call rather than guessing an object URI.
  async function createActivityCount(): Promise<number> {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(activities)
      .where(and(eq(activities.type, 'Create'), eq(activities.direction, 'outbound')));
    return r?.n ?? 0;
  }

  async function publish(title: string, visibility: 'public' | 'members' | 'private'): Promise<string> {
    // createContent always inserts status='draft'; publish it explicitly for the test.
    const c = await createContent(db, userId, { type: 'blog', title });
    await db
      .update(contentItems)
      .set({ status: 'published', publishedAt: new Date(), visibility })
      .where(eq(contentItems.id, c.id));
    return c.id;
  }

  async function federateDelta(title: string, visibility: 'public' | 'members' | 'private'): Promise<number> {
    const id = await publish(title, visibility);
    const before = await createActivityCount();
    await federateContent(db, id, DOMAIN);
    return (await createActivityCount()) - before;
  }

  it('federates public content (queues exactly one Create)', async () => {
    expect(await federateDelta('Public Post', 'public')).toBe(1);
  });

  it('does NOT federate members-only content', async () => {
    expect(await federateDelta('Members Post', 'members')).toBe(0);
  });

  it('does NOT federate private content', async () => {
    expect(await federateDelta('Private Post', 'private')).toBe(0);
  });
});
