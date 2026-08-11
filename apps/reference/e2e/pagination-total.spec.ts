import { test, expect } from '@playwright/test';

/**
 * No list endpoint may ever report a negative total.
 *
 * The list helpers skip `COUNT(*)` past the first page and report
 * `COUNT_NOT_COMPUTED` (-1) as an internal marker. Thirteen call sites produce
 * it; session 254 found nothing translated it back, and `?? 0` cannot catch it
 * because nullish coalescing fires only on null and undefined.
 *
 * Live on deveco.io, `/api/search?q=a&dateFrom=2000-01-01&offset=24` returned
 * `{total: -1, items: 11}`. The page rendered "-1 results" and, worse,
 * `Math.ceil(-1 / pageSize)` collapsed `totalPages` to 1, so the `v-if` around
 * the pager went false and a visitor on page 2 lost Previous as well as Next.
 *
 * This is deliberately a CLASS test rather than one per bug. Every endpoint
 * below is probed at `offset > 0`, which is the branch that skips the count, so
 * it exercises the sentinel path even against an empty database. Adding a list
 * endpoint without translating its total should fail here.
 */
const BASE = 'http://localhost:3000';

/** `offset` is what matters: it selects the branch that skips COUNT(*). */
const LIST_ENDPOINTS = [
  { name: 'search', path: '/api/search?q=a&offset=24' },
  { name: 'search (filtered, bypasses federated merge)', path: '/api/search?q=a&dateFrom=2000-01-01&offset=24' },
  { name: 'videos', path: '/api/videos?offset=20' },
  { name: 'events', path: '/api/events?offset=20' },
  { name: 'content', path: '/api/content?offset=20' },
  // `featured` (like authorId/editorial/categoryId/difficulty/tag) bypasses the
  // federated merge, which is what forces localOffset > 0 and skips the count.
  // The plain /api/content probe above does NOT reach that branch, and this one
  // was still returning -1 after the first round of fixes.
  { name: 'content (federated-merge bypass)', path: '/api/content?offset=20&featured=true' },
  { name: 'content (tag filter)', path: '/api/content?offset=20&tag=x' },
];

test.describe('pagination totals', () => {
  for (const endpoint of LIST_ENDPOINTS) {
    test(`${endpoint.name} never reports a negative total`, async ({ request }) => {
      const res = await request.get(`${BASE}${endpoint.path}`);
      // A feature-gated or unauthorised endpoint is not what this test is about.
      test.skip(res.status() === 404 || res.status() === 403, `gated: ${res.status()}`);
      expect(res.ok(), `${endpoint.path} returned ${res.status()}`).toBe(true);

      const body = await res.json();
      if (!('total' in body)) return;

      expect(
        body.total === null || (typeof body.total === 'number' && body.total >= 0),
        `${endpoint.path} reported total=${JSON.stringify(body.total)}; a skipped count must be null, never a negative sentinel`,
      ).toBe(true);
    });
  }

  test('an uncounted page still says whether more exist', async ({ request }) => {
    // Without this, a consumer that cannot see a total has no way to render a
    // pager at all, which is how the control came to unmount entirely.
    const res = await request.get(`${BASE}/api/search?q=a&dateFrom=2000-01-01&offset=24`);
    test.skip(!res.ok(), `search unavailable: ${res.status()}`);
    const body = await res.json();
    expect(typeof body.hasMore, 'hasMore is what a pager binds to when total is unknown').toBe('boolean');
  });

  test('the first page still reports a real count', async ({ request }) => {
    // The fix must not turn every total into null: page 1 is counted, and
    // "0 results" has to stay distinguishable from "not counted".
    const res = await request.get(`${BASE}/api/search?q=a&offset=0`);
    test.skip(!res.ok(), `search unavailable: ${res.status()}`);
    const body = await res.json();
    expect(typeof body.total, 'page 1 takes a count, so it must be a number').toBe('number');
    expect(body.total).toBeGreaterThanOrEqual(0);
  });
});
