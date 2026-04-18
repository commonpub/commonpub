/**
 * Per-API-key rate limiter.
 *
 * Delegates to a shared `RateLimitStore` from `@commonpub/infra`. When
 * `NUXT_REDIS_URL` is set, the module-level singleton uses the Redis store
 * so rate limits are enforced across Nitro instances; unset falls back to
 * in-process memory, same behavior as sessions 127–129.
 *
 * The public shape of `ApiKeyRateLimit` and `apiKeyRateLimit` is preserved
 * (same export names, same method names, same result fields) but `check`
 * is now async. Callers must `await` — the Nitro middleware does.
 */
import {
  createRateLimitStore,
  MemoryRateLimitStore,
  type RateLimitStore,
  type RateLimitTier,
} from '@commonpub/infra';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the current window ends. */
  resetAt: number;
}

export class ApiKeyRateLimit {
  private store: RateLimitStore;
  private readonly windowMs: number;
  private readonly ownsStore: boolean;

  /**
   * @param windowMs  Fixed-window duration in ms (default 60 000).
   * @param store     Optional store override. Tests pass a fresh
   *                  `MemoryRateLimitStore` so state is isolated. When
   *                  omitted, a new memory store is created — use the
   *                  process-wide `apiKeyRateLimit` singleton in app code.
   */
  constructor(windowMs = 60_000, store?: RateLimitStore) {
    this.windowMs = windowMs;
    this.store = store ?? new MemoryRateLimitStore();
    this.ownsStore = store === undefined;
  }

  async check(keyId: string, limit: number): Promise<RateLimitResult> {
    const tier: RateLimitTier = { limit, windowMs: this.windowMs };
    const result = await this.store.check(keyId, tier);
    return {
      allowed: result.allowed,
      limit,
      remaining: result.remaining,
      resetAt: Math.floor(result.resetAt / 1000),
    };
  }

  /** Test-only — drop bucket state (memory store). */
  async reset(): Promise<void> {
    if (this.ownsStore) {
      await this.store.destroy();
      // Replace the inner store so subsequent checks get a clean window.
      this.store = new MemoryRateLimitStore();
    }
  }
}

/**
 * Single process-wide instance so every Nitro handler shares the same state.
 * Selects Redis automatically when `NUXT_REDIS_URL` is set; otherwise memory.
 * The key namespace is `cpub:ratelimit:apikey` so it can't collide with the
 * IP limiter (which defaults to `cpub:ratelimit:ip`).
 */
export const apiKeyRateLimit: ApiKeyRateLimit = new ApiKeyRateLimit(
  60_000,
  createRateLimitStore({
    redisUrl: process.env.NUXT_REDIS_URL,
    keyPrefix: 'cpub:ratelimit:apikey',
  }),
);
