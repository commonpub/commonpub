// Theme plugin — resolves theme on server (zero flash) and hydrates on client.
//
// The admin picks the instance theme (family + default mode + custom theme tokens).
// Users only toggle light/dark. Server middleware resolves the final theme ID and
// the inline CSS to inject. This plugin sets data-theme on <html> and forwards
// the inline `<style>` so first paint has the correct tokens.

export default defineNuxtPlugin(() => {
  const themeId = useState<string>('cpub-theme', () => 'base');
  const instanceTheme = useState<string>('cpub-instance-theme', () => 'base');
  const isDark = useState<boolean>('cpub-dark-mode', () => false);
  const themeInlineCss = useState<string>('cpub-theme-inline-css', () => '');
  const themeFontHref = useState<string>('cpub-theme-font-href', () => '');
  // Light/dark attrs of a custom pair — lets the user toggle flip data-theme
  // instantly client-side (both variants' tokens are injected below).
  const themePair = useState<{ lightAttr: string; darkAttr: string } | null>('cpub-theme-pair', () => null);

  if (import.meta.server) {
    const event = useRequestEvent();
    if (event?.context) {
      themeId.value = event.context.resolvedTheme ?? 'base';
      instanceTheme.value = event.context.instanceTheme ?? 'base';
      isDark.value = event.context.isDarkMode ?? false;
      themeInlineCss.value = event.context.themeInlineCss ?? '';
      themeFontHref.value = event.context.themeFontHref ?? '';
      themePair.value = event.context.themePair ?? null;
    }
  }

  if (import.meta.client) {
    // One-time migration: clear old localStorage theme (replaced by server-side resolution)
    localStorage.removeItem('cpub-theme');
  }

  // Set data-theme on <html> during SSR — first paint has the correct theme.
  // The inline style is rendered just before </head> via useHead so it loads
  // after the theme CSS files (cascade wins on equal specificity).
  const head: Parameters<typeof useHead>[0] = {};
  if (themeId.value && themeId.value !== 'base') {
    head.htmlAttrs = { 'data-theme': themeId.value };
  }
  if (themeInlineCss.value) {
    // `key` lets Nuxt dedupe + replace this exact tag on navigation if the
    // theme changes mid-session (e.g. admin saves while editing).
    head.style = [{
      key: 'cpub-theme-inline',
      innerHTML: themeInlineCss.value,
      tagPosition: 'head',
      // hid id helps the editor's preview replace it without dupes
      id: 'cpub-theme-inline',
    }];
  }
  if (themeFontHref.value) {
    // Load the active custom theme's Google Fonts (theme-studio). CSP in
    // server/middleware/security.ts already allows fonts.googleapis.com.
    head.link = [{
      key: 'cpub-theme-fonts',
      rel: 'stylesheet',
      href: themeFontHref.value,
      id: 'cpub-theme-fonts',
    }];
  }
  if (Object.keys(head).length > 0) {
    useHead(head);
  }
});
