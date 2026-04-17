/**
 * Per-API-key rate limiter. In-process fixed window, Map-backed.
 *
 * This shares the limitation of the IP-based RateLimitStore (see
 * `packages/infra/src/security.ts`): state is lost on restart and NOT shared
 * across Nitro instances. That means a multi-instance deploy gives each
 * instance its own window — swap this for a Redis-backed implementation
 * before you scale horizontally. See codebase-analysis/12-scaling-and-
 * infrastructure.md.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the current window ends. */
  resetAt: number;
}

export class ApiKeyRateLimit {
  private buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  constructor(private readonly windowMs = 60_000) {}

  check(keyId: string, limit: number): RateLimitResult {
    const now = Date.now();
    this.maybeSweep(now);

    let bucket = this.buckets.get(keyId);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(keyId, bucket);
    }
    bucket.count++;

    const remaining = Math.max(0, limit - bucket.count);
    return {
      allowed: bucket.count <= limit,
      limit,
      remaining,
      resetAt: Math.floor(bucket.resetAt / 1000),
    };
  }

  /** Drop buckets whose window ended more than 5 minutes ago. */
  private maybeSweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    const cutoff = now - 5 * this.windowMs;
    for (const [id, bucket] of this.buckets) {
      if (bucket.resetAt < cutoff) this.buckets.delete(id);
    }
  }

  /** Test-only helper. */
  reset(): void {
    this.buckets.clear();
  }
}

/** Single process-wide instance so every Nitro handler shares the same state. */
export const apiKeyRateLimit = new ApiKeyRateLimit();
