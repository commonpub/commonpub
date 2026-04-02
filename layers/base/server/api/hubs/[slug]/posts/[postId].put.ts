import { editPost, getHubBySlug, federateHubPostUpdate } from '@commonpub/server';
import type { HubPostItem } from '@commonpub/server';
import { editPostSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubPostItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });

  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const input = await parseBody(event, editPostSchema);
  const updated = await editPost(db, postId, user.id, community.id, input);
  if (!updated) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to edit this post' });
  }

  // Federate the update (fire-and-forget)
  if (config.features.federation && config.features.federateHubs) {
    federateHubPostUpdate(db, postId, community.id, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate post update:', err);
    });
  }

  return updated;
});
