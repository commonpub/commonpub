# Session 019 — CSS Token Contract Alignment

## Date
2026-03-11

## What Was Done

### Token Contract Extension
- Added 8 new semantic tokens to `base.css` contract (now 148 tokens):
  - `--color-on-primary`, `--color-on-accent` (text on colored backgrounds)
  - `--color-surface-hover` (hovered surface)
  - `--color-success-bg`, `--color-warning-bg`, `--color-error-bg`, `--color-info-bg` (semantic tint backgrounds)
  - `--color-bg-subtle` (subtle background)
- Added matching overrides to all 5 theme files: generics, deepwood, hackbuild, deveco, base

### Bulk Token Rename (Reference App)
Renamed ~852 non-contract token references across 73 `.svelte` files in `apps/reference/src/`:

| Category | Old Token | New Token | Count |
|----------|-----------|-----------|-------|
| Spacing | `--space-xs` | `--space-1` | ~65 files |
| Spacing | `--space-sm` | `--space-2` | |
| Spacing | `--space-md` | `--space-4` | |
| Spacing | `--space-lg` | `--space-6` | |
| Spacing | `--space-xl` (3rem) | `--space-12` | |
| Font Size | `--font-size-xs..3xl` | `--text-xs..3xl` | ~59 files |
| Surface | `--color-surface-secondary` | `--color-surface-alt` | ~28 files |
| Font Weight | `--font-bold` | `--font-weight-bold` | ~10 files |
| Font Weight | `--font-medium` | `--font-weight-medium` | |

### Audit Findings
- **Reference app**: Clean — 0 remaining non-contract tokens, 0 collateral damage (no double-replacements)
- **Package libraries (`packages/ui/src/`)**: 32 pre-existing non-contract references (out of scope):
  - 25 `--font-size-*` references in 9 UI components (Avatar, Badge, Button, IconButton, Input, Select, Tabs, Textarea, Tooltip)
  - 7 `--color-surface-elevated` references in 5 components
  - These are candidates for a future follow-up session

## Files Modified

### Theme Contract (5 files)
- `packages/ui/theme/base.css` — 8 new tokens added
- `packages/ui/theme/generics.css` — 8 dark-theme overrides
- `packages/ui/theme/deepwood.css` — 8 forest-theme overrides
- `packages/ui/theme/hackbuild.css` — 8 punk-theme overrides
- `packages/ui/theme/deveco.css` — 8 clean-theme overrides

### Reference App (73 .svelte files)
All files under `apps/reference/src/` — spacing, font-size, surface, and font-weight token renames

## Decisions
- All `--space-xl` instances used `3rem` fallback → mapped to `--space-12` (not `--space-8`)
- Package-level non-contract tokens (`packages/ui/src/`) left for a separate session to avoid scope creep
- `--color-on-primary` / `--color-on-accent` added as separate tokens from `--color-primary-text` / `--color-accent-text` since they serve different semantic purposes (text ON colored backgrounds vs brand text color)

## Verification
- `pnpm build` — 13/13 tasks pass
- `pnpm typecheck` — 0 errors, 82 warnings (unchanged)
- `pnpm test` — 27/27 tasks pass (~1,050+ unit tests)
- `pnpm lint` — 0 errors, 29 warnings (unchanged)
- Grep for non-contract tokens in `apps/reference/src/` — 0 matches

## Next Steps
- Fix 32 non-contract token references in `packages/ui/src/` components (font-size-* → text-*, surface-elevated → surface-raised)
- Admin page polish, editor block toolbar, form element replacement
- Theme picker, PostComposer share/poll types
