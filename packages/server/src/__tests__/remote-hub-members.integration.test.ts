/**
 * Integration tests for remote members in hub member list.
 *
 * Tests:
 * - listRemoteMembers returns accepted hub followers with actor info
 * - Pending followers are excluded
 * - Remote actors without cached info still return with URI fallback
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  hubs,
  hubFollowers,
  remoteActors,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { listRemoteMembers } from '../hub/members.js';

const REMOTE_DOMAIN = 'remote.example.com';

describe('remote hub members', () => {
  let db: DB;
  let hubId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'hubowner' });

    // Create a hub
    const [hub] = await db.insert(hubs).values({
      name: 'Test Hub',
      slug: 'test-hub',
      description: 'A test hub',
      hubType: 'community',
      privacy: 'public',
      joinPolicy: 'open',
      createdById: user.id,
    }).returning();
    hubId = hub!.id;

    // Pre-populate remote actors
    await db.insert(remoteActors).values([
      {
        actorUri: `https://${REMOTE_DOMAIN}/users/alice`,
        inbox: `https://${REMOTE_DOMAIN}/users/alice/inbox`,
        instanceDomain: REMOTE_DOMAIN,
        preferredUsername: 'alice',
        displayName: 'Alice',
        avatarUrl: `https://${REMOTE_DOMAIN}/avatar/alice.jpg`,
      },
      {
        actorUri: `https://${REMOTE_DOMAIN}/users/bob`,
        inbox: `https://${REMOTE_DOMAIN}/users/bob/inbox`,
        instanceDomain: REMOTE_DOMAIN,
        preferredUsername: 'bob',
        displayName: 'Bob',
      },
    ]);

    // Add followers: alice accepted, bob pending, charlie (no actor record) accepted
    await db.insert(hubFollowers).values([
      {
        hubId,
        followerActorUri: `https://${REMOTE_DOMAIN}/users/alice`,
        status: 'accepted',
      },
      {
        hubId,
        followerActorUri: `https://${REMOTE_DOMAIN}/users/bob`,
        status: 'pending',
      },
      {
        hubId,
        followerActorUri: `https://other.example.com/users/charlie`,
        status: 'accepted',
      },
    ]);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('returns accepted followers with actor info', async () => {
    const members = await listRemoteMembers(db, hubId);

    // Only accepted followers should be returned (alice + charlie, not bob)
    expect(members.length).toBe(2);

    const alice = members.find(m => m.followerActorUri.includes('alice'));
    expect(alice).toBeDefined();
    expect(alice!.displayName).toBe('Alice');
    expect(alice!.instanceDomain).toBe(REMOTE_DOMAIN);
    expect(alice!.avatarUrl).toContain('alice.jpg');
  });

  it('excludes pending followers', async () => {
    const members = await listRemoteMembers(db, hubId);
    const bob = members.find(m => m.followerActorUri.includes('bob'));
    expect(bob).toBeUndefined();
  });

  it('handles followers without cached actor info', async () => {
    const members = await listRemoteMembers(db, hubId);
    const charlie = members.find(m => m.followerActorUri.includes('charlie'));
    expect(charlie).toBeDefined();
    // No remote actor record — preferredUsername/displayName will be null
    expect(charlie!.instanceDomain).toBe('unknown');
  });
});
