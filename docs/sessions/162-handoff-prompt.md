# Session 162 — handoff (navigation)

Session 162 closed every P1/P2 from session 160's audit rounds + completed Path C (stale-docs sweep) with three recursive audit-of-docs polish passes. **19 commits on `main`.** Layout-editor deferred queue is empty of P1/P2s. heatsync + deveco UNTOUCHED on dormant `0.24.0`.

**End state**: layer **318** tests + schema 470 + server **1129**+3skip + repo typecheck 26/26 FULL TURBO. Last commit `7b8f7c2`. Public homepage byte-pattern unchanged (3 layout-rows + 5 layout-sections, no `--editable` leak).

## Pick a path for the next session

Each kickoff below is a self-contained prompt — paste the contents of the file (everything between the `---` rules inside it) as the FIRST message of a fresh Claude Code session. No prior context needed.

| Path | Effort | Kickoff file | Summary |
|---|---|---|---|
| **Phase 3b/A** | 1 session | [`162-kickoff-3b-A.md`](162-kickoff-3b-A.md) | Wire `grid-layout-plus` + `@vue-dnd-kit/core` for palette drag + within-row reorder. Starts the 2-session drag-drop arc. Requires an Explore-agent research step before coding. |
| **Phase 3b/B** | 1 session | [`162-kickoff-3b-B.md`](162-kickoff-3b-B.md) | Cross-zone drag + FLIP animations + Pinia undo/redo with Cmd+Z. **Requires 3b/A shipped first** — verifies before starting. |
| **Figma viewport zoom** | 1 session | [`162-kickoff-figma-zoom.md`](162-kickoff-figma-zoom.md) | Self-contained zoom controls (Cmd+= / Cmd+- / Cmd+0 / Shift+1). Complements session 161's chrome collapse — for users who want FULL chrome AND a zoomed canvas. New `useEditorViewport` composable matching `useEditorChrome` pattern. |
| **P3 trivia bundle** | 0.5-1 session | [`162-kickoff-p3-trivia.md`](162-kickoff-p3-trivia.md) | Clears the 4 remaining P3 items: setInterval-pause-on-tab-hidden, `useLayoutEditor` provide/inject, drop redundant `idx_layouts_scope` index (migration 0006), operator-facing layout-engine runbook. Smallest scope; empties the queue entirely. |

## Recommended ordering

Start with the path that matches the user's energy:

- **If the user wants to ship the big architectural arc**: 3b/A → (next) 3b/B → Phase 3c (resize) → Phase 3d (a11y polish) → Phase 3e (auto-form) → Phase 3f (per-section inspectors). The first two have dedicated kickoff prompts; the rest get written at the end of their predecessor session.

- **If the user wants quick wins**: P3 trivia (clears the queue cleanly) → Figma viewport zoom (self-contained UX feature) → then start 3b.

- **If the user wants to commit to drag-drop NOW**: 3b/A first. The other paths can wait. The audit cycles from session 162 establish a working pattern — expect 3-5 audit findings per session that need a polish commit before close.

## Future-session kickoffs that should be written WHEN those sessions complete

Not written yet because their scope depends on what their predecessors land:

- **Phase 3c** (resize) — kickoff written at the end of Phase 3b/B's session
- **Phase 3d** (keyboard polish + axe-core scan) — kickoff written at the end of Phase 3c
- **Phase 3e** (auto-form generation from Zod section configSchemas) — kickoff written at the end of Phase 3d
- **Phase 3f** (per-section inspectors) — kickoff written at the end of Phase 3e, OR can interleave with 3e

## Hard rules (load-bearing across every session)

These are repeated in each individual kickoff file too. They survive context switches.

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15) — **most-violated default**
- **`pnpm publish:layer`** for layer publishes — never `npm publish` (per `feedback-pnpm-publish-layer`)
- **Caret semver on 0.x.y excludes minor bumps** — hand-edit consumer package.json (per `feedback-caret-semver-0x-minor-bump`)
- **Pre-push hook runs typecheck**; bypass only with `SKIP_SIMPLE_GIT_HOOKS=1` if intentional. vue-tsc strict catches what vitest's esbuild doesn't.
- **NEVER trust `gh run list`** for deploys — ALWAYS curl `/api/health` after (per `feedback-deploy-health-check-warn-not-fail`)
- **Don't write parallel renderers** — layout engine is an ARRANGER; reuse existing components via `propMap` (per `feedback-reuse-existing-components`)
- **Test-driven** — co-located tests for every behavioral change (CLAUDE.md #11)
- **`var(--*)` only** for any new styles — no hardcoded colors/fonts (CLAUDE.md #3)
- **WCAG 2.1 AA** on every interactive element (28×28 touch target preferred; 24×24 is the bare floor, not the design target — per `feedback-visual-editor-ux-patterns`)
- **Editor admin-only** — `/admin/layouts/*` gated on `requireFeature('admin')` + `requireFeature('layoutEngine')` (locked by contract test)
- **commonpub.io ONLY** as test bed — heatsync + deveco stay on npm 0.24.0 dormant unless user explicitly directs otherwise
- **Layouts are local-only** — don't add to `@commonpub/protocol` without an ADR superseding 027
- **Cursor as contract** — `cursor: grab` only when the drag is wired (per `feedback-visual-editor-ux-patterns`; session 160 R1 caught it as the #1 "UI lies" anti-pattern)
- **Single-flight save** stays in place — any save-triggering surface routes through `useLayoutEditor.save()` (per `feedback-editor-security-patterns`)
- **useCookie over useState + localStorage** for persistent UI state — matches `useTheme` / `useAdminSidebar` / `useEditorChrome` pattern; no SSR/CSR flash (per `feedback-vitest-import-meta-client-undefined`)
- **Server-side Zod schemas come from `@commonpub/schema`** — if you need a Zod schema in a server handler, it MUST come from `@commonpub/schema` (never from `layers/base/sections/builtin/*` or any file that transitively imports `.vue`); session 161 refactor closes the boundary
- **Match established patterns verbatim** — when extending an audited surface (banner reusing modal handlers, new section using registry conventions, new composable extending another composable's cookie pattern), match the labels + button hierarchy + styling already in place. Approximation forks the user's cognitive model. Per `feedback-match-established-pattern` (NEW in session 162).
- **Verify load-bearing claims against source** — when documenting an env var, a script, a path, a count, or a behavior: re-grep the source and compute the value. Don't trust prior handoffs, memory, or expectation. Session 162's audit-of-docs round caught 8 wrong env-var names + 1 wrong composable home + count mismatches in docs I'd just written. Per `feedback-verify-loadbearing-values`.

## What session 162 actually shipped (so the next session knows the baseline)

The full session log is at [`162-p2-sweep.md`](162-p2-sweep.md). Quick summary:

- **7 P2 commits** (`cd29861`..`121f289`) closing every R2/R3/R4 P2 from the session 160 audit rounds: Dashboard tile, listLayouts N+1, pagehide-flushBeacon, LayoutPayload=Pick, conflict-cascade throttle, O(1) version-counter dirty, step-typed PublishStepError
- **Self-audit polish** (`16ccfd2`) — 5 bugs caught in the P2 work
- **Audit-of-audit** (`11b9190`) — 3 R1 violations of conventions session 160 R1 had established but the polish re-introduced (bureaucratic verbs, wrong button hierarchy, no danger styling)
- **Path C stale-docs sweep** (`812601b`) — apps/reference/README created; openapi.ts now documents 8 layout paths; config + learning + layer READMEs refreshed
- **Audit-of-docs** (`e4e3443`, `9a129f8`, `c16b026`) — 3 more polish rounds catching env-var names, composable attribution, block counts
- **New feedback memory**: `feedback-match-established-pattern` — when reusing existing handlers, MATCH the established pattern verbatim

### Recursion pattern that emerged

Each audit round paid off but with diminishing returns: P2 sweep (7 issues) → audit-1 (5) → audit-2 (3) → audit-of-docs round 1 (3) → round 2 (2) → round 3 (1). The shape repeats: writing what I expected rather than what existed. The fix every time: re-grep the source, recompute against the file system. Same root as `feedback-verify-loadbearing-values` (session 135 FA SRI miss). Worth re-pinning before any session that touches docs / configs / new APIs.
