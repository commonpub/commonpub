import { eq, and, desc, sql, asc } from 'drizzle-orm';
import {
  learningPaths,
  learningModules,
  learningLessons,
  enrollments,
  lessonProgress,
  certificates,
  users,
} from '@commonpub/schema';
import { calculatePathProgress, isPathComplete } from '@commonpub/learning';
import { generateVerificationCode } from '@commonpub/learning';
import { generateSlug } from '../utils/slug';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  LearningPathListItem,
  LearningPathDetail,
  EnrollmentItem,
  CertificateItem,
  LearningPathFilters,
} from '../types';

type DB = NodePgDatabase<Record<string, unknown>>;

// --- Path CRUD ---

export async function listPaths(
  db: DB,
  filters: LearningPathFilters = {},
): Promise<{ items: LearningPathListItem[]; total: number }> {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(learningPaths.status, filters.status as 'draft' | 'published' | 'archived'));
  }
  if (filters.difficulty) {
    conditions.push(
      eq(learningPaths.difficulty, filters.difficulty as 'beginner' | 'intermediate' | 'advanced'),
    );
  }
  if (filters.authorId) {
    conditions.push(eq(learningPaths.authorId, filters.authorId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        path: learningPaths,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(learningPaths)
      .innerJoin(users, eq(learningPaths.authorId, users.id))
      .where(where)
      .orderBy(desc(learningPaths.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(learningPaths)
      .where(where),
  ]);

  const items: LearningPathListItem[] = rows.map((row) => ({
    id: row.path.id,
    title: row.path.title,
    slug: row.path.slug,
    description: row.path.description,
    coverImageUrl: row.path.coverImageUrl,
    difficulty: row.path.difficulty,
    estimatedHours: row.path.estimatedHours,
    enrollmentCount: row.path.enrollmentCount,
    completionCount: row.path.completionCount,
    averageRating: row.path.averageRating,
    status: row.path.status,
    createdAt: row.path.createdAt,
    author: row.author,
  }));

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getPathBySlug(
  db: DB,
  slug: string,
  requesterId?: string,
): Promise<LearningPathDetail | null> {
  const rows = await db
    .select({
      path: learningPaths,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(learningPaths)
    .innerJoin(users, eq(learningPaths.authorId, users.id))
    .where(eq(learningPaths.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0]!;
  const path = row.path;

  if (path.status !== 'published' && path.authorId !== requesterId) {
    return null;
  }

  const modules = await db
    .select()
    .from(learningModules)
    .where(eq(learningModules.pathId, path.id))
    .orderBy(asc(learningModules.sortOrder));

  const moduleIds = modules.map((m) => m.id);
  let lessons: Array<typeof learningLessons.$inferSelect> = [];
  if (moduleIds.length > 0) {
    lessons = await db
      .select()
      .from(learningLessons)
      .where(sql`${learningLessons.moduleId} = ANY(${moduleIds})`)
      .orderBy(asc(learningLessons.sortOrder));
  }

  let enrollment = null;
  let isEnrolled = false;
  if (requesterId) {
    const enrollmentRows = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, requesterId), eq(enrollments.pathId, path.id)))
      .limit(1);
    if (enrollmentRows.length > 0) {
      const e = enrollmentRows[0]!;
      enrollment = {
        id: e.id,
        progress: e.progress,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
      };
      isEnrolled = true;
    }
  }

  const modulesWithLessons = modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    sortOrder: mod.sortOrder,
    lessons: lessons
      .filter((l) => l.moduleId === mod.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        slug: l.slug,
        type: l.type,
        duration: l.duration,
        sortOrder: l.sortOrder,
      })),
  }));

  return {
    id: path.id,
    title: path.title,
    slug: path.slug,
    description: path.description,
    coverImageUrl: path.coverImageUrl,
    difficulty: path.difficulty,
    estimatedHours: path.estimatedHours,
    enrollmentCount: path.enrollmentCount,
    completionCount: path.completionCount,
    averageRating: path.averageRating,
    reviewCount: path.reviewCount,
    status: path.status,
    createdAt: path.createdAt,
    updatedAt: path.updatedAt,
    author: row.author,
    modules: modulesWithLessons,
    isEnrolled,
    enrollment,
  };
}

export async function createPath(
  db: DB,
  authorId: string,
  input: { title: string; description?: string; difficulty?: string; estimatedHours?: number },
): Promise<LearningPathDetail> {
  const slug = await ensureUniquePathSlug(db, generateSlug(input.title));

  const [path] = await db
    .insert(learningPaths)
    .values({
      authorId,
      title: input.title,
      slug,
      description: input.description ?? null,
      difficulty: (input.difficulty as 'beginner' | 'intermediate' | 'advanced') ?? null,
      estimatedHours: input.estimatedHours?.toString() ?? null,
      status: 'draft',
    })
    .returning();

  return (await getPathBySlug(db, path!.slug, authorId))!;
}

export async function updatePath(
  db: DB,
  pathId: string,
  authorId: string,
  input: {
    title?: string;
    description?: string;
    difficulty?: string;
    estimatedHours?: number;
    coverImageUrl?: string;
  },
): Promise<LearningPathDetail | null> {
  const existing = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, pathId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (existing.length === 0) return null;

  const current = existing[0]!;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    updates.title = input.title;
    if (input.title !== current.title) {
      updates.slug = await ensureUniquePathSlug(db, generateSlug(input.title), pathId);
    }
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
  if (input.estimatedHours !== undefined) updates.estimatedHours = input.estimatedHours.toString();
  if (input.coverImageUrl !== undefined) updates.coverImageUrl = input.coverImageUrl;

  await db.update(learningPaths).set(updates).where(eq(learningPaths.id, pathId));

  const slug = (updates.slug as string) ?? current.slug;
  return (await getPathBySlug(db, slug, authorId))!;
}

export async function deletePath(db: DB, pathId: string, authorId: string): Promise<boolean> {
  const result = await db
    .update(learningPaths)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(learningPaths.id, pathId), eq(learningPaths.authorId, authorId)));

  return (result.rowCount ?? 0) > 0;
}

export async function publishPath(
  db: DB,
  pathId: string,
  authorId: string,
): Promise<LearningPathDetail | null> {
  const existing = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, pathId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (existing.length === 0) return null;

  await db
    .update(learningPaths)
    .set({ status: 'published', updatedAt: new Date() })
    .where(eq(learningPaths.id, pathId));

  return (await getPathBySlug(db, existing[0]!.slug, authorId))!;
}

// --- Module CRUD ---

export async function createModule(
  db: DB,
  authorId: string,
  input: { pathId: string; title: string; description?: string; sortOrder?: number },
): Promise<typeof learningModules.$inferSelect> {
  // Ownership check
  const path = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, input.pathId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (path.length === 0) throw new Error('Not authorized');

  // Auto-assign sort order if not provided
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const maxSort = await db
      .select({ max: sql<number>`coalesce(max(${learningModules.sortOrder}), -1)` })
      .from(learningModules)
      .where(eq(learningModules.pathId, input.pathId));
    sortOrder = (maxSort[0]?.max ?? -1) + 1;
  }

  const [mod] = await db
    .insert(learningModules)
    .values({
      pathId: input.pathId,
      title: input.title,
      description: input.description ?? null,
      sortOrder,
    })
    .returning();

  return mod!;
}

export async function updateModule(
  db: DB,
  moduleId: string,
  authorId: string,
  input: { title?: string; description?: string },
): Promise<typeof learningModules.$inferSelect | null> {
  const mod = await db
    .select({ module: learningModules, path: learningPaths })
    .from(learningModules)
    .innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id))
    .where(and(eq(learningModules.id, moduleId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (mod.length === 0) return null;

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;

  if (Object.keys(updates).length === 0) return mod[0]!.module;

  const [updated] = await db
    .update(learningModules)
    .set(updates)
    .where(eq(learningModules.id, moduleId))
    .returning();

  return updated!;
}

export async function deleteModule(db: DB, moduleId: string, authorId: string): Promise<boolean> {
  const mod = await db
    .select({ module: learningModules, path: learningPaths })
    .from(learningModules)
    .innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id))
    .where(and(eq(learningModules.id, moduleId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (mod.length === 0) return false;

  await db.delete(learningModules).where(eq(learningModules.id, moduleId));
  return true;
}

export async function reorderModules(
  db: DB,
  pathId: string,
  authorId: string,
  moduleIds: string[],
): Promise<boolean> {
  const path = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, pathId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (path.length === 0) return false;

  await db.transaction(async (tx) => {
    for (let i = 0; i < moduleIds.length; i++) {
      await tx
        .update(learningModules)
        .set({ sortOrder: i })
        .where(and(eq(learningModules.id, moduleIds[i]!), eq(learningModules.pathId, pathId)));
    }
  });

  return true;
}

// --- Lesson CRUD ---

export async function createLesson(
  db: DB,
  authorId: string,
  input: {
    moduleId: string;
    title: string;
    type: string;
    content?: unknown;
    durationMinutes?: number;
  },
): Promise<typeof learningLessons.$inferSelect> {
  // Verify module ownership via path
  const mod = await db
    .select({ module: learningModules, path: learningPaths })
    .from(learningModules)
    .innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id))
    .where(and(eq(learningModules.id, input.moduleId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (mod.length === 0) throw new Error('Not authorized');

  const slug = generateSlug(input.title) || `lesson-${Date.now()}`;

  // Auto sort order
  const maxSort = await db
    .select({ max: sql<number>`coalesce(max(${learningLessons.sortOrder}), -1)` })
    .from(learningLessons)
    .where(eq(learningLessons.moduleId, input.moduleId));

  const [lesson] = await db
    .insert(learningLessons)
    .values({
      moduleId: input.moduleId,
      title: input.title,
      slug,
      type: input.type as 'article' | 'video' | 'quiz' | 'project' | 'explainer',
      content: input.content ?? null,
      duration: input.durationMinutes ?? null,
      sortOrder: (maxSort[0]?.max ?? -1) + 1,
    })
    .returning();

  return lesson!;
}

export async function updateLesson(
  db: DB,
  lessonId: string,
  authorId: string,
  input: { title?: string; type?: string; content?: unknown; durationMinutes?: number },
): Promise<typeof learningLessons.$inferSelect | null> {
  const lesson = await db
    .select({ lesson: learningLessons, module: learningModules, path: learningPaths })
    .from(learningLessons)
    .innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id))
    .innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id))
    .where(and(eq(learningLessons.id, lessonId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (lesson.length === 0) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) {
    updates.title = input.title;
    updates.slug = generateSlug(input.title) || lesson[0]!.lesson.slug;
  }
  if (input.type !== undefined) updates.type = input.type;
  if (input.content !== undefined) updates.content = input.content;
  if (input.durationMinutes !== undefined) updates.duration = input.durationMinutes;

  const [updated] = await db
    .update(learningLessons)
    .set(updates)
    .where(eq(learningLessons.id, lessonId))
    .returning();

  return updated!;
}

export async function deleteLesson(db: DB, lessonId: string, authorId: string): Promise<boolean> {
  const lesson = await db
    .select({ lesson: learningLessons, module: learningModules, path: learningPaths })
    .from(learningLessons)
    .innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id))
    .innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id))
    .where(and(eq(learningLessons.id, lessonId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (lesson.length === 0) return false;

  await db.delete(learningLessons).where(eq(learningLessons.id, lessonId));
  return true;
}

export async function reorderLessons(
  db: DB,
  moduleId: string,
  authorId: string,
  lessonIds: string[],
): Promise<boolean> {
  const mod = await db
    .select({ module: learningModules, path: learningPaths })
    .from(learningModules)
    .innerJoin(learningPaths, eq(learningModules.pathId, learningPaths.id))
    .where(and(eq(learningModules.id, moduleId), eq(learningPaths.authorId, authorId)))
    .limit(1);

  if (mod.length === 0) return false;

  await db.transaction(async (tx) => {
    for (let i = 0; i < lessonIds.length; i++) {
      await tx
        .update(learningLessons)
        .set({ sortOrder: i })
        .where(and(eq(learningLessons.id, lessonIds[i]!), eq(learningLessons.moduleId, moduleId)));
    }
  });

  return true;
}

// --- Enrollment ---

export async function enroll(
  db: DB,
  userId: string,
  pathId: string,
): Promise<typeof enrollments.$inferSelect> {
  // Idempotent
  const existing = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId)))
    .limit(1);

  if (existing.length > 0) return existing[0]!;

  // Verify path is published
  const path = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, pathId), eq(learningPaths.status, 'published')))
    .limit(1);

  if (path.length === 0) throw new Error('Path not found or not published');

  const [enrollment] = await db.insert(enrollments).values({ userId, pathId }).returning();

  // Increment enrollment count
  await db
    .update(learningPaths)
    .set({ enrollmentCount: sql`${learningPaths.enrollmentCount} + 1` })
    .where(eq(learningPaths.id, pathId));

  return enrollment!;
}

export async function unenroll(db: DB, userId: string, pathId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId)))
    .limit(1);

  if (existing.length === 0) return false;

  await db
    .delete(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId)));

  // Decrement enrollment count
  await db
    .update(learningPaths)
    .set({ enrollmentCount: sql`GREATEST(${learningPaths.enrollmentCount} - 1, 0)` })
    .where(eq(learningPaths.id, pathId));

  return true;
}

// --- Progress ---

export async function markLessonComplete(
  db: DB,
  userId: string,
  lessonId: string,
  quizScore?: number,
  quizPassed?: boolean,
): Promise<{ progress: number; certificateIssued: boolean }> {
  // Find the lesson's path (read-only, outside transaction)
  const lessonRow = await db
    .select({ lesson: learningLessons, module: learningModules })
    .from(learningLessons)
    .innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id))
    .where(eq(learningLessons.id, lessonId))
    .limit(1);

  if (lessonRow.length === 0) throw new Error('Lesson not found');

  const pathId = lessonRow[0]!.module.pathId;

  return db.transaction(async (tx) => {
    // Lock enrollment row to serialize concurrent completions
    const enrollmentRow = await tx
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId)))
      .for('update')
      .limit(1);

    if (enrollmentRow.length === 0) throw new Error('Not enrolled');

    // Upsert lesson progress
    const existingProgress = await tx
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
      .limit(1);

    if (existingProgress.length === 0) {
      await tx.insert(lessonProgress).values({
        userId,
        lessonId,
        completed: true,
        completedAt: new Date(),
        quizScore: quizScore?.toString() ?? null,
        quizPassed: quizPassed ?? null,
      });
    } else {
      await tx
        .update(lessonProgress)
        .set({
          completed: true,
          completedAt: new Date(),
          quizScore: quizScore?.toString() ?? existingProgress[0]!.quizScore,
          quizPassed: quizPassed ?? existingProgress[0]!.quizPassed,
        })
        .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
    }

    // Recalculate progress
    const totalLessons = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(learningLessons)
      .innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id))
      .where(eq(learningModules.pathId, pathId));

    const completedLessons = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(lessonProgress)
      .innerJoin(learningLessons, eq(lessonProgress.lessonId, learningLessons.id))
      .innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id))
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.completed, true),
          eq(learningModules.pathId, pathId),
        ),
      );

    const total = totalLessons[0]?.count ?? 0;
    const completed = completedLessons[0]?.count ?? 0;
    const progress = calculatePathProgress(total, completed);

    // Update enrollment progress
    const enrollmentUpdates: Record<string, unknown> = { progress: progress.toString() };
    if (isPathComplete(progress)) {
      enrollmentUpdates.completedAt = new Date();
    }

    await tx
      .update(enrollments)
      .set(enrollmentUpdates)
      .where(eq(enrollments.id, enrollmentRow[0]!.id));

    // Auto-certificate at 100%
    let certificateIssued = false;
    if (isPathComplete(progress)) {
      const existingCert = await tx
        .select()
        .from(certificates)
        .where(and(eq(certificates.userId, userId), eq(certificates.pathId, pathId)))
        .limit(1);

      if (existingCert.length === 0) {
        await tx.insert(certificates).values({
          userId,
          pathId,
          verificationCode: generateVerificationCode(),
        });
        certificateIssued = true;

        // Increment completion count
        await tx
          .update(learningPaths)
          .set({ completionCount: sql`${learningPaths.completionCount} + 1` })
          .where(eq(learningPaths.id, pathId));
      }
    }

    return { progress, certificateIssued };
  });
}

// --- Queries ---

export async function getEnrollment(
  db: DB,
  userId: string,
  pathId: string,
): Promise<typeof enrollments.$inferSelect | null> {
  const rows = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.pathId, pathId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getUserEnrollments(db: DB, userId: string): Promise<EnrollmentItem[]> {
  const rows = await db
    .select({
      enrollment: enrollments,
      path: {
        id: learningPaths.id,
        title: learningPaths.title,
        slug: learningPaths.slug,
        coverImageUrl: learningPaths.coverImageUrl,
        difficulty: learningPaths.difficulty,
      },
    })
    .from(enrollments)
    .innerJoin(learningPaths, eq(enrollments.pathId, learningPaths.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.startedAt));

  return rows.map((row) => ({
    id: row.enrollment.id,
    progress: row.enrollment.progress,
    startedAt: row.enrollment.startedAt,
    completedAt: row.enrollment.completedAt,
    path: row.path,
  }));
}

export async function getUserCertificates(db: DB, userId: string): Promise<CertificateItem[]> {
  const rows = await db
    .select({
      certificate: certificates,
      path: {
        id: learningPaths.id,
        title: learningPaths.title,
        slug: learningPaths.slug,
      },
    })
    .from(certificates)
    .innerJoin(learningPaths, eq(certificates.pathId, learningPaths.id))
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt));

  return rows.map((row) => ({
    id: row.certificate.id,
    verificationCode: row.certificate.verificationCode,
    issuedAt: row.certificate.issuedAt,
    path: row.path,
  }));
}

export async function getCertificateByCode(
  db: DB,
  code: string,
): Promise<{
  certificate: typeof certificates.$inferSelect;
  path: { title: string; slug: string };
  user: { displayName: string | null; username: string };
} | null> {
  const rows = await db
    .select({
      certificate: certificates,
      path: {
        title: learningPaths.title,
        slug: learningPaths.slug,
      },
      user: {
        displayName: users.displayName,
        username: users.username,
      },
    })
    .from(certificates)
    .innerJoin(learningPaths, eq(certificates.pathId, learningPaths.id))
    .innerJoin(users, eq(certificates.userId, users.id))
    .where(eq(certificates.verificationCode, code))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLessonBySlug(
  db: DB,
  pathSlug: string,
  lessonSlug: string,
): Promise<{
  lesson: typeof learningLessons.$inferSelect;
  module: typeof learningModules.$inferSelect;
  pathId: string;
} | null> {
  const path = await db
    .select()
    .from(learningPaths)
    .where(eq(learningPaths.slug, pathSlug))
    .limit(1);

  if (path.length === 0) return null;

  const rows = await db
    .select({ lesson: learningLessons, module: learningModules })
    .from(learningLessons)
    .innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id))
    .where(and(eq(learningLessons.slug, lessonSlug), eq(learningModules.pathId, path[0]!.id)))
    .limit(1);

  if (rows.length === 0) return null;

  return {
    lesson: rows[0]!.lesson,
    module: rows[0]!.module,
    pathId: path[0]!.id,
  };
}

export async function getCompletedLessonIds(
  db: DB,
  userId: string,
  pathId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .innerJoin(learningLessons, eq(lessonProgress.lessonId, learningLessons.id))
    .innerJoin(learningModules, eq(learningLessons.moduleId, learningModules.id))
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.completed, true),
        eq(learningModules.pathId, pathId),
      ),
    );

  return new Set(rows.map((r) => r.lessonId));
}

// --- Helpers ---

async function ensureUniquePathSlug(db: DB, slug: string, excludeId?: string): Promise<string> {
  if (!slug) {
    slug = `untitled-${Date.now()}`;
  }

  const conditions = [eq(learningPaths.slug, slug)];
  if (excludeId) {
    const { ne } = await import('drizzle-orm');
    conditions.push(ne(learningPaths.id, excludeId));
  }

  const existing = await db
    .select({ id: learningPaths.id })
    .from(learningPaths)
    .where(and(...conditions))
    .limit(1);

  if (existing.length === 0) return slug;

  return `${slug}-${Date.now()}`;
}
