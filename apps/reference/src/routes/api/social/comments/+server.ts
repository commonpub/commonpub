import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listComments, createComment, deleteComment } from '$lib/server/social';

export const GET: RequestHandler = async ({ url, locals }) => {
  const targetType = url.searchParams.get('targetType');
  const targetId = url.searchParams.get('targetId');

  if (!targetType || !targetId) {
    return json({ error: 'targetType and targetId are required' }, { status: 400 });
  }

  const comments = await listComments(locals.db, targetType, targetId);
  return json({ comments });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { targetType, targetId, content, parentId } = await request.json();

  if (!targetType || !targetId || !content?.trim()) {
    return json({ error: 'targetType, targetId, and content are required' }, { status: 400 });
  }

  if (content.length > 10000) {
    return json({ error: 'Comment too long' }, { status: 400 });
  }

  const comment = await createComment(locals.db, locals.user.id, {
    targetType,
    targetId,
    content: content.trim(),
    parentId,
  });

  return json({ comment }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return json({ error: 'Not authenticated' }, { status: 401 });
  }

  const commentId = url.searchParams.get('id');
  if (!commentId) {
    return json({ error: 'Comment id is required' }, { status: 400 });
  }

  const deleted = await deleteComment(locals.db, commentId, locals.user.id);
  if (!deleted) {
    return json({ error: 'Not found or not authorized' }, { status: 403 });
  }

  return json({ success: true });
};
