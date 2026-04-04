// Theme plugin — resolves theme on server (zero flash) and hydrates on client.
//
// The admin picks the instance theme (family + default mode).
// Users only toggle light/dark. Server middleware resolves the final theme ID.
// This plugin reads that resolved value and sets data-theme on <html>.

export default defineNuxtPlugin(() => {
  const themeId = useState<string>('cpub-theme', () => 'base');
  const instanceTheme = useState<string>('cpub-instance-theme', () => 'base');
  const isDark = useState<boolean>('cpub-dark-mode', () => false);

  if (import.meta.server) {
    const event = useRequestEvent();
    if (event?.context) {
      themeId.value = event.context.resolvedTheme ?? 'base';
      instanceTheme.value = event.context.instanceTheme ?? 'base';
      isDark.value = event.context.isDarkMode ?? false;
    }
  }

  if (import.meta.client) {
    // One-time migration: clear old localStorage theme (replaced by server-side resolution)
    localStorage.removeItem('cpub-theme');
  }

  // Set data-theme on <html> during SSR — first paint has the correct theme
  if (themeId.value && themeId.value !== 'base') {
    useHead({
      htmlAttrs: { 'data-theme': themeId.value },
    });
  }
});
