/**
 * Integration tests for per-user federated hub join tracking.
 *
 * Tests:
 * - userFederatedHubFollows records are created on join
 * - Status is 'pending' when instance follow is pending
 * - Status promotes to 'joined' when acceptHubFollow is called
 * - Duplicate joins are idempotent (upsert)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import {
  federatedHubs,
  remoteActors,
  userFederatedHubFollows,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { acceptHubFollow } from '../federation/hubMirroring.js';

const REMOTE_DOMAIN = 'remote.example.com';
const REMOTE_HUB_ACTOR = `https://${REMOTE_DOMAIN}/hubs/electronics`;

describe('per-user federated hub join tracking', () => {
  let db: DB;
  let userId1: string;
  let userId2: string;
  let fedHubId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user1 = await createTestUser(db, { username: 'alice' });
    userId1 = user1.id;
    const user2 = await createTestUser(db, { username: 'bob', email: 'bob@test.com' });
    userId2 = user2.id;

    // Create remote actor for the hub
    await db.insert(remoteActors).values({
      actorUri: REMOTE_HUB_ACTOR,
      inbox: `${REMOTE_HUB_ACTOR}/inbox`,
      actorType: 'Group',
      instanceDomain: REMOTE_DOMAIN,
      preferredUsername: 'electronics',
      displayName: 'Electronics Hub',
    });

    // Create a pending federated hub
    const [hub] = await db.insert(federatedHubs).values({
      actorUri: REMOTE_HUB_ACTOR,
      originDomain: REMOTE_DOMAIN,
      remoteSlug: 'electronics',
      name: 'Electronics Hub',
      hubType: 'community',
      status: 'pending',
    }).returning();
    fedHubId = hub!.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a pending user follow record', async () => {
    await db.insert(userFederatedHubFollows).values({
      userId: userId1,
      federatedHubId: fedHubId,
      status: 'pending',
    });

    const [record] = await db
      .select()
      .from(userFederatedHubFollows)
      .where(and(
        eq(userFederatedHubFollows.userId, userId1),
        eq(userFederatedHubFollows.federatedHubId, fedHubId),
      ));

    expect(record).toBeDefined();
    expect(record!.status).toBe('pending');
  });

  it('second user also joins as pending', async () => {
    await db.insert(userFederatedHubFollows).values({
      userId: userId2,
      federatedHubId: fedHubId,
      status: 'pending',
    });

    const records = await db
      .select()
      .from(userFederatedHubFollows)
      .where(eq(userFederatedHubFollows.federatedHubId, fedHubId));

    expect(records.length).toBe(2);
    expect(records.every(r => r.status === 'pending')).toBe(true);
  });

  it('acceptHubFollow promotes all pending users to joined', async () => {
    const accepted = await acceptHubFollow(db, REMOTE_HUB_ACTOR);
    expect(accepted).toBe(true);

    const records = await db
      .select()
      .from(userFederatedHubFollows)
      .where(eq(userFederatedHubFollows.federatedHubId, fedHubId));

    expect(records.length).toBe(2);
    expect(records.every(r => r.status === 'joined')).toBe(true);
  });

  it('duplicate join is idempotent (upsert)', async () => {
    // Alice joins again — should update, not duplicate
    await db
      .insert(userFederatedHubFollows)
      .values({
        userId: userId1,
        federatedHubId: fedHubId,
        status: 'joined',
      })
      .onConflictDoUpdate({
        target: [userFederatedHubFollows.userId, userFederatedHubFollows.federatedHubId],
        set: { status: 'joined', joinedAt: new Date() },
      });

    const records = await db
      .select()
      .from(userFederatedHubFollows)
      .where(and(
        eq(userFederatedHubFollows.userId, userId1),
        eq(userFederatedHubFollows.federatedHubId, fedHubId),
      ));

    expect(records.length).toBe(1);
  });
});
