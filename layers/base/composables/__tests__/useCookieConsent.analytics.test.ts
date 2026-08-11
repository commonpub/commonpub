/**
 * The consent gate, as it behaves once analytics is the thing being gated.
 *
 * Every assertion here is a way an instance could end up tracking someone who
 * did not agree, or disclosing a cookie it does not set. Both are the kind of
 * defect you find out about from a regulator rather than a bug report, so they
 * are locked rather than left to review.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { analyticsCookies } from '@commonpub/config/analytics';

const GA4 = { provider: 'ga4' as const, measurementId: 'G-1BEXT06G60' };

let publicConfig: Record<string, unknown> = {};
let cookieStore: Record<string, string | null> = {};
const stateStore = new Map<string, unknown>();

Object.assign(globalThis, {
  useRuntimeConfig: () => ({ public: publicConfig }),
  useCookie: (name: string) => {
    const r = ref(cookieStore[name] ?? null);
    return computed({
      get: () => r.value,
      set: (v: string | null) => { r.value = v; cookieStore[name] = v; },
    });
  },
  useState: <T>(key: string, init: () => T) => {
    if (!stateStore.has(key)) stateStore.set(key, ref(init()));
    return stateStore.get(key) as { value: T };
  },
  useAuth: () => ({ user: ref(null) }),
  // The flag now comes from useFeatures (DB-merged config), not from the
  // runtimeConfig mirror, so the stub has to provide it the same way.
  useFeatures: () => ({ analytics: computed(() => (publicConfig.features as { analytics?: boolean } | undefined)?.analytics === true) }),
  $fetch: vi.fn(async () => ({ ok: true })),
});

const { useCookieConsent } = await import('../useCookieConsent');

beforeEach(() => {
  cookieStore = {};
  stateStore.clear();
  publicConfig = {};
});

describe('cookie registry with analytics configured', () => {
  it('discloses the provider cookies automatically, without the operator listing them', () => {
    publicConfig = { features: { analytics: true }, analytics: GA4 };
    const names = useCookieConsent().cookies.value.map((c) => c.name);
    for (const expected of analyticsCookies(GA4).map((c) => c.name)) {
      expect(names, `${expected} must appear in the policy registry`).toContain(expected);
    }
  });

  it('discloses nothing when the flag is off, even with a provider configured', () => {
    // The flag is the operator off-switch. If it is off no tag loads, so
    // listing its cookies would be disclosing something that never happens.
    publicConfig = { features: { analytics: false }, analytics: GA4 };
    const names = useCookieConsent().cookies.value.map((c) => c.name);
    expect(names).not.toContain('_ga');
  });

  it('shows the banner only once there is something non-essential to ask about', () => {
    publicConfig = { features: { analytics: false } };
    expect(useCookieConsent().hasNonEssentialCookies.value).toBe(false);

    stateStore.clear();
    publicConfig = { features: { analytics: true }, analytics: GA4 };
    expect(useCookieConsent().hasNonEssentialCookies.value).toBe(true);
  });
});

describe('consent state', () => {
  beforeEach(() => {
    publicConfig = { features: { analytics: true }, analytics: GA4 };
  });

  it('withholds analytics until the visitor actively accepts', () => {
    const c = useCookieConsent();
    // No choice yet: not consent. Ignoring a banner is not agreement.
    expect(c.allowsAnalytics.value).toBe(false);
    c.acceptEssential();
    expect(c.allowsAnalytics.value).toBe(false);
    c.acceptAll();
    expect(c.allowsAnalytics.value).toBe(true);
  });

  it('propagates a change to a SECOND consumer synchronously', () => {
    // This is the whole reason the level moved to a shared useState. Each
    // caller used to build its own useCookie ref, so the banner accepting did
    // not notify the analytics loader except via Nuxt's async cookie sync.
    const banner = useCookieConsent();
    const loader = useCookieConsent();
    expect(loader.allowsAnalytics.value).toBe(false);
    banner.acceptAll();
    expect(loader.allowsAnalytics.value).toBe(true);
  });

  it('propagates a WITHDRAWAL too, so revoking actually stops collection', () => {
    const banner = useCookieConsent();
    const loader = useCookieConsent();
    banner.acceptAll();
    expect(loader.allowsAnalytics.value).toBe(true);
    banner.acceptEssential();
    expect(loader.allowsAnalytics.value).toBe(false);
  });

  it('writes the choice through to the cookie so it survives a reload', () => {
    useCookieConsent().acceptAll();
    expect(cookieStore['cpub-consent']).toBe('all');
  });
});
