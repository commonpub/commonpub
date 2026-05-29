# Kickoff — session 169 (consolidation Stage 2: homepage + editor canvas → PageFrame; browser-gated)

Paste between the `---` rules. **Prerequisite: session 168 shipped** (PageFrame + custom-page adoption + explore fix). This session needs a **real browser** (a commonpub.io build / deploy smoke) — the changes are CSS-cascade-sensitive and jsdom can't verify them.

---

Fresh Claude Code session on the CommonPub monorepo. **Task: consolidation Stage 2** — make the homepage + the editor canvas render through the shared `<PageFrame>` so the editor finally previews the REAL frame (the WYSIWYG fix), and (separately) ship the verified component-shadowing fix. commonpub.io workspace-main ONLY; heatsync + deveco UNTOUCHED on 0.24.0; no npm publish; no AI attribution.

## Verify session 168 shipped
```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do echo "  $u = $(curl -s -o /dev/null -w '%{http_code}' $u/api/health)"; done
ls layers/base/components/PageFrame.vue
grep -n "PageFrame" "layers/base/pages/[...customPath].vue"        # custom-page adopted
grep -n "auto-fill" layers/base/pages/explore.vue                  # explore grids fixed
pnpm --filter @commonpub/layer test 2>&1 | grep Tests | tail -1    # expect 664
pnpm typecheck 2>&1 | tail -3                                      # 12/12
```
Also: **eyeball commonpub.io/explore** — cards should be reasonable + the grid fills the width (the 168 fix). If still off, the container width (960) may need bumping; compare to deveco/heatsync.

## Part A — homepage + editor canvas → PageFrame (the WYSIWYG payoff)

**CRITICAL ordering (avoids breaking the live homepage):** `.cpub-main-layout` is defined once in `index.vue`'s scoped block and used by ALL THREE homepage branches (layout-engine / configurable / legacy). Migrate **all three together** to `<PageFrame>`, THEN delete the `.cpub-main-layout` scoped block. Migrating one branch orphans the shared scoped rule → the other branches lose their grid → live-site breakage.

1. `layers/base/pages/index.vue`: wrap each branch's zones in `<PageFrame>` with `#full-width`/`#main`/`#sidebar` slots. Keep the bespoke chrome (mobile-contest-hoist, `.cpub-sidebar-desktop/-mobile`, powered-badge) INSIDE the relevant slot. Delete `.cpub-main-layout`/`.cpub-feed-col`/`.cpub-sidebar` grid CSS once all three use PageFrame (keep the bespoke-chrome CSS).
2. `layers/base/components/admin/layouts/AdminLayoutsCanvas.vue`: render `<PageFrame editable>` INSIDE the existing viewport-sim shell (keep `.cpub-admin-layouts-canvas-stage` max-width 375/768/100%). Move the per-zone chrome (zone label, "+ Add row", click-to-deselect) into PageFrame's per-zone scoped slots so the canvas shows the REAL full-width-above + main|sidebar split instead of stacked boxes. **Keep `.cpub-layout-section`/`.cpub-layout-row` DOM untouched** so DnD + resize still bind.
3. Decide the canonical sidebar width (PageFrame ships 320; homepage was 300) — eyeball both on a build.
4. **Real-browser smoke** on a commonpub.io build at ≥1025 / 768–1024 / ≤640px: all 3 homepage branches render the grid; mobile-hoist/sidebar/badge behave; editor canvas shows the real split; DnD + resize + the Phase 3e inspector all still work. Only merge to `main` after this passes.

## Part B — component-shadowing fix (VERIFIED approach this time)

Session 168 proved `resolveComponent(variable)` does NOT work in Nuxt (build-time transform needs static literals — see [[feedback-nuxt-resolvecomponent-static-only]]). Do it right:

- Build a **literal-keyed resolver** evaluated in a setup/render context (a composable or plugin), e.g. `{ HomepageHeroSection: resolveComponent('HomepageHeroSection'), ... }` with one STATIC-LITERAL call per section component, then look up by name. Literal `resolveComponent` IS shadow-aware (resolves against the merged app-over-layer registry). OR render via the auto-import TAG and confirm `<component :is="'Name'">` string resolution works in Nuxt.
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

- **Cannot fully verify in-repo** (no thin app). Verify non-regression (layer components still render) + that the literal resolver returns components not strings. True shadow-override needs a deveco/heatsync test — flag as thin-app follow-up.

## Stage 3 (optional) — homepage-model ADR
Write the ADR (code-override-for-devs + layout-engine-for-operators; deprecate legacy `homepage.sections`; remove the `admin/homepage/sections.put.ts` bidirectional-sync seam). Minimal code.

## Self-audit + close
R1-R4 + fresh-eyes + at least one real-browser smoke (mandatory this session). Update `docs/sessions/169-XXX.md` + write the next handoff.

---
