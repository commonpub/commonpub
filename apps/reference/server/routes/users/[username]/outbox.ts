import { generateOutboxCollection, generateOutboxPage } from '@commonpub/protocol';
import { getUserByUsername, countOutboxItems, getOutboxPage } from '@commonpub/server';

const PAGE_SIZE = 20;

/**
 * User actor outbox — serves paginated outbound activities for a specific user.
 * Returns Create/Update/Delete activities that were successfully delivered.
 */
export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')!;
  const db = useDB();
  const config = useConfig();

  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Actor not found' });
  }

  const domain = config.instance.domain;
  const actorUri = `https://${domain}/users/${username}`;
  const query = getQuery(event);
  const page = query.page ? parseInt(String(query.page), 10) : 0;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  const totalItems = await countOutboxItems(db, actorUri);

  if (!page || isNaN(page)) {
    return generateOutboxCollection(totalItems, domain, username);
  }

  const items = await getOutboxPage(db, actorUri, page, PAGE_SIZE);
  return generateOutboxPage(items as never[], domain, username, page, PAGE_SIZE, totalItems);
});
