# Session 178 — contest dedup + card-sizing + the load-more pagination saga + scalability audit

2026-05-31, continued from 177. Shipped a contest-dedup fix, content-card sizing
tokenization (all instances), and finally root-caused + fixed the homepage load-more
duplication across all three instances — then audited pagination for scale.

## Live + verified on all 3 (commonpub.io / deveco.io / heatsynclabs.io)

### Card sizing — Phase A of deveco parity (layer 0.40.0)
- Base content-card grids were inconsistent (homepage `repeat(2,1fr)` no min-width →
  "massive" cards; listings 220–300px scattered). Introduced `--cpub-card-min: 260px`
  + `--cpub-card-gap: 20px` theme tokens (deveco's values) in `packages/ui/theme/base.css`
  and switched **16 content-card grids** to `repeat(auto-fill, minmax(var(--cpub-card-min),1fr))`.
  Non-content grids (stats/specs/products/events/hubs) left alone. ContentCard cover already 4/3.

### Load-more duplication — the real fix (took 5 server releases; lessons below)
The user reported homepage load-more re-showing rows. Root cause was a CHAIN:
1. **Unstable sort** — `listContent` `sort:'popular'` ordered by `viewCount` alone; most
   content is `viewCount=0` (tied) → unstable LIMIT/OFFSET → overlapping pages. Added a
   unique `id` tiebreaker to every sort branch (server 2.68.0).
2. **Federated-merge instability** — seamless-federation instances (deveco, commonpub.io)
   use an in-app merge of local+federated; its `publishedAt` sort + the federated subquery
   lacked tiebreakers (server 2.69.0).
3. **Sort-key MISMATCH (the real one)** — the merge sorts by `publishedAt`, but for
   `sort:'popular'` the LOCAL slice ordered by `viewCount` → the viewCount-top-K slice fed a
   publishedAt-ordered merge → wrong window → dups. Federated content has no viewCount, so a
   merged feed is inherently chronological: force the local slice to recency when merging
   (server 2.70.0). **deveco verified OVERLAP=0.**
4. **Byte-ordering mismatch (commonpub.io only — real federated data)** — the local SQL,
   federated SQL, and JS merge comparator must use an IDENTICAL total order; the federated
   query used `desc()` (Postgres NULLS FIRST) + a `receivedAt` secondary while the merge maps
   null→0 (last) + ties on id only, and the local slice carried a `createdAt` secondary the
   merge ignored. Aligned all three to `(publishedAt DESC NULLS LAST, id DESC)`. **commonpub.io
   verified OVERLAP=0** (×3 trials). This fix is on commonpub WORKSPACE only — see Deferred.

### Earlier in the session (already shipped 0.38.0–0.39.0, see 177 log tail)
- Contest hero/sidebar dedup; markdownToExcerpt util; orphaned-CSS removal; **gitignore
  route-swallow fix** (`reports/` → `**/reports/mutation/`); docs shiki CI-flake warmup;
  deveco custom-homepage contest dedup + non-active filter.

## Infra
- **deveco Dockerfile** switched `pnpm install --frozen-lockfile` → `npm install` (matching
  heatsync). NOTE: this was a MISDIAGNOSIS detour (deveco was already running new code — the
  layer-0.40.0 CSS token proved it; the real bug was the merge sort-key mismatch). Left it in
  (harmless, matches heatsync, avoids the pnpm-drops-files risk).
- deveco's deploy health check (25s) false-alarms on cold start (>25s) but reports success
  anyway — don't read "Health check failed" as a crash.

## Versions
Published: **server 2.70.0, layer 0.42.0**, config 0.16.0, schema 0.24.0, auth 0.7.0.
Migrations still **12** (0011 latest) — card sizing was CSS, pagination was query logic, no
schema change. deveco + heatsync on 0.42.0/2.70.0 (correct — no federated-content edge).

## DEFERRED (must do next session)
- **Publish the commonpub-workspace alignment fix (commit 2d99c74) as server 2.71.0 / layer
  0.43.0** so deveco + heatsync get it before they accrue federated content. (Not urgent —
  they have no/little federated data today.)

## Scalability audit (user: "don't be a bottleneck at thousands of users")
Full audit + design in `docs/plans/pagination-scalability.md`. Verdict: the OFFSET + in-app
federated-merge + per-request COUNT(*) + no-sort-indexes design is now CORRECT but not
scale-optimal. User chose the proper long-term pattern: **keyset (cursor) pagination + composite
indexes + count-on-page-1**. To be implemented fresh — see `178-kickoff-next.md`.

## Lessons (memories written)
- [[feedback_pagination_needs_unique_tiebreaker]] — updated with the multi-source merge
  key-consistency lesson + the misdiagnosis-avoidance notes (verify flags empirically; use a
  deployed-version MARKER; test CONSTANT limit; cold-start ≠ crash).
- [[feedback_unanchored_gitignore_swallows_source]], [[project_pagination_scalability]],
  [[project_deveco_parity_initiative]].
