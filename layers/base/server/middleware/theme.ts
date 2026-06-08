// Resolves the active theme for SSR and injects it into the event context.
// Runs before page rendering so the theme plugin can set data-theme on <html>
// and inject inline token styles for custom/code-registered themes.

import { tokensToCss } from '@commonpub/ui';

declare module 'h3' {
  interface H3EventContext {
    /** Final resolved theme ID for this request (data-theme attr value) */
    resolvedTheme: string;
    /** The admin-configured instance default theme */
    instanceTheme: string;
    /** Whether the resolved theme is dark */
    isDarkMode: boolean;
    /** Inline CSS string to inject (custom theme tokens + instance overrides). Empty if none. */
    themeInlineCss: string;
    /** Google Fonts stylesheet URL for the active custom theme's fonts. Empty if none. */
    themeFontHref: string;
    /** Light/dark data-theme attrs of a custom pair (for the client toggle). */
    themePair: { lightAttr: string; darkAttr: string } | null;
  }
}

export default defineEventHandler(async (event) => {
  // Only resolve theme for SSR page requests — skip API, assets, and internal routes
  const path = getRequestURL(event).pathname;
  if (path.startsWith('/api') || path.startsWith('/_nuxt') || path.startsWith('/__nuxt')) return;

  // Collect IDs of code-registered themes so we accept them as valid
  const config = useConfig() as unknown as { themes?: Array<{ id: string }> };
  const registeredIds = new Set((config.themes ?? []).map((t) => t.id));

  // Read user's light/dark preference from cookie
  const schemeCookie = getCookie(event, 'cpub-color-scheme');
  const userScheme = schemeCookie === 'light' || schemeCookie === 'dark'
    ? schemeCookie
    : null;

  const ctx = await resolveThemeContext(userScheme, registeredIds);

  event.context.instanceTheme = ctx.instanceTheme;
  event.context.resolvedTheme = ctx.resolvedTheme;
  event.context.isDarkMode = ctx.isDark;

  // Build the inline style block.
  //  - Custom theme(s): one block per variant, scoped to its `[data-theme]`
  //    attr, with instance overrides merged in (so overrides win + apply in
  //    every mode). A light/dark PAIR injects BOTH, so the client toggle can
  //    flip `data-theme` and switch instantly — no server round-trip.
  //  - Built-in / registered: only instance overrides at `:root` (their CSS
  //    files already handle light/dark).
  if (ctx.themeVariants.length > 0) {
    event.context.themeInlineCss = ctx.themeVariants
      .map((v) => tokensToCss(`:root[data-theme="${v.attr}"]`, { ...v.tokens, ...ctx.overrides }))
      .filter(Boolean)
      .join('\n');
  } else {
    event.context.themeInlineCss = Object.keys(ctx.overrides).length > 0
      ? tokensToCss(':root', ctx.overrides)
      : '';
  }

  // Google Fonts for the active custom theme (CSP already allows googleapis).
  event.context.themeFontHref = ctx.fontHref;
  event.context.themePair = ctx.pair;
});
