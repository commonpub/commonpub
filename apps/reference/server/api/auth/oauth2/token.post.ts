import { processTokenExchange } from '@commonpub/server';
import { z } from 'zod';

const tokenSchema = z.object({
  grant_type: z.string(),
  code: z.string(),
  client_id: z.string(),
  client_secret: z.string(),
  redirect_uri: z.string().url(),
});

/**
 * OAuth2 token endpoint.
 * Exchanges authorization code for access token + user info.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, tokenSchema);

  const result = await processTokenExchange(
    db,
    {
      grantType: input.grant_type,
      code: input.code,
      clientId: input.client_id,
      clientSecret: input.client_secret,
      redirectUri: input.redirect_uri,
    },
    config.instance.domain,
  );

  if ('error' in result) {
    throw createError({
      statusCode: 400,
      statusMessage: result.errorDescription,
      data: { error: result.error },
    });
  }

  return {
    access_token: result.accessToken,
    token_type: result.tokenType,
    expires_in: result.expiresIn,
    user: result.user,
  };
});
