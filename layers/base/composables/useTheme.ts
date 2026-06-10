import { applyThemeToElement } from '@commonpub/ui';
import { THEME_TO_FAMILY, FAMILY_VARIANTS } from '../utils/themeConfig';

/**
 * Theme composable — SSR-safe, server-resolved.
 *
 * The admin picks the instance theme (via admin panel). Users only toggle
 * between light and dark mode within that theme's family. The server middleware
 * resolves the correct theme on every request — no theme-selection cookie needed.
 *
 * The dark mode preference cookie (`cpub-color-scheme`) is an ESSENTIAL
 * preference cookie (set only by the user pressing the toggle, no
 * identifier) — always persisted, no consent gate. It used to be gated on
 * functional consent, which silently dropped the preference on refresh for
 * anyone who chose "Essential only".
 *
 * Custom themes (`cpub-custom-*`) and code-registered themes pass through —
 * the user's cookie toggle is recorded but the server picks the actual variant
 * using the custom theme's `pairId` (if declared). For built-in family pairs,
 * the variant flip happens client-side immediately for snappy UX.
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
  const themePair = useState<{ lightAttr: string; darkAttr: string } | null>('cpub-theme-pair', () => null);
  const schemeCookie = useCookie('cpub-color-scheme', {
    maxAge: 31536000,
    path: '/',
    sameSite: 'lax',
  });
  function setDarkMode(dark: boolean): void {
    isDark.value = dark;

    // Always persist — pressing the toggle IS the consent for this
    // preference cookie (registered as essential in useCookieConsent).
    schemeCookie.value = dark ? 'dark' : 'light';

    // Custom light/dark PAIR: both variants' tokens are injected (scoped to
    // their data-theme attr), so flip the attribute client-side for an instant
    // switch — exactly like built-in families. (This is the fix for "the site
    // light/dark toggle didn't switch a custom theme".)
    if (themePair.value) {
      const newTheme = dark ? themePair.value.darkAttr : themePair.value.lightAttr;
      themeId.value = newTheme;
      if (import.meta.client) {
        document.documentElement.setAttribute('data-theme', newTheme);
        $fetch('/api/profile/theme', { method: 'PUT', body: { themeId: newTheme } }).catch(() => {});
      }
      return;
    }

    // Built-in family flip is purely client-side for snappy UX.
    if (THEME_TO_FAMILY[instanceDefault.value]) {
      const family = THEME_TO_FAMILY[instanceDefault.value]!;
      const variants = FAMILY_VARIANTS[family] ?? FAMILY_VARIANTS.classic!;
      const newTheme = dark ? variants.dark : variants.light;
      themeId.value = newTheme;

      if (import.meta.client) {
        applyThemeToElement(document.documentElement, newTheme);
        $fetch('/api/profile/theme', {
          method: 'PUT',
          body: { themeId: newTheme },
        }).catch(() => {});
      }
    } else if (import.meta.client) {
      // Single custom / registered theme with no pair: persist preference only;
      // the server picks any declared variant on the next request.
      $fetch('/api/profile/theme', {
        method: 'PUT',
        body: { themeId: instanceDefault.value },
      }).catch(() => {});
    }
  }

  return { themeId, isDark, instanceDefault, setDarkMode };
}
