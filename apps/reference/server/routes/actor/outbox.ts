/**
 * Instance actor outbox collection.
 * Returns an empty ordered collection — instance-level content
 * is federated via user actors, not the instance actor directly.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const domain = config.instance.domain;
  const actorUri = `https://${domain}/actor`;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${actorUri}/outbox`,
    type: 'OrderedCollection',
    totalItems: 0,
    orderedItems: [],
  };
});
