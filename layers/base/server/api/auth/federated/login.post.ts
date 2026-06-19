import { discoverOAuthEndpoint } from '@commonpub/auth';
import { storeOAuthState, isDomainTrusted, createSafeActorFetchFn } from '@commonpub/server';
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

  const trusted = await isDomainTrusted(db, config, instanceDomain);
  if (!trusted) {
    throw createError({
      statusCode: 403,
      statusMessage: `Instance ${instanceDomain} is not in the trusted instances list`,
    });
  }

  // SSRF-safe fetch (pinned dispatcher): even a trusted domain's WebFinger/registration
  // response must not be able to drive a request to an internal address (audit session 204).
  const safeFetch = createSafeActorFetchFn();
  const endpoints = await discoverOAuthEndpoint(instanceDomain, 'instance', safeFetch as unknown as typeof fetch);
  if (!endpoints) {
    throw createError({
      statusCode: 502,
      statusMessage: `Could not discover OAuth endpoints for ${instanceDomain}`,
    });
  }

  const redirectUri = `https://${config.instance.domain}/api/auth/federated/callback`;
  let effectiveClientId = clientId ?? `cpub_${config.instance.domain}`;
  let effectiveClientSecret = clientSecret ?? '';

  // Auto-register as a dynamic client if no explicit credentials provided
  if (!clientId) {
    try {
      const regUrl = endpoints.tokenEndpoint.replace('/token', '/register');
      // regUrl is derived from the remote's discovery response — route the POST through
      // the SSRF-safe fetch so it can't be pointed at an internal address.
      const regRes = await safeFetch(regUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_name: config.instance.name || config.instance.domain,
          redirect_uris: [redirectUri],
          client_uri: `https://${config.instance.domain}`,
          instance_domain: config.instance.domain,
        }),
      });
      const regResult = (await regRes.json()) as { client_id: string; client_secret: string };
      effectiveClientId = regResult.client_id;
      effectiveClientSecret = regResult.client_secret;
    } catch {
      // Registration failed — proceed with default client ID (may fail at authorize step)
    }
  }

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
