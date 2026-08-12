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

  // Everything below is resolved EAGERLY, in plugin setup, and the getters only
  // read a captured ref. That is the rule this file's own docblock states and
  // that 27 pages violated: a getter runs during head resolution, where any
  // composable reaching for the Nuxt instance (useState, useRequestEvent,
  // useRuntimeConfig) throws and silently yields a fallback.
  const router = useRouter();
  const runtimeConfig = useRuntimeConfig();
  const siteUrl = String(runtimeConfig.public.siteUrl ?? '').replace(/\/+$/, '');

  /**
   * The absolute address of the current page, WITHOUT query or fragment.
   *
   * Dropping the query is the whole point of a canonical. `?page=`, `?q=`,
   * `?sort=`, a stray `?utm_source=` and a shared link with a tracking
   * parameter are all the same document, and left alone each becomes a
   * separate competing URL in an index.
   *
   * Built from the instance's configured `siteUrl` rather than
   * `window.location`, so it is identical during SSR and on the client, and so
   * every instance self-references its own host. Verified before shipping that
   * all three live instances report their own origin here: a canonical
   * pointing at the wrong host is far more damaging than none at all.
   */
  const canonical = (): string => `${siteUrl}${router.currentRoute.value.path}`;

  useSeoMeta({
    ogSiteName: siteName,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    // Pages that are genuinely articles override this; the default is correct
    // for listings, the homepage and everything else.
    ogUrl: canonical,
  });

  // `useSeoMeta` has no `link`, so the canonical tag goes through `useHead`.
  // A federating platform needs this more than most: the same content is
  // mirrored onto other instances, and without a self-referential canonical
  // those copies compete with the original in search results. Mirror pages
  // already point their canonical at the ORIGIN, which is the other half of
  // the same rule.
  useHead({
    link: [{ rel: 'canonical', href: canonical }],
  });
});
