# Kickoff — session 169

Paste everything between the `---` rules as the FIRST message of a fresh session. **Prerequisite: session 168 shipped** (last code commit `ce5d68c`, last docs `5771f53`).

**Heads-up on gating:** the highest-value remaining consolidation work needs a **real browser** (a commonpub.io build / deploy smoke) or a **thin app** (deveco/heatsync) to verify — jsdom can't see CSS cascade or pointer hit-testing. If this session can drive a browser, do Part A. If not, do Part C (Phase 3e feature work) — it's fully unit-testable and unblocked.

---

Fresh Claude Code session on the CommonPub monorepo. commonpub.io workspace-`main` ONLY; **heatsync + deveco UNTOUCHED** on dormant npm `0.24.0`; **no npm publish**; **no AI attribution** in commits.

## Verify session 168 shipped

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do echo "  $u = $(curl -s -o /dev/null -w '%{http_code}' $u/api/health)"; done
ls layers/base/components/PageFrame.vue                              # shared frame exists
grep -n "PageFrame" "layers/base/pages/[...customPath].vue" \
     layers/base/components/admin/layouts/AdminLayoutsCanvas.vue     # custom-page + editor canvas adopted
grep -n "page-frame-full" layers/base/components/PageFrame.vue       # full-bleed full-width (ce5d68c)
grep -n "auto-fill" layers/base/pages/explore.vue                    # explore card grids fixed
ls docs/adr/028-homepage-customization-model.md                      # Stage 3 decision recorded
pnpm --filter @commonpub/layer test 2>&1 | grep Tests | tail -1      # expect 669 passed
pnpm typecheck 2>&1 | tail -3                                        # 12/12
```
**Also eyeball commonpub.io on a browser if you can:** (a) `/explore` cards reasonable + grid fills width; (b) `/admin/layouts/[id]` editor canvas shows full-width-above + main|sidebar side-by-side (NOT stacked boxes), and drag/resize/select/add-row still work; (c) the homepage hero is still full-bleed. Anything off → that's this session's P0.

## State after 168

- **`<PageFrame>`** = the one canonical frame (full-bleed `#full-width`; capped+centered main/sidebar grid via `--cpub-frame-*` tokens = max 1280 / sidebar 300 / gap 32 / pad 28/32/48 / collapse 1024). Faithful replica of the live homepage.
- **Adopted by**: custom-page (`[...customPath].vue`) + the editor canvas (`AdminLayoutsCanvas.vue`, dynamic `#[zoneSlug]` slots, section DOM untouched).
- **NOT yet adopted by**: the live homepage `index.vue` (Part A).
- **Explore** card grids fixed (responsive auto-fill, matches `feed.vue`).
- **Shadowing fix**: reverted in 168 (dynamic `resolveComponent` doesn't work in Nuxt — Part B has the verified approach).
- **ADR 028** records the homepage-model decision (code-override for devs + layout engine for operators; legacy deprecated).

## Part A — migrate the live homepage `index.vue` to `<PageFrame>` (browser-gated)

The last frame duplicate. Now a code-dedup, NOT a WYSIWYG prerequisite (the editor already matches via PageFrame).

1. **Resolve the inter-row-spacing entanglement FIRST.** `.cpub-sidebar` has `display:flex; flex-direction:column; gap:18px` (sidebar row spacing); `.cpub-feed-col` (main) has only `min-width:0` (no gap). Pick: (a) add the flex-gap to `.cpub-page-frame-sidebar` (PageFrame matches, but bakes a homepage-specific asymmetry in), or (b) move inter-row spacing into `LayoutSlot`/`LayoutRow` so both zones space rows consistently (cleaner, bigger change). **(b) is the right long-term answer** but verify the main zone's current spacing first.
2. **CRITICAL ordering:** `.cpub-main-layout` is one scoped rule shared by ALL THREE `index.vue` branches (layout-engine / configurable / legacy). Migrate **all three together** to `<PageFrame>` (full-width in `#full-width`; main+sidebar in `#main`/`#sidebar`), keeping the bespoke chrome (`mobile-contest-hoist`, `.cpub-sidebar-desktop/-mobile`, powered-badge) INSIDE the relevant slots. THEN delete `.cpub-main-layout`/`.cpub-feed-col`/`.cpub-sidebar` grid CSS (keep the bespoke-chrome CSS). Migrating one branch orphans the shared scoped rule → live breakage.
3. **Real-browser smoke** at ≥1025 / 768–1024 / ≤640px before merge to `main`: all 3 branches render the grid; hero stays full-bleed; mobile-hoist/sidebar/badge behave; sidebar rows keep their spacing.

## Part B — component-shadowing fix (thin-app-gated; verified approach)

So a thin-app shadow of a section component is honored under the layout engine (ADR 028 makes this a committed direction). 168 proved `resolveComponent(variable)` does NOT work in Nuxt (build transform needs static literals — [[feedback-nuxt-resolvecomponent-static-only]]).

- Build a **literal-keyed resolver** (composable/plugin in setup/render context): one `resolveComponent('LiteralName')` per section component, then look up by the section's name. Literal `resolveComponent` IS shadow-aware. (Or confirm `<component :is="'Name'">` string resolution works in Nuxt.)
- **Verified auto-import names** (from `apps/shell/.nuxt/components.d.ts` — do NOT guess; pathPrefix dedupe is non-obvious):

| section | name | section | name |
|---|---|---|---|
| hero | HomepageHeroSection | heading | BlocksBlockHeadingView |
| contests | HomepageContestsSection | paragraph | BlocksBlockTextView |
| editorial | HomepageEditorialSection | image | BlocksBlockImageView |
| stats | HomepageStatsSection | divider | BlocksBlockDividerView |
| hubs | HomepageHubsSection | gallery | BlocksBlockGalleryView |
| custom-html | HomepageCustomHtmlSection | video | BlocksBlockVideoView |
| content-feed | HomepageContentGridSection | embed | BlocksBlockEmbedView |
| cta | SectionsSectionCta | markdown | BlocksBlockMarkdownView |
| learning | SectionsSectionLearning | | |

- In-repo you can only verify non-regression + that the resolver returns components (not strings). True shadow-override needs deveco/heatsync — flag as a thin-app follow-up.

## Part C — Phase 3e continuation (NO browser needed; unit-testable — do this if you can't drive a browser)

The original editor-feature arc, paused for the consolidation. All unit/axe-testable:
- **3e.4** — mobile colSpan slider in `AdminLayoutsInspectorSection`, routed through `useLayoutResize.applyKeyboardResize` so all four input paths (drag / Shift+Arrow / slider / future inline) share one history + narration path.
- **3e.5** — Phase 3c polish: **R3-10** resize handle `<button>` → `<div role="separator" aria-orientation="vertical" aria-valuemin/max/now>` (extend `editor-axe.test.ts`); **R3-12** 12-col overlay snap-line gap math (`(col/12)*(rowWidth − 11*gap)+col*gap`; unit-test the offsets).
- **Rich fields** — `.describe('rich'|'image'|'content-picker:…')` → TipTap / ImageUpload / ContentPicker via the `node.description` seam the AutoForm engine already reads.
- **Config-edit undo** — plan §7.14 `edit-section-config` op (page-meta has the same gap today).

## Optional — container-query viewport-sim
Switch PageFrame's `@media (max-width:…)` collapse to `@container` so the editor's viewport toggle (375/768/100%) actually collapses the sidebar. Affects the public custom-page surface → verify both in a browser.

## Self-audit + close
R1-R4 + fresh-eyes + (for Part A/the container-query work) at least one **real-browser smoke** — don't ship live-homepage CSS blind. Verify load-bearing claims against source. Update `docs/sessions/169-XXX.md` + write the next handoff.

---
