import { describe, it, expect, vi } from 'vitest';
import {
  listDocsSites,
  getDocsSiteBySlug,
  updateDocsSite,
  deleteDocsSite,
  setDefaultVersion,
  reorderDocsPages,
  searchDocsPages,
} from '../docs';

/**
 * Creates a chainable mock that mimics the Drizzle query-builder API.
 * Every builder method returns `chain` so calls can be chained freely;
 * `.then` resolves with `rows` (default `[]`) so the chain is awaitable.
 */
const chainable = (rows: unknown[] = []) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn().mockImplementation((resolve) => resolve(rows));
  return chain;
};

type DB = Parameters<typeof listDocsSites>[0];

// ---------------------------------------------------------------------------
// listDocsSites
// ---------------------------------------------------------------------------
describe('listDocsSites', () => {
  it('defaults limit to 20 and offset to 0', async () => {
    const chain = chainable();
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as DB;

    await listDocsSites(db, {});

    // The function issues two parallel selects (rows + count).
    // Both go through `db.select(...)` which returns the same chain.
    // The rows query calls `.limit(20)` and `.offset(0)`.
    expect(chain.limit).toHaveBeenCalledWith(20);
    expect(chain.offset).toHaveBeenCalledWith(0);
  });

  it('clamps limit to max 100', async () => {
    const chain = chainable();
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as DB;

    await listDocsSites(db, { limit: 999 });

    expect(chain.limit).toHaveBeenCalledWith(100);
  });
});

// ---------------------------------------------------------------------------
// getDocsSiteBySlug
// ---------------------------------------------------------------------------
describe('getDocsSiteBySlug', () => {
  it('returns null when no rows match the slug', async () => {
    const chain = chainable([]);
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as DB;

    const result = await getDocsSiteBySlug(db, 'nonexistent-slug');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateDocsSite
// ---------------------------------------------------------------------------
describe('updateDocsSite', () => {
  it('returns null when ownership check fails (empty select)', async () => {
    const chain = chainable([]);
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as DB;

    const result = await updateDocsSite(db, 'site-1', 'wrong-owner', {
      name: 'Updated',
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteDocsSite
// ---------------------------------------------------------------------------
describe('deleteDocsSite', () => {
  it('returns false when ownership check fails', async () => {
    const chain = chainable([]);
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as DB;

    const result = await deleteDocsSite(db, 'site-1', 'wrong-owner');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setDefaultVersion
// ---------------------------------------------------------------------------
describe('setDefaultVersion', () => {
  it('returns false when version not found', async () => {
    const chain = chainable([]);
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as DB;

    const result = await setDefaultVersion(db, 'v-missing', 'owner-1');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reorderDocsPages
// ---------------------------------------------------------------------------
describe('reorderDocsPages', () => {
  it('returns false when version not found', async () => {
    const chain = chainable([]);
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as DB;

    const result = await reorderDocsPages(db, 'v-missing', 'owner-1', [
      'p1',
      'p2',
    ]);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchDocsPages
// ---------------------------------------------------------------------------
describe('searchDocsPages', () => {
  it('returns empty array for empty query', async () => {
    const db = {} as unknown as DB;

    const result = await searchDocsPages(db, 'site-1', 'v-1', '');

    expect(result).toEqual([]);
  });

  it('returns empty array for whitespace-only query', async () => {
    const db = {} as unknown as DB;

    const result = await searchDocsPages(db, 'site-1', 'v-1', '   ');

    expect(result).toEqual([]);
  });
});
