import type { QuizQuestion, AnswerResult, QuizResult } from '../types.js';

/** Check a single answer against a question */
export function checkAnswer(question: QuizQuestion, selectedOptionId: string): AnswerResult {
  const correct = question.correctOptionId === selectedOptionId;
  return {
    correct,
    explanation: question.explanation,
  };
}

/** Score a complete quiz given questions and a map of answers */
export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, string>, passingScore = 70): QuizResult {
  let correct = 0;
  for (const question of questions) {
    const selected = answers[question.id];
    if (selected === question.correctOptionId) {
      correct++;
    }
  }
  const total = questions.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { score, passed: isQuizPassed(score, passingScore), total, correct };
}

/** Check if a quiz score meets the passing threshold */
export function isQuizPassed(score: number, passingScore: number): boolean {
  return score >= passingScore;
}

/** Validate that all questions have been answered */
export function validateQuizAnswers(
  questions: QuizQuestion[],
  answers: Record<string, string>,
): { valid: boolean; unanswered: string[] } {
  const unanswered: string[] = [];
  for (const question of questions) {
    if (!answers[question.id]) {
      unanswered.push(question.id);
    }
  }
  return { valid: unanswered.length === 0, unanswered };
}

/** Deterministic shuffle of quiz options using a seed */
export function shuffleOptions<T>(items: T[], seed?: number): T[] {
  const result = [...items];
  if (seed === undefined) {
    // Fisher-Yates with Math.random
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = result[i]!;
      result[i] = result[j]!;
      result[j] = tmp;
    }
    return result;
  }

  // Deterministic shuffle using a simple seeded PRNG (mulberry32)
  let s = seed | 0;
  const random = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}
