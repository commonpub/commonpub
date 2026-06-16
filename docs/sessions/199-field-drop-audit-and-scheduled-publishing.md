# Session 199 — Hub image fix + repo-wide field-drop audit + scheduled publishing

Date: 2026-06-15
Branch: `main` (NOT committed / published / deployed at session end — code only)

## What was done

### 1. Root cause: hub cover/banner images vanished on create

User report: hub cover + banner image upload broken on commonpub.io. The upload
itself worked (`ImageUpload.vue` → `/api/files/upload` returns a URL) and the hub
pages render `iconUrl`/`bannerUrl`. The defect was **persistence**:

- `createHub()` (`packages/server/src/hub/hub.ts`) typed its input as only
  `{name, description, rules, joinPolicy}` and its `.insert().values({})` omitted
  `iconUrl`, `bannerUrl`, `hubType`, `privacy`, `website`, `categories`,
  `parentHubId` — even though `createHubSchema` accepts them all and the route
  passes the full parsed input. The image URLs were uploaded but never written.
- `updateHub()` (the settings path) also dropped `privacy`, `website`, `hubType`,
  `categories` though `settings.vue` submits `privacy` + `website`.

Fix: widened both functions to the full validated field set and persisted them.
Tests strengthened to ASSERT persistence (the old tests passed the fields but
never checked them — vitest/esbuild does no typecheck, so the drop was invisible).

### 2. Repo-wide audit for the same bug class

Bug class: **a Zod create/update validator omits (and `parseBody` strips) a field
the UI sends and the server can store, OR the server write function's typed param
omits it** → silent data loss. Fanned out 5 parallel auditors over every
create/update path, then verified each finding against source.

Confirmed and FIXED (all 5):

| # | Field | Where | Fix |
|---|-------|-------|-----|
| 1 | `categoryId` | `createVideoSchema` omitted it → every video saved with NULL category, never appeared under its category filter | added to schema; also surfaced `categoryId`/`categoryName`/`categorySlug` on the video read path (left join) which exposed NOTHING before |
| 2 | content `slug` | editor slug input was a silent no-op (schema had no `slug`; `updateContent` only re-slugged on title change) | added `slug` to content create/update schema (loose, normalized via `generateSlug`); create + update now honor it |
| 3 | content `scheduledAt` | schedule-publish UI in BlogEditor with no column/schema/impl | **implemented** (see §3) |
| 4 | learning `coverImageUrl` | `createPath` param omitted it (`updatePath` kept it) — latent (no UI) | added to `createPath` insert |
| 5 | lesson `duration` vs `durationMinutes` | `createLessonSchema` emitted `duration` but `createLesson` read `durationMinutes` — latent | renamed schema field to `durationMinutes` |

Verified CLEAN (no drops): products, contests (core + stages/submissions/judging),
docs pages, layouts, themes, user profile (avatar/banner correct), hub
posts/members/moderation/invites, messages, instance/admin config, RBAC.

### 3. Scheduled publishing (finding 3 — user chose "implement")

- Schema: added `'scheduled'` to `contentStatusEnum` + `content_items.scheduled_at`
  column. Migration **0024_motionless_northstar.sql** (additive: `ADD VALUE` +
  `ADD COLUMN`, mirrors 0017's enum precedent).
- `contentStatusSchema` gains `'scheduled'`; `createContentSchema`/`updateContentSchema`
  gain `scheduledAt` (`z.coerce.date()` — accepts datetime-local strings).
- `scheduleContent(db, id, authorId, scheduledAt)` — sets status='scheduled' +
  scheduledAt (ownership via `updateContent`).
- `publishDueScheduled(db, config, now?)` — worker step. **Atomic claim**: single
  `UPDATE ... WHERE status='scheduled' AND scheduled_at <= now() RETURNING` (row
  locks ⇒ each row published exactly once, safe across replicas), then runs the
  normal publish side effects (version snapshot + `onContentPublished`) per item.
- `ContentDetail` + read mapper expose `scheduledAt`.
- Nitro plugin `layers/base/server/plugins/scheduled-publishing.ts` — 60s interval,
  mirrors `federation-delivery.ts` (skips in test, cleaned up on close).
- Endpoint `POST /api/content/[id]/schedule` (future-date guard).
- UI: `useContentSave.handleSchedule()` + a "Schedule" button in the editor topbar
  (shown when `metadata.scheduledAt` set). BlogEditor opens its schedule control
  for already-scheduled posts. Client converts the local datetime-local value to
  **UTC ISO** before sending (so the server doesn't reparse in its own tz).

Safety: `'scheduled'` behaves like `draft` for access — `getContentBySlug` blocks
`status !== 'published'` for non-owners, and every public/feed route forces
`status:'published'`. Scheduled content cannot leak publicly or federate early.

## Verification

- schema: `pnpm --filter @commonpub/schema test` → 466 passed
- server: `pnpm --filter @commonpub/server test` → 1350 passed, 3 skipped (92 files)
- layer: `pnpm --filter ... test` → 1005 passed
- reference app: `nuxt typecheck` → exit 0, 0 errors
- New/updated tests: hub create+update persistence; video `categoryId`; content
  custom slug (create + update + no-op guard); content scheduling
  (scheduleContent, publishDueScheduled due/not-due/idempotent/version);
  learning `coverImageUrl` + lesson `durationMinutes`; schema field-drop
  regression block in `validators.test.ts`.

## Decisions

- Kept lesson `durationMinutes` at `.positive()` (bug was the field NAME, not the
  bound) — minimal behavior change.
- Custom slug accepted LOOSELY and normalized server-side (`generateSlug`) so
  free-text in the editor slug field never 400s.
- `updateHub` deliberately does NOT accept `parentHubId` (no UI; avoids an
  unvalidated re-parent / cycle path). `createHub` does (FK to existing hub).
- Scheduled-publish worker is an in-process interval (matches existing workers);
  multi-replica safety comes from the atomic UPDATE claim, not a feature flag.

## Files touched (code)

- `packages/schema/src/{enums,content,validators}.ts` (+ validators.test.ts)
- `packages/schema/migrations/0024_motionless_northstar.sql` (+ journal/snapshot)
- `packages/server/src/hub/hub.ts`, `content/content.ts`, `content/index.ts`,
  `learning/learning.ts`, `video/video.ts`, `types.ts`, `index.ts`
- `packages/server/src/__tests__/{hub,content,learning}.integration.test.ts`, `video.test.ts`
- `layers/base/server/api/content/[id]/schedule.post.ts` (new)
- `layers/base/server/plugins/scheduled-publishing.ts` (new)
- `layers/base/composables/useContentSave.ts`
- `layers/base/pages/u/[username]/[type]/[slug]/edit.vue`
- `layers/base/components/editors/BlogEditor.vue`

## Next steps (NOT done this session)

1. Version bumps + publish: `@commonpub/schema` (enum+column+validators),
   `@commonpub/server` (content/hub/video/learning), `@commonpub/layer` (UI +
   endpoint + plugin). Update STATUS.md versions after.
2. Deploy: commonpub.io builds from local source (picks up on deploy). deveco.io +
   heatsynclabs.io consume published packages → bump pins + BOTH lockfiles, let
   their deploy run migration 0024 via `db-migrate.mjs`.
3. Author's content listing could add a "scheduled" filter/badge (UI nicety; not a
   leak — scheduled is already gated like draft).
4. Optional: surface video category label in the `/videos` UI now that the read
   path exposes it.
