import type { CookieDefinition } from '@commonpub/config';
import { analyticsCookies } from '@commonpub/config/analytics';
import type { AnalyticsConfig } from '@commonpub/config/analytics';

/**
 * Built-in CommonPub cookies. Instance operators add theirs via
 * `cookies` in commonpub.config.ts — those are merged at runtime.
 */
const BUILTIN_COOKIES: CookieDefinition[] = [
  {
    name: 'better-auth.session_token',
    category: 'essential',
    description: 'Authenticates your login session. HttpOnly and secure.',
    duration: '7 days',
  },
  {
    name: 'cpub-consent',
    category: 'essential',
    description: 'Stores your cookie consent choice.',
    duration: '1 year',
  },
  {
    name: 'cpub-color-scheme',
    // Essential, not functional: it's a preference the user explicitly
    // requests by pressing the Light/Dark toggle (consent-exempt class:
    // stores no identifier, does no tracking). When it was consent-gated,
    // anyone on "Essential only" lost their theme on every refresh.
    category: 'essential',
    description: 'Remembers your light/dark mode preference. Set only when you use the theme toggle.',
    duration: '1 year',
  },
  {
    name: 'cpub-verify-dismissed',
    // Essential for the same reason as cpub-color-scheme: it records a choice
    // the user explicitly made (dismissing the confirm-your-email reminder),
    // stores no identifier and does no tracking. Consent-gating it would mean
    // the reminder reappeared on every page for anyone on "Essential only".
    category: 'essential',
    description: 'Remembers that you dismissed the email confirmation reminder. Set only when you dismiss it.',
    duration: 'Until you close your browser',
  },
];

export type ConsentLevel = 'all' | 'essential' | null;

/**
 * Cookie consent composable.
 *
 * Manages consent state via an essential cookie (`cpub-consent`).
 * Provides the full registry of cookies (built-in + instance-custom)
 * and guards for checking whether a category is allowed.
 */
export function useCookieConsent(): {
  /** Whether the user has made a consent choice */
  hasConsented: ComputedRef<boolean>;
  /** Current consent level */
  consentLevel: Ref<ConsentLevel>;
  /** Whether functional cookies are allowed */
  allowsFunctional: ComputedRef<boolean>;
  /** Whether analytics cookies are allowed */
  allowsAnalytics: ComputedRef<boolean>;
  /** Accept all cookie categories */
  acceptAll: () => void;
  /** Accept only essential cookies */
  acceptEssential: () => void;
  /** Reset consent (re-shows banner) */
  resetConsent: () => void;
  /** Full cookie registry (built-in + custom) */
  cookies: ComputedRef<CookieDefinition[]>;
  /** Whether the banner has non-essential cookies to ask about */
  hasNonEssentialCookies: ComputedRef<boolean>;
} {
  const consentCookie = useCookie<string | null>('cpub-consent', {
    maxAge: 31536000,
    path: '/',
    sameSite: 'lax',
  });

  // The LEVEL is shared app-wide via useState, not derived per-caller from the
  // cookie ref. Every `useCookieConsent()` call used to build its own
  // `useCookie` ref, so one caller writing consent did not synchronously notify
  // another — cross-consumer propagation relied on Nuxt's incidental
  // CookieStore/BroadcastChannel sync, which is async and browser-conditional.
  // That was harmless while nothing read `allowsAnalytics`; with the analytics
  // loader watching it, a grant or revoke has to land immediately and reliably.
  // Seeded from the request cookie so SSR and the first client render agree.
  const state = useState<ConsentLevel>('cpub:consent-level', () => {
    const val = consentCookie.value;
    return val === 'all' || val === 'essential' ? val : null;
  });

  const consentLevel = computed<ConsentLevel>({
    get: () => state.value,
    set: (v: ConsentLevel) => {
      state.value = v;
      consentCookie.value = v; // write through so the choice survives a reload
    },
  });

  const hasConsented = computed(() => consentLevel.value !== null);
  const allowsFunctional = computed(() => consentLevel.value === 'all');
  const allowsAnalytics = computed(() => consentLevel.value === 'all');

  // Merge built-in cookies with instance-custom cookies from runtime config
  const runtimeConfig = useRuntimeConfig();
  const customCookies = computed<CookieDefinition[]>(() => {
    const raw = (runtimeConfig.public as Record<string, unknown>).instanceCookies;
    return Array.isArray(raw) ? raw as CookieDefinition[] : [];
  });

  // Cookies the configured analytics provider will set, DERIVED from the
  // provider registry rather than hand-declared. An operator turning on GA4
  // cannot forget to list `_ga` in the policy, and the two cannot drift.
  // The flag comes from useFeatures, NOT runtimeConfig.public.features.
  // Those are two different mirrors: the runtimeConfig one only reflects a
  // NUXT_PUBLIC_FEATURES_* env var, while useFeatures is primed from the
  // DB-merged instance config, which is what an operator actually toggles.
  // Reading the wrong one meant the flag looked off with analytics enabled.
  const { analytics: analyticsEnabled } = useFeatures();
  const analyticsCookieDefs = computed<CookieDefinition[]>(() => {
    if (!analyticsEnabled.value) return [];
    return analyticsCookies(
      (runtimeConfig.public as Record<string, unknown>).analytics as AnalyticsConfig | undefined,
    );
  });

  const cookies = computed<CookieDefinition[]>(() => [
    ...BUILTIN_COOKIES,
    ...analyticsCookieDefs.value,
    ...customCookies.value,
  ]);

  const hasNonEssentialCookies = computed(() =>
    cookies.value.some((c) => c.category !== 'essential'),
  );

  // GDPR Phase 2: when a logged-in user makes a cookie choice, also record it
  // server-side (audit trail). Best-effort + client-only; anonymous users keep the
  // cookie-only mechanism. `useAuth` is read here in setup context so the click
  // handlers can reference `user.value` safely.
  const { user } = useAuth();
  function recordCookieConsent(): void {
    if (typeof window === 'undefined' || !user.value) return;
    $fetch('/api/consent', { method: 'POST', body: { kind: 'cookies' } }).catch(() => {});
  }

  function acceptAll(): void {
    consentLevel.value = 'all';
    recordCookieConsent();
  }

  function acceptEssential(): void {
    consentLevel.value = 'essential';
    recordCookieConsent();
  }

  function resetConsent(): void {
    consentLevel.value = null;
  }

  return {
    hasConsented,
    consentLevel,
    allowsFunctional,
    allowsAnalytics,
    acceptAll,
    acceptEssential,
    resetConsent,
    cookies,
    hasNonEssentialCookies,
  };
}
