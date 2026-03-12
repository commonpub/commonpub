import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateAuthorizeRequest } from '@commonpub/protocol';
import { eq } from 'drizzle-orm';
import { oauthClients } from '@commonpub/schema';
import { randomUUID } from 'node:crypto';
import { storeAuthCode } from '$lib/server/oauthCodes';

/** OAuth2 Authorization Endpoint — Provider side
 * Validates the authorize request and redirects back with an authorization code.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.config.features.federation) {
    return json({ error: 'Federation is not enabled' }, { status: 404 });
  }

  if (!locals.user) {
    // Redirect to sign in, then back here
    const returnUrl = url.toString();
    redirect(303, `/auth/sign-in?redirect=${encodeURIComponent(returnUrl)}`);
  }

  const clientId = url.searchParams.get('client_id') ?? '';
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const responseType = url.searchParams.get('response_type') ?? '';
  const scope = url.searchParams.get('scope') ?? undefined;
  const state = url.searchParams.get('state') ?? undefined;

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

  const validationError = validateAuthorizeRequest(
    { clientId, redirectUri, responseType, scope, state },
    client,
  );

  if (validationError) {
    return json(validationError, { status: 400 });
  }

  // Generate and store authorization code
  const code = randomUUID();
  await storeAuthCode(locals.db, code, locals.user.id, clientId, redirectUri);

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  redirect(302, redirectUrl.toString());
};
