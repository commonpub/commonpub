# Session 161 handoff — Phase 3b drag-drop (or schema-package refactor)

Paste the prompt block below as the first message of the new session.

---

Fresh Claude Code session on the CommonPub monorepo. Predecessor: **session 160 SHIPPED Phase 3a + 3 audit rounds**. Editor is live at `https://commonpub.io/admin/layouts` (sidebar nav added in R3). 262 layer tests + 26/26 typecheck. heatsync + deveco UNTOUCHED on npm 0.24.0 (per standing user direction).

## Mandatory reads before any code

1. `CLAUDE.md` at the repo root — standing rules (#2 flag-gate, #3 `var(--*)`-only, #11 TDD, #12 WCAG AA, #15 NO AI attribution)
2. `MEMORY.md` and these priority memories:
   - **[[feedback-visual-editor-ux-patterns]]** — R1 UX patterns synthesis (cursor as contract, save-trust signals, Strapi 3-state, drag a11y, 10 anti-patterns)
   - **[[feedback-editor-security-patterns]]** — R2 security patterns (draft-leak guard, per-section enforcement at API boundary, URL scheme refinement, single-flight save, array bounds, structured audit logs)
   - **[[feedback-reuse-existing-components]]** — Layout engine is an ARRANGER for existing components; never write parallel renderers
   - **[[feedback-phase-3-hybrid-libraries]]** — grid-layout-plus@1.1.1 + @vue-dnd-kit/core@2.4.6 already installed; FormKit deferred to 3e
   - **[[feedback-vue-tsc-strict-vs-vitest]]** — vitest is loose; vue-tsc is strict. Pre-push hook runs typecheck.
   - **[[feedback-deploy-health-check-warn-not-fail]]** — NEVER trust `gh run list` for deploys; always curl `/api/health`
   - **[[feedback-no-coauthor]]** — no AI attribution in any commit, ever
   - **[[project-session-160-phase-3a]]** — main session log
3. `docs/sessions/160-phase-3a-editor-shell.md` — main 3a log
4. `docs/sessions/160-audit-godmode.md` — R1 (UX polish, 6 priority fixes)
5. `docs/sessions/160-audit-round2-deep.md` — R2 (security/correctness, P0 + 4 P1 + 2 P2 fixes; per-section validation DEFERRED with proper-fix path documented)
6. `docs/plans/phase-3-editor.md` — Phase 3a checklist all ✅; 3b-3f remain
7. `docs/plans/layout-and-pages.md` §7.6-7.10 — drag-drop state machine + a11y + auto-form design source of truth

## Verify current state (read-only)

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected, login redirect)\n' https://commonpub.io/admin/layouts
grep -E 'grid-layout-plus|@vue-dnd-kit' layers/base/package.json
pnpm --filter @commonpub/layer test 2>&1 | grep -E "Tests" | tail -1
pnpm typecheck 2>&1 | tail -3
```

Expected: health=200 × 3, DOM markers stable (3 rows + 5 sections, no `--editable` leak), /admin/layouts=302, libs in package.json, ~262 layer tests, 26/26 typecheck. If anything diverges: STOP and investigate.

## Pick your path

Ask the user up-front: **"Phase 3b drag-drop (the big feature, 2 sessions) or schema-package refactor (1 session, closes R2's deferred P1)?"**

### Path A — Phase 3b drag-drop (2 sessions)

**Session A/1 — palette → canvas drag + within-row reorder**:
- 3b.1: Wire `grid-layout-plus@1.1.1` into LayoutSlot's editable mode — each section becomes a draggable+resizable grid item
- 3b.2: Section palette uses `@vue-dnd-kit/core@2.4.6` `useDraggable` — drag a palette tile; `useDroppable` on each row/zone accepts the drop + creates a section via auto-save
- 3b.3: Drop indicator (between-row line, between-section gap) using dnd-kit's collision detection
- 3b.4: Save-on-drop via existing auto-save scaffolding (3a.6) — single-flight guard handles concurrent drops
- 3b.5: Tests
- Selection model lands for FREE with click handlers — Inspector dispatcher (3a.3) can finally swap between page-meta / row / section forms

**Session A/2 — cross-zone + reorder polish + undo/redo**:
- 3b.6: Cross-zone drag (full-width → sidebar)
- 3b.7: FLIP animations via `<TransitionGroup>`
- 3b.8: Undo/redo stack — Pinia store with command pattern + Cmd+Z/Cmd+Shift+Z
- 3b.9: Tests + visual regression on a known starting layout

**Hard a11y requirements** (per [[feedback-visual-editor-ux-patterns]]):
- `@vue-dnd-kit/core` keyboard sensor (Space pick up, arrows move, Space drop, Esc cancel)
- `aria-live="assertive" aria-atomic="true"` for drag state narration
- **Position-based wording**, NOT index: "Hero moved to position 3 of 5"
- Move Up / Move Down keyboard buttons on every section as the non-drag path (WCAG 2.1.1 Level A)
- Test against NVDA + Firefox specifically (most ARIA-strict)
- NEVER `aria-grabbed` / `aria-dropeffect` (deprecated)
- NEVER `role="application"` to absorb keyboard events

### Path B — schema-package refactor (1 session, closes R2 deferred P1)

The validator (`layers/base/server/utils/validateSectionConfigs.ts`) is implemented + tested but DORMANT — wiring it into POST/PUT handlers caused a Nitro build break in R2 (transitive .vue import). Proper fix:

1. Create `packages/schema/src/sectionConfigs.ts` — export all 17 section Zod schemas (currently inline in `layers/base/sections/builtin/*.ts`)
2. Update each `builtin/*.ts` to import its schema from there (instead of inline `const configSchema = z.object({...})`)
3. Update `validateSectionConfigs.ts` to build a schema-map from `@commonpub/schema` (no registry import → no transitive .vue deps)
4. Re-wire the validator into POST + PUT handlers
5. Confirm Nitro build succeeds locally (`pnpm --filter @commonpub/reference build`) before pushing
6. The 5 dormant tests + the round-2 wiring should work end-to-end

**Win**: closes R2's only deferred P1. Restores per-section URL guards / size caps / sandbox enforcement at the API boundary. Limited blast radius pre-fix (admin auth gates all writes + audit logs catch destructive paths), but every CMS validates admin tier as semi-trusted.

## Hard rules

- No AI attribution in any commit / PR / git artifact
- `pnpm publish:layer` for layer publishes — never `npm publish`
- Caret semver on 0.x.y excludes minor bumps — hand-edit consumer package.json
- Pre-push hook runs typecheck; bypass only with `SKIP_SIMPLE_GIT_HOOKS=1` when intentional
- NEVER trust `gh run list` for deploys — always curl `/api/health` after
- Don't duplicate existing components — see [[feedback-reuse-existing-components]]
- Test-driven — tests alongside or before code
- `var(--*)` only for any new styles
- WCAG 2.1 AA on every interactive element
- Editor admin-only — gate `/admin/layouts/*` on `requireFeature('admin')` + `requireFeature('layoutEngine')`
- commonpub.io ONLY as test bed — heatsync + deveco stay on npm 0.24.0 dormant unless user explicitly directs

## End state (session 160 close)

- commonpub.io: workspace `main` (3 audit rounds applied). Editor live at `/admin/layouts` + `/[id]`. Public homepage byte-pattern unchanged. heatsync + deveco UNTOUCHED.
- Tests: layer 262, schema 431, repo typecheck 26/26 fresh
- Memories: 2 new feedback memories captured for future editor work
- Deferred queue (in audit docs): per-section validation (P1 — proper-fix path documented), LayoutPayload type narrow, Inspector storm + dirty cost at scale, pagehide + sendBeacon, conflict cascade throttle, 30s interval pause, useLayoutEditor provide/inject, operator runbook, dashboard tile

## First action

Confirm you've read the priority docs (one paragraph max), then ask the user **"Phase 3b drag-drop or schema-package refactor?"**. Don't start until they pick.

If 3b: spawn an Explore agent for current best-practice patterns on grid-layout-plus + @vue-dnd-kit/core integration before coding. The libraries are mature but the integration patterns matter.

If schema refactor: start with `divider.ts` (the simplest section), port its schema to `packages/schema/`, verify the Nitro build succeeds, then batch the other 16.

Don't accumulate debt. Finish what's started before adding scope.
