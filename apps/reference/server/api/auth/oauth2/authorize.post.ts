import { processAuthorize } from '@commonpub/server';
import { z } from 'zod';

const authorizeSchema = z.object({
  clientId: z.string(),
  redirectUri: z.string().url(),
  responseType: z.string(),
  scope: z.string().optional(),
  state: z.string().optional(),
});

/**
 * OAuth2 authorize endpoint (POST).
 * Called when user approves the consent screen.
 * Generates auth code and returns redirect URL.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, authorizeSchema);

  const result = await processAuthorize(
    db,
    {
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      responseType: input.responseType,
      scope: input.scope,
      state: input.state,
    },
    user.id,
    config.instance.domain,
  );

  if ('error' in result) {
    throw createError({
      statusCode: 400,
      statusMessage: result.errorDescription,
      data: { error: result.error },
    });
  }

  // Build redirect URL with code and state
  const redirectUrl = new URL(result.redirectUri);
  redirectUrl.searchParams.set('code', result.code);
  if (result.state) redirectUrl.searchParams.set('state', result.state);

  return { redirectUrl: redirectUrl.toString() };
});
