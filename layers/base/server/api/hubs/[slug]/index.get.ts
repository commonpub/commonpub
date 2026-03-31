import { getHubBySlug } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const user = getOptionalUser(event);

  const community = await getHubBySlug(db, slug, user?.id);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }
  return community;
});
