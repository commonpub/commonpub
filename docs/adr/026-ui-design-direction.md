# ADR 026: UI Design Direction — Unified-V2 + Hack.Build Merge

## Status
Accepted (2026-03-11). Supersedes ADR 006 (CSS tokens).

## Context
Two mockup sets exist in `prime-mockups/`:
- **unified-v2**: 17 HTML files defining a sharp, technical aesthetic
- **hack.build root**: 6 HTML files with expressive, readable layouts

Neither alone is right. Unified-v2 has the right visual identity but cramped sizing. Hack.build has the right readability but too decorative.

## Decision
Merge both: **unified-v2 aesthetic + hack.build readability**.

### Visual Identity (from unified-v2)
- Sharp corners: `--radius: 0px` everywhere (except avatars)
- Strong borders: 2px solid `var(--border)` (#1a1a1a)
- Offset shadows: No blur. `2px 2px 0`, `4px 4px 0`, `6px 6px 0`
- Hover: `translate(-1px, -1px)` + shadow grows
- Focus: accent-colored shadow
- JetBrains Mono for UI labels (uppercase, letter-spaced)
- Cool neutral palette: off-white #fafaf9, near-black #1a1a1a, blue accent #5b9cf6

### Readability (from hack.build)
- Base font size bumped to 16px (was 14px in unified-v2)
- Line-height 1.7 (was 1.5)
- Card padding 24px (was 20px)
- Input padding 10px 14px (was 8px 12px)
- Two-column homepage: feed + sidebar
- Content-first editor layout
- Generous whitespace

### What NOT to take from hack.build
- Decorative fonts (Special Elite, Permanent Marker)
- Warm color palette (#f5f0e6 paper tones, #ff3366 pink accent)
- Slight card rotation on hover

## Token System
New tokens in `packages/ui/theme/base.css`:
- Direct tokens: `--bg`, `--surface`, `--text`, `--border`, `--accent`, `--shadow-md`
- Backward-compatible aliases: `--color-primary`, `--color-surface`, etc.
- Semantic colors with `-bg` and `-border` variants
- Dark theme in `packages/ui/theme/dark.css`

## Consequences
- Old themes (hackbuild.css, deepwood.css, deveco.css) removed
- New themes: base (light) + dark + generics
- All components reference tokens exclusively — zero hardcoded values
- Design source of truth: `prime-mockups/unified-v2/00-design-system.html`
