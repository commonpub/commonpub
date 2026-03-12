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

  const actorUri = `https://${config.instance.domain}/users/${username}`;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return generateOutboxCollection(actorUri, []);
});
