/**
 * Integration tests for session 099 federation interop changes:
 * - forkFederatedContent
 * - toggleFederatedBuildMark / isFederatedBuildMarked
 * - Notification triggers from toggleLike, createComment, followUser
 * - onUpdate handler cpubMetadata/cpubBlocks/tags
 * - searchFederatedContent FTS upgrade
 * - listFederatedHubMembers
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  forkFederatedContent,
  toggleFederatedBuildMark,
  isFederatedBuildMarked,
  createContent,
} from '../content/content.js';
import { toggleLike, createComment, followUser } from '../social/social.js';
import { searchFederatedContent, listRemoteReplies } from '../federation/timeline.js';
import { listFederatedHubMembers } from '../federation/hubMirroring.js';
import {
  federatedContent,
  remoteActors,
  notifications,
  contentItems,
  federatedHubs,
  federatedHubPosts,
} from '@commonpub/schema';

describe('federation interop (session 099)', () => {
  let db: DB;
  let userA: string;
  let userB: string;
  let fedContentId: string;
  let localContentId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const a = await createTestUser(db, { username: 'alice', displayName: 'Alice' });
    const b = await createTestUser(db, { username: 'bob', displayName: 'Bob' });
    userA = a.id;
    userB = b.id;

    // Create a remote actor
    await db.insert(remoteActors).values({
      actorUri: 'https://remote.example.com/users/charlie',
      inbox: 'https://remote.example.com/users/charlie/inbox',
      preferredUsername: 'charlie',
      displayName: 'Charlie Remote',
      avatarUrl: 'https://remote.example.com/avatar.png',
      instanceDomain: 'remote.example.com',
    });

    const [remoteActor] = await db
      .select({ id: remoteActors.id })
      .from(remoteActors)
      .where(eq(remoteActors.actorUri, 'https://remote.example.com/users/charlie'))
      .limit(1);

    // Create federated content
    const [fc] = await db
      .insert(federatedContent)
      .values({
        objectUri: 'https://remote.example.com/articles/test-project',
        actorUri: 'https://remote.example.com/users/charlie',
        remoteActorId: remoteActor!.id,
        originDomain: 'remote.example.com',
        apType: 'Article',
        title: 'Test Federated Project',
        content: '<p>HTML content</p>',
        summary: 'A test project from a remote instance',
        cpubType: 'project',
        cpubMetadata: { difficulty: 'intermediate', buildTime: '2 hours' },
        cpubBlocks: [['paragraph', { text: 'Block content here' }], ['heading', { text: 'Section 1', level: 2 }]],
        tags: [{ type: 'Hashtag', name: 'electronics' }, { type: 'Hashtag', name: 'arduino' }],
      })
      .returning();
    fedContentId = fc!.id;

    // Create local content for notification tests
    const localContent = await createContent(db, userA, {
      type: 'article',
      title: 'Local Article for Notifications',
    });
    localContentId = localContent.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- Fork Federated Content ---

  describe('forkFederatedContent', () => {
    it('creates a local draft from federated content', async () => {
      const forked = await forkFederatedContent(db, fedContentId, userA);
      expect(forked).toBeDefined();
      expect(forked.title).toBe('Test Federated Project (Fork)');
      expect(forked.status).toBe('draft');
      expect(forked.type).toBe('project');
    });

    it('preserves cpubBlocks as content', async () => {
      const forked = await forkFederatedContent(db, fedContentId, userB);
      // The forked content should have the cpubBlocks as its content
      const [item] = await db
        .select({ content: contentItems.content })
        .from(contentItems)
        .where(eq(contentItems.id, forked.id))
        .limit(1);
      expect(item!.content).toBeDefined();
      expect(Array.isArray(item!.content)).toBe(true);
    });

    it('throws for nonexistent federated content', async () => {
      await expect(
        forkFederatedContent(db, crypto.randomUUID(), userA),
      ).rejects.toThrow('Federated content not found');
    });

    it('extracts metadata fields', async () => {
      const forked = await forkFederatedContent(db, fedContentId, userA);
      expect(forked.difficulty).toBe('intermediate');
      expect(forked.buildTime).toBe('2 hours');
    });
  });

  // --- Federated Build Marks ---

  describe('toggleFederatedBuildMark', () => {
    it('marks federated content as built', async () => {
      const result = await toggleFederatedBuildMark(db, fedContentId, userA);
      expect(result.marked).toBe(true);
      expect(result.count).toBe(1);
    });

    it('checks if build marked', async () => {
      const marked = await isFederatedBuildMarked(db, fedContentId, userA);
      expect(marked).toBe(true);
    });

    it('second user increases count', async () => {
      const result = await toggleFederatedBuildMark(db, fedContentId, userB);
      expect(result.marked).toBe(true);
      expect(result.count).toBe(2);
    });

    it('unmarks and decreases count', async () => {
      const result = await toggleFederatedBuildMark(db, fedContentId, userA);
      expect(result.marked).toBe(false);
      expect(result.count).toBe(1);
    });

    it('reports not marked after unmark', async () => {
      const marked = await isFederatedBuildMarked(db, fedContentId, userA);
      expect(marked).toBe(false);
    });
  });

  // --- Notification Triggers ---

  describe('notification triggers', () => {
    it('creates notification on like', async () => {
      // userB likes userA's content
      await toggleLike(db, userB, 'article', localContentId);

      const [notif] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userA))
        .limit(1);

      expect(notif).toBeDefined();
      expect(notif!.type).toBe('like');
      expect(notif!.actorId).toBe(userB);
      expect(notif!.message).toContain('Bob');
    });

    it('creates notification on comment', async () => {
      // Clear previous notifications
      await db.delete(notifications);

      await createComment(db, userB, {
        targetType: 'article',
        targetId: localContentId,
        content: 'Nice article!',
      });

      const [notif] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userA))
        .limit(1);

      expect(notif).toBeDefined();
      expect(notif!.type).toBe('comment');
      expect(notif!.actorId).toBe(userB);
    });

    it('creates notification on follow', async () => {
      await db.delete(notifications);

      await followUser(db, userB, userA);

      const [notif] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userA))
        .limit(1);

      expect(notif).toBeDefined();
      expect(notif!.type).toBe('follow');
      expect(notif!.actorId).toBe(userB);
      expect(notif!.message).toContain('Bob');
    });

    it('does not notify self-like', async () => {
      await db.delete(notifications);

      // userA likes own content
      await toggleLike(db, userA, 'article', localContentId);

      const notifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userA));

      // Should have zero notifications (self-like)
      expect(notifs.length).toBe(0);
    });

    it('does not notify self-follow', async () => {
      await db.delete(notifications);

      const result = await followUser(db, userA, userA);
      expect(result.followed).toBe(false);

      const notifs = await db.select().from(notifications);
      expect(notifs.length).toBe(0);
    });
  });

  // --- Search (FTS upgrade) ---

  describe('searchFederatedContent', () => {
    it('finds content by title', async () => {
      const result = await searchFederatedContent(db, 'Federated Project');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.items[0]!.title).toContain('Federated');
    });

    it('finds content by summary', async () => {
      const result = await searchFederatedContent(db, 'remote instance');
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for non-matching query', async () => {
      const result = await searchFederatedContent(db, 'xyznonexistent');
      expect(result.total).toBe(0);
      expect(result.items.length).toBe(0);
    });

    it('handles single character with ILIKE fallback', async () => {
      // Single character should use ILIKE, not FTS
      const result = await searchFederatedContent(db, 'T');
      // Should not throw, may or may not find results
      expect(result).toBeDefined();
    });
  });

  // --- Federated Hub Members ---

  describe('listFederatedHubMembers', () => {
    let hubId: string;

    beforeAll(async () => {
      // Create a remote actor for the hub
      const [hubActor] = await db
        .insert(remoteActors)
        .values({
          actorUri: 'https://remote.example.com/hubs/test-hub',
          inbox: 'https://remote.example.com/hubs/test-hub/inbox',
          actorType: 'Group',
          preferredUsername: 'test-hub',
          displayName: 'Test Hub',
          instanceDomain: 'remote.example.com',
        })
        .returning();

      // Create federated hub
      const [hub] = await db
        .insert(federatedHubs)
        .values({
          actorUri: 'https://remote.example.com/hubs/test-hub',
          remoteActorId: hubActor!.id,
          originDomain: 'remote.example.com',
          remoteSlug: 'test-hub',
          name: 'Test Hub',
          hubType: 'community',
          status: 'accepted',
        })
        .returning();
      hubId = hub!.id;

      // Get the charlie actor ID
      const [charlie] = await db
        .select({ id: remoteActors.id })
        .from(remoteActors)
        .where(eq(remoteActors.actorUri, 'https://remote.example.com/users/charlie'))
        .limit(1);

      // Add posts from charlie
      await db.insert(federatedHubPosts).values([
        {
          federatedHubId: hubId,
          objectUri: 'https://remote.example.com/hubs/test-hub/posts/1',
          actorUri: 'https://remote.example.com/users/charlie',
          remoteActorId: charlie!.id,
          content: 'First post',
          postType: 'text',
        },
        {
          federatedHubId: hubId,
          objectUri: 'https://remote.example.com/hubs/test-hub/posts/2',
          actorUri: 'https://remote.example.com/users/charlie',
          remoteActorId: charlie!.id,
          content: 'Second post',
          postType: 'discussion',
        },
      ]);
    });

    it('lists known members with post counts', async () => {
      const members = await listFederatedHubMembers(db, hubId);
      expect(members.length).toBe(1);
      expect(members[0]!.preferredUsername).toBe('charlie');
      expect(members[0]!.instanceDomain).toBe('remote.example.com');
      expect(members[0]!.postCount).toBe(2);
    });

    it('returns empty for hub with no posts', async () => {
      const [emptyHub] = await db
        .insert(federatedHubs)
        .values({
          actorUri: 'https://other.example.com/hubs/empty',
          originDomain: 'other.example.com',
          remoteSlug: 'empty',
          name: 'Empty Hub',
          hubType: 'community',
          status: 'accepted',
        })
        .returning();

      const members = await listFederatedHubMembers(db, emptyHub!.id);
      expect(members.length).toBe(0);
    });
  });
});
