/**
 * GET /api/me — Returns the current authenticated user with enriched fields (role, username, status).
 *
 * Unlike /api/auth/get-session which returns raw Better Auth data (missing custom columns),
 * this endpoint reads from event.context.auth which has already been enriched by the auth middleware.
 */
export default defineEventHandler((event) => {
  const { user, session } = event.context.auth ?? {};
  // Effective permissions resolved by the auth middleware (RBAC). The admin
  // floor lives in users.role, so the set is empty for admins — useCan() applies
  // the floor client-side. Permissions/roleKeys are advisory (UX only); the
  // server is always the enforcement boundary.
  const resolved = event.context.cpubPermissions;
  return {
    user: user ?? null,
    session: session ?? null,
    permissions: resolved ? [...resolved.permissions] : [],
    roleKeys: resolved?.roleKeys ?? [],
  };
});
