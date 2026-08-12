import { analyticsSpec, analyticsCookies } from '@commonpub/config/analytics';
import type { AnalyticsConfig } from '@commonpub/config/analytics';
import type { RouteLocationNormalized } from 'vue-router';
// Imported explicitly rather than relying on the utils/ auto-import: a plugin
// is not app code, and a silently-missing auto-import here would mean private
// routes were measured.
import { isPrivateRoute, publicPath } from '../utils/analyticsRoutes';

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
 *
 * WHAT IS SENT is deliberately narrower than what gtag would send by default.
 * The privacy page promises that nothing typed into a form and nothing behind a
 * login reaches the processor, and that withdrawing stops collection. Each of
 * those promises is kept by code below rather than by intention:
 *   - the query string is stripped from every URL (session 254: a live check
 *     found `/search?q=my+secret+search+term` reaching Google in the `dl`
 *     parameter of a `view_search_results` hit);
 *   - routes that declare the `auth` middleware send nothing at all (their
 *     titles carry real data: `/messages/:id` renders "Message, <person>");
 *   - withdrawing denies storage, stops feeding the tag navigations and
 *     deletes its cookies, re-enforced on every subsequent load.
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
  // Pushes `arguments`, NOT an array. This is Google's canonical shim and the
  // deviation is not cosmetic: with an array, gtag.js loaded and initialised the
  // property but never sent a hit and never set `_ga`, so the site looked
  // instrumented and measured nothing. Verified against the live property.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-rest-params
  function gtag(): void {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  }
  window.gtag = gtag as unknown as (...args: unknown[]) => void;
  const send = window.gtag!;
  send('consent', 'default', {
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

    send('js', new Date());
    // `set` before `config`, so the very first hit already carries the
    // sanitised location. This is also what makes the promise hold for events
    // we never send ourselves: GA4's enhanced measurement (scrolls, outbound
    // clicks, downloads, site search, video) builds its own hits, and they
    // inherit whatever `set` last established rather than reading
    // document.location. Without this, enhanced measurement re-introduced the
    // query string we had just stripped.
    applyLocation(router.currentRoute.value);
    // send_page_view is off on purpose: this is a single-page app, so the
    // library's automatic pageview would fire once for the whole session and
    // then never again. We send one explicitly per navigation below, which
    // gives exactly one event per route with the correct path and title.
    //
    // anonymize_ip is NOT passed: it is a Universal Analytics parameter and a
    // documented no-op in GA4, where IP anonymisation is always on and cannot
    // be configured. Passing it suggested a control that does not exist.
    send('config', measurementId, { send_page_view: false });

    sendPageView(router.currentRoute.value);
    stopPageViews = router.afterEach((to) => sendPageView(to));
  }

  /**
   * Point the tag at a sanitised address, for our hits and the vendor's own.
   *
   * On a private route this deliberately sets a PLACEHOLDER rather than simply
   * skipping. Skipping is not neutral: with nothing set, gtag falls back to
   * `document.location`, so landing directly on `/messages/:id` would hand the
   * vendor the real path and the title, which renders as "Message, <person>".
   * Automatic events on those pages are attributed to a bucket instead.
   */
  function applyLocation(route: RouteLocationNormalized): void {
    const priv = isPrivateRoute(route);
    const path = priv ? '/(signed-in)' : publicPath(route);
    window.gtag?.('set', {
      page_location: `${window.location.origin}${path}`,
      page_path: path,
      page_title: priv ? '' : document.title,
    });
  }

  function sendPageView(route: RouteLocationNormalized): void {
    if (isPrivateRoute(route)) return;
    applyLocation(route);
    const path = publicPath(route);
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_location: `${window.location.origin}${path}`,
      page_title: document.title,
    });
  }

  /**
   * Delete the provider's cookies from this device. The names come from the
   * same registry the policy page renders, so this cannot fall out of step with
   * what was disclosed. Each name is cleared against the host and every parent
   * domain, because GA sets `_ga` on the registrable domain (`.example.com`)
   * and a cookie can only be deleted with a matching domain attribute.
   */
  function purgeProviderCookies(): void {
    const names = analyticsCookies(config).map((c) => c.name);
    const labels = window.location.hostname.split('.');

    // A cookie can only be deleted by a write matching its domain AND path, so
    // every scoping the provider might have used has to be attempted.
    //
    // The first version derived scopes as `.parent` domains only, which skipped
    // the host itself and produced NO domain candidates at all for a
    // single-label host like `localhost`. CI then kept four `_ga*` cookies after
    // a withdrawal that passed locally: two names, each surviving as a
    // host-only and a domain-scoped copy. Host-only deletion cannot remove a
    // cookie that was set with an explicit domain.
    const scopes = [''];
    for (let i = 0; i < labels.length; i += 1) {
      const domain = labels.slice(i).join('.');
      // A single trailing label ('com') is not a scope anything can set.
      if (i > 0 && labels.length - i < 2) break;
      scopes.push(`; domain=${domain}`, `; domain=.${domain}`);
    }
    for (const name of names) {
      for (const scope of scopes) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${scope}`;
      }
    }
  }

  // React to the CHOICE, not just its initial value: a visitor can accept after
  // first refusing, and can withdraw later from the cookie policy page. Consent
  // state is shared app-wide (a single useState in useCookieConsent), so this
  // fires synchronously on either transition.
  watch(
    allowsAnalytics,
    (allowed) => {
      send('consent', 'update', {
        analytics_storage: allowed ? 'granted' : 'denied',
      });
      if (allowed) {
        load();
        return;
      }
      if (!loaded) {
        // NOT loaded and not allowed: enforce the invariant anyway. Provider
        // cookies must exist only while consent is granted, and they can outlive
        // it in several ways — a consent scope that changed so an old grant no
        // longer counts, and a device carrying cookies from before any of this
        // shipped. No reload is needed here, because there is no tag to unload.
        purgeProviderCookies();
        // Once more after the previous document is definitely gone. GA persists
        // its session cookie from a `pagehide` handler, which runs AFTER the
        // replacement document has started executing, so a withdrawal that
        // reloads would otherwise clear the cookies and have the outgoing page
        // write them straight back. Measured: withdrawal left `_ga` and
        // `_ga_<id>` behind indefinitely, while any later plain navigation
        // cleared them, which is exactly the signature of that ordering.
        // One bounded follow-up, not a loop.
        window.setTimeout(() => {
          // Re-check: the visitor may have accepted in the meantime, and this
          // must not delete a cookie consent has since authorised.
          if (!allowsAnalytics.value) purgeProviderCookies();
        }, 1200);
        return;
      }
      // WITHDRAWAL. Telling the tag to stop is not enough: measured live in
      // session 254, a withdrawn visitor kept both `_ga` cookies and still
      // emitted beacons, because gtag.js stays resident and its automatic
      // events do not consult our router. So: deny storage via Consent Mode
      // (above), stop feeding it navigations, and delete what it stored.
      //
      // NO RELOAD. An earlier version reloaded the document to drop the tag,
      // which read well and did not work. The reload's SSR pass re-seeds the
      // consent state from a request cookie the browser has not finished
      // deleting, so the reloaded page came back briefly consenting, loaded the
      // tag again, then withdrew again: four navigations from one click, with
      // the cookies alive at the end of it. A withdrawal that loops is worse
      // than one that leaves a dormant script in memory.
      stopPageViews?.();
      stopPageViews = null;
      purgeProviderCookies();
      // Again once GA has finished its own writes. It persists session state
      // from timers and a `pagehide` handler, so a single synchronous delete can
      // be undone a moment later. Guarded and bounded, never a loop.
      window.setTimeout(() => {
        if (!allowsAnalytics.value) purgeProviderCookies();
      }, 1200);
    },
    { immediate: true },
  );
});
