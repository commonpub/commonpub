// Resolves the active theme for SSR and injects it into the event context.
// Runs before page rendering so the theme plugin can set data-theme on <html>.
//
// Admin picks instance theme → user only toggles light/dark → server resolves.

declare module 'h3' {
  interface H3EventContext {
    /** Final resolved theme ID for this request */
    resolvedTheme: string;
    /** The admin-configured instance default theme */
    instanceTheme: string;
    /** Whether the resolved theme is dark */
    isDarkMode: boolean;
  }
}

export default defineEventHandler(async (event) => {
  // Only resolve theme for SSR page requests — skip API, assets, and internal routes
  const path = getRequestURL(event).pathname;
  if (path.startsWith('/api') || path.startsWith('/_nuxt') || path.startsWith('/__nuxt')) return;

  const instanceTheme = await getInstanceDefaultTheme();
  event.context.instanceTheme = instanceTheme;

  // Read user's light/dark preference from cookie
  const schemeCookie = getCookie(event, 'cpub-color-scheme');
  const userScheme = schemeCookie === 'light' || schemeCookie === 'dark'
    ? schemeCookie
    : null;

  const resolved = resolveThemeForUser(instanceTheme, userScheme);
  event.context.resolvedTheme = resolved;
  event.context.isDarkMode = isDefaultDark(resolved);
});
