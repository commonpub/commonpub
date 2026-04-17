// Feature flag route gating — returns 404 for pages of disabled features.
// API routes handle their own gating via requireFeature() in each handler.

const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/learn': 'learning',
  '/docs': 'docs',
  '/videos': 'video',
  '/admin': 'admin',
  '/contests': 'contests',
  '/events': 'events',
  '/explainer': 'explainers',
};

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;

  // Only gate page routes, not API/assets
  if (pathname.startsWith('/api') || pathname.startsWith('/_nuxt') || pathname.startsWith('/__nuxt') || pathname.endsWith('_payload.json')) {
    return;
  }

  for (const [prefix, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      // DEBUG (session 126 SSR-500 probe): surface real errors
      try {
        const config = useConfig();
        const flags = config.features as unknown as Record<string, boolean>;
        if (!flags[feature]) {
          throw createError({ statusCode: 404, statusMessage: 'Not Found' });
        }
        return;
      } catch (err: unknown) {
        // Re-throw 404s unchanged
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw createError({
          statusCode: 500,
          statusMessage: `feature-gate[${prefix}→${feature}]: ${msg.slice(0, 200)}`,
        });
      }
    }
  }
});
