/**
 * Unit tests for delivery retry logic.
 *
 * Tests the isReadyForRetry function and delivery edge cases.
 * Since isReadyForRetry is not exported, we test it indirectly through
 * deliverPendingActivities behavior using a real DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  activities,
  remoteActors,
  followRelationships,
  users,
  actorKeypairs,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { deliverPendingActivities, cleanupDeliveredActivities } from '../federation/delivery.js';

const DOMAIN = 'local.example.com';

describe('delivery retry logic', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'sender' });
    userId = user.id;

    // Create keypair for the sender
    await db.insert(actorKeypairs).values({
      userId,
      publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0\n-----END PUBLIC KEY-----',
      privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('pending activity filtering', () => {
    it('skips activities that have been dead-lettered', async () => {
      await db.insert(activities).values({
        type: 'Create',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/dead',
        payload: { type: 'Create' },
        direction: 'outbound',
        status: 'pending',
        attempts: 6,
        deadLetteredAt: new Date(),
      });

      const result = await deliverPendingActivities(db, DOMAIN);
      // Dead-lettered activity should NOT be picked up
      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/dead'));
      expect(row!.status).toBe('pending'); // Still pending, not touched
      expect(row!.deadLetteredAt).not.toBeNull();
    });

    it('does not pick up activities locked by another worker', async () => {
      await db.insert(activities).values({
        type: 'Create',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/locked',
        payload: { type: 'Create' },
        direction: 'outbound',
        status: 'pending',
        attempts: 0,
        lockedAt: new Date(), // Just locked
      });

      const result = await deliverPendingActivities(db, DOMAIN);
      // Locked activity should NOT be picked up (lock is fresh)
      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/locked'));
      // Still has original lock time (not re-locked by our worker)
      expect(row!.status).toBe('pending');
    });

    it('picks up activities with expired locks (worker crash recovery)', async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000); // > 5 min lock expiry
      await db.insert(activities).values({
        type: 'Create',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/stale-lock',
        payload: { type: 'Create', id: 'https://remote.example.com/content/stale-lock' },
        direction: 'outbound',
        status: 'pending',
        attempts: 0,
        lockedAt: sixMinutesAgo, // Lock expired
      });

      // Will pick up the stale-locked activity. It'll fail delivery (no followers),
      // but the point is it WAS picked up.
      await deliverPendingActivities(db, DOMAIN);

      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/stale-lock'));
      // Activity was picked up (lock was refreshed or status changed)
      expect(row!.lockedAt).toBeNull(); // Lock released after processing
    });
  });

  describe('activity status transitions', () => {
    it('marks activity as failed when no target inboxes found', async () => {
      // Activity with no followers → no inboxes → fails
      await db.insert(activities).values({
        type: 'Create',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/no-followers',
        payload: { type: 'Create', id: 'test' },
        direction: 'outbound',
        status: 'pending',
        attempts: 0,
      });

      await deliverPendingActivities(db, DOMAIN);

      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/no-followers'));
      expect(row!.status).toBe('failed');
      expect(row!.error).toContain('No target inboxes');
      expect(row!.deadLetteredAt).not.toBeNull();
    });

    it('marks activity as failed when payload is empty object', async () => {
      // Empty payload still passes NOT NULL but has no useful content
      // This tests the "no target inboxes" path since there's nothing actionable
      await db.insert(activities).values({
        type: 'Create',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/empty-payload',
        payload: {},
        direction: 'outbound',
        status: 'pending',
        attempts: 0,
      });

      await deliverPendingActivities(db, DOMAIN);

      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/empty-payload'));
      expect(row!.status).toBe('failed');
      expect(row!.error).toContain('No target inboxes');
    });
  });

  describe('cleanupDeliveredActivities', () => {
    it('deletes old delivered activities past retention', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
      await db.insert(activities).values({
        type: 'Create',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/old-delivered',
        payload: {},
        direction: 'outbound',
        status: 'delivered',
        attempts: 1,
        createdAt: oldDate,
      });

      const deleted = await cleanupDeliveredActivities(db, 30);
      expect(deleted).toBeGreaterThanOrEqual(1);

      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/old-delivered'));
      expect(row).toBeUndefined();
    });

    it('does NOT delete recent delivered activities', async () => {
      await db.insert(activities).values({
        type: 'Like',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/recent-delivered',
        payload: {},
        direction: 'outbound',
        status: 'delivered',
        attempts: 1,
      });

      await cleanupDeliveredActivities(db, 30);

      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/recent-delivered'));
      expect(row).toBeDefined(); // Still there
    });

    it('does NOT delete pending activities', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await db.insert(activities).values({
        type: 'Create',
        actorUri: `https://${DOMAIN}/users/sender`,
        objectUri: 'https://remote.example.com/content/old-pending',
        payload: {},
        direction: 'outbound',
        status: 'pending',
        attempts: 0,
        createdAt: oldDate,
      });

      await cleanupDeliveredActivities(db, 30);

      const [row] = await db
        .select()
        .from(activities)
        .where(eq(activities.objectUri, 'https://remote.example.com/content/old-pending'));
      expect(row).toBeDefined(); // Still there — pending not cleaned up
    });
  });
});
