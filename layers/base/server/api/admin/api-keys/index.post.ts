import { createApiKey, createAuditEntry } from '@commonpub/server';
import { createApiKeySchema } from '@commonpub/schema';

/**
 * POST /api/admin/api-keys
 *
 * Creates a new public API key. The full token is returned ONCE in the
 * response body — the UI displays it with a "copy now, you won't see it
 * again" warning. Server-side we only keep the SHA-256 hash.
 *
 * Audit: issuance of an API key is a sensitive change to the instance's
 * external access surface, so we always write an auditLogs row. The token
 * itself is NEVER logged — only the id, name, scopes, and (optional) expiry
 * land in the metadata column.
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

  await createAuditEntry(db, {
    userId: user.id,
    action: 'api_key.create',
    targetType: 'api_key',
    targetId: result.key.id,
    metadata: {
      name: result.key.name,
      scopes: result.key.scopes,
      expiresAt: result.key.expiresAt,
      rateLimitPerMinute: result.key.rateLimitPerMinute,
    },
  }).catch(() => { /* audit is best-effort; never fail the create */ });

  return result;
});
