/**
 * Client-side type shapes for the admin theme system.
 *
 * Server-side equivalents live in `@commonpub/server` (`CustomThemeRecord`)
 * and `@commonpub/config` (`RegisteredTheme`). Duplicating them here lets
 * the admin UI consume the `/api/admin/themes` payload without pulling
 * Node-only server modules into the browser bundle.
 */
import type { ThemeDefinition } from '@commonpub/ui';

export interface CustomThemeRecord {
  id: string;
  name: string;
  description?: string;
  family: string;
  isDark: boolean;
  pairId?: string;
  parentTheme: string;
  tokens: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredThemeRecord {
  id: string;
  name: string;
  description?: string;
  family: string;
  isDark: boolean;
  pairId?: string;
  preview?: { bg?: string; surface?: string; accent?: string; text?: string; border?: string };
}

/** Response shape of GET /api/admin/themes. */
export interface ThemesPayload {
  builtIn: ThemeDefinition[];
  registered: RegisteredThemeRecord[];
  custom: CustomThemeRecord[];
}

export interface ThemeFamilyView {
  /** Family slug — `classic`, `agora`, `deveco`, etc. */
  id: string;
  name: string;
  description: string;
  /** Which source produced this family. Custom > registered > built-in. */
  source: 'builtin' | 'registered' | 'custom';
  light: { id: string; name: string } | null;
  dark: { id: string; name: string } | null;
  preview: {
    light: { bg: string; surface: string; accent: string; text: string; border: string };
    dark: { bg: string; surface: string; accent: string; text: string; border: string };
  };
}
