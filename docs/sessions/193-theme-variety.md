# Session 193 — Theme Studio overhaul: radius fix, neutrals, archetypes

Executes the approved "Theme Studio overhaul" plan (variety + the radius weirdness). Phased so the
riskiest change (the universal radius rule) shipped + verified alone before variety landed on top.

## Phase 1 — radius model fix (SHIPPED: ui 0.12.1 / layer 0.68.2, LIVE)

The universal `*, *::before, *::after { border-radius: var(--radius) }` rounded EVERY element on a
non-zero-radius theme (Stoa = 12px) — `hr`, dividers, icons, images, table cells, pseudo decorations
("rounded line breaks" bug). Blast-radius audit: 105 layer components set borders + relied on the
rule, so a full per-component migration was too risky. **Lowest-risk fix shipped instead:** keep
`* { border-radius: var(--radius) }` (every surface keeps its radius — zero regression) but split out
a reset for structural/media/pseudo elements (`hr, svg, img, picture, video, canvas, iframe, table
internals, ::before/::after/::marker/::placeholder, .cpub-divider → border-radius: 0`). Explicit
class-level radius (avatars' `--radius-full`) still wins. One-file change + 3 guard tests
(`packages/ui/src/__tests__/radius-model.test.ts`). KNOWN FOLLOW-UP: inner-section wedge-gaps inside
`overflow:hidden` rounded containers remain latent (needs the full per-component radius migration).

## Phase 2 — independent neutrals (schema 0.38 / theme-studio 0.4 / layer 0.69)

`buildPalette` gained `neutralHue?`/`neutralSat?` — surfaces/text decouple from the accent hue when
set (warm-cream under a cool accent, pure gray, etc.); absent → accent-tinted (back-compat). Threaded
through `ThemeRecipe` + `themeRecipeSchema` (additive, no migration) + `recipeToTokens`. Wizard adds a
**Neutral** segmented control (Auto / Pure / Warm / Cool) in the custom Color tab.

## Phase 3 — design-ethos archetypes + neumorphic shadow (same release)

`DESIGN_ARCHETYPES` (Brutalist, Editorial, Soft, Terminal, Neumorphic) — coherent presets that patch
shape+shadow+border+type+density+texture together to express a STYLE, preserving the user's color
(structure-only). New `neumorphic` shadow style in `buildShadows` (dual relief) + `SHADOW_PRESETS` +
the `shadowStyle` enum + a `recipe.archetype` tag. Wizard adds a **Style** archetype card grid at the
top of the Color step (`applyArchetype` patches the recipe; user fine-tunes after). Archetypes use
only existing tokens (no `@commonpub/ui` change), which is why **glass/frosted is deferred** (needs
component `backdrop-filter`/treatment-token support).

Tests: theme-studio 68 (+8), schema 443, ui 268 (+3), layer 937 (+5: archetype/neutral wiring +
radius). Typecheck 28/28, full build green.

## Deferred (next increments)
- **Phase 4 — color-UX redesign:** palette-option cards (one accent → several harmonized options),
  a real HSL picker (replace the native swatch), an A11y contrast matrix.
- Full per-component radius migration (kills inner-section wedge-gaps on rounded themes).
- Glass/frosted archetype + treatment tokens (`backdrop-blur`, `border-style`, surface gradient) +
  the component support to render them.
- The contest per-stage-submissions epic (separate plan).

## Open questions / next steps
- Worth a real-browser visual pass on Stoa (rounded) + a Brutalist/Editorial/Soft/Terminal theme to
  confirm they look genuinely distinct.
