/**
 * Returns the effective public instance name for SEO titles / og:site_name.
 *
 * Two sources, in priority order (mirrors `useFeatures().getInitialFlags`):
 *   1. **Server-side, request-scoped**: `event.context.cpubSiteName` — the
 *      DB-merged value set by the Nitro `site-identity-prime` plugin. This is
 *      how an admin-set Instance Name (`/admin/settings`) takes effect at SSR
 *      time with no redeploy.
 *   2. **Build-time runtime config**: `useRuntimeConfig().public.siteName` — the
 *      per-instance default wired in `nuxt.config`. Fallback for the client
 *      (hydrates from the serialized `useState`), early startup, and islands.
 *
 * Backed by `useState('cpub-site-name')` so the SSR-resolved value serializes to
 * the client and both render the SAME brand (no hydration mismatch). Falls back
 * to 'CommonPub' if the Nuxt instance is unavailable (e.g. some head resolvers).
 */
export function useSiteName(): string {
  try {
    const name = useState<string>('cpub-site-name', () => {
      if (import.meta.server) {
        const event = (typeof useRequestEvent === 'function') ? useRequestEvent() : null;
        const ctxName = event?.context?.cpubSiteName as string | undefined;
        if (ctxName) return ctxName;
      }
      return (useRuntimeConfig().public.siteName as string) || 'CommonPub';
    });
    return name.value || 'CommonPub';
  } catch {
    return 'CommonPub';
  }
}
