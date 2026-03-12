# Session 005: Explainer System (Phase 5)

## Date

2026-03-09

## What Was Done

### Research & Architecture

- `docs/research/explainer-runtime.md` — GSAP licensing, alternatives (Motion One, Web Animations API), scroll-snap vs ScrollTrigger, prior art (Observable, Brilliant.org, Scrollama, Idyll)
- `docs/research/html-export.md` — Single-file HTML generation approaches, JS/CSS inlining strategy, size budget
- `docs/adr/015-explainer-data-model.md` — Sections as structured JSON, not TipTap nodes
- `docs/adr/016-explainer-architecture.md` — Three-layer architecture (pure TS → Svelte components → GSAP runtime)

### @commonpub/explainer Package (127 tests)

1. **Types** (`types.ts`) — 4 section types (text, interactive, quiz, checkpoint), controls, quiz questions, progress state, TOC items, export options
2. **Zod Schemas** (`schemas.ts`) — Discriminated union validators for all section types, explainer metadata
3. **Section Registry** (`sections/registry.ts`) — Register/lookup/validate/list pattern mirroring @commonpub/editor block registry
4. **Quiz Engine** (`quiz/engine.ts`) — checkAnswer, scoreQuiz, isQuizPassed, validateQuizAnswers, shuffleOptions (deterministic seeded PRNG)
5. **Progress Tracker** (`progress/tracker.ts`) — Pure state machine: create/mark/canAccess/percentage/nextIncomplete/isComplete
6. **TOC Generator** (`render/tocGenerator.ts`) — Sections + progress → TOC data with completion/active/locked flags
7. **Section Renderer** (`render/sectionRenderer.ts`) — BlockTuple → HTML, quiz forms, controls, checkpoints
8. **HTML Exporter** (`export/htmlExporter.ts`) — Self-contained HTML with inlined CSS (4 themes) and vanilla JS for quiz interactivity

### Config & Schema Updates

- `packages/config/src/types.ts` — Added `'explainer'` to `contentTypes` union
- `packages/config/src/schema.ts` — Added `'explainer'` to contentTypes Zod enum
- `packages/schema/src/content.ts` — Updated `sections` JSONB type with `type` discriminator
- `apps/reference/src/lib/types.ts` — Added `sections` to CreateContentInput and UpdateContentInput
- `apps/reference/src/lib/server/content.ts` — Support sections in create and update operations

### Reference App (15 components, 10 routes)

**Viewer Components** (in `src/lib/components/explainer/`):

- ExplainerViewer.svelte — Main orchestrator: TOC sidebar, progress bar, keyboard nav, scroll observer
- ExplainerSection.svelte — Type-switching section renderer (text, quiz, checkpoint)
- ExplainerToc.svelte — Sidebar TOC with completion indicators
- ExplainerProgress.svelte — Top progress bar
- ExplainerQuiz.svelte — Interactive quiz: option selection, scoring, gate enforcement, retry
- ExplainerCheckpoint.svelte — Checkpoint gate UI
- ExplainerNav.svelte — Previous/next section navigation

**Editor Components**:

- ExplainerEditor.svelte — Section list (left) + section editor (right) layout
- SectionList.svelte — Ordered list with add/remove/reorder
- SectionEditor.svelte — Edit single section (type-specific fields, uses ContentEditor for text)
- QuizEditor.svelte — Add/edit questions, options, correct answer, passing score, gate toggle

**Routes**:

- `explainers/` — Listing page (feature flag checked)
- `explainers/[slug]/` — Full-page viewer with ExplainerViewer
- `explainers/create/` — Create form with ExplainerEditor
- `explainers/[slug]/edit/` — Edit form pre-populated from data
- `api/explainers/[slug]/export/` — GET endpoint → download self-contained HTML

**Integration Updates**:

- Create page: Added 'explainer' option to type dropdown + server validation
- `[type]/[slug]` route: Redirect explainers to `/explainers/[slug]`

## Decisions Made

- Sections stored as structured JSON in `sections` JSONB, not TipTap nodes (ADR 015)
- Three-layer architecture: pure TS → Svelte → GSAP (ADR 016)
- GSAP deferred to Phase 5b — Phase 5 uses static rendering + CSS scroll-snap
- Progress stored in localStorage (server persistence deferred to Phase 6)
- Quiz options shuffle with deterministic seeded PRNG (mulberry32)
- HTML export includes vanilla JS (~6KB) for quiz interactivity, no framework runtime
- 4 theme variants with CSS custom property fallbacks

## Test Counts

| Package              | Tests   |
| -------------------- | ------- |
| @commonpub/explainer  | 127     |
| @commonpub/ui         | 116     |
| @commonpub/editor     | 69      |
| @commonpub/schema     | 43      |
| @commonpub/auth       | 42      |
| @commonpub/protocol   | 42      |
| @commonpub/reference  | 35      |
| @commonpub/config     | 21      |
| @commonpub/test-utils | 14      |
| Others               | 3       |
| **Total**            | **512** |

### Post-Implementation Audit Fixes

- Added `'explainer'` to `likeTargetTypeEnum` and `commentTargetTypeEnum` in `packages/schema/src/enums.ts`
- Updated all type casts in `apps/reference/src/lib/server/social.ts` to include `'explainer'`
- Added LikeButton, BookmarkButton, CommentSection to explainer viewer page
- Added `/explainers` link to Nav.svelte
- Added redirect from main create page to `/explainers/create` when type is `'explainer'`

## Open Questions

- Interactive section controls need GSAP integration (Phase 5b)
- Image upload not yet available for section content
- InteractiveEditor.svelte deferred (interactive sections need GSAP first)

## Next Steps (Phase 5b)

- GSAP + ScrollTrigger integration
- Interactive sections with animations
- Scroll-driven transitions
- Animation authoring UI (VisualConfig editor)
