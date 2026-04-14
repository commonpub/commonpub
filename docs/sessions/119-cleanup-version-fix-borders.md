# Session 119 — Cleanup, Docs Version Fix, Explainer Borders (2026-04-13)

Post-v1.0 cleanup session. 3 commits, all deployed via CI auto-deploy.

## Verification
- 26/26 typecheck, 30/30 test suites — verified after every commit
- 3 commits pushed, all auto-deployed via CI

## Commit 1 — BlogView Cleanup + E2E Fix

**Commit:** `0fbfb4e`

- Deleted dead `BlogView.vue` from `layers/base/components/views/` (736 lines). Superseded by `ArticleView.vue` in session 116's article→blog merge. No remaining references in the codebase.
- Also deleted `test-site/components/views/BlogView.vue` and updated test-site routing to use ArticleView for blog type (test-site is gitignored).
- Fixed flaky E2E test `navigation.spec.ts:17` — the test assumed the first `.cpub-tab` always starts active, but `activeTab` defaults to `'latest'` (2nd tab) when not authenticated. Changed to dynamically find whichever tab starts active, then click a different one.
- Verified article→blog SQL migration already applied on both instances (0 article rows on commonpub.io and deveco.io).

## Commit 2 — Docs Editor Version Fix

**Commit:** `6b669a5`

**Problem:** The docs editor version selector UI existed (dropdown to pick version), and page listing correctly filtered by version, but:
1. Creating a page always wrote to the default version (editor didn't pass `versionId`)
2. Reorder always operated on the default version's pages (API hardcoded it)

**Changes (2 files):**
- `layers/base/pages/docs/[siteSlug]/edit.vue` — Added `selectedVersionId` computed (resolves version string → UUID from site data). Passes `versionId` in create page body. Passes `version` in reorder body.
- `layers/base/server/api/docs/[siteSlug]/pages/reorder.post.ts` — Added optional `version` field to reorder schema. Resolves to requested version before falling back to default.

## Commit 3 — Explainer Border Width Vars

**Commit:** `89b2b41`

Replaced 16 hardcoded `1px solid` borders with `var(--border-width-default)` across 4 explainer components:
- `ExplainerViewer.vue` — 9 instances (topbar, sidebar, author, navigation). Uses `var(--border-width-default, 2px)` fallback for viewer context.
- `editor/BlockCanvas.vue` — 5 instances (controls, inputs, buttons)
- `editor/EditorSection.vue` — 1 instance
- `editor/EditorTagInput.vue` — 1 instance

Remaining: `editor-v2/ThemeEditor.vue` has 6 instances — intentionally left as-is (self-contained dark theme editor with `#333` fallbacks).

## Outstanding Work
- E2E flaky test — should now be fixed (dynamic active tab detection). Monitor next CI run.
- Docs editor version switcher — now functionally complete for create + reorder + list. Remaining: delete/rename/reparent/duplicate all operate on page IDs (version-agnostic), so they work correctly already.
- Explainer export templates (`src/export/templates.ts`, `src/export/htmlExporter.ts`) — 11 instances of `1px solid` in HTML export strings where CSS vars aren't available. Intentional.
- Low-priority tech debt from MEMORY.md still applies.
