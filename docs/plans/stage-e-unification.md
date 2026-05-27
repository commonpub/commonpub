# Stage E — Section-Renderer Unification

> **Living document.** Updated as each phase completes. Source of truth for the unification effort that fixes the "I built parallel renderers instead of reusing existing components" mistake from sessions 158-9.

**Started**: session 159 (commit pending)
**Status**: Phase E.0 in progress

---

## The mistake I'm correcting

I built 17 section-renderer components (`layers/base/components/sections/Section*.vue`). Audit reveals **16 of 17 are duplicates** of existing components:

| Section type I built | Existing component I missed | Line count duplicated |
|---|---|---|
| SectionHeading | `BlockHeadingView` | 78 lines wasted |
| SectionParagraph | `BlockTextView` | 55 |
| SectionImage | `BlockImageView` | 104 |
| SectionDivider | `BlockDividerView` | 55 |
| SectionHero | `HeroSection` (homepage) | 164 (vs 95 legacy = +69 redundant) |
| SectionEditorial | `EditorialSection` | 138 (vs 32 = +106) |
| SectionStats | `StatsSection` | 151 (vs 38 = +113) |
| SectionHubs | `HubsSection` | 247 (vs 66 = +181) |
| SectionContests | `ContestsSection` | 193 (vs 39 = +154) |
| SectionCustomHtml | `CustomHtmlSection` | 70 (vs 20 = +50) |
| SectionContentFeed | `ContentGridSection` (already has pagination!) | 260 (vs 133 = +127) |
| SectionGallery | `BlockGalleryView` | 232 |
| SectionVideo | `BlockVideoView` | 193 |
| SectionEmbed | `BlockEmbedView` | 247 |
| SectionMarkdown | `BlockMarkdownView` | 100 |
| SectionCta | `BlockCalloutView` (close — variants info/tip/warning/danger; needs evaluation) | 130 (verdict TBD) |
| SectionLearning | (no existing equivalent found) | KEEP — genuinely new |

**Net waste**: ~2200 lines across `Section*.vue` + their tests. Plus the conceptual cost of running two parallel rendering systems.

**The user's mental model is correct**: the layout engine is an **arranger** for existing components, not a place to re-build everything. New section types only when nothing exists.

---

## Target architecture

`SectionDefinition` gets a `propMap` field that transforms the layout-runtime's `{config, meta}` props into whatever the target component expects:

```ts
export interface SectionDefinition<TConfig> {
  // ... existing fields ...
  component: Component;  // ← can now point at ANY existing component
  /**
   * Optional prop transform — maps the standard section render props
   * { config, meta } to the props the target component expects. Use
   * when `component` points at a reusable existing component (BlockX,
   * homepage SectionX) instead of a section-specific renderer.
   *
   * Default: passes { config, meta } unchanged.
   */
  propMap?: (props: SectionRenderProps<TConfig>) => Record<string, unknown>;
}
```

LayoutSlot dispatch:

```vue
<component :is="def.component" v-bind="def.propMap?.(props) ?? props" />
```

Backward compat: any section whose component already takes `{config, meta}` (e.g., a thin-app's custom section) keeps working — propMap defaults to identity.

Section file count: from 17 + 17 tests = **34 files** → to 0-1 section-specific files (only Learning if no equivalent found) + the existing components stay as-is. 32+ files deleted.

---

## Execution sequence (small commits, verify each)

Each phase ends with: tests pass, typecheck clean, commit + push, verify commonpub.io homepage unchanged.

### E.0 — Foundation (no behavior change)

- [ ] **E.0.1** Add `propMap` field to `SectionDefinition` interface (`packages/ui/src/sections.ts`)
- [ ] **E.0.2** Update `LayoutSlot.vue` to honor `propMap` (default = identity)
- [ ] **E.0.3** Unit test in `packages/ui/src/__tests__/sections.test.ts` — registry stores + retrieves propMap correctly
- [ ] **E.0.4** Tests + typecheck + commit + push + verify homepage unchanged

### E.1 — Primitives via Block system (4 sections)

- [ ] **E.1.1** `heading` → `BlockHeadingView` (propMap: `{config} → {content: config}`). Drop my section's eyebrow/subline/align fields (BlockHeadingView doesn't support them; matching the Block contract).
- [ ] **E.1.2** `paragraph` → `BlockTextView` (propMap same; takes `content.html`)
- [ ] **E.1.3** `image` → `BlockImageView` (propMap; takes `content.src/alt/caption/size`). Drop my section's `fit/aspectRatio/href` (BlockImageView uses `size` enum instead).
- [ ] **E.1.4** `divider` → `BlockDividerView` (propMap). BlockDividerView is just `<hr>`; drop my section's variant/spacingY OR EXTEND BlockDividerView with optional `variant` prop (decision deferred to execution).
- [ ] **E.1.5** Delete `layers/base/components/sections/Section{Heading,Paragraph,Image,Divider}.vue` (4 files)
- [ ] **E.1.6** Delete `Section{Heading,Paragraph,Image,Divider}.test.ts` (4 files)
- [ ] **E.1.7** Update `registry.test.ts` per-section assertions to match Block contract
- [ ] **E.1.8** Tests + typecheck + commit + push + verify

### E.2 — Block-system content sections (4 sections)

- [ ] **E.2.1** `gallery` → `BlockGalleryView` (propMap)
- [ ] **E.2.2** `video` → `BlockVideoView` (propMap)
- [ ] **E.2.3** `embed` → `BlockEmbedView` (propMap)
- [ ] **E.2.4** `markdown` → `BlockMarkdownView` (propMap)
- [ ] **E.2.5** Delete 4 corresponding `Section*.vue` + 4 `.test.ts` files
- [ ] **E.2.6** Update registry test
- [ ] **E.2.7** Tests + typecheck + commit + push + verify

### E.3 — CTA decision

- [ ] **E.3.1** Re-read BlockCalloutView's full shape: variant enum (info/tip/warning/danger), `content.html`, `content.variant`. No CTA buttons currently.
- [ ] **E.3.2** Decide:
  - **(a)** Extend BlockCalloutView with optional `buttons[]` field → use for cta (more reuse)
  - **(b)** Keep `cta` as a genuinely-new section component (cleaner; callout stays focused)
- [ ] **E.3.3** Execute the chosen path
- [ ] **E.3.4** Delete `SectionCta.vue` + test if (a); keep if (b)
- [ ] **E.3.5** Commit + push + verify

### E.4 — Homepage sections (LIVE on commonpub.io — go ONE AT A TIME)

For each: registry update → migration shape update → re-run migration on commonpub.io → verify identical to legacy → move on.

- [ ] **E.4.1** `custom-html` → `CustomHtmlSection` (no extension needed — already takes `{config, title}`). Easiest first.
- [ ] **E.4.2** `stats` → `StatsSection` (extend with optional `heading` prop, default "Platform Stats")
- [ ] **E.4.3** `hubs` → `HubsSection` (extend with optional `heading`)
- [ ] **E.4.4** `contests` → `ContestsSection` (extend with optional `heading`)
- [ ] **E.4.5** `editorial` → `EditorialSection` (extend with optional `heading`, default "Staff Picks")
- [ ] **E.4.6** `content-feed` → `ContentGridSection` (add `hide-tabs` prop, default false; pass true from content-feed section). ContentGridSection ALREADY has pagination.
- [ ] **E.4.7** `hero` → `HeroSection` (extend HeroSection to read `config.customTitle/customSubtitle` if set; otherwise keep hardcoded copy + contest-aware behavior)
- [ ] **E.4.8** Delete 7 corresponding `Section*.vue` + 7 `.test.ts` files
- [ ] **E.4.9** Final commit + verify homepage looks IDENTICAL to legacy renderer

### E.5 — Migration script update

- [ ] **E.5.1** Rewrite `buildConfig` in `packages/server/src/layout/migrate-homepage.ts` to produce shapes the unified components expect (not my made-up shapes)
- [ ] **E.5.2** Update the 19 PGlite migration tests
- [ ] **E.5.3** Re-run migration on commonpub.io with `--force`
- [ ] **E.5.4** Visual verify: homepage rendered via LayoutSlot looks like the legacy renderer

### E.6 — Cleanup

- [ ] **E.6.1** Delete `apps/reference/server/plugins/feature-flags-prime.ts` if it still exists (already moved to layer)
- [ ] **E.6.2** Sweep `layers/base/components/sections/` — only `SectionLearning.vue` should remain (and SectionCta if E.3 chose path b)
- [ ] **E.6.3** Update `registry.ts` comments to reflect "uses existing block + homepage components"
- [ ] **E.6.4** Update registry test's no-hardcoded-colors sweep — adjust file count + add the existing Block/Homepage components to the scan (defense vs. drift)
- [ ] **E.6.5** Session log entry

### E.7 — Memory + handoff update

- [ ] **E.7.1** New feedback memory: `feedback-reuse-existing-components` — the lesson
- [ ] **E.7.2** Update `project-session-159-canary` with Stage E outcome
- [ ] **E.7.3** Update `docs/sessions/160-handoff-prompt.md` — Stage E shipped, next is Phase 3a editor (which now has way less surface area because the section registry just points at existing components)

---

## Risk register

| Risk | Mitigation |
|---|---|
| Block components designed for `.cpub-prose` parent break outside that context | BlockX components are largely self-contained (verified: BlockHeadingView, BlockTextView, BlockImageView set their own colors/sizes). Test live on each unification. Add `.cpub-prose` wrapper via propMap if needed. |
| Migration shape change breaks the current commonpub.io layout | DELETE layout first (auto-fallback to legacy), unify, re-migrate. Catch any rendering issues before they're user-visible. |
| HomepageSectionRenderer.vue (legacy v-else-if path) breaks because I changed EditorialSection's props | All new props are OPTIONAL with defaults preserving current behavior. Backward-compat enforced. |
| Removing my SectionContentFeed loses the pagination I shipped today | ContentGridSection ALREADY HAS pagination (read confirmed). No loss. |
| HeroSection's contest-aware behavior conflicts with layout-engine "static hero" needs | HeroSection has v-if for active contest; if contest section IS active, hero shows contest banner. This is legacy behavior — keep it. Future: add an opt-out config flag. |
| Section configSchema changes break Phase 3a editor (when built) | Phase 3a doesn't exist yet — schemas are settled before that work. |
| Tests for the new section types I delete were testing wrong thing anyway (the duplicate, not the actual component) | Verified — those tests were never exercising the existing component. Their loss doesn't reduce coverage of the actual rendering. |

## Rollback plan

At any step:
- Layout broken → `DELETE FROM layouts WHERE scope_type='route' AND scope_key='/'` on commonpub.io → auto-fallback to legacy renderer
- Component broken → `git revert <commit>` → push → ~7min restore

## Net delta when E completes

- **Files deleted**: ~32 (16 `Section*.vue` + 16 `.test.ts`)
- **Files modified**: ~12 (sections.ts, LayoutSlot.vue, 7 homepage components extended with optional props, BlockDividerView maybe, migrate-homepage.ts, registry.ts, registry.test.ts)
- **Files added**: 0 new section component files (Learning + possibly Cta survive from before)
- **Lines net change**: -2000 lines (from ~2200 deleted, ~200 added in prop extensions + propMap calls)

---

## Decision log

| When | Decision | Why |
|---|---|---|
| 2026-05-27 | propMap on SectionDefinition, not per-section adapter files | Less file bloat; declarative; propMap is 1-3 lines vs ~5-line file each |
| 2026-05-27 | Do NOT unify Block registry + Section registry (keep separate) | Block uses Map object in BlockContentRenderer; section uses class. Unifying both would be a massive refactor. Defer. |
| 2026-05-27 | Block component "primitives" stay block-only; layout engine just dispatches to them via section registry | Don't change what Block components ARE; just reuse their rendering |
| TBD | E.3 cta decision (extend BlockCalloutView vs keep SectionCta) | Reach this decision during execution |

---

## Linked memories

- [[feedback-reuse-existing-components]] — will write after E.7.1
- [[project-session-159-canary]]
- [[feedback-usefetch-query-function]]
- [[feedback-nuxt-env-only-declared-keys]]
