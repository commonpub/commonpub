import { p as createError, V as getRequestHeader } from '../nitro/nitro.mjs';

function requireAuth(event) {
  const auth = event.context.auth;
  if (!(auth == null ? void 0 : auth.user)) {
    const cookie = getRequestHeader(event, "cookie") || "";
    const hasSessionCookie = cookie.includes("better-auth.session_token");
    throw createError({
      statusCode: 401,
      statusMessage: hasSessionCookie ? "Session expired or invalid. Please log in again." : "Not logged in. Please log in to continue."
    });
  }
  return auth.user;
}
function requireAdmin(event) {
  const user = requireAuth(event);
  if (user.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Admin access required" });
  }
  return user;
}
function getOptionalUser(event) {
  var _a;
  const auth = event.context.auth;
  return (_a = auth == null ? void 0 : auth.user) != null ? _a : null;
}

export { requireAuth as a, getOptionalUser as g, requireAdmin as r };
//# sourceMappingURL=auth.mjs.map
