import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  numeric,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';
import { contentItems } from './content.js';
import { contentStatusEnum, difficultyEnum, lessonTypeEnum } from './enums.js';

export const learningPaths = pgTable('learning_paths', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  difficulty: difficultyEnum('difficulty'),
  estimatedHours: numeric('estimated_hours', { precision: 5, scale: 1 }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: contentStatusEnum('status').default('draft').notNull(),
  enrollmentCount: integer('enrollment_count').default(0).notNull(),
  completionCount: integer('completion_count').default(0).notNull(),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }),
  reviewCount: integer('review_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_learning_paths_author_id').on(t.authorId),
  index('idx_learning_paths_status').on(t.status),
]);

export const learningModules = pgTable('learning_modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  pathId: uuid('path_id')
    .notNull()
    .references(() => learningPaths.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_learning_modules_path_id').on(t.pathId),
]);

export const learningLessons = pgTable(
  'learning_lessons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => learningModules.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    type: lessonTypeEnum('type').notNull(),
    content: jsonb('content'),
    contentItemId: uuid('content_item_id')
      .references(() => contentItems.id, { onDelete: 'set null' }),
    duration: integer('duration_minutes'),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('learning_lessons_module_slug').on(t.moduleId, t.slug),
    index('idx_learning_lessons_module_id').on(t.moduleId),
  ],
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pathId: uuid('path_id')
      .notNull()
      .references(() => learningPaths.id, { onDelete: 'cascade' }),
    progress: numeric('progress', { precision: 5, scale: 2 }).default('0').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    unique('enrollments_user_path').on(t.userId, t.pathId),
    index('idx_enrollments_user_id').on(t.userId),
    index('idx_enrollments_path_id').on(t.pathId),
  ],
);

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => learningLessons.id, { onDelete: 'cascade' }),
    completed: boolean('completed').default(false).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    quizScore: numeric('quiz_score', { precision: 5, scale: 2 }),
    quizPassed: boolean('quiz_passed'),
  },
  (t) => [
    unique('lesson_progress_user_lesson').on(t.userId, t.lessonId),
    index('idx_lesson_progress_lesson_id').on(t.lessonId),
  ],
);

export const certificates = pgTable('certificates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  pathId: uuid('path_id')
    .notNull()
    .references(() => learningPaths.id, { onDelete: 'cascade' }),
  verificationCode: varchar('verification_code', { length: 64 }).notNull().unique(),
  certificateUrl: text('certificate_url'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('certificates_user_path').on(t.userId, t.pathId),
  index('idx_certificates_path_id').on(t.pathId),
]);

// --- Relations ---

export const learningPathsRelations = relations(learningPaths, ({ one, many }) => ({
  author: one(users, { fields: [learningPaths.authorId], references: [users.id] }),
  modules: many(learningModules),
  enrollments: many(enrollments),
  certificates: many(certificates),
}));

export const learningModulesRelations = relations(learningModules, ({ one, many }) => ({
  path: one(learningPaths, { fields: [learningModules.pathId], references: [learningPaths.id] }),
  lessons: many(learningLessons),
}));

export const learningLessonsRelations = relations(learningLessons, ({ one }) => ({
  module: one(learningModules, {
    fields: [learningLessons.moduleId],
    references: [learningModules.id],
  }),
  contentItem: one(contentItems, {
    fields: [learningLessons.contentItemId],
    references: [contentItems.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  path: one(learningPaths, { fields: [enrollments.pathId], references: [learningPaths.id] }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(learningLessons, {
    fields: [lessonProgress.lessonId],
    references: [learningLessons.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  path: one(learningPaths, { fields: [certificates.pathId], references: [learningPaths.id] }),
}));

// --- Inferred Types ---
export type LearningPathRow = typeof learningPaths.$inferSelect;
export type NewLearningPathRow = typeof learningPaths.$inferInsert;
export type LearningModuleRow = typeof learningModules.$inferSelect;
export type NewLearningModuleRow = typeof learningModules.$inferInsert;
export type LearningLessonRow = typeof learningLessons.$inferSelect;
export type NewLearningLessonRow = typeof learningLessons.$inferInsert;
export type EnrollmentRow = typeof enrollments.$inferSelect;
export type NewEnrollmentRow = typeof enrollments.$inferInsert;
export type LessonProgressRow = typeof lessonProgress.$inferSelect;
export type NewLessonProgressRow = typeof lessonProgress.$inferInsert;
export type CertificateRow = typeof certificates.$inferSelect;
export type NewCertificateRow = typeof certificates.$inferInsert;
