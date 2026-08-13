import { WILDCARD_PROTECTED_SCOPES as WILDCARD_PROTECTED_SCOPE_LIST } from '@commonpub/schema';
import type { PublicApiScope } from '@commonpub/schema';

/**
 * Scopes that a `read:*` key does NOT satisfy.
 *
 * The house pattern is `WILDCARD_PROTECTED_PERMISSIONS` in
 * `packages/auth/src/permissions.ts`, where `contest.*` deliberately does not
 * satisfy `contest.pii`. This is the same idea one level down: a wildcard is a
 * convenience for the scopes that existed when the key was issued, and it must
 * not silently widen when a new, more sensitive leaf ships.
 *
 * `read:audience` is the first such leaf. It reads aggregate member cohorts
 * built out of persona answers that users consented to have counted. Every key
 * already in the field holding `read:*` was issued for content metrics; letting
 * it pick up cohort data without the operator re-issuing it would make the
 * consent copy ("nothing about you leaves this site") a statement the system
 * does not enforce.
 *
 * `read:members` is the second, and the stronger case of the two. It is the ONLY
 * scope that returns identified individuals rather than k-anonymous counts: the
 * opt-in visibility directory lists the members who granted
 * `recruiter_visibility` or `sponsor_sharing`, and every row it returns writes a
 * `disclosure_events` row naming the recipient who saw it. A wildcard that
 * silently picked that up would disclose people under a key nobody bound to a
 * recipient, so the disclosure would be unattributable and the member's "who has
 * looked at you" list would be a lie by omission. The scope is additionally
 * useless on its own: the route refuses a key with no `recipient_id`.
 *
 * Adding a scope here is a deliberate act: it narrows existing keys, so it
 * belongs in the same commit as the `PUBLIC_API_SCOPES` tuple edit. The tuple
 * edit alone is the regression.
 */
export const WILDCARD_PROTECTED_SCOPES: ReadonlySet<PublicApiScope> = new Set<PublicApiScope>(
  // The list itself lives beside `PUBLIC_API_SCOPES` in `@commonpub/schema`,
  // because the admin key screen has to render the same fact in a browser and
  // cannot import this module. Kept as a Set here for the O(1) lookup on the
  // request path.
  WILDCARD_PROTECTED_SCOPE_LIST,
);

/**
 * Scope gate. Grants are wildcard-aware: a key that holds `read:*` passes any
 * `read:...` check EXCEPT a wildcard-protected leaf. We never implement
 * negative scopes (no `!read:users`) — simpler to reason about; if something
 * needs exclusion, model it as an explicit positive scope instead.
 *
 * Order is load bearing. The exact-match branch runs first, so a key that was
 * explicitly granted `read:audience` still passes; only the wildcard shortcut
 * is closed for a protected leaf.
 */
export function hasScope(granted: readonly string[], needed: PublicApiScope): boolean {
  if (granted.includes(needed)) return true;
  // Protected leaves are exempt from the wildcard branch. Checked AFTER the
  // exact match above, so an explicit grant is unaffected.
  if (WILDCARD_PROTECTED_SCOPES.has(needed)) return false;
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
