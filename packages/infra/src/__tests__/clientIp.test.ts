/**
 * Federation-hardening Item 9 — client-IP extraction from XFF / X-Real-IP.
 *
 * Before this helper, `layers/base/server/middleware/security.ts` and four
 * other callsites took the LEFTMOST X-Forwarded-For token as the client IP.
 * XFF is appended by each proxy, so the leftmost entry is whatever the
 * client put there — an attacker who rotates `X-Forwarded-For: random-IP`
 * gets a fresh rate-limit bucket every request, defeating the auth:5/min
 * brute-force tier.
 *
 * The fix is to read the RIGHTMOST token (index `length - 1`) by default
 * — that's the address appended by our last trusted proxy. For deployments
 * with N trusted proxies in series (CDN → nginx), the depth can be tuned
 * via `CPUB_TRUSTED_PROXY_DEPTH=N`, in which case we read index `length - N`.
 *
 * The 3 prod instances (commonpub.io, deveco.io, heatsynclabs.io) all run
 * Caddy with `header_up X-Forwarded-For {remote_host}` which OVERWRITES
 * XFF rather than appending — so the chain is always 1 token and depth=1
 * is correct without operator action.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { getClientIp } from '../clientIp.js';

const originalEnv = process.env.CPUB_TRUSTED_PROXY_DEPTH;
afterEach(() => {
  if (originalEnv === undefined) delete process.env.CPUB_TRUSTED_PROXY_DEPTH;
  else process.env.CPUB_TRUSTED_PROXY_DEPTH = originalEnv;
  vi.unstubAllGlobals();
});

/**
 * Build a minimal H3Event-shaped object that the helper can read headers
 * + socket remoteAddress off of. h3's `getRequestHeader` reads from
 * `event.node.req.headers`; the socket fallback reads `event.node.req.socket.remoteAddress`.
 */
function makeEvent(opts: {
  xff?: string;
  xRealIp?: string;
  remoteAddress?: string;
}): H3Event {
  return {
    node: {
      req: {
        headers: {
          ...(opts.xff !== undefined ? { 'x-forwarded-for': opts.xff } : {}),
          ...(opts.xRealIp !== undefined ? { 'x-real-ip': opts.xRealIp } : {}),
        },
        socket: { remoteAddress: opts.remoteAddress },
      },
    },
  } as unknown as H3Event;
}

describe('getClientIp — default depth=1 (matches Caddy overwrite + nginx single-proxy)', () => {
  it('returns the only XFF token when there is exactly one', () => {
    const event = makeEvent({ xff: '203.0.113.45' });
    expect(getClientIp(event)).toBe('203.0.113.45');
  });

  it('returns the RIGHTMOST token from a multi-proxy XFF chain (the attacker-spoof fix)', () => {
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1, 10.0.0.2' });
    expect(getClientIp(event)).toBe('10.0.0.2');
  });

  it('strips whitespace around tokens', () => {
    const event = makeEvent({ xff: '  198.51.100.7  ,  10.0.0.1  ' });
    expect(getClientIp(event)).toBe('10.0.0.1');
  });

  it('ignores empty tokens (handles `, , ` artifacts)', () => {
    const event = makeEvent({ xff: '1.2.3.4, , 10.0.0.1' });
    expect(getClientIp(event)).toBe('10.0.0.1');
  });

  it('falls back to X-Real-IP when XFF is missing', () => {
    const event = makeEvent({ xRealIp: '203.0.113.99' });
    expect(getClientIp(event)).toBe('203.0.113.99');
  });

  it('falls back to socket address when XFF and X-Real-IP are both missing', () => {
    const event = makeEvent({ remoteAddress: '198.51.100.42' });
    expect(getClientIp(event)).toBe('198.51.100.42');
  });

  it('returns the unknown sentinel as last resort', () => {
    const event = makeEvent({});
    expect(getClientIp(event)).toBe('unknown');
  });

  it('preserves IPv6 verbatim', () => {
    const event = makeEvent({ xff: '2606:4700:4700::1111' });
    expect(getClientIp(event)).toBe('2606:4700:4700::1111');
  });

  it('returns last token regardless of internal commas/spaces from a hostile sender', () => {
    // Attacker rotates the LEFTMOST tokens; the rightmost stays the trusted-proxy IP.
    const event = makeEvent({
      xff: 'attacker-spoof-1, attacker-spoof-2, 10.0.0.5',
    });
    expect(getClientIp(event)).toBe('10.0.0.5');
  });
});

describe('getClientIp — explicit trustedProxyDepth option (operator behind N proxies)', () => {
  it('depth=2 → returns the second-from-right token', () => {
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1, 10.0.0.2' });
    expect(getClientIp(event, { trustedProxyDepth: 2 })).toBe('10.0.0.1');
  });

  it('depth=3 → returns the third-from-right token', () => {
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1, 10.0.0.2' });
    expect(getClientIp(event, { trustedProxyDepth: 3 })).toBe('1.2.3.4');
  });

  it('depth larger than tokens clamps to leftmost', () => {
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1' });
    expect(getClientIp(event, { trustedProxyDepth: 99 })).toBe('1.2.3.4');
  });

  it('depth=0 skips XFF entirely and falls through to x-real-ip', () => {
    const event = makeEvent({ xff: 'spoofed', xRealIp: '203.0.113.7' });
    expect(getClientIp(event, { trustedProxyDepth: 0 })).toBe('203.0.113.7');
  });
});

describe('getClientIp — env-tunable CPUB_TRUSTED_PROXY_DEPTH', () => {
  beforeEach(() => { delete process.env.CPUB_TRUSTED_PROXY_DEPTH; });

  it('reads depth from env when no explicit option', () => {
    process.env.CPUB_TRUSTED_PROXY_DEPTH = '2';
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1, 10.0.0.2' });
    expect(getClientIp(event)).toBe('10.0.0.1');
  });

  it('explicit option overrides env', () => {
    process.env.CPUB_TRUSTED_PROXY_DEPTH = '3';
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1, 10.0.0.2' });
    expect(getClientIp(event, { trustedProxyDepth: 1 })).toBe('10.0.0.2');
  });

  it('ignores a non-numeric env value (falls back to depth=1)', () => {
    process.env.CPUB_TRUSTED_PROXY_DEPTH = 'not-a-number';
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1' });
    expect(getClientIp(event)).toBe('10.0.0.1');
  });

  it('ignores a negative env value (falls back to depth=1)', () => {
    process.env.CPUB_TRUSTED_PROXY_DEPTH = '-1';
    const event = makeEvent({ xff: '1.2.3.4, 10.0.0.1' });
    expect(getClientIp(event)).toBe('10.0.0.1');
  });
});
