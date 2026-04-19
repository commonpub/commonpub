# Session 133 → 134 Handoff

Fresh Claude Code context. Session 133 closed open-item #3 from the 132
handoff: the Vue quiz UI (editor + viewer) has been rebuilt to match the
canonical shape used by `@commonpub/learning`'s server-side grader, and
`QuizGrade` now carries a per-question `results` array so the viewer can
show which answers were right + their explanations after submission.

**CI should be green on latest `main` once the commit lands. Both prod
sites are healthy. No in-flight work.** The next session can pick a
follow-up from the list below, or take a fresh priority from the user.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Critical:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     `Signed-off-by:`, or AI attribution — in any commit, in any repo.
   - No feature without a flag in `commonpub.config.ts`.
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`.
2. `docs/sessions/133-quiz-ui-rebuild.md` — the session log.
3. `docs/sessions/132-handoff-prompt.md` — the prior handoff. Most of
   its "open items" list is still relevant; #3 (quiz UI) is now done.
4. `docs/sessions/131-constraints-ci-flakes-observability.md` — the big
   block before 132 (Redis observability + migration 0002 + e2e flakes).
5. `docs/llm/gotchas.md` — short-form pitfalls, still current.

## Current state (2026-04-19, end of 133)

**Deployed and healthy (`NUXT_REDIS_URL` unset; memory fallback path):**
- commonpub.io + deveco.io — migrations 0000/0001/0002 applied, health
  endpoints 200. No schema changes this session.

**Published package versions:**
- `@commonpub/schema` **0.14.4** (unchanged)
- `@commonpub/server` **2.47.3** ← bumped — `markLessonComplete` returns
  `quiz.results` via the learning dep.
- `@commonpub/learning` **0.5.2** ← bumped — `QuizGrade.results` added.
- `@commonpub/layer` **0.18.2** ← bumped — quiz editor + viewer rebuilt.
- `@commonpub/infra` **0.6.1**, config **0.11.0**, explainer **0.7.12**,
  ui **0.8.5**, protocol **0.9.9**, editor **0.7.9**, docs **0.6.2**,
  auth **0.5.1**, test-utils **0.5.3** — unchanged.

## Open items (pick one, or wait for user direction)

Items 1, 2, 4–8 are unchanged from the 132 handoff. Item 3 (Vue quiz UI)
is DONE (session 133). Re-listing for quick reference:

### High-value, low-effort

1. **Flip `NUXT_REDIS_URL` in prod** — still "wired, not flipped." Ask
   before flipping. Runbook at
   `codebase-analysis/12-scaling-and-infrastructure.md`.

2. **Hero-banner dismiss flake — properly debug.** Trace capture is now
   wired: `playwright.config.ts` has `trace: 'on-first-retry'` (already
   there), and the e2e CI job uploads `playwright-report/` +
   `test-results/` as an artifact on failure (added end of session 133).
   Next steps: un-fixme `apps/reference/e2e/navigation.spec.ts:29`, push,
   wait for the expected CI failure, download the `playwright-report`
   artifact, and run `pnpm exec playwright show-trace
   test-results/.../trace.zip` locally. Theories already ruled out:
   useState remount, Vue template auto-unwrap-on-write.

3. ~~Vue quiz UI rebuild~~ — DONE, session 133.

4. **Wire `onRedisError` to observability.** Sink is still `console.warn`.
   Swap when a structured logger / metrics surface lands.

### Medium

5. **`audittest` user cleanup** — self-flagged session 127. Admin's call.
6. **Mobile responsive audit** — ~70 components without `@media`.

### Low / pre-existing

7. **`useAuth.ts` TS2589 deep instantiation** — pre-existing.
8. **Session store → Redis, BullMQ for activity delivery,
   API-response caching** — deferred by 130 scope.

## Non-obvious things to know (carryover from 132 + new from 133)

- `RateLimitStore.check()` is async. `checkRateLimit()` is async.
- Turbo 2.x strips env vars unless declared on the task (see `turbo.json`'s
  `test` env array).
- Redis pub/sub subscriber MUST keep `enableOfflineQueue: true`; publisher
  is fast-fail.
- `rsvpEvent` uses `ON CONFLICT DO NOTHING` on
  `event_attendees_event_user_unique`.
- `federated_content.mirror_id` FK is `ON DELETE SET NULL`.
- **NEW:** `QuizGrade` has a `results` field. `gradeQuiz`'s return is
  backward-compatible (additive), but if you `.toEqual(...)` on the
  result, switch to `.toMatchObject(...)` or add `results` to the
  expected object.
- **NEW:** The learn-lesson viewer relies on `result.explanation`
  coming back from the complete endpoint (via `QuizQuestionResult`),
  NOT from the GET lesson response (redacted). If someone adds a
  shortcut local-grade path in the viewer, the redacted GET response
  means `q.correctOptionId` will be undefined and local grading will
  silently score everyone 0%.
- **NEW:** The editor writes IDs via `crypto.randomUUID()`. Works in
  modern browsers and Node 19+ — the Nuxt 3 reference app targets
  Node 22 so no polyfill needed.

## Standing rules

- **Never add Claude as co-author** — no `Co-Authored-By:`,
  `Signed-off-by:`, or AI attribution anywhere, ever.
- **Conventional commits** — `feat(infra):`, `fix(auth):`, etc.
- **Atomic commits.** One logical change per commit.
- **`pnpm publish`**, never `npm publish`.
- **Schema changes via committed migrations** — never `drizzle-kit push`
  in CI.

## Quick reference

- Migration state:
  `ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"'`
- Quiz-lesson count check:
  `SELECT COUNT(*) FROM learning_lessons WHERE type = 'quiz';`
  Expected: 0 on both instances.
- CI runs: `gh -R commonpub/commonpub run list --branch main --limit 3`.
- Session logs are the authoritative recent-changes record.
