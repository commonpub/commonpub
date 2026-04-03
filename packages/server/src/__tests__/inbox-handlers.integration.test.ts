/**
 * Integration tests for inbox handler edge cases.
 *
 * The main happy-path flows (Create, Like, Follow lifecycle) are tested in
 * federated-timeline.integration.test.ts and federation.integration.test.ts.
 * These tests focus on edge cases, error paths, and less-common scenarios.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import {
  remoteActors,
  activities,
  followRelationships,
  federatedContent,
  contentItems,
  users,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import { listFederatedTimeline } from '../federation/timeline.js';

const LOCAL_DOMAIN = 'local.example.com';
const REMOTE_ALICE = 'https://remote.example.com/users/alice';
const REMOTE_BOB = 'https://remote2.example.com/users/bob';

describe('inbox handler edge cases', () => {
  let db: DB;
  let handlers: ReturnType<typeof createInboxHandlers>;
  let localUserId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'localuser' });
    localUserId = user.id;

    await db.insert(remoteActors).values([
      {
        actorUri: REMOTE_ALICE,
        inbox: `${REMOTE_ALICE}/inbox`,
        instanceDomain: 'remote.example.com',
        preferredUsername: 'alice',
        displayName: 'Alice',
      },
      {
        actorUri: REMOTE_BOB,
        inbox: `${REMOTE_BOB}/inbox`,
        instanceDomain: 'remote2.example.com',
        preferredUsername: 'bob',
        displayName: 'Bob',
      },
    ]);

    handlers = createInboxHandlers({ db, domain: LOCAL_DOMAIN });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- onCreate edge cases ---

  describe('onCreate', () => {
    it('rejects content from own domain (loop prevention)', async () => {
      await handlers.onCreate(`https://${LOCAL_DOMAIN}/users/localuser`, {
        type: 'Article',
        id: `https://${LOCAL_DOMAIN}/content/looped`,
        name: 'Looped Article',
        content: '<p>This should not be stored</p>',
        attributedTo: `https://${LOCAL_DOMAIN}/users/localuser`,
      });

      const { items } = await listFederatedTimeline(db);
      const looped = items.find(i => i.objectUri.includes('looped'));
      expect(looped).toBeUndefined();
    });

    it('deduplicates on objectUri (upsert behavior)', async () => {
      const objectUri = 'https://remote.example.com/content/dedup-test';

      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Original Title',
        content: '<p>Original content</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Send same objectUri again with different content
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Updated Title',
        content: '<p>Updated content</p>',
        attributedTo: REMOTE_ALICE,
      });

      const { items } = await listFederatedTimeline(db);
      const matches = items.filter(i => i.objectUri === objectUri);
      // Should be exactly 1 (upserted, not duplicated)
      expect(matches.length).toBe(1);
    });

    it('sanitizes dangerous HTML in content', async () => {
      await handlers.onCreate(REMOTE_BOB, {
        type: 'Article',
        id: 'https://remote2.example.com/content/xss',
        name: 'XSS Test',
        content: '<p>Safe</p><script>alert("xss")</script><img onerror="alert(1)" src=x>',
        attributedTo: REMOTE_BOB,
      });

      const { items } = await listFederatedTimeline(db);
      const item = items.find(i => i.objectUri.includes('xss'));
      expect(item).toBeDefined();
      expect(item!.content).not.toContain('<script>');
      expect(item!.content).not.toContain('onerror');
      expect(item!.content).toContain('Safe');
    });

    it('stores tags from AP tag array', async () => {
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: 'https://remote.example.com/content/tagged',
        name: 'Tagged Article',
        content: '<p>Content with tags</p>',
        attributedTo: REMOTE_ALICE,
        tag: [
          { type: 'Hashtag', name: '#electronics' },
          { type: 'Hashtag', name: '#led' },
          { type: 'Mention', name: '@someone' },
        ],
      });

      const { items } = await listFederatedTimeline(db);
      const item = items.find(i => i.objectUri.includes('tagged'));
      expect(item).toBeDefined();
      expect(item!.tags.length).toBe(3);
      expect(item!.tags[0]!.name).toBe('#electronics');
    });
  });

  // --- onUpdate edge cases ---

  describe('onUpdate', () => {
    it('only updates content from original author (authorization)', async () => {
      const objectUri = 'https://remote.example.com/content/alice-article';
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Alice Original',
        content: '<p>Original</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Bob tries to update Alice's content — should be rejected
      await handlers.onUpdate(REMOTE_BOB, {
        type: 'Article',
        id: objectUri,
        name: 'Bob Hijack',
        content: '<p>Hijacked</p>',
        attributedTo: REMOTE_BOB,
      });

      const { items } = await listFederatedTimeline(db);
      const item = items.find(i => i.objectUri === objectUri);
      expect(item).toBeDefined();
      // Title should still be Alice's original (Bob's update rejected)
      expect(item!.title).toBe('Alice Original');
    });

    it('treats Update for unknown content as Create (missed Create)', async () => {
      const objectUri = 'https://remote2.example.com/content/missed-create';
      await handlers.onUpdate(REMOTE_BOB, {
        type: 'Article',
        id: objectUri,
        name: 'New via Update',
        content: '<p>This was a missed Create</p>',
        attributedTo: REMOTE_BOB,
      });

      const { items } = await listFederatedTimeline(db);
      const item = items.find(i => i.objectUri === objectUri);
      expect(item).toBeDefined();
      expect(item!.title).toBe('New via Update');
    });
  });

  // --- onDelete edge cases ---

  describe('onDelete', () => {
    it('soft-deletes content (sets deletedAt)', async () => {
      const objectUri = 'https://remote.example.com/content/to-delete';
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Will Be Deleted',
        content: '<p>Temporary</p>',
        attributedTo: REMOTE_ALICE,
      });

      await handlers.onDelete(REMOTE_ALICE, objectUri);

      // Should not appear in timeline (filtered by deletedAt IS NULL)
      const { items } = await listFederatedTimeline(db);
      const item = items.find(i => i.objectUri === objectUri);
      expect(item).toBeUndefined();

      // But row still exists in DB (soft delete)
      const [row] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(row).toBeDefined();
      expect(row!.deletedAt).not.toBeNull();
    });

    it('only original author can delete (authorization)', async () => {
      const objectUri = 'https://remote.example.com/content/alice-protected';
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Protected Content',
        content: '<p>Cannot be deleted by others</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Bob tries to delete Alice's content
      await handlers.onDelete(REMOTE_BOB, objectUri);

      // Should still exist (Bob's delete rejected)
      const { items } = await listFederatedTimeline(db);
      const item = items.find(i => i.objectUri === objectUri);
      expect(item).toBeDefined();
      expect(item!.title).toBe('Protected Content');
    });
  });

  // --- onLike idempotency ---

  describe('onLike', () => {
    it('does not double-count duplicate likes', async () => {
      const objectUri = 'https://remote.example.com/content/liked-twice';
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Popular Article',
        content: '<p>Everyone likes this</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Bob likes it twice
      await handlers.onLike(REMOTE_BOB, objectUri);
      await handlers.onLike(REMOTE_BOB, objectUri);

      const [row] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      // Like count should only be 1 (second Like is idempotent)
      expect(row!.localLikeCount).toBe(1);
    });
  });

  // --- onFollow with auto-accept ---

  describe('onFollow', () => {
    it('auto-accepts and creates Accept activity', async () => {
      const localActorUri = `https://${LOCAL_DOMAIN}/users/localuser`;
      await handlers.onFollow(REMOTE_BOB, localActorUri, 'https://remote2.example.com/activities/follow-1');

      // Check follow relationship is accepted
      const [rel] = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, REMOTE_BOB),
            eq(followRelationships.followingActorUri, localActorUri),
          ),
        );
      expect(rel).toBeDefined();
      expect(rel!.status).toBe('accepted');

      // Check Accept activity was queued
      const [accept] = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.type, 'Accept'),
            eq(activities.direction, 'outbound'),
            eq(activities.objectUri, REMOTE_BOB),
          ),
        );
      expect(accept).toBeDefined();
    });
  });

  // --- onAccept ---

  describe('onAccept', () => {
    it('transitions follow from pending to accepted', async () => {
      // Create a pending outbound follow
      const localActorUri = `https://${LOCAL_DOMAIN}/users/localuser`;
      const followActivityUri = 'https://local.example.com/activities/follow-out-1';
      await db.insert(followRelationships).values({
        followerActorUri: localActorUri,
        followingActorUri: REMOTE_ALICE,
        activityUri: followActivityUri,
        status: 'pending',
      });

      await handlers.onAccept(REMOTE_ALICE, followActivityUri);

      const [rel] = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, localActorUri),
            eq(followRelationships.followingActorUri, REMOTE_ALICE),
          ),
        );
      expect(rel!.status).toBe('accepted');
    });
  });

  // --- Activity logging ---

  describe('activity logging', () => {
    it('logs all inbound activities in the activities table', async () => {
      const beforeCount = await db
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.direction, 'inbound'));

      await handlers.onCreate(REMOTE_BOB, {
        type: 'Article',
        id: 'https://remote2.example.com/content/logged',
        name: 'Logged Article',
        content: '<p>This gets logged</p>',
        attributedTo: REMOTE_BOB,
      });

      const afterCount = await db
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.direction, 'inbound'));

      expect(afterCount.length).toBeGreaterThan(beforeCount.length);
    });
  });

  // --- onUndo ---

  describe('onUndo', () => {
    it('decrements like count on Undo(Like) for federated content', async () => {
      const objectUri = 'https://remote.example.com/content/will-unlike';
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Will Be Unliked',
        content: '<p>Content</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Like then Unlike
      await handlers.onLike(REMOTE_BOB, objectUri);

      const [beforeUndo] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(beforeUndo!.localLikeCount).toBe(1);

      await handlers.onUndo(REMOTE_BOB, 'Like', objectUri);

      const [afterUndo] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      expect(afterUndo!.localLikeCount).toBe(0);
    });

    it('does not go below zero on Undo(Like) without prior Like', async () => {
      const objectUri = 'https://remote.example.com/content/never-liked';
      await handlers.onCreate(REMOTE_ALICE, {
        type: 'Article',
        id: objectUri,
        name: 'Never Liked',
        content: '<p>No likes here</p>',
        attributedTo: REMOTE_ALICE,
      });

      // Undo(Like) without a prior Like
      await handlers.onUndo(REMOTE_BOB, 'Like', objectUri);

      const [row] = await db
        .select()
        .from(federatedContent)
        .where(eq(federatedContent.objectUri, objectUri));
      // GREATEST(count - 1, 0) should prevent negative
      expect(row!.localLikeCount).toBe(0);
    });

    it('removes follow relationship on Undo(Follow) with matching activityUri', async () => {
      // Use Alice→localuser (Bob→localuser already exists from onFollow test)
      const localActorUri = `https://${LOCAL_DOMAIN}/users/localuser`;
      const followActivityUri = 'https://remote.example.com/activities/follow-to-undo';

      // Create follow from Alice
      await db.insert(followRelationships).values({
        followerActorUri: REMOTE_ALICE,
        followingActorUri: localActorUri,
        activityUri: followActivityUri,
        status: 'accepted',
      });

      await handlers.onUndo(REMOTE_ALICE, 'Follow', followActivityUri);

      const rels = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, REMOTE_ALICE),
            eq(followRelationships.activityUri, followActivityUri),
          ),
        );
      expect(rels.length).toBe(0);
    });
  });

  // --- onReject ---

  describe('onReject', () => {
    it('transitions follow to rejected', async () => {
      const localActorUri = `https://${LOCAL_DOMAIN}/users/localuser`;
      const followActivityUri = 'https://local.example.com/activities/follow-rejected';
      await db.insert(followRelationships).values({
        followerActorUri: localActorUri,
        followingActorUri: REMOTE_BOB,
        activityUri: followActivityUri,
        status: 'pending',
      });

      await handlers.onReject(REMOTE_BOB, followActivityUri);

      const [rel] = await db
        .select()
        .from(followRelationships)
        .where(eq(followRelationships.activityUri, followActivityUri));
      expect(rel!.status).toBe('rejected');
    });
  });
});
