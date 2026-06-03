import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { contentItems, tags, contentTags } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  countOutboxItems,
  countInstanceOutboxItems,
  getOutboxPage,
  getInstanceOutboxPage,
} from '../federation/outboxQueries.js';

const DOMAIN = 'test.example.com';

/**
 * The instance + per-user outboxes project over PUBLISHED + PUBLIC content_items
 * (not the activities delivery queue), so a mirror's backfill sees the actor's real
 * catalogue. Security: members-only / private / draft content must never appear.
 */
describe('outbox queries (content projection)', () => {
  let db: DB;
  let aliceId: string;
  let bobId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const alice = await createTestUser(db, { username: 'alice' });
    const bob = await createTestUser(db, { username: 'bob' });
    aliceId = alice.id;
    bobId = bob.id;

    const base = Date.now();
    const seed = async (
      authorId: string,
      slug: string,
      status: 'draft' | 'published' | 'archived',
      visibility: 'public' | 'members' | 'private',
      minutesAgo: number,
    ) => {
      await db.insert(contentItems).values({
        authorId,
        type: 'blog',
        title: `Title ${slug}`,
        slug,
        status,
        visibility,
        publishedAt: status === 'published' ? new Date(base - minutesAgo * 60_000) : null,
      });
    };

    // alice: 5 published+public (newest first by slug index), + excluded rows
    for (let i = 0; i < 5; i++) {
      await seed(aliceId, `alice-public-${i}`, 'published', 'public', i);
    }
    await seed(aliceId, 'alice-draft', 'draft', 'public', 100);
    await seed(aliceId, 'alice-members', 'published', 'members', 101);
    await seed(aliceId, 'alice-private', 'published', 'private', 102);

    // bob: 1 published+public (for cross-user instance aggregation + per-user filtering)
    await seed(bobId, 'bob-public-0', 'published', 'public', 10);

    // a tag on one alice post, to exercise the batched tag join
    const [t] = await db.insert(tags).values({ name: 'arduino', slug: 'arduino' }).returning();
    const [firstPost] = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(eq(contentItems.slug, 'alice-public-0'))
      .limit(1);
    if (firstPost && t) {
      await db.insert(contentTags).values({ contentId: firstPost.id, tagId: t.id });
    }
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('counts', () => {
    it('instance outbox counts all users published+public content', async () => {
      expect(await countInstanceOutboxItems(db, DOMAIN)).toBe(6); // 5 alice + 1 bob
    });

    it('per-user outbox counts only that user published+public content', async () => {
      expect(await countOutboxItems(db, `https://${DOMAIN}/users/alice`)).toBe(5);
      expect(await countOutboxItems(db, `https://${DOMAIN}/users/bob`)).toBe(1);
    });

    it('returns 0 for unknown actor', async () => {
      expect(await countOutboxItems(db, `https://${DOMAIN}/users/nobody`)).toBe(0);
    });
  });

  describe('SECURITY: never leak non-public content', () => {
    it('instance outbox excludes draft, members-only, and private content', async () => {
      const page = await getInstanceOutboxPage(db, DOMAIN, 1, 100);
      const ids = JSON.stringify(page);
      expect(ids).not.toContain('alice-draft');
      expect(ids).not.toContain('alice-members');
      expect(ids).not.toContain('alice-private');
      expect(page.length).toBe(6);
    });

    it('per-user outbox excludes the same', async () => {
      const page = await getOutboxPage(db, `https://${DOMAIN}/users/alice`, 1, 100);
      expect(page.length).toBe(5);
      expect(JSON.stringify(page)).not.toMatch(/draft|members|private/);
    });
  });

  describe('projected Create shape', () => {
    it('each item is a Create with a DETERMINISTIC id and real published date', async () => {
      const page = await getInstanceOutboxPage(db, DOMAIN, 1, 100);
      for (const item of page) {
        expect(item.type).toBe('Create');
        expect(item.actor).toMatch(/\/users\//);
        expect(typeof item.id).toBe('string');
        expect(String(item.id)).toMatch(/#create$/); // stable, not random
        expect(typeof item.published).toBe('string'); // real date, not omitted
        const obj = item.object as Record<string, unknown>;
        expect(obj.type).toBe('Article');
      }
    });

    it('id is stable across renders (same input → same id)', async () => {
      const a = await getInstanceOutboxPage(db, DOMAIN, 1, 100);
      const b = await getInstanceOutboxPage(db, DOMAIN, 1, 100);
      expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    });
  });

  describe('pagination', () => {
    it('respects page size and is newest-first', async () => {
      const page1 = await getOutboxPage(db, `https://${DOMAIN}/users/alice`, 1, 2);
      expect(page1.length).toBe(2);
      // alice-public-0 is newest (0 minutes ago); should be first
      expect(String((page1[0]!.object as Record<string, unknown>).id)).toContain('alice-public-0');
    });

    it('past-end page returns empty', async () => {
      const page = await getOutboxPage(db, `https://${DOMAIN}/users/alice`, 10, 3);
      expect(page.length).toBe(0);
    });
  });
});
