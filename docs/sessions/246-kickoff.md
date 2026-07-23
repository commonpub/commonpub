# Session 246 — kickoff: polish the email + registration editors (design-system + theme tokens)

Read this FIRST. Standing rules: utmost care; adversarially verify; **NEVER add AI attribution to any
commit/PR** (CLAUDE.md rule #15); verify state empirically (`npm view`, `curl /api/features`, read the code —
don't trust docs blindly); **local browser acceptance before deploy** (run the app, screenshot desktop + true
390px, deploy only when 100%).

## Where things stand (handoff from session 245)

**All 3 instances LIVE on: schema 0.61 / config 0.35 / server 2.119 / infra 0.19 / layer 0.112.** No pending
rolls. Session 245 rolled postroll-hardening (server 2.119 / layer 0.111) + the registration-editor +
bug-sweep (layer 0.112), and ran a full external-organizer contest E2E with zero defects. Detail:
`docs/sessions/245-roll-registration-editor-and-fixes.md`. Judge info/photos verified working (showcase +
panel render photos + fallbacks). `contestPii` + `contestPrivateFiles` ON on commonpub.io + deveco;
heatsync per its own config. **CI is red on `@commonpub/docs#test`** — pre-existing, env-specific, green
locally, deploy runs independently — NOT a blocker.

## The task: make the two contest editors follow the design system

Both editors are **functional but visually gnarly** — hardcoded px, inline `style=`, dashed borders, and
locally-reinvented form controls instead of the shared design-system patterns + theme tokens. This is a
**pure UI/UX polish, LAYER-ONLY** (no schema/server/config change) → rolls as **layer 0.113**.

### The two editors (+ their shared/adjacent pieces)

1. **Registration editor** — the Registration tab in `layers/base/components/contest/ContestEditor.vue`
   (`#registration`, ~line 583) + **`FormTemplateEditor.vue`** (the field-card builder) +
   `ContestRegistrationForm.vue` (the live preview). Session 245 made it a real two-pane builder
   (editor + sticky preview + editor↔preview linking) — the LAYOUT is good; the **field-card chrome inside
   `FormTemplateEditor` is the gnarly part.**
2. **Email editor** — `layers/base/components/contest/ContestEmailEditor.vue` (compose body blocks +
   registration-confirmation / deadline-reminder toggle + live server-rendered preview in a sandboxed
   iframe). Adjacent: `layers/base/pages/admin/email-templates.vue` (the instance-wide email *branding*
   form — same visual family; polish it too if in scope).

### The gnarly inventory (concrete targets)

- **`FormTemplateEditor.vue`** — ~40 hardcoded px (8px/6px/4px/10px/13px/90px/320px…) → should be
  `--space-*`; **7 inline `style=`** attrs → classes; **4 dashed borders** (`.cpub-fte`, `.cpub-fte-intro`,
  `.cpub-fte-extra`) → the design system is **solid 2px** borders (`--border-width-default`); and it
  **reinvents form controls** (`.cpub-form-input`, `.cpub-fte-*`) instead of the canonical shared classes.
- **`ContestEmailEditor.vue`** — hardcoded px *dimensions* (220/240/520/760px) + spacing (6/8/12px) →
  tokens/`clamp()`. One hex `#fff` is the preview-iframe background (`.cpub-cee-frame`) — the **email HTML
  inside** the iframe is server-rendered and legitimately uses hex (email clients don't support CSS vars),
  so don't "fix" that; the iframe frame chrome itself can be a token.
- **`ContestEditor.vue` registration section** — inline `style="margin:…"` on `.cpub-form-label` /
  `.cpub-form-hint` / `.cpub-form-check` at ~lines **560, 597, 620, 697, 742, 777** (debt from session 245).

### Design system — the source of truth (adopt, don't reinvent)

- **Tokens:** `packages/ui/theme/base.css` — `--space-1..24`, `--text-xs..6xl` + `--text-label/dim/faint`,
  `--radius*` (base `--radius: 0` = sharp), `--border-width-thin/default/thick`,
  `--shadow-sm/md/lg/xl/accent/block`, `--font-sans/mono/heading`, `--font-weight-*`. (Edit theme in
  `packages/ui/theme/`, NOT the gitignored `layers/base/theme/`.)
- **Shared form controls:** `packages/ui/theme/forms.css` — `.cpub-input` (+ `-sm/-lg`), `.cpub-select`,
  `.cpub-textarea`, `.cpub-checkbox`, `.cpub-radio`, `.cpub-form-label`, `.cpub-form-hint`,
  `.cpub-form-error`, `.cpub-form-group`. **Prefer these over local `.cpub-fte-*`/`.cpub-form-input`.**
- **Shared editor-panel patterns:** `packages/ui/theme/editor-panels.css` — `.cpub-ep-section`,
  `.cpub-ep-field`, `.cpub-ep-flabel`, `.cpub-ep-input`, `.cpub-ep-hint`, `.cpub-ep-block-item`,
  `.cpub-ep-chip*`, etc. This is how the block palette + settings-rail sections are styled.
- **Reference "good" editors:** `layers/base/components/editors/ProjectEditor.vue`,
  `ExplainerEditor.vue`, `ArticleEditor.vue` — they consume `.cpub-ep-*` cleanly; match that quality.
- **Design principles (CLAUDE.md):** sharp corners (`--radius: 0`), 2px borders, offset shadows (no blur),
  JetBrains Mono for UI labels (uppercase, letter-spaced), blue accent `#5b9cf6` via `var(--accent)`, cool
  neutral palette, base 16px / line-height 1.7, `cpub-` class prefix, **zero hardcoded colors/fonts** (rule #3).

### CRITICAL constraints (don't break shared usages)

- **`FormTemplateEditor` is SHARED** with the **Stages tab** (`ContestStageCard.vue:162`, per-stage
  submission forms). Any card/control restyle must be verified on BOTH the Registration tab AND the Stages
  tab. Prefer additive/class-level changes.
- **`ContestRegistrationForm` is SHARED** with `ContestSignup.vue` (the REAL participant registration form,
  `preview=false`). Don't regress the live form. All session-245 link hooks are `preview`-gated — keep it.
- Keep a11y: the aria-live reorder announcement + keyboard-first ▲▼ reorder in FormTemplateEditor; WCAG 2.1
  AA contrast + focus states; keyboard nav. Add/keep an axe-core render test if you touch structure.
- Headless/theme-driven: `var(--*)` only, `cpub-` prefix, no visual opinions beyond tokens.

### Suggested approach (propose before a big rewrite)

1. **Swap local controls → canonical** (`.cpub-input`/`.cpub-select`/`.cpub-textarea`/`.cpub-form-label`/
   `.cpub-checkbox`) — this deletes most of the bespoke CSS and instantly aligns both editors.
2. **Tokenize** every hardcoded px → `--space-*`/`--radius-*`; dashed → solid 2px (or a deliberate,
   tokenized "draft" treatment if dashed is intentional — decide, don't leave it accidental).
3. **De-inline** the `style=` attrs → utility classes.
4. **Unify the two-pane feel:** the registration tab and the email tab are BOTH editor+preview two-pane —
   make them read as siblings (consistent preview header, sticky behavior, panel chrome).
5. **UX wins:** clearer field-card hierarchy, a prominent "add field" affordance (presets already exist:
   `availableFieldPresets`/`availableFormTemplates`), tidy per-type extras (options/agreement/address/file),
   and a calmer spacing rhythm. See `feedback_visual_editor_ux_patterns` + the P4 form-editor overhaul
   (session ~160) for established patterns.

### Verify (standing rule)

- Run the app locally (docker :5433 + drizzle push + nuxt dev; recipe in `reference_local_run_and_visual_verify`).
  `contestPii`/`contestPrivateFiles` are ON on the reference (`apps/reference/commonpub.config.ts`).
- Screenshot **BEFORE + AFTER** at desktop AND true 390px for: Registration tab, Emails tab (edit an
  existing contest — email editor is edit-only), **Stages tab** (shared FormTemplateEditor), and the **public
  ContestSignup** form (shared ContestRegistrationForm). All four must still look/work right.
- `grep -nE '#[0-9a-fA-F]{3,6}'` the touched components → zero (except the documented email-HTML-preview
  case). No inline `style=` left behind.
- Layer suite + reference typecheck green; a11y render test on the field editor.
- Roll as **layer 0.113** (layer-only): publish, ff-merge main → commonpub.io; bump deveco + heatsync layer
  pins `^0.112`→`^0.113`, regen both lockfiles (reconcile path — crash-free), push. No migration, no flag change.

### Landmines (from recent sessions)

- **deveco/heatsync lockless-npm arborist crash** — a layer bump = pin bump + regen BOTH lockfiles from the
  committed seed (reconcile); never a from-scratch lockless resolve. See `feedback_deveco_docker_arborist_edgesout`.
- **Contest-dir component auto-import prefix** — a new component in `components/contest/` whose filename
  doesn't start with "Contest" needs an EXPLICIT import (bare tag renders empty). See
  `feedback_component_autoimport_contest_prefix`.
- Theme edits go in `packages/ui/theme/` (NOT gitignored `layers/base/theme/`); overrides must sit OUTSIDE
  `@layer commonpub` to beat Vue scoped CSS.
