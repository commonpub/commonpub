import { applyThemeToElement, isValidThemeId } from '@commonpub/ui';

const STORAGE_KEY = 'cpub-theme';

export function useTheme(): {
  themeId: Ref<string>;
  setTheme: (id: string) => void;
} {
  // Use useState so SSR and client agree on 'base' initially
  const themeId = useState('cpub-theme', () => 'base');

  // On client mount, read persisted theme and apply if different
  if (import.meta.client) {
    onMounted(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidThemeId(stored) && stored !== themeId.value) {
        themeId.value = stored;
        applyThemeToElement(document.documentElement, stored);
      }
    });
  }

  function setTheme(id: string): void {
    if (isValidThemeId(id)) {
      themeId.value = id;
      if (import.meta.client) {
        applyThemeToElement(document.documentElement, id);
        localStorage.setItem(STORAGE_KEY, id);
      }
    }
  }

  return { themeId, setTheme };
}
