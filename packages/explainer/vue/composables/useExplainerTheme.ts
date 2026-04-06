import { watch, onUnmounted, type Ref } from 'vue';
import type { ExplainerThemePreset } from '@commonpub/explainer';

/** Google Fonts import URLs per theme */
const FONT_URLS: Record<ExplainerThemePreset, string> = {
  'dark-industrial': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'punk-zine': 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Special+Elite&family=VT323&display=swap',
  'paper-teal': 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
  'clean-light': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap',
};

export function useExplainerTheme(
  theme: Ref<ExplainerThemePreset>,
  rootEl: Ref<HTMLElement | null>,
) {
  let fontLink: HTMLLinkElement | null = null;

  function applyTheme(preset: ExplainerThemePreset): void {
    // Set data attribute on root element
    if (rootEl.value) {
      rootEl.value.setAttribute('data-explainer-theme', preset);
    }

    // Inject font link
    const url = FONT_URLS[preset];
    if (!url) return;

    if (fontLink) {
      fontLink.href = url;
    } else {
      fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = url;
      fontLink.setAttribute('data-explainer-fonts', 'true');
      document.head.appendChild(fontLink);
    }
  }

  watch(theme, applyTheme, { immediate: true });
  watch(rootEl, () => {
    if (rootEl.value) applyTheme(theme.value);
  });

  onUnmounted(() => {
    if (fontLink && fontLink.parentNode) {
      fontLink.parentNode.removeChild(fontLink);
      fontLink = null;
    }
  });

  return {
    theme,
    setTheme: (preset: ExplainerThemePreset) => {
      (theme as Ref<ExplainerThemePreset>).value = preset;
    },
  };
}
