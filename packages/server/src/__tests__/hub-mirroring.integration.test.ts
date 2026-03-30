import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  federatedHubs,
  federatedHubPosts,
  remoteActors,
  hubs,
  hubMembers,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  followRemoteHub,
  acceptHubFollow,
  unfollowRemoteHub,
  getFederatedHub,
  getFederatedHubByActorUri,
  listFederatedHubs,
  ingestFederatedHubPost,
  listFederatedHubPosts,
  deleteFederatedHubPost,
  likeFederatedHubPost,
  unlikeFederatedHubPost,
} from '../federation/hubMirroring.js';
import { listHubs, createHub } from '../hub/hub.js';

const REMOTE_DOMAIN = 'remote.example.com';
const REMOTE_HUB_ACTOR = `https://${REMOTE_DOMAIN}/hubs/cool-project`;
const REMOTE_POST_AUTHOR = `https://${REMOTE_DOMAIN}/users/alice`;

describe('hub mirroring integration', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'mirrortest' });
    userId = user.id;

    // Pre-populate remote actors so resolution isn't needed
    await db.insert(remoteActors).values([
      {
        actorUri: REMOTE_HUB_ACTOR,
        inbox: `${REMOTE_HUB_ACTOR}/inbox`,
        sharedInbox: `https://${REMOTE_DOMAIN}/inbox`,
        actorType: 'Group',
        instanceDomain: REMOTE_DOMAIN,
        preferredUsername: 'cool-project',
        displayName: 'Cool Project Hub',
        summary: 'A hub for cool projects',
      },
      {
        actorUri: REMOTE_POST_AUTHOR,
        inbox: `${REMOTE_POST_AUTHOR}/inbox`,
        instanceDomain: REMOTE_DOMAIN,
        preferredUsername: 'alice',
        displayName: 'Alice Remote',
      },
    ]);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- followRemoteHub ---

  describe('followRemoteHub', () => {
    it('creates a new federated hub entry', async () => {
      const result = await followRemoteHub(db, REMOTE_HUB_ACTOR, {
        originDomain: REMOTE_DOMAIN,
        remoteSlug: 'cool-project',
        name: 'Cool Project Hub',
        description: 'A hub for cool projects',
        hubType: 'community',
        remoteMemberCount: 42,
      });

      expect(result.created).toBe(true);
      expect(result.id).toBeDefined();

      // Verify DB state
      const [row] = await db.select().from(federatedHubs).where(eq(federatedHubs.id, result.id));
      expect(row).toBeDefined();
      expect(row!.name).toBe('Cool Project Hub');
      expect(row!.status).toBe('pending');
      expect(row!.remoteMemberCount).toBe(42);
    });

    it('returns created=false and updates metadata on duplicate', async () => {
      const result = await followRemoteHub(db, REMOTE_HUB_ACTOR, {
        originDomain: REMOTE_DOMAIN,
        remoteSlug: 'cool-project',
        name: 'Cool Project Hub (Updated)',
        remoteMemberCount: 99,
      });

      expect(result.created).toBe(false);

      // Name should be updated
      const [row] = await db.select().from(federatedHubs).where(eq(federatedHubs.id, result.id));
      expect(row!.name).toBe('Cool Project Hub (Updated)');
      expect(row!.remoteMemberCount).toBe(99);
      // Status should NOT be reset to pending on update
      expect(row!.status).toBe('pending');
    });
  });

  // --- acceptHubFollow ---

  describe('acceptHubFollow', () => {
    it('transitions pending → accepted', async () => {
      const accepted = await acceptHubFollow(db, REMOTE_HUB_ACTOR);
      expect(accepted).toBe(true);

      const [row] = await db.select().from(federatedHubs).where(eq(federatedHubs.actorUri, REMOTE_HUB_ACTOR));
      expect(row!.status).toBe('accepted');
    });

    it('returns false if already accepted (idempotent)', async () => {
      const accepted = await acceptHubFollow(db, REMOTE_HUB_ACTOR);
      expect(accepted).toBe(false);
    });

    it('returns false for unknown actor URI', async () => {
      const accepted = await acceptHubFollow(db, 'https://unknown.example.com/hubs/fake');
      expect(accepted).toBe(false);
    });
  });

  // --- getFederatedHubByActorUri ---

  describe('getFederatedHubByActorUri', () => {
    it('returns accepted hub', async () => {
      const hub = await getFederatedHubByActorUri(db, REMOTE_HUB_ACTOR);
      expect(hub).not.toBeNull();
      expect(hub!.name).toBe('Cool Project Hub (Updated)');
      expect(hub!.source).toBe('federated');
    });

    it('does NOT return pending hub', async () => {
      // Create a second hub in pending state
      const pendingActor = 'https://other.example.com/hubs/pending-hub';
      await db.insert(remoteActors).values({
        actorUri: pendingActor,
        inbox: `${pendingActor}/inbox`,
        instanceDomain: 'other.example.com',
        actorType: 'Group',
      });
      await followRemoteHub(db, pendingActor, {
        originDomain: 'other.example.com',
        remoteSlug: 'pending-hub',
        name: 'Pending Hub',
      });

      const hub = await getFederatedHubByActorUri(db, pendingActor);
      expect(hub).toBeNull(); // Should not return pending hubs
    });
  });

  // --- listFederatedHubs ---

  describe('listFederatedHubs', () => {
    it('only lists accepted, non-hidden hubs', async () => {
      const result = await listFederatedHubs(db);
      // Only the first hub should appear (accepted), not the pending one
      expect(result.items.length).toBe(1);
      expect(result.items[0]!.name).toContain('Cool Project Hub');
      expect(result.total).toBe(1);
    });

    it('filters by search term', async () => {
      const found = await listFederatedHubs(db, { search: 'Cool' });
      expect(found.items.length).toBe(1);

      const notFound = await listFederatedHubs(db, { search: 'nonexistent' });
      expect(notFound.items.length).toBe(0);
    });
  });

  // --- ingestFederatedHubPost ---

  let federatedHubId: string;

  describe('ingestFederatedHubPost', () => {
    beforeAll(async () => {
      const [hub] = await db.select({ id: federatedHubs.id }).from(federatedHubs)
        .where(eq(federatedHubs.actorUri, REMOTE_HUB_ACTOR));
      federatedHubId = hub!.id;
    });

    it('creates a new post and increments count', async () => {
      const result = await ingestFederatedHubPost(db, federatedHubId, {
        objectUri: `${REMOTE_HUB_ACTOR}/posts/001`,
        actorUri: REMOTE_POST_AUTHOR,
        content: 'First hub post!',
        postType: 'discussion',
        publishedAt: new Date('2026-03-15'),
      });

      expect(result.created).toBe(true);

      // Verify post in DB
      const [post] = await db.select().from(federatedHubPosts).where(eq(federatedHubPosts.id, result.id));
      expect(post!.content).toBe('First hub post!');
      expect(post!.postType).toBe('discussion');

      // Verify hub post count incremented
      const [hub] = await db.select().from(federatedHubs).where(eq(federatedHubs.id, federatedHubId));
      expect(hub!.localPostCount).toBe(1);
    });

    it('does NOT double-count on duplicate objectUri', async () => {
      const result = await ingestFederatedHubPost(db, federatedHubId, {
        objectUri: `${REMOTE_HUB_ACTOR}/posts/001`,
        actorUri: REMOTE_POST_AUTHOR,
        content: 'Updated content!',
        postType: 'discussion',
      });

      expect(result.created).toBe(false);

      // Content should be updated
      const [post] = await db.select().from(federatedHubPosts).where(eq(federatedHubPosts.id, result.id));
      expect(post!.content).toBe('Updated content!');

      // Post count should NOT have incremented again
      const [hub] = await db.select().from(federatedHubs).where(eq(federatedHubs.id, federatedHubId));
      expect(hub!.localPostCount).toBe(1);
    });

    it('ingests multiple distinct posts', async () => {
      await ingestFederatedHubPost(db, federatedHubId, {
        objectUri: `${REMOTE_HUB_ACTOR}/posts/002`,
        actorUri: REMOTE_POST_AUTHOR,
        content: 'Second post',
      });
      await ingestFederatedHubPost(db, federatedHubId, {
        objectUri: `${REMOTE_HUB_ACTOR}/posts/003`,
        actorUri: REMOTE_POST_AUTHOR,
        content: 'Third post',
      });

      const [hub] = await db.select().from(federatedHubs).where(eq(federatedHubs.id, federatedHubId));
      expect(hub!.localPostCount).toBe(3);
    });
  });

  // --- listFederatedHubPosts ---

  describe('listFederatedHubPosts', () => {
    it('returns all non-deleted posts for a hub', async () => {
      const result = await listFederatedHubPosts(db, federatedHubId);
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('includes author info from remote actors cache', async () => {
      const result = await listFederatedHubPosts(db, federatedHubId);
      const post = result.items[0]!;
      expect(post.author.displayName).toBe('Alice Remote');
      expect(post.author.preferredUsername).toBe('alice');
      expect(post.source).toBe('federated');
    });

    it('respects pagination', async () => {
      const page1 = await listFederatedHubPosts(db, federatedHubId, { limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(3);

      const page2 = await listFederatedHubPosts(db, federatedHubId, { limit: 2, offset: 2 });
      expect(page2.items.length).toBe(1);
    });
  });

  // --- deleteFederatedHubPost ---

  describe('deleteFederatedHubPost', () => {
    it('soft-deletes a post and decrements count', async () => {
      const deleted = await deleteFederatedHubPost(db, `${REMOTE_HUB_ACTOR}/posts/003`, REMOTE_POST_AUTHOR);
      expect(deleted).toBe(true);

      // Post count should decrement
      const [hub] = await db.select().from(federatedHubs).where(eq(federatedHubs.id, federatedHubId));
      expect(hub!.localPostCount).toBe(2);

      // Deleted post shouldn't appear in listing
      const result = await listFederatedHubPosts(db, federatedHubId);
      expect(result.items.length).toBe(2);
    });

    it('rejects delete from wrong actor', async () => {
      const deleted = await deleteFederatedHubPost(
        db,
        `${REMOTE_HUB_ACTOR}/posts/002`,
        'https://evil.example.com/users/mallory',
      );
      expect(deleted).toBe(false);

      // Post should still exist
      const result = await listFederatedHubPosts(db, federatedHubId);
      expect(result.items.length).toBe(2);
    });

    it('returns false for already-deleted post', async () => {
      const deleted = await deleteFederatedHubPost(db, `${REMOTE_HUB_ACTOR}/posts/003`, REMOTE_POST_AUTHOR);
      expect(deleted).toBe(false);
    });
  });

  // --- Like/Unlike ---

  describe('likeFederatedHubPost / unlikeFederatedHubPost', () => {
    let postId: string;

    beforeAll(async () => {
      const [post] = await db.select({ id: federatedHubPosts.id }).from(federatedHubPosts)
        .where(eq(federatedHubPosts.objectUri, `${REMOTE_HUB_ACTOR}/posts/001`));
      postId = post!.id;
    });

    it('increments like count', async () => {
      const liked = await likeFederatedHubPost(db, postId);
      expect(liked).toBe(true);

      const [post] = await db.select().from(federatedHubPosts).where(eq(federatedHubPosts.id, postId));
      expect(post!.localLikeCount).toBe(1);
    });

    it('decrements like count', async () => {
      const unliked = await unlikeFederatedHubPost(db, postId);
      expect(unliked).toBe(true);

      const [post] = await db.select().from(federatedHubPosts).where(eq(federatedHubPosts.id, postId));
      expect(post!.localLikeCount).toBe(0);
    });

    it('does not go below zero', async () => {
      const unliked = await unlikeFederatedHubPost(db, postId);
      expect(unliked).toBe(true);

      const [post] = await db.select().from(federatedHubPosts).where(eq(federatedHubPosts.id, postId));
      expect(post!.localLikeCount).toBe(0);
    });
  });

  // --- listHubs with includeFederated ---

  describe('listHubs with includeFederated', () => {
    let localHubId: string;

    beforeAll(async () => {
      const hub = await createHub(db, userId, { name: 'Local Test Hub' });
      localHubId = hub.id;
    });

    it('returns only local hubs when includeFederated is false', async () => {
      const result = await listHubs(db, {});
      expect(result.items.length).toBe(1);
      expect(result.items[0]!.id).toBe(localHubId);
    });

    it('merges local and federated hubs when includeFederated is true', async () => {
      const result = await listHubs(db, {}, { includeFederated: true });
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);

      // Should contain both local and federated
      const sources = result.items.map((h) => 'source' in h ? h.source : 'local');
      expect(sources).toContain('local');
      expect(sources).toContain('federated');
    });

    it('search filters both local and federated', async () => {
      const result = await listHubs(db, { search: 'Cool' }, { includeFederated: true });
      // Only the federated hub matches "Cool"
      expect(result.items.length).toBe(1);
      expect(result.items[0]!.name).toContain('Cool');
    });
  });

  // --- unfollowRemoteHub ---

  describe('unfollowRemoteHub', () => {
    it('hides and rejects the hub', async () => {
      const result = await unfollowRemoteHub(db, REMOTE_HUB_ACTOR);
      expect(result).toBe(true);

      const [row] = await db.select().from(federatedHubs).where(eq(federatedHubs.actorUri, REMOTE_HUB_ACTOR));
      expect(row!.status).toBe('rejected');
      expect(row!.isHidden).toBe(true);
    });

    it('hub no longer appears in listings', async () => {
      const result = await listFederatedHubs(db);
      expect(result.items.length).toBe(0);
    });

    it('hub no longer appears in merged listHubs', async () => {
      const result = await listHubs(db, {}, { includeFederated: true });
      // Only the local hub should remain
      const federated = result.items.filter((h) => 'source' in h && h.source === 'federated');
      expect(federated.length).toBe(0);
    });
  });
});
