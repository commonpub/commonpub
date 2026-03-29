import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { activities } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  countOutboxItems,
  countInstanceOutboxItems,
  getOutboxPage,
  getInstanceOutboxPage,
} from '../federation/outboxQueries.js';

const DOMAIN = 'test.example.com';

describe('outbox queries', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'alice' });

    // Seed activities
    const actorUri = `https://${DOMAIN}/users/alice`;
    const basePayload = { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Create', actor: actorUri };

    // 5 delivered Create activities
    for (let i = 0; i < 5; i++) {
      await db.insert(activities).values({
        type: 'Create',
        actorUri,
        objectUri: `${actorUri}/content/post-${i}`,
        payload: { ...basePayload, object: { id: `${actorUri}/content/post-${i}`, type: 'Article', name: `Post ${i}` } },
        direction: 'outbound',
        status: 'delivered',
      });
    }

    // 1 delivered Update
    await db.insert(activities).values({
      type: 'Update',
      actorUri,
      objectUri: `${actorUri}/content/post-0`,
      payload: { ...basePayload, type: 'Update' },
      direction: 'outbound',
      status: 'delivered',
    });

    // 1 pending Create (should NOT appear in outbox)
    await db.insert(activities).values({
      type: 'Create',
      actorUri,
      objectUri: `${actorUri}/content/pending`,
      payload: basePayload,
      direction: 'outbound',
      status: 'pending',
    });

    // 1 inbound Create (should NOT appear in outbox)
    await db.insert(activities).values({
      type: 'Create',
      actorUri: 'https://remote.test/users/bob',
      objectUri: 'https://remote.test/content/remote-post',
      payload: { type: 'Create', actor: 'https://remote.test/users/bob' },
      direction: 'inbound',
      status: 'processed',
    });

    // 1 delivered Follow (should NOT appear in outbox — not a content activity)
    await db.insert(activities).values({
      type: 'Follow',
      actorUri,
      objectUri: 'https://remote.test/users/bob',
      payload: { type: 'Follow' },
      direction: 'outbound',
      status: 'delivered',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('countOutboxItems', () => {
    it('counts only delivered outbound Create/Update/Delete for the actor', async () => {
      const count = await countOutboxItems(db, `https://${DOMAIN}/users/alice`);
      // 5 Create + 1 Update = 6 (excludes pending, inbound, Follow)
      expect(count).toBe(6);
    });

    it('returns 0 for unknown actor', async () => {
      const count = await countOutboxItems(db, 'https://unknown.test/users/nobody');
      expect(count).toBe(0);
    });
  });

  describe('countInstanceOutboxItems', () => {
    it('counts all delivered outbound Create activities across all users', async () => {
      const count = await countInstanceOutboxItems(db, DOMAIN);
      // 5 delivered Creates from alice (excludes Update, pending, inbound, Follow)
      expect(count).toBe(5);
    });
  });

  describe('getOutboxPage', () => {
    it('returns paginated activity payloads', async () => {
      const page1 = await getOutboxPage(db, `https://${DOMAIN}/users/alice`, 1, 3);
      expect(page1.length).toBe(3);
      // Each item should be the full AP activity payload
      expect(page1[0]).toHaveProperty('type');
      expect(page1[0]).toHaveProperty('actor');
    });

    it('second page returns remaining items', async () => {
      const page2 = await getOutboxPage(db, `https://${DOMAIN}/users/alice`, 2, 3);
      expect(page2.length).toBe(3); // 6 total, page 2 of 3-per-page = 3 items
    });

    it('past-end page returns empty', async () => {
      const page10 = await getOutboxPage(db, `https://${DOMAIN}/users/alice`, 10, 3);
      expect(page10.length).toBe(0);
    });

    it('excludes pending and inbound activities', async () => {
      const all = await getOutboxPage(db, `https://${DOMAIN}/users/alice`, 1, 100);
      // Should be exactly 6 (5 Create + 1 Update, no pending/inbound/Follow)
      expect(all.length).toBe(6);
    });
  });

  describe('getInstanceOutboxPage', () => {
    it('returns all users Create activities', async () => {
      const page = await getInstanceOutboxPage(db, DOMAIN, 1, 100);
      expect(page.length).toBe(5); // Only Creates, not Updates
    });
  });
});
