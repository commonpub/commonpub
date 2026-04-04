/**
 * Shared theme family configuration.
 * Used by both server (instanceTheme.ts) and client (useTheme.ts).
 *
 * To add a new theme:
 * 1. Create the CSS file(s) in packages/ui/theme/
 * 2. Register in packages/ui/src/theme.ts BUILT_IN_THEMES
 * 3. Add the family mapping here
 * 4. Add theme ID to VALID_IDS in server/utils/instanceTheme.ts
 * 5. Add CSS import in layers/base/nuxt.config.ts
 */

/** Map every theme ID to its family name */
export const THEME_TO_FAMILY: Record<string, string> = {
  base: 'classic',
  dark: 'classic',
  generics: 'generics',
  agora: 'agora',
  'agora-dark': 'agora',
};

/** Light/dark variants for each family */
export const FAMILY_VARIANTS: Record<string, { light: string; dark: string }> = {
  classic: { light: 'base', dark: 'dark' },
  agora: { light: 'agora', dark: 'agora-dark' },
  generics: { light: 'generics', dark: 'generics' },
};

/** Whether a theme ID is a dark theme */
export const IS_DARK: Record<string, boolean> = {
  base: false,
  dark: true,
  generics: true,
  agora: false,
  'agora-dark': true,
};

/** All valid theme IDs */
export const VALID_THEME_IDS = new Set(Object.keys(THEME_TO_FAMILY));
