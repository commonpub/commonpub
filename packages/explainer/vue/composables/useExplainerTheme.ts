import { watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { ExplainerThemePreset, ExplainerThemeRef, ExplainerThemeTokens } from '@commonpub/explainer';
import { resolveThemePreset, resolveThemeOverrides } from '@commonpub/explainer';

/** Google Fonts import URLs per theme preset */
const FONT_URLS: Record<ExplainerThemePreset, string> = {
  'dark-industrial': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'punk-zine': 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Special+Elite&family=VT323&display=swap',
  'paper-teal': 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
  'clean-light': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap',
};

export function useExplainerTheme(
  theme: Ref<ExplainerThemeRef> | ComputedRef<ExplainerThemeRef>,
  rootEl: Ref<HTMLElement | null>,
) {
  let presetFontLink: HTMLLinkElement | null = null;
  let customFontLink: HTMLLinkElement | null = null;
  const appliedOverrides: Set<string> = new Set();

  function applyTheme(themeRef: ExplainerThemeRef): void {
    if (typeof window === 'undefined') return; // SSR guard
    const el = rootEl.value;
    if (!el) return;

    const preset = resolveThemePreset(themeRef);
    const overrides = resolveThemeOverrides(themeRef);

    // 1. Set data attribute for preset CSS variables
    el.setAttribute('data-explainer-theme', preset);

    // 2. Load preset fonts
    const presetUrl = FONT_URLS[preset];
    if (presetUrl) {
      if (presetFontLink) {
        presetFontLink.href = presetUrl;
      } else {
        presetFontLink = document.createElement('link');
        presetFontLink.rel = 'stylesheet';
        presetFontLink.href = presetUrl;
        presetFontLink.setAttribute('data-explainer-fonts', 'preset');
        document.head.appendChild(presetFontLink);
      }
    }

    // 3. Clear previously applied overrides
    for (const key of appliedOverrides) {
      el.style.removeProperty(`--${key}`);
    }
    appliedOverrides.clear();

    // 4. Apply custom overrides as inline CSS properties
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined && value !== '') {
        el.style.setProperty(`--${key}`, value);
        appliedOverrides.add(key);
      }
    }

    // 5. Handle custom font-import override
    const customFontUrl = overrides['font-import'];
    if (customFontUrl) {
      if (customFontLink) {
        customFontLink.href = customFontUrl;
      } else {
        customFontLink = document.createElement('link');
        customFontLink.rel = 'stylesheet';
        customFontLink.href = customFontUrl;
        customFontLink.setAttribute('data-explainer-fonts', 'custom');
        document.head.appendChild(customFontLink);
      }
    } else if (customFontLink) {
      customFontLink.parentNode?.removeChild(customFontLink);
      customFontLink = null;
    }
  }

  // Watch theme changes (deep for object overrides)
  watch(theme, applyTheme, { immediate: true, deep: true });

  // Re-apply when root element becomes available
  watch(rootEl, () => {
    if (rootEl.value) applyTheme(theme.value);
  });

  onUnmounted(() => {
    if (presetFontLink?.parentNode) presetFontLink.parentNode.removeChild(presetFontLink);
    if (customFontLink?.parentNode) customFontLink.parentNode.removeChild(customFontLink);
    presetFontLink = null;
    customFontLink = null;
  });

  return { theme };
}
