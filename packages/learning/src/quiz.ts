import type { QuizLessonContent } from './types.js';

export interface QuizQuestionResult {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  correct: boolean;
  explanation?: string;
}

export interface QuizGrade {
  /** Number of questions answered correctly */
  correct: number;
  /** Total number of questions */
  total: number;
  /** Percentage score, 0–100 rounded to nearest integer */
  score: number;
  /** True when score >= content.passingScore */
  passed: boolean;
  /** Per-question breakdown in `content.questions` order */
  results: QuizQuestionResult[];
}

/**
 * Score a quiz submission against its answer key.
 *
 * Pure / synchronous — safe to call from server routes, test harnesses, and
 * client-side preview without any IO. The answer key is `correctOptionId` on
 * each question; this function should only ever be called on the server side
 * with the full quiz content (including correct answers), because that's the
 * whole point of server-side grading.
 *
 * Missing answers (questionId not present in `answers`) count as wrong. Extra
 * keys in `answers` that don't match any question are ignored.
 *
 * The `results` field is the per-question breakdown — includes
 * `correctOptionId` and `explanation`, which are safe to return to the learner
 * only AFTER submission (unlike the GET-lesson response, which redacts them).
 */
export function gradeQuiz(
  content: QuizLessonContent,
  answers: Record<string, string>,
): QuizGrade {
  const total = content.questions.length;
  if (total === 0) {
    return { correct: 0, total: 0, score: 0, passed: false, results: [] };
  }
  let correct = 0;
  const results: QuizQuestionResult[] = [];
  for (const q of content.questions) {
    const selected = answers[q.id] ?? null;
    const isCorrect = selected !== null && selected === q.correctOptionId;
    if (isCorrect) correct++;
    const result: QuizQuestionResult = {
      questionId: q.id,
      selectedOptionId: selected,
      correctOptionId: q.correctOptionId,
      correct: isCorrect,
    };
    if (q.explanation !== undefined) result.explanation = q.explanation;
    results.push(result);
  }
  const score = Math.round((correct / total) * 100);
  return {
    correct,
    total,
    score,
    passed: score >= content.passingScore,
    results,
  };
}

/**
 * Strip answer keys from quiz content before returning to non-author clients.
 *
 * Returns a shallow copy of the quiz content with every question's
 * `correctOptionId` and `explanation` fields removed. Safe to call on any
 * lesson content — returns unchanged for non-quiz shapes.
 */
export function redactQuizAnswers<T extends { type?: string; questions?: unknown }>(
  content: T,
): T {
  if (!content || typeof content !== 'object') return content;
  if (content.type !== 'quiz' || !Array.isArray(content.questions)) return content;
  return {
    ...content,
    questions: content.questions.map((q) => {
      if (!q || typeof q !== 'object') return q;
      const { correctOptionId: _c, explanation: _e, ...safe } = q as Record<string, unknown>;
      void _c;
      void _e;
      return safe;
    }),
  };
}
