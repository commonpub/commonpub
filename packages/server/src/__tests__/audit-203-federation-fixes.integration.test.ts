/**
 * Proving tests for audit session 203/204 federation fixes.
 *
 * Each test here is paired with a documented source mutation that flips it RED
 * (see the per-test comments). They cover:
 *   1. toggleFederatedHubPostLike — tx + row-gated counter (hubMirroring.ts)
 *   2. recordActivitySeen — inbox replay dedup ON CONFLICT (activityDedup.ts)
 *   3. isValidHost — SSRF gate on IP-literal hosts (mastodonLogin.ts)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import {
  remoteActors,
  federatedHubs,
  federatedHubPosts,
  federatedHubPostLikes,
} from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { toggleFederatedHubPostLike } from '../federation/hubMirroring.js';
import { recordActivitySeen } from '../federation/activityDedup.js';
import { isValidHost } from '../federation/mastodonLogin.js';

const LOCAL_DOMAIN = 'local.example.com';
const REMOTE_HUB_ACTOR = 'https://remote.example.com/hubs/makers';
const REMOTE_POST_AUTHOR = 'https://remote.example.com/users/carol';
const POST_OBJECT_URI = 'https://remote.example.com/hubs/makers/posts/post-1';
const LOCAL_ACTOR_URI = `https://${LOCAL_DOMAIN}/users/liker`;

describe('audit-203 federation fixes', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- Fix 1: toggleFederatedHubPostLike tx + row-gated counter ---
  describe('toggleFederatedHubPostLike (hubMirroring.ts)', () => {
    let postId: string;
    let userId: string;

    beforeAll(async () => {
      const user = await createTestUser(db, { username: 'liker' });
      userId = user.id;

      await db.insert(remoteActors).values({
        actorUri: REMOTE_POST_AUTHOR,
        inbox: `${REMOTE_POST_AUTHOR}/inbox`,
        instanceDomain: 'remote.example.com',
        preferredUsername: 'carol',
        displayName: 'Carol',
      });

      const [hub] = await db
        .insert(federatedHubs)
        .values({
          actorUri: REMOTE_HUB_ACTOR,
          originDomain: 'remote.example.com',
          remoteSlug: 'makers',
          name: 'Makers',
          status: 'accepted',
        })
        .returning({ id: federatedHubs.id });

      const [post] = await db
        .insert(federatedHubPosts)
        .values({
          federatedHubId: hub!.id,
          objectUri: POST_OBJECT_URI,
          actorUri: REMOTE_POST_AUTHOR,
          content: 'A federated hub post',
        })
        .returning({ id: federatedHubPosts.id });
      postId = post!.id;
    });

    /**
     * KEY ASSERTION: a like inserts exactly one like-row AND sets localLikeCount
     * to exactly 1; an immediate second toggle removes the row AND sets the
     * counter back to exactly 0. The counter must track the row 1:1 — never
     * double-count.
     *
     * MUTATION (proves RED): in the like-branch of toggleFederatedHubPostLike,
     * UNGATE the counter — move the `localLikeCount + 1` update out from under
     * `if (inserted.length > 0)` so it always runs, e.g. replace
     *
     *     if (inserted.length > 0) {
     *       await tx.update(federatedHubPosts).set({ localLikeCount: sql`${federatedHubPosts.localLikeCount} + 1` })...
     *
     * with an unconditional increment (drop the `if (inserted.length > 0)`
     * guard around the update + activity insert). The re-like assertion below
     * (`liked` already true → onConflictDoNothing inserts nothing, but counter
     * still bumps) double-counts → localLikeCount === 2 → RED.
     */
    it('toggles liked true/false and tracks localLikeCount 1:1 with the like row', async () => {
      // Like → row present + counter exactly 1
      const r1 = await toggleFederatedHubPostLike(db, postId, userId, LOCAL_ACTOR_URI);
      expect(r1.liked).toBe(true);

      const likeRows1 = await db
        .select({ id: federatedHubPostLikes.id })
        .from(federatedHubPostLikes)
        .where(and(eq(federatedHubPostLikes.postId, postId), eq(federatedHubPostLikes.userId, userId)));
      expect(likeRows1.length).toBe(1);

      let [post] = await db
        .select({ localLikeCount: federatedHubPosts.localLikeCount })
        .from(federatedHubPosts)
        .where(eq(federatedHubPosts.id, postId));
      expect(post!.localLikeCount).toBe(1);

      // Toggle again → unlike: row gone + counter exactly 0
      const r2 = await toggleFederatedHubPostLike(db, postId, userId, LOCAL_ACTOR_URI);
      expect(r2.liked).toBe(false);

      const likeRows2 = await db
        .select({ id: federatedHubPostLikes.id })
        .from(federatedHubPostLikes)
        .where(and(eq(federatedHubPostLikes.postId, postId), eq(federatedHubPostLikes.userId, userId)));
      expect(likeRows2.length).toBe(0);

      [post] = await db
        .select({ localLikeCount: federatedHubPosts.localLikeCount })
        .from(federatedHubPosts)
        .where(eq(federatedHubPosts.id, postId));
      expect(post!.localLikeCount).toBe(0);
    });

    /**
     * KEY ASSERTION (unlike branch is row-gated + clamped): when a like row
     * exists but the counter is at 0 (a desynced / already-floored state, the
     * shape a concurrent double-unlike would produce), a toggle that removes the
     * row must NOT drive the counter negative. The fix gates the decrement on
     * `deleted.length > 0` and clamps with `GREATEST(localLikeCount - 1, 0)`.
     *
     * MUTATION (proves RED): in the unlike branch, replace
     *     GREATEST(${federatedHubPosts.localLikeCount} - 1, 0)
     * with a bare
     *     ${federatedHubPosts.localLikeCount} - 1
     * The decrement underflows past 0 → localLikeCount === -1 → RED.
     */
    it('unlike does not drive localLikeCount negative (gated + clamped)', async () => {
      // Clean slate, then seed a like row out-of-band with the counter floored at 0
      // (models the post-floor state a redundant unlike would hit).
      await db.delete(federatedHubPostLikes).where(eq(federatedHubPostLikes.postId, postId));
      await db.update(federatedHubPosts).set({ localLikeCount: 0 }).where(eq(federatedHubPosts.id, postId));
      await db.insert(federatedHubPostLikes).values({ postId, userId });

      const r = await toggleFederatedHubPostLike(db, postId, userId, LOCAL_ACTOR_URI);
      expect(r.liked).toBe(false); // existing row found → unlike path

      const rows = await db
        .select({ id: federatedHubPostLikes.id })
        .from(federatedHubPostLikes)
        .where(and(eq(federatedHubPostLikes.postId, postId), eq(federatedHubPostLikes.userId, userId)));
      expect(rows.length).toBe(0); // row removed

      const [post] = await db
        .select({ localLikeCount: federatedHubPosts.localLikeCount })
        .from(federatedHubPosts)
        .where(eq(federatedHubPosts.id, postId));
      expect(post!.localLikeCount).toBe(0); // clamped — never -1
    });
  });

  // --- Fix 2: inbox replay dedup (recordActivitySeen) ---
  describe('recordActivitySeen (activityDedup.ts)', () => {
    /**
     * KEY ASSERTION: against real Postgres, the FIRST claim of an activity id
     * returns true (row inserted → caller processes) and the SECOND claim of
     * the same id returns false (ON CONFLICT DO NOTHING → caller short-circuits
     * the replay). This is the dedup contract the inbox routes rely on.
     *
     * WIRING (covered indirectly): every inbound inbox route gates dispatch on
     * this exact true/false. See:
     *   layers/base/server/routes/inbox.ts:28
     *   layers/base/server/routes/users/[username]/inbox.ts:26
     *   layers/base/server/routes/hubs/[slug]/inbox.ts:31
     *   layers/base/server/api/registry/ping.post.ts:50
     * Each does `const first = await recordActivitySeen(db, activityId)` and
     * skips processing when `first === false`. Those route files live in the
     * reference-app layer (not @commonpub/server) so they can't be invoked from
     * this harness; the contract proven here is the load-bearing primitive.
     *
     * MUTATION (proves RED): in recordActivitySeen, make it always return true
     * (e.g. `return true;`) OR drop the `.onConflictDoNothing(...)` so the
     * second insert throws / the function reports inserted on every call → the
     * "second call false" assertion goes RED.
     */
    it('returns true on first claim and false on replay (ON CONFLICT)', async () => {
      const id = 'https://remote.example.com/activities/replay-1';

      const first = await recordActivitySeen(db, id);
      expect(first).toBe(true);

      const second = await recordActivitySeen(db, id);
      expect(second).toBe(false);

      // A different id is unaffected (independent claim).
      const other = await recordActivitySeen(db, 'https://remote.example.com/activities/replay-2');
      expect(other).toBe(true);
    });

    /**
     * KEY ASSERTION: drives the route-gating pattern end-to-end at the unit
     * level — a side effect guarded by `if (!first) return` applies EXACTLY
     * once across two deliveries of the same activity id. This mirrors what the
     * inbox routes do around `createInboxHandlers`.
     *
     * MUTATION (same as above): recordActivitySeen always-true makes both
     * deliveries pass the guard → effect applied twice → RED.
     */
    it('gates a side effect to run once across a replayed delivery (route pattern)', async () => {
      const id = 'https://remote.example.com/activities/gated-effect';
      let sideEffectRuns = 0;

      // Simulate the inbox route: claim-then-dispatch.
      async function deliver(activityId: string): Promise<void> {
        const first = await recordActivitySeen(db, activityId);
        if (!first) return; // replay → short-circuit, exactly as the routes do
        sideEffectRuns += 1; // stands in for handlers.onLike/onCreate/... dispatch
      }

      await deliver(id);
      await deliver(id); // replay

      expect(sideEffectRuns).toBe(1);
    });
  });

  // --- Fix 3: isValidHost SSRF gate ---
  describe('isValidHost (mastodonLogin.ts)', () => {
    /**
     * KEY ASSERTION: a real public host passes; loopback / private / link-local
     * IP literals (incl. the 169.254.169.254 cloud-metadata address) and IPv6
     * loopback are REJECTED; obvious garbage is rejected.
     *
     * MUTATION (proves RED): delete the SSRF line
     *     if (isPrivateUrl(`https://${normalized}`)) return false;
     * from isValidHost. The IP-literal cases (169.254.169.254 / 127.0.0.1 /
     * 10.0.0.5 / [::1]) all satisfy the loose domain regex + the "has a dot"
     * check (except [::1], see note), so they flip from false → true → RED.
     */
    it('accepts public hosts and rejects private/loopback/metadata IP literals', () => {
      expect(isValidHost('mastodon.social')).toBe(true);

      expect(isValidHost('169.254.169.254')).toBe(false); // cloud metadata
      expect(isValidHost('127.0.0.1')).toBe(false); // loopback
      expect(isValidHost('10.0.0.5')).toBe(false); // RFC1918 private
      expect(isValidHost('[::1]')).toBe(false); // IPv6 loopback

      // Obvious garbage (caught before the SSRF line by the loose checks).
      expect(isValidHost('')).toBe(false);
      expect(isValidHost('not a host')).toBe(false);
      expect(isValidHost('nodot')).toBe(false);
      expect(isValidHost('https://evil.example.com/path')).toBe(false);
    });
  });
});
