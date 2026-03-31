/** Returns the configured site name from runtime config (defaults to 'CommonPub'). */
export function useSiteName(): string {
  return (useRuntimeConfig().public.siteName as string) || 'CommonPub';
}
