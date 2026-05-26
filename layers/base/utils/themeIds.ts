/**
 * Custom-theme ID helpers. Mirrors `CUSTOM_THEME_PREFIX` + `parseCustomThemeId`
 * in `@commonpub/server` — duplicated because the server module is Node-only
 * (it imports `drizzle-orm` and `@commonpub/schema`), so the browser bundle
 * can't pull from it.
 *
 * **CONTRACT**: any change to the prefix here MUST also change the matching
 * constant in `packages/server/src/theme.ts`. Both are pinned by the
 * `custom-themes.integration.test.ts` round-trip test.
 */

export const CUSTOM_THEME_PREFIX = 'cpub-custom-';

/** Returns the raw custom theme ID for `cpub-custom-foo` → `foo`, or null. */
export function parseCustomThemeId(themeId: string): string | null {
  if (themeId.startsWith(CUSTOM_THEME_PREFIX)) {
    return themeId.slice(CUSTOM_THEME_PREFIX.length);
  }
  return null;
}

/** The data-theme attribute value for a DB-stored custom theme. */
export function customThemeDataAttr(id: string): string {
  return `${CUSTOM_THEME_PREFIX}${id}`;
}
