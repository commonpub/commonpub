import type { CookieDefinition } from './types.js';

/**
 * Analytics provider registry.
 *
 * One source of truth per provider for the three things that must never drift
 * apart: the origins the CSP has to allow, the origins the page will actually
 * talk to, and the cookies the policy page has to disclose. Deriving all three
 * from one record is what stops an instance shipping a working tracker with a
 * cookie policy that does not mention it, or a correct policy behind a CSP that
 * silently blocks the script.
 *
 * Pure data, no side effects, no DOM, no Nitro. It is imported by the security
 * middleware (server), the consent composable (both), and the loader plugin
 * (client), so it must stay dependency-free.
 */

/** Providers an instance can configure. `none` is the default: no analytics. */
export const ANALYTICS_PROVIDERS = ['none', 'ga4'] as const;
export type AnalyticsProvider = (typeof ANALYTICS_PROVIDERS)[number];

export interface AnalyticsProviderSpec {
  /** Human label for the admin UI and the privacy page. */
  label: string;
  /** The processor a visitor's data is shared with, named for disclosure. */
  processor: string;
  /** Where the vendor's policy lives, for the privacy page to link. */
  policyUrl: string;
  /** Origins that must be allowed in `script-src`. */
  scriptOrigins: string[];
  /** Origins that must be allowed in `connect-src` (beacons, XHR). */
  connectOrigins: string[];
  /**
   * Cookies this provider sets. `measurementId` is interpolated because GA4
   * names one of its cookies after the property, and a policy page listing
   * `_ga_<id>` literally would be wrong.
   */
  cookies: (measurementId: string) => CookieDefinition[];
}

export const ANALYTICS_PROVIDER_SPECS: Record<Exclude<AnalyticsProvider, 'none'>, AnalyticsProviderSpec> = {
  ga4: {
    label: 'Google Analytics 4',
    processor: 'Google LLC',
    policyUrl: 'https://policies.google.com/privacy',
    scriptOrigins: ['https://www.googletagmanager.com'],
    connectOrigins: [
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
    ],
    cookies: (measurementId) => [
      {
        name: '_ga',
        category: 'analytics',
        description: 'Google Analytics: distinguishes one visitor from another so repeat visits are not counted as new people. Contains a randomly generated id, not your name or email.',
        duration: '2 years',
        provider: 'Google LLC',
      },
      {
        // GA4 names this one after the property, so a policy page that printed
        // a literal placeholder would be telling the visitor the wrong name.
        name: `_ga_${measurementId.replace(/^G-/, '')}`,
        category: 'analytics',
        description: 'Google Analytics: keeps session state so a single visit is not counted as several.',
        duration: '2 years',
        provider: 'Google LLC',
      },
    ],
  },
};

/** Instance analytics settings. Absent or `provider: 'none'` means no analytics. */
export interface AnalyticsConfig {
  provider: AnalyticsProvider;
  /** The provider's property id, e.g. a GA4 `G-XXXXXXXXXX`. */
  measurementId?: string;
}

/** The spec for a configured provider, or null when analytics is off/unset. */
export function analyticsSpec(config: AnalyticsConfig | undefined): AnalyticsProviderSpec | null {
  if (!config || config.provider === 'none' || !config.measurementId) return null;
  return ANALYTICS_PROVIDER_SPECS[config.provider] ?? null;
}

/**
 * Cookies the configured provider will set, for the consent registry and the
 * cookie policy page. Empty when analytics is off, which is what keeps the
 * consent banner from appearing on an instance that tracks nothing.
 */
export function analyticsCookies(config: AnalyticsConfig | undefined): CookieDefinition[] {
  const spec = analyticsSpec(config);
  return spec ? spec.cookies(config!.measurementId!) : [];
}

/** CSP origins the configured provider needs. Empty when analytics is off. */
export function analyticsCspOrigins(
  config: AnalyticsConfig | undefined,
): { script: string[]; connect: string[] } {
  const spec = analyticsSpec(config);
  return spec
    ? { script: spec.scriptOrigins, connect: spec.connectOrigins }
    : { script: [], connect: [] };
}
