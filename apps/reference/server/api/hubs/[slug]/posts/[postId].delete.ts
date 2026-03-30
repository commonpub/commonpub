import { deletePost, getHubBySlug, federateHubPostDelete } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<boolean> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const deleted = await deletePost(db, postId, user.id, community.id);

  // Federate deletion as Delete(Tombstone) from the hub Group actor
  if (deleted && config.features.federation && config.features.federateHubs) {
    federateHubPostDelete(db, postId, slug, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate post deletion:', err);
    });
  }

  return deleted;
});
