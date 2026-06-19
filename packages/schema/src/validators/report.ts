import { z } from 'zod';

// --- Report validators ---

export const createReportSchema = z.object({
  targetType: z.enum(['project', 'article', 'blog', 'post', 'comment', 'user', 'explainer']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'copyright', 'other']),
  description: z.string().max(2000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
