# Archived Docs

Historical reference. Superseded by current docs — check [`../README.md`](../README.md)
for what's current, or [`../../codebase-analysis/`](../../codebase-analysis/)
for the fresh raw inventory.

## Session 126 archival (2026-04-16)

A two-round archive was done to remove redundant and stale docs after the
codebase-analysis + new guides went in.

### Round 1 — clearly obsolete

| File | Replaced by / Reason |
|---|---|
| `plan-v2.md` | All phases complete; new roadmap lives in session logs |
| `plan-v3-engineering.md` | Never filled in |
| `migration-switch.md` | v1→v2 history |
| `audit-119.md` | Session 119 audit findings, mostly fixed |
| `a11y-audit.md` | Stale after session 122's deeper audit |
| `llm-contributor-guide.md` | Replaced by [`../llm/`](../llm/) |
| `federation-notes.md` | Research notes superseded by `federation.md` |
| `federation-testing-plan.md` | Pre-implementation; federation is implemented |
| `federation-interop-audit.md` | Historical interop audit |

### Round 2 — redundant with new structure

| File | Replaced by |
|---|---|
| `architecture.md` | [`../guides/developers.md#architecture-in-one-page`](../guides/developers.md#architecture-in-one-page) + codebase-analysis |
| `contributing.md` | [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) (GitHub canonical) + [`../guides/developers.md`](../guides/developers.md) + [`../coding-standards.md`](../coding-standards.md) |
| `federation-plan.md` | Roadmap complete; current state in [`../federation.md`](../federation.md) + [`../../codebase-analysis/`](../../codebase-analysis/) |
| `federation-map.md` | [`../../codebase-analysis/03-server-modules.md`](../../codebase-analysis/03-server-modules.md) + [`04-api-routes.md`](../../codebase-analysis/04-api-routes.md) + [`07-state-diagrams.md`](../../codebase-analysis/07-state-diagrams.md) |
| `reference/architecture.md` | Same replacement as top-level architecture.md |
| `reference/fedify-research.md` | Research notes, no longer actionable |
| `reference/implementation-guide.md` | Replaced by [`../guides/developers.md`](../guides/developers.md) |
| `reference/packages/*.md` (11) | Canonical is each `packages/*/README.md` (npm publishes these) |
| `reference/server/*.md` (12) | Replaced by [`../../codebase-analysis/03-server-modules.md`](../../codebase-analysis/03-server-modules.md) |
| `reference/guides/admin-and-permissions.md` | Stale (no admin nav / judge perms); rewrite deferred |
| `reference/guides/feature-flags.md` | Replaced by [`../../codebase-analysis/08-feature-flags-inventory.md`](../../codebase-analysis/08-feature-flags-inventory.md) |
| `reference/guides/federation.md` | Replaced by [`../federation.md`](../federation.md) |
| `reference/guides/hooks.md` | Covered in [`../../codebase-analysis/03-server-modules.md`](../../codebase-analysis/03-server-modules.md) (hook bus section) + [`../llm/conventions.md`](../llm/conventions.md) |
| `reference/guides/routing.md` | Superseded by `reference/guides/url-structure.md` + [`../../codebase-analysis/05-layer-pages-components.md`](../../codebase-analysis/05-layer-pages-components.md) |
| `reference/guides/v1-limitations.md` | Stale (many deferred items now implemented) |
| `plans/session-109-federation-seamless.md` | Historical session plan |
| `plans/session-111-editor-decoupling.md` | Historical session plan |
| `plans/session-123/` | Historical session plan bundle |
| `plans/url-restructure-audit.md` | Work complete (session 108) |
| `plans/url-restructure-user-scoped-paths.md` | Work complete (session 108) |

## Subdirectories (pre-existing)

- `architecture/` — layer-consumption notes from the Svelte era
- `mockups/` — design mockups from early phases
- `research/` — old research notes

## What's NOT here (still canonical)

Top-level docs/:
- `../federation.md` — current federation guide
- `../quickstart.md`, `../deployment.md`, `../coding-standards.md`, `../building-with-commonpub.md`
- `../README.md` — docs index
- `../guides/users.md`, `../guides/developers.md`, `../guides/README.md`
- `../llm/` — AI-coding-agent context (5 files)
- `../reference/index.md` + `../reference/guides/theming.md` + `../reference/guides/url-structure.md`
- `../adr/` — architecture decision records
- `../sessions/` — chronological session logs (source of truth for recent changes)

Repo root:
- [`../../README.md`](../../README.md) — project overview
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — contributor entry point
- [`../../CHANGELOG.md`](../../CHANGELOG.md) — release log
- [`../../codebase-analysis/`](../../codebase-analysis/) — exhaustive deep inventory
