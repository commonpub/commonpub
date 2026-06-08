/**
 * PUT /api/admin/themes/[id]
 *
 * Update an existing custom theme. The ID is taken from the URL — any `id`
 * in the body must match. 404 if the theme doesn't exist.
 */
import { customThemeSchema } from '@commonpub/schema';
import { getCustomTheme, saveCustomTheme } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  const admin = requirePermission(event, 'theme.manage');
  const db = useDB();

  const { id } = parseParams(event, { id: 'string' });
  const input = await parseBody(event, customThemeSchema);

  if (input.id !== id) {
    throw createError({ statusCode: 400, statusMessage: 'URL id does not match body id' });
  }

  const existing = await getCustomTheme(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Theme not found' });
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
      recipe: input.recipe,
      fonts: input.fonts,
      createdAt: existing.createdAt,
    },
    admin.id,
  );

  invalidateThemeCache();
  return saved;
});
