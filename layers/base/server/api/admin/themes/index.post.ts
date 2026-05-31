/**
 * POST /api/admin/themes
 *
 * Create a new custom theme. The ID must be unique (case-insensitive) among
 * built-in IDs and existing custom IDs. Returns the saved record.
 */
import { customThemeSchema } from '@commonpub/schema';
import { BUILT_IN_THEMES } from '@commonpub/ui';
import { listCustomThemes, saveCustomTheme } from '@commonpub/server';

const BUILT_IN_IDS = new Set(BUILT_IN_THEMES.map((t) => t.id));

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  const admin = requirePermission(event, 'theme.manage');
  const db = useDB();

  const input = await parseBody(event, customThemeSchema);

  if (BUILT_IN_IDS.has(input.id)) {
    throw createError({ statusCode: 409, statusMessage: `Cannot use built-in theme ID: ${input.id}` });
  }

  const existing = await listCustomThemes(db);
  if (existing.some((t) => t.id === input.id)) {
    throw createError({ statusCode: 409, statusMessage: `A custom theme with id "${input.id}" already exists` });
  }

  const saved = await saveCustomTheme(
    db,
    {
      id: input.id,
      name: input.name,
      description: input.description ?? '',
      family: input.family,
      isDark: input.isDark,
      pairId: input.pairId,
      parentTheme: input.parentTheme,
      tokens: input.tokens ?? {},
    },
    admin.id,
  );

  invalidateThemeCache();
  return saved;
});
