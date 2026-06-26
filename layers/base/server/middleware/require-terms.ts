// Server-side terms re-acceptance enforcement (GDPR Phase 2).
//
// The TermsReacceptanceGate.vue interstitial is the UX, but it's client-side and
// bypassable via devtools. When `requireTermsAcceptance` is on, this middleware
// gives it teeth: a logged-in user whose accepted terms version is stale cannot
// perform WRITE operations (POST/PUT/PATCH/DELETE on /api/*) until they re-accept.
// Reads stay open so the app shell + the gate can still load, and the routes
// needed to RESOLVE the block (consent, auth/logout) are exempt.
//
// Gated by the flag (default OFF) → on the common path this bails before any DB
// hit, so it's zero-cost unless an operator turns the feature on.
import { needsTermsReacceptance } from '@commonpub/server';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default defineEventHandler(async (event) => {
  if (!UNSAFE_METHODS.has(event.method.toUpperCase())) return;
  const path = getRequestURL(event).pathname;
  if (!path.startsWith('/api/')) return;
  // Routes the user needs in order to clear the block.
  if (path.startsWith('/api/auth/') || path === '/api/consent' || path.startsWith('/api/consent/')) return;

  const config = useConfig();
  if (config.features.requireTermsAcceptance !== true) return; // default OFF → no-op

  const user = getOptionalUser(event);
  if (!user) return; // anonymous writes are handled by the routes' own auth gates

  const stale = await needsTermsReacceptance(useDB(), user.id, {
    enabled: true,
    termsVersion: config.instance.termsVersion ?? '1',
  });
  if (stale) {
    throw createError({ statusCode: 403, statusMessage: 'Please re-accept the updated terms to continue.' });
  }
});
