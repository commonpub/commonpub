import { getOrCreateInstanceKeypair, buildInstanceActor } from '@commonpub/server';

/**
 * Instance actor endpoint — returns the AP Service object for this instance.
 * Used by other instances for mirroring (Follow the instance actor to receive all content).
 * Content-negotiated: AP clients get JSON-LD, browsers get redirected to /about.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  if (!isAPRequest) {
    // Browser request — redirect to about page
    return sendRedirect(event, '/about', 302);
  }

  const db = useDB();
  const { publicKeyPem } = await getOrCreateInstanceKeypair(db);
  const actor = buildInstanceActor(config.instance.domain, publicKeyPem);

  setResponseHeader(event, 'content-type', 'application/activity+json');
  return actor;
});
