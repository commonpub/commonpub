# @commonpub/theme-studio

Framework-agnostic theme generator for CommonPub. Derives a complete,
harmonized, WCAG-checked design system (a CommonPub custom-theme token
override map) from a small `ThemeRecipe` — the brain behind the admin
"Theme Studio" guided builder.

Pure TypeScript: no DOM, no Vue, no Nuxt. Deterministic (seeded RNG), so it
is fully unit-testable and reusable anywhere.

## Install

```bash
pnpm add @commonpub/theme-studio
```

## Quick start

```ts
import { recipeToTokens, randomizeRecipe, defaultRecipe } from '@commonpub/theme-studio';

// A neutral starting point, or roll a random (deterministic per seed) one:
const recipe = randomizeRecipe(42); // or defaultRecipe()

const { tokens, fonts, parentTheme, fontHref } = recipeToTokens(recipe);
// tokens     → Record<canonical token name, CSS value> to store on a custom theme
// fonts      → Google-Font families to load
// parentTheme→ 'base' (light) or 'dark' — the built-in CSS to inherit from
// fontHref   → ready-to-use Google Fonts stylesheet URL (empty if none)
```

## What's in the box

| Module | Exports |
|---|---|
| `color` | hex/rgb/hsl conversions, `rotate`/`setL`/`setS`/`adjL`/`rgba`, `relLum`/`contrast`/`wcag`/`readableOn` |
| `harmony` | `harmonyColors(accent, scheme)` for 6 schemes |
| `palette` | `buildPalette({ accent, secondary?, scheme, mode })` → full semantic ramp |
| `scales` | `typeScale`, `spaceScale`, `radiusScale`, `buildShadows`, `densityPad`, `motionTokens` |
| `fonts` | `FONTS` catalog, `fontStack`, `fallbackFor`, `googleHref` |
| `presets` | `COLOR_VIBES`, `TYPE_VIBES`, `SHAPE_PRESETS`, `SHADOW_PRESETS`, `RATIOS` |
| `recipe` | `ThemeRecipe`, `defaultRecipe()`, `randomizeRecipe(seed)`, `randomName(seed)` |
| `generate` | `recipeToTokens(recipe)` — the projection onto CommonPub's canonical token registry |

## The projection

`recipeToTokens` maps a recipe onto the canonical token keys CommonPub
recognizes (`@commonpub/ui` `TOKEN_SPECS`). It emits only the tokens it
derives — everything else inherits from a mode-matched `parentTheme`. The
whole palette (surfaces, text, borders, states) derives from the accent
hue/saturation + mode, so `text`-on-`bg` and on-accent button text are
guaranteed to clear WCAG AA for any accent.

## License

AGPL-3.0-or-later. See [LICENSE](./LICENSE).
