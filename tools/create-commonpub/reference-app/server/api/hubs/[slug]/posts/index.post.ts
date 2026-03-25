import { createPost, getHubBySlug } from '@commonpub/server';
import type { HubPostItem } from '@commonpub/server';
import { createPostSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubPostItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const input = await parseBody(event, createPostSchema);

  const { hubId: _hubId, ...rest } = input; // eslint-disable-line @typescript-eslint/no-unused-vars
  return createPost(db, user.id, { hubId: community.id, ...rest });
});
