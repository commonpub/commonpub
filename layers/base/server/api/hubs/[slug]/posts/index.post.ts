import { createPost, getHubBySlug, federateHubPost } from '@commonpub/server';
import type { HubPostItem } from '@commonpub/server';
import { createPostSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubPostItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug } = parseParams(event, { slug: 'string' });

  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const body = await readBody(event);
  const parsed = createPostSchema.safeParse({ ...body, hubId: community.id });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const post = await createPost(db, user.id, { hubId: community.id, type: parsed.data.type, content: parsed.data.content });

  // Federate hub post as Announce from Group actor (fire-and-forget)
  if (config.features.federation && config.features.federateHubs) {
    federateHubPost(db, post.id, community.id, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate post:', err);
    });
  }

  return post;
});
