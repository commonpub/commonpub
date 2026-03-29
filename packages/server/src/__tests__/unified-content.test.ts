/**
 * Tests for unified content listing (local + federated).
 * Covers queryFederatedAsListItems, listContent with includeFederated,
 * and isBookmarked.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { contentItems, federatedContent, remoteActors, bookmarks, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { listContent } from '../content/content.js';
import { isBookmarked } from '../social/social.js';

const DOMAIN = 'test.example.com';

describe('unified content listing', () => {
  let db: DB;
  let userId: string;
  let localContentId: string;
  let fedContentId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'unifiedtest' });
    userId = user.id;

    // Create local content
    const [localItem] = await db.insert(contentItems).values({
      authorId: userId,
      type: 'project',
      title: 'Local Project',
      slug: 'local-project',
      description: 'A local project',
      status: 'published',
      publishedAt: new Date('2026-03-20'),
    }).returning();
    localContentId = localItem!.id;

    // Create a remote actor
    const [actor] = await db.insert(remoteActors).values({
      actorUri: 'https://remote.test/users/bob',
      inbox: 'https://remote.test/users/bob/inbox',
      instanceDomain: 'remote.test',
      preferredUsername: 'bob',
      displayName: 'Bob Builder',
      avatarUrl: 'https://remote.test/avatar.jpg',
    }).returning();

    // Create federated content
    const [fedItem] = await db.insert(federatedContent).values({
      objectUri: 'https://remote.test/content/remote-project',
      actorUri: 'https://remote.test/users/bob',
      remoteActorId: actor!.id,
      originDomain: 'remote.test',
      apType: 'Article',
      cpubType: 'project',
      title: 'Remote Project',
      summary: 'A project from remote',
      coverImageUrl: 'https://remote.test/cover.jpg',
      publishedAt: new Date('2026-03-25'),
    }).returning();
    fedContentId = fedItem!.id;

    // Create another federated content (article type)
    await db.insert(federatedContent).values({
      objectUri: 'https://remote.test/content/remote-article',
      actorUri: 'https://remote.test/users/bob',
      remoteActorId: actor!.id,
      originDomain: 'remote.test',
      apType: 'Article',
      cpubType: 'article',
      title: 'Remote Article',
      summary: 'An article from remote',
      publishedAt: new Date('2026-03-22'),
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('listContent without federation', () => {
    it('returns only local content when includeFederated is false', async () => {
      const result = await listContent(db, { status: 'published' });
      expect(result.items.length).toBe(1);
      expect(result.items[0]!.title).toBe('Local Project');
      expect(result.items[0]!.source).toBe('local');
    });

    it('returns only local content when includeFederated is undefined', async () => {
      const result = await listContent(db, { status: 'published' }, {});
      expect(result.items.every((i) => i.source === 'local')).toBe(true);
    });
  });

  describe('listContent with federation', () => {
    it('merges local and federated content', async () => {
      const result = await listContent(db, { status: 'published' }, { includeFederated: true });
      expect(result.items.length).toBe(3); // 1 local + 2 federated
      expect(result.total).toBe(3);
    });

    it('sorts by publishedAt descending (federated first if newer)', async () => {
      const result = await listContent(db, { status: 'published' }, { includeFederated: true });
      // Remote Project (Mar 25) > Remote Article (Mar 22) > Local Project (Mar 20)
      expect(result.items[0]!.title).toBe('Remote Project');
      expect(result.items[0]!.source).toBe('federated');
      expect(result.items[2]!.title).toBe('Local Project');
      expect(result.items[2]!.source).toBe('local');
    });

    it('federated items have correct source metadata', async () => {
      const result = await listContent(db, { status: 'published' }, { includeFederated: true });
      const fedItem = result.items.find((i) => i.source === 'federated')!;
      expect(fedItem.sourceDomain).toBe('remote.test');
      expect(fedItem.sourceUri).toBe('https://remote.test/content/remote-project');
      expect(fedItem.federatedContentId).toBeDefined();
    });

    it('federated items have author from remote actor', async () => {
      const result = await listContent(db, { status: 'published' }, { includeFederated: true });
      const fedItem = result.items.find((i) => i.source === 'federated' && i.title === 'Remote Project')!;
      expect(fedItem.author.username).toBe('bob');
      expect(fedItem.author.displayName).toBe('Bob Builder');
      expect(fedItem.author.avatarUrl).toBe('https://remote.test/avatar.jpg');
    });

    it('filters by type across both sources', async () => {
      const result = await listContent(db, { status: 'published', type: 'project' }, { includeFederated: true });
      // 1 local project + 1 federated project (cpubType='project')
      expect(result.items.length).toBe(2);
      expect(result.items.every((i) => i.type === 'project')).toBe(true);
    });

    it('search works across both sources', async () => {
      const result = await listContent(db, { status: 'published', search: 'Remote' }, { includeFederated: true });
      // Only federated items match "Remote"
      expect(result.items.length).toBe(2);
      expect(result.items.every((i) => i.source === 'federated')).toBe(true);
    });

    it('respects pagination limit', async () => {
      const result = await listContent(db, { status: 'published', limit: 2 }, { includeFederated: true });
      expect(result.items.length).toBe(2);
    });
  });

  describe('isBookmarked', () => {
    it('returns false when not bookmarked', async () => {
      const result = await isBookmarked(db, userId, 'project', localContentId);
      expect(result).toBe(false);
    });

    it('returns true after bookmarking', async () => {
      await db.insert(bookmarks).values({
        userId,
        targetType: 'project',
        targetId: localContentId,
      });
      const result = await isBookmarked(db, userId, 'project', localContentId);
      expect(result).toBe(true);
    });

    it('returns false for different target type', async () => {
      const result = await isBookmarked(db, userId, 'article', localContentId);
      expect(result).toBe(false);
    });

    it('returns false for different user', async () => {
      const user2 = await createTestUser(db, { username: 'otherperson' });
      const result = await isBookmarked(db, user2.id, 'project', localContentId);
      expect(result).toBe(false);
    });
  });
});
