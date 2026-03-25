import { generateOutboxCollection } from '@commonpub/protocol';
import { getUserByUsername } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')!;
  const db = useDB();
  const config = useConfig();

  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Actor not found' });
  }

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return generateOutboxCollection(0, config.instance.domain, username);
});
