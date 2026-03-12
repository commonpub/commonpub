# UI Design Specification

## Source of Truth
- Primary: `prime-mockups/unified-v2/00-design-system.html`
- Secondary: `prime-mockups/01-06*.html` (hack.build readability patterns)

## Token System

### Surfaces
- `--bg`: #fafaf9 (off-white base)
- `--surface`: #ffffff (pure white)
- `--surface2`: #f4f4f2 (subtle gray)
- `--surface3`: #eaeae7 (stronger gray)

### Text
- `--text`: #1a1a1a (near-black)
- `--text-dim`: #6b6b66
- `--text-faint`: #a3a39e

### Borders
- `--border`: #1a1a1a (strong, primary)
- `--border2`: #d4d4d0 (subtle)

### Accent & Semantic Colors
- `--accent`: #5b9cf6 (blue)
- `--accent-bg`: rgba(91,156,246,0.08)
- `--accent-border`: rgba(91,156,246,0.25)
- `--green`: #22c55e / `--green-bg` / `--green-border`
- `--yellow`: #f59e0b / `--yellow-bg` / `--yellow-border`
- `--red`: #ef4444 / `--red-bg` / `--red-border`
- `--purple`: #8b5cf6 / `--purple-bg` / `--purple-border`
- `--teal`: #14b8a6 / `--teal-bg` / `--teal-border`
- `--pink`: #ec4899 / `--pink-bg` / `--pink-border`

### Shape
- `--radius`: 0px (sharp corners everywhere)
- `--radius-sm`: 2px
- `--radius-full`: 50% (avatars only)

### Shadows (offset, no blur)
- `--shadow-sm`: 2px 2px 0 var(--border)
- `--shadow-md`: 4px 4px 0 var(--border)
- `--shadow-lg`: 6px 6px 0 var(--border)
- `--shadow-accent`: 4px 4px 0 var(--accent)

### Typography (bumped +2px from mockup)
- `--font-sans`: system-ui, -apple-system, sans-serif
- `--font-mono`: 'JetBrains Mono', ui-monospace, monospace
- `--text-base`: 16px (was 14px)
- `--text-sm`: 14px (was 12px)
- `--text-xs`: 12px (was 10px)
- `--text-label`: 11px (monospace UI labels)
- Body line-height: 1.7 (was 1.5)

## Content Type Badge Colors
- Article: accent (blue)
- Blog: green
- Project: purple
- Explainer: teal
- Video: red
- Tutorial: yellow

## Interaction Patterns
- **Hover**: `transform: translate(-1px, -1px)` + shadow grows
- **Focus**: `box-shadow: var(--shadow-accent)`
- **Active**: `transform: translate(1px, 1px)` + shadow shrinks
