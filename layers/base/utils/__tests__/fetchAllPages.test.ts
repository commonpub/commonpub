import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages } from '../fetchAllPages';

/** A fake offset-paginated endpoint over `n` rows that clamps limit like normalizePagination. */
function endpoint(n: number, maxLimit = 100) {
  const rows = Array.from({ length: n }, (_, i) => i);
  return vi.fn(async (offset: number, limit: number) => ({
    items: rows.slice(offset, offset + Math.min(limit, maxLimit)),
    total: n,
  }));
}

describe('fetchAllPages', () => {
  it('returns every row past the default 20-row page (the judge page bug)', async () => {
    const fetchPage = endpoint(21);
    const res = await fetchAllPages(fetchPage);
    expect(res.items).toHaveLength(21);
    expect(res.total).toBe(21);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('walks multiple pages with advancing offsets', async () => {
    const fetchPage = endpoint(250);
    const res = await fetchAllPages(fetchPage);
    expect(res.items).toEqual(Array.from({ length: 250 }, (_, i) => i));
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 100, 200]);
  });

  it('keeps reading when the server clamps the page below the requested size', async () => {
    // registrants: the route accepts limit=200, the service clamps to 100. Stopping
    // on the "short" first page dropped every registrant past the 100th.
    const fetchPage = endpoint(45, 20);
    const res = await fetchAllPages(fetchPage, { pageSize: 100 });
    expect(res.items).toEqual(Array.from({ length: 45 }, (_, i) => i));
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 20, 40]);
  });

  it('stops on an empty page when the total shrank under it', async () => {
    let total = 30;
    const fetchPage = vi.fn(async (offset: number) => {
      const res = { items: offset === 0 ? Array.from({ length: 20 }, (_, i) => i) : [], total };
      total = 20; // rows deleted between the two requests
      return res;
    });
    const res = await fetchAllPages(fetchPage, { pageSize: 20 });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(res.items).toHaveLength(20);
  });

  it('handles an empty list in one call', async () => {
    const fetchPage = endpoint(0);
    const res = await fetchAllPages(fetchPage);
    expect(res).toEqual({ items: [], total: 0 });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('honours the maxPages backstop', async () => {
    const fetchPage = vi.fn(async () => ({ items: [1, 2], total: 1_000_000 }));
    const res = await fetchAllPages(fetchPage, { pageSize: 2, maxPages: 3 });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(res.items).toHaveLength(6);
    expect(res.total).toBe(1_000_000);
  });
});
