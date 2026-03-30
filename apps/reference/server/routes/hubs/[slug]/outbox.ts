import { generateOutboxCollection, generateOutboxPage } from '@commonpub/protocol';
import { getHubBySlug, countHubOutboxItems, getHubOutboxPage, getHubActorUri } from '@commonpub/server';

const PAGE_SIZE = 20;

/**
 * Hub Group actor outbox — serves paginated outbound Announce activities.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation || !config.features.federateHubs) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const slug = getRouterParam(event, 'slug');
  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const db = useDB();
  const domain = config.instance.domain;

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const hubActorUri = getHubActorUri(domain, slug);
  const outboxUri = `${hubActorUri}/outbox`;
  const query = getQuery(event);
  const page = query.page ? parseInt(String(query.page), 10) : 0;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  const totalItems = await countHubOutboxItems(db, hubActorUri);

  if (!page || isNaN(page)) {
    return generateOutboxCollection(totalItems, domain, null, outboxUri);
  }

  const items = await getHubOutboxPage(db, hubActorUri, page, PAGE_SIZE);
  return generateOutboxPage(items as never[], domain, null, page, PAGE_SIZE, totalItems, outboxUri);
});
