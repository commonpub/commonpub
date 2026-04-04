import { applyThemeToElement } from '@commonpub/ui';
import { THEME_TO_FAMILY, FAMILY_VARIANTS } from '../utils/themeConfig';

/**
 * Theme composable — SSR-safe, server-resolved.
 *
 * The admin picks the instance theme (via admin panel). Users only toggle
 * between light and dark mode within that theme's family. The server middleware
 * resolves the correct theme on every request — no theme-selection cookie needed.
 *
 * The dark mode preference cookie (`cpub-color-scheme`) is only persisted
 * when the user has accepted functional cookies via the consent banner.
 */
export function useTheme(): {
  /** Current active theme ID (resolved from instance default + dark mode) */
  themeId: Ref<string>;
  /** Whether dark mode is active */
  isDark: Ref<boolean>;
  /** The admin-configured instance theme */
  instanceDefault: Ref<string>;
  /** Toggle dark mode — persists preference in cookie if consent given */
  setDarkMode: (dark: boolean) => void;
} {
  const themeId = useState<string>('cpub-theme', () => 'base');
  const instanceDefault = useState<string>('cpub-instance-theme', () => 'base');
  const isDark = useState<boolean>('cpub-dark-mode', () => false);
  const schemeCookie = useCookie('cpub-color-scheme', {
    maxAge: 31536000,
    path: '/',
    sameSite: 'lax',
  });
  const { allowsFunctional } = useCookieConsent();

  function setDarkMode(dark: boolean): void {
    isDark.value = dark;

    // Only persist to cookie if user consented to functional cookies
    if (allowsFunctional.value) {
      schemeCookie.value = dark ? 'dark' : 'light';
    }

    // Resolve the correct variant for this family + mode
    const family = THEME_TO_FAMILY[instanceDefault.value] ?? 'classic';
    const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.classic!;
    const newTheme = dark ? variants.dark : variants.light;

    themeId.value = newTheme;

    if (import.meta.client) {
      applyThemeToElement(document.documentElement, newTheme);
    }
  }

  return { themeId, isDark, instanceDefault, setDarkMode };
}
