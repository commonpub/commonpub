/**
 * Nitro plugin — prime each SSR request with the DB-merged instance identity
 * (public site name + description) used for SEO titles / og:site_name / unfurls.
 *
 * Mirrors `feature-flags-prime.ts`. The Vue `useSiteName()` composable
 * initialises its `useState('cpub-site-name')` from `useRuntimeConfig()
 * .public.siteName` — the BUILD-TIME value baked into the bundle. An operator
 * renaming the instance from `/admin/settings` (Instance Name) writes to
 * `instance_settings['instance.name']`, which `useConfig()` now DB-merges into
 * `config.instance.name` (60s cache) — but the layer composable never queries
 * that at SSR time on its own.
 *
 * Effect of the gap: SSR renders titles / og:site_name with the stale
 * build-time brand; crawlers + curl-based checks see the old name.
 *
 * Fix: read the merged instance name/description at request-start and attach to
 * `event.context.cpubSiteName` / `cpubSiteDescription`. `useSiteName()`
 * (modified alongside this plugin) reads from `useRequestEvent()` context on the
 * server, falling back to the runtime config when context is absent (islands,
 * error pages). The SSR-resolved value serializes into the page state so the
 * client hydrates with the SAME brand — no hydration mismatch.
 *
 * Cost: one `useConfig()` call per request. The merged config is cached (60s TTL
 * on DB reads), so this is a Map lookup on the hot path, not a DB hit.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    try {
      const config = useConfig();
      event.context.cpubSiteName = config.instance.name;
      event.context.cpubSiteDescription = config.instance.description;
    } catch {
      // useConfig() throws at startup when the DB isn't ready yet.
      // Leave context unset → composable falls back to build-time runtime config.
    }
  });
});
