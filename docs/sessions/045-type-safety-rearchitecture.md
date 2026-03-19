# Session 045: End-to-End Type Safety Rearchitecture (Phases 1, 2, 4, 5)

**Date:** 2026-03-17

## What Was Done

Implemented the foundation phases of the type safety rearchitecture plan. Every change was verified against `pnpm typecheck` and `pnpm build` (13/13 tasks) with 175 server tests passing.

### Phase 1: Type the Schema Contract Layer

**1A: `z.infer<>` type exports (validators.ts)**
- Added 47 paired type exports for all Zod schemas
- Input types: `CreateUserInput`, `UpdateProfileInput`, `CreateContentInput`, `UpdateContentInput`, `CreateCommentInput`, `CreateHubInput`, `UpdateHubInput`, `CreatePostInput`, `CreateReplyInput`, `CreateInviteInput`, `BanUserInput`, `ChangeRoleInput`, `CreateProductInput`, `UpdateProductInput`, `AddContentProductInput`, `CreateContestInput`, `UpdateContestInput`, `CreateVideoInput`, `CreateVideoCategoryInput`, `CreateLearningPathInput`, `UpdateLearningPathInput`, `CreateModuleInput`, `UpdateModuleInput`, `CreateLessonInput`, `UpdateLessonInput`, `CreateConversationInput`, `SendMessageInput`, `CreateDocsSiteInput`, `UpdateDocsSiteInput`, `CreateDocsPageInput`, `UpdateDocsPageInput`, `CreateDocsVersionInput`, `CreateReportInput`, `AdminSettingInput`, `AdminUpdateRoleInput`, `AdminUpdateStatusInput`, `ResolveReportInput`, `JudgeEntryInput`, `ContestTransitionInput`, `CreateRemoteActorInput`, `CreateActivityInput`, `CreateFollowRelationshipInput`
- Enum types: `ContentType`, `ContentStatus`, `Difficulty`, `HubType`, `JoinPolicy`, `HubPrivacy`, `HubRole`, `PostType`, `LessonType`, `VideoPlatform`, `ContestStatus`, `ProductStatus`, `ProductCategory`, `LikeTargetType`, `CommentTargetType`, `ActivityDirection`, `ActivityStatus`, `FollowRelationshipStatus`
- Extended `updateContentSchema` with `status` field (was missing from `.partial().omit({type})`)

**1B: `$inferSelect`/`$inferInsert` types on all 12 table files**
- `auth.ts`: `UserRow`, `SessionRow`, `AccountRow`, `OrganizationRow`, `MemberRow`, `FederatedAccountRow`, `OauthClientRow`, `OauthCodeRow`, `VerificationRow` (+ `New*` variants)
- `content.ts`: `ContentItemRow`, `ContentVersionRow`, `ContentForkRow`, `TagRow`, `ContentTagRow`
- `hub.ts`: `HubRow`, `HubMemberRow`, `HubPostRow`, `HubPostReplyRow`, `HubBanRow`, `HubInviteRow`, `HubShareRow`
- `social.ts`: `LikeRow`, `FollowRow`, `CommentRow`, `BookmarkRow`, `NotificationRow`, `ReportRow`, `ConversationRow`, `MessageRow`
- `product.ts`: `ProductRow`, `ContentProductRow`
- `learning.ts`: `LearningPathRow`, `LearningModuleRow`, `LearningLessonRow`, `EnrollmentRow`, `LessonProgressRow`, `CertificateRow`
- `docs.ts`: `DocsSiteRow`, `DocsVersionRow`, `DocsPageRow`, `DocsNavRow`
- `video.ts`: `VideoRow`, `VideoCategoryRow`
- `contest.ts`: `ContestRow`, `ContestEntryRow`
- `federation.ts`: `RemoteActorRow`, `ActivityRow`, `FollowRelationshipRow`, `ActorKeypairRow`
- `files.ts`: `FileRow`
- `admin.ts`: `InstanceSettingRow`, `AuditLogRow`

**1C: Filter schemas**
- Added 6 Zod filter schemas: `contentFiltersSchema`, `hubFiltersSchema`, `learningPathFiltersSchema`, `videoFiltersSchema`, `contestFiltersSchema`, `hubPostFiltersSchema`
- All use literal unions from enum schemas (not `string`)

### Phase 2: Type the Database Layer

**2A: Fix DB type**
- `packages/server/src/types.ts`: `DB = NodePgDatabase<typeof schema>` (was unparameterized)
- `apps/reference/server/utils/db.ts`: removed `as unknown as DB` cast

**2B: Remove `as` casts from content.ts**
- `mapToListItem` rewritten: params changed from `Record<string, unknown>` to `ContentItemRow` + `UserRef` — eliminated all 18 `as string`/`as Date`/`as number` casts
- Filter comparisons in `listContent`: removed 3 `as` casts (status, type, difficulty) since `ContentFilters` now has literal union types

**2C: Delete duplicate input types from types.ts**
- Removed `ContentFilters`, `CreateContentInput`, `UpdateContentInput` interface definitions
- Now re-exported from `@commonpub/schema`

**2D: Tighten string fields to literal unions (15+ fields)**
- `ContentListItem`: `.type` → `ContentType`, `.status` → `ContentStatus`, `.difficulty` → `Difficulty | null`
- `ContentRelatedItem`: `.type` → `ContentType`
- `ContentDetail`: `.visibility` → `'public' | 'members' | 'private'`
- `HubListItem`: `.joinPolicy` → `JoinPolicy`
- `HubDetail`: `.hubType` → `HubType`, `.privacy` → `HubPrivacy`, `.currentUserRole` → `HubRole | null`
- `HubMemberItem`: `.role` → `HubRole`
- `HubPostItem`: `.type` → `PostType`
- `LearningPathListItem`: `.difficulty` → `Difficulty | null`, `.status` → `ContentStatus`
- `LearningPathDetail.modules[].lessons[].type` → `LessonType`
- `EnrollmentItem.path.difficulty` → `Difficulty | null`
- `VideoListItem.platform` → `VideoPlatform`
- `ContestListItem.status` → `ContestStatus`
- `ContestFilters.status` → `ContestStatus`

**2E: Utility types**
- Added `Serialized<T>` — converts `Date` → `string` recursively (for JSON-serialized API responses)
- Added `PaginatedResponse<T>` — `{ items: T[]; total: number }`

### Phase 4: Type the Block System

- Added `TypedBlockTuple` discriminated union (19 block types) to `packages/editor/src/blocks/types.ts`
- `BlockTuple` is now `TypedBlockTuple | [string, Record<string, unknown>]` (backwards-compatible for custom blocks)
- Exported `TypedBlockTuple` from `@commonpub/editor`

### Phase 5: Package Exports

- `@commonpub/server/package.json`: added 7 subpath exports (`./types`, `./content`, `./hub`, `./social`, `./learning`, `./admin`, `./docs`)
- `@commonpub/schema/package.json`: added 2 subpath exports (`./validators`, `./enums`)
- `@commonpub/server/index.ts`: re-exports all schema types + `Serialized`, `PaginatedResponse`, `ContentDetailAuthor`, `ContentRelatedItem`

### Additional Fixes

- `packages/server/src/profile.ts`: `type` param changed from `string` to `ContentType`
- `packages/server/src/hub.ts`: `currentUserRole` variable typed as `HubRole | null`
- `packages/server/src/contest.ts`: imported `ContestStatus` from schema, used in interfaces
- `packages/server/src/video.ts`: imported `VideoPlatform` from schema, used in `VideoListItem`
- Removed `as` casts from filter comparisons in `learning.ts`, `contest.ts`

## Decisions Made

1. **contest.ts keeps its own `CreateContestInput`** — the server's version has `slug` and `createdBy` fields that the schema validator doesn't (schema validates user input, server type is the internal function signature). Not a duplicate — different concerns.
2. **Remaining ~25 `as` casts in server modules are Phase 3 work** — these are at function boundaries where string params from untyped API routes need casting. Once routes parse with Zod, the casts disappear naturally.
3. **`BlockTuple` stays backwards-compatible** — `TypedBlockTuple | [string, Record<string, unknown>]` allows custom/plugin blocks without breaking extensibility.

## Verification

- `pnpm --filter @commonpub/schema typecheck` — pass
- `pnpm --filter @commonpub/editor typecheck` — pass
- `pnpm --filter @commonpub/server typecheck` — pass
- `pnpm build` — 13/13 tasks succeed
- `pnpm --filter @commonpub/server test` — 175 pass, 5 skipped

## What's NOT Done (Phase 3)

**Phase 3A: Add explicit return types + Zod query parsing to all 131 API route files**
- Currently all 131 route handlers lack explicit return types and use manual `getQuery(event)` with `as string` casts
- Needs: import filter schemas, parse query/body through Zod, add `Promise<ReturnType>` annotation
- This is the largest remaining phase (~131 files)

**Phase 3B: Delete 39 local interface definitions from 17 page files**
- 17 `.vue` page files define 39 duplicate interfaces that mirror server types
- Once routes have return types, Nuxt's `useFetch` auto-infers → local interfaces become dead code
- Pages: explore, search, hubs (index, [slug], settings), contests ([slug], judge), learn (index, [slug]/edit), videos (index, [id]), dashboard, messages, settings/profile, u/[username], docs edit, index

**Phase 4B-C: Update useBlockEditor composable + BlockContentRenderer**
- `apps/reference/composables/useBlockEditor.ts` has local `BlockTuple` type (line 12) — should import from `@commonpub/editor`
- `apps/reference/components/blocks/BlockContentRenderer.vue` has local `BlockTuple` type (line 26) — should import from `@commonpub/editor`

## Next Steps

1. **Phase 3A** — Type all 131 API routes (highest impact, enables Phase 3B)
2. **Phase 3B** — Delete local interfaces from 17 page files
3. **Phase 4B-C** — Wire up block editor composable + renderer to use `TypedBlockTuple`
4. Final verification: `grep -r "as string\|as Date" packages/server/src/*.ts` should return minimal hits
