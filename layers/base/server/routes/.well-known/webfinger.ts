// WebFinger endpoint — RFC 7033
import { parseWebFingerResource, buildWebFingerResponse } from '@commonpub/protocol';
import { getUserByUsername, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const resource = query.resource as string | undefined;

  if (!resource) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing resource parameter',
    });
  }

  const parsed = parseWebFingerResource(resource);
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid resource format. Expected acct:user@domain',
    });
  }

  const requestUrl = getRequestURL(event);
  const instanceDomain = requestUrl.host;

  if (parsed.domain !== instanceDomain) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Resource not found on this instance',
    });
  }

  const config = useConfig();

  // CORS — WebFinger must be accessible from browser-based AP clients
  setResponseHeader(event, 'access-control-allow-origin', '*');

  // Instance actor lookup: acct:domain@domain or acct:instance@domain → /actor Service
  if (parsed.username === instanceDomain || parsed.username === config.instance.domain || parsed.username === 'instance') {
    const actorUri = `https://${instanceDomain}/actor`;
    setResponseHeader(event, 'content-type', 'application/jrd+json');
    return buildWebFingerResponse({
      username: instanceDomain,
      domain: instanceDomain,
      actorUri,
      oauthEndpoint: `https://${instanceDomain}/auth/oauth/authorize`,
    });
  }

  // Look up user in database
  const db = useDB();
  const profile = await getUserByUsername(db, parsed.username);

  // If not a user, try hub lookup (Group actor)
  if (!profile && config.features.federation && config.features.federateHubs) {
    const hub = await getHubBySlug(db, parsed.username);
    if (hub) {
      const hubActorUri = `https://${instanceDomain}/hubs/${parsed.username}`;
      setResponseHeader(event, 'content-type', 'application/jrd+json');
      return buildWebFingerResponse({
        username: parsed.username,
        domain: instanceDomain,
        actorUri: hubActorUri,
      });
    }
  }

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    });
  }

  const actorUri = `https://${instanceDomain}/users/${parsed.username}`;

  setResponseHeader(event, 'content-type', 'application/jrd+json');

  return buildWebFingerResponse({
    username: parsed.username,
    domain: instanceDomain,
    actorUri,
    oauthEndpoint: `https://${instanceDomain}/auth/oauth/authorize`,
  });
});
