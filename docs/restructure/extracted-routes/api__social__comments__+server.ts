import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listComments, createComment, deleteComment } from '$lib/server/social';
import { createCommentSchema, commentTargetTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const commentQuerySchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
});

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.config.features.social) {
    return json({ error: 'Social features are not enabled' }, { status: 404 });
  }

  const parsed = commentQuerySchema.safeParse({
    targetType: url.searchParams.get('targetType'),
    targetId: url.searchParams.get('targetId'),
  });

  if (!parsed.success) {
    return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const comments = await listComments(locals.db, parsed.data.targetType, parsed.data.targetId);
  return json({ comments });
};

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

  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await createComment(locals.db, locals.user.id, {
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    content: parsed.data.content.trim(),
    parentId: parsed.data.parentId,
  });

  return json({ comment }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  if (!locals.config.features.social) {
    return json({ error: 'Social features are not enabled' }, { status: 404 });
  }

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
