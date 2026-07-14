# Session 235 — roll session-234-remediation to all 3 (2026-07-14)

Rolled the session-234 backlog-remediation batch to production. Method: an ultracode pre-roll audit
(read-only Workflow, 5 independent verifiers + synthesis) gated the roll; execution was staged
(commonpub.io first, verified healthy, then forks + CLI).

## Pre-roll audit (Workflow, 5 verifiers → GO_WITH_CAVEAT)
Verified: publish-set completeness, migration/DB safety (NONE), consumer-breaking export surface (only
`canAccessCommentTarget` ADDED — no break), 0.x caret pin-crossing, and ui-publish necessity. Blocking
findings were all roll-mechanics, not code defects:
- **B1/B2** — CLI `template.rs`/`cli.rs` layer pin `^0.98.0` does NOT satisfy 0.99.0 (0.x caret rule) →
  hand-edited to `^0.99.0` (+ server `^2.107.0`). The branch commit had left them stale at ^0.98/^2.106.
- **B3** — layer pins `@commonpub/ui` as `workspace:*` (frozen to exact at publish) → bumping ui requires
  publishing it (never bump-without-publish, or layer 0.99 declares a non-existent dep).
- **B4** — forks pin layer `^0.98` → hand-edit `^0.99` + regen lockfiles (0.x, external).

## What shipped
- **npm** (dep order, layer last so `workspace:*` freezes to exact): `@commonpub/ui 0.13.1→0.13.2`,
  `@commonpub/server 2.106.0→2.107.0`, `@commonpub/layer 0.98.0→0.99.0`. NO migration. NO new flag.
  Verified layer 0.99.0 deps froze to exact ui@0.13.2 + server@2.107.0; published tarball ships the a11y
  `--text-dim` CSS.
- **commonpub.io** — `session-234-remediation` ff-merged to `main`; deploy `29309296189` success.
- **Forks** — deveco (regen `pnpm-lock.yaml`) + heatsync (regen BOTH `package-lock.json` + `pnpm-lock.yaml`);
  both CI + Deploy green.
- **CLI** — tag `create-commonpub-v0.5.22` → crates.io 0.5.22 (pins ^0.99/^2.107/^0.57/^0.31).

## Fixes now LIVE (from 234-backlog-remediation.md)
comment-write access gate (HIGH security), outbox negative-page 500 clamp, id-less reply dedup, ENV_FLAG_MAP
parity, StatBar/kbd WCAG AA, P-3 CI tripwire, CLI re-pin.

## Verified live (all 3)
`/api/health` ok; `/api/features` 34 keys, contest flags OFF (unchanged); `/actor/outbox?page=-5 → 200`
(was 500 — the P2 fix, behaviorally confirmed on all 3). crates.io `create-commonpub` = 0.5.22.

## Landmine logged
deveco's `pnpm nuxt typecheck` fails LOCALLY (global `CSSStyleSheet`/`adoptedStyleSheets` DOM-lib conflict +
vue-tsc OOM, in editor/explainer/AdminLayouts files this roll never touched) — but its CLEAN CI is green
(and was green on the identical typecheck for the 233 roll). Local node_modules contamination, not a
regression. Trust the fork's clean CI, not local vue-tsc, for consumer typecheck signal.

## Still open (need creds / a browser session)
- **Behavioral live-test of the comment-write gate** — needs 2 auth accounts + a private hub (non-member
  POST → 404). Deployed + unit/integration-tested; not yet exercised against a live private hub.
- **a11y StatBar browser render** — confirm `.cpub-stat-bar-label` computes `--text-dim` ≥ AA in both themes.
- **Meili reindex** `POST /api/admin/search/reindex` per instance (233 remainder; quality, not an outage).

## Deferred (product decisions — do NOT build blind)
Federation mirror-storage gate (§2b, P1 — "wanted content" semantics); profileVisibility (dedicated feature,
not a partial gate). See 234-handoff.md remaining backlog for the build-ready-no-decision items.
