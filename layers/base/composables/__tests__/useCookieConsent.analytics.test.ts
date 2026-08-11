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
    // The stored value carries the level AND the scope it was given under.
    expect(cookieStore['cpub-consent']).toMatch(/^all\|.+/);
  });
});

/**
 * Consent is only valid for what was disclosed when it was given.
 *
 * This is not a theoretical property. Between 2026-04-04 and 2026-06-10 the only
 * non-essential cookie was `cpub-color-scheme`, a dark-mode preference, so
 * "Accept all" meant "remember my theme". The cookie lasts a year. When GA4
 * shipped in session 253 those visitors were tracked on their next visit with no
 * banner and no new ask, which a live check against deveco.io confirmed: a
 * seeded `cpub-consent=all` produced two vendor requests, a /collect beacon and
 * both `_ga` cookies.
 *
 * Every test here is a way that could happen again.
 */
describe('consent scope', () => {
  const withCustomFunctional = {
    features: { analytics: false },
    instanceCookies: [
      { name: 'x-pref', category: 'functional', description: 'a preference', duration: '1 year' },
    ],
  };

  it('does NOT honour a legacy unversioned "all" once analytics is configured', () => {
    // The exact production bug, locked.
    cookieStore['cpub-consent'] = 'all';
    publicConfig = { features: { analytics: true }, analytics: GA4 };
    const c = useCookieConsent();
    expect(c.allowsAnalytics.value, 'a bare "all" predates analytics and cannot grant it').toBe(false);
    expect(c.hasConsented.value, 'so the banner must ask again').toBe(false);
    expect(c.consentIsStale.value).toBe(true);
  });

  it('does not silently carry consent across a change in what is asked about', () => {
    // Consent given when the only non-essential cookie was a theme preference.
    publicConfig = withCustomFunctional;
    useCookieConsent().acceptAll();
    const grantedUnderTheme = cookieStore['cpub-consent'];
    expect(grantedUnderTheme).toMatch(/^all\|/);

    // The operator now turns on analytics. Same visitor, same cookie.
    stateStore.clear();
    cookieStore['cpub-consent'] = grantedUnderTheme!;
    publicConfig = { ...withCustomFunctional, features: { analytics: true }, analytics: GA4 };

    const after = useCookieConsent();
    expect(after.allowsAnalytics.value, 'agreeing to a theme cookie is not agreeing to Google').toBe(false);
    expect(after.consentIsStale.value).toBe(true);
  });

  it('honours a choice made under the CURRENT disclosures', () => {
    publicConfig = { features: { analytics: true }, analytics: GA4 };
    useCookieConsent().acceptAll();
    const stored = cookieStore['cpub-consent'];

    stateStore.clear();
    cookieStore['cpub-consent'] = stored!;
    const returning = useCookieConsent();
    expect(returning.allowsAnalytics.value, 'a current answer must not be re-asked').toBe(true);
    expect(returning.hasConsented.value).toBe(true);
    expect(returning.consentIsStale.value).toBe(false);
  });

  it('re-asks when the PROCESSOR changes, not just the category', () => {
    // Same purpose ("analytics"), different company receiving the data. A scope
    // keyed only on category would carry the old answer over to a new recipient.
    publicConfig = { features: { analytics: true }, analytics: GA4 };
    useCookieConsent().acceptAll();
    const underGoogle = cookieStore['cpub-consent'];

    stateStore.clear();
    cookieStore['cpub-consent'] = underGoogle!;
    publicConfig = {
      features: { analytics: false },
      instanceCookies: [
        { name: 'plausible_ignore', category: 'analytics', description: 'other vendor', duration: '1 year', provider: 'Plausible Insights OU' },
      ],
    };
    expect(useCookieConsent().allowsAnalytics.value).toBe(false);
  });

  it('does NOT re-ask when only the measurement id changes', () => {
    // Same purpose, same processor, same cookies by shape. Re-prompting here
    // would train visitors to click through the banner without reading it.
    publicConfig = { features: { analytics: true }, analytics: GA4 };
    useCookieConsent().acceptAll();
    const stored = cookieStore['cpub-consent'];

    stateStore.clear();
    cookieStore['cpub-consent'] = stored!;
    publicConfig = {
      features: { analytics: true },
      analytics: { provider: 'ga4' as const, measurementId: 'G-DIFFERENT9' },
    };
    expect(useCookieConsent().allowsAnalytics.value).toBe(true);
  });

  it('lets an operator force a re-ask by bumping the cookie policy version', () => {
    publicConfig = { features: { analytics: true }, analytics: GA4, cookiePolicyVersion: '1' };
    useCookieConsent().acceptAll();
    const stored = cookieStore['cpub-consent'];

    stateStore.clear();
    cookieStore['cpub-consent'] = stored!;
    publicConfig = { features: { analytics: true }, analytics: GA4, cookiePolicyVersion: '2' };
    expect(useCookieConsent().allowsAnalytics.value).toBe(false);
  });

  it('honours a stale REFUSAL without re-asking, since it grants nothing either way', () => {
    // The asymmetry is deliberate. A stale "all" would authorise something new
    // and must be re-asked; a stale "essential" already refuses, so re-prompting
    // adds friction and changes nothing about what runs. It also means the
    // pre-answered `cpub-consent=essential` that every e2e spec relies on keeps
    // working across a disclosure change.
    cookieStore['cpub-consent'] = 'essential';
    publicConfig = { features: { analytics: true }, analytics: GA4 };
    const c = useCookieConsent();
    expect(c.allowsAnalytics.value, 'a refusal never grants').toBe(false);
    expect(c.hasConsented.value, 'and does not re-open the banner').toBe(true);
  });

  it('treats a corrupt or truncated cookie as no choice rather than as consent', () => {
    for (const junk of ['', 'yes', 'all|', '|deadbeef', 'ALL|deadbeef', 'all|wrong-digest']) {
      stateStore.clear();
      cookieStore['cpub-consent'] = junk;
      publicConfig = { features: { analytics: true }, analytics: GA4 };
      expect(useCookieConsent().allowsAnalytics.value, `"${junk}" must not grant analytics`).toBe(false);
    }
  });
});
