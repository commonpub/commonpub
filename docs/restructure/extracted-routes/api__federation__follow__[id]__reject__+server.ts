import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rejectFollow } from '$lib/server/federation';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.config.features.federation) {
    return json({ error: 'Federation is not enabled' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  await rejectFollow(locals.db, params.id, locals.config.instance.domain);
  return json({ success: true });
};
