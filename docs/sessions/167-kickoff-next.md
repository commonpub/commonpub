# Kickoff — session 168 (Phase 3e session 2: polish + mobile + browser-verify)

Paste between the `---` rules as the first message of a fresh session.
**Prerequisite: session 167 shipped** (Phase 3e session 1 — config inspector).

---

Fresh Claude Code session on the CommonPub monorepo. **Task: Phase 3e
session 2** — finish the config-inspector arc. Session 167 shipped the
auto-form engine + section/row inspectors + the 3-way dispatcher.

**Predecessor (session 167)**: built a **hand-rolled `<AutoForm>` engine
driven by Zod 4's native `z.toJSONSchema()`** — NOT FormKit. The kickoff's
prescribed `@formkit/zod` was overturned (verified against source):
`createZodPlugin` is validation-only (doesn't generate fields) AND peer-deps
Zod 3 while we're on Zod 4. The plan's risk-register fallback was chosen +
user-approved. See `docs/sessions/167-3e.md` + [[project-session-167-formkit-pivot]].
Layer **624 → 658** tests. 4 commits (`a5cd53d`/`bf584da`/`a3aebba`/`1cffcd1`).

## Verify session 167 shipped

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
# Engine + components present
grep -n "buildAutoForm\|z.toJSONSchema" layers/base/composables/autoFormSchema.ts | head
ls layers/base/components/admin/layouts/AdminLayoutsAutoForm.vue \
   layers/base/components/admin/layouts/AdminLayoutsInspectorSection.vue \
   layers/base/components/admin/layouts/AdminLayoutsInspectorRow.vue
# Dispatch + row-select wired
grep -n "update:section-config\|update:row-config\|:selection" "layers/base/pages/admin/layouts/[id].vue"
grep -n "cpub-layout-row-select\|handleRowSelectClick" layers/base/components/LayoutRow.vue
# Tests + typecheck
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1     # expect: 658 passed
pnpm typecheck 2>&1 | tail -3                                          # expect: 12/12
```

**Expect**: 3 sites 200; symbols present; **658 tests**; typecheck green.
Divergence → STOP + read `docs/sessions/167-3e.md`.

## FIRST: browser-verify session 167 (load-bearing)

Per [[feedback-css-cascade-unit-test-blind-spot]] session 167 did NOT
browser-verify the new pointer interactions (unit tests bypass hit-testing).
Before adding scope, confirm on the LIVE commonpub.io editor (admin-gated):

1. Open a layout in `/admin/layouts/[id]`.
2. Click a **section** → inspector shows its config auto-form → edit a field
   (e.g. heading text / hero CTA) → "Unsaved" → auto-saves → reload → persisted.
3. Hover a **row** → the top-left grip handle appears → click it → inspector
   shows the row form (gap/align/paddingY/background) → change gap → persists.
4. Confirm the row-select handle is actually CLICKABLE (the session-166 P0 was
   a hit-test-invisible handle that passed all unit tests).

If anything fails → that's the session's P0; fix before new work.
Alternatively stand up the deferred `@nuxt/test-utils` + Playwright harness
(also needed for 3e.6) and codify these as e2e.

## Scope (carry-overs from session 167, in priority order)

### 3e.4 — mobile colSpan slider (plan §7.5)
- On `< 768px` the resize handle is hidden; add a colSpan slider to the
  SECTION inspector that routes through `useLayoutResize.applyKeyboardResize`
  so all four input paths (pointer drag / Shift+Arrow / mobile slider /
  future inline) share ONE history-record + narration code path.
- The AutoForm engine has no notion of colSpan (it's section *structure*, not
  *config*) — add the slider as a fixed top-strip in `AdminLayoutsInspectorSection`
  ABOVE the auto-form, not as a schema field. Per §7.9 the strip also holds
  duplicate/delete/enabled-toggle (those can be 3f).

### 3e.5 — Phase 3c polish (deferred from session 166)
- **R3-10**: resize handle `<button>` → `<div role="separator"
  aria-orientation="vertical" aria-valuemin/max/now>`. Aligns cognitively
  with the slider's `role="slider"`. Extend `editor-axe.test.ts`.
- **R3-12**: 12-col overlay snap-line gap. Lines should land at
  `(col/12)*(rowWidth − 11*gap) + col*gap`, not `(col/12)*100%`. Unit-test
  computed `left` offsets.

### 3e.6 — full-shell axe + e2e harness
- Stand up `@nuxt/test-utils` + Playwright for a full editor-shell axe scan
  (the per-component scans exist; the shell-with-everything-wired one needs
  the harness). This ALSO closes the browser-verify gap above.

### Follow-ups (Phase 3f-ish, pull in if time)
- **Rich fields**: `.describe('rich')` → TipTap; `.describe('image')` →
  ImageUpload picker; `.describe('content-picker:project')` etc (§7.10). The
  AutoForm engine reads `node.description` already — add the `keyword:arg`
  switch + custom-control slot.
- **Config-edit undo**: plan §7.14 `edit-section-config` op (debounced edit
  session). Today config edits + page-meta edits both bypass the undo stack.
- **Migration application**: InspectorSection shows a drift advisory but
  doesn't apply `def.migrations`.

## Hard rules (unchanged)

No AI attribution · 0 npm publishes · heatsync+deveco UNTOUCHED on 0.24.0 ·
`var(--*)` only · pre-push vue-tsc strict · NEVER trust `gh run list` (curl
/api/health) · single-flight save stays · **verify load-bearing claims
against source** (this is what caught the FormKit problem).

## Self-audit + close

R1-R4 + audit-of-audit + at least one fresh-eyes pass. Update
`docs/sessions/168-XXX.md` + write `168-kickoff-next.md`.

---
