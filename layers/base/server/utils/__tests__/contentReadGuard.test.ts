/**
 * CI regression guard (docs/plans/content-privacy-enforcement.md P-3) — backstop against
 * the session-204 leak class: a raw content_items read that enforces `status` but not
 * `visibility`, exposing members/private/draft content unauthenticated.
 *
 * Every current contentItems-read file under packages/server/src and layers/base/server was
 * audited + gated (or is a legitimate non-public read: write / admin / federation /
 * owner-scoped / count / migration) in P-1/P-1b/P-2. Those files are the ALLOWLIST below.
 * A NEW file that reads contentItems trips this test: route the read through the shared
 * visibility predicate (visibleContentWhere / resolveContentQuery / requireHubReadAccess),
 * or — if it is genuinely not a public read — add it to ALLOWLIST with a justification a
 * reviewer will see. This is a tripwire for new routes, not a per-statement checker.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const SCAN_ROOTS = ['packages/server/src', 'layers/base/server'];
// Matches `.from(contentItems)` and `.innerJoin/.leftJoin/.rightJoin(contentItems`.
const PATTERN = /\.(?:from|innerJoin|leftJoin|rightJoin)\(\s*contentItems\b/;

const ALLOWLIST = new Set<string>([
  // packages/server/src — gated public reads (visibleContentWhere / publicContentWhere / inline visibility)
  'packages/server/src/content/content.ts',
  'packages/server/src/product/product.ts',
  'packages/server/src/profile/profile.ts',
  'packages/server/src/learning/learning.ts',
  'packages/server/src/social/social.ts',
  'packages/server/src/hub/posts.ts',
  'packages/server/src/search/contentSearch.ts',
  'packages/server/src/contest/entries.ts',
  'packages/server/src/contest/export.ts',
  'packages/server/src/publicApi/metrics.ts',
  'packages/server/src/publicApi/metricsRollup.ts',
  // packages/server/src — non-public reads: admin / federation / owner-scoped / counts
  'packages/server/src/admin/admin.ts',
  'packages/server/src/hub/flags.ts',
  'packages/server/src/profile/export.ts',
  'packages/server/src/federation/federation.ts',
  'packages/server/src/federation/hubFederation.ts',
  'packages/server/src/federation/inboxHandlers.ts',
  'packages/server/src/federation/outboxQueries.ts',
  // layers/base/server — gated reads
  'layers/base/server/middleware/content-ap.ts',
  'layers/base/server/routes/content/[slug].ts',
  'layers/base/server/routes/sitemap.xml.ts',
  'layers/base/server/api/search/trending.get.ts',
  // layers/base/server — writes / admin / migration / owner
  'layers/base/server/middleware/content-redirect.ts',
  'layers/base/server/plugins/migrate-article-to-blog.ts',
  'layers/base/server/api/auth/delete-user.post.ts',
  'layers/base/server/api/admin/storage/backfill-cdn-urls.post.ts',
  'layers/base/server/api/admin/search/reindex.post.ts',
  'layers/base/server/api/admin/federation/refederate.post.ts',
  'layers/base/server/api/content/[id]/products.post.ts',
  'layers/base/server/api/content/[id]/products-sync.post.ts',
  'layers/base/server/api/content/[id]/products/[productId].delete.ts',
  'layers/base/server/api/content/[id]/versions.get.ts',
  'layers/base/server/api/contests/[slug]/entries.post.ts',
  'layers/base/server/api/public/v1/instance.get.ts',
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '__tests__') continue;
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const matched = new Set<string>();
const offenders: string[] = [];
for (const root of SCAN_ROOTS) {
  for (const file of walk(resolve(REPO_ROOT, root))) {
    if (!PATTERN.test(readFileSync(file, 'utf8'))) continue;
    const rel = relative(REPO_ROOT, file).split(sep).join('/');
    matched.add(rel);
    if (!ALLOWLIST.has(rel)) offenders.push(rel);
  }
}

describe('content-read visibility guard (content-privacy-enforcement.md P-3)', () => {
  it('no un-audited raw contentItems read (route via visibleContentWhere/resolveContentQuery or allowlist w/ justification)', () => {
    expect(offenders, `new content read(s) missing the shared visibility predicate:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('allowlist has no stale entries', () => {
    const stale = [...ALLOWLIST].filter((f) => !matched.has(f));
    expect(stale, `remove stale allowlist entries:\n${stale.join('\n')}`).toEqual([]);
  });

  it('scanner logic detects an offender / accepts an allowlisted path', () => {
    expect(PATTERN.test('.from(contentItems)')).toBe(true);
    expect(PATTERN.test('.innerJoin(contentItems, eq(x, y))')).toBe(true);
    expect(ALLOWLIST.has('packages/server/src/newLeak.ts')).toBe(false);
    expect(matched.size).toBeGreaterThan(0); // scanner actually ran
  });
});
