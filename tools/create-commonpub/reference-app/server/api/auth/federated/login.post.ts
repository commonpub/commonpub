import { discoverOAuthEndpoint, isTrustedInstance } from '@commonpub/auth';
import { storeOAuthState } from '@commonpub/server';
import { z } from 'zod';

const loginSchema = z.object({
  instanceDomain: z.string().min(3).max(255),
  /** Client credentials — in production these come from admin-registered clients */
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

/**
 * Initiate federated login. Discovers OAuth endpoints via WebFinger,
 * stores state for callback, returns authorization URL.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const config = useConfig();
  const db = useDB();
  const { instanceDomain, clientId, clientSecret } = await parseBody(event, loginSchema);

  if (!isTrustedInstance(config, instanceDomain)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Instance ${instanceDomain} is not in the trusted instances list`,
    });
  }

  const endpoints = await discoverOAuthEndpoint(instanceDomain, 'instance');
  if (!endpoints) {
    throw createError({
      statusCode: 502,
      statusMessage: `Could not discover OAuth endpoints for ${instanceDomain}`,
    });
  }

  const redirectUri = `https://${config.instance.domain}/api/auth/federated/callback`;
  const effectiveClientId = clientId ?? `cpub_${config.instance.domain}`;
  const effectiveClientSecret = clientSecret ?? '';

  // Store state for the callback handler
  const stateToken = await storeOAuthState(db, {
    tokenEndpoint: endpoints.tokenEndpoint,
    clientId: effectiveClientId,
    clientSecret: effectiveClientSecret,
    redirectUri,
    instanceDomain,
  });

  const authUrl = new URL(endpoints.authorizationEndpoint);
  authUrl.searchParams.set('client_id', effectiveClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', stateToken);

  return {
    authorizationUrl: authUrl.toString(),
    state: stateToken,
  };
});
