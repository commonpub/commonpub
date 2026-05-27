/**
 * Nitro plugin — prime each SSR request with DB-merged feature flags.
 *
 * The Vue `useFeatures()` composable (layers/base/composables/useFeatures.ts)
 * initialises its `useState('feature-flags')` from `useRuntimeConfig().public.features`,
 * which is the BUILD-TIME config baked into the bundle. Admin-UI flag
 * overrides land in `instance_settings.features.overrides` and are
 * picked up by `useConfig()` (server-side, DB-merged with 60s cache),
 * but the layer composable never queries that at SSR time — only AFTER
 * client mount, via `$fetch('/api/features')`.
 *
 * Effect of the gap: SSR renders with stale (build-time) flag values.
 * An admin flipping `layoutEngine: true` from off-by-default through the
 * admin UI doesn't take effect for SSR; the first paint shows the
 * v-else-if branch, then hydration replaces it with the v-if branch.
 * Bad UX and breaks curl-based canary verification.
 *
 * Fix: read the merged config at request-start and attach it to
 * `event.context.cpubFeatureFlags`. The Vue composable's `getInitialFlags`
 * (modified alongside this plugin) reads from `useRequestEvent()` context
 * on the server, falling back to the runtime config when context is
 * absent (e.g. island components, error pages).
 *
 * Cost: one call to `useConfig()` per request. The merged config is
 * itself cached (60s TTL on DB overrides), so this is a Map lookup,
 * not a DB hit on the hot path.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    try {
      const config = useConfig();
      event.context.cpubFeatureFlags = config.features;
    } catch {
      // useConfig() throws at startup when the DB isn't ready yet.
      // Leave context.cpubFeatureFlags unset → composable falls back to
      // build-time runtime config (same behavior as before this plugin).
    }
  });
});
