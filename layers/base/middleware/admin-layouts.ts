/**
 * Named middleware for /admin/layouts/* pages.
 *
 * The global `feature-gate.global.ts` middleware gates the entire
 * `/admin` prefix on the `admin` feature flag. The layout editor
 * is gated on an ADDITIONAL `layoutEngine` flag — when the engine
 * is off (the v1 default), the editor pages 404 instead of erroring
 * on a server endpoint the user can't reach anyway.
 *
 * Pair this with `middleware: 'auth'` on the page — the auth
 * middleware redirects unauthenticated users to /auth/login;
 * this middleware filters the feature flag AFTER auth.
 *
 * See CLAUDE.md rule #2 (no feature without a flag) +
 * docs/plans/phase-3-editor.md hard rule "Editor admin-only —
 * gate /admin/layouts/* on requireFeature('admin') +
 * requireFeature('layoutEngine')".
 */
import { getInitialFlags, type FeatureFlags } from '../composables/useFeatures';

export default defineNuxtRouteMiddleware(() => {
  // Same useState key as useFeatures() — the global middleware also
  // primes it. Re-using getInitialFlags here avoids the null-poison
  // bug from session 126 (see feature-gate.global.ts comment).
  const flags = useState<FeatureFlags>('feature-flags', getInitialFlags);
  if (!flags.value.layoutEngine) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
});
