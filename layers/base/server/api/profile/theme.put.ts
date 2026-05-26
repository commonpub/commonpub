import { setUserTheme } from '@commonpub/server';
import { z } from 'zod';

// Permissive length: `cpub-custom-<slug>` can be longer than 32 chars.
const themeSchema = z.object({
  themeId: z.string().min(1).max(96).regex(/^[a-z0-9][a-z0-9_-]*$/i),
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
