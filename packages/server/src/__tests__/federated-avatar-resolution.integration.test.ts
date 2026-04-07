/**
 * Integration tests for federated avatar resolution via LEFT JOIN on remoteActors.
 *
 * Bug 3: hubPostReplies and hubPosts store remoteActorUri + remoteActorName but
 * not avatarUrl. The remoteActors table caches avatarUrl. The fix LEFT JOINs
 * remoteActors in listReplies/listPosts/getPostById to resolve avatars.
 *
 * Tests:
 * - listReplies returns remoteActorAvatarUrl for federated replies
 * - listPosts returns remoteActorAvatarUrl for federated posts
 * - getPostById returns remoteActorAvatarUrl for federated post
 * - Null avatar when remote actor has no cached avatar
 * - Null avatar when no matching remote actor exists
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  hubs,
  hubMembers,
  hubPosts,
  hubPostReplies,
  remoteActors,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { listReplies, listPosts, getPostById } from '../hub/posts.js';

const REMOTE_DOMAIN = 'avatar-test.example.com';
const REMOTE_ACTOR_WITH_AVATAR = `https://${REMOTE_DOMAIN}/users/has-avatar`;
const REMOTE_ACTOR_NO_AVATAR = `https://${REMOTE_DOMAIN}/users/no-avatar`;
const REMOTE_ACTOR_UNKNOWN = `https://${REMOTE_DOMAIN}/users/unknown-actor`;

describe('federated avatar resolution', () => {
  let db: DB;
  let userId: string;
  let hubId: string;
  let postId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'avatarmod' });
    userId = user.id;

    // Create hub
    const [hub] = await db.insert(hubs).values({
      name: 'Avatar Test Hub',
      slug: 'avatar-test-hub',
      createdById: userId,
    }).returning();
    hubId = hub!.id;

    await db.insert(hubMembers).values({ hubId, userId, role: 'owner' });

    // Create remote actors — one with avatar, one without
    await db.insert(remoteActors).values({
      actorUri: REMOTE_ACTOR_WITH_AVATAR,
      inbox: `${REMOTE_ACTOR_WITH_AVATAR}/inbox`,
      instanceDomain: REMOTE_DOMAIN,
      preferredUsername: 'has-avatar',
      displayName: 'Has Avatar',
      avatarUrl: 'https://avatar-test.example.com/avatars/user.png',
    });

    await db.insert(remoteActors).values({
      actorUri: REMOTE_ACTOR_NO_AVATAR,
      inbox: `${REMOTE_ACTOR_NO_AVATAR}/inbox`,
      instanceDomain: REMOTE_DOMAIN,
      preferredUsername: 'no-avatar',
      displayName: 'No Avatar',
      avatarUrl: null,
    });

    // Create a local post
    const [post] = await db.insert(hubPosts).values({
      hubId,
      authorId: userId,
      type: 'text',
      content: 'Post for avatar tests',
    }).returning();
    postId = post!.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('listReplies avatar resolution', () => {
    it('returns avatarUrl for federated reply with cached avatar', async () => {
      await db.insert(hubPostReplies).values({
        postId,
        authorId: null,
        content: 'Reply from user with avatar',
        remoteActorUri: REMOTE_ACTOR_WITH_AVATAR,
        remoteActorName: 'Has Avatar',
      });

      const result = await listReplies(db, postId);
      const fedReply = result.items.find(r => r.remoteActorUri === REMOTE_ACTOR_WITH_AVATAR);

      expect(fedReply).toBeDefined();
      expect(fedReply!.remoteActorAvatarUrl).toBe('https://avatar-test.example.com/avatars/user.png');
    });

    it('returns null avatarUrl for federated reply without cached avatar', async () => {
      await db.insert(hubPostReplies).values({
        postId,
        authorId: null,
        content: 'Reply from user without avatar',
        remoteActorUri: REMOTE_ACTOR_NO_AVATAR,
        remoteActorName: 'No Avatar',
      });

      const result = await listReplies(db, postId);
      const fedReply = result.items.find(r => r.remoteActorUri === REMOTE_ACTOR_NO_AVATAR);

      expect(fedReply).toBeDefined();
      expect(fedReply!.remoteActorAvatarUrl).toBeNull();
    });

    it('returns null avatarUrl when no matching remote actor exists', async () => {
      await db.insert(hubPostReplies).values({
        postId,
        authorId: null,
        content: 'Reply from unknown actor',
        remoteActorUri: REMOTE_ACTOR_UNKNOWN,
        remoteActorName: 'Unknown',
      });

      const result = await listReplies(db, postId);
      const fedReply = result.items.find(r => r.remoteActorUri === REMOTE_ACTOR_UNKNOWN);

      expect(fedReply).toBeDefined();
      expect(fedReply!.remoteActorAvatarUrl).toBeNull();
    });
  });

  describe('listPosts avatar resolution', () => {
    it('returns avatarUrl for federated post with cached avatar', async () => {
      await db.insert(hubPosts).values({
        hubId,
        authorId: null,
        type: 'text',
        content: 'Remote post with avatar',
        remoteActorUri: REMOTE_ACTOR_WITH_AVATAR,
        remoteActorName: 'Has Avatar',
      });

      const result = await listPosts(db, hubId);
      const fedPost = result.items.find(p => p.remoteActorUri === REMOTE_ACTOR_WITH_AVATAR);

      expect(fedPost).toBeDefined();
      expect(fedPost!.remoteActorAvatarUrl).toBe('https://avatar-test.example.com/avatars/user.png');
    });

    it('returns null avatarUrl for local posts', async () => {
      const result = await listPosts(db, hubId);
      const localPost = result.items.find(p => p.author?.username === 'avatarmod');

      expect(localPost).toBeDefined();
      expect(localPost!.remoteActorAvatarUrl).toBeNull();
    });
  });

  describe('getPostById avatar resolution', () => {
    it('returns avatarUrl for federated post', async () => {
      const result = await listPosts(db, hubId);
      const fedPost = result.items.find(p => p.remoteActorUri === REMOTE_ACTOR_WITH_AVATAR);

      const post = await getPostById(db, fedPost!.id);
      expect(post).not.toBeNull();
      expect(post!.remoteActorAvatarUrl).toBe('https://avatar-test.example.com/avatars/user.png');
    });
  });
});
