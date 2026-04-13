/**
 * Two-Instance Federation E2E Test
 *
 * Simulates federation between Instance A (a.test) and Instance B (b.test)
 * using two separate PGlite databases and direct function calls.
 * No HTTP servers, no Docker, no ports — just business logic.
 *
 * Tests the complete federation round-trip:
 * 1. Follow → Accept lifecycle
 * 2. Publish → Create activity → content appears on remote
 * 3. Like on remote → Like activity → count incremented on source
 * 4. Update → content synced on remote
 * 5. Delete → content removed on remote
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, desc } from 'drizzle-orm';
import {
  activities,
  followRelationships,
  contentItems,
  federatedContent,
  remoteActors,
} from '@commonpub/schema';
import { processInboxActivity } from '@commonpub/protocol';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import {
  sendFollow,
  federateContent,
  federateUpdate,
  federateDelete,
  federateLike,
  getFollowers,
} from '../federation/federation.js';
import { createContent, publishContent } from '../content/content.js';

const DOMAIN_A = 'a.test';
const DOMAIN_B = 'b.test';

describe('two-instance federation E2E', () => {
  let dbA: DB;
  let dbB: DB;
  let aliceId: string;
  let bobId: string;
  let handlersA: ReturnType<typeof createInboxHandlers>;
  let handlersB: ReturnType<typeof createInboxHandlers>;

  /** Get the latest outbound activity payload from an instance's DB */
  async function getLatestOutbound(db: DB, type?: string) {
    const conditions = [
      eq(activities.direction, 'outbound'),
      eq(activities.status, 'pending'),
    ];
    if (type) conditions.push(eq(activities.type, type));
    const [row] = await db
      .select()
      .from(activities)
      .where(and(...conditions))
      .orderBy(desc(activities.createdAt))
      .limit(1);
    return row;
  }

  /** Seed a remote actor in a DB (simulates WebFinger resolution) */
  async function seedRemoteActor(db: DB, actorUri: string, domain: string) {
    await db.insert(remoteActors).values({
      actorUri,
      inbox: `${actorUri}/inbox`,
      instanceDomain: domain,
      preferredUsername: actorUri.split('/').pop() ?? 'unknown',
      displayName: actorUri.split('/').pop() ?? 'Unknown',
    }).onConflictDoNothing();
  }

  beforeAll(async () => {
    // Instance A: alice's home
    dbA = await createTestDB();
    const alice = await createTestUser(dbA, { username: 'alice' });
    aliceId = alice.id;
    handlersA = createInboxHandlers({ db: dbA, domain: DOMAIN_A });

    // Instance B: bob's home
    dbB = await createTestDB();
    const bob = await createTestUser(dbB, { username: 'bob' });
    bobId = bob.id;
    handlersB = createInboxHandlers({ db: dbB, domain: DOMAIN_B });

    // Pre-seed remote actors on both sides (skip WebFinger)
    await seedRemoteActor(dbA, `https://${DOMAIN_B}/users/bob`, DOMAIN_B);
    await seedRemoteActor(dbB, `https://${DOMAIN_A}/users/alice`, DOMAIN_A);
  });

  afterAll(async () => {
    await closeTestDB(dbA);
    await closeTestDB(dbB);
  });

  // ---- Test 1: Follow → Accept ----

  it('alice follows bob across instances', async () => {
    // Alice (on A) sends Follow to Bob (on B)
    const { id: followId } = await sendFollow(dbA, aliceId, `https://${DOMAIN_B}/users/bob`, DOMAIN_A);
    expect(followId).toBeDefined();

    // Get the Follow activity from A's outbox
    const followActivity = await getLatestOutbound(dbA, 'Follow');
    expect(followActivity).toBeDefined();

    // Simulate delivery: process Follow on B's inbox
    const result = await processInboxActivity(
      followActivity!.payload as Record<string, unknown>,
      handlersB,
    );
    expect(result.success).toBe(true);

    // Verify: B has a follow relationship from alice
    const [rel] = await dbB
      .select()
      .from(followRelationships)
      .where(eq(followRelationships.followerActorUri, `https://${DOMAIN_A}/users/alice`))
      .limit(1);
    expect(rel).toBeDefined();
    expect(rel!.status).toBe('accepted'); // auto-accept

    // B should have queued an Accept activity
    const acceptActivity = await getLatestOutbound(dbB, 'Accept');
    expect(acceptActivity).toBeDefined();

    // Simulate delivery: process Accept on A's inbox
    const acceptResult = await processInboxActivity(
      acceptActivity!.payload as Record<string, unknown>,
      handlersA,
    );
    expect(acceptResult.success).toBe(true);

    // Verify: A's follow is now accepted
    const [relA] = await dbA
      .select()
      .from(followRelationships)
      .where(eq(followRelationships.followingActorUri, `https://${DOMAIN_B}/users/bob`))
      .limit(1);
    expect(relA).toBeDefined();
    expect(relA!.status).toBe('accepted');
  });

  // ---- Test 2: Publish → Create → content on remote ----

  let contentId: string;
  let contentSlug: string;

  it('alice publishes content, bob receives via federation', async () => {
    // Alice creates and publishes content on A
    const content = await createContent(dbA, aliceId, {
      type: 'project',
      title: 'Arduino Weather Station',
      slug: 'arduino-weather-station',
      description: 'Build a weather station with Arduino',
      content: [['paragraph', { html: '<p>Step 1: Wire the sensors.</p>' }]],
    });
    contentId = content.id;
    contentSlug = content.slug;

    await publishContent(dbA, contentId, aliceId);

    // Trigger federation (normally called by the content publish hook)
    await federateContent(dbA, contentId, DOMAIN_A);

    // Get the Create activity from A's outbox
    const createActivity = await getLatestOutbound(dbA, 'Create');
    expect(createActivity).toBeDefined();

    const payload = createActivity!.payload as Record<string, unknown>;
    expect(payload.type).toBe('Create');

    // Simulate delivery: process Create on B's inbox
    const result = await processInboxActivity(payload, handlersB);
    expect(result.success).toBe(true);

    // Verify: B has the federated content
    const [fedContent] = await dbB
      .select()
      .from(federatedContent)
      .where(eq(federatedContent.objectUri, `https://${DOMAIN_A}/u/alice/project/${contentSlug}`))
      .limit(1);
    expect(fedContent).toBeDefined();
    expect(fedContent!.title).toBe('Arduino Weather Station');
    expect(fedContent!.actorUri).toBe(`https://${DOMAIN_A}/users/alice`);
    expect(fedContent!.originDomain).toBe(DOMAIN_A);
  });

  // ---- Test 3: Like on remote → propagated to source ----

  it('bob likes content on B, like propagated to A', async () => {
    // Get current like count on A
    const [beforeContent] = await dbA
      .select({ likeCount: contentItems.likeCount })
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);
    const beforeLikes = beforeContent!.likeCount;

    // Bob likes the federated content on B (simulated by creating a Like activity)
    // In real flow, this goes through /api/federation/like which calls federateLike
    // Here we build the Like activity manually
    const likePayload = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Like',
      actor: `https://${DOMAIN_B}/users/bob`,
      object: `https://${DOMAIN_A}/u/alice/project/${contentSlug}`,
    };

    // Simulate delivery: process Like on A's inbox
    const result = await processInboxActivity(likePayload, handlersA);
    expect(result.success).toBe(true);

    // Verify: A's content like count increased
    const [afterContent] = await dbA
      .select({ likeCount: contentItems.likeCount })
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);
    expect(afterContent!.likeCount).toBe(beforeLikes + 1);
  });

  // ---- Test 4: Update → synced on remote ----

  it('alice updates content, update received by bob', async () => {
    // Update the content on A (change title via direct DB update for simplicity)
    await dbA
      .update(contentItems)
      .set({ title: 'Arduino Weather Station v2' })
      .where(eq(contentItems.id, contentId));

    // Trigger Update federation
    await federateUpdate(dbA, contentId, DOMAIN_A);

    // Get Update activity
    const updateActivity = await getLatestOutbound(dbA, 'Update');
    expect(updateActivity).toBeDefined();

    // Simulate delivery to B
    const result = await processInboxActivity(
      updateActivity!.payload as Record<string, unknown>,
      handlersB,
    );
    expect(result.success).toBe(true);

    // Verify: B's federated content updated
    const [fedContent] = await dbB
      .select()
      .from(federatedContent)
      .where(eq(federatedContent.objectUri, `https://${DOMAIN_A}/u/alice/project/${contentSlug}`))
      .limit(1);
    expect(fedContent!.title).toBe('Arduino Weather Station v2');
  });

  // ---- Test 5: Delete → removed on remote ----

  it('alice deletes content, content removed from bob', async () => {
    // Get author username for the delete function
    const [user] = await dbA.select({ username: contentItems.slug }).from(contentItems).where(eq(contentItems.id, contentId)).limit(1);

    // Trigger Delete federation
    await federateDelete(dbA, contentId, DOMAIN_A, 'alice');

    // Get Delete activity
    const deleteActivity = await getLatestOutbound(dbA, 'Delete');
    expect(deleteActivity).toBeDefined();

    // Simulate delivery to B
    const result = await processInboxActivity(
      deleteActivity!.payload as Record<string, unknown>,
      handlersB,
    );
    expect(result.success).toBe(true);

    // Verify: B's federated content is soft-deleted
    const [fedContent] = await dbB
      .select()
      .from(federatedContent)
      .where(eq(federatedContent.objectUri, `https://${DOMAIN_A}/u/alice/project/${contentSlug}`))
      .limit(1);
    expect(fedContent!.deletedAt).toBeDefined();
    expect(fedContent!.deletedAt).not.toBeNull();
  });

  // ---- Test 6: Idempotency — duplicate Create doesn't duplicate content ----

  it('duplicate Create activity does not duplicate federated content', async () => {
    // Publish new content
    const content2 = await createContent(dbA, aliceId, {
      type: 'article',
      title: 'Test Idempotency',
      slug: 'test-idempotency',
    });
    await publishContent(dbA, content2.id, aliceId);
    await federateContent(dbA, content2.id, DOMAIN_A);

    const createActivity = await getLatestOutbound(dbA, 'Create');
    const payload = createActivity!.payload as Record<string, unknown>;

    // Deliver twice
    await processInboxActivity(payload, handlersB);
    await processInboxActivity(payload, handlersB);

    // Should only have one federated content row
    const rows = await dbB
      .select()
      .from(federatedContent)
      .where(eq(federatedContent.objectUri, `https://${DOMAIN_A}/u/alice/blog/test-idempotency`)); // article normalized to blog
    expect(rows.length).toBe(1);
  });

  // ---- Test 7: Loop prevention — content from own domain rejected ----

  it('loop prevention: content from own domain is rejected', async () => {
    // Simulate receiving a Create from a.test on a.test's own inbox
    const loopPayload = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      actor: `https://${DOMAIN_A}/users/alice`,
      object: {
        type: 'Article',
        id: `https://${DOMAIN_A}/content/loop-test`,
        attributedTo: `https://${DOMAIN_A}/users/alice`,
        name: 'Loop Test',
        content: '<p>Should not be stored</p>',
      },
    };

    await processInboxActivity(loopPayload, handlersA);

    // Should NOT be stored in federated_content (it's our own content)
    const rows = await dbA
      .select()
      .from(federatedContent)
      .where(eq(federatedContent.objectUri, `https://${DOMAIN_A}/content/loop-test`));
    expect(rows.length).toBe(0);
  });
});
