/**
 * Cached per-user permission resolver (Nitro util).
 *
 * Wraps the pure `resolveUserPermissions` core (@commonpub/server) with a short
 * TTL + bounded LRU + explicit invalidation — modeled on `config.ts`'s DB-cache
 * pattern and `layoutCache.ts`'s bounded map. Lives in the LAYER (not the app)
 * so it ships to every consumer via @commonpub/layer: the auth middleware,
 * `requireAdmin`, and `requirePermission` that consume it are all in the layer,
 * and the layer already calls `useDB()`/`useConfig()` from layer code on every
 * instance (see middleware/auth.ts). See docs/plans/rbac.md (Phase 0 location
 * correction).
 *
 * The flag lives ONLY here (in the resolver), never in the guards —
 * `requireFeature('rbac')` would 404 admin endpoints when off. With the flag
 * off, the core returns the legacy mapping (admin→all, else→none) ⇒
 * byte-identical to pre-RBAC (INV-1).
 *
 * Auth-critical → 30s TTL (favor freshness so a demote/revoke takes effect
 * within the window, not on re-login — the set is never baked into the session
 * token). Invalidate AFTER the DB commit; per-process so it clears the local
 * node only (≤30s elsewhere — documented multi-pod staleness, acceptable v1).
 */
import { resolveUserPermissions, type ResolvedPermissions } from '@commonpub/server';

export const PERMISSIONS_CACHE_TTL_MS = 30_000;

/** Caps memory across adversarial/large user populations (bounded LRU). */
export const MAX_PERMISSION_ENTRIES = 5000;

interface CacheEntry {
  value: ResolvedPermissions;
  at: number;
}

const cache = new Map<string, CacheEntry>();

function readFresh(userId: string, now: number): ResolvedPermissions | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (now - entry.at > PERMISSIONS_CACHE_TTL_MS) {
    cache.delete(userId);
    return null;
  }
  // LRU touch — move to newest end so eviction stays O(1) oldest-first.
  cache.delete(userId);
  cache.set(userId, entry);
  return entry.value;
}

function store(userId: string, value: ResolvedPermissions, now: number): void {
  if (cache.has(userId)) cache.delete(userId);
  cache.set(userId, { value, at: now });
  while (cache.size > MAX_PERMISSION_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Resolve (and cache) a user's effective permissions. Reads the `features.rbac`
 * flag from the merged config; never throws (the core default-denies on error,
 * and the admin floor is enforced downstream via `primaryRole`).
 *
 * @param primaryRole the already-enriched `users.role` (the auth middleware has
 *   it). Passing it lets the core skip its own users query — so the admin and
 *   flag-off hot paths do ZERO extra DB work — and keeps resolution consistent
 *   with the enrich query.
 */
export async function resolvePermissions(
  userId: string,
  primaryRole?: string,
): Promise<ResolvedPermissions> {
  const now = Date.now();
  const cached = readFresh(userId, now);
  if (cached) return cached;

  const rbacEnabled = useConfig().features.rbac === true;
  const resolved = await resolveUserPermissions(useDB(), userId, { rbacEnabled, primaryRole });
  store(userId, resolved, now);
  return resolved;
}

/** Drop one user's cached permissions. Call AFTER a role/grant DB commit. */
export function invalidatePermissions(userId: string): void {
  cache.delete(userId);
}

/** Drop the whole cache — the RBAC kill-switch companion to flipping the flag off. */
export function invalidateAllPermissions(): void {
  cache.clear();
}

/** Cache size — test-only inspection. */
export function _permissionsCacheSize(): number {
  return cache.size;
}
