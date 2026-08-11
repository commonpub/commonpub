import { analyticsSpec } from '@commonpub/config/analytics';
import type { AnalyticsConfig } from '@commonpub/config/analytics';

/**
 * Consent-gated analytics loader.
 *
 * Does one job: given a configured provider, load its tag in a way that
 * respects the visitor's cookie choice. Everything about WHICH provider, which
 * origins and which cookies lives in the registry
 * (`@commonpub/config/analytics`), so this file never names a vendor property
 * and an instance that configures nothing loads nothing.
 *
 * ORDERING is the part that is easy to get wrong. Google Consent Mode v2
 * requires the `default` command to execute BEFORE gtag.js evaluates, or the
 * first hit fires with full storage regardless of what the visitor later
 * chooses. So the inline shim + defaults are injected synchronously here, and
 * the external script is only appended afterwards.
 *
 * We also never load the script before consent at all. Consent Mode's
 * "default denied" path still contacts Google with cookieless pings; refusing
 * to load until the visitor accepts is the stricter reading and the one that
 * matches what the privacy page promises. The defaults are still emitted so
 * that if consent arrives later in the session, the update is well-formed.
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SCRIPT_ID = 'cpub-analytics-tag';

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const config = runtimeConfig.public.analytics as AnalyticsConfig | undefined;

  // Two independent switches: the flag is the operator off-switch, the config
  // block says which provider. Either missing means this plugin does nothing.
  // The flag is read from useFeatures (DB-merged instance config), not from
  // runtimeConfig.public.features, which only mirrors a NUXT_PUBLIC_* env var.
  const { analytics: analyticsEnabled } = useFeatures();
  if (!analyticsEnabled.value) return;
  const spec = analyticsSpec(config);
  if (!spec) return;
  const measurementId = config!.measurementId!;

  const { allowsAnalytics } = useCookieConsent();
  const router = useRouter();

  // The gtag shim + Consent Mode v2 defaults. Everything denied until the
  // visitor says otherwise, including the ad signals we never use, because
  // Consent Mode treats an unspecified signal as unset rather than denied.
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]): void {
    window.dataLayer!.push(args);
  }
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500,
  });

  let loaded = false;
  let stopPageViews: (() => void) | null = null;

  function load(): void {
    if (loaded || document.getElementById(SCRIPT_ID)) return;
    loaded = true;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);

    gtag('js', new Date());
    // send_page_view is off on purpose: this is a single-page app, so the
    // library's automatic pageview would fire once for the whole session and
    // then never again. We send one explicitly per navigation below, which
    // gives exactly one event per route with the correct path and title.
    gtag('config', measurementId, { send_page_view: false, anonymize_ip: true });

    sendPageView(router.currentRoute.value.fullPath);
    stopPageViews = router.afterEach((to) => sendPageView(to.fullPath));
  }

  function sendPageView(path: string): void {
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_location: `${window.location.origin}${path}`,
      page_title: document.title,
    });
  }

  // React to the CHOICE, not just its initial value: a visitor can accept after
  // first refusing, and can withdraw later from the cookie policy page. Consent
  // state is shared app-wide (a single useState in useCookieConsent), so this
  // fires synchronously on either transition.
  watch(
    allowsAnalytics,
    (allowed) => {
      gtag('consent', 'update', {
        analytics_storage: allowed ? 'granted' : 'denied',
      });
      if (allowed) load();
      else if (loaded) {
        // The tag cannot be unloaded, but it can be told to stop, and we stop
        // feeding it navigations. Consent Mode handles the storage side.
        stopPageViews?.();
        stopPageViews = null;
      }
    },
    { immediate: true },
  );
});
