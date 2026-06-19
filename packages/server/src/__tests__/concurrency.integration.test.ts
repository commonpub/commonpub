/**
 * Real-Postgres concurrency proofs (audit session 204 — test-quality).
 *
 * These cover the things PGlite CANNOT prove: row-lock serialization,
 * `ON CONFLICT` claim races, and atomic `UPDATE … RETURNING` claims. PGlite is a
 * single serialized connection, so the fixes below are no-ops there and only a
 * real multi-connection pool can show the race. See helpers/realpgdb.ts.
 *
 * Skips cleanly when no Postgres is reachable (PGlite-only CI); runs for real
 * locally (docker :5433) and in any CI with a Postgres service.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import {
  contentItems,
  enrollments,
  learningPaths,
  digestRuns,
  federatedHubs,
  federatedHubPosts,
  federatedHubPostLikes,
  federatedContent,
  activities,
} from '@commonpub/schema';
import { createRealTestDB, realPgReachable, type RealTestDb } from './helpers/realpgdb.js';
import { createTestUser } from './helpers/testdb.js';
import { createContentVersion } from '../content/content.js';
import { enroll } from '../learning/learning.js';
import { toggleFederatedHubPostLike } from '../federation/hubMirroring.js';
import { likeRemoteContent, boostRemoteContent } from '../federation/timeline.js';

const reachable = await realPgReachable();
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[concurrency.integration] no Postgres reachable — skipping real-PG concurrency proofs');
}

describe.skipIf(!reachable)('real-Postgres concurrency proofs', () => {
  let h: RealTestDb;
  beforeAll(async () => { h = await createRealTestDB(); }, 60_000);
  afterAll(async () => { await h?.cleanup(); });

  // Creating the DB applied the committed migration chain (helpers/realpgdb migrate()),
  // so this also proves migrations 0000→latest apply cleanly end-to-end.
  it('the committed migration chain applied (0026/0027 artifacts present)', async () => {
    const tbl = await h.db.execute(sql`SELECT to_regclass('public.processed_activities') AS a, to_regclass('public.digest_runs') AS b`);
    const col = await h.db.execute(sql`SELECT 1 FROM information_schema.columns WHERE table_name='content_items' AND column_name='remote_like_count'`);
    const row = tbl.rows[0] as { a: string | null; b: string | null };
    expect(row.a).toBeTruthy();
    expect(row.b).toBeTruthy();
    expect(col.rows.length).toBe(1);
  });

  it('createContentVersion: concurrent creates get DISTINCT versions (FOR UPDATE row lock)', async () => {
    const user = await createTestUser(h.db);
    const [content] = await h.db
      .insert(contentItems)
      .values({ authorId: user.id, type: 'blog', title: 'Race', slug: `race-${crypto.randomUUID().slice(0, 8)}`, status: 'draft' })
      .returning();
    // With the FOR UPDATE lock, N concurrent creates serialize to versions 1..N (deterministic).
    // Without it, transactions read the same max(version) and write duplicate numbers.
    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () => createContentVersion(h.db, content!.id, user.id)),
    );
    const versions = results.map((r) => r.version).sort((x, y) => x - y);
    expect(new Set(versions).size).toBe(N); // all distinct
    expect(versions).toEqual(Array.from({ length: N }, (_, i) => i + 1)); // exactly 1..N
  });

  it('enroll: concurrent enroll of the same (user,path) counts exactly once (onConflict + gated counter)', async () => {
    const user = await createTestUser(h.db);
    const [path] = await h.db
      .insert(learningPaths)
      .values({ title: 'P', slug: `p-${crypto.randomUUID().slice(0, 8)}`, authorId: user.id, status: 'published' })
      .returning();
    // 10 concurrent enrolls: many pass the pre-tx "already enrolled?" check before any
    // commits, so without the gated counter each would bump enrollmentCount.
    await Promise.all(Array.from({ length: 10 }, () => enroll(h.db, user.id, path!.id).catch(() => null)));
    const rows = await h.db.select().from(enrollments).where(eq(enrollments.pathId, path!.id));
    const [p] = await h.db.select().from(learningPaths).where(eq(learningPaths.id, path!.id));
    expect(rows.length).toBe(1);               // exactly one enrollment row
    expect(p!.enrollmentCount).toBe(1);        // counter == rows (ungated increment → > 1)
  });

  it('toggleFederatedHubPostLike: concurrent same-user like keeps counter == actual like rows', async () => {
    const user = await createTestUser(h.db);
    const [hub] = await h.db.insert(federatedHubs).values({
      actorUri: `https://remote.test/h/${crypto.randomUUID().slice(0, 8)}`, originDomain: 'remote.test', remoteSlug: 'h', name: 'H',
    }).returning();
    const [post] = await h.db.insert(federatedHubPosts).values({
      federatedHubId: hub!.id, objectUri: `https://remote.test/p/${crypto.randomUUID().slice(0, 8)}`, actorUri: 'https://remote.test/u', content: 'hi',
    }).returning();

    // 10 concurrent likes from the same user: the like-branch insert is gated on
    // onConflictDoNothing returning a row, so the counter must never exceed the like rows.
    await Promise.all(Array.from({ length: 10 }, () =>
      toggleFederatedHubPostLike(h.db, post!.id, user.id, 'https://local.test/u').catch(() => null),
    ));

    const likeRows = await h.db.select().from(federatedHubPostLikes).where(eq(federatedHubPostLikes.postId, post!.id));
    const [p] = await h.db.select().from(federatedHubPosts).where(eq(federatedHubPosts.id, post!.id));
    // The denormalized counter MUST equal the number of actual like rows (<= 1 for one user).
    // The pre-fix ungated increment double-counts → counter > rows.
    expect(p!.localLikeCount).toBe(likeRows.length);
    expect(p!.localLikeCount).toBeLessThanOrEqual(1);
  });

  it('likeRemoteContent: concurrent same-user like → counter == 1 and exactly one outbound Like', async () => {
    const user = await createTestUser(h.db);
    const objectUri = `https://remote.test/o/${crypto.randomUUID().slice(0, 8)}`;
    const [content] = await h.db.insert(federatedContent).values({
      objectUri, actorUri: 'https://remote.test/u', originDomain: 'remote.test', apType: 'Note', content: 'hi',
    }).returning();

    // 25 concurrent likes from the same user. Without the FOR UPDATE serialization,
    // each call passes the "already liked?" check before any commits → the counter is
    // double-incremented AND duplicate outbound Like activities are federated. (N=25
    // reproduces the race deterministically; N=10 was below the reliability threshold.)
    await Promise.all(Array.from({ length: 25 }, () =>
      likeRemoteContent(h.db, user.id, content!.id, 'local.test').catch(() => null),
    ));

    const actorUri = `https://local.test/users/${user.username}`;
    const likeActs = await h.db.select().from(activities).where(and(
      eq(activities.type, 'Like'),
      eq(activities.actorUri, actorUri),
      eq(activities.objectUri, objectUri),
      eq(activities.direction, 'outbound'),
    ));
    const [c] = await h.db.select().from(federatedContent).where(eq(federatedContent.id, content!.id));
    expect(likeActs.length).toBe(1);           // exactly one federated Like (no duplicates)
    expect(c!.localLikeCount).toBe(1);         // counter matches (ungated increment → > 1)
  });

  it('boostRemoteContent: concurrent same-user boost → exactly one outbound Announce', async () => {
    const user = await createTestUser(h.db);
    const objectUri = `https://remote.test/o/${crypto.randomUUID().slice(0, 8)}`;
    const [content] = await h.db.insert(federatedContent).values({
      objectUri, actorUri: 'https://remote.test/u', originDomain: 'remote.test', apType: 'Note', content: 'hi',
    }).returning();

    // 25 concurrent boosts from the same user. Pre-fix there was no dedup at all →
    // every call queued another Announce. The fix makes boost idempotent.
    await Promise.all(Array.from({ length: 25 }, () =>
      boostRemoteContent(h.db, user.id, content!.id, 'local.test').catch(() => null),
    ));

    const actorUri = `https://local.test/users/${user.username}`;
    const announceActs = await h.db.select().from(activities).where(and(
      eq(activities.type, 'Announce'),
      eq(activities.actorUri, actorUri),
      eq(activities.objectUri, objectUri),
      eq(activities.direction, 'outbound'),
    ));
    expect(announceActs.length).toBe(1);       // exactly one federated Announce (no duplicates)
  });

  it('digest_runs claim: concurrent claims for one date → exactly one winner (multi-replica safety)', async () => {
    const date = '2099-12-31';
    const claim = async (): Promise<boolean> => {
      const r = await h.db.insert(digestRuns).values({ digestDate: date }).onConflictDoNothing({ target: digestRuns.digestDate }).returning();
      return r.length > 0;
    };
    const results = await Promise.all([claim(), claim(), claim(), claim(), claim()]);
    expect(results.filter(Boolean).length).toBe(1);
  });
});
