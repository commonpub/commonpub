/**
 * GET /api/me — Returns the current authenticated user with enriched fields (role, username, status).
 *
 * Unlike /api/auth/get-session which returns raw Better Auth data (missing custom columns),
 * this endpoint reads from event.context.auth which has already been enriched by the auth middleware.
 */
export default defineEventHandler((event) => {
  const { user, session } = event.context.auth ?? {};
  return {
    user: user ?? null,
    session: session ?? null,
  };
});
