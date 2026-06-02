# 10 — Existing Docs Audit

Assessment of the `docs/` tree, ADRs, and the LLM context docs.
Regenerated session 181 (2026-06-01) against the actual tree — the prior
version audited a `docs/reference/server/` + `docs/reference/packages/`
layout that has since been reorganized away, so it was rebuilt from a fresh
`find docs -name '*.md'` rather than patched.

## How `docs/` is organized now

```
docs/
├── *.md                 7 canonical top-level docs
├── llm/                 LLM context pack (facts, gotchas, conventions, recipes)
├── guides/              human guides (users, developers)
├── reference/           index + guides/ (5 feature guides)
├── plans/               11 active planning docs
├── adr/                 26 ADRs (NNN-kebab.md, through 028)
├── sessions/            149 session logs (through session 181)
└── archive/             frozen historical docs (+ architecture/ mockups/ plans/ reference/ research/ subdirs)
```

## Summary

- `docs/sessions/` — **authoritative** for recent change history (newest NNN first). Trust over everything else when they conflict.
- `docs/llm/{facts,gotchas}.md` — the condensed current-state pack; kept current (facts.md refreshed session 180/181). Load before touching code.
- `docs/*.md` (top level) — the 7 canonical docs; broadly fresh.
- `docs/reference/guides/` — 5 feature guides; the newer ones (contests, layout-engine, theme-editor) are current.
- `docs/plans/` — active planning docs; checkbox state often lags shipped reality (noted per-plan below).
- `docs/adr/` — 26 ADRs through 028; older ones still lack status/date fields and a few are silently superseded.
- `docs/archive/` — historical material; do not treat as current.
- `CHANGELOG.md` — grouped by session, runs through ~session 161; behind the per-package npm versions but no longer "stuck at v0.2.0".

## Top-level (`docs/*.md`)

| File | Status | Notes |
|---|---|---|
| README.md | ✔ fresh | docs index |
| quickstart.md | ✔ fresh | evergreen getting-started |
| building-with-commonpub.md | ✔ fresh | thin-app / layer-extension guide |
| coding-standards.md | ✔ fresh | CI-enforced conventions |
| deployment.md | ✔ fresh | Docker + Caddy + DO |
| federation.md | ✔ fresh | activity delivery + hub federation |
| public-api.md | ✔ fresh | public read API v1 (scopes, bearer tokens) |

(All the formerly-top-level docs the previous audit listed — `architecture.md`, `contributing.md`, `federation-plan.md`, `plan-v2.md`, `plan-v3-engineering.md`, `llm-contributor-guide.md`, `federation-*` research, `a11y-audit.md`, `audit-119.md`, `migration-switch.md` — have been moved under `docs/archive/`. They are historical; don't cite them as current.)

## LLM context pack (`docs/llm/`)

| File | Status | Notes |
|---|---|---|
| facts.md | ✔ current | Condensed architecture facts; refreshed session 180/181. Has minor count drift vs source (verify counts against `codebase-analysis/` + `grep`). |
| gotchas.md | ✔ current | Hard-won production gotchas; mirrors `09-gotchas-and-invariants.md`. |
| conventions.md | ✔ fresh | Coding conventions for LLM contributors. |
| task-recipes.md | ✔ fresh | Common task playbooks. |
| README.md | ✔ fresh | Pack index. |

## Human guides (`docs/guides/`)

| File | Status |
|---|---|
| users.md | ✔ fresh |
| developers.md | ✔ fresh |
| README.md | ✔ fresh |

## Reference guides (`docs/reference/guides/`)

| Guide | Status | Notes |
|---|---|---|
| contests.md | ✔ fresh | contest system + judging (sessions 117/171–174) |
| layout-engine.md | ✔ fresh | layout engine + `<LayoutSlot>` (sessions 155–169) |
| theme-editor.md | ✔ fresh | admin theme editor (session 154) |
| theming.md | ✔ fresh | token system + overrides |
| url-structure.md | ✔ fresh | `/u/{username}/{type}/{slug}` canonical URLs (session 108) |

`docs/reference/index.md` is the reference landing page. The old per-module `reference/server/*.md` and `reference/packages/*.md` directories no longer exist — module/package reference now lives in `codebase-analysis/03` + `06`.

## ADRs (`docs/adr/`)

**26 ADRs, through `028-homepage-customization-model.md`.** Recent dated ones:
- 023 Polish & Launch
- 024 CommonPub rename
- 025 Nuxt framework switch
- 026 UI Design Direction (**supersedes ADR 006**)
- 027 Layout-engine architecture (sessions 155–169)
- 028 Homepage-customization model (session 168, `<PageFrame>`)

Older ADRs (002–022) mostly lack `status`/`date` fields. Still-unmarked supersessions:
- **006 CSS Tokens** — superseded by 026
- **005 TipTap** — superseded by 012 TipTap Architecture
- **019 Federation Architecture** — many phases implemented since; the archived federation-plan + `federation.md` are newer truth

## Plans (`docs/plans/`)

11 active planning docs. Checkbox state frequently lags shipped reality — cross-check against session logs:

| Plan | State |
|---|---|
| pagination-scalability.md | SHIPPED through step 4 (keyset feed, migration 0012) |
| layout-and-pages.md / layout-engine-rollout.md / phase-3-editor.md / stage-e-unification.md | Layout engine + editor largely SHIPPED (sessions 155–169); some boxes unchecked |
| rbac.md | Phase 0/1 SHIPPED (sessions 175–177), flag default OFF |
| federation-hardening.md | Stage 1–3 SHIPPED (sessions 145–150) |
| redis-integration.md | SHIPPED (session 130, opt-in `NUXT_REDIS_URL`) |
| deveco-parity-and-card-sizing.md / deveco-registered-theme-parity.md | In progress (deveco parity initiative) |
| instance-self-update.md | Planning |

## Session logs (`docs/sessions/`)

**149 files, numbered through session 181** (some are `NNN-kickoff-next.md` handoffs). All fresh; the **source of truth** for recent changes. When a guide or plan contradicts a session log, trust the session log.

## CHANGELOG

`CHANGELOG.md` is grouped by session/working-period (not strict semver) and runs through ~session 161. Per-package npm versions move independently and are ahead of it. Not "stuck at v0.2.0" anymore, but still behind session 181 — for exact recent history read `docs/sessions/` and `git log`.

## Highest-impact remaining gaps

1. **RBAC guide** — phase 0/1 shipped (sessions 175–177) but no `docs/reference/guides/rbac.md`.
2. **Public-API scope reference** — `public-api.md` exists; ensure the 12 read scopes + key issuance flow are enumerated.
3. **Keyset-pagination note** — the cursor contract + crafted-cursor DoS lesson live in `codebase-analysis/09` + MEMORY but not in a human guide.
4. **ADR hygiene** — add `status`/`date` to pre-023 ADRs; mark the known supersessions (005→012, 006→026).
5. **CHANGELOG** — extend from ~160 to current.

## Notes

- Content-level freshness of the surviving guides was spot-checked structurally (existence/scope), not line-by-line. Treat "fresh" as "covers the current feature", not "every sentence verified".
- The `codebase-analysis/` folder (this directory) is the structural source of truth for tables/routes/modules/components; the `docs/` guides are the human-facing derivatives.
