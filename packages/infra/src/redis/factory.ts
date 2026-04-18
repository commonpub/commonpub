/**
 * Env-gated factory for rate-limit stores. Single entry point that callers
 * (IP middleware, per-API-key limiter) use so the memory-vs-Redis decision
 * lives in one place.
 *
 * Redis is selected if AND only if:
 *   1. `redisUrl` is a non-empty string, AND
 *   2. the `ioredis` package resolves at runtime.
 *
 * If either condition fails, we fall back to `MemoryRateLimitStore`. This
 * keeps the "unset env var = byte-identical to today" acceptance criterion
 * even when ioredis is not installed (e.g. production image without the
 * optional peer dep).
 *
 * The returned store is a plain `RateLimitStore` — callers never branch
 * on which concrete class they got.
 */
import { MemoryRateLimitStore, type RateLimitStore } from '../security.js';
import { createRedisClient } from './client.js';
import { RedisRateLimitStore } from './rateLimitStore.js';

export interface CreateRateLimitStoreOptions {
  /**
   * Redis connection URL, typically from `process.env.NUXT_REDIS_URL`.
   * Unset/empty → memory-backed store.
   */
  redisUrl?: string | undefined;
  /**
   * Key-prefix scope, so the two limiters (IP and API-key) don't collide.
   * Defaults to `cpub:ratelimit:ip`.
   */
  keyPrefix?: string;
  /**
   * Called whenever the Redis store falls open. Injected by consumers for
   * structured logging or metric emission.
   */
  onRedisError?: (error: unknown, context: { operation: string; key: string }) => void;
}

/**
 * Pseudo-async: always returns a store synchronously by wrapping the
 * promise from `createRedisClient`. Because the factory is called once at
 * boot (module load), we use the non-async helper below that defers the
 * actual Redis connection until first `check()`. This avoids any top-level
 * await in consuming modules.
 */
export function createRateLimitStore(options: CreateRateLimitStoreOptions = {}): RateLimitStore {
  const url = options.redisUrl?.trim();
  if (!url) {
    return new MemoryRateLimitStore();
  }

  const keyPrefix = options.keyPrefix ?? 'cpub:ratelimit:ip';
  return new LazyRedisRateLimitStore({
    url,
    keyPrefix,
    onError: options.onRedisError,
  });
}

/**
 * Thin wrapper that defers Redis client creation to the first `check()`
 * call. Before then, and any time the client fails to initialize, delegates
 * to a fallback `MemoryRateLimitStore` so callers never see an error from
 * the factory path.
 *
 * Why lazy instead of eager: `createRedisClient` is async (dynamic import
 * of the optional ioredis peer). If it were called at module load, every
 * consumer would need top-level await, which breaks CJS interop. Lazy
 * initialization keeps the factory synchronous and still amortizes the
 * cost to a single connection per URL.
 */
class LazyRedisRateLimitStore implements RateLimitStore {
  private initialized: Promise<RateLimitStore> | null = null;
  private readonly fallback = new MemoryRateLimitStore();

  constructor(
    private readonly params: {
      url: string;
      keyPrefix: string;
      onError: CreateRateLimitStoreOptions['onRedisError'];
    },
  ) {}

  async check(key: string, tier: Parameters<RateLimitStore['check']>[1]) {
    const store = await this.resolve();
    return store.check(key, tier);
  }

  async destroy(): Promise<void> {
    this.fallback.destroy();
    if (this.initialized) {
      const resolved = await this.initialized;
      await resolved.destroy();
    }
  }

  private async resolve(): Promise<RateLimitStore> {
    if (!this.initialized) {
      this.initialized = this.buildRedis();
    }
    return this.initialized;
  }

  private async buildRedis(): Promise<RateLimitStore> {
    try {
      const client = await createRedisClient({ url: this.params.url });
      if (!client) {
        this.params.onError?.(new Error('ioredis not installed or URL empty'), {
          operation: 'init',
          key: this.params.keyPrefix,
        });
        return this.fallback;
      }
      return new RedisRateLimitStore(client, {
        keyPrefix: this.params.keyPrefix,
        onError: this.params.onError,
      });
    } catch (err) {
      this.params.onError?.(err, { operation: 'init', key: this.params.keyPrefix });
      return this.fallback;
    }
  }
}
