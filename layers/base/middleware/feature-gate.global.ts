// Global client-side middleware that mirrors server/middleware/features.ts.
// Prevents client-side navigation to feature-gated pages when the flag is disabled.

const ROUTE_FEATURE_MAP: Record<string, keyof import('../composables/useFeatures').FeatureFlags> = {
  '/learn': 'learning',
  '/docs': 'docs',
  '/videos': 'video',
  '/admin': 'admin',
  '/contests': 'contests',
  '/explainer': 'explainers',
};

export default defineNuxtRouteMiddleware((to) => {
  for (const [prefix, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (to.path === prefix || to.path.startsWith(prefix + '/')) {
      const config = useRuntimeConfig();
      const flags = config.public.features as Record<string, boolean>;
      if (!flags[feature]) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' });
      }
      return;
    }
  }
});
