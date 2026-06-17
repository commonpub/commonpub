/**
 * Client-side permission check (UX only — the server enforces via
 * `requirePermission`). Mirrors `hasPermissionPure` (@commonpub/auth): admin
 * floor → `*` → exact match → `<prefix>.*` segment wildcard.
 *
 *   const canModerate = useCan('content.moderate')
 *   <button v-if="canModerate">…</button>
 *
 * Never gate real access on this alone — always have a server guard behind it.
 */
export function useCan(key: string): ComputedRef<boolean> {
  const { isAdmin, permissions } = useAuth();
  return computed(() => {
    // Admin floor — admins pass everything (their resolved set is empty server-side).
    if (isAdmin.value) return true;
    const granted = permissions.value;
    if (!granted.length) return false;
    if (granted.includes('*')) return true;
    if (granted.includes(key)) return true;
    const prefix = key.includes('.') ? key.slice(0, key.indexOf('.')) : null;
    return prefix ? granted.includes(`${prefix}.*`) : false;
  });
}
