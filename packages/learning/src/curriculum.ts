import type { LearningModule, Lesson, CurriculumNode } from './types.js';
import { calculatePathProgress } from './progress.js';
import { getLessonStatus } from './progress.js';

/** Flatten all lessons across modules in curriculum order */
export function flattenLessons(modules: LearningModule[], lessons: Lesson[]): Lesson[] {
  const sorted = [...modules].sort((a, b) => a.sortOrder - b.sortOrder);
  const result: Lesson[] = [];
  for (const mod of sorted) {
    const modLessons = lessons
      .filter((l) => l.moduleId === mod.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    result.push(...modLessons);
  }
  return result;
}

/** Count total lessons across all modules */
export function countLessons(modules: LearningModule[], lessons: Lesson[]): number {
  return lessons.filter((l) => modules.some((m) => m.id === l.moduleId)).length;
}

/** Calculate total estimated duration in minutes */
export function calculateEstimatedDuration(lessons: Lesson[]): number {
  return lessons.reduce((sum, l) => sum + (l.duration ?? 0), 0);
}

/** Format minutes into human-readable duration */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Build a curriculum tree with progress status */
export function buildCurriculumTree(
  modules: LearningModule[],
  lessons: Lesson[],
  completedLessonIds?: Set<string>,
): CurriculumNode[] {
  const completed = completedLessonIds ?? new Set<string>();
  const sorted = [...modules].sort((a, b) => a.sortOrder - b.sortOrder);

  return sorted.map((mod) => {
    const modLessons = lessons
      .filter((l) => l.moduleId === mod.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const completedCount = modLessons.filter((l) => completed.has(l.id)).length;

    return {
      module: mod,
      lessons: modLessons.map((lesson) => ({
        lesson,
        status: getLessonStatus(lesson.id, modules, lessons, completed),
      })),
      completionPercentage: calculatePathProgress(modLessons.length, completedCount),
    };
  });
}

/** Reorder items by moving an item from one index to another, updating sortOrders */
export function reorderItems<T extends { sortOrder: number }>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const [moved] = sorted.splice(fromIndex, 1);
  sorted.splice(toIndex, 0, moved!);

  return sorted.map((item, index) => ({ ...item, sortOrder: index }));
}
