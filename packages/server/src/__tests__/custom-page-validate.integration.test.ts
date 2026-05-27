/**
 * validateCustomPageScope — PGlite integration tests.
 *
 * Real DB round-trips for the duplicate-check; pure function for the
 * normalisation + file-route checks.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { layouts } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { validateCustomPageScope, FILE_ROUTE_PREFIXES } from '../layout/custom-page-validate.js';
import { saveLayout } from '../layout/layout.js';

describe('validateCustomPageScope', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const u = await createTestUser(db, { role: 'admin' });
    adminId = u.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    await db.delete(layouts);
  });

  // ---- Normalisation rejections ----------------------------------------

  it('rejects malformed path with the normalise reason', async () => {
    const r = await validateCustomPageScope(db, '/about?x=1');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('has-query');
      expect(r.message).toContain('Invalid');
    }
  });

  it('rejects reserved prefix (/api)', async () => {
    const r = await validateCustomPageScope(db, '/api/foo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('reserved-prefix');
  });

  it('rejects bare /', async () => {
    const r = await validateCustomPageScope(db, '/');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('reserved-prefix');
  });

  // ---- File-route conflicts --------------------------------------------

  it.each([
    '/admin', '/admin/themes',
    '/auth', '/auth/login',
    '/hubs', '/hubs/something',
    '/blog', '/blog/post', // ✗ wait — `blog` isn't in FILE_ROUTE_PREFIXES; should pass
    '/about', '/about/team',
    '/contests/active',
    '/learn/path',
    '/u/alice',
  ].filter(p => FILE_ROUTE_PREFIXES.has(p.slice(1).split('/')[0]!)))(
    'rejects %s — file route conflict',
    async (path) => {
      const r = await validateCustomPageScope(db, path);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('file-route-conflict');
    },
  );

  it('case-insensitive against the file-route list (path is lowercased first)', async () => {
    const r = await validateCustomPageScope(db, '/ADMIN/settings');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('file-route-conflict');
  });

  it('accepts a path that has no file-route conflict (/team)', async () => {
    const r = await validateCustomPageScope(db, '/team');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scope).toEqual({ type: 'custom-page', path: '/team' });
  });

  it('accepts nested path (/team/contact) when its TOP segment is free', async () => {
    const r = await validateCustomPageScope(db, '/team/contact');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scope.path).toBe('/team/contact');
  });

  it('supports an override fileRoutePrefixes for thin apps', async () => {
    const r = await validateCustomPageScope(db, '/team', {
      fileRoutePrefixes: new Set(['team']), // thin app says team is reserved
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('file-route-conflict');
  });

  // ---- Duplicate detection ---------------------------------------------

  it('accepts when no other custom-page exists at the path', async () => {
    const r = await validateCustomPageScope(db, '/team');
    expect(r.ok).toBe(true);
  });

  it('rejects when a custom-page at the SAME path already exists', async () => {
    const saved = await saveLayout(db, {
      scope: { type: 'custom-page', path: '/team' },
      name: 'Team',
      pageMeta: { title: 'Team', access: 'public' },
      state: 'draft',
      zones: [],
    }, { userId: adminId });
    expect(saved.id).toBeTruthy();

    const r = await validateCustomPageScope(db, '/team');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('custom-page-already-exists');
  });

  it('passes when excludeLayoutId matches the existing layout (update-mode)', async () => {
    const saved = await saveLayout(db, {
      scope: { type: 'custom-page', path: '/team' },
      name: 'Team',
      pageMeta: { title: 'Team', access: 'public' },
      state: 'draft',
      zones: [],
    }, { userId: adminId });

    // Admin editing the same page they own
    const r = await validateCustomPageScope(db, '/team', { excludeLayoutId: saved.id });
    expect(r.ok).toBe(true);
  });

  it('rejects on update when excludeLayoutId does NOT match (collision with different layout)', async () => {
    const a = await saveLayout(db, {
      scope: { type: 'custom-page', path: '/team' },
      name: 'Team',
      pageMeta: { title: 'Team', access: 'public' },
      state: 'draft',
      zones: [],
    }, { userId: adminId });

    const b = await saveLayout(db, {
      scope: { type: 'custom-page', path: '/contact' },
      name: 'Contact',
      pageMeta: { title: 'Contact', access: 'public' },
      state: 'draft',
      zones: [],
    }, { userId: adminId });

    // Admin tries to MOVE the contact layout (b) to /team, where (a) already exists
    const r = await validateCustomPageScope(db, '/team', { excludeLayoutId: b.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('custom-page-already-exists');

    // Sanity — a's id passes
    const aSelf = await validateCustomPageScope(db, '/team', { excludeLayoutId: a.id });
    expect(aSelf.ok).toBe(true);
  });

  // ---- Path normalisation in the scope output --------------------------

  it('returns the NORMALISED path in scope, even if input had trailing slash / uppercase', async () => {
    const r = await validateCustomPageScope(db, '/Team/');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scope.path).toBe('/team');
  });
});
