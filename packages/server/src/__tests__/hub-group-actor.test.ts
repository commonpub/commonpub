/**
 * Tests for hub Group actor federation — verifying the actor includes
 * member count, post count, and proper AP fields.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { hubs, users, hubMembers } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { buildHubGroupActor, getHubActorUri } from '../federation/hubFederation.js';

const DOMAIN = 'test.example.com';

describe('buildHubGroupActor', () => {
  let db: DB;
  let userId: string;
  let hubSlug: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'hubowner' });
    userId = user.id;

    // Create a hub with known member/post counts
    const [hub] = await db.insert(hubs).values({
      name: 'Test Makers',
      slug: 'test-makers',
      description: 'A test hub for makers',
      createdById: userId,
      memberCount: 5,
      postCount: 12,
      iconUrl: 'https://test.example.com/icon.png',
      bannerUrl: 'https://test.example.com/banner.png',
    }).returning();
    hubSlug = hub!.slug;

    // Add owner as member
    await db.insert(hubMembers).values({
      hubId: hub!.id,
      userId,
      role: 'owner',
      status: 'active',
    });
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('returns a valid AP Group actor', async () => {
    const actor = await buildHubGroupActor(db, hubSlug, DOMAIN);
    expect(actor).not.toBeNull();
    expect(actor!.type).toBe('Group');
    expect(actor!.id).toBe(`https://${DOMAIN}/hubs/${hubSlug}`);
    expect(actor!.preferredUsername).toBe(hubSlug);
    expect(actor!.name).toBe('Test Makers');
    expect(actor!.summary).toBe('A test hub for makers');
  });

  it('includes inbox, outbox, followers URIs', async () => {
    const actor = await buildHubGroupActor(db, hubSlug, DOMAIN);
    const actorUri = `https://${DOMAIN}/hubs/${hubSlug}`;
    expect(actor!.inbox).toBe(`${actorUri}/inbox`);
    expect(actor!.outbox).toBe(`${actorUri}/outbox`);
    expect(actor!.followers).toBe(`${actorUri}/followers`);
  });

  it('includes icon and banner images', async () => {
    const actor = await buildHubGroupActor(db, hubSlug, DOMAIN);
    expect(actor!.icon).toEqual({ type: 'Image', url: 'https://test.example.com/icon.png' });
    expect(actor!.image).toEqual({ type: 'Image', url: 'https://test.example.com/banner.png' });
  });

  it('includes cpub:memberCount from local hub data', async () => {
    const actor = await buildHubGroupActor(db, hubSlug, DOMAIN);
    const ext = actor as unknown as Record<string, unknown>;
    expect(ext['cpub:memberCount']).toBe(5);
  });

  it('includes cpub:postCount from local hub data', async () => {
    const actor = await buildHubGroupActor(db, hubSlug, DOMAIN);
    const ext = actor as unknown as Record<string, unknown>;
    expect(ext['cpub:postCount']).toBe(12);
  });

  it('includes RSA public key', async () => {
    const actor = await buildHubGroupActor(db, hubSlug, DOMAIN);
    expect(actor!.publicKey).toBeDefined();
    expect(actor!.publicKey!.id).toContain('#main-key');
    expect(actor!.publicKey!.publicKeyPem).toContain('BEGIN PUBLIC KEY');
  });

  it('returns null for non-existent hub', async () => {
    const actor = await buildHubGroupActor(db, 'nonexistent', DOMAIN);
    expect(actor).toBeNull();
  });
});
