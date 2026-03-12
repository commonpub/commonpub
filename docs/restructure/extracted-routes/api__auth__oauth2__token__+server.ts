import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateTokenRequest } from '@commonpub/protocol';
import { eq } from 'drizzle-orm';
import { oauthClients } from '@commonpub/schema';
import { randomUUID } from 'node:crypto';
import { consumeAuthCode } from '$lib/server/oauthCodes';

/** OAuth2 Token Endpoint — Provider side
 * Exchanges an authorization code for an access token.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.federation) {
    return json({ error: 'Federation is not enabled' }, { status: 404 });
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    // Try form-encoded
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return json(
        { error: 'invalid_request', error_description: 'Invalid request body' },
        { status: 400 },
      );
    }
    body = Object.fromEntries(formData) as Record<string, string>;
  }

  const grantType = body.grant_type ?? body.grantType ?? '';
  const code = body.code ?? '';
  const clientId = body.client_id ?? body.clientId ?? '';
  const clientSecret = body.client_secret ?? body.clientSecret ?? '';
  const redirectUri = body.redirect_uri ?? body.redirectUri ?? '';

  // Look up client
  const clients = await locals.db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);

  const client = clients[0]
    ? {
        clientId: clients[0].clientId,
        clientSecret: clients[0].clientSecret,
        redirectUris: clients[0].redirectUris,
        instanceDomain: clients[0].instanceDomain,
      }
    : null;

  const validationError = validateTokenRequest(
    { grantType, code, clientId, clientSecret, redirectUri },
    client,
  );

  if (validationError) {
    return json(
      { error: validationError.error, error_description: validationError.errorDescription },
      { status: 400 },
    );
  }

  // Verify authorization code
  const codeResult = await consumeAuthCode(locals.db, code, clientId, redirectUri);
  if (!codeResult) {
    return json(
      { error: 'invalid_grant', error_description: 'Invalid, expired, or already-used authorization code' },
      { status: 400 },
    );
  }

  const accessToken = randomUUID();

  return json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'read',
  });
};
