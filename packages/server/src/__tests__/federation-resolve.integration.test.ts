/**
 * Integration tests for resolveRemoteActor — the server-side actor resolution
 * with database caching, cache expiry, and upsert logic.
 *
 * This function calls resolveActor() from @commonpub/protocol which does actual
 * HTTP fetching. We mock that import to test the caching/DB logic in isolation.
 */
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB } from './helpers/testdb.js';
import { eq } from 'drizzle-orm';
import { remoteActors } from '@commonpub/schema';

// Mock the protocol's resolveActor before importing our module
vi.mock('@commonpub/protocol', async (importOriginal) => {
  const original = await importOriginal<typeof import('@commonpub/protocol')>();
  return {
    ...original,
    resolveActor: vi.fn(),
  };
});

// Import after mock setup
import { resolveRemoteActor } from '../federation/federation.js';
import { resolveActor } from '@commonpub/protocol';

const REMOTE_URI = 'https://mastodon.social/users/alice';
const MOCK_ACTOR = {
  '@context': 'https://www.w3.org/ns/activitystreams' as const,
  type: 'Person' as const,
  id: REMOTE_URI,
  preferredUsername: 'alice',
  name: 'Alice Remote',
  inbox: 'https://mastodon.social/users/alice/inbox',
  outbox: 'https://mastodon.social/users/alice/outbox',
  publicKey: {
    id: `${REMOTE_URI}#main-key`,
    owner: REMOTE_URI,
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nTESTKEY\n-----END PUBLIC KEY-----',
  },
  icon: {
    type: 'Image' as const,
    url: 'https://mastodon.social/avatars/alice.png',
    mediaType: 'image/png' as const,
  },
};

describe('resolveRemoteActor integration', () => {
  let db: DB;
  const mockedResolveActor = vi.mocked(resolveActor);

  beforeAll(async () => {
    db = await createTestDB();
  });

  beforeEach(() => {
    mockedResolveActor.mockReset();
  });

  it('fetches from remote on cache miss and inserts cache row', async () => {
    mockedResolveActor.mockResolvedValue(MOCK_ACTOR);

    const result = await resolveRemoteActor(db, REMOTE_URI);

    // Should have called resolveActor
    expect(mockedResolveActor).toHaveBeenCalledWith(REMOTE_URI, expect.any(Function));

    // Should return the actor
    expect(result).not.toBeNull();
    expect(result!.id).toBe(REMOTE_URI);
    expect(result!.inbox).toBe(MOCK_ACTOR.inbox);

    // Should have cached in DB
    const [cached] = await db
      .select()
      .from(remoteActors)
      .where(eq(remoteActors.actorUri, REMOTE_URI))
      .limit(1);
    expect(cached).toBeDefined();
    expect(cached!.actorUri).toBe(REMOTE_URI);
    expect(cached!.inbox).toBe(MOCK_ACTOR.inbox);
    expect(cached!.preferredUsername).toBe('alice');
    expect(cached!.displayName).toBe('Alice Remote');
    expect(cached!.instanceDomain).toBe('mastodon.social');
    expect(cached!.publicKeyPem).toContain('TESTKEY');
    expect(cached!.avatarUrl).toBe('https://mastodon.social/avatars/alice.png');
  });

  it('returns cached actor on cache hit (no remote fetch)', async () => {
    // The previous test already inserted a cache row for REMOTE_URI
    mockedResolveActor.mockResolvedValue(MOCK_ACTOR);

    const result = await resolveRemoteActor(db, REMOTE_URI);

    // Should NOT have called resolveActor (cache is fresh)
    expect(mockedResolveActor).not.toHaveBeenCalled();

    // Should return the cached data
    expect(result).not.toBeNull();
    expect(result!.id).toBe(REMOTE_URI);
    expect(result!.type).toBe('Person');
    expect(result!.inbox).toBe(MOCK_ACTOR.inbox);
    expect(result!.preferredUsername).toBe('alice');
    expect(result!.name).toBe('Alice Remote');
    expect(result!.publicKey?.publicKeyPem).toContain('TESTKEY');
  });

  it('re-fetches when cache is older than 24 hours', async () => {
    // Manually age the cache entry
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db
      .update(remoteActors)
      .set({ lastFetchedAt: twentyFiveHoursAgo })
      .where(eq(remoteActors.actorUri, REMOTE_URI));

    const updatedActor = {
      ...MOCK_ACTOR,
      name: 'Alice Updated',
    };
    mockedResolveActor.mockResolvedValue(updatedActor);

    const result = await resolveRemoteActor(db, REMOTE_URI);

    // Should have fetched from remote since cache expired
    expect(mockedResolveActor).toHaveBeenCalledWith(REMOTE_URI, expect.any(Function));

    // Should return updated data
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Alice Updated');

    // Cache should be updated (lastFetchedAt refreshed)
    const [cached] = await db
      .select()
      .from(remoteActors)
      .where(eq(remoteActors.actorUri, REMOTE_URI))
      .limit(1);
    expect(cached!.displayName).toBe('Alice Updated');
    // lastFetchedAt should be recent (within last 10 seconds)
    const age = Date.now() - cached!.lastFetchedAt.getTime();
    expect(age).toBeLessThan(10_000);
  });

  it('returns null when remote fetch fails', async () => {
    const newUri = 'https://gone.example/users/nobody';
    mockedResolveActor.mockResolvedValue(null);

    const result = await resolveRemoteActor(db, newUri);

    expect(result).toBeNull();
    expect(mockedResolveActor).toHaveBeenCalled();

    // Should NOT have inserted a cache row for failed fetch
    const [cached] = await db
      .select()
      .from(remoteActors)
      .where(eq(remoteActors.actorUri, newUri))
      .limit(1);
    expect(cached).toBeUndefined();
  });

  it('handles actor without optional fields (outbox, publicKey, icon)', async () => {
    const minimalUri = 'https://minimal.example/users/min';
    const minimalActor = {
      '@context': 'https://www.w3.org/ns/activitystreams' as const,
      type: 'Person' as const,
      id: minimalUri,
      inbox: 'https://minimal.example/users/min/inbox',
    };
    mockedResolveActor.mockResolvedValue(minimalActor);

    const result = await resolveRemoteActor(db, minimalUri);

    expect(result).not.toBeNull();
    expect(result!.inbox).toBe('https://minimal.example/users/min/inbox');

    // Cache row should have nulls for optional fields
    const [cached] = await db
      .select()
      .from(remoteActors)
      .where(eq(remoteActors.actorUri, minimalUri))
      .limit(1);
    expect(cached!.outbox).toBeNull();
    expect(cached!.publicKeyPem).toBeNull();
    expect(cached!.preferredUsername).toBeNull();
    expect(cached!.avatarUrl).toBeNull();
  });

  it('inserts new cache row for second different actor', async () => {
    const secondUri = 'https://other.example/users/bob';
    const secondActor = {
      ...MOCK_ACTOR,
      id: secondUri,
      preferredUsername: 'bob',
      name: 'Bob Other',
      inbox: 'https://other.example/users/bob/inbox',
    };
    mockedResolveActor.mockResolvedValue(secondActor);

    await resolveRemoteActor(db, secondUri);

    const [cached] = await db
      .select()
      .from(remoteActors)
      .where(eq(remoteActors.actorUri, secondUri))
      .limit(1);
    expect(cached).toBeDefined();
    expect(cached!.instanceDomain).toBe('other.example');
    expect(cached!.preferredUsername).toBe('bob');
  });
});
