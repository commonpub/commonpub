/**
 * Hub (Group) federation integration tests — FEP-1b12 compliance.
 * Tests hub actor creation, remote follow lifecycle, content Announce,
 * delivery routing, and anti-loop protections.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getOrCreateHubKeypair,
  buildHubGroupActor,
  getHubActorUri,
  handleHubFollow,
  handleHubUnfollow,
  getHubFederatedFollowers,
  federateHubPost,
  federateHubShare,
} from '../federation/hubFederation.js';
import { listFederationActivity } from '../federation/federation.js';
import { deliverPendingActivities } from '../federation/delivery.js';
import { hubs, hubMembers, hubPosts, hubFollowers, remoteActors } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';

const DOMAIN = 'hub-test.example.com';
const REMOTE_ACTOR = 'https://remote.example.com/users/alice';

describe('hub federation integration', () => {
  let db: DB;
  let userId: string;
  let hubId: string;
  let hubSlug: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'hubowner' });
    userId = user.id;

    // Create a hub
    const [hub] = await db.insert(hubs).values({
      name: 'Test Community',
      slug: 'test-community',
      description: 'A test hub for federation',
      hubType: 'community',
      privacy: 'public',
      joinPolicy: 'open',
      createdById: userId,
    }).returning();
    hubId = hub!.id;
    hubSlug = hub!.slug;

    // Add owner as member
    await db.insert(hubMembers).values({
      hubId,
      userId,
      role: 'owner',
    });

    // Pre-populate remote actor
    await db.insert(remoteActors).values({
      actorUri: REMOTE_ACTOR,
      inbox: 'https://remote.example.com/users/alice/inbox',
      sharedInbox: 'https://remote.example.com/inbox',
      instanceDomain: 'remote.example.com',
      preferredUsername: 'alice',
      displayName: 'Alice Remote',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('hub actor', () => {
    it('generates and caches a hub keypair', async () => {
      const kp1 = await getOrCreateHubKeypair(db, hubId);
      expect(kp1.publicKeyPem).toContain('BEGIN PUBLIC KEY');
      expect(kp1.privateKeyPem).toContain('BEGIN PRIVATE KEY');

      // Cached on second call
      const kp2 = await getOrCreateHubKeypair(db, hubId);
      expect(kp2.publicKeyPem).toBe(kp1.publicKeyPem);
    });

    it('builds a valid AP Group actor', async () => {
      const actor = await buildHubGroupActor(db, hubSlug, DOMAIN);
      expect(actor).not.toBeNull();
      expect(actor!.type).toBe('Group');
      expect(actor!.id).toBe(`https://${DOMAIN}/hubs/${hubSlug}`);
      expect(actor!.preferredUsername).toBe(hubSlug);
      expect(actor!.name).toBe('Test Community');
      expect(actor!.inbox).toBe(`https://${DOMAIN}/hubs/${hubSlug}/inbox`);
      expect(actor!.outbox).toBe(`https://${DOMAIN}/hubs/${hubSlug}/outbox`);
      expect(actor!.followers).toBe(`https://${DOMAIN}/hubs/${hubSlug}/followers`);
      expect(actor!.publicKey).toBeDefined();
      expect(actor!.publicKey!.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    });

    it('returns null for non-existent hub', async () => {
      const actor = await buildHubGroupActor(db, 'nonexistent', DOMAIN);
      expect(actor).toBeNull();
    });

    it('getHubActorUri constructs correct URI', () => {
      expect(getHubActorUri(DOMAIN, 'my-hub')).toBe(`https://${DOMAIN}/hubs/my-hub`);
    });
  });

  describe('hub follow lifecycle', () => {
    it('accepts Follow for public open hub', async () => {
      await handleHubFollow(db, hubSlug, REMOTE_ACTOR, 'follow-hub-activity-1', DOMAIN);

      const followers = await getHubFederatedFollowers(db, hubId);
      expect(followers.length).toBe(1);
      expect(followers[0]!.followerActorUri).toBe(REMOTE_ACTOR);

      // Should have queued an Accept activity
      const log = await listFederationActivity(db, { type: 'Accept', direction: 'outbound' });
      const accept = log.items.find((a) => a.objectUri === REMOTE_ACTOR);
      expect(accept).toBeDefined();
    });

    it('handles duplicate Follow (idempotent)', async () => {
      await handleHubFollow(db, hubSlug, REMOTE_ACTOR, 'follow-hub-activity-2', DOMAIN);
      const followers = await getHubFederatedFollowers(db, hubId);
      expect(followers.length).toBe(1); // Still 1, not duplicated
    });

    it('handles Undo(Follow) with activityUri', async () => {
      await handleHubUnfollow(db, hubSlug, REMOTE_ACTOR, 'follow-hub-activity-2');
      const followers = await getHubFederatedFollowers(db, hubId);
      expect(followers.length).toBe(0);
    });

    it('handles Undo(Follow) without activityUri (fallback)', async () => {
      // Re-follow
      await handleHubFollow(db, hubSlug, REMOTE_ACTOR, 'follow-hub-activity-3', DOMAIN);
      expect((await getHubFederatedFollowers(db, hubId)).length).toBe(1);

      // Undo without activity URI
      await handleHubUnfollow(db, hubSlug, REMOTE_ACTOR);
      expect((await getHubFederatedFollowers(db, hubId)).length).toBe(0);
    });
  });

  describe('hub content federation (Announce)', () => {
    beforeAll(async () => {
      // Re-establish follower for content tests
      await handleHubFollow(db, hubSlug, REMOTE_ACTOR, 'follow-hub-content-test', DOMAIN);
    });

    it('federateHubPost creates outbound Announce from Group actor', async () => {
      // Create a hub post
      const [post] = await db.insert(hubPosts).values({
        hubId,
        authorId: userId,
        type: 'text',
        content: 'Hello from the hub!',
      }).returning();

      const beforeAnnounce = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;

      await federateHubPost(db, post!.id, hubId, DOMAIN);

      const afterAnnounce = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;
      expect(afterAnnounce).toBe(beforeAnnounce + 1);

      // Verify the Announce is from the hub actor, not the user
      const log = await listFederationActivity(db, { type: 'Announce', direction: 'outbound' });
      const announce = log.items[0]!;
      expect(announce.actorUri).toBe(getHubActorUri(DOMAIN, hubSlug));
    });

    it('federateHubShare creates Announce for shared content', async () => {
      const contentUri = `https://${DOMAIN}/content/some-shared-project`;

      const beforeAnnounce = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;

      await federateHubShare(db, contentUri, hubId, DOMAIN);

      const afterAnnounce = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;
      expect(afterAnnounce).toBe(beforeAnnounce + 1);

      const log = await listFederationActivity(db, { type: 'Announce', direction: 'outbound' });
      expect(log.items[0]!.objectUri).toBe(contentUri);
      expect(log.items[0]!.actorUri).toBe(getHubActorUri(DOMAIN, hubSlug));
    });

    it('delivery resolves hub followers for Announce', async () => {
      // Attempt delivery — should resolve the hub's followers
      const result = await deliverPendingActivities(db, DOMAIN, 50);
      // Will fail (no real server) but should have attempted delivery
      expect(result.delivered + result.failed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('anti-loop', () => {
    it('inbound Announce from remote hub does NOT re-announce', async () => {
      const { createInboxHandlers } = await import('../federation/inboxHandlers.js');
      const handlers = createInboxHandlers({ db, domain: DOMAIN, autoAcceptFollows: true });

      const beforeOutbound = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;

      // Simulate inbound Announce from a remote Group actor
      await handlers.onAnnounce(
        'https://remote.example.com/hubs/remote-community',
        `https://${DOMAIN}/content/some-local-content`,
      );

      const afterOutbound = (
        await listFederationActivity(db, { type: 'Announce', direction: 'outbound' })
      ).total;
      // No new outbound Announce should be created
      expect(afterOutbound).toBe(beforeOutbound);
    });
  });
});
