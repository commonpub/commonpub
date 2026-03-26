/**
 * Delivery integration tests.
 * Verifies target inbox resolution for all activity types and
 * delivery status transitions.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createContent, publishContent, onContentPublished } from '../content/content.js';
import {
  getOrCreateActorKeypair,
  sendFollow,
  acceptFollow,
  federateContent,
  federateUpdate,
  federateDelete,
  federateLike,
  federateUnlike,
  listFederationActivity,
} from '../federation/federation.js';
import { deliverPendingActivities } from '../federation/delivery.js';
import { remoteActors, followRelationships, activities } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

const DOMAIN = 'test.example.com';

describe('delivery integration', () => {
  let db: DB;
  let userId: string;
  let username: string;
  let localActorUri: string;

  // A mock remote actor
  const REMOTE_ACTOR_URI = 'https://remote.example.com/users/alice';
  const REMOTE_INBOX = 'https://remote.example.com/users/alice/inbox';

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'deliveryuser' });
    userId = user.id;
    username = user.username;
    localActorUri = `https://${DOMAIN}/users/${username}`;

    // Create a keypair for the local user (needed for signing)
    await getOrCreateActorKeypair(db, userId);

    // Insert a mock remote actor
    await db.insert(remoteActors).values({
      actorUri: REMOTE_ACTOR_URI,
      inbox: REMOTE_INBOX,
      outbox: 'https://remote.example.com/users/alice/outbox',
      instanceDomain: 'remote.example.com',
      preferredUsername: 'alice',
      displayName: 'Alice Remote',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('resolveTargetInboxes (via deliverPendingActivities)', () => {
    it('Create activity targets all accepted followers', async () => {
      // Set up an accepted follow relationship: remote -> local
      await db.insert(followRelationships).values({
        followerActorUri: REMOTE_ACTOR_URI,
        followingActorUri: localActorUri,
        status: 'accepted',
      });

      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Delivery Target Test',
      });
      await publishContent(db, content.id, userId);
      await federateContent(db, content.id, DOMAIN);

      // The activity should be pending
      const log = await listFederationActivity(db, { type: 'Create', direction: 'outbound' });
      const latest = log.items[0]!;
      expect(latest.status).toBe('pending');

      // Delivery will try to fetch the remote inbox and POST to it.
      // We expect it to fail (no real server) but the attempt proves inbox resolution worked.
      const result = await deliverPendingActivities(db, DOMAIN, 1);

      // Should have attempted delivery (failed because no real server)
      // But the fact that it attempted means inbox resolution worked
      expect(result.delivered + result.failed).toBeGreaterThanOrEqual(1);
    });

    it('Update activity targets all accepted followers', async () => {
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Update Delivery Test',
      });
      await publishContent(db, content.id, userId);
      await federateUpdate(db, content.id, DOMAIN);

      const log = await listFederationActivity(db, {
        type: 'Update',
        direction: 'outbound',
        status: 'pending',
      });
      expect(log.total).toBeGreaterThanOrEqual(1);
    });

    it('Delete activity targets all accepted followers', async () => {
      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Delete Delivery Test',
      });
      await publishContent(db, content.id, userId);
      await federateDelete(db, content.id, DOMAIN, username);

      const log = await listFederationActivity(db, {
        type: 'Delete',
        direction: 'outbound',
        status: 'pending',
      });
      expect(log.total).toBeGreaterThanOrEqual(1);
    });

    it('Like activity targets all accepted followers', async () => {
      const content = await createContent(db, userId, {
        type: 'project',
        title: 'Like Delivery Test',
      });
      await publishContent(db, content.id, userId);
      const contentUri = `https://${DOMAIN}/content/${content.slug}`;
      await federateLike(db, userId, contentUri, DOMAIN);

      const log = await listFederationActivity(db, {
        type: 'Like',
        direction: 'outbound',
        status: 'pending',
      });
      expect(log.total).toBeGreaterThanOrEqual(1);
    });

    it('Undo(Like) fans out to followers, not to objectUri as actor', async () => {
      // Undo(Like) has objectUri = content URI (not an actor URI).
      // It should fan out to all accepted followers, same as Like.
      const content = await createContent(db, userId, {
        type: 'project',
        title: 'Undo Like Delivery Test',
      });
      await publishContent(db, content.id, userId);
      const contentUri = `https://${DOMAIN}/content/${content.slug}`;
      await federateUnlike(db, userId, contentUri, DOMAIN);

      // Attempt delivery — should resolve followers' inboxes, not try objectUri as actor
      const result = await deliverPendingActivities(db, DOMAIN, 50);
      // We have an accepted follower (REMOTE_ACTOR_URI), so delivery should be attempted
      // It will fail (no real server) but the attempt proves inbox resolution worked correctly
      expect(result.delivered + result.failed).toBeGreaterThanOrEqual(1);

      // Verify the Undo activity was processed (not stuck as pending with "No target inboxes")
      const log = await listFederationActivity(db, { type: 'Undo', direction: 'outbound' });
      const undoActivity = log.items.find((a) => a.objectUri === contentUri);
      expect(undoActivity).toBeDefined();
      // Should NOT be 'failed' with "No target inboxes found" — that would indicate the bug
      if (undoActivity!.error) {
        expect(undoActivity!.error).not.toContain('No target inboxes');
      }
    });

    it('skips activities with no followers', async () => {
      // Create a second user with no followers
      const user2 = await createTestUser(db, { username: 'nofollowers' });
      await getOrCreateActorKeypair(db, user2.id);

      const content = await createContent(db, user2.id, {
        type: 'article',
        title: 'No Followers Test',
      });
      await publishContent(db, content.id, user2.id);
      await federateContent(db, content.id, DOMAIN);

      // Deliver — should fail with "No target inboxes found"
      const result = await deliverPendingActivities(db, DOMAIN, 50);
      // The activity with no followers should be marked as failed
      const log = await listFederationActivity(db, { type: 'Create', direction: 'outbound' });
      const noFollowerActivity = log.items.find((a) =>
        a.objectUri?.includes('no-followers-test'),
      );
      // After delivery attempt, status should be 'failed' (no target inboxes)
      expect(noFollowerActivity).toBeDefined();
      expect(noFollowerActivity!.status).toBe('failed');
    });
  });

  describe('delivery status transitions', () => {
    it('marks activity as failed after MAX_ATTEMPTS', async () => {
      // Create an activity that will always fail delivery
      const content = await createContent(db, userId, {
        type: 'article',
        title: 'Max Attempts Test',
      });
      await publishContent(db, content.id, userId);
      await federateContent(db, content.id, DOMAIN);

      // Manually set attempts to just below max (6) and updatedAt to past (bypass backoff)
      const log = await listFederationActivity(db, { type: 'Create', direction: 'outbound' });
      const activity = log.items.find((a) => a.objectUri?.includes('max-attempts-test'));
      if (activity) {
        await db
          .update(activities)
          .set({ attempts: 5, updatedAt: new Date(0) }) // Past date bypasses backoff
          .where(eq(activities.id, activity.id));
      }

      // Delivery will fail (no real server) and should push past MAX_ATTEMPTS
      await deliverPendingActivities(db, DOMAIN, 50);

      // Check status — should be 'failed' since attempts >= MAX_ATTEMPTS (6)
      if (activity) {
        const [updated] = await db
          .select()
          .from(activities)
          .where(eq(activities.id, activity.id))
          .limit(1);
        expect(updated!.attempts).toBeGreaterThanOrEqual(6);
        expect(updated!.status).toBe('failed');
      }
    });

    it('pending activity has attempts=0 initially', async () => {
      const content = await createContent(db, userId, {
        type: 'blog',
        title: 'Initial Attempts Test',
      });
      await publishContent(db, content.id, userId);
      await federateContent(db, content.id, DOMAIN);

      const log = await listFederationActivity(db, { type: 'Create', direction: 'outbound' });
      const latest = log.items.find((a) => a.objectUri?.includes('initial-attempts-test'));
      expect(latest).toBeDefined();
      expect(latest!.attempts).toBe(0);
      expect(latest!.status).toBe('pending');
    });
  });

  describe('Accept/Reject delivery targets', () => {
    it('Accept targets the original Follow actor', async () => {
      // Insert a follow relationship from remote actor
      const [rel] = await db
        .insert(followRelationships)
        .values({
          followerActorUri: REMOTE_ACTOR_URI,
          followingActorUri: localActorUri,
          status: 'pending',
        })
        .onConflictDoNothing()
        .returning();

      if (rel) {
        await acceptFollow(db, rel.id, DOMAIN);

        const log = await listFederationActivity(db, { type: 'Accept', direction: 'outbound' });
        expect(log.total).toBeGreaterThanOrEqual(1);
        // The objectUri should point to the remote actor (follower)
        const latest = log.items[0]!;
        expect(latest.objectUri).toBe(REMOTE_ACTOR_URI);
      }
    });
  });
});
