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
    description: 'Stores your cookie consent choice, and what you were asked about when you made it.',
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
  {
    name: 'cpub-persona-invite-dismissed',
    // Essential for the same reason as cpub-verify-dismissed: it records a
    // choice the user explicitly made (dismissing the invitation to fill in
    // their profile details), stores no identifier and does no tracking. It
    // holds a small decimal count, because two dismissals are terminal and a
    // consent-gated or session-scoped version would re-ask forever, which is
    // the nag this feature is designed not to be.
    //
    // Declaring it here is what makes it disclosed on /cookies. It is the ONLY
    // change the persona feature makes to this file, and it is provably safe:
    // `currentScope` below digests non-essential cookies only, so an essential
    // entry cannot move the consent scope digest and cannot re-prompt anyone.
    category: 'essential',
    description: 'Remembers that you dismissed the invitation to fill in your profile details. Set only when you dismiss it.',
    duration: '1 year',
  },
];

export type ConsentLevel = 'all' | 'essential' | null;

/**
 * CONSENT SCOPE — why the cookie carries more than a level.
 *
 * Consent is only valid for the purposes disclosed when it was given (GDPR
 * Art. 4(11): specific and informed). A bare `cpub-consent=all` cannot say what
 * the visitor was actually shown, so it silently authorises whatever the
 * instance adds later.
 *
 * That is not hypothetical. Between 2026-04-04 and 2026-06-10 the only
 * non-essential cookie was `cpub-color-scheme`, a dark-mode preference. Anyone
 * who clicked "Accept all" in that window consented to a THEME SETTING. The
 * cookie has a one-year lifetime, so when Google Analytics shipped in session
 * 253 those visitors were tracked immediately, with no banner and no new ask.
 * Verified live against deveco.io: a seeded `cpub-consent=all` produced two
 * vendor requests, a `/collect` beacon and both `_ga` cookies, banner never
 * shown.
 *
 * So the cookie stores `<level>|<scope>`, where scope is a digest of the
 * non-essential purposes AND their processors. Changing what is disclosed
 * changes the digest, which invalidates the old answer and re-asks. It derives
 * from the same registry that renders the policy page, so an operator who adds
 * a provider cannot forget to re-seek consent — there is nothing to remember.
 *
 * Switching GA4 property ids does NOT re-ask (same purpose, same processor).
 * Switching provider, or adding a category, DOES.
 */
function scopeDigest(parts: string[]): string {
  // FNV-1a, 32-bit. Deterministic and dependency-free, and it must produce the
  // identical value during SSR and again on hydration, so it is a pure string
  // function with no Date, no randomness and no platform APIs.
  let h = 0x811c9dc5;
  for (const s of parts) {
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(36);
}

/**
 * Split a stored cookie value into its level and the scope it was given under.
 *
 * Deliberately NOT exported: files in `composables/` are auto-imported, so an
 * export here becomes a global, and this has exactly one caller. It is covered
 * through `useCookieConsent`, which is the actual contract.
 */
function parseConsentCookie(raw: string | null | undefined): {
  level: ConsentLevel;
  scope: string | null;
} {
  if (!raw) return { level: null, scope: null };
  const sep = raw.indexOf('|');
  const levelPart = sep === -1 ? raw : raw.slice(0, sep);
  const level: ConsentLevel = levelPart === 'all' || levelPart === 'essential' ? levelPart : null;
  // A legacy unversioned value ("all" / "essential") has no scope, so it can
  // never match a current one. That is the point: it is re-asked exactly once.
  const scope = sep === -1 ? null : raw.slice(sep + 1) || null;
  return { level, scope };
}

/**
 * Cookie consent composable.
 *
 * Manages consent via an essential cookie (`cpub-consent`), which records both
 * the choice and the scope it was made under. Provides the full registry of
 * cookies (built-in + provider-derived + instance-custom) and guards for
 * checking whether a category is allowed.
 */
export function useCookieConsent(): {
  /** Whether the user has a CURRENT consent choice (a stale one does not count) */
  hasConsented: ComputedRef<boolean>;
  /** Current consent level as stored, which may predate what is disclosed now */
  consentLevel: Ref<ConsentLevel>;
  /** True when a choice exists but was made before the current disclosures */
  consentIsStale: ComputedRef<boolean>;
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

  // The RAW cookie value is shared app-wide via useState, not derived per-caller
  // from the cookie ref. Every `useCookieConsent()` call used to build its own
  // `useCookie` ref, so one caller writing consent did not synchronously notify
  // another — cross-consumer propagation relied on Nuxt's incidental
  // CookieStore/BroadcastChannel sync, which is async and browser-conditional.
  // That was harmless while nothing read `allowsAnalytics`; with the analytics
  // loader watching it, a grant or revoke has to land immediately and reliably.
  // Seeded from the request cookie so SSR and the first client render agree.
  const raw = useState<string | null>('cpub:consent-raw', () => consentCookie.value ?? null);

  const stored = computed(() => parseConsentCookie(raw.value));

  // Merge built-in cookies with instance-custom cookies from runtime config
  const runtimeConfig = useRuntimeConfig();
  const customCookies = computed<CookieDefinition[]>(() => {
    const val = (runtimeConfig.public as Record<string, unknown>).instanceCookies;
    return Array.isArray(val) ? val as CookieDefinition[] : [];
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

  /**
   * What the visitor is being asked about right now: every non-essential
   * purpose paired with the processor that receives the data. An operator can
   * additionally force a re-ask for a wording change by bumping
   * `instance.cookiePolicyVersion`.
   */
  const currentScope = computed(() => {
    const policyVersion =
      ((runtimeConfig.public as Record<string, unknown>).cookiePolicyVersion as string | undefined) ?? '1';
    const disclosed = cookies.value
      .filter((c) => c.category !== 'essential')
      .map((c) => `${c.category}:${c.provider ?? 'self'}`);
    return scopeDigest([policyVersion, ...Array.from(new Set(disclosed)).sort()]);
  });

  const isCurrentScope = computed(() => stored.value.scope === currentScope.value);

  /**
   * The choice as it can still be relied on today.
   *
   * A stale answer degrades rather than being discarded outright, because the
   * two directions are not symmetric:
   *   - a stale "all" GRANTS something the visitor was never shown, so it must
   *     count for nothing and be asked again;
   *   - a stale "essential" REFUSES, and re-asking someone who already refused
   *     adds friction while changing nothing about what runs. It is honoured.
   * Erring toward the refusing answer is also what keeps a scope change from
   * turning into an accidental opt-in.
   */
  const effectiveLevel = computed<ConsentLevel>(() => {
    const { level } = stored.value;
    if (level === null) return null;
    if (isCurrentScope.value) return level;
    return level === 'all' ? null : 'essential';
  });

  const consentLevel = computed<ConsentLevel>({
    get: () => stored.value.level,
    set: (v: ConsentLevel) => {
      const next = v === null ? null : `${v}|${currentScope.value}`;
      raw.value = next;
      consentCookie.value = next; // write through so the choice survives a reload
    },
  });

  // A stale grant is NOT consent. Everything below reads the degraded level, so
  // an "all" given under an older set of disclosures authorises nothing and the
  // banner asks again.
  const consentIsStale = computed(() => stored.value.level !== null && !isCurrentScope.value);
  const hasConsented = computed(() => effectiveLevel.value !== null);
  const allowsFunctional = computed(() => effectiveLevel.value === 'all');
  const allowsAnalytics = computed(() => effectiveLevel.value === 'all');

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
    consentIsStale,
    allowsFunctional,
    allowsAnalytics,
    acceptAll,
    acceptEssential,
    resetConsent,
    cookies,
    hasNonEssentialCookies,
  };
}
