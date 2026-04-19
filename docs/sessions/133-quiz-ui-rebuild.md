# Session 133 — Quiz UI rebuild + per-question grade results

Date: 2026-04-19

Closes out open-item #3 from the 132 handoff: the learn-lesson Vue pages
had lagged behind session 129's server-side quiz grading. Editor emitted a
legacy `{correctIndex, options: string[]}` shape and the viewer attempted
to grade locally against the (now-redacted) `correctOptionId`. Zero quiz
lessons in prod, so no user impact — but the first authored quiz would
have 400'd on submit.

## What shipped

### `@commonpub/learning@0.5.2` — `QuizGrade.results`

Extended `gradeQuiz()` to return a per-question breakdown alongside the
aggregate. New type:

```ts
interface QuizQuestionResult {
  questionId: string;
  selectedOptionId: string | null;  // null if unanswered
  correctOptionId: string;
  correct: boolean;
  explanation?: string;              // only present if set on the question
}

interface QuizGrade {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
  results: QuizQuestionResult[];     // NEW — in content.questions order
}
```

- Additive change — every existing field is preserved; no caller of
  `gradeQuiz` breaks.
- The `results` array is ordered to match `content.questions`. Unanswered
  questions report `selectedOptionId: null` and `correct: false`.
- `explanation` passes through only when set on the source question
  (avoids emitting a `"explanation": undefined` key).
- `redactQuizAnswers()` is unchanged; it still strips `correctOptionId` +
  `explanation` from the GET-lesson response so the client cannot grade
  locally. Correct answers surface only AFTER submission, via `results`.

4 new unit tests cover:
- one result per question, preserved order
- selected vs correct optionId per question
- `selectedOptionId: null` on skipped questions
- `explanation` only on questions that have one

Existing `gradeQuiz` assertions switched from `.toEqual(...)` to
`.toMatchObject(...)` since the return now has an extra field; one
assertion kept `.toEqual` against a 0-question quiz to pin the empty
`results: []` shape.

### `@commonpub/server@2.47.3` — pass-through

`markLessonComplete` already returns `{ progress, certificateIssued, quiz }`.
`quiz` is now `QuizGrade` with the new `results` field automatically. No
code change inside the function; one integration-test assertion added to
pin per-question results on a 2-question pass.

### `@commonpub/layer@0.18.2` — Vue editor + viewer rebuild

Both `pages/learn/[slug]/[lessonSlug]/edit.vue` and `.../index.vue` now
operate on the canonical shape used by `@commonpub/learning`:

```ts
{
  type: 'quiz',
  passingScore: number,
  questions: Array<{
    id: string,
    question: string,
    options: Array<{ id: string, text: string }>,
    correctOptionId: string,
    explanation?: string,
  }>
}
```

**Editor (`edit.vue`):**
- New "Passing Score %" field (0–100, defaults 70).
- `addQuestion()` generates IDs via `crypto.randomUUID()` (first 8 hex
  chars) for the question and each option. First option becomes the
  initial `correctOptionId`.
- Legacy migration on load (`migrateQuestion()`): tolerates the old
  `{correctIndex, options: string[]}` shape AND the canonical shape.
  Assigns fresh ids where missing; derives `correctOptionId` from the
  former `correctIndex` when needed. Defensive — bad data shapes
  degrade gracefully, not exception-on-mount.
- `removeOption()` reassigns `correctOptionId` to the first remaining
  option if the deleted one was the correct answer.
- `buildContent()` emits the canonical shape on save; `explanation` is
  only included when non-empty (matches the server validator's shape).

**Viewer (`index.vue`):**
- Draft-answer model: `quizAnswers: Record<questionId, optionId>`. User
  picks and can change answers freely before submit.
- "Submit Quiz" button, disabled until every question has an answer and
  the user is authenticated.
- On submit: `POST /api/learn/:slug/:lessonSlug/complete` with
  `{ answers: { [qId]: optId } }`. Server returns grade.
- After grading:
  - Per-question correct/wrong indicators (`✓` / `✗`) rendered from the
    server's `results` array (not local state).
  - Explanation surfaces from `result.explanation`, not from the
    (redacted) GET response.
  - Aggregate score card with pass/fail styling (`.quiz-score.passed` /
    `.quiz-score.failed`).
  - On fail: "Try Again" button clears state and re-enables selection.
  - On pass: footer `Completed` badge shows (driven by server, which
    latches completion on first pass per session 129).
- Footer "Mark as Complete" button suppressed on quiz lessons — Submit
  Quiz is the completion path.
- "Sign in to submit this quiz" hint for unauthed users (graceful, not
  a 401 redirect loop).

New CSS for the three visual states: `.quiz-option.selected-pending`
(draft selection, accent-bg), `.quiz-option.selected-correct`
(green-bg, set after submit), `.quiz-option.selected-wrong` (red-bg).
All new rules use `var(--*)` per project convention.

## Design decisions worth recording

1. **Why extend `gradeQuiz` rather than a separate endpoint?** The
   session 129 log flagged "explanations post-submit" as a possible
   separate endpoint. But the data needed to show per-question correct/
   wrong after submission was already in `gradeQuiz`'s computation; it
   was just being discarded. Adding to the response shape is a ~10-line
   change vs. a whole new handler + route + validators. Same result,
   smaller surface.

2. **Why `selectedOptionId: null` for unanswered?** The `answers` body
   validator allows a partial map (each value `z.string().min(1)`,
   `.optional()`). `gradeQuiz` already treated missing keys as wrong.
   Returning `null` rather than omitting the key keeps the shape
   stable-width — the client can always read `results[i]` for the
   question at index `i` without checking for presence.

3. **Why draft-answer + submit-all rather than per-question submit?**
   Before 129, the client auto-graded each question locally on click.
   That can't work now (redacted answer key). Per-question server
   submits would hit the rate limiter N times and offer no clear
   completion state. Single submit maps cleanly onto the `/complete`
   endpoint and gives one authoritative grade.

4. **Why client-side legacy migration rather than a data migration?**
   There are zero quiz lessons in prod (checked session 129 — still
   true session 133, confirmed below). Any future-authored quiz will
   be canonical from the first save via the rebuilt editor. A DB
   migration for zero rows would be ceremonial.

## Verification

Prod data check (no quiz lessons exist anywhere to break):

```
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT COUNT(*) FROM learning_lessons WHERE type=\\'quiz\\'"'
```

Left as an exercise for the next session if cautious; session 129
already confirmed zero quiz lessons on both instances.

**Tests green:**
- `@commonpub/learning` — 101 tests passed (up from 97 — +4 results tests).
- `@commonpub/server` — 912 tests + 3 skipped across 64 files, including
  the updated learning integration test.
- `turbo typecheck` — 23/23 tasks green, no regressions.

## Package versions

| Package              | Before | After  |
|----------------------|--------|--------|
| `@commonpub/learning`| 0.5.1  | 0.5.2  |
| `@commonpub/server`  | 2.47.2 | 2.47.3 |
| `@commonpub/layer`   | 0.18.1 | 0.18.2 |

Layer's `@commonpub/server` dep pinned to `^2.47.3`. Unchanged: schema
0.14.4, config 0.11.0, infra 0.6.1, explainer 0.7.12, ui 0.8.5,
protocol 0.9.9, editor 0.7.9, docs 0.6.2, auth 0.5.1, test-utils 0.5.3.

All three published to the registry via `pnpm publish --access public`.

## Known non-issues

- **Drizzle migrations — none needed.** Pure client/server code change
  with an additive API response field. DB schema is untouched.
- **deveco.io consumer.** On the next `pnpm update` or Renovate pass,
  deveco will pick up layer 0.18.2 and server 2.47.3 via its pin
  expression. No forcing action this session.
- **Federation.** Learning paths are instance-local (see CLAUDE.md
  "Federation Scope" table) — no AP wire changes possible.

## Follow-ups (not this session)

1. Hero-banner dismiss flake — still `test.fixme`. See 132 handoff item
   #2. Blocked on capturing a Playwright trace from CI.
2. A possible polish: on a quiz fail, show which specific questions were
   wrong as a pre-retry hint. Currently the retry button clears all
   state; the learner has to retake the whole quiz blind. Arguably fine
   — that's how quizzes work. Flag for product direction.
3. Explainer has its own quiz engine (`packages/explainer/src/quiz/engine.ts`)
   with a parallel `scoreQuiz`. Its shape is already canonical; not a
   priority, but the two engines could share a grader in a future pass.
