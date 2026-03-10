# ADR-006: CSS Custom Properties Token System

## Status
Accepted

## Context
Need a theming system that allows multiple visual identities (Deepwood Biome, hack.build punk zine, deveco.io clean tech) from the same components.

## Decision
All styling via CSS custom properties (var(--*)). No hardcoded colors or fonts in any component. Token contract defined in base.css, themes override values.

## Rationale
- CSS custom properties cascade naturally — perfect for theme layering
- base.css → instance theme → per-docs-site overrides
- Components remain truly headless and theme-agnostic
- No build step needed for theme switching
- Standing Rule #3: "No hardcoded color or font"

## Consequences
- `packages/ui/theme/base.css` defines the complete token contract
- Three initial themes: deepwood.css, hackbuild.css, deveco.css
- All @snaplify/ui components use only var(--*) for visual properties
- Instance admins can customize via token overrides
- Per-docs-site themes possible via DB-stored token values
