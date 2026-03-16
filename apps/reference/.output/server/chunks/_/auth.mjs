import { o as createError } from '../nitro/nitro.mjs';

function requireAuth(event) {
  const auth = event.context.auth;
  if (!(auth == null ? void 0 : auth.user)) {
    throw createError({ statusCode: 401, statusMessage: "Authentication required" });
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
