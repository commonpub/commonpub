/**
 * Global SEO brand defaults — mounted as a plugin (NOT in app.vue) so it
 * survives a consumer app that overrides `app.vue` (deveco-io does exactly
 * this; a layer app.vue's head would be silently dropped there — the same
 * class of trap as consumer layout overrides dropping layer-mounted globals).
 *
 * The key tag is `og:site_name`: without it, unfurlers (Discord/Slack/iMessage)
 * derive the brand from the page title string, which is why shared links showed
 * "CommonPub". This emits an explicit per-instance brand on every page.
 *
 * `useSiteName()` is resolved EAGERLY here (plugins run during SSR with the
 * request context available, seeding the `cpub-site-name` useState from
 * event.context — set by the `site-identity-prime` Nitro plugin). A lazy
 * resolver would run during head resolution where useRequestEvent() is null,
 * falling back to the stale build-time brand. Pages still set their own
 * title/ogTitle/ogImage; these are only defaults (later useSeoMeta calls win).
 */
export default defineNuxtPlugin(() => {
  const siteName = useSiteName();
  useSeoMeta({
    ogSiteName: siteName,
    ogType: 'website',
    twitterCard: 'summary_large_image',
  });
});
