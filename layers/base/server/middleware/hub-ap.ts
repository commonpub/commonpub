import { buildHubGroupActor } from '@commonpub/server';

/**
 * Middleware: serve ActivityPub Group actor JSON-LD for hub URIs.
 *
 * Matches /hubs/{slug} with AP Accept headers.
 * Non-AP requests pass through to the Nuxt page renderer.
 *
 * This MUST be a middleware (not a server route) because a server route
 * returning undefined sends HTTP 204, which prevents the Nuxt page from rendering.
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  if (!isAPRequest) return;

  const path = getRequestURL(event).pathname;
  const match = path.match(/^\/hubs\/([a-z0-9][a-z0-9_-]*)$/);
  if (!match) return;

  const config = useConfig();
  if (!config.features.federation || !config.features.federateHubs) return;

  const slug = match[1]!;
  const db = useDB();
  const actor = await buildHubGroupActor(db, slug, config.instance.domain);
  if (!actor) return;

  setResponseHeader(event, 'content-type', 'application/activity+json');
  return actor;
});
