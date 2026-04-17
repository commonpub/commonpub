import { createApiKey } from '@commonpub/server';
import { createApiKeySchema } from '@commonpub/schema';

/**
 * POST /api/admin/api-keys
 *
 * Creates a new public API key. The full token is returned ONCE in the
 * response body — the UI displays it with a "copy now, you won't see it
 * again" warning. Server-side we only keep the SHA-256 hash.
 */
export default defineEventHandler(async (event) => {
  const user = requireAdmin(event);
  const body = await readBody(event);
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() });
  }

  const db = useDB();
  const result = await createApiKey(db, user.id, parsed.data);
  return result;
});
