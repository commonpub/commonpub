/** Returns the configured site name from runtime config (defaults to 'CommonPub').
 *  Safe to call inside lazy SEO resolvers — falls back to 'CommonPub' if
 *  the Nuxt instance is unavailable (e.g. during SSR head rendering). */
export function useSiteName(): string {
  try {
    return (useRuntimeConfig().public.siteName as string) || 'CommonPub';
  } catch {
    return 'CommonPub';
  }
}
