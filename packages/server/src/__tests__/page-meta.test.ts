import { describe, it, expect } from 'vitest';
import { COUNT_NOT_COMPUTED, isCountComputed, toPageMeta } from '../query.js';

/**
 * The skipped-count sentinel must never reach a client.
 *
 * Session 254 found `-1` rendered verbatim on deveco.io: `/api/search` returned
 * `{total: -1, items: 11}`, the page printed "-1 results", and
 * `Math.ceil(-1 / pageSize)` collapsed `totalPages` to 1 so the `v-if` around
 * the pager went false. A visitor who clicked to page 2 lost Previous as well as
 * Next, with the page number absent from the URL, so there was no way back.
 *
 * `?? 0` did not catch it, and never could: nullish coalescing fires only on
 * null and undefined. That is the trap these tests exist to keep shut.
 */
describe('toPageMeta', () => {
  const LIMIT = 20;

  it('passes a real count through and computes hasMore from it', () => {
    expect(toPageMeta({ total: 57, returned: 20, limit: LIMIT, offset: 0 })).toEqual({
      total: 57,
      hasMore: true,
    });
    expect(toPageMeta({ total: 57, returned: 17, limit: LIMIT, offset: 40 })).toEqual({
      total: 57,
      hasMore: false,
    });
  });

  it('reports an uncounted page as null, never as the sentinel and never as zero', () => {
    const meta = toPageMeta({ total: COUNT_NOT_COMPUTED, returned: 11, limit: LIMIT, offset: 24 });
    expect(meta.total, 'a client must be able to tell "not counted" from "none"').toBeNull();
    expect(meta.total).not.toBe(COUNT_NOT_COMPUTED);
    expect(meta.total).not.toBe(0);
  });

  it('still answers hasMore without a count, which is what a pager binds to', () => {
    // A full page is the only evidence more rows exist.
    expect(toPageMeta({ total: COUNT_NOT_COMPUTED, returned: 20, limit: 20, offset: 20 }).hasMore).toBe(true);
    // A short page is proof it is the last one.
    expect(toPageMeta({ total: COUNT_NOT_COMPUTED, returned: 11, limit: 20, offset: 24 }).hasMore).toBe(false);
  });

  it('errs toward showing one page too many rather than hiding rows', () => {
    // A final page that exactly fills the limit advertises a next page that
    // turns out empty. That is the deliberate direction to be wrong in: the
    // alternative drops results the visitor asked for.
    expect(toPageMeta({ total: COUNT_NOT_COMPUTED, returned: 20, limit: 20, offset: 0 }).hasMore).toBe(true);
  });

  it('never returns a negative total for any input, including a corrupt one', () => {
    for (const total of [COUNT_NOT_COMPUTED, -2, -99, 0, 1, 1000]) {
      for (const offset of [0, 20, 4000]) {
        const { total: out } = toPageMeta({ total, returned: 5, limit: LIMIT, offset });
        expect(out === null || out >= 0, `total ${total} at offset ${offset} produced ${out}`).toBe(true);
      }
    }
  });

  it('treats an empty first page as a genuine zero, not as unknown', () => {
    // Distinguishing this from "not counted" is the whole point of null: a real
    // zero must still say zero, or "No results" turns into a blank.
    expect(toPageMeta({ total: 0, returned: 0, limit: LIMIT, offset: 0 })).toEqual({
      total: 0,
      hasMore: false,
    });
  });
});

describe('isCountComputed', () => {
  it('rejects the sentinel and every other negative', () => {
    expect(isCountComputed(COUNT_NOT_COMPUTED)).toBe(false);
    expect(isCountComputed(-2)).toBe(false);
  });

  it('accepts zero, which is a real count', () => {
    expect(isCountComputed(0)).toBe(true);
  });

  it('rejects null and undefined rather than coercing them', () => {
    expect(isCountComputed(null)).toBe(false);
    expect(isCountComputed(undefined)).toBe(false);
  });
});
