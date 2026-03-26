/**
 * Remote actor search and profile integration tests.
 * Tests the searchRemoteActor and getRemoteActorProfile functions
 * that power the remote follow UI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getRemoteActorProfile,
  searchRemoteActor,
  sendFollow,
  acceptFollow,
  getOrCreateActorKeypair,
} from '../federation/federation.js';
import { remoteActors, followRelationships } from '@commonpub/schema';
import { and, eq } from 'drizzle-orm';

const DOMAIN = 'test.example.com';

describe('remote actor integration', () => {
  let db: DB;
  let userId: string;
  let username: string;

  const REMOTE_ACTOR_URI = 'https://remote.example.com/users/alice';
  const REMOTE_INBOX = 'https://remote.example.com/users/alice/inbox';

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'searchuser' });
    userId = user.id;
    username = user.username;
    await getOrCreateActorKeypair(db, userId);

    // Insert a mock remote actor with all fields populated
    await db.insert(remoteActors).values({
      actorUri: REMOTE_ACTOR_URI,
      inbox: REMOTE_INBOX,
      outbox: 'https://remote.example.com/users/alice/outbox',
      sharedInbox: 'https://remote.example.com/inbox',
      publicKeyPem: 'mock-public-key',
      preferredUsername: 'alice',
      displayName: 'Alice Remote',
      summary: '<p>A remote user for testing</p>',
      avatarUrl: 'https://remote.example.com/avatars/alice.png',
      bannerUrl: 'https://remote.example.com/banners/alice.png',
      instanceDomain: 'remote.example.com',
      followerCount: 42,
      followingCount: 13,
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('getRemoteActorProfile', () => {
    it('returns full profile for cached actor', async () => {
      const profile = await getRemoteActorProfile(db, REMOTE_ACTOR_URI);
      expect(profile).not.toBeNull();
      expect(profile!.actorUri).toBe(REMOTE_ACTOR_URI);
      expect(profile!.preferredUsername).toBe('alice');
      expect(profile!.displayName).toBe('Alice Remote');
      expect(profile!.summary).toBe('<p>A remote user for testing</p>');
      expect(profile!.avatarUrl).toBe('https://remote.example.com/avatars/alice.png');
      expect(profile!.bannerUrl).toBe('https://remote.example.com/banners/alice.png');
      expect(profile!.instanceDomain).toBe('remote.example.com');
      expect(profile!.followerCount).toBe(42);
      expect(profile!.followingCount).toBe(13);
    });

    it('returns null for non-existent actor', async () => {
      const profile = await getRemoteActorProfile(db, 'https://nonexistent.example.com/users/bob');
      expect(profile).toBeNull();
    });

    it('includes isFollowing=false when no follow exists', async () => {
      const profile = await getRemoteActorProfile(db, REMOTE_ACTOR_URI, DOMAIN, userId);
      expect(profile).not.toBeNull();
      expect(profile!.isFollowing).toBe(false);
      expect(profile!.isFollowPending).toBe(false);
    });

    it('includes isFollowPending=true after sending follow', async () => {
      // Create follow relationship
      await sendFollow(db, userId, REMOTE_ACTOR_URI, DOMAIN);

      const profile = await getRemoteActorProfile(db, REMOTE_ACTOR_URI, DOMAIN, userId);
      expect(profile).not.toBeNull();
      expect(profile!.isFollowPending).toBe(true);
      expect(profile!.isFollowing).toBe(false);
    });

    it('includes isFollowing=true after follow is accepted', async () => {
      // Find the pending follow relationship and accept it
      const localActorUri = `https://${DOMAIN}/users/${username}`;
      const rels = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, localActorUri),
            eq(followRelationships.followingActorUri, REMOTE_ACTOR_URI),
          ),
        )
        .limit(1);

      if (rels[0]) {
        await acceptFollow(db, rels[0].id, DOMAIN);
      }

      const profile = await getRemoteActorProfile(db, REMOTE_ACTOR_URI, DOMAIN, userId);
      expect(profile).not.toBeNull();
      expect(profile!.isFollowing).toBe(true);
      expect(profile!.isFollowPending).toBe(false);
    });

    it('does not leak follow status without localUserId', async () => {
      const profile = await getRemoteActorProfile(db, REMOTE_ACTOR_URI);
      expect(profile).not.toBeNull();
      expect(profile!.isFollowing).toBe(false);
      expect(profile!.isFollowPending).toBe(false);
    });
  });

  describe('searchRemoteActor input validation', () => {
    // Note: Full searchRemoteActor tests require HTTP mocking (WebFinger fetch).
    // Here we test the input parsing logic that happens before the fetch.
    // The actual search function is tested in the protocol package (actorResolver.test.ts).

    it('rejects queries without @ separator', async () => {
      const result = await searchRemoteActor(db, 'justausername', DOMAIN);
      expect(result).toBeNull();
    });

    it('rejects empty username', async () => {
      const result = await searchRemoteActor(db, '@remote.example.com', DOMAIN);
      expect(result).toBeNull();
    });

    it('rejects empty domain', async () => {
      const result = await searchRemoteActor(db, 'alice@', DOMAIN);
      expect(result).toBeNull();
    });

    it('rejects local domain lookups (prevents self-federation)', async () => {
      const result = await searchRemoteActor(db, `alice@${DOMAIN}`, DOMAIN);
      expect(result).toBeNull();
    });

    it('strips leading @ from handle', async () => {
      // This will fail on the WebFinger fetch (no real server)
      // but it shouldn't fail on parsing
      const result = await searchRemoteActor(db, '@alice@nonexistent.invalid', DOMAIN);
      // Returns null because fetch fails — but importantly didn't throw
      expect(result).toBeNull();
    });
  });
});
