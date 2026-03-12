import type { LearningModule, Lesson, LessonStatus } from './types.js';

/** Calculate path progress as a percentage (0-100, 2 decimal places) */
export function calculatePathProgress(totalLessons: number, completedCount: number): number {
  if (totalLessons <= 0) return 0;
  if (completedCount >= totalLessons) return 100;
  return Math.round((completedCount / totalLessons) * 10000) / 100;
}

/** Check if a path is complete (progress >= 100) */
export function isPathComplete(progress: number): boolean {
  return progress >= 100;
}

/** Get the next incomplete lesson in curriculum order */
export function getNextLesson(
  modules: LearningModule[],
  lessons: Lesson[],
  completedLessonIds: Set<string>,
): Lesson | null {
  const sorted = sortedModules(modules);
  for (const mod of sorted) {
    const modLessons = sortedLessonsForModule(lessons, mod.id);
    for (const lesson of modLessons) {
      if (!completedLessonIds.has(lesson.id)) {
        return lesson;
      }
    }
  }
  return null;
}

/** Get the status of a specific lesson */
export function getLessonStatus(
  lessonId: string,
  modules: LearningModule[],
  lessons: Lesson[],
  completedLessonIds: Set<string>,
): LessonStatus {
  if (completedLessonIds.has(lessonId)) return 'completed';

  const nextLesson = getNextLesson(modules, lessons, completedLessonIds);
  if (nextLesson && nextLesson.id === lessonId) return 'current';

  return 'locked';
}

/** Get completion percentage per module */
export function getCompletionPercentageByModule(
  modules: LearningModule[],
  lessons: Lesson[],
  completedLessonIds: Set<string>,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const mod of modules) {
    const modLessons = lessons.filter((l) => l.moduleId === mod.id);
    const completed = modLessons.filter((l) => completedLessonIds.has(l.id)).length;
    result.set(mod.id, calculatePathProgress(modLessons.length, completed));
  }
  return result;
}

// --- Helpers ---

function sortedModules(modules: LearningModule[]): LearningModule[] {
  return [...modules].sort((a, b) => a.sortOrder - b.sortOrder);
}

function sortedLessonsForModule(lessons: Lesson[], moduleId: string): Lesson[] {
  return lessons.filter((l) => l.moduleId === moduleId).sort((a, b) => a.sortOrder - b.sortOrder);
}
