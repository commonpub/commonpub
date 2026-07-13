import { WILDCARD_PROTECTED_PERMISSIONS } from '@commonpub/schema';
import type { PermissionKey } from '@commonpub/schema';

/**
 * Pure permission check — the single decision function behind `requirePermission`,
 * `hasPermission`, and `useCan`. No I/O, no context; given a resolved grant set
 * + the needed key (+ optional primary role), returns allow/deny. Generalizes
 * `hasScope` (packages/server/src/publicApi/scopes.ts) with an admin floor + a
 * segment-wildcard rule.
 *
 * Decision order (default-deny — INV-3):
 *   1. Admin floor (INV-2): `primaryRole === 'admin'` ⇒ ALWAYS true. This reads
 *      the denormalized `users.role` (supplied by the enrich query), so admin
 *      access survives a `role_permissions` outage or an empty grant set — no DB
 *      state can lock out admin.
 *   2. Full wildcard: a `*` grant ⇒ true.
 *   3. Exact match: the needed key is granted verbatim.
 *   4. Segment wildcard: a `<prefix>.*` grant covers `<prefix>.<anything>`
 *      (e.g. `content.*` ⇒ `content.moderate`).
 *   5. Otherwise false.
 *
 * `granted` accepts a Set or array (the resolver returns a Set; tests/callers may
 * pass either). Never throws.
 */
export function hasPermissionPure(
  granted: ReadonlySet<string> | readonly string[],
  needed: PermissionKey | string,
  primaryRole?: string,
): boolean {
  // 1. Admin floor — code-level, independent of the grant set.
  if (primaryRole === 'admin') return true;

  const has = (key: string): boolean =>
    granted instanceof Set ? granted.has(key) : (granted as readonly string[]).includes(key);

  // 2. Full wildcard.
  if (has('*')) return true;

  // 3. Exact match.
  if (has(needed)) return true;

  // 4. Segment wildcard: walk each dotted prefix of `needed` and check `<prefix>.*`.
  //    `content.moderate` ⇒ checks `content.*`. Multi-segment keys (none today)
  //    would also check deeper prefixes, future-proofing the rule.
  //    PROTECTED LEAVES (RBAC-6) are EXEMPT from this branch: `contest.*` must NOT
  //    satisfy `contest.pii`. Steps 1-3 (admin floor, `*`, exact match) already
  //    ran, so admin, a `*` holder, and an explicit `contest.pii` grant still pass
  //    — only the segment-wildcard shortcut is closed for the protected leaf.
  const dot = needed.indexOf('.');
  if (dot !== -1 && !WILDCARD_PROTECTED_PERMISSIONS.has(needed)) {
    let idx = dot;
    while (idx !== -1) {
      if (has(`${needed.slice(0, idx)}.*`)) return true;
      idx = needed.indexOf('.', idx + 1);
    }
  }

  // 5. Default deny.
  return false;
}
