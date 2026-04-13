/**
 * Integration tests for federation content type handling.
 *
 * Tests that content type identity is preserved through the federation pipeline:
 * - CommonPub → CommonPub: cpub:type extension preserves project/article/blog/explainer
 * - Non-CommonPub → CommonPub: Articles without cpub:type have cpubType = null
 * - Filtering by cpubType works correctly for mixed sources
 * - Filtering by apType works correctly
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import { listFederatedTimeline } from '../federation/timeline.js';
import { remoteActors } from '@commonpub/schema';

const LOCAL_DOMAIN = 'local.example.com';
const REMOTE_CPUB = 'https://other-cpub.io/users/alice';
const REMOTE_MASTODON = 'https://mastodon.social/users/bob';
const REMOTE_LEMMY = 'https://lemmy.world/u/charlie';

describe('federation content type handling', () => {
  let db: DB;
  let handlers: ReturnType<typeof createInboxHandlers>;

  beforeAll(async () => {
    db = await createTestDB();

    // Insert remote actors
    await db.insert(remoteActors).values([
      {
        actorUri: REMOTE_CPUB,
        inbox: `${REMOTE_CPUB}/inbox`,
        instanceDomain: 'other-cpub.io',
        preferredUsername: 'alice',
        displayName: 'Alice (CommonPub)',
      },
      {
        actorUri: REMOTE_MASTODON,
        inbox: `${REMOTE_MASTODON}/inbox`,
        instanceDomain: 'mastodon.social',
        preferredUsername: 'bob',
        displayName: 'Bob (Mastodon)',
      },
      {
        actorUri: REMOTE_LEMMY,
        inbox: `${REMOTE_LEMMY}/inbox`,
        instanceDomain: 'lemmy.world',
        preferredUsername: 'charlie',
        displayName: 'Charlie (Lemmy)',
      },
    ]);

    handlers = createInboxHandlers({ db, domain: LOCAL_DOMAIN });

    // Ingest content from different sources
    // 1. CommonPub project
    await handlers.onCreate(REMOTE_CPUB, {
      type: 'Article',
      id: 'https://other-cpub.io/content/led-cube',
      name: 'LED Cube Build',
      content: '<p>Build a 4x4x4 LED cube</p>',
      summary: 'A complete LED cube tutorial',
      'cpub:type': 'project',
      'cpub:metadata': { difficulty: 'intermediate' },
      attributedTo: REMOTE_CPUB,
      published: '2026-03-20T10:00:00Z',
    });

    // 2. CommonPub article
    await handlers.onCreate(REMOTE_CPUB, {
      type: 'Article',
      id: 'https://other-cpub.io/content/esp32-guide',
      name: 'Getting Started with ESP32',
      content: '<p>A comprehensive guide</p>',
      'cpub:type': 'article',
      attributedTo: REMOTE_CPUB,
      published: '2026-03-20T11:00:00Z',
    });

    // 3. CommonPub blog
    await handlers.onCreate(REMOTE_CPUB, {
      type: 'Article',
      id: 'https://other-cpub.io/content/weekly-update',
      name: 'Week 12 Update',
      content: '<p>This week we shipped...</p>',
      'cpub:type': 'blog',
      attributedTo: REMOTE_CPUB,
      published: '2026-03-20T12:00:00Z',
    });

    // 4. Mastodon article (NO cpub:type)
    await handlers.onCreate(REMOTE_MASTODON, {
      type: 'Article',
      id: 'https://mastodon.social/users/bob/articles/123',
      name: 'Thoughts on Maker Culture',
      content: '<p>Long-form post about making things</p>',
      attributedTo: REMOTE_MASTODON,
      published: '2026-03-20T13:00:00Z',
    });

    // 5. Mastodon note (short post, no cpub:type)
    await handlers.onCreate(REMOTE_MASTODON, {
      type: 'Note',
      id: 'https://mastodon.social/users/bob/statuses/456',
      content: '<p>Just finished my first PCB! 🎉</p>',
      attributedTo: REMOTE_MASTODON,
      published: '2026-03-20T14:00:00Z',
    });

    // 6. Lemmy article (NO cpub:type)
    await handlers.onCreate(REMOTE_LEMMY, {
      type: 'Article',
      id: 'https://lemmy.world/post/789',
      name: 'Best 3D Printer Under $300?',
      content: '<p>Looking for recommendations</p>',
      attributedTo: REMOTE_LEMMY,
      published: '2026-03-20T15:00:00Z',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- CommonPub content preserves cpub:type ---

  describe('CommonPub content type preservation', () => {
    it('preserves cpubType = project', async () => {
      const { items } = await listFederatedTimeline(db, { cpubType: 'project' });
      expect(items.length).toBe(1);
      expect(items[0]!.title).toBe('LED Cube Build');
      expect(items[0]!.cpubType).toBe('project');
      expect(items[0]!.apType).toBe('Article');
    });

    it('preserves cpubType = blog', async () => {
      const { items } = await listFederatedTimeline(db, { cpubType: 'blog' });
      // article is normalized to blog on inbound, so both 'Getting Started' and 'Week 12 Update' are blogs
      expect(items.length).toBe(2);
      expect(items.map(i => i.cpubType)).toEqual(['blog', 'blog']);
    });

    it('normalizes cpubType = article to blog on inbound', async () => {
      // article type is normalized to blog, so querying for article returns 0
      const { items } = await listFederatedTimeline(db, { cpubType: 'article' });
      expect(items.length).toBe(0);
    });
  });

  // --- Non-CommonPub content has null cpubType ---

  describe('non-CommonPub content type handling', () => {
    it('Mastodon Article has cpubType = null', async () => {
      const { items } = await listFederatedTimeline(db, { apType: 'Article' });
      const mastodonArticle = items.find(i => i.objectUri.includes('mastodon.social'));
      expect(mastodonArticle).toBeDefined();
      expect(mastodonArticle!.cpubType).toBeNull();
      expect(mastodonArticle!.apType).toBe('Article');
    });

    it('Mastodon Note has cpubType = null', async () => {
      const { items } = await listFederatedTimeline(db, { apType: 'Note' });
      const note = items.find(i => i.objectUri.includes('mastodon.social'));
      expect(note).toBeDefined();
      expect(note!.cpubType).toBeNull();
      expect(note!.apType).toBe('Note');
    });

    it('Lemmy Article has cpubType = null', async () => {
      const { items } = await listFederatedTimeline(db, { apType: 'Article' });
      const lemmyArticle = items.find(i => i.objectUri.includes('lemmy.world'));
      expect(lemmyArticle).toBeDefined();
      expect(lemmyArticle!.cpubType).toBeNull();
    });
  });

  // --- Filtering behavior ---

  describe('content type filtering', () => {
    it('cpubType filter excludes non-CommonPub content', async () => {
      const { items } = await listFederatedTimeline(db, { cpubType: 'project' });
      // Only CommonPub project — NOT Mastodon or Lemmy articles
      expect(items.length).toBe(1);
      expect(items[0]!.actor!.instanceDomain).toBe('other-cpub.io');
    });

    it('apType=Article returns ALL articles regardless of cpubType', async () => {
      const { items } = await listFederatedTimeline(db, { apType: 'Article' });
      // 3 CommonPub articles + 1 Mastodon article + 1 Lemmy article = 5
      expect(items.length).toBe(5);
    });

    it('apType=Note returns only Notes', async () => {
      const { items } = await listFederatedTimeline(db, { apType: 'Note' });
      expect(items.length).toBe(1);
      expect(items[0]!.content).toContain('first PCB');
    });

    it('no filter returns all content', async () => {
      const { items } = await listFederatedTimeline(db);
      expect(items.length).toBe(6);
    });

    it('non-CommonPub Articles are distinguishable from native articles by cpubType', async () => {
      const { items } = await listFederatedTimeline(db, { apType: 'Article' });

      const withCpubType = items.filter(i => i.cpubType !== null);
      const withoutCpubType = items.filter(i => i.cpubType === null);

      // 3 CommonPub (project, article, blog) have cpubType
      expect(withCpubType.length).toBe(3);
      // 2 non-CommonPub (Mastodon + Lemmy) lack cpubType
      expect(withoutCpubType.length).toBe(2);
    });
  });
});
