import { listReplies, getHubBySlug, getPostById } from '@commonpub/server';
import type { HubReplyItem } from '@commonpub/server';
import { z } from 'zod';

const repliesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: HubReplyItem[]; total: number }> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });
  const query = parseQueryParams(event, repliesQuerySchema);

  // Gate on hub privacy before exposing a private hub's post replies (P-2).
  const hub = await getHubBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!hub) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  requireHubReadAccess(event, hub);

  const post = await getPostById(db, postId);
  if (!post || post.hubId !== hub.id) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }

  return listReplies(db, postId, query);
});
