import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCommunityBySlug, listReplies, createReply } from '$lib/server/community';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.config.features.communities) {
    return json({ error: 'Communities are not enabled' }, { status: 404 });
  }

  const community = await getCommunityBySlug(locals.db, params.slug);
  if (!community) {
    return json({ error: 'Community not found' }, { status: 404 });
  }

  const replies = await listReplies(locals.db, params.postId);
  return json({ replies });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
  if (!locals.config.features.communities) {
    return json({ error: 'Communities are not enabled' }, { status: 404 });
  }

  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  let content: string, parentId: string | undefined;
  try {
    ({ content, parentId } = await request.json());
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!content?.trim()) {
    return json({ error: 'Content is required' }, { status: 400 });
  }

  try {
    const reply = await createReply(locals.db, locals.user.id, {
      postId: params.postId,
      content,
      parentId,
    });
    return json(reply, { status: 201 });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 400 });
  }
};
