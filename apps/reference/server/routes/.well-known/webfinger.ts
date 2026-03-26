// WebFinger endpoint — RFC 7033
import { parseWebFingerResource, buildWebFingerResponse } from '@commonpub/protocol';
import { getUserByUsername } from '@commonpub/server';

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

  // Instance actor lookup: acct:domain@domain → /actor Service
  if (parsed.username === instanceDomain || parsed.username === config.instance.domain) {
    const actorUri = `https://${instanceDomain}/actor`;
    setResponseHeader(event, 'content-type', 'application/jrd+json');
    return buildWebFingerResponse({
      username: instanceDomain,
      domain: instanceDomain,
      actorUri,
    });
  }

  // Look up user in database
  const db = useDB();
  const profile = await getUserByUsername(db, parsed.username);
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
    oauthEndpoint: `https://${instanceDomain}/api/auth/oauth2/authorize`,
  });
});
