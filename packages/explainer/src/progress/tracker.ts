import type { ExplainerSection, ExplainerProgressState, SectionProgress } from '../types.js';

/** Create initial empty progress state for an explainer */
export function createProgressState(sections: ExplainerSection[]): ExplainerProgressState {
  const now = new Date().toISOString();
  const sectionProgress: Record<string, SectionProgress> = {};
  for (const section of sections) {
    sectionProgress[section.id] = { completed: false };
  }
  return {
    sections: sectionProgress,
    startedAt: now,
    lastAccessedAt: now,
  };
}

/** Mark a section as completed and return new state */
export function markSectionCompleted(
  state: ExplainerProgressState,
  sectionId: string,
  quizScore?: number,
): ExplainerProgressState {
  return {
    ...state,
    lastAccessedAt: new Date().toISOString(),
    sections: {
      ...state.sections,
      [sectionId]: {
        completed: true,
        quizScore,
        completedAt: new Date().toISOString(),
      },
    },
  };
}

/** Check if a section can be accessed (gate logic) */
export function canAccessSection(
  state: ExplainerProgressState,
  sections: ExplainerSection[],
  sectionId: string,
): boolean {
  const sectionIndex = sections.findIndex((s) => s.id === sectionId);
  if (sectionIndex === -1) return false;

  const section = sections[sectionIndex]!;

  // First section is always accessible
  if (sectionIndex === 0) return true;

  // Checkpoint sections with requiresPrevious check all prior sections
  if (section.type === 'checkpoint' && section.requiresPrevious) {
    for (let i = 0; i < sectionIndex; i++) {
      const prev = sections[i]!;
      const progress = state.sections[prev.id];
      if (!progress?.completed) return false;
    }
    return true;
  }

  // Check if any previous quiz gates are blocking
  for (let i = 0; i < sectionIndex; i++) {
    const prev = sections[i]!;
    if (prev.type === 'quiz' && prev.isGate) {
      const progress = state.sections[prev.id];
      if (!progress?.completed) return false;
    }
    if (prev.type === 'checkpoint' && prev.requiresPrevious) {
      const progress = state.sections[prev.id];
      if (!progress?.completed) return false;
    }
  }

  return true;
}

/** Get completion percentage (0-100) */
export function getCompletionPercentage(state: ExplainerProgressState): number {
  const entries = Object.values(state.sections);
  if (entries.length === 0) return 0;
  const completed = entries.filter((s) => s.completed).length;
  return Math.round((completed / entries.length) * 100);
}

/** Get the next incomplete section ID, or null if all complete */
export function getNextIncompleteSection(
  state: ExplainerProgressState,
  sections: ExplainerSection[],
): string | null {
  for (const section of sections) {
    const progress = state.sections[section.id];
    if (!progress?.completed && canAccessSection(state, sections, section.id)) {
      return section.id;
    }
  }
  return null;
}

/** Check if all sections are completed */
export function isExplainerComplete(state: ExplainerProgressState): boolean {
  return Object.values(state.sections).every((s) => s.completed);
}
