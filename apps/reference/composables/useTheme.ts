import { ref } from 'vue';
import { applyThemeToElement, isValidThemeId } from '@commonpub/ui';

export function useTheme(): {
  themeId: Ref<string>;
  setTheme: (id: string) => void;
} {
  const themeId = ref('base');

  function setTheme(id: string): void {
    if (isValidThemeId(id)) {
      themeId.value = id;
      if (import.meta.client) {
        applyThemeToElement(document.documentElement, id);
      }
    }
  }

  return { themeId, setTheme };
}
