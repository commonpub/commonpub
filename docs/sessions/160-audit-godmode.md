# Session 160 — God-mode audit + UX polish

**Date**: 2026-05-28 (continuation of session 160)
**Trigger**: post-shipping deep audit of the Phase 3a editor — code cruft + architectural review + UX research + applied polish.

## Process

Two parallel agents:
1. **UX research agent** — web-research synthesizing modern best-practice patterns from Linear, Notion, Figma, Webflow, Framer, Strapi, Sanity, Carbon, Cloudscape, GitLab Pajamas, GitHub Primer, dnd-kit, React Aria, XWiki, blökkli. Cross-referenced WCAG 2.1 AA + 2.2 spec.
2. **Cruft scan agent** — read-only sweep of every new file from session 160 for unused imports, orphan exports, dead branches, debug code, naming consistency, type-escape patterns, hardcoded colors, leftover Stage-E section names.

Synthesized findings + applied priority-1 fixes in this PR.

## Cruft scan — result: CLEAN

The Explore agent reported the new code is production-ready. Specifically:

| Category | Status | Notes |
|---|---|---|
| Unused imports | ✓ | None across 14 new files |
| Orphan exports | ✓ | Every export referenced |
| Duplicated logic | ✓ minor | State pill CSS duplicated between list + toolbar — intentional namespace isolation |
| Dead branches | ✓ | All v-if/v-else reachable |
| Error handling | ✓ | Every catch block intentional + complete |
| Comment accuracy | ✓ | All phase references match shipped code |
| Console.log / debugger / TODO / FIXME | ✓ | None |
| Old (pre-Stage-E) Section names | ✓ | None; sections/ dir contains only SectionCta + SectionLearning |
| Component auto-import registration | ✓ | All 6 components correctly registered |
| CSS class naming | ✓ | Consistent `cpub-admin-layouts-*` + `cpub-inspector-page-*` |
| `as any` / `as never` / `@ts-ignore` | ✓ | None |
| Hardcoded colors | ✓ | Only `rgba(0,0,0,0.5)` modal backdrop (standard) |
| Inline styles | ✓ | Only dynamic viewport max-width (legitimate) |
| Sections/ dir sweep | ✓ | Clean per Stage E |
| Doc timestamps | ✓ | Current as of session 160 |

**Intentional gap**: components + pages don't have unit tests (composables do). Component/page testing is a v1 deferral — the integration surface is the canary on commonpub.io. Worth queuing for Phase 3b polish.

## UX research findings — 10 dimensions

Full agent output preserved in this doc. Recommendations applied in this PR are tagged ✅; deferred ones are tagged ⏳ (waiting for Phase 3b drag-drop) or 📦 (later polish session).

### 1. Drag-drop palette affordances BEFORE drag is enabled ✅ FIXED

**Problem**: I shipped `cursor: grab` on tiles whose pointerdown was a no-op. Per Smashing 2021 + UX research, this is the #1 "UI lies" pattern.

**Reference**: Notion shows the drag handle only on hover. Cloudscape reserves `grab/grabbing` exclusively for wired drag handlers. Smart Interface Design Patterns: 76% of experts recommend visibly disabled over hidden or active-with-error.

**Fix applied**:
- `cursor: grab` → `cursor: default` on palette tiles
- Hover color changed `--accent` → `--border` (so tiles don't HOVER like interactive controls)
- Palette header copy: "Drag-and-drop arrives in the next release" → "Sections available · Catalog of section types your layouts can use. Drag-to-insert ships next release."
- Anti-pattern avoided: did NOT use `cursor: not-allowed` (reads as "forbidden", not "coming soon"); did NOT grey-out (reads as "broken")

### 2. Auto-save UX patterns ✅ PARTIAL FIX

**Reference patterns**:
- GitLab Pajamas: 250–500ms debounce + save-on-blur + 3s timeout
- VS Code: persistent dot + count badge; "Auto Save: onFocusChange" exposes timer-vs-blur as user preference
- Decap CMS: "Unsaved changes" / "Changes saved" indicator
- Notion / Google Docs: aggressive debounce + blur + tab-hide

**Recommendation**: 800ms debounce + save-on-blur + visibilitychange flush + relative timestamp in the indicator.

**Fix applied**:
- Relative timestamp added: "Saved · 2m ago" with 30s tick (matches GitLab pattern of relative-time trust signal)
- `visibilitychange` flush added to `useLayoutAutoSave` — cancels debounce + fires immediate save when tab hides while dirty
- 3 new tests covering visibility-change branches

**Deferred**: 
- 📦 Debounce window from 1500ms → 800ms (matches research; current 1500 is fine for v1 — defer unless real complaint)
- 📦 Save-on-blur for individual form inputs (would require per-input wiring; current `visibilitychange` covers the high-risk path of Cmd+Tab/Cmd+W)

### 3. Optimistic concurrency conflict UX (409) ✅ FIXED

**Problem**: I shipped a two-option modal: "Refresh — lose my changes" + "Force save — overwrite server". UX research called out two issues:
- "Force save" is bureaucratic language that doesn't name the consequence
- Two-button modal with safe + destructive at button-peer level is a misclick risk

**Reference patterns**:
- XWiki: compact diff + per-change accept/reject
- HTTP/ETag standard: 409 should include current server doc
- GitHub PR conflicts: theirs / yours / merged views, per-hunk selection

**Fix applied** — adopted the three-option pattern:
1. **"Reload their version"** (primary, default-focused, blue) — the safe choice
2. **"Keep editing here"** (neutral, middle) — closes modal so user can copy text out before deciding
3. **"Overwrite their changes"** (destructive, red, rightmost) — renamed from "Force save"

Additional improvements:
- Modal heading: "Conflict" → "Version conflict" (specific)
- Body copy rewritten to name what each action does
- Initial focus on the primary "Reload" button (WCAG dialog pattern)
- Escape key dismisses (matches dialog ARIA pattern)
- `role="alertdialog"` already present; added focus management

**Deferred**:
- 📦 Block-level diff ("3 sections added, 1 removed, hero edited") — requires diffing infrastructure; queued for Phase 7 versioning UI
- 📦 Type-to-confirm for the destructive Overwrite button — overkill for v1; reconsider when conflict frequency is non-zero

### 4. Empty state for /admin/layouts ✅ FIXED

**Reference patterns**: Carbon (centered icon + headline + 1-line + 1 CTA); Mobbin SaaS synthesis (the convertibility pattern is 1 headline + 1 sentence + 1 button); Linear/Notion admin lists (text-heavy, no illustrations).

**Fix applied**:
- Old: "No layouts yet" + link to `/admin/homepage`
- New: Headline + descriptive line + explicit primary CTA "Migrate homepage layout"
- Centered, max-width 560px, vertical block at ~40% viewport height
- Skipped illustration (the sharp + mono aesthetic reads intentional with text + icon)
- Primary action is visually weighted: filled accent button, mono uppercase letter-spaced

### 5. Inspector pane dispatch pattern ⏳ DEFERRED to Phase 3b

The accordion-within-context-swap pattern recommended by Figma/Webflow/Framer requires a selection model (which row/section is selected) — that selection model lands in 3b. Current implementation is correct for 3a's "page-meta only" scope.

**Future work in 3b/3f**:
- Breadcrumb at inspector top: `Page › Row 2 › Hero Section` with click-to-select-ancestor
- Collapsible accordion groups within each context with localStorage-persisted open/closed state
- Default-open most-edited group per section type

### 6. Viewport segmented control ✅ ALREADY ALIGNED

My implementation already matches the Webflow/Framer convention:
- Centered between left controls + right controls — ✓
- Icon-only with width tooltip — ✓ (via aria-label)
- Snap widths 375/768/1280 — ✓ (matches Chrome DevTools defaults)
- 2px accent border for active state — ✓ (matches design system)

No changes needed.

### 7. Touch target sizing ✅ FIXED

**Reference**: WCAG 2.5.8 (AA, WCAG 2.2) is 24×24px minimum; 44×44 is iOS HIG / WCAG AAA. Webflow + Framer (desktop-only editors) ship 28–32px. GitHub Primer SegmentedControl: 28px small, 32px medium.

**Fix applied**:
- Viewport toggle buttons: bumped to `min-width: 28px; min-height: 28px`
- Other interactive elements already at 28+ px

**Deferred**:
- 📦 Palette tile interaction targets when drag lands in 3b — bump to 40×40 minimum per research

### 8. WCAG 2.1 AA for drag-drop editors ⏳ DEFERRED to Phase 3b

The drag-drop a11y story (keyboard sensor, ARIA live narration, position-based wording, non-drag alternative via Move Up/Move Down buttons) is for 3b. Captured detailed recommendations in the agent output for execution then.

**Concrete patterns documented for 3b**:
- Use `@vue-dnd-kit/core`'s keyboard sensor (Space pick up, arrows move, Space drop, Esc cancel)
- Live region with `aria-live="assertive"` + `aria-atomic="true"`
- Position-based wording: `"Hero section moved to position 3 of 5"` (not index-based)
- Move Up / Move Down keyboard alternative on every section (WCAG 2.1.1 Level A requires non-drag path)
- Test specifically against NVDA + Firefox (the most ARIA-strict pair)
- Do NOT use `aria-grabbed` / `aria-dropeffect` (deprecated, no screen reader implements them)
- Do NOT use `role="application"` to absorb keyboard events

### 9. Save-on-blur vs debounce timer ✅ PARTIAL FIX

Addressed via the visibility-change flush (covers Cmd+Tab, Cmd+W, tab close intent). Save-on-blur for individual form inputs deferred — the high-risk data-loss path (tab close) is now closed.

### 10. Publish vs Save mental model ✅ FIXED

**Reference**: Strapi v5 has the cleanest 3-state model — Draft / Modified / Published. "Modified" is the critical state — "previously published, has pending draft edits."

**Fix applied**:
- New `effectiveState` computed: `published + dirty` → `'modified'`
- New state pill color: yellow (`var(--yellow)`) for `modified`
- Publish button copy adapts:
  - `draft` → "Publish"
  - `modified` → "Publish changes"
  - `published` (clean) → "Republish" + disabled
- Publish disabled when already published + clean (no-op)

This is the single biggest mental-model improvement in the audit. Users now see at-a-glance whether their changes are live.

## Files changed (audit polish)

| File | Lines changed | What |
|---|---|---|
| `AdminLayoutsPalette.vue` | ~5 | cursor fix + hover color + header copy |
| `AdminLayoutsConflictModal.vue` | ~50 | three-option pattern + focus mgmt + Esc key |
| `AdminLayoutsToolbar.vue` | ~70 | Modified state + dynamic publish copy + touch targets + lastSavedAt timestamp |
| `pages/admin/layouts/[id].vue` | ~2 | wire lastSavedAt through |
| `pages/admin/layouts/index.vue` | ~30 | empty state redesign |
| `useLayoutAutoSave.ts` | ~40 | visibilitychange flush |
| `useLayoutAutoSave.test.ts` | ~45 | 3 new visibility-flush tests |

**Test count**: 210 → 213 (+3 visibility-flush). Typecheck 26/26 (fresh).

## Anti-patterns I deliberately did NOT adopt

1. **Illustration in empty state** — the sharp+mono aesthetic looks intentional with text only. A friendly illustration would feel off-brand.
2. **"Force save" terminology** — replaced with "Overwrite their changes" (names what happens).
3. **Two-option conflict modal at button-peer level** — split into three with destructive at rightmost, safe at default-focused.
4. **`cursor: not-allowed` on inert palette tiles** — reads as "forbidden", not "coming soon". Used `cursor: default` instead.
5. **`cursor: grab` without a drag handler** — removed; was the most common "UI lies" pattern per research.
6. **Grow toolbar icons to 44×44** — would harm density and is not required by WCAG AA (only AAA). 28×28 satisfies AA with comfort buffer.
7. **One button labeled "Save" that conditionally publishes** — kept Save and Publish as separate verbs.
8. **Auto-publish on save for already-published docs** — explicitly avoided; per Strapi GitHub issue #24547 this caused real user complaints.

## Open queue for Phase 3b

From the UX research, items I want to revisit when drag lands:

- **Selection model** — click section → highlight + dispatch inspector. Required before keyboard a11y is meaningful.
- **Drag a11y** — `@vue-dnd-kit/core`'s keyboard sensor + position-based ARIA narration + Move Up/Down keyboard alternatives.
- **Inspector accordions** — collapsible groups within each context, localStorage-persisted state.
- **Inspector breadcrumb** — `Page › Row 2 › Hero Section` with click-to-select.
- **Palette tile drag handle** — 6-dot grip visible on hover only.
- **Block-level diff** in conflict modal (needs diffing infrastructure).
- **Component + page unit tests** — current intentional v1 gap.

## Linked artifacts

- `docs/sessions/160-phase-3a-editor-shell.md` — the main session log
- `docs/plans/phase-3-editor.md` — Phase 3a checklist (all ✅)
- `docs/plans/layout-engine-rollout.md` — Stage D complete
- Both agents' full output preserved in this conversation's transcript

## Sources cited by the UX research agent

- [Smashing — Disabled Buttons UX](https://www.smashingmagazine.com/2021/08/frustrating-design-patterns-disabled-buttons/)
- [GitLab Pajamas — Saving and Feedback](https://design.gitlab.com/patterns/saving-and-feedback/)
- [dnd-kit Accessibility Guide](https://dndkit.com/legacy/guides/accessibility/)
- [React Aria — Accessible Drag and Drop](https://react-aria.adobe.com/blog/drag-and-drop)
- [Cloudscape — Drag and Drop](https://cloudscape.design/patterns/general/drag-and-drop/)
- [Carbon Design — Empty States](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Strapi 5 — Draft & Publish](https://docs.strapi.io/cms/features/draft-and-publish)
- [Sanity — Drafts & Publishing](https://www.sanity.io/glossary/drafts--publishing-workflow)
- [Webflow — Breakpoints overview](https://help.webflow.com/hc/en-us/articles/33961300305811-Breakpoints-overview)
- [Figma — Right sidebar](https://help.figma.com/hc/en-us/articles/360039832014)
- [WCAG 2.5.8 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [GitHub Primer — SegmentedControl](https://primer.style/components/segmented-control/)
- [XWiki — Merge Conflict UI](https://design.xwiki.org/xwiki/bin/view/Design/MergeConflictResolutionUI)
