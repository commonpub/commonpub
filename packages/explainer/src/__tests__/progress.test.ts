import { describe, it, expect } from 'vitest';
import {
  createProgressState,
  markSectionCompleted,
  canAccessSection,
  getCompletionPercentage,
  getNextIncompleteSection,
  isExplainerComplete,
} from '../progress/tracker';
import type { ExplainerSection } from '../types';

const textSection = (id: string): ExplainerSection => ({
  id,
  title: `Section ${id}`,
  anchor: `section-${id}`,
  type: 'text',
  content: [['text', { html: '<p>Content</p>' }]],
});

const quizGateSection = (id: string): ExplainerSection => ({
  id,
  title: `Quiz ${id}`,
  anchor: `quiz-${id}`,
  type: 'quiz',
  content: [],
  questions: [
    {
      id: 'q1',
      question: 'Q?',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctOptionId: 'a',
    },
  ],
  passingScore: 70,
  isGate: true,
});

const checkpointSection = (id: string): ExplainerSection => ({
  id,
  title: `Checkpoint ${id}`,
  anchor: `checkpoint-${id}`,
  type: 'checkpoint',
  content: [],
  requiresPrevious: true,
});

const sections: ExplainerSection[] = [
  textSection('s1'),
  quizGateSection('s2'),
  textSection('s3'),
  checkpointSection('s4'),
  textSection('s5'),
];

describe('createProgressState', () => {
  it('creates state with all sections marked incomplete', () => {
    const state = createProgressState(sections);
    expect(Object.keys(state.sections)).toHaveLength(5);
    for (const progress of Object.values(state.sections)) {
      expect(progress.completed).toBe(false);
    }
  });

  it('sets timestamps', () => {
    const state = createProgressState(sections);
    expect(state.startedAt).toBeTruthy();
    expect(state.lastAccessedAt).toBeTruthy();
  });

  it('handles empty sections array', () => {
    const state = createProgressState([]);
    expect(Object.keys(state.sections)).toHaveLength(0);
  });
});

describe('markSectionCompleted', () => {
  it('marks a section as completed', () => {
    const state = createProgressState(sections);
    const newState = markSectionCompleted(state, 's1');
    expect(newState.sections.s1.completed).toBe(true);
    expect(newState.sections.s1.completedAt).toBeTruthy();
  });

  it('preserves other sections', () => {
    const state = createProgressState(sections);
    const newState = markSectionCompleted(state, 's1');
    expect(newState.sections.s2.completed).toBe(false);
  });

  it('stores quiz score when provided', () => {
    const state = createProgressState(sections);
    const newState = markSectionCompleted(state, 's2', 85);
    expect(newState.sections.s2.quizScore).toBe(85);
  });

  it('does not mutate original state', () => {
    const state = createProgressState(sections);
    const newState = markSectionCompleted(state, 's1');
    expect(state.sections.s1.completed).toBe(false);
    expect(newState.sections.s1.completed).toBe(true);
  });
});

describe('canAccessSection', () => {
  it('first section is always accessible', () => {
    const state = createProgressState(sections);
    expect(canAccessSection(state, sections, 's1')).toBe(true);
  });

  it('section after quiz gate is blocked when gate not passed', () => {
    const state = createProgressState(sections);
    expect(canAccessSection(state, sections, 's3')).toBe(false);
  });

  it('section after quiz gate is accessible when gate passed', () => {
    let state = createProgressState(sections);
    state = markSectionCompleted(state, 's2', 80);
    expect(canAccessSection(state, sections, 's3')).toBe(true);
  });

  it('checkpoint blocks when previous sections incomplete', () => {
    let state = createProgressState(sections);
    state = markSectionCompleted(state, 's2', 80);
    expect(canAccessSection(state, sections, 's4')).toBe(false);
  });

  it('checkpoint allows when all previous sections complete', () => {
    let state = createProgressState(sections);
    state = markSectionCompleted(state, 's1');
    state = markSectionCompleted(state, 's2', 80);
    state = markSectionCompleted(state, 's3');
    expect(canAccessSection(state, sections, 's4')).toBe(true);
  });

  it('returns false for nonexistent section', () => {
    const state = createProgressState(sections);
    expect(canAccessSection(state, sections, 'nonexistent')).toBe(false);
  });

  it('sections before a gate are accessible', () => {
    const state = createProgressState(sections);
    // s1 is before the quiz gate s2, should be accessible
    expect(canAccessSection(state, sections, 's1')).toBe(true);
  });
});

describe('getCompletionPercentage', () => {
  it('returns 0 for empty progress', () => {
    const state = createProgressState(sections);
    expect(getCompletionPercentage(state)).toBe(0);
  });

  it('returns correct percentage for partial completion', () => {
    let state = createProgressState(sections);
    state = markSectionCompleted(state, 's1');
    state = markSectionCompleted(state, 's2');
    expect(getCompletionPercentage(state)).toBe(40); // 2/5
  });

  it('returns 100 when all complete', () => {
    let state = createProgressState(sections);
    for (const section of sections) {
      state = markSectionCompleted(state, section.id);
    }
    expect(getCompletionPercentage(state)).toBe(100);
  });

  it('returns 0 for empty sections', () => {
    const state = createProgressState([]);
    expect(getCompletionPercentage(state)).toBe(0);
  });
});

describe('getNextIncompleteSection', () => {
  it('returns first section when nothing completed', () => {
    const state = createProgressState(sections);
    expect(getNextIncompleteSection(state, sections)).toBe('s1');
  });

  it('returns next accessible incomplete section', () => {
    let state = createProgressState(sections);
    state = markSectionCompleted(state, 's1');
    expect(getNextIncompleteSection(state, sections)).toBe('s2');
  });

  it('skips locked sections', () => {
    let state = createProgressState(sections);
    state = markSectionCompleted(state, 's1');
    // s2 (quiz gate) is not completed, s3 is locked behind it
    expect(getNextIncompleteSection(state, sections)).toBe('s2');
  });

  it('returns null when all complete', () => {
    let state = createProgressState(sections);
    for (const section of sections) {
      state = markSectionCompleted(state, section.id);
    }
    expect(getNextIncompleteSection(state, sections)).toBeNull();
  });
});

describe('isExplainerComplete', () => {
  it('returns false when not all sections completed', () => {
    const state = createProgressState(sections);
    expect(isExplainerComplete(state)).toBe(false);
  });

  it('returns true when all sections completed', () => {
    let state = createProgressState(sections);
    for (const section of sections) {
      state = markSectionCompleted(state, section.id);
    }
    expect(isExplainerComplete(state)).toBe(true);
  });

  it('returns true for empty sections', () => {
    const state = createProgressState([]);
    expect(isExplainerComplete(state)).toBe(true);
  });
});
