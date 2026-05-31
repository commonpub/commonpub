/**
 * SPECIFIC-KEY contract for PRIVILEGED routes that live OUTSIDE /api/admin/**
 * (RBAC Phase 1).
 *
 * The admin sweep (all-routes-gated / admin-route-keys) only walks
 * `server/api/admin/**`. These routes are privileged but live elsewhere, so
 * they're invisible to that sweep — exactly the residual-risk #4 in the plan.
 * Two shapes:
 *   - full admin gates that happened to sit outside /admin (products / docs /
 *     video categories): `requirePermission(event, '<key>')`;
 *   - owner-OR-permission resource gates (contest judges / stakeholders,
 *     event edit/delete): `ownerOrPermission(...)` / `hasPermission(...)`.
 *
 * Source-string read, same rationale as the sibling contract tests. entries.get
 * (contest.manage) and layouts/by-route (layout.manage) carry their own
 * dedicated leak-guard tests, so they're not duplicated here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiRoot = resolve(__dirname, '..');
const read = (rel: string): string => readFileSync(resolve(apiRoot, rel), 'utf8');

describe('Phase 1 — privileged non-admin routes that gate on a full permission key', () => {
  const FULL_GATES: Array<[string, string]> = [
    ['products/[id].delete.ts', 'content.moderate'],
    ['docs/migrate-content.post.ts', 'content.editorial'],
    ['videos/categories.post.ts', 'categories.manage'],
    ['videos/categories/[id].delete.ts', 'categories.manage'],
    ['videos/categories/[id].put.ts', 'categories.manage'],
  ];

  it.each(FULL_GATES)('%s gates on requirePermission(event, %s)', (rel, key) => {
    const src = read(rel);
    const re = new RegExp(`requirePermission\\(\\s*event\\s*,\\s*['"]${key.replace('.', '\\.')}['"]`);
    expect(src, `${rel}: must gate on requirePermission(event, '${key}')`).toMatch(re);
    // and must NOT have regressed to the legacy requireAdmin
    expect(src, `${rel}: must not still call requireAdmin`).not.toMatch(/requireAdmin\(/);
  });
});

describe('Phase 1 — owner-OR-permission resource gates', () => {
  // The 5 contest judge/stakeholder routes use the ownerOrPermission helper
  // with contest.manage (replacing `createdById !== user.id && role !== admin`).
  const OWNER_OR_PERM: string[] = [
    'contests/[slug]/judges/[userId].delete.ts',
    'contests/[slug]/judges/index.post.ts',
    'contests/[slug]/stakeholders/[userId].delete.ts',
    'contests/[slug]/stakeholders/index.get.ts',
    'contests/[slug]/stakeholders/index.post.ts',
  ];

  it.each(OWNER_OR_PERM.map((r) => [r]))('%s gates on ownerOrPermission(event, …, contest.manage)', (rel) => {
    const src = read(rel);
    expect(src, `${rel}: must use ownerOrPermission with contest.manage`).toMatch(
      /ownerOrPermission\(\s*event\s*,[^)]*['"]contest\.manage['"]\s*\)/,
    );
    expect(src, `${rel}: must not still compare user.role to 'admin'`).not.toMatch(
      /user\.role\s*[!=]==\s*['"]admin['"]/,
    );
  });

  // Event edit/delete feed an isAdmin boolean into the service; it's now
  // derived from the event.manage permission instead of user.role.
  const EVENT_MANAGE: string[] = ['events/[slug].delete.ts', 'events/[slug].put.ts'];

  it.each(EVENT_MANAGE.map((r) => [r]))('%s derives its admin override from hasPermission(event, event.manage)', (rel) => {
    const src = read(rel);
    expect(src, `${rel}: must derive isAdmin from hasPermission(event, 'event.manage')`).toMatch(
      /hasPermission\(\s*event\s*,\s*['"]event\.manage['"]\s*\)/,
    );
    expect(src, `${rel}: must not still compare user.role to 'admin'`).not.toMatch(
      /user\.role\s*[!=]==\s*['"]admin['"]/,
    );
  });
});
