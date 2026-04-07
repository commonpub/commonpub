/**
 * Integration tests for local user replies to federated hub posts.
 *
 * Bug 1: When a user on the mirroring instance replies to a federated hub post,
 * the reply should be stored locally in federatedHubPostReplies and displayed.
 *
 * Tests:
 * - createFederatedHubPostReply stores reply with correct author
 * - localReplyCount is incremented on the federated hub post
 * - listFederatedHubPostReplies returns replies with author info
 * - Threaded replies (parentId) work correctly
 * - Empty list returns total 0
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  federatedHubs,
  federatedHubPosts,
  federatedHubPostReplies,
  remoteActors,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createFederatedHubPostReply,
  listFederatedHubPostReplies,
} from '../federation/hubMirroring.js';

const REMOTE_DOMAIN = 'remote-hub.example.com';
const REMOTE_HUB_ACTOR = `https://${REMOTE_DOMAIN}/hubs/cool-hub`;
const REMOTE_POST_ACTOR = `https://${REMOTE_DOMAIN}/users/alice`;

describe('local replies to federated hub posts', () => {
  let db: DB;
  let userId: string;
  let secondUserId: string;
  let federatedHubId: string;
  let federatedHubPostId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'localuser' });
    userId = user.id;
    const user2 = await createTestUser(db, { username: 'localuser2' });
    secondUserId = user2.id;

    // Create remote actor
    const [remoteActor] = await db.insert(remoteActors).values({
      actorUri: REMOTE_HUB_ACTOR,
      inbox: `${REMOTE_HUB_ACTOR}/inbox`,
      instanceDomain: REMOTE_DOMAIN,
      actorType: 'Group',
      preferredUsername: 'cool-hub',
      displayName: 'Cool Hub',
    }).returning();

    // Create remote post author
    await db.insert(remoteActors).values({
      actorUri: REMOTE_POST_ACTOR,
      inbox: `${REMOTE_POST_ACTOR}/inbox`,
      instanceDomain: REMOTE_DOMAIN,
      preferredUsername: 'alice',
      displayName: 'Alice Remote',
      avatarUrl: 'https://remote-hub.example.com/avatars/alice.png',
    });

    // Create federated hub
    const [hub] = await db.insert(federatedHubs).values({
      actorUri: REMOTE_HUB_ACTOR,
      remoteActorId: remoteActor!.id,
      originDomain: REMOTE_DOMAIN,
      remoteSlug: 'cool-hub',
      name: 'Cool Hub',
      status: 'accepted',
    }).returning();
    federatedHubId = hub!.id;

    // Create federated hub post
    const [post] = await db.insert(federatedHubPosts).values({
      federatedHubId,
      objectUri: `https://${REMOTE_DOMAIN}/notes/post-1`,
      actorUri: REMOTE_POST_ACTOR,
      content: 'A post from the remote hub',
      postType: 'text',
    }).returning();
    federatedHubPostId = post!.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a local reply and returns it with author info', async () => {
    const reply = await createFederatedHubPostReply(db, userId, {
      federatedHubPostId,
      content: 'Great post from the other instance!',
    });

    expect(reply.id).toBeDefined();
    expect(reply.federatedHubPostId).toBe(federatedHubPostId);
    expect(reply.content).toBe('Great post from the other instance!');
    expect(reply.author.username).toBe('localuser');
    expect(reply.parentId).toBeNull();
  });

  it('increments localReplyCount on the federated hub post', async () => {
    const [post] = await db
      .select({ localReplyCount: federatedHubPosts.localReplyCount })
      .from(federatedHubPosts)
      .where(eq(federatedHubPosts.id, federatedHubPostId));

    expect(post!.localReplyCount).toBe(1);
  });

  it('lists replies with author info and correct total', async () => {
    const result = await listFederatedHubPostReplies(db, federatedHubPostId);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.author.username).toBe('localuser');
    expect(result.items[0]!.content).toBe('Great post from the other instance!');
  });

  it('supports threaded replies with parentId', async () => {
    // Get the first reply
    const result = await listFederatedHubPostReplies(db, federatedHubPostId);
    const parentId = result.items[0]!.id;

    // Create a nested reply
    const child = await createFederatedHubPostReply(db, secondUserId, {
      federatedHubPostId,
      content: 'I agree with localuser!',
      parentId,
    });

    expect(child.parentId).toBe(parentId);
    expect(child.author.username).toBe('localuser2');

    // List should return the child nested under the parent
    const updated = await listFederatedHubPostReplies(db, federatedHubPostId);
    expect(updated.total).toBe(1); // Still 1 root
    expect(updated.items[0]!.replies).toHaveLength(1);
    expect(updated.items[0]!.replies![0]!.content).toBe('I agree with localuser!');
  });

  it('returns empty list for post with no replies', async () => {
    // Create another federated hub post with no replies
    const [post2] = await db.insert(federatedHubPosts).values({
      federatedHubId,
      objectUri: `https://${REMOTE_DOMAIN}/notes/post-2`,
      actorUri: REMOTE_POST_ACTOR,
      content: 'Another post with no replies',
      postType: 'text',
    }).returning();

    const result = await listFederatedHubPostReplies(db, post2!.id);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('increments localReplyCount for each reply', async () => {
    // We created 2 replies above (1 root + 1 nested)
    const [post] = await db
      .select({ localReplyCount: federatedHubPosts.localReplyCount })
      .from(federatedHubPosts)
      .where(eq(federatedHubPosts.id, federatedHubPostId));

    expect(post!.localReplyCount).toBe(2);
  });

  it('multiple users can reply independently', async () => {
    const reply = await createFederatedHubPostReply(db, secondUserId, {
      federatedHubPostId,
      content: 'Second user root reply',
    });

    expect(reply.author.username).toBe('localuser2');

    const result = await listFederatedHubPostReplies(db, federatedHubPostId);
    // Now 2 root replies (the original + this new one)
    expect(result.total).toBe(2);
  });

  it('respects pagination limit and offset', async () => {
    // With limit=1 we should get 1 root reply, total should still reflect all roots
    const page1 = await listFederatedHubPostReplies(db, federatedHubPostId, { limit: 1, offset: 0 });
    expect(page1.items).toHaveLength(1);
    expect(page1.total).toBe(2); // 2 root replies total

    const page2 = await listFederatedHubPostReplies(db, federatedHubPostId, { limit: 1, offset: 1 });
    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(2);

    // Different replies on each page
    expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
  });

  it('throws on reply to nonexistent federated hub post', async () => {
    const fakePostId = '00000000-0000-0000-0000-000000000000';
    await expect(
      createFederatedHubPostReply(db, userId, {
        federatedHubPostId: fakePostId,
        content: 'This should fail',
      }),
    ).rejects.toThrow();
  });
});
