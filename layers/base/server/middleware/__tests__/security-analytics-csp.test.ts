/**
 * The CSP must open a third-party origin only when that third party is actually
 * switched on.
 *
 * Declaring a provider is not the same as enabling it: the reference app
 * declares one so its e2e can exercise the consent gate while leaving the flag
 * off. The first version of this middleware read only the config block, so
 * commonpub.io went live allowing googletagmanager in script-src while its own
 * privacy page correctly stated it uses no analytics.
 *
 * WHY THIS FILE WAS REWRITTEN (session 254). The previous version read
 * `security.ts` as TEXT and regex-matched it. That cannot work, and it was
 * proven not to: inverting the ternary so the vendor origin opened exactly when
 * analytics was OFF left all three assertions green, because the inverted code
 * still contained `features.analytics === true`, still contained
 * `{ script: [], connect: [] }`, and still called `analyticsCspOrigins(`. The
 * test matched the presence of the ingredients, never the behaviour.
 *
 * The decision now lives in `buildPageCsp`, a pure function, so these assert on
 * the directives it returns. A test that can read a value should never be
 * reading a source file.
 */
import { describe, it, expect } from 'vitest';
import { buildPageCsp } from '@commonpub/server';
import { analyticsCspOrigins } from '@commonpub/config/analytics';

const GA4 = { provider: 'ga4' as const, measurementId: 'G-TESTONLY1' };
const origins = analyticsCspOrigins(GA4);

/** Split a directive into its source list. */
const sources = (csp: Record<string, string>, directive: string): string[] =>
  (csp[directive] ?? '').split(/\s+/).filter(Boolean);

describe('page CSP: analytics origins', () => {
  it('opens the vendor origins when the flag is ON', () => {
    const csp = buildPageCsp({ isDev: false, analyticsEnabled: true, analyticsOrigins: origins });
    for (const origin of origins.script) {
      expect(sources(csp, 'script-src'), `script-src must allow ${origin}`).toContain(origin);
    }
    for (const origin of origins.connect) {
      expect(sources(csp, 'connect-src'), `connect-src must allow ${origin}`).toContain(origin);
    }
  });

  it('opens NOTHING when the flag is off, even with a provider configured', () => {
    // This is the direction that shipped broken. A declared provider must not be
    // enough: commonpub.io declares none, but any instance that declares one and
    // leaves the flag off must keep the tight default.
    const csp = buildPageCsp({ isDev: false, analyticsEnabled: false, analyticsOrigins: origins });
    const all = Object.values(csp).join(' ');
    expect(all, 'no vendor origin may appear anywhere in the policy').not.toMatch(
      /googletagmanager|google-analytics|analytics\.google/,
    );
  });

  it('is byte-identical to the no-analytics policy when the flag is off', () => {
    // Stronger than "no vendor host appears": proves the flag-off path cannot
    // differ from an instance that has no analytics configured at all.
    const off = buildPageCsp({ isDev: false, analyticsEnabled: false, analyticsOrigins: origins });
    const none = buildPageCsp({
      isDev: false,
      analyticsEnabled: false,
      analyticsOrigins: { script: [], connect: [] },
    });
    expect(off).toEqual(none);
  });

  it('appends rather than assigns, so the dev HMR sources survive', () => {
    // A bare assignment to connect-src after the dev block would drop ws:/wss:
    // and silently break hot reload for anyone running analytics locally.
    const csp = buildPageCsp({ isDev: true, analyticsEnabled: true, analyticsOrigins: origins });
    const connect = sources(csp, 'connect-src');
    expect(connect).toContain('ws:');
    expect(connect).toContain('wss:');
    expect(connect).toContain("'self'");
    for (const origin of origins.connect) expect(connect).toContain(origin);
  });

  it('keeps the baseline directives regardless of analytics', () => {
    for (const analyticsEnabled of [true, false]) {
      const csp = buildPageCsp({ isDev: false, analyticsEnabled, analyticsOrigins: origins });
      expect(csp['frame-ancestors'], 'clickjacking guard').toBe("'none'");
      expect(csp['default-src']).toBe("'self'");
      expect(csp['base-uri']).toBe("'self'");
      expect(csp['form-action']).toBe("'self'");
    }
  });

  it('does not leak dev-only relaxations into production', () => {
    const prod = buildPageCsp({ isDev: false, analyticsEnabled: true, analyticsOrigins: origins });
    expect(sources(prod, 'script-src')).not.toContain("'unsafe-eval'");
    expect(sources(prod, 'connect-src')).not.toContain('ws:');
    expect(prod['worker-src']).toBeUndefined();
  });

  it('names no vendor host of its own', () => {
    // Everything vendor-specific must come from the provider registry, so an
    // instance that configures nothing can never reach a third party.
    const csp = buildPageCsp({
      isDev: false,
      analyticsEnabled: true,
      analyticsOrigins: { script: [], connect: [] },
    });
    expect(Object.values(csp).join(' ')).not.toMatch(/googletagmanager|google-analytics/);
  });
});
