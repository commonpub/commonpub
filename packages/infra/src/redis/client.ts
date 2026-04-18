/**
 * Redis client factory for CommonPub.
 *
 * A single shared ioredis connection per Nitro process. Callers pass the URL
 * they want to connect to (typically from `process.env.NUXT_REDIS_URL`) and
 * receive the same client instance every time for that URL. This avoids
 * the connection-pool-exhaustion risk called out in the integration plan —
 * fan-out Lua scripts / pub-sub subscribers share one socket per process.
 *
 * The client is configured to reconnect automatically on transient failures.
 * Callers MUST NOT treat a connection error as fatal — rate limiting falls
 * back to "fail open" (see RedisRateLimitStore) and SSE pub/sub falls back
 * to in-process event emission (see realtime/pubsub.ts).
 */
import type { Redis, RedisOptions } from 'ioredis';

export interface RedisClient extends Redis {}

type IORedisCtor = new (url: string, options?: RedisOptions) => Redis;

const clientCache = new Map<string, Redis>();
let ioredisCtor: IORedisCtor | null = null;
let ioredisLoadAttempted = false;

async function loadIoredis(): Promise<IORedisCtor | null> {
  if (ioredisLoadAttempted) return ioredisCtor;
  ioredisLoadAttempted = true;
  try {
    // Dynamic import so ioredis stays an optional peer dep. Consumers that
    // never set NUXT_REDIS_URL don't need to install it.
    const mod = (await import('ioredis')) as unknown as { default: IORedisCtor };
    ioredisCtor = mod.default;
    return ioredisCtor;
  } catch {
    ioredisCtor = null;
    return null;
  }
}

/**
 * Get (or lazily create) a shared ioredis client for the given URL.
 *
 * Returns `null` if the `ioredis` package is not installed OR the URL is
 * empty. Callers must handle the null case and fall back to their
 * non-Redis behavior.
 */
export async function createRedisClient(params: {
  url: string | undefined;
  options?: RedisOptions;
}): Promise<Redis | null> {
  const url = params.url?.trim();
  if (!url) return null;

  const cached = clientCache.get(url);
  if (cached) return cached;

  const Ctor = await loadIoredis();
  if (!Ctor) return null;

  const client = new Ctor(url, {
    // Fast-fail config. The stores that consume this client (rate-limit,
    // pub/sub) all fall back cleanly when Redis is unreachable. What we
    // MUST avoid: the default ioredis behavior of queuing commands for
    // seconds while reconnecting — that turns a Redis blip into a request
    // pile-up across every Nitro worker.
    //
    //  * `enableOfflineQueue: false` — commands sent while disconnected
    //    reject immediately instead of sitting in a queue. Pub/sub SUBSCRIBE
    //    state is tracked separately by ioredis and replayed on reconnect,
    //    so this doesn't break realtime delivery.
    //  * `maxRetriesPerRequest: 1` — one retry, then the command rejects.
    //  * `commandTimeout: 500` — kills a command that hangs mid-flight on
    //    a healthy-looking-but-stuck socket (seen under packet loss).
    //  * `connectTimeout: 1000` — initial connect has a tight budget.
    //  * `lazyConnect: false` — start connecting eagerly so the first
    //    request doesn't pay the connect latency on top.
    //
    // Consumers that explicitly need different semantics (e.g. long
    // blocking reads — not used anywhere in CommonPub today) can override
    // via params.options.
    lazyConnect: false,
    enableOfflineQueue: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    commandTimeout: 500,
    connectTimeout: 1000,
    ...(params.options ?? {}),
  });

  // ioredis emits 'error' on every reconnection attempt. Silence the
  // unhandled-error crash by attaching a no-op listener; individual stores
  // log failures in context when they matter.
  client.on('error', () => {});

  clientCache.set(url, client);
  return client;
}

/** Test-only — drop cached clients and call .quit() on each. */
export async function resetRedisClientsForTests(): Promise<void> {
  const clients = Array.from(clientCache.values());
  clientCache.clear();
  await Promise.all(
    clients.map((c) => c.quit().catch(() => {
      c.disconnect();
    })),
  );
}
