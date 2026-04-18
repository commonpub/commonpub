/** Security utilities for HTTP responses — framework-agnostic.
 *
 *  Provides CSP generation, security headers, and rate limiting.
 *  Consumers (Nuxt/Nitro, Express, etc.) wire these into their own
 *  middleware / hook systems.
 */

// --- CSP ---

/** Build CSP directives with optional nonce for script-src */
export function buildCspDirectives(nonce?: string): Record<string, string> {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
  const styleSrc = nonce
    ? `'self' 'nonce-${nonce}' https://cdnjs.cloudflare.com`
    : "'self' 'unsafe-inline' https://cdnjs.cloudflare.com";
  return {
    'default-src': "'self'",
    'script-src': scriptSrc,
    'style-src': styleSrc,
    'img-src': "'self' data: https:",
    'font-src': "'self' https://cdnjs.cloudflare.com",
    'connect-src': "'self'",
    'frame-src': "'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
  };
}

/** Build a CSP header string from directives */
export function buildCspHeader(directives?: Record<string, string>): string {
  const dirs = directives ?? buildCspDirectives();
  return Object.entries(dirs)
    .map(([key, value]) => `${key} ${value}`)
    .join('; ');
}

/** Security headers applied to every response (static, without nonce) */
export function getSecurityHeaders(isDev: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  // HSTS only in production
  if (!isDev) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

/** Cache headers for static assets (hashed filenames) */
export function getStaticCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
}

/** Generate a CSP nonce */
export function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// --- Rate Limiting ---

/** Rate limit tier configuration */
export interface RateLimitTier {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Rate limit check result */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Abstract rate-limit store. Both in-memory and Redis implementations must
 * honor the same contract: `check` atomically increments the counter for
 * `key` within its current window and returns whether the request is allowed.
 * `destroy` releases any background resources (timers, Redis connections
 * owned by the store itself — shared clients are the factory's concern).
 *
 * `check` is async to accommodate Redis-backed stores. The in-process
 * implementation resolves synchronously under the hood, but callers must
 * always `await` so a store swap is invisible to call sites.
 */
export interface RateLimitStore {
  check(key: string, tier: RateLimitTier): Promise<RateLimitResult>;
  destroy(): void | Promise<void>;
}

/** Sliding window entry */
interface WindowEntry {
  count: number;
  resetAt: number;
}

/** In-memory rate limit store — default when NUXT_REDIS_URL is unset. */
export class MemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, WindowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically clean up expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /** Check if a key has exceeded its limit. Returns remaining requests. */
  async check(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
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

/**
 * Backwards-compat alias. `new RateLimitStore()` constructs a memory-backed
 * store; this keeps the 0.5.x shape working for consumers that already
 * instantiate the class directly. New code should prefer
 * `createRateLimitStore()` (which selects memory vs Redis from env) or
 * `new MemoryRateLimitStore()` if they explicitly want the memory impl.
 *
 * The name `RateLimitStore` exists in both the type namespace (the interface
 * above) and the value namespace (this const) — identical to how `Error`,
 * `Map`, etc. are both types and constructors.
 */
export const RateLimitStore: new () => RateLimitStore = MemoryRateLimitStore;

/** Default rate limit tiers by route prefix */
export const DEFAULT_TIERS: Record<string, RateLimitTier> = {
  auth: { limit: 5, windowMs: 60_000 },
  upload: { limit: 10, windowMs: 60_000 },
  social: { limit: 30, windowMs: 60_000 },
  federation: { limit: 60, windowMs: 60_000 },
  api: { limit: 60, windowMs: 60_000 },
  general: { limit: 120, windowMs: 60_000 },
};

/** Determine which tier applies to a given pathname */
export function getTierForPath(pathname: string): RateLimitTier {
  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/')) {
    return DEFAULT_TIERS.auth!;
  }
  if (pathname.startsWith('/api/files/upload')) {
    return DEFAULT_TIERS.upload!;
  }
  if (pathname.startsWith('/api/social/')) {
    return DEFAULT_TIERS.social!;
  }
  if (
    pathname.startsWith('/api/federation/') ||
    pathname.startsWith('/inbox') ||
    pathname.startsWith('/users/')
  ) {
    return DEFAULT_TIERS.federation!;
  }
  if (pathname.startsWith('/api/')) {
    return DEFAULT_TIERS.api!;
  }
  return DEFAULT_TIERS.general!;
}

/** Paths to skip rate limiting (static assets, health checks) */
export function shouldSkipRateLimit(pathname: string): boolean {
  return (
    pathname.startsWith('/_app/') ||
    pathname.startsWith('/_nuxt/') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.woff2')
  );
}

/**
 * Framework-agnostic rate limit check.
 * Returns the check result plus headers to set on the response.
 *
 * When userId is provided (authenticated request), the rate limit key
 * is based on the user ID instead of the IP. This prevents authenticated
 * users on shared IPs from being blocked by other users' traffic, and
 * gives them a separate quota.
 */
export async function checkRateLimit(
  store: RateLimitStore,
  ip: string,
  pathname: string,
  userId?: string,
): Promise<{ result: RateLimitResult; headers: Record<string, string> }> {
  const tier = getTierForPath(pathname);
  const routePrefix = pathname.split('/').slice(0, 3).join('/');
  const key = userId ? `user:${userId}:${routePrefix}` : `ip:${ip}:${routePrefix}`;
  const result = await store.check(key, tier);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(tier.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    headers['Retry-After'] = String(retryAfter);
  }

  return { result, headers };
}
