# Session 129 — Quiz security + docs FTS + jsonb double-stringify fix

Date: 2026-04-17

Picks A + B from the session-128 handoff; defers C (Redis) with a written plan.

## What shipped

### A. Server-side quiz grading

**Problem** (session-128 audit): `POST /api/learn/:slug/:lessonSlug/complete`
accepted client-supplied `quizScore` / `quizPassed` verbatim; `GET` returned
`lesson.content` including `correctOptionId`. Certificate gaming + answer leak.

**Fix:**
- New `gradeQuiz(content, answers)` in `@commonpub/learning/quiz` — pure
  server-side grader keyed by `correctOptionId`.
- New `redactQuizAnswers(content)` — strips `correctOptionId` + `explanation`
  from each question.
- `markLessonComplete(db, userId, lessonId, answers?)` — signature changed.
  For quiz lessons: answers required, server grades, score/passed derived.
  For non-quiz: answers ignored.
- `completeLessonSchema` Zod validator is `.strict()` — only `{answers}`
  whitelisted. `quizScore` / `quizPassed` from the body are rejected.
- `GET /api/learn/:slug/:lessonSlug` calls `redactQuizAnswers` unless the
  caller is the path author (`user.id === result.pathAuthorId`).
- Retries never regress a prior pass — `completed` latches on first pass.

**Tests:** 15 `gradeQuiz`/`redactQuizAnswers` unit + 7 validator + 4
quiz-lifecycle integration (pass, fail-no-regress, require-answers,
partial-credit).

**Packages:** `@commonpub/learning@0.5.1`, `@commonpub/server@2.46.0`.

### B. Docs FTS — snippets over block text

**Problem** (session-128 audit): `searchDocsPages` tokenized
`title || ' ' || content` where `content` is jsonb. PG coerced jsonb to its
JSON text representation. Search still worked for real words, but snippets
looked like `[["paragraph",{"html":""}]]` in the UI.

**Fix:** rewrote `searchDocsPages` as a `LEFT JOIN LATERAL` that extracts
text from each BlockTuple's `html` / `text` / `code` / `title` field,
strips HTML tags via `regexp_replace`, and feeds the clean prose to both
`to_tsvector` and `ts_headline`. Handles three content shapes:
- Proper jsonb array (new/fixed data)
- jsonb STRING containing JSON text (historical — see root-cause below)
- Legacy markdown string

**Tests:** 7 integration tests covering exact match, tag stripping, code
block matching, prefix, empty, no-match.

### Root-cause bug found while fixing B — `docs_pages.content` double-stringify

While the FTS SQL was right, tests kept showing raw JSON in snippets. Traced
to `createDocsPage` / `updateDocsPage` calling `JSON.stringify(input.content)`
before handing to drizzle. Drizzle's jsonb column serializes on insert, so
the manual stringify double-encoded: content landed in the DB as a jsonb
STRING (`jsonb_typeof = 'string'`) whose value was the JSON text of a
BlockTuple array.

The app appeared to work because drizzle's `mapFromDriverValue` does a
secondary `JSON.parse` at read time, unwrapping the string back to an
array. But SQL functions (`jsonb_typeof`, `jsonb_array_elements`, etc.)
saw the raw shape — strings — and couldn't reach block contents.

**Fix:**
- Pass `input.content` directly to drizzle. Same shape for both new and
  legacy string cases.
- `migrations/0001_docs_content_unstringify.sql` unwraps existing rows
  where `jsonb_typeof = 'string'` AND the string value begins with `[` or
  `{` (JSON-looking). Legacy plain-markdown strings are left alone.

**Packages:** `@commonpub/schema@0.14.3` (new migration 0001),
`@commonpub/server@2.46.1` (bundled with the FTS + createDocsPage fix).

**Verified on prod:**
- commonpub.io `docs_pages`: was 2 rows (1 empty string, 1 double-stringified
  BlockTuple array). Post-migration: 1 string (empty, legitimate), 1 array
  (unwrapped). `asadd` page still renders correctly in the UI.
- deveco.io `docs_pages`: 0 rows.
- `drizzle.__drizzle_migrations` on both DBs now has migration 0001 applied
  (`c2b9a06ad057023f743363590b482fef0870352d20e1da5f0b4cfe2434e6a460`,
  `created_at = 1776471555782`).
- Live search sanity: `GET /api/docs/yolo/search?q=asadd` returns snippet
  `<b>asadd</b> ` — clean, no raw JSON.

### C. Redis — deferred with written plan

`docs/plans/redis-integration.md` captures scope + migration path + risks
for wiring Redis to replace:
- The in-process rate-limit Map (`packages/infra/src/security.ts`) + the
  inline map in `packages/server/src/publicApi/middleware.ts`.
- Single-instance SSE polling in `layers/base/server/api/realtime/stream.ts`.

Estimated 2–3 days. See plan doc for the full breakdown.

## Version bumps

| Package | Before | After |
|---|---|---|
| `@commonpub/schema` | 0.14.2 | 0.14.3 |
| `@commonpub/server` | 2.45.1 | 2.46.1 |
| `@commonpub/learning` | 0.5.0 | 0.5.1 |

Consumer pins bumped across the workspace (and in deveco's `package.json`).

## Known gaps / follow-ups (not addressed this session)

1. **Vue quiz UI is broken independent of this session.** The learn-lesson
   page (`layers/base/pages/learn/[slug]/[lessonSlug]/index.vue`) collects
   answers using `correctIndex: number` from a non-canonical quiz shape,
   and `markComplete()` sends no body. For non-quiz lessons this is fine.
   For quiz lessons, the new server returns `400 Quiz lessons require
   answers`. There are zero quiz lessons in prod today, so no user impact,
   but a proper UI rebuild is needed before anyone ships a real quiz. The
   Vue should switch to the canonical `{id, options:[{id,text}],
   correctOptionId}` shape (already used everywhere else) and send
   `{answers: {questionId: optionId}}` to the server.
2. **Snippet highlighting.** `ts_headline` returns `<b>...</b>` around
   matched tokens. The UI doesn't currently bold them — just renders the
   plain string. Nice-to-have.
3. **Redis integration** — see `docs/plans/redis-integration.md`.
4. **Quiz answer explanations** — currently stripped from `GET lesson` for
   non-authors along with `correctOptionId`. A future UX might want to
   surface the explanation AFTER a learner submits an answer, via a
   separate endpoint that includes the explanation per question answered.

## Deploys

- commonpub: commit `9e3ccd3`, deploy run `24592410141`, `db:migrate succeeded`.
- deveco: commit `a56fe32`, deploy success, `db:migrate succeeded`.
- Both sites live, health checks green, docs + learn endpoints still 200.

## Audit notes (post-commit cleanup)

- Removed dead variables `langIdent` + `extractedTextSql` that were leftover
  scaffolding from an earlier iteration of the FTS refactor. Commit to
  follow after this log lands.
- Verified no other callers of `markLessonComplete` or `getLessonBySlug`
  needed updating — both are used only by the two API routes I touched
  and the integration tests.
- All 912 server tests + 97 learning tests green. Reference app typecheck
  green.
