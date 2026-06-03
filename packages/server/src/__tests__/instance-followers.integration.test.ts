/**
 * listInstanceFollowers — "who is mirroring me": remote actors with an ACCEPTED follow of our
 * instance Service actor (https://{domain}/actor). Pending follows and per-user followers are
 * excluded; the follower's domain is derived from its actor URI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { followRelationships } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import { listInstanceFollowers } from '../federation/mirroring.js';

const DOMAIN = 'home.example.com';
const INSTANCE_ACTOR = `https://${DOMAIN}/actor`;

describe('listInstanceFollowers', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
    await db.insert(followRelationships).values([
      // accepted instance-actor followers (mirroring us)
      { followerActorUri: 'https://b.example.com/actor', followingActorUri: INSTANCE_ACTOR, status: 'accepted' },
      { followerActorUri: 'https://c.example.com/actor', followingActorUri: INSTANCE_ACTOR, status: 'accepted' },
      // pending — not yet mirroring
      { followerActorUri: 'https://d.example.com/actor', followingActorUri: INSTANCE_ACTOR, status: 'pending' },
      // accepted, but following a local USER (not the instance actor) — not an instance mirror
      { followerActorUri: 'https://e.example.com/actor', followingActorUri: `https://${DOMAIN}/users/alice`, status: 'accepted' },
    ]);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('returns only accepted followers of the instance actor, with derived domains', async () => {
    const followers = await listInstanceFollowers(db, DOMAIN);
    const domains = followers.map((f) => f.domain).sort();
    expect(domains).toEqual(['b.example.com', 'c.example.com']);
    expect(followers.every((f) => f.actorUri.startsWith('https://'))).toBe(true);
  });

  it('excludes pending follows and per-user followers', async () => {
    const followers = await listInstanceFollowers(db, DOMAIN);
    const domains = followers.map((f) => f.domain);
    expect(domains).not.toContain('d.example.com'); // pending
    expect(domains).not.toContain('e.example.com'); // follows a user, not the instance
  });
});
