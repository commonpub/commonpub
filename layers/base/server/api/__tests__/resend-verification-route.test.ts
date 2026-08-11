/**
 * Static contract tests for the soft-verification resend route (session 253).
 *
 * These lock security properties, not behaviour, and every assertion here
 * corresponds to a way this endpoint could become a mail-bomb relay or an
 * account oracle:
 *
 *  - It must live OUTSIDE /api/auth. Everything under that prefix is dispatched
 *    by middleware/auth.ts via sendWebResponse, which ends the response, so the
 *    CSRF and global rate-limit middleware that run after it never execute.
 *  - It must never take the target address from the request body, or a session
 *    holder can mail anyone.
 *  - It must carry its own per-user limit. The global limiter is per two-segment
 *    path prefix (shared with every other /api/user route) and is disabled
 *    entirely outside production.
 *  - Better Auth's own unauthenticated send-verification-email must stay closed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiDir = resolve(__dirname, '..');
const route = readFileSync(resolve(apiDir, 'user', 'resend-verification.post.ts'), 'utf8');
const authMiddleware = readFileSync(
  resolve(__dirname, '..', '..', 'middleware', 'auth.ts'),
  'utf8',
);

describe('resend-verification route — contract', () => {
  it('requires a logged-in user', () => {
    expect(route).toMatch(/requireAuth\(\s*event\s*\)/);
  });

  it('takes the address from the SESSION, never from the request body', () => {
    expect(route).toMatch(/email:\s*user\.email/);
    // No body parsing at all: there is nothing a caller may supply.
    expect(route).not.toMatch(/parseBody|readBody/);
  });

  it('applies its own per-user rate limit and answers 429 with Retry-After', () => {
    expect(route).toMatch(/createRateLimitStore\(/);
    expect(route).toMatch(/store\.check\(\s*`user:\$\{user\.id\}`/);
    expect(route).toMatch(/statusCode:\s*429/);
    expect(route).toMatch(/'Retry-After'/);
  });

  it('no-ops silently rather than erroring, so it is not a config or account oracle', () => {
    // Feature off and already-verified both return the same shape as success.
    expect(route).toMatch(/features\.emailVerification/);
    expect(route).toMatch(/emailVerified === true/);
    expect(route.match(/return \{ ok: true \}/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('swallows transport failures instead of 500ing at the caller', () => {
    expect(route).toMatch(/catch\s*\(/);
    expect(route).toMatch(/console\.error\(/);
  });

  it("Better Auth's unauthenticated send-verification-email is closed off", () => {
    expect(authMiddleware).toMatch(
      /pathname === '\/api\/auth\/send-verification-email'/,
    );
    expect(authMiddleware).toMatch(/statusCode: 404/);
  });

  it('does not live under /api/auth, where CSRF and rate limiting are skipped', () => {
    // The path IS the security property, so assert it structurally.
    const rel = resolve(apiDir, 'user', 'resend-verification.post.ts');
    expect(rel).toContain('/api/user/');
    expect(rel).not.toContain('/api/auth/');
  });
});
