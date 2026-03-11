<script lang="ts">
  import { checkAnswer, scoreQuiz, isQuizPassed, validateQuizAnswers } from '@snaplify/explainer';
  import type { QuizQuestion } from '@snaplify/explainer';

  let {
    questions,
    passingScore,
    isGate,
    oncomplete,
  }: {
    questions: QuizQuestion[];
    passingScore: number;
    isGate: boolean;
    oncomplete?: (score: number, passed: boolean) => void;
  } = $props();

  let answers = $state<Record<string, string>>({});
  let submitted = $state(false);
  let score = $state(0);
  let passed = $state(false);
  let feedback = $state<Record<string, { correct: boolean; explanation?: string }>>({});
  let validationError = $state('');

  function selectAnswer(questionId: string, optionId: string) {
    if (submitted) return;
    answers = { ...answers, [questionId]: optionId };
  }

  function handleSubmit(e: Event) {
    e.preventDefault();

    const validation = validateQuizAnswers(questions, answers);
    if (!validation.valid) {
      validationError = `Please answer all questions (${validation.unanswered.length} remaining)`;
      return;
    }
    validationError = '';

    const result = scoreQuiz(questions, answers);
    score = result.score;
    passed = isQuizPassed(result.score, passingScore);
    submitted = true;

    const fb: Record<string, { correct: boolean; explanation?: string }> = {};
    for (const q of questions) {
      const answer = checkAnswer(q, answers[q.id] ?? '');
      fb[q.id] = answer;
    }
    feedback = fb;

    oncomplete?.(score, passed);
  }

  function handleRetry() {
    answers = {};
    submitted = false;
    score = 0;
    passed = false;
    feedback = {};
    validationError = '';
  }
</script>

<form class="quiz" onsubmit={handleSubmit} aria-label="Quiz">
  {#each questions as question, i}
    <fieldset class="quiz__question" data-question-id={question.id}>
      <legend class="quiz__question-text">{i + 1}. {question.question}</legend>
      <div class="quiz__options" role="radiogroup" aria-label="Options for question {i + 1}">
        {#each question.options as option}
          <label
            class="quiz__option"
            class:quiz__option--selected={answers[question.id] === option.id}
            class:quiz__option--correct={submitted &&
              feedback[question.id]?.correct &&
              answers[question.id] === option.id}
            class:quiz__option--incorrect={submitted &&
              !feedback[question.id]?.correct &&
              answers[question.id] === option.id}
          >
            <input
              type="radio"
              name="q-{question.id}"
              value={option.id}
              checked={answers[question.id] === option.id}
              disabled={submitted}
              onchange={() => selectAnswer(question.id, option.id)}
            />
            <span>{option.text}</span>
          </label>
        {/each}
      </div>
      {#if submitted && feedback[question.id]}
        <div
          class="quiz__feedback"
          class:quiz__feedback--correct={feedback[question.id]?.correct}
          class:quiz__feedback--incorrect={!feedback[question.id]?.correct}
          aria-live="polite"
        >
          {feedback[question.id]?.correct ? 'Correct!' : 'Incorrect'}
          {#if feedback[question.id]?.explanation}
            <span class="quiz__explanation"> — {feedback[question.id]?.explanation}</span>
          {/if}
        </div>
      {/if}
    </fieldset>
  {/each}

  {#if validationError}
    <div class="quiz__error" role="alert">{validationError}</div>
  {/if}

  {#if !submitted}
    <button type="submit" class="quiz__submit">Submit Answers</button>
  {:else}
    <div
      class="quiz__result"
      class:quiz__result--passed={passed}
      class:quiz__result--failed={!passed}
      aria-live="polite"
    >
      <p>Score: {score}% — {passed ? 'Passed!' : 'Not passed'}</p>
      {#if isGate && !passed}
        <p class="quiz__gate-message">You need {passingScore}% to continue.</p>
      {/if}
    </div>
    {#if !passed}
      <button type="button" class="quiz__retry" onclick={handleRetry}>Try Again</button>
    {/if}
  {/if}
</form>

<style>
  .quiz {
    margin-top: var(--space-4, 1rem);
  }

  .quiz__question {
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    padding: var(--space-4, 1rem);
    margin-bottom: var(--space-4, 1rem);
  }

  .quiz__question-text {
    font-weight: var(--font-weight-semibold, 600);
    margin-bottom: var(--space-2, 0.5rem);
    color: var(--color-text, #d8d5cf);
  }

  .quiz__options {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .quiz__option {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: background 0.15s;
  }

  .quiz__option:hover {
    background: var(--color-surface-alt, #1c1c1a);
  }

  .quiz__option--correct {
    background: var(--color-success-bg, #f0fdf4);
  }

  .quiz__option--incorrect {
    background: var(--color-error-bg, #fef2f2);
  }

  .quiz__option input[type='radio'] {
    accent-color: var(--color-primary, #2563eb);
  }

  .quiz__feedback {
    margin-top: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
  }

  .quiz__feedback--correct {
    color: var(--color-success, #22c55e);
  }
  .quiz__feedback--incorrect {
    color: var(--color-error, #dc2626);
  }

  .quiz__explanation {
    font-style: italic;
    opacity: 0.8;
  }

  .quiz__error {
    color: var(--color-error, #dc2626);
    margin-bottom: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
  }

  .quiz__submit,
  .quiz__retry {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    border: none;
    padding: var(--space-2, 0.5rem) var(--space-6, 2rem);
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
  }

  .quiz__submit:hover,
  .quiz__retry:hover {
    opacity: 0.9;
  }

  .quiz__submit:focus-visible,
  .quiz__retry:focus-visible {
    outline: 2px solid var(--color-primary, #2563eb);
    outline-offset: 2px;
  }

  .quiz__result {
    padding: var(--space-4, 1rem);
    border-radius: var(--radius-md, 6px);
    margin-bottom: var(--space-4, 1rem);
  }

  .quiz__result--passed {
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
  }
  .quiz__result--failed {
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
  }

  .quiz__gate-message {
    font-weight: var(--font-weight-semibold, 600);
  }
</style>
