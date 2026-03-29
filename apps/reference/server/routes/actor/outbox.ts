import { generateOutboxCollection, generateOutboxPage } from '@commonpub/protocol';
import { countInstanceOutboxItems, getInstanceOutboxPage } from '@commonpub/server';

const PAGE_SIZE = 20;

/**
 * Instance actor outbox — serves paginated outbound Create activities
 * from all users on this instance. Used by backfill crawlers.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const db = useDB();
  const domain = config.instance.domain;
  const query = getQuery(event);
  const page = query.page ? parseInt(String(query.page), 10) : 0;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  const totalItems = await countInstanceOutboxItems(db, domain);

  if (!page || isNaN(page)) {
    return generateOutboxCollection(totalItems, domain, null);
  }

  const items = await getInstanceOutboxPage(db, domain, page, PAGE_SIZE);
  return generateOutboxPage(items as never[], domain, null, page, PAGE_SIZE, totalItems);
});
