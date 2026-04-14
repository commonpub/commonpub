import { setUserTheme } from '@commonpub/server';
import { z } from 'zod';

const themeSchema = z.object({
  themeId: z.string().min(1).max(32),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const db = useDB();
  const user = requireAuth(event);
  const { themeId } = await parseBody(event, themeSchema);

  try {
    await setUserTheme(db, user.id, themeId);
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: err instanceof Error ? err.message : 'Invalid theme',
    });
  }

  return { success: true };
});
