/**
 * Redis-backed rate limit store.
 *
 * Fixed-window counter keyed by `cpub:ratelimit:<scope>:<key>:<windowStart>`.
 * The window rollover is deterministic from the client's clock + tier
 * windowMs, so two Nitro processes sharing one Redis cooperate on the same
 * bucket without any coordination beyond the atomic INCR. (Clock skew on
 * the order of tier.windowMs would shift the bucket; in practice all
 * workers live in the same VM/container so this is negligible.)
 *
 * Atomicity: a pipelined INCR + EXPIRE. The first incrementer in a window
 * sets the TTL to windowMs + a small jitter; subsequent incrementers leave
 * the TTL alone. If Redis evicts the key between INCR and EXPIRE (unlikely
 * with maxmemory-policy=allkeys-lru given rate-limit keys have TTL), the
 * worst case is one "leaked" key until allkeys-lru sweeps it.
 *
 * Fail-open: any error talking to Redis returns `allowed: true` with
 * `remaining: limit - 1` and a synthetic resetAt. The store logs a warning
 * and increments an internal counter that callers can read for metrics.
 * Rate-limit MUST NOT become a liveness hazard — the IP limiter in front
 * of auth routes is a defense-in-depth layer, not the only defense.
 */
import type { Redis } from 'ioredis';
import type { RateLimitStore, RateLimitTier, RateLimitResult } from '../security.js';

export interface RedisRateLimitStoreOptions {
  /**
   * Key namespace. Default `cpub:ratelimit` — two call sites (IP limiter
   * and per-API-key limiter) pass different scopes by nesting, e.g.
   * `cpub:ratelimit:ip` vs `cpub:ratelimit:apikey`.
   */
  keyPrefix?: string;
  /**
   * Called whenever a Redis operation fails and the store falls open.
   * Used by the env-gated factory to wire a metric/log sink.
   */
  onError?: (error: unknown, context: { operation: string; key: string }) => void;
}

interface FailOpenCounters {
  total: number;
  lastAt: number | null;
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly keyPrefix: string;
  private readonly onError: RedisRateLimitStoreOptions['onError'];
  private readonly failOpen: FailOpenCounters = { total: 0, lastAt: null };

  constructor(private readonly client: Redis, options: RedisRateLimitStoreOptions = {}) {
    this.keyPrefix = options.keyPrefix ?? 'cpub:ratelimit';
    this.onError = options.onError;
  }

  async check(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / tier.windowMs) * tier.windowMs;
    const windowEnd = windowStart + tier.windowMs;
    const redisKey = `${this.keyPrefix}:${key}:${windowStart}`;

    try {
      // Pipeline so both commands hit Redis in a single RTT.
      // EXPIRE with NX sets TTL only if the key has none — the first INCR
      // in a window sets it; later INCRs leave it.
      const pipeline = this.client.multi();
      pipeline.incr(redisKey);
      // pexpire with NX flag (ioredis supports the flag as an extra arg).
      pipeline.pexpire(redisKey, tier.windowMs + 1_000, 'NX');
      const results = await pipeline.exec();

      if (!results || results.length === 0) {
        return this.failOpenResult(tier, windowEnd, new Error('pipeline returned empty'), 'multi', redisKey);
      }

      const incrResult = results[0];
      if (!incrResult || incrResult[0]) {
        return this.failOpenResult(tier, windowEnd, incrResult?.[0] ?? new Error('incr missing'), 'incr', redisKey);
      }

      const count = Number(incrResult[1]);
      if (!Number.isFinite(count)) {
        return this.failOpenResult(tier, windowEnd, new Error(`incr returned non-numeric ${String(incrResult[1])}`), 'incr', redisKey);
      }

      if (count > tier.limit) {
        return { allowed: false, remaining: 0, resetAt: windowEnd };
      }

      return {
        allowed: true,
        remaining: Math.max(0, tier.limit - count),
        resetAt: windowEnd,
      };
    } catch (err) {
      return this.failOpenResult(tier, windowEnd, err, 'exec', redisKey);
    }
  }

  /**
   * Current fail-open counter — exposed for tests / metrics. Monotonic over
   * the lifetime of the process.
   */
  getFailOpenCount(): number {
    return this.failOpen.total;
  }

  destroy(): void {
    // The client is shared via the factory cache; we do NOT quit it here.
    // The runtime owns connection lifecycle.
  }

  private failOpenResult(
    tier: RateLimitTier,
    windowEnd: number,
    error: unknown,
    operation: string,
    key: string,
  ): RateLimitResult {
    this.failOpen.total += 1;
    this.failOpen.lastAt = Date.now();
    this.onError?.(error, { operation, key });
    return { allowed: true, remaining: tier.limit - 1, resetAt: windowEnd };
  }
}
