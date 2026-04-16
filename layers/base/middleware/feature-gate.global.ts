// Global client-side middleware that mirrors server/middleware/features.ts.
// Prevents client-side navigation to feature-gated pages when the flag is disabled.
// Uses useState('feature-flags') which is hydrated by useFeatures() from /api/features.

import type { FeatureFlags } from '../composables/useFeatures';

const ROUTE_FEATURE_MAP: Record<string, keyof FeatureFlags> = {
  '/learn': 'learning',
  '/docs': 'docs',
  '/videos': 'video',
  '/admin': 'admin',
  '/contests': 'contests',
  '/events': 'events',
  '/explainer': 'explainers',
};

export default defineNuxtRouteMiddleware((to) => {
  for (const [prefix, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (to.path === prefix || to.path.startsWith(prefix + '/')) {
      // Prefer reactive state (hydrated from /api/features), fall back to build-time config
      const featureState = useState<FeatureFlags | null>('feature-flags', () => null);
      const flags = featureState.value ?? (useRuntimeConfig().public.features as Record<string, boolean>);
      if (!(flags as Record<string, boolean>)[feature]) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' });
      }
      return;
    }
  }
});
