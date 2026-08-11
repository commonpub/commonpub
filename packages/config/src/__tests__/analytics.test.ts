/**
 * The analytics provider registry is the single source of truth for three
 * things that must never disagree: the CSP origins, the cookies the policy page
 * discloses, and the processor named in the privacy page. These tests exist to
 * make a drift between them fail loudly, because the failure modes are silent
 * and bad in both directions: a tag that works with a cookie policy that does
 * not mention it, or a correct policy behind a CSP that blocks the script.
 */
import { describe, it, expect } from 'vitest';
import {
  ANALYTICS_PROVIDERS,
  ANALYTICS_PROVIDER_SPECS,
  analyticsSpec,
  analyticsCookies,
  analyticsCspOrigins,
} from '../analytics.js';
import { analyticsConfigSchema, configSchema } from '../schema.js';

const GA4 = { provider: 'ga4' as const, measurementId: 'G-1BEXT06G60' };

describe('analytics registry', () => {
  it('is off unless a provider AND a property id are both set', () => {
    // Half-configured must behave as OFF, not as a broken tracker: a provider
    // with no id would emit a gtag call with `undefined` as the property.
    expect(analyticsSpec(undefined)).toBeNull();
    expect(analyticsSpec({ provider: 'none' })).toBeNull();
    expect(analyticsSpec({ provider: 'ga4' })).toBeNull();
    expect(analyticsSpec(GA4)).not.toBeNull();
  });

  it('discloses no cookies and opens no CSP origins when off', () => {
    // This is what keeps the consent banner from appearing on an instance that
    // tracks nothing, and keeps a self-hoster's CSP tight by default.
    for (const off of [undefined, { provider: 'none' as const }, { provider: 'ga4' as const }]) {
      expect(analyticsCookies(off)).toEqual([]);
      expect(analyticsCspOrigins(off)).toEqual({ script: [], connect: [] });
    }
  });

  it('names the GA4 session cookie after the actual property', () => {
    // GA4 sets `_ga_<id-without-the-G->`. A policy page listing a literal
    // placeholder would be telling the visitor the wrong cookie name, which is
    // exactly the kind of detail a regulator checks.
    const names = analyticsCookies(GA4).map((c) => c.name);
    expect(names).toContain('_ga');
    expect(names).toContain('_ga_1BEXT06G60');
    expect(names.join(',')).not.toMatch(/undefined|G-1BEXT06G60/);
  });

  it('marks every derived cookie as analytics, so consent actually gates them', () => {
    // An `essential` mislabel here would silently bypass the consent gate.
    const cookies = analyticsCookies(GA4);
    expect(cookies.length).toBeGreaterThan(0);
    for (const c of cookies) {
      expect(c.category, `${c.name} must be consent-gated`).toBe('analytics');
      expect(c.description.length, `${c.name} needs a real description for the policy page`).toBeGreaterThan(30);
      expect(c.duration).toBeTruthy();
      expect(c.provider).toBeTruthy();
    }
  });

  it('every provider declares the origins its own script needs', () => {
    for (const id of ANALYTICS_PROVIDERS.filter((p) => p !== 'none')) {
      const spec = ANALYTICS_PROVIDER_SPECS[id as 'ga4'];
      expect(spec, `${id} has no spec`).toBeDefined();
      expect(spec.scriptOrigins.length).toBeGreaterThan(0);
      expect(spec.connectOrigins.length).toBeGreaterThan(0);
      // A tag whose script origin is not also reachable for beacons would load
      // and then fail silently at collect time.
      for (const o of [...spec.scriptOrigins, ...spec.connectOrigins]) {
        expect(o, `${id}: ${o} must be an https origin`).toMatch(/^https:\/\//);
      }
      expect(spec.processor, `${id} must name its processor for disclosure`).toBeTruthy();
      expect(spec.policyUrl).toMatch(/^https:\/\//);
    }
  });

  it('the script origin is always allowed to connect back', () => {
    // gtag.js is fetched from googletagmanager.com and also posts there.
    const { script, connect } = analyticsCspOrigins(GA4);
    for (const o of script) expect(connect, `${o} must also be in connect-src`).toContain(o);
  });
});

describe('analytics config validation', () => {
  it('rejects a malformed measurement id at config load, not at runtime', () => {
    expect(analyticsConfigSchema.safeParse({ provider: 'ga4', measurementId: 'UA-12345' }).success).toBe(false);
    expect(analyticsConfigSchema.safeParse({ provider: 'ga4', measurementId: 'nonsense' }).success).toBe(false);
    expect(analyticsConfigSchema.safeParse(GA4).success).toBe(true);
  });

  it('rejects a provider with no property id', () => {
    const r = analyticsConfigSchema.safeParse({ provider: 'ga4' });
    expect(r.success).toBe(false);
  });

  it('defaults to none, so an instance opts IN to being measured', () => {
    const r = analyticsConfigSchema.parse({});
    expect(r.provider).toBe('none');
  });

  it('the feature flag defaults off even when a provider is configured', () => {
    // Two independent switches on purpose: the config says "which provider",
    // the flag says "and it is switched on".
    const parsed = configSchema.parse({
      instance: { name: 'T', domain: 't.example', description: 'x' },
      analytics: GA4,
    });
    expect(parsed.features.analytics).toBe(false);
    expect(parsed.analytics?.measurementId).toBe('G-1BEXT06G60');
  });
});
