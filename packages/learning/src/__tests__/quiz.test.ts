import { describe, it, expect } from 'vitest';
import { gradeQuiz, redactQuizAnswers } from '../quiz.js';
import type { QuizLessonContent } from '../types.js';

const quiz: QuizLessonContent = {
  type: 'quiz',
  passingScore: 70,
  questions: [
    {
      id: 'q1',
      question: '2 + 2 = ?',
      options: [
        { id: 'a', text: '3' },
        { id: 'b', text: '4' },
        { id: 'c', text: '5' },
      ],
      correctOptionId: 'b',
      explanation: 'arithmetic',
    },
    {
      id: 'q2',
      question: 'Capital of France?',
      options: [
        { id: 'a', text: 'London' },
        { id: 'b', text: 'Paris' },
      ],
      correctOptionId: 'b',
    },
    {
      id: 'q3',
      question: 'HTTP stands for?',
      options: [
        { id: 'a', text: 'HyperText Transfer Protocol' },
        { id: 'b', text: 'Highly Technical Transfer Protocol' },
      ],
      correctOptionId: 'a',
    },
  ],
};

describe('gradeQuiz', () => {
  it('scores 100 and passes when all answers are correct', () => {
    expect(gradeQuiz(quiz, { q1: 'b', q2: 'b', q3: 'a' }))
      .toEqual({ correct: 3, total: 3, score: 100, passed: true });
  });

  it('scores 0 and fails when all answers are wrong', () => {
    expect(gradeQuiz(quiz, { q1: 'a', q2: 'a', q3: 'b' }))
      .toEqual({ correct: 0, total: 3, score: 0, passed: false });
  });

  it('partial credit — 2 of 3 correct scores 67 (below 70 passingScore)', () => {
    expect(gradeQuiz(quiz, { q1: 'b', q2: 'b', q3: 'b' }))
      .toEqual({ correct: 2, total: 3, score: 67, passed: false });
  });

  it('treats missing answers as wrong', () => {
    expect(gradeQuiz(quiz, { q1: 'b' }))
      .toEqual({ correct: 1, total: 3, score: 33, passed: false });
  });

  it('treats empty answers as all wrong', () => {
    expect(gradeQuiz(quiz, {}))
      .toEqual({ correct: 0, total: 3, score: 0, passed: false });
  });

  it('ignores extraneous answer keys that do not match any questionId', () => {
    expect(gradeQuiz(quiz, { q1: 'b', q2: 'b', q3: 'a', bogus: 'x' }))
      .toEqual({ correct: 3, total: 3, score: 100, passed: true });
  });

  it('passes when score >= passingScore (threshold edge)', () => {
    const strict: QuizLessonContent = { ...quiz, passingScore: 67 };
    expect(gradeQuiz(strict, { q1: 'b', q2: 'b', q3: 'b' }).passed).toBe(true);
  });

  it('empty questions → score 0, not passed', () => {
    const empty: QuizLessonContent = { type: 'quiz', passingScore: 70, questions: [] };
    expect(gradeQuiz(empty, {})).toEqual({ correct: 0, total: 0, score: 0, passed: false });
  });

  it('does NOT accept wrong optionId that happens to equal correctOptionId on another question', () => {
    // Guards against an off-by-one where answers[q1] leaks into q2 grading.
    // q1 correct is 'b', q2 correct is 'b' — submitting q1:'a', q2:'b' should score only q2.
    expect(gradeQuiz(quiz, { q1: 'a', q2: 'b', q3: 'a' }))
      .toEqual({ correct: 2, total: 3, score: 67, passed: false });
  });
});

describe('redactQuizAnswers', () => {
  it('removes correctOptionId and explanation from each question', () => {
    const redacted = redactQuizAnswers(quiz);
    expect(redacted.type).toBe('quiz');
    expect(redacted.passingScore).toBe(70);
    expect(redacted.questions).toHaveLength(3);
    for (const q of redacted.questions as Record<string, unknown>[]) {
      expect(q).not.toHaveProperty('correctOptionId');
      expect(q).not.toHaveProperty('explanation');
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('options');
    }
  });

  it('keeps the question and option text intact', () => {
    const redacted = redactQuizAnswers(quiz);
    const q1 = (redacted.questions as Record<string, unknown>[])[0]!;
    expect(q1.id).toBe('q1');
    expect(q1.question).toBe('2 + 2 = ?');
    expect((q1.options as Array<{ id: string; text: string }>)[1]).toEqual({ id: 'b', text: '4' });
  });

  it('returns non-quiz content unchanged', () => {
    const article = { type: 'article', blocks: [['paragraph', { html: 'x' }]] };
    expect(redactQuizAnswers(article)).toBe(article);
  });

  it('handles null/undefined/primitive input defensively', () => {
    expect(redactQuizAnswers(null as unknown as { type?: string })).toBe(null);
    expect(redactQuizAnswers(undefined as unknown as { type?: string })).toBe(undefined);
    expect(redactQuizAnswers('string' as unknown as { type?: string })).toBe('string');
  });

  it('is idempotent — redacting twice does not break', () => {
    const once = redactQuizAnswers(quiz);
    const twice = redactQuizAnswers(once as QuizLessonContent);
    expect(twice).toEqual(once);
  });

  it('does not mutate the original quiz content', () => {
    const original = JSON.parse(JSON.stringify(quiz));
    redactQuizAnswers(quiz);
    expect(quiz).toEqual(original);
  });
});
