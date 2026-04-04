import type { CookieDefinition } from '@commonpub/config';

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
    category: 'functional',
    description: 'Remembers your light/dark mode preference across visits.',
    duration: '1 year',
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

  const consentLevel = computed<ConsentLevel>({
    get: () => {
      const val = consentCookie.value;
      if (val === 'all' || val === 'essential') return val;
      return null;
    },
    set: (v: ConsentLevel) => {
      consentCookie.value = v;
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

  const cookies = computed<CookieDefinition[]>(() => [
    ...BUILTIN_COOKIES,
    ...customCookies.value,
  ]);

  const hasNonEssentialCookies = computed(() =>
    cookies.value.some((c) => c.category !== 'essential'),
  );

  function acceptAll(): void {
    consentCookie.value = 'all';
  }

  function acceptEssential(): void {
    consentCookie.value = 'essential';
  }

  function resetConsent(): void {
    consentCookie.value = null;
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
