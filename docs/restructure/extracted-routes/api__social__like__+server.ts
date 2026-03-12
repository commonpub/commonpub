import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleLike, onContentLiked } from '$lib/server/social';
import { likeTargetTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const likeInputSchema = z.object({
  targetType: likeTargetTypeSchema,
  targetId: z.string().uuid(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.config.features.social) {
    return json({ error: 'Social features are not enabled' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = likeInputSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetType, targetId } = parsed.data;

  const result = await toggleLike(locals.db, locals.user.id, targetType, targetId);
  if (result.liked) {
    await onContentLiked(locals.db, locals.user.id, targetId, locals.config);
  }
  return json(result);
};
