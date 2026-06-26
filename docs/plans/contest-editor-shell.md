# Contest Editor — 3-panel shell redesign (match project/blog/explainer)

> **Status: COMPLETE — built session 218, squash-merged (PR #52) + published + deployed to all 3 in
> session 219** (verified by the session 228 plans audit). The HtmlBlock + tabs/table/criteriaBar
> blocks + 3-panel ContestEditor all shipped; the 218 build-log "NOT merged" wording is stale.
>
> Created session 217 (2026-06-23). Branch: `contests` (the contest work is merged to main + live on
> commonpub.io; this is the next iteration). Goal: make the contest editor FEEL like the
> project/blog/explainer editor — **left block palette · center body with tabs · right settings rail**,
> with banner + cover **in the body**, plus a new **HTML block** usable in every body.

## 0. Why — what's wrong today

The current `ContestEditor.vue` (623 lines) is a **single scrolling column**:
1. sticky topbar (inside the normal site layout — the site nav is still visible),
2. a banner + cover upload strip,
3. a tabbed "Contest body" (Overview / Rules / Prizes / Stages / Judging) with Write/Preview/Code,
4. then ALL settings stacked **below** the body in a 2-column grid (Details/Schedule/Prizes/Access on the
   left, Entries/People/Stage&Status/Danger on the right).

There is **no left block palette** (you add blocks via an "+ Insert block" button only), the settings are
**below** the body instead of in a **right rail**, and the whole thing renders **inside the site chrome**
instead of as a focused full-screen editor. It does not match the house editor.

## 1. The house editor (reference: `components/editors/ProjectEditor.vue`)

The content editor page `pages/u/[username]/[type]/[slug]/edit.vue` is `definePageMeta({ layout: false })`
(full-screen, no site nav). It owns the `cpub-editor-layout` (height:100vh flex column) + the
`cpub-editor-topbar` (back · title input · autosave status · **Write/Preview/Code** · Import · Save Draft ·
Publish), then mounts a per-type editor component. `ProjectEditor.vue` renders the **3-panel shell**:

```
cpub-pe-shell (flex, fills below the topbar)
├── LEFT  cpub-pe-library (220px)  → <EditorBlocks :groups :block-editor>      ← block palette
├── CENTER cpub-pe-center (flex:1)
│     ├── cpub-pe-canvas-toolbar  (bold/italic/link · viewport desktop/tablet/mobile)
│     ├── cpub-pe-canvas → cpub-pe-canvas-inner (centered, max-width)
│     │     ├── inline COVER image (hover overlay: upload / from-URL / replace / remove)
│     │     ├── inline title <textarea>
│     │     └── <BlockCanvas :block-editor :block-types>
│     └── cpub-pe-statusbar (N blocks · N words)
└── RIGHT cpub-pe-settings (280px) → stack of <EditorSection> (collapsible):
       Project Meta · Tags · Visibility · Cover Image · Banner Image · SEO · Checklist
```

Reusable primitives (already in `@commonpub/editor/vue`): **`EditorBlocks`** (`:groups`, `:block-editor` —
click a block to insert it into that editor), **`BlockCanvas`** (`:block-editor`, `:block-types`),
**`EditorSection`** (`title`, `icon`, `:open`, `@toggle` — collapsible rail section), `EditorTagInput`,
`EditorVisibility`. Image uploads via `provide(UPLOAD_HANDLER_KEY, …)`; in-body custom block edit components
via `provide(BLOCK_COMPONENTS_KEY, {…})`.

## 2. Everything the contest editor must contain (full inventory)

Nothing below may be lost in the redesign.

**Identity** — title · slug (URL) · subheading (hero tagline).
**Media** — bannerUrl (wide hero ~4:1) · coverImageUrl (card/thumbnail).
**Bodies (BlockTuple[])** — descriptionBlocks (Overview) · rulesBlocks (Rules) · prizesBlocks (Prizes prose).
**Schedule** — startDate · endDate · judgingEndDate.
**Stages** — the ordered stage timeline (`ContestStagesEditor`: per-stage name/kind/dates/criteria/
  submissionTemplate/submissionMode/advanceCount) **+ advancement** (Top-N / manual cut controls, edit-only).
**Entries** — eligibleContentTypes (project/blog/explainer) · maxEntriesPerUser.
**Prizes config** — showPrizes toggle · prizes[] structured cards (place/category/title/value/description).
**Judging config** — judgingCriteria[] rubric (`ContestCriteriaEditor`) · judgingVisibility · communityVotingEnabled.
**Access** — visibility (public/unlisted/private) · visibleToRoles[].
**People (edit-only)** — judges (`ContestJudgeManager`) · collaborators (`ContestStakeholderManager`, owner-only).
**Lifecycle (edit-only)** — status transitions (draft→upcoming→active→paused→judging→completed/cancelled) ·
  Danger Zone (delete, owner-only).
**Top-level** — Save + autosave status · View (public page) · Write/Preview/Code (block bodies) ·
  status badge.

## 3. Target layout (the redesign) — DECIDED (session 217)

Operator decisions: **(1) center = the three prose tabs only** (Overview/Rules/Prizes); **Stages + Judging
live in the right rail** as sections. **(2) banner + cover render inline in the OVERVIEW body only** (like a
project's cover-in-body), not above the shared tab bar. Consequence: the **left palette is always active**
(every center tab is a block body — no contextual hiding needed; simpler than the project editor even).

Make the contest edit + create pages `layout: false` full-screen editors. `ContestEditor.vue` renders the
`cpub-editor-layout` topbar + a contest 3-panel shell:

```
cpub-editor-layout (height:100vh)
├── cpub-editor-topbar
│     [back] | [title input] [STATUS badge] [unsaved dot · autosave] | [Write|Preview|Code]
│            | spacer | [View ↗] [Save] [Status ▾ (edit-only lifecycle menu)]
├── cpub-ce-shell (flex, 3 columns)
│   ├── LEFT  cpub-ce-library (220px)  — ALWAYS active
│   │     <EditorBlocks :groups="contestBlockGroups" :block-editor="activeBodyEditor">
│   ├── CENTER cpub-ce-center (flex:1) — three block-body tabs ONLY
│   │     ├── body TAB BAR:  Overview · Rules · Prizes
│   │     ├── tab content → <BlockCanvas :block-editor="activeBodyEditor" :block-types="contestBlockGroups">
│   │     │     (Write = canvas · Preview = BlocksBlockContentRenderer · Code = JSON, per-body)
│   │     │   On the OVERVIEW tab the canvas leads with inline MEDIA: banner (wide, hover-overlay
│   │     │   upload/replace/remove) + cover inset — same visual pattern as the project inline cover.
│   │     │   Rules/Prizes tabs show no media.
│   │     └── cpub-ce-statusbar (N blocks · N words for the active body)
│   └── RIGHT cpub-ce-settings (~340px): collapsible <EditorSection> stack
│         Details     — slug · subheading            (title lives in the topbar)
│         Schedule    — start · end · judging-end (CpubDateTimeField)
│         Stages      — ContestStagesEditor + advancement (edit-only)   ← rail section
│         Entries     — eligible types · max per person
│         Prizes      — showPrizes toggle · prize cards
│         Judging     — score visibility · community voting · ContestCriteriaEditor   ← rail section
│         Access      — visibility · visibleToRoles
│         People      — judges · collaborators        [edit-only]
│         Danger Zone — delete                         [edit-only, owner]
```

### Right rail width
Because the dense **Stages** + **Judging** editors now live in the rail, widen it to **~340px** (vs the
project editor's 280px) and make `ContestStagesEditor` / `ContestCriteriaEditor` lay out vertically
(single-column) so they read cleanly at rail width. If still cramped at build time, a section can open into
a wider slide-over drawer — but try the inline rail first.

### Where the lifecycle transitions go
The status badge + transitions become a **topbar `Status ▾` dropdown** (the contest analogue of Publish),
not a rail section — lifecycle is the primary action. **Advancement** (the Top-N / manual cut) lives inside
the **Stages** rail section, next to the timeline it acts on.

## 4. The one real refactor — hoist the body block editors

For a left palette to insert into the **currently active** body, the three `useBlockEditor` instances must
live where the palette lives. Today each `ContestBodyEditor` owns its own block state internally.

Plan: lift the three editors into `ContestEditor.vue`:
- `const overviewEditor = useBlockEditor(seedBodyBlocks(descriptionBlocks, description, descriptionFormat))`
  and likewise `rulesEditor`, `prizesEditor`.
- `const activeBodyEditor = computed(() => ({ overview: overviewEditor, rules: rulesEditor,
  prizes: prizesEditor })[activeTab.value] ?? overviewEditor)`.
- LEFT `<EditorBlocks :block-editor="activeBodyEditor" :groups="contestBlockGroups">`.
- CENTER `<BlockCanvas :block-editor="activeBodyEditor" :block-types="contestBlockGroups">` for all three
  center tabs (Overview/Rules/Prizes are all block bodies; Stages/Judging are right-rail sections, not tabs).
- `provide(UPLOAD_HANDLER_KEY, …)` + `provide(BLOCK_COMPONENTS_KEY, { judgesShowcase, html })` once at the
  ContestEditor level (covers all three bodies).
- buildPayload reads `overviewEditor.toBlockTuples()` etc. Autosave/dirty watch all three.

`ContestBodyTabs` + `ContestBodyEditor` collapse into this shell (the tab bar becomes the center tab bar;
the per-body canvas becomes the shared `BlockCanvas`). Preview/Code derive from the active body's tuples.

## 5. New: HTML block (embed full HTML in any body)

Add a first-class `html` block (raw HTML snippet) alongside the existing `markdown` block:
- **View** `layers/base/components/blocks/BlockHtmlView.vue` — renders `sanitizeRichHtml(content.html,
  { neutralizeColors: true })` into `.cpub-md-html` (dark-safe, same path as contest Full-HTML). Scripts
  stripped by the sanitizer allowlist.
- **Edit** `layers/base/components/contest/blocks/HtmlBlock.vue` (or shared in editor) — a monospace
  `<textarea>` for raw HTML + a tiny live preview; `content/update` contract like the other blocks.
- Register: `html: BlockHtmlView` in `BlockContentRenderer.vue` map (replaces today's anonymous
  `block.data.html` fallback for this type); `provide(BLOCK_COMPONENTS_KEY, { html: HtmlBlock })` in the
  editor; add to the palette **Rich** group next to Markdown. Available in Overview/Rules/Prizes.
- Security: identical to the existing rich-HTML path (allowlist sanitizer + color neutralization);
  any new user HTML on the page already goes through `sanitizeRichHtml`. Add an axe + sanitizer test.

## 6. Contest block palette groups (`contestBlockGroups`)
- **Basic** — Text · Heading · Image · Code
- **Contest** — Judges Showcase (existing `judgesShowcase`)
- **Media** — Video · Embed
- **Rich** — Tip · Warning · Quote · Divider · Markdown · **HTML** (new)

## 7. Phasing (each visually verified via the local run + Playwright, axe on new components)
1. **Shell scaffold** — `ContestEditor` → `cpub-editor-layout` topbar + 3-panel `cpub-ce-shell`; pages go
   `layout: false`. Move existing settings sections verbatim into the right rail `EditorSection`s. No block
   changes yet. Verify nothing lost.
2. **Hoist body editors + left palette** — lift the 3 `useBlockEditor`s, wire `EditorBlocks` + shared
   `BlockCanvas`, collapse `ContestBodyTabs`/`ContestBodyEditor`. Preview/Code per active body.
3. **Inline media in the body** — banner + cover as inline hover-overlay zones at the top of the center
   canvas (reuse the project inline-cover pattern); remove the old strip.
4. **Topbar Status ▾ lifecycle menu** — move transitions into the topbar dropdown; advancement stays in Stages.
5. **HTML block** — view + edit + registry + palette + tests.
6. Gates (server/layer/schema suites + both app typechecks) + axe + visual verify. Then docs + (on
   go-ahead) the deveco/heatsync roll is a SEPARATE later step.

## 8. Decisions (settled session 217)
1. **Stages + Judging** → right-rail sections (NOT center tabs). Center = Overview/Rules/Prizes prose only.
2. **Banner + cover** → inline in the Overview body only (not above the tab bar).
3. **Lifecycle** → topbar `Status ▾` menu; advancement inside the Stages rail section.
4. Left palette always active (every center tab is a block body).
5. Right rail widened to ~340px to fit Stages/Judging; those editors lay out single-column.
