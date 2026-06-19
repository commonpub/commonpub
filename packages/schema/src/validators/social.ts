import { z } from 'zod';

// --- Social validators ---

export const likeTargetTypeSchema = z.enum([
  'project',
  'article',
  'blog',
  'comment',
  'post',
  'explainer',
  'video',
]);
export type LikeTargetType = z.infer<typeof likeTargetTypeSchema>;

export const commentTargetTypeSchema = z.enum([
  'project',
  'article',
  'blog',
  'explainer',
  'post',
  'lesson',
  'video',
]);
export type CommentTargetType = z.infer<typeof commentTargetTypeSchema>;

export const createCommentSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(10000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
