import { z } from 'zod';
import { createLearningPathSchema, createLessonSchema } from '@commonpub/schema';

// --- Path validators ---

export const updateLearningPathSchema = createLearningPathSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// --- Module validators ---

export const createModuleSchema = z.object({
  pathId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const updateModuleSchema = createModuleSchema.omit({ pathId: true }).partial();

// --- Lesson validators ---

export const updateLessonSchema = createLessonSchema.omit({ moduleId: true }).partial();

// --- Lesson content discriminated union ---

const articleContentSchema = z.object({
  type: z.literal('article'),
  blocks: z.array(z.tuple([z.string(), z.record(z.string(), z.unknown())])),
});

const videoContentSchema = z.object({
  type: z.literal('video'),
  url: z.string().url(),
  platform: z.string().optional(),
});

const quizOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(quizOptionSchema).min(2),
  correctOptionId: z.string(),
  explanation: z.string().optional(),
});

const quizContentSchema = z.object({
  type: z.literal('quiz'),
  questions: z.array(quizQuestionSchema).min(1),
  passingScore: z.number().min(0).max(100),
});

const projectContentSchema = z.object({
  type: z.literal('project'),
  slug: z.string().min(1),
});

const explainerContentSchema = z.object({
  type: z.literal('explainer'),
  slug: z.string().min(1),
});

export const lessonContentSchema = z.discriminatedUnion('type', [
  articleContentSchema,
  videoContentSchema,
  quizContentSchema,
  projectContentSchema,
  explainerContentSchema,
]);
