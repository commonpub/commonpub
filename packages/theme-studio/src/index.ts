/**
 * @commonpub/theme-studio — a framework-agnostic theme generator.
 *
 * Derive a complete, WCAG-checked CommonPub design system (a custom-theme
 * token override map) from a small `ThemeRecipe`. Pure functions, no DOM,
 * no Vue — consumed by the admin "Studio" wizard and reusable anywhere.
 *
 *   import { recipeToTokens, randomizeRecipe } from '@commonpub/theme-studio';
 *   const { tokens, fonts, parentTheme } = recipeToTokens(randomizeRecipe(42));
 */
export * from './color.js';
export * from './harmony.js';
export * from './naming.js';
export * from './palette.js';
export * from './scales.js';
export * from './fonts.js';
export * from './presets.js';
export * from './recipe.js';
export * from './generate.js';
export * from './export.js';
