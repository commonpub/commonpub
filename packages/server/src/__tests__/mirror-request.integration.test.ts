/**
 * Consent-based mirror request (Phase 3) — unit + two-instance E2E.
 *
 * "Push" = instance A asks instance B to pull-mirror A. A sends a signed Offer(Follow); B's admin
 * approves (→ B creates a pull mirror of A + Accept(Offer)) or rejects (→ Reject(Offer)).
 *
 * Uses two separate PGlite databases + direct function calls (no HTTP), mirroring
 * `two-instance-federation.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, desc } from 'drizzle-orm';
import {
  activities,
  mirrorRequests,
  instanceMirrors,
  followRelationships,
  federatedContent,
  remoteActors,
} from '@commonpub/schema';
import { processInboxActivity } from '@commonpub/protocol';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { createInboxHandlers } from '../federation/inboxHandlers.js';
import {
  requestMirror,
  listMirrorRequests,
  approveMirrorRequest,
  rejectMirrorRequest,
  createMirror,
  pauseMirror,
} from '../federation/mirroring.js';
import { federateContent } from '../federation/federation.js';
import { createContent, publishContent } from '../content/content.js';

const DOMAIN_A = 'a.test'; // requester (wants to be mirrored)
const DOMAIN_B = 'b.test'; // approver

const A_ACTOR = `https://${DOMAIN_A}/actor`;
const B_ACTOR = `https://${DOMAIN_B}/actor`;

/** Latest pending outbound activity of a type from a DB. */
async function getLatestOutbound(db: DB, type: string) {
  const [row] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.direction, 'outbound'), eq(activities.status, 'pending'), eq(activities.type, type)))
    .orderBy(desc(activities.createdAt))
    .limit(1);
  return row;
}

/** Seed a remote instance Service actor (simulates WebFinger/actor resolution). */
async function seedRemoteActor(db: DB, actorUri: string, domain: string) {
  await db.insert(remoteActors).values({
    actorUri,
    inbox: `${actorUri}/inbox`,
    instanceDomain: domain,
    actorType: 'Service',
    preferredUsername: 'instance',
  }).onConflictDoNothing();
}

describe('mirror request (push) unit behaviour', () => {
  let db: DB;
  beforeAll(async () => {
    db = await createTestDB();
    await seedRemoteActor(db, B_ACTOR, DOMAIN_B);
  });
  afterAll(async () => { await closeTestDB(db); });

  it('requestMirror creates an outgoing request and queues an Offer (not a Follow)', async () => {
    const req = await requestMirror(db, DOMAIN_B, B_ACTOR, DOMAIN_A);
    expect(req.direction).toBe('outgoing');
    expect(req.status).toBe('pending');
    expect(req.remoteDomain).toBe(DOMAIN_B);
    expect(req.offerActivityUri).toBeTruthy();

    const offer = await getLatestOutbound(db, 'Offer');
    expect(offer).toBeDefined();
    expect((offer!.payload as Record<string, unknown>)['cpub:mirrorRequest']).toBe(true);
    expect(offer!.objectUri).toBe(B_ACTOR);

    // No Follow is queued — push is consent-based, not a direct subscription.
    const follow = await getLatestOutbound(db, 'Follow');
    expect(follow).toBeUndefined();

    // No instance_mirrors row was created for push.
    const mirrors = await db.select().from(instanceMirrors).where(eq(instanceMirrors.remoteDomain, DOMAIN_B));
    expect(mirrors).toHaveLength(0);
  });

  it('re-requesting the same domain resets the row to pending (idempotent upsert)', async () => {
    const first = await listMirrorRequests(db, 'outgoing');
    const second = await requestMirror(db, DOMAIN_B, B_ACTOR, DOMAIN_A);
    const all = await listMirrorRequests(db, 'outgoing');
    expect(all).toHaveLength(first.length); // no duplicate
    expect(second.status).toBe('pending');
  });

  it('createMirror rejects a push direction (must use requestMirror)', async () => {
    await expect(createMirror(db, DOMAIN_B, B_ACTOR, 'push', DOMAIN_A)).rejects.toThrow(/requestMirror/);
  });
});

describe('mirror request two-instance E2E (request → approve → bounded pull → content)', () => {
  let dbA: DB; // requester
  let dbB: DB; // approver
  let aliceId: string;
  let handlersA: ReturnType<typeof createInboxHandlers>;
  let handlersB: ReturnType<typeof createInboxHandlers>;

  beforeAll(async () => {
    dbA = await createTestDB();
    const alice = await createTestUser(dbA, { username: 'alice' });
    aliceId = alice.id;
    handlersA = createInboxHandlers({ db: dbA, domain: DOMAIN_A });

    dbB = await createTestDB();
    await createTestUser(dbB, { username: 'badmin', role: 'admin' });
    handlersB = createInboxHandlers({ db: dbB, domain: DOMAIN_B });

    // Each side knows the other's instance actor (skip WebFinger).
    await seedRemoteActor(dbA, B_ACTOR, DOMAIN_B);
    await seedRemoteActor(dbB, A_ACTOR, DOMAIN_A);
  });

  afterAll(async () => {
    await closeTestDB(dbA);
    await closeTestDB(dbB);
  });

  it('A requests B to mirror it; B stores a pending incoming request', async () => {
    await requestMirror(dbA, DOMAIN_B, B_ACTOR, DOMAIN_A);
    const offer = await getLatestOutbound(dbA, 'Offer');
    expect(offer).toBeDefined();

    // Deliver the Offer to B's inbox.
    const result = await processInboxActivity(offer!.payload as Record<string, unknown>, handlersB);
    expect(result.success).toBe(true);

    const incoming = await listMirrorRequests(dbB, 'incoming');
    expect(incoming).toHaveLength(1);
    expect(incoming[0]!.remoteDomain).toBe(DOMAIN_A);
    expect(incoming[0]!.status).toBe('pending');
  });

  it('loop guard: B ignores an Offer that claims to originate from B itself', async () => {
    const before = (await listMirrorRequests(dbB, 'incoming')).length;
    await handlersB.onMirrorRequest!(B_ACTOR, B_ACTOR, 'https://b.test/activities/self-offer');
    const after = (await listMirrorRequests(dbB, 'incoming')).length;
    expect(after).toBe(before);
  });

  it('B approves: pull mirror of A created, Accept(Offer) queued, request approved', async () => {
    const [req] = await listMirrorRequests(dbB, 'incoming');
    const offerUri = req!.offerActivityUri;
    const approved = await approveMirrorRequest(dbB, req!.id, DOMAIN_B, { filterContentTypes: ['project', 'blog'] });
    expect(approved.status).toBe('approved');
    expect(approved.resultingMirrorId).toBeTruthy();

    // A pull mirror of a.test now exists on B, with B's chosen filters.
    const [mirror] = await dbB.select().from(instanceMirrors).where(eq(instanceMirrors.remoteDomain, DOMAIN_A));
    expect(mirror).toBeDefined();
    expect(mirror!.direction).toBe('pull');
    expect(mirror!.filterContentTypes).toEqual(['project', 'blog']);

    // B queued a Follow (the real subscription, to A's actor) and an Accept whose object is the
    // exact Offer id (so A can correlate it back) addressed to A's actor.
    const follow = await getLatestOutbound(dbB, 'Follow');
    expect(follow!.objectUri).toBe(A_ACTOR);
    const accept = await getLatestOutbound(dbB, 'Accept');
    expect(accept!.objectUri).toBe(A_ACTOR);
    expect((accept!.payload as Record<string, unknown>).object).toBe(offerUri);
  });

  it('A receives B’s Follow + Accept(Offer): B enters A’s followers, request flips approved', async () => {
    const follow = await getLatestOutbound(dbB, 'Follow');
    const followRes = await processInboxActivity(follow!.payload as Record<string, unknown>, handlersA);
    expect(followRes.success).toBe(true);

    // B (instance actor) is now an accepted follower of A → A's "instances mirroring you".
    const [rel] = await dbA
      .select()
      .from(followRelationships)
      .where(and(eq(followRelationships.followerActorUri, B_ACTOR), eq(followRelationships.followingActorUri, A_ACTOR)))
      .limit(1);
    expect(rel).toBeDefined();
    expect(rel!.status).toBe('accepted');

    const accept = await getLatestOutbound(dbB, 'Accept');
    const acceptRes = await processInboxActivity(accept!.payload as Record<string, unknown>, handlersA);
    expect(acceptRes.success).toBe(true);

    const [outgoing] = await listMirrorRequests(dbA, 'outgoing');
    expect(outgoing!.status).toBe('approved');
  });

  it('content flows: alice publishes, B ingests via the approval-created pull mirror', async () => {
    const content = await createContent(dbA, aliceId, {
      type: 'project',
      title: 'Mirror Me Project',
      slug: 'mirror-me-project',
      description: 'A project for mirror-request E2E',
      content: [['paragraph', { html: '<p>Hello mirror.</p>' }]],
    });
    await publishContent(dbA, content.id, aliceId);
    await federateContent(dbA, content.id, DOMAIN_A);

    const create = await getLatestOutbound(dbA, 'Create');
    const res = await processInboxActivity(create!.payload as Record<string, unknown>, handlersB);
    expect(res.success).toBe(true);

    const [fed] = await dbB
      .select()
      .from(federatedContent)
      .where(eq(federatedContent.objectUri, `https://${DOMAIN_A}/u/alice/project/mirror-me-project`))
      .limit(1);
    expect(fed).toBeDefined();
    expect(fed!.title).toBe('Mirror Me Project');
    // Ingested under the mirror created by the approval.
    expect(fed!.mirrorId).not.toBeNull();
  });

  it('no Follow loop: A does not auto-create a reverse subscription to B', async () => {
    // A only has the outgoing request (and B as a follower); A never followed B's content.
    const aToB = await dbA
      .select()
      .from(followRelationships)
      .where(and(eq(followRelationships.followerActorUri, A_ACTOR), eq(followRelationships.followingActorUri, B_ACTOR)));
    expect(aToB).toHaveLength(0);
  });
});

describe('mirror request rejection', () => {
  let dbB: DB;
  let handlersB: ReturnType<typeof createInboxHandlers>;

  beforeAll(async () => {
    dbB = await createTestDB();
    handlersB = createInboxHandlers({ db: dbB, domain: DOMAIN_B });
    await seedRemoteActor(dbB, A_ACTOR, DOMAIN_A);
    await handlersB.onMirrorRequest!(A_ACTOR, B_ACTOR, 'https://a.test/activities/offer-rej');
  });
  afterAll(async () => { await closeTestDB(dbB); });

  it('rejectMirrorRequest queues Reject(Offer), marks rejected, creates no mirror', async () => {
    const [req] = await listMirrorRequests(dbB, 'incoming');
    const rejected = await rejectMirrorRequest(dbB, req!.id, DOMAIN_B);
    expect(rejected.status).toBe('rejected');

    expect(await getLatestOutbound(dbB, 'Reject')).toBeDefined();
    const mirrors = await dbB.select().from(instanceMirrors).where(eq(instanceMirrors.remoteDomain, DOMAIN_A));
    expect(mirrors).toHaveLength(0);
  });

  it('onReject on the requester side flips the outgoing request to rejected', async () => {
    const dbA = await createTestDB();
    const handlersA = createInboxHandlers({ db: dbA, domain: DOMAIN_A });
    await seedRemoteActor(dbA, B_ACTOR, DOMAIN_B);
    const req = await requestMirror(dbA, DOMAIN_B, B_ACTOR, DOMAIN_A);

    // B's Reject(Offer) references the offer id.
    await processInboxActivity(
      { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Reject', actor: B_ACTOR, object: req.offerActivityUri },
      handlersA,
    );
    const [outgoing] = await listMirrorRequests(dbA, 'outgoing');
    expect(outgoing!.status).toBe('rejected');
    await closeTestDB(dbA);
  });
});

describe('mirror request guards & correlation', () => {
  const C_DOMAIN = 'c.test';
  const C_ACTOR = `https://${C_DOMAIN}/actor`;

  it('ignores an Offer targeting a USER actor (instance-level only)', async () => {
    const db = await createTestDB();
    const handlers = createInboxHandlers({ db, domain: DOMAIN_B });
    await seedRemoteActor(db, A_ACTOR, DOMAIN_A);
    // Target is a user actor, not https://b.test/actor → must be ignored.
    await handlers.onMirrorRequest!(A_ACTOR, `https://${DOMAIN_B}/users/alice`, 'https://a.test/activities/offer-u');
    expect(await listMirrorRequests(db, 'incoming')).toHaveLength(0);
    // Sanity: a correctly-targeted request from the same requester IS stored.
    await handlers.onMirrorRequest!(A_ACTOR, B_ACTOR, 'https://a.test/activities/offer-ok');
    expect(await listMirrorRequests(db, 'incoming')).toHaveLength(1);
    await closeTestDB(db);
  });

  it('the Offer dispatch rejects an Offer with no id (no correlation key)', async () => {
    const handlers = createInboxHandlers({ db: await createTestDB(), domain: DOMAIN_B });
    const result = await processInboxActivity(
      {
        type: 'Offer',
        actor: A_ACTOR,
        'cpub:mirrorRequest': true,
        object: { type: 'Follow', actor: B_ACTOR, object: A_ACTOR },
      },
      handlers,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('id');
  });

  it('a forged Accept (right offer id, WRONG sender) does NOT flip the request', async () => {
    const dbA = await createTestDB();
    const handlersA = createInboxHandlers({ db: dbA, domain: DOMAIN_A });
    await seedRemoteActor(dbA, B_ACTOR, DOMAIN_B);
    await seedRemoteActor(dbA, C_ACTOR, C_DOMAIN);
    const req = await requestMirror(dbA, DOMAIN_B, B_ACTOR, DOMAIN_A);

    // Some other instance (C) sends an Accept carrying B's offer id — must be ignored.
    await processInboxActivity(
      { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Accept', actor: C_ACTOR, object: req.offerActivityUri },
      handlersA,
    );
    expect((await listMirrorRequests(dbA, 'outgoing'))[0]!.status).toBe('pending');

    // The real target (B) accepting the same offer DOES flip it.
    await processInboxActivity(
      { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Accept', actor: B_ACTOR, object: req.offerActivityUri },
      handlersA,
    );
    expect((await listMirrorRequests(dbA, 'outgoing'))[0]!.status).toBe('approved');
    await closeTestDB(dbA);
  });

  it('approving a request for a domain with a PAUSED mirror re-activates it + applies filters + re-follows', async () => {
    const dbB = await createTestDB();
    const handlersB = createInboxHandlers({ db: dbB, domain: DOMAIN_B });
    await seedRemoteActor(dbB, A_ACTOR, DOMAIN_A);

    // B already has a pull mirror of A, but it's PAUSED (and the follow never got accepted).
    const mirror = await createMirror(dbB, DOMAIN_A, A_ACTOR, 'pull', DOMAIN_B, { contentTypes: ['blog'] });
    await pauseMirror(dbB, mirror.id);

    // A requests; B approves with different filters.
    await handlersB.onMirrorRequest!(A_ACTOR, B_ACTOR, 'https://a.test/activities/offer-reuse');
    const [req] = await listMirrorRequests(dbB, 'incoming');
    const approved = await approveMirrorRequest(dbB, req!.id, DOMAIN_B, { filterContentTypes: ['project', 'explainer'] });

    expect(approved.resultingMirrorId).toBe(mirror.id); // reused, not duplicated
    const [row] = await dbB.select().from(instanceMirrors).where(eq(instanceMirrors.remoteDomain, DOMAIN_A));
    expect(row!.status).toBe('active'); // re-activated (matchMirrorForContent requires active)
    expect(row!.filterContentTypes).toEqual(['project', 'explainer']); // approver's filters applied
    // Exactly one mirror row for the domain (no duplicate).
    const all = await dbB.select().from(instanceMirrors).where(eq(instanceMirrors.remoteDomain, DOMAIN_A));
    expect(all).toHaveLength(1);
    await closeTestDB(dbB);
  });

  it('approve treats filters as authoritative on reuse — approving with none clears to all-types', async () => {
    const dbB = await createTestDB();
    const handlersB = createInboxHandlers({ db: dbB, domain: DOMAIN_B });
    await seedRemoteActor(dbB, A_ACTOR, DOMAIN_A);
    // Existing mirror restricted to 'blog'.
    await createMirror(dbB, DOMAIN_A, A_ACTOR, 'pull', DOMAIN_B, { contentTypes: ['blog'] });
    await handlersB.onMirrorRequest!(A_ACTOR, B_ACTOR, 'https://a.test/activities/offer-clear');
    const [req] = await listMirrorRequests(dbB, 'incoming');
    // Approve with NO filters → consistent with fresh-create: filters cleared to all-types.
    await approveMirrorRequest(dbB, req!.id, DOMAIN_B, {});
    const [row] = await dbB.select().from(instanceMirrors).where(eq(instanceMirrors.remoteDomain, DOMAIN_A));
    expect(row!.filterContentTypes).toBeNull();
    await closeTestDB(dbB);
  });

  it('an Accept flips ONLY the matching outgoing request, not other pending ones', async () => {
    const dbA = await createTestDB();
    const handlersA = createInboxHandlers({ db: dbA, domain: DOMAIN_A });
    await seedRemoteActor(dbA, B_ACTOR, DOMAIN_B);
    await seedRemoteActor(dbA, C_ACTOR, C_DOMAIN);
    const reqB = await requestMirror(dbA, DOMAIN_B, B_ACTOR, DOMAIN_A);
    await requestMirror(dbA, C_DOMAIN, C_ACTOR, DOMAIN_A);

    // B accepts B's offer → only B's request flips; C's stays pending.
    await processInboxActivity(
      { '@context': 'https://www.w3.org/ns/activitystreams', type: 'Accept', actor: B_ACTOR, object: reqB.offerActivityUri },
      handlersA,
    );
    const all = await listMirrorRequests(dbA, 'outgoing');
    const b = all.find((r) => r.remoteDomain === DOMAIN_B);
    const c = all.find((r) => r.remoteDomain === C_DOMAIN);
    expect(b!.status).toBe('approved');
    expect(c!.status).toBe('pending');
    await closeTestDB(dbA);
  });
});
