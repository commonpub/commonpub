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

## Part A — homepage → PageFrame (the remaining dedup; browser-gated)

**Editor canvas already done** (session 168 continued — `ba01ab4`): the canvas previews via `<PageFrame>` (dynamic `#[zoneSlug]` slots), PageFrame replicates the homepage values (sidebar 300, max 1280, pad 28/32/48, gap 32), section DOM untouched. **Smoke the editor on deploy**: full-width-above + main|sidebar split renders; drag/resize/selection/add-row work; cross-zone drag (now horizontal) works. Known limit: the viewport toggle won't collapse the sidebar at tablet/mobile sim (media queries are viewport-based — container-query enhancement is a separate task).

**Remaining: migrate the live homepage `index.vue`** — code-dedup (the editor already matches the homepage values via PageFrame, NOT a WYSIWYG prerequisite). PageFrame is now a faithful replica INCLUDING full-bleed full-width (`ce5d68c`). **Before migrating, resolve the inter-row-spacing entanglement:** `.cpub-sidebar` has `display:flex;flex-direction:column;gap:18px` (sidebar row spacing) but `.cpub-feed-col` (main) has only `min-width:0`. Either (a) add the flex-gap to `.cpub-page-frame-sidebar` (makes PageFrame match, but bakes a homepage-specific asymmetry in), or (b) move inter-row spacing into LayoutSlot/LayoutRow so both zones space rows consistently (cleaner; bigger change). Decide first. **CRITICAL ordering:** `.cpub-main-layout` is one scoped rule shared by ALL THREE homepage branches — migrate **all three together**, keep bespoke chrome (mobile-hoist, `.cpub-sidebar-desktop/-mobile`, powered-badge) in slots, THEN delete the old grid CSS. **Real-browser smoke** at ≥1025/768–1024/≤640 before merge. (Optional: PageFrame collapse → `@container` for accurate editor viewport-sim — verify editor + public custom-page.)

See `docs/adr/028-homepage-customization-model.md` for the strategic frame (which models are sanctioned; legacy deprecation; why the shadowing fix is now committed).

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
