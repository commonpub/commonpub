# Kickoff prompt — P3 trivia bundle

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Smallest of the remaining sessions (~30-60 minutes).** Clears the layout-editor P3 queue. Doesn't depend on any other path.

---

Fresh Claude Code session on the CommonPub monorepo. **Task: clear the 4 P3 trivia items from the layout-editor deferred queue.**

**Predecessor**: session 162 closed every P2 from session 160's audit + ran TWO recursive audits + completed Path C (stale-docs sweep). **19 commits on `main`.** Layer 318 + schema 470 + server 1129+3skip + repo typecheck 26/26. heatsync + deveco UNTOUCHED on npm 0.24.0. Last commit `7b8f7c2`.

## Why this session

After two rounds of P1/P2 closure, the deferred queue has 4 P3 items left. None are blocking; each is small. Bundled together they make a clean session that empties the queue entirely + creates a publishable layer release (potentially the first since 0.24.0 in session 159, depending on user direction).

## The 4 items

| # | Item | Effort | Risk |
|---|---|---|---|
| T.1 | 30s setInterval pauses on tab hidden | ~30 LOC | Low |
| T.2 | `useLayoutEditor` provide/inject | ~50 LOC + light refactor | Low |
| T.3 | Drop `idx_layouts_scope` (redundant with UNIQUE) | 1 migration | Medium (DB schema change) |
| T.4 | Operator-facing runbook for `layoutEngine` setup | ~150 lines markdown | Low |

Order: T.1 → T.4 → T.2 → T.3 (smallest + lowest-risk first; T.3 last because it touches the DB).

## Mandatory reads

1. **`CLAUDE.md`** — rules #2 (flag), #11 (test-driven), #13 (session logging), #15 (NO AI co-author)

2. **MEMORY.md priority memories**:
   - `feedback-no-coauthor` — re-pinned
   - `feedback-editor-db-perf-patterns` — index audit (T.3 lives here)
   - `feedback-vitest-import-meta-client-undefined` — composable browser guards (T.1)
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — mock preservation (any new tests)
   - `feedback-pnpm-publish-layer` — if user wants to publish: `pnpm publish:layer` NEVER `npm publish`
   - `feedback-caret-semver-0x-minor-bump` — if publishing a minor bump, hand-edit consumer package.json
   - `feedback-deploy-health-check-warn-not-fail` — curl /api/health after deploy

3. **Session 162 logs**: `docs/sessions/162-p2-sweep.md` + audit docs — for context on what conversations led to these P3s being deferred. The `feedback-editor-db-perf-patterns` memory + the session 160 R4 audit doc identify the original rationale for each item.

## Sub-task details

### T.1 — 30s setInterval pause on tab hidden

**Where**: `layers/base/composables/useLayoutAutoSave.ts` already watches `document.visibilitychange` for flush-on-hide. The 30s setInterval being referenced is likely one of:
1. The audit-log heartbeat (`cpub.audit.layout.heartbeat` or similar) — verify by grepping
2. A polling refresh somewhere (unlikely; the editor uses event-driven updates)
3. A federation health-check ping

**Verify FIRST**:
```bash
grep -rE "setInterval.*30_000|setInterval.*30000" layers/base packages/server --include="*.ts" | grep -v node_modules | grep -v dist | head -10
```

If you find one, wrap its install with:
```ts
function start(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  // ... existing setInterval ...
}
function stop(): void { clearInterval(handle); handle = null; }
document.addEventListener('visibilitychange', () => {
  document.visibilityState === 'hidden' ? stop() : start();
});
```

If you find NONE — flag the audit's claim as stale; document in the session log + skip.

Tests: visibility-change → interval cleared; restore on visible → interval re-armed.

### T.2 — `useLayoutEditor` provide/inject

**Why**: Right now `useLayoutEditor(id)` is called only by the page (`/admin/layouts/[id].vue`). All the child components (canvas, palette, inspector, toolbar, conflict modal) receive the editor's state via PROPS. As section inspectors land (Phase 3f), the prop chain gets deeper — child-of-child needs to call `editor.save()` etc. Provide/inject removes the prop-drilling.

**Pattern**:
```ts
// In useLayoutEditor (or a thin wrapper composable):
const EditorKey: InjectionKey<LayoutEditorState> = Symbol('cpub.layoutEditor')
export function provideLayoutEditor(state: LayoutEditorState): void { provide(EditorKey, state) }
export function useInjectedLayoutEditor(): LayoutEditorState {
  const state = inject(EditorKey)
  if (!state) throw new Error('useInjectedLayoutEditor must be called inside a provideLayoutEditor scope')
  return state
}
```

**Migration**:
- Page calls `provideLayoutEditor(editor)` after `useLayoutEditor(id)`
- Direct children KEEP prop-based access (backwards-compatible)
- New deep children call `useInjectedLayoutEditor()` instead of prop-drilling
- DO NOT delete the prop interfaces of existing components in this session — let Phase 3f migrate incrementally

Tests: provide/inject roundtrip; missing-provider throws; mount in a test harness that calls provideLayoutEditor.

### T.3 — Drop `idx_layouts_scope`

**Why**: The `layouts` table has both `idx_layouts_scope` (a btree on `(scope_type, scope_key)`) AND a UNIQUE constraint on the same columns. The UNIQUE constraint already creates an underlying index that Postgres uses for the same lookups. The btree is redundant.

**Migration**: Create `packages/schema/migrations/0006_drop_redundant_layouts_index.sql`:
```sql
DROP INDEX IF EXISTS idx_layouts_scope;
```

**Verify the UNIQUE is in place**:
```bash
grep -A 3 "uniqueIndex" packages/schema/src/layout.ts | head -10
```

**Migration count**: 5 → 6 (file shipped, runner not invoked locally — applies on deploy).

**Tests**: Drizzle migration test should pass; verify no query regression by checking the integration tests touch the relevant indexed columns (`scope_type`, `scope_key`) and pass post-migration.

**Caution**: This is a DB change. heatsync + deveco have `layouts` table from migration 0005 (session 158). They'll need the migration too — but since they're dormant on 0.24.0 + layoutEngine OFF, the table is empty there. Still: the migration is forward-only safe (DROP INDEX won't break anything if the index doesn't exist due to `IF EXISTS`).

### T.4 — Operator runbook for `layoutEngine` setup

**Where**: New file `docs/guides/operator-layout-engine.md` (matches existing `docs/reference/guides/layout-engine.md` style but operator-facing — non-technical).

**Audience**: Instance operators (sysadmin / non-developer) running a CommonPub instance. They need to know:
1. What the layout engine does + why they'd enable it
2. How to flip the feature flag (env var, declared key, etc.)
3. How to migrate their existing homepage (the `/admin/layouts/migrate-homepage` button)
4. How to back out if it doesn't work (set flag OFF; falls back to legacy renderer)
5. Database requirement (migration 0005 must be applied)
6. Required permissions (admin role)

**Style**: Mirror `docs/guides/` other files. Keep it to one page (~150 lines). Include a 5-step "happy path" + a troubleshooting section.

## Hard rules

- **No AI attribution** (CLAUDE.md #15)
- **Atomic commits per item** — 4 items, 4 commits
- **0 npm publishes** unless user explicitly directs
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0 unless user explicitly directs
- **var(--*) only** for any CSS (unlikely in this session — mostly TS + SQL + markdown)
- **Pre-push hook runs typecheck** — vue-tsc strict
- **NEVER trust `gh run list`** — curl /api/health after deploy
- **Test-driven** — T.1 + T.2 + T.3 each get tests; T.4 is docs only
- **Verify load-bearing claims** against source (session 162 docs-audit lesson) — when documenting, recompute against the actual code, not against the audit's wording

## Self-audit after coding

Lighter scope than P2 sessions but still worth a pass:
- **R1 (UX)**: T.4 runbook readability — read it as if you're a non-technical operator; does it make sense?
- **R2 (correctness)**: T.1 — does the interval actually pause? Verify with a test that mocks visibilityState. T.2 — does the inject throw the right error message? T.3 — does the migration test catch the dropped index?
- **R3 (operational)**: T.4 — does the runbook account for "I rolled forward then need to roll back"?
- **R4 (DB)**: T.3 — does the migration's idempotency (`IF EXISTS`) actually work on a fresh PGlite test DB that never had the index?

## Optional close-out: npm publish

If T.3 is clean + user wants to publish, this is the moment to ship layer 0.24.0 → 0.25.0 (minor bump because of the new banner CTA + the version-counter dirty semantics):

```bash
pnpm publish:layer        # NEVER `npm publish` per feedback-pnpm-publish-layer
# Then hand-edit consumer package.json (heatsync, deveco, etc) per
# feedback-caret-semver-0x-minor-bump — ^0.24.0 will NOT auto-pick 0.25.0
```

Default: DON'T publish unless user asks. workspace `main` on commonpub.io is sufficient.

## First action

1. Confirm priority docs read (one paragraph max).
2. T.1 first — start with the `grep setInterval` to verify the claim before writing code.
3. Atomic commits per item.
4. Update `docs/sessions/N-p3-trivia.md` with what shipped + any "audit-claim-was-stale" findings.
5. Write the next handoff prompt if anything remains.

Don't accumulate debt. Empty the queue, then close the session.

---
