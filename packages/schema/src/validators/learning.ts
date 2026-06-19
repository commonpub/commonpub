import { z } from 'zod';
import { optionalUrl } from './_shared.js';
import { contentStatusSchema, difficultySchema } from './content.js';

// --- Learning validators ---

export const createLearningPathSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  difficulty: difficultySchema.optional(),
  estimatedHours: z.number().positive().max(9999).optional(),
  coverImageUrl: optionalUrl(),
});
export type CreateLearningPathInput = z.infer<typeof createLearningPathSchema>;

export const updateLearningPathSchema = createLearningPathSchema.partial();
export type UpdateLearningPathInput = z.infer<typeof updateLearningPathSchema>;

export const createModuleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const updateModuleSchema = createModuleSchema.partial();
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

export const lessonTypeSchema = z.enum(['article', 'video', 'quiz', 'project', 'explainer']);
export type LessonType = z.infer<typeof lessonTypeSchema>;

export const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(255),
  type: lessonTypeSchema,
  content: z.unknown().optional(),
  contentItemId: z.string().uuid().optional(),
  durationMinutes: z.number().int().positive().max(9999).optional(),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = createLessonSchema.partial().omit({ moduleId: true }).extend({
  contentItemId: z.string().uuid().nullable().optional(),
});
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

// --- Learning filters ---

export const learningPathFiltersSchema = z.object({
  status: contentStatusSchema.optional(),
  difficulty: difficultySchema.optional(),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type LearningPathFilters = z.infer<typeof learningPathFiltersSchema>;
