// Global client-side middleware that mirrors server/middleware/features.ts.
// Prevents client-side navigation to feature-gated pages when the flag is disabled.
// Uses useState('feature-flags') which is hydrated by useFeatures() from /api/features.

import { getInitialFlags, type FeatureFlags } from '../composables/useFeatures';

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
      // IMPORTANT: use the same initializer as useFeatures(). Previously this
      // initialized to `null`, which poisoned the shared state — Nuxt's
      // useState only runs its initializer the first time a key is seen per
      // request. When the layout later called useFeatures() with its own
      // initializer, Nuxt returned the existing null state, and any
      // flags.value.X access crashed with "Cannot read properties of null
      // (reading '...')". That was the root cause of the commonpub.io
      // /docs, /learn, /videos, /explainer SSR-500 bug (session 126).
      const flags = useState<FeatureFlags>('feature-flags', getInitialFlags);
      if (!flags.value[feature]) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' });
      }
      return;
    }
  }
});
