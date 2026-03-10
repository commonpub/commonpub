import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleLike } from '$lib/server/social';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { targetType, targetId } = await request.json();

  if (!targetType || !targetId) {
    return json({ error: 'targetType and targetId are required' }, { status: 400 });
  }

  const result = await toggleLike(locals.db, locals.user.id, targetType, targetId);
  return json(result);
};
