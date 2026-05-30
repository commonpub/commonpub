// Global RBAC (session 175). Pure resolution core; the cached Nitro wrapper +
// server gate live in layers/base/server/utils/. See docs/plans/rbac.md.
export { resolveUserPermissions } from './resolver.js';
export type { ResolvedPermissions } from './resolver.js';
