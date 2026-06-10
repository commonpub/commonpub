# Search overhaul

> Status: PLANNED (session 195 continuation, 2026-06-09). Diagnosis verified live; no code yet.

## Diagnosis (verified against live instances)

1. **P1 — the default tab can't see what the homepage shows.** `/api/search` (index.get.ts)
   runs `searchContent` over LOCAL content only. On a mirror-heavy instance (commonpub.io: the
   entire feed is `mirror-*` federated content), EVERY query returns `{items: [], total: 0}` —
   verified: `q=esp32/arduino/federation/blog` all 0 on commonpub.io while the same items
   appear on its homepage and in `/api/search/federated?q=esp32`. deveco (mostly local
   content) works fine, which masked this. Users search what they SEE; the All tab must
   match the feed's reality.
2. **Trending panel empty on commonpub.io** — same local-only blindness (trending derives
   from local activity).
3. **UI defects on the search page (1280px, stock theme):** the sort dropdown is clipped
   mid-word ("Releva…") — the type-pill + sort + filters row overflows its card; pills have
   no wrap/scroll affordance.
4. **Topbar search is inconsistent across instances:** the layer's topbar "search box" is a
   LINK styled as an input (click → /search). deveco forked the layout to get a real inline
   input. Users read the base one as a broken input (user report).

## Phase 1 — federated results in the All tab (the P1)

When `config.features.seamlessFederation` is on, the default content search merges
`federated_content` matches with local matches — the same bifurcation `listContent` already
does for the feed (reuse its pattern; respect `config.instance.contentTypes` filtering and
the `cpub:type` mapping). Ranking: keep it simple — merge by the existing sort key
(relevance via FTS rank where available, else recency), dedup by objectUri vs local id.
Tests must seed BOTH sources through their real write paths
([[feedback_test_populates_both_sources]]) and assert the merged page is disjoint + ordered
([[feedback_pagination_needs_unique_tiebreaker]]).
Trending: include federated activity or hide the panel when empty (no dead headers).

## Phase 2 — search page UI pass

- Fix the filter-row overflow: pills wrap (or horizontal scroll w/ fade), sort dropdown
  never clipped; audit at 768–1440.
- Empty state: distinguish "no matches" from "this instance has no local content — try the
  Fediverse tab" (or after Phase 1, drop the distinction).
- Keep type tabs in sync with `config.instance.contentTypes` (don't show tabs for disabled
  types).

## Phase 3 — topbar inline search (base layer)

Replace the link-styled box with a real input (deveco's fork is the proven pattern — submit
navigates to `/search?q=`); keep Cmd+K. One focus indicator only: the wrapper ring
(`:focus-within`), inner input suppresses outline AND box-shadow (stoa's `:focus-visible`
glow caused deveco's double ring — fixed in deveco `76648ca`, the base layer needs the same
guard when this lands). Mobile keeps the magnifier link.

## Out of scope (this plan)

Meilisearch rollout/reindex operations (no instance currently sets MEILI_URL in prod;
Postgres FTS is the live path); docs search (separate module); search analytics.
