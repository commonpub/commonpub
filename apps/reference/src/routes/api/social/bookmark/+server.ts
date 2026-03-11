import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleBookmark } from '$lib/server/social';
import { z } from 'zod';

const bookmarkInputSchema = z.object({
  targetType: z.enum(['project', 'article', 'blog', 'explainer', 'learning_path']),
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

  const parsed = bookmarkInputSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetType, targetId } = parsed.data;

  const result = await toggleBookmark(locals.db, locals.user.id, targetType, targetId);
  return json(result);
};
