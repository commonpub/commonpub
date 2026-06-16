# Session 199 — Hub image fix + repo-wide field-drop audit + scheduled publishing

Date: 2026-06-15 / 2026-06-16
Status: **SHIPPED to commonpub.io** (PR #35 merged + deployed, migration 0024 applied).
npm publish + roll to deveco.io/heatsynclabs.io still PENDING. A follow-on uploads-infra
fix (PRs #36/#37) landed the same session — see the addendum at the bottom.

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

## Addendum (2026-06-16) — image uploads were broken for a deeper reason (PRs #36/#37)

After PR #35 shipped, the operator reported image upload still 500ing
(`/api/files/upload`). The field-drop fix was correct but orthogonal: uploads were
**fully broken by prod infrastructure**, diagnosed live in the prod container via the
`server-cmd` workflow.

Two root causes (neither app code):

1. **Pruned optional-peer deps.** `sharp` (image processing), `@aws-sdk/client-s3`
   (S3 uploads) and `ioredis` (Redis) are OPTIONAL peer deps of `@commonpub/infra`,
   loaded at runtime via dynamic `import()`. Nitro externalises them, and the
   Dockerfile runtime-stage `npm install` reconcile **pruned** the pnpm copies →
   `Cannot find module 'sharp'` / `Cannot find package '@aws-sdk/client-s3'` → 500.
   Fix (PR #36/#37): install all three explicitly, lockfile-pinned
   (`sharp@0.34.5 @aws-sdk/client-s3@3.1030.0 ioredis@5.10.1`), in the Dockerfile
   runtime `npm install` line. **Any future runtime-`import()`ed optional-peer dep
   must be added there too.**

2. **Object storage never configured** (`NO_S3_ENV`) → silent fallback to the
   local-fs adapter, which in prod is unwritable (root-owned `/app/uploads` volume,
   non-root container → EACCES) and unserved (nitro publicAssets are build-time).
   Fix (PR #36): `deploy.yml`'s restart step writes DO Spaces `S3_*` into
   `/opt/commonpub/.env` from masked GitHub secrets (idempotent; only rewrites
   `S3_*` lines). Secrets set via `gh secret set`: `S3_BUCKET=commonpub`,
   `S3_REGION=us-east-1`, `S3_ENDPOINT=https://sfo3.digitaloceanspaces.com`,
   `S3_PUBLIC_URL=https://commonpub.sfo3.digitaloceanspaces.com`, plus access/secret.

Verified live in the prod container: `sharp:fulfilled aws:fulfilled ioredis:fulfilled`,
an actual S3 `PutObject` succeeded, and the object served publicly (HTTP 200).

Note: the operator independently committed `d071a1c` (a local-storage EACCES fix + a
`apps/reference/server/routes/uploads/[...path].get.ts` serving route + nuxt.config
changes) directly to main while this was in flight. With Spaces configured
(`S3_BUCKET` set), `createStorageFromEnv` returns the S3 adapter, so that
local-storage path is **dormant/dead-code** — harmless, left in place as a fallback.

⚠️ **Open:** the Spaces secret key was shared in plaintext during the session — rotate
it in the DO console, then update the `S3_SECRET_KEY` GitHub secret (no code redeploy).
