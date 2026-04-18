import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  RedisRateLimitStore,
  RedisRealtimePubSub,
  createRedisClient,
  resetRedisClientsForTests,
  type RedisClient,
} from '../index.js';

/**
 * Integration test against a live Redis. Skipped unless REDIS_URL_TEST is
 * set — mirrors the pattern used for pglite-skipped DB tests elsewhere in
 * the repo. CI can opt in by spinning up a Redis sidecar and exporting
 * REDIS_URL_TEST; the default local run skips this file.
 *
 * The test flushes a test-only key prefix on setup/teardown so it's safe
 * to point at a Redis shared with a dev environment.
 */

const REDIS_URL = process.env.REDIS_URL_TEST;
const TEST_PREFIX = 'cpub:test:redis-integration';

const describeIfRedis = REDIS_URL ? describe : describe.skip;

describeIfRedis('RedisRateLimitStore (integration)', () => {
  let client: RedisClient;

  beforeAll(async () => {
    const c = await createRedisClient({ url: REDIS_URL });
    if (!c) throw new Error('ioredis missing but REDIS_URL_TEST is set');
    client = c;
    // Wait for ready — ioredis connects lazily.
    if (client.status !== 'ready') {
      await new Promise<void>((resolve, reject) => {
        const ok = () => { cleanup(); resolve(); };
        const fail = (e: Error) => { cleanup(); reject(e); };
        const cleanup = () => {
          client.off('ready', ok);
          client.off('error', fail);
        };
        client.once('ready', ok);
        client.once('error', fail);
      });
    }
    await flushTestKeys(client);
  });

  afterAll(async () => {
    if (client) await flushTestKeys(client);
    await resetRedisClientsForTests();
  });

  it('two stores sharing one Redis enforce the same limit', async () => {
    // Mimics two Nitro processes: two RedisRateLimitStore instances (with
    // their own onError hooks) pointed at the same Redis, same keyPrefix.
    // The acceptance criterion from the plan: limit is enforced across
    // the pair.
    const store1 = new RedisRateLimitStore(client, { keyPrefix: `${TEST_PREFIX}:shared` });
    const store2 = new RedisRateLimitStore(client, { keyPrefix: `${TEST_PREFIX}:shared` });
    const tier = { limit: 3, windowMs: 5_000 };

    // Three allowed, split across stores.
    const r1 = await store1.check('user-1', tier);
    const r2 = await store2.check('user-1', tier);
    const r3 = await store1.check('user-1', tier);
    expect([r1.allowed, r2.allowed, r3.allowed]).toEqual([true, true, true]);

    // Fourth (on either store) must be rejected.
    const r4 = await store2.check('user-1', tier);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('different keys do not share buckets', async () => {
    const store = new RedisRateLimitStore(client, { keyPrefix: `${TEST_PREFIX}:sep` });
    const tier = { limit: 1, windowMs: 5_000 };
    const a = await store.check('alice', tier);
    const b = await store.check('bob', tier);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it('window rolls over (short-window check)', async () => {
    const store = new RedisRateLimitStore(client, { keyPrefix: `${TEST_PREFIX}:window` });
    const tier = { limit: 1, windowMs: 1_000 };
    await store.check('k', tier);
    const blocked = await store.check('k', tier);
    expect(blocked.allowed).toBe(false);
    // Wait for bucket rollover (1s window + pexpire TTL).
    await new Promise((r) => setTimeout(r, 1_200));
    const fresh = await store.check('k', tier);
    expect(fresh.allowed).toBe(true);
  });
});

describeIfRedis('RedisRealtimePubSub (integration)', () => {
  let publisher: RedisClient;
  let subscriber: RedisClient;

  beforeAll(async () => {
    publisher = (await createRedisClient({ url: REDIS_URL }))!;
    // `.duplicate()` opens a second socket sharing the URL/options. Pub/sub
    // subscribe-mode restrictions then apply only to this subscriber.
    subscriber = publisher.duplicate();
    subscriber.on('error', () => {});
    await new Promise<void>((resolve) => {
      if (subscriber.status === 'ready') return resolve();
      subscriber.once('ready', () => resolve());
    });
  });

  afterAll(async () => {
    try { await subscriber.quit(); } catch { subscriber.disconnect(); }
    await resetRedisClientsForTests();
  });

  it('publish on one bus reaches a subscriber on another', async () => {
    // Two pub/sub wrappers sharing the same Redis — one publishes, the
    // other subscribes. Mirrors the "two Nitro processes" scenario.
    //
    // The duplicate overrides `enableOfflineQueue: true` and
    // `maxRetriesPerRequest: null` to match what `createRealtimePubSub`
    // does in production — SUBSCRIBE commands must be queued during
    // reconnect so ioredis can replay them.
    const subA = subscriber.duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null });
    const subB = subscriber.duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null });
    subA.on('error', () => {});
    subB.on('error', () => {});
    await Promise.all([subA, subB].map((c) => new Promise<void>((resolve) => {
      if (c.status === 'ready') return resolve();
      c.once('ready', () => resolve());
    })));

    const busA = new RedisRealtimePubSub(publisher, subA);
    const busB = new RedisRealtimePubSub(publisher, subB);

    const received: unknown[] = [];
    await busB.subscribe(`${TEST_PREFIX}:pubsub:u1`, (p) => received.push(p));
    // Give Redis a moment to process the SUBSCRIBE before we publish.
    await new Promise((r) => setTimeout(r, 50));

    await busA.publish(`${TEST_PREFIX}:pubsub:u1`, { type: 'notification' });
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toEqual([{ type: 'notification' }]);

    await busA.close();
    await busB.close();
  });
});

async function flushTestKeys(client: RedisClient): Promise<void> {
  const pattern = `${TEST_PREFIX}:*`;
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(...keys);
  }
}
