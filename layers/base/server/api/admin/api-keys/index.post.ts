import { createApiKey, createAuditEntry, effectiveRecipients } from '@commonpub/server';
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
  requireFeature('publicApi');
  const user = requirePermission(event, 'apikeys.manage');
  const body = await readBody(event);
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() });
  }

  const db = useDB();

  // A recipient binding is only useful if it resolves. The directory route
  // returns 403 for a binding that names nobody, so a key created against a
  // typo would sit in the admin list looking healthy and reading nothing
  // forever. Refuse it here, while the operator is still on the screen.
  if (parsed.data.recipientId) {
    const recipients = await effectiveRecipients(db, useConfig());
    if (!recipients.some((r) => r.id === parsed.data.recipientId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Unknown recipient',
        data: {
          errors: {
            recipientId: [
              'This instance does not declare a recipient with that id. Add it under Data Sharing first.',
            ],
          },
        },
      });
    }
  }

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
      // Which named party this key discloses members to. A `read:members` key is
      // the only key on the instance that returns identified people, and the
      // recipient is the thing that makes each disclosure attributable, so the
      // audit row that records the key must record the party too. Null for every
      // other key, which is most of them.
      recipientId: result.key.recipientId ?? null,
    },
  }).catch(() => { /* audit is best-effort; never fail the create */ });

  return result;
});
