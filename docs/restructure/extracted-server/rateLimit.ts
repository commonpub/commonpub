import type { Handle } from '@sveltejs/kit';

/** Rate limit tier configuration */
export interface RateLimitTier {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Sliding window entry */
interface WindowEntry {
  count: number;
  resetAt: number;
}

/** In-memory rate limit store */
export class RateLimitStore {
  private windows = new Map<string, WindowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically clean up expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /** Check if a key has exceeded its limit. Returns remaining requests. */
  check(
    key: string,
    tier: RateLimitTier,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || now >= existing.resetAt) {
      // New window
      const entry: WindowEntry = { count: 1, resetAt: now + tier.windowMs };
      this.windows.set(key, entry);
      return { allowed: true, remaining: tier.limit - 1, resetAt: entry.resetAt };
    }

    existing.count++;
    if (existing.count > tier.limit) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    return { allowed: true, remaining: tier.limit - existing.count, resetAt: existing.resetAt };
  }

  /** Remove expired entries */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }

  /** Stop the cleanup interval (for tests/shutdown) */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/** Default rate limit tiers by route prefix */
export const DEFAULT_TIERS: Record<string, RateLimitTier> = {
  auth: { limit: 5, windowMs: 60_000 },
  social: { limit: 30, windowMs: 60_000 },
  federation: { limit: 60, windowMs: 60_000 },
  api: { limit: 60, windowMs: 60_000 },
  general: { limit: 120, windowMs: 60_000 },
};

/** Determine which tier applies to a given pathname */
export function getTierForPath(pathname: string): RateLimitTier {
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/')) {
    return DEFAULT_TIERS.auth;
  }
  if (pathname.startsWith('/api/social/')) {
    return DEFAULT_TIERS.social;
  }
  if (pathname.startsWith('/api/federation/') || pathname.startsWith('/inbox') || pathname.startsWith('/users/')) {
    return DEFAULT_TIERS.federation;
  }
  if (pathname.startsWith('/api/')) {
    return DEFAULT_TIERS.api;
  }
  return DEFAULT_TIERS.general;
}

/** Paths to skip rate limiting (static assets, health checks) */
function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith('/_app/') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.woff2')
  );
}

/** Create a rate limiting SvelteKit handle hook */
export function createRateLimitHook(store: RateLimitStore = new RateLimitStore()): Handle {
  return async ({ event, resolve }) => {
    const pathname = event.url.pathname;

    if (shouldSkip(pathname)) {
      return resolve(event);
    }

    const ip = event.getClientAddress();
    const tier = getTierForPath(pathname);
    const key = `${ip}:${pathname.split('/').slice(0, 3).join('/')}`;
    const result = store.check(key, tier);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(tier.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      });
    }

    const response = await resolve(event);
    response.headers.set('X-RateLimit-Limit', String(tier.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    return response;
  };
}
