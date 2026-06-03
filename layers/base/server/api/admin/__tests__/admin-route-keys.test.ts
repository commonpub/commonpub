/**
 * Per-domain SPECIFIC-KEY contract (RBAC Phase 1).
 *
 * INV-6's sweep (all-routes-gated.test.ts) proves every admin route has *a*
 * permission guard. This test goes one level deeper: it pins the EXACT catalog
 * key each route gates on, so the Phase-1 mapping (requireAdmin →
 * requirePermission('<key>')) can't be silently re-pointed at a different
 * capability by a later refactor — which, once `features.rbac` is on (Phase 2),
 * would hand a route to the wrong role.
 *
 * The expected key is hardcoded here INDEPENDENTLY of the source (a contract
 * test that derived the key from the file would be tautological). The
 * completeness assertion forces every newly-added admin route into this map —
 * i.e. a deliberate key choice — before it can pass.
 *
 * Static source read, like its siblings (all-routes-gated / handlers-contract):
 * cheap, no Nitro harness. The flag-on allow/deny matrix lives in the Phase-2
 * PGlite matrix test once the seed exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { isPermissionKey } from '@commonpub/schema';

const adminRoot = resolve(__dirname, '..');

/** route path (relative to server/api/admin) → required permission key */
const ROUTE_KEYS: Record<string, string> = {
  // api keys
  'api-keys/[id].delete.ts': 'apikeys.manage',
  'api-keys/[id]/usage.get.ts': 'apikeys.manage',
  'api-keys/index.get.ts': 'apikeys.manage',
  'api-keys/index.post.ts': 'apikeys.manage',
  // observability (audit log + platform stats)
  'audit.get.ts': 'audit.read',
  'stats.get.ts': 'audit.read',
  // categories
  'categories/[id].delete.ts': 'categories.manage',
  'categories/[id].patch.ts': 'categories.manage',
  'categories/index.get.ts': 'categories.manage',
  'categories/index.post.ts': 'categories.manage',
  // content moderation vs editorial
  'content/[id].delete.ts': 'content.moderate',
  'content/[id].patch.ts': 'content.editorial',
  'content/bulk-editorial.post.ts': 'content.editorial',
  // instance settings (feature flags live under settings)
  'features/index.get.ts': 'settings.manage',
  'features/index.put.ts': 'settings.manage',
  'settings.get.ts': 'settings.manage',
  'settings.put.ts': 'settings.manage',
  // federation
  'federation/activity.get.ts': 'federation.manage',
  'federation/followers.get.ts': 'federation.manage',
  'federation/clients.get.ts': 'federation.manage',
  'federation/clients.post.ts': 'federation.manage',
  'federation/hub-mirrors/[id]/backfill.post.ts': 'federation.manage',
  'federation/hub-mirrors/index.get.ts': 'federation.manage',
  'federation/hub-mirrors/index.post.ts': 'federation.manage',
  'federation/mirrors/[id].delete.ts': 'federation.manage',
  'federation/mirrors/[id].get.ts': 'federation.manage',
  'federation/mirrors/[id].put.ts': 'federation.manage',
  'federation/mirrors/[id]/backfill.post.ts': 'federation.manage',
  'federation/mirrors/index.get.ts': 'federation.manage',
  'federation/mirrors/index.post.ts': 'federation.manage',
  'federation/mirror-requests/index.get.ts': 'federation.manage',
  'federation/mirror-requests/[id]/approve.post.ts': 'federation.manage',
  'federation/mirror-requests/[id]/reject.post.ts': 'federation.manage',
  'registry/instances.get.ts': 'federation.manage',
  'registry/instances/[id]/status.post.ts': 'federation.manage',
  'federation/pending.get.ts': 'federation.manage',
  'federation/refederate.post.ts': 'federation.manage',
  'federation/repair-types.post.ts': 'federation.manage',
  'federation/retry.post.ts': 'federation.manage',
  'federation/stats.get.ts': 'federation.manage',
  'federation/trusted-instances.delete.ts': 'federation.manage',
  'federation/trusted-instances.get.ts': 'federation.manage',
  'federation/trusted-instances.post.ts': 'federation.manage',
  // layout engine (homepage sections are layout zones)
  'homepage/sections.get.ts': 'layout.manage',
  'homepage/sections.put.ts': 'layout.manage',
  'layouts/[id].delete.ts': 'layout.manage',
  'layouts/[id].get.ts': 'layout.manage',
  'layouts/[id].put.ts': 'layout.manage',
  'layouts/[id]/publish.post.ts': 'layout.manage',
  'layouts/[id]/versions/[versionId]/revert.post.ts': 'layout.manage',
  'layouts/[id]/versions/index.get.ts': 'layout.manage',
  'layouts/index.get.ts': 'layout.manage',
  'layouts/index.post.ts': 'layout.manage',
  'layouts/migrate-homepage.post.ts': 'layout.manage',
  'layouts/seed-homepage.post.ts': 'layout.manage',
  // navigation
  'navigation/items.get.ts': 'navigation.manage',
  'navigation/items.put.ts': 'navigation.manage',
  // moderation reports
  'reports.get.ts': 'reports.review',
  'reports/[id]/resolve.post.ts': 'reports.review',
  // search
  'search/reindex.post.ts': 'search.manage',
  // storage
  'storage/backfill-cdn-urls.post.ts': 'storage.manage',
  // themes
  'themes/[id].delete.ts': 'theme.manage',
  'themes/[id].get.ts': 'theme.manage',
  'themes/[id].put.ts': 'theme.manage',
  'themes/discover.get.ts': 'theme.manage',
  'themes/index.get.ts': 'theme.manage',
  'themes/index.post.ts': 'theme.manage',
  // users — read / manage (role+status) / delete are distinct capabilities
  'users.get.ts': 'users.read',
  'users/[id].delete.ts': 'users.delete',
  'users/[id]/role.put.ts': 'users.manage',
  'users/[id]/status.put.ts': 'users.manage',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(get|post|put|delete|patch)\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const handlers = walk(adminRoot).map((f) => f.replace(adminRoot + '/', ''));

describe('RBAC Phase 1 — every admin route gates on its mapped catalog key', () => {
  it('the map is complete: every discovered admin handler has an expected key (and vice-versa)', () => {
    const discovered = new Set(handlers);
    const mapped = new Set(Object.keys(ROUTE_KEYS));
    const unmapped = [...discovered].filter((h) => !mapped.has(h));
    const stale = [...mapped].filter((h) => !discovered.has(h));
    expect(unmapped, `admin routes with no expected key — add to ROUTE_KEYS:\n${unmapped.join('\n')}`).toEqual([]);
    expect(stale, `ROUTE_KEYS entries for routes that no longer exist:\n${stale.join('\n')}`).toEqual([]);
  });

  it('every expected key is a real catalog key', () => {
    const bad = Object.entries(ROUTE_KEYS).filter(([, k]) => !isPermissionKey(k));
    expect(bad, `non-catalog keys in ROUTE_KEYS: ${JSON.stringify(bad)}`).toEqual([]);
  });

  it.each(handlers.map((h) => [h]))('admin/%s gates on requirePermission(event, mapped key)', (rel) => {
    const key = ROUTE_KEYS[rel];
    if (!key) return; // completeness covered above
    const src = readFileSync(join(adminRoot, rel), 'utf8');
    const re = new RegExp(
      `requirePermission\\(\\s*event\\s*,\\s*['"]${key.replace('.', '\\.')}['"]`,
    );
    expect(src, `${rel}: must gate on requirePermission(event, '${key}')`).toMatch(re);
  });
});
