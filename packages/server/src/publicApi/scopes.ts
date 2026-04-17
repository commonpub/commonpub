import type { PublicApiScope } from '@commonpub/schema';

/**
 * Scope gate. Grants are wildcard-aware: a key that holds `read:*` passes any
 * `read:...` check. We never implement negative scopes (no `!read:users`) —
 * simpler to reason about; if something needs exclusion, model it as an
 * explicit positive scope instead.
 */
export function hasScope(granted: readonly string[], needed: PublicApiScope): boolean {
  if (granted.includes(needed)) return true;
  if (needed.startsWith('read:') && granted.includes('read:*')) return true;
  return false;
}

/**
 * Validate every stored scope is still recognized. Used defensively when a
 * key's `scopes` JSON array is loaded — catches leftovers from a revoked
 * scope or a typo that slipped past validation.
 */
export function filterKnownScopes(
  scopes: readonly string[],
  known: readonly PublicApiScope[],
): PublicApiScope[] {
  return scopes.filter((s): s is PublicApiScope => (known as readonly string[]).includes(s));
}
