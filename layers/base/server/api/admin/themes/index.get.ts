/**
 * GET /api/admin/themes
 *
 * Returns the unified list of themes available to the admin theme picker:
 *
 *   { builtIn: ThemeDefinition[], registered: RegisteredTheme[], custom: CustomThemeRecord[] }
 *
 * - `builtIn` is hard-coded in @commonpub/ui (BUILT_IN_THEMES)
 * - `registered` comes from `commonpub.config.ts` themes[] (the thin layer
 *   app declares its own theme here)
 * - `custom` is the DB-stored editable themes
 *
 * The client merges these three sources into the family-grouped picker.
 */
import { BUILT_IN_THEMES } from '@commonpub/ui';
import { listCustomThemes } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requirePermission(event, 'theme.manage');
  const db = useDB();
  const config = useConfig();

  const custom = await listCustomThemes(db);
  const registered = ((config as unknown as { themes?: unknown }).themes ?? []) as Array<{
    id: string;
    name: string;
    description?: string;
    family: string;
    isDark: boolean;
    pairId?: string;
    preview?: Record<string, string>;
  }>;

  return {
    builtIn: BUILT_IN_THEMES,
    registered,
    custom,
  };
});
