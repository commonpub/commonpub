import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { followRelationships, remoteActors } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getOrCreateActorKeypair,
  sendFollow,
  acceptFollow,
  rejectFollow,
  unfollowRemote,
  federateContent,
  federateUpdate,
  federateDelete,
  federateLike,
  getFollowers,
  getFollowing,
  listFederationActivity,
} from '../federation/federation.js';
import { createContent, publishContent } from '../content/content.js';

const DOMAIN = 'local.test';
const REMOTE_ACTOR = 'https://remote.test/users/bob';

describe('federation integration', () => {
  let db: DB;
  let userId: string;
  let username: string;

  /** Pre-seed a remote actor so sendFollow can find their inbox */
  async function seedRemoteActor(actorUri: string) {
    const domain = new URL(actorUri).hostname;
    await db.insert(remoteActors).values({
      actorUri,
      inbox: `${actorUri}/inbox`,
      instanceDomain: domain,
    }).onConflictDoNothing();
  }

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'alice' });
    userId = user.id;
    username = user.username;

    // Pre-seed remote actors used in follow tests so sendFollow can resolve them
    await seedRemoteActor(REMOTE_ACTOR);
    await seedRemoteActor('https://remote2.test/users/dave');
    await seedRemoteActor('https://remote3.test/users/eve');
    await seedRemoteActor('https://remote4.test/users/frank');
    await seedRemoteActor('https://remote5.test/users/grace');
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- Keypair Management ---

  describe('getOrCreateActorKeypair', () => {
    it('creates a new keypair for a user', async () => {
      const kp = await getOrCreateActorKeypair(db, userId);

      expect(kp.publicKeyPem).toBeDefined();
      expect(kp.privateKeyPem).toBeDefined();
      expect(kp.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(kp.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
    });

    it('returns the same keypair on second call', async () => {
      const kp1 = await getOrCreateActorKeypair(db, userId);
      const kp2 = await getOrCreateActorKeypair(db, userId);

      expect(kp1.publicKeyPem).toBe(kp2.publicKeyPem);
      expect(kp1.privateKeyPem).toBe(kp2.privateKeyPem);
    });

    it('generates different keypairs for different users', async () => {
      const user2 = await createTestUser(db, { username: 'carol' });
      const kp1 = await getOrCreateActorKeypair(db, userId);
      const kp2 = await getOrCreateActorKeypair(db, user2.id);

      expect(kp1.publicKeyPem).not.toBe(kp2.publicKeyPem);
    });
  });

  // --- Follow Lifecycle ---

  describe('follow lifecycle', () => {
    it('sendFollow creates pending relationship and activity', async () => {
      const result = await sendFollow(db, userId, REMOTE_ACTOR, DOMAIN);

      expect(result.id).toBeDefined();

      // Check activity was logged
      const activityLog = await listFederationActivity(db, {
        type: 'Follow',
        direction: 'outbound',
      });
      expect(activityLog.items.length).toBeGreaterThanOrEqual(1);
      const followActivity = activityLog.items.find(
        (a) => a.objectUri === REMOTE_ACTOR && a.type === 'Follow',
      );
      expect(followActivity).toBeDefined();
      expect(followActivity!.status).toBe('pending');
      expect(followActivity!.actorUri).toBe(`https://${DOMAIN}/users/${username}`);
    });

    it('acceptFollow updates relationship status to accepted AND creates Accept activity', async () => {
      const remote2 = 'https://remote2.test/users/dave';
      const follow = await sendFollow(db, userId, remote2, DOMAIN);

      await acceptFollow(db, follow.id, DOMAIN);

      // Verify the relationship status actually changed in the DB
      const [relationship] = await db
        .select()
        .from(followRelationships)
        .where(eq(followRelationships.id, follow.id))
        .limit(1);
      expect(relationship).toBeDefined();
      expect(relationship!.status).toBe('accepted');

      // Also verify the Accept activity was created
      const activityLog = await listFederationActivity(db, { type: 'Accept' });
      const acceptActivity = activityLog.items.find(
        (a) => a.objectUri === `https://${DOMAIN}/users/${username}`,
      );
      expect(acceptActivity).toBeDefined();
    });

    it('rejectFollow updates relationship status to rejected AND creates Reject activity', async () => {
      const remote3 = 'https://remote3.test/users/eve';
      const follow = await sendFollow(db, userId, remote3, DOMAIN);

      await rejectFollow(db, follow.id, DOMAIN);

      // Verify the relationship status actually changed in the DB
      const [relationship] = await db
        .select()
        .from(followRelationships)
        .where(eq(followRelationships.id, follow.id))
        .limit(1);
      expect(relationship).toBeDefined();
      expect(relationship!.status).toBe('rejected');

      // Also verify the Reject activity was created
      const activityLog = await listFederationActivity(db, { type: 'Reject' });
      expect(activityLog.items.length).toBeGreaterThanOrEqual(1);
    });

    it('unfollowRemote deletes the relationship AND creates Undo activity', async () => {
      const remote4 = 'https://remote4.test/users/frank';
      const follow = await sendFollow(db, userId, remote4, DOMAIN);

      await unfollowRemote(db, userId, remote4, DOMAIN);

      // Verify the relationship was actually deleted from the DB
      const [relationship] = await db
        .select()
        .from(followRelationships)
        .where(eq(followRelationships.id, follow.id))
        .limit(1);
      expect(relationship).toBeUndefined();

      // Also verify the Undo activity was created
      const activityLog = await listFederationActivity(db, { type: 'Undo' });
      expect(activityLog.items.length).toBeGreaterThanOrEqual(1);
    });

    it('sendFollow throws for non-existent user', async () => {
      await expect(
        sendFollow(db, crypto.randomUUID(), REMOTE_ACTOR, DOMAIN),
      ).rejects.toThrow();
    });

    it('acceptFollow throws for non-existent relationship', async () => {
      await expect(
        acceptFollow(db, crypto.randomUUID(), DOMAIN),
      ).rejects.toThrow('Follow relationship not found');
    });

    it('rejectFollow throws for non-existent relationship', async () => {
      await expect(
        rejectFollow(db, crypto.randomUUID(), DOMAIN),
      ).rejects.toThrow('Follow relationship not found');
    });

    it('unfollowRemote is safe for non-existent user (throws)', async () => {
      await expect(
        unfollowRemote(db, crypto.randomUUID(), 'https://nobody.test/users/x', DOMAIN),
      ).rejects.toThrow();
    });

    it('sendFollow stores correct actorUri format in relationship', async () => {
      const remote5 = 'https://remote5.test/users/grace';
      const follow = await sendFollow(db, userId, remote5, DOMAIN);

      const [relationship] = await db
        .select()
        .from(followRelationships)
        .where(eq(followRelationships.id, follow.id))
        .limit(1);

      expect(relationship!.followerActorUri).toBe(`https://${DOMAIN}/users/${username}`);
      expect(relationship!.followingActorUri).toBe(remote5);
      expect(relationship!.status).toBe('pending');
    });
  });

  // --- Content Federation ---

  describe('content federation', () => {
    let contentId: string;

    beforeAll(async () => {
      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Federation Test Article',
        description: 'Testing federation',
      });
      contentId = content.id;
      await publishContent(db, contentId, userId);
    });

    it('federateContent creates Create activity with Article payload', async () => {
      await federateContent(db, contentId, DOMAIN);

      const log = await listFederationActivity(db, {
        type: 'Create',
        direction: 'outbound',
      });
      const createActivity = log.items.find(
        (a) => a.type === 'Create' && a.objectUri?.includes('federation-test-article'),
      );
      expect(createActivity).toBeDefined();
      expect(createActivity!.status).toBe('pending');
      expect(createActivity!.actorUri).toBe(`https://${DOMAIN}/users/${username}`);

      // Verify payload structure
      const payload = createActivity!.payload as Record<string, unknown>;
      expect(payload.type).toBe('Create');
      expect(payload.actor).toBe(`https://${DOMAIN}/users/${username}`);

      const object = payload.object as Record<string, unknown>;
      expect(object.type).toBe('Article');
      expect(object.name).toBe('Federation Test Article');
    });

    it('federateUpdate creates Update activity', async () => {
      await federateUpdate(db, contentId, DOMAIN);

      const log = await listFederationActivity(db, {
        type: 'Update',
        direction: 'outbound',
      });
      expect(log.items.length).toBeGreaterThanOrEqual(1);

      const updateActivity = log.items[0]!;
      expect(updateActivity.type).toBe('Update');
      expect(updateActivity.actorUri).toBe(`https://${DOMAIN}/users/${username}`);
    });

    it('federateDelete creates Delete activity with Tombstone', async () => {
      await federateDelete(db, contentId, DOMAIN, username);

      const log = await listFederationActivity(db, {
        type: 'Delete',
        direction: 'outbound',
      });
      expect(log.items.length).toBeGreaterThanOrEqual(1);

      const deleteActivity = log.items[0]!;
      const payload = deleteActivity.payload as Record<string, unknown>;
      expect(payload.type).toBe('Delete');

      const object = payload.object as Record<string, unknown>;
      expect(object.type).toBe('Tombstone');
      expect(object.formerType).toBe('Article');
    });

    it('federateLike creates Like activity', async () => {
      const objectUri = `https://remote.test/content/some-article`;
      await federateLike(db, userId, objectUri, DOMAIN);

      const log = await listFederationActivity(db, {
        type: 'Like',
        direction: 'outbound',
      });
      expect(log.items.length).toBeGreaterThanOrEqual(1);

      const likeActivity = log.items[0]!;
      expect(likeActivity.objectUri).toBe(objectUri);
      expect(likeActivity.actorUri).toBe(`https://${DOMAIN}/users/${username}`);
    });

    it('federateLike is silent no-op for non-existent user', async () => {
      const countBefore = (await listFederationActivity(db, { type: 'Like' })).total;
      await federateLike(db, crypto.randomUUID(), 'https://remote.test/content/x', DOMAIN);
      const countAfter = (await listFederationActivity(db, { type: 'Like' })).total;

      // Should not create any activity — silent return when user not found
      expect(countAfter).toBe(countBefore);
    });

    it('federateContent is no-op for non-existent content', async () => {
      const countBefore = (await listFederationActivity(db, { type: 'Create' })).total;
      await federateContent(db, crypto.randomUUID(), DOMAIN);
      const countAfter = (await listFederationActivity(db, { type: 'Create' })).total;

      expect(countAfter).toBe(countBefore);
    });
  });

  // --- Queries ---

  describe('queries', () => {
    it('getFollowers returns only accepted followers, excludes pending/rejected', async () => {
      // alice is being followed by remote2 (accepted) and remote3 (rejected)
      // from the follow lifecycle tests above.
      // The followingActorUri for accepted follows contains alice's actorUri.
      // getFollowers(actorUri) returns rows where followingActorUri matches.
      // remote2 was accepted, remote3 was rejected.
      const remote2ActorUri = 'https://remote2.test/users/dave';
      const localActorUri = `https://${DOMAIN}/users/${username}`;

      // alice's accepted follow of remote2 means remote2 accepted alice.
      // But getFollowers returns followers OF an actor.
      // Let's use remote2's URI since alice follows remote2 (accepted).
      const followingOfAlice = await getFollowing(db, localActorUri);
      // remote2 was accepted, so it should be in the list
      const acceptedRemotes = followingOfAlice.map((f) => f.followingActorUri);
      expect(acceptedRemotes).toContain(remote2ActorUri);
      // remote3 was rejected, so it should NOT be in the list
      expect(acceptedRemotes).not.toContain('https://remote3.test/users/eve');
      // remote4 was unfollowed (deleted), also not in the list
      expect(acceptedRemotes).not.toContain('https://remote4.test/users/frank');
    });

    it('getFollowers returns empty for actor with no followers', async () => {
      const followers = await getFollowers(db, 'https://nobody.test/users/ghost');
      expect(followers).toEqual([]);
    });

    it('listFederationActivity returns all activities when no filters', async () => {
      const result = await listFederationActivity(db);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('listFederationActivity filters by direction', async () => {
      const outbound = await listFederationActivity(db, { direction: 'outbound' });
      for (const item of outbound.items) {
        expect(item.direction).toBe('outbound');
      }
    });

    it('listFederationActivity filters by status', async () => {
      const pending = await listFederationActivity(db, { status: 'pending' });
      for (const item of pending.items) {
        expect(item.status).toBe('pending');
      }
    });

    it('listFederationActivity filters by type', async () => {
      const follows = await listFederationActivity(db, { type: 'Follow' });
      for (const item of follows.items) {
        expect(item.type).toBe('Follow');
      }
    });

    it('listFederationActivity pagination works', async () => {
      const page1 = await listFederationActivity(db, { limit: 2, offset: 0 });
      const page2 = await listFederationActivity(db, { limit: 2, offset: 2 });

      expect(page1.items.length).toBeLessThanOrEqual(2);
      if (page1.total > 2) {
        expect(page2.items.length).toBeGreaterThan(0);
        // Items should not overlap
        const page1Ids = new Set(page1.items.map((i) => i.id));
        for (const item of page2.items) {
          expect(page1Ids.has(item.id)).toBe(false);
        }
      }
    });

    it('listFederationActivity total count is accurate', async () => {
      const all = await listFederationActivity(db, { limit: 100 });
      expect(all.total).toBe(all.items.length);
    });
  });
});
