/**
 * Read every page of an offset-paginated `{ items, total }` endpoint.
 *
 * Why this exists: `normalizePagination` gives every list route a default limit
 * of 20 and a hard max of 100, and several contest surfaces fetched
 * `/api/contests/:slug/entries` with no limit at all. The judge page, the
 * advancement picker and the contest page therefore saw only the 20 newest
 * entries. On a judge page that is silent: "Scored 20 / 20" reads as done while
 * the 21st entry is never shown to anyone (session 260).
 *
 * The loop stops on whichever comes first: the reported `total` is reached, a
 * page comes back short or empty (the total moved under us, or the server
 * capped the page), or `maxPages` is hit as a runaway backstop. The `total`
 * returned is the server's, so a caller can still tell when the backstop cut
 * the list short (`items.length < total`).
 */
export interface Page<T> {
  items: T[];
  total: number;
}

export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<Page<T>>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<Page<T>> {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 50;
  const items: T[] = [];
  let total = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const res = await fetchPage(items.length, pageSize);
    total = res.total;
    items.push(...res.items);
    if (res.items.length < pageSize || items.length >= total) break;
  }
  return { items, total };
}
