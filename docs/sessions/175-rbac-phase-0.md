# Session 175 — Global RBAC Phase 0 (primitives, inert)

Plan: `docs/plans/rbac.md`. Phase 0 = additive primitives, ZERO behavior change,
`features.rbac` default OFF. Did NOT seed (Phase 2), did NOT migrate the 73+15
guard sites (Phase 1), did NOT touch hub roles (out of scope).

## Open question resolved first — risk #1 (dual `users.role` column)

**There is no dual column.** The two `role:` lines in `packages/schema/src/auth.ts`
are on different tables:
- `:27` `users.role` — `userRoleEnum` (`member/pro/verified/staff/admin`). **Canonical.**
- `:98` `members.role` — `varchar(32)` on the `organizations`↔`members`
  org-membership join table. Unrelated resource-scoped concept.

All three consumers converge on the single `users.role` enum: `enrichUser`
(`middleware/auth.ts:68`) reads it, `auto-admin.ts:84` writes it, `admin-promote.yml:33`
writes it. INV-2/INV-5 safe as written; the backfill `JOIN r ON r.key = u.role::text`
casts the enum correctly. No `ALTER` on `users`. Plan risk #1 updated to record this.

## Second correction — resolver location (app → layer)

Plan said the cached resolver lives in `apps/reference/server/utils/permissions.ts`
(mirroring `config.ts`). Corrected to **`layers/base/server/utils/permissions.ts`**
(the published `@commonpub/layer`). `config.ts` only lives in the app because it
imports the app-root `~/commonpub.config`; the resolver needs only `useDB()`+the
flag, both already called from layer code by `middleware/auth.ts` on every
consumer. Placing it in the app would crash deveco/heatsync (their published-layer
middleware would call a util their thin app repos don't define). The pure
resolution core stays in `packages/server/src/rbac/resolver.ts`. Plan updated.

## What was built

- `packages/schema/src/permissions.ts` — `PERMISSIONS` catalog (24 keys incl `*` +
  `admin.access`), `PermissionKey`, `isPermissionKey`/`isPermissionGrant`,
  `permissionKeySchema` (accepts `*`, exact keys, `<prefix>.*` segment wildcards),
  `filterKnownPermissions`. Modeled on `PUBLIC_API_SCOPES`/`filterKnownScopes`.
- `packages/schema/src/rbac.ts` — `roles`, `role_permissions`, `user_roles` (+
  relations + inferred types). Additive; no `ALTER` on `users`. Wired into index.
- **Migration `0009_rbac_roles_permissions.sql`** — 3 CREATE TABLE + FKs + indexes,
  additive only. Journal idx 9. (Dropped a redundant `idx_roles_key` — the UNIQUE
  constraint already indexes `key`.)
- `packages/auth/src/permissions.ts` — `hasPermissionPure(granted, needed, primaryRole?)`:
  admin floor → `*` → exact → segment-wildcard → default-deny. Exported from index.
- `packages/server/src/rbac/resolver.ts` — `resolveUserPermissions(db, userId,
  {rbacEnabled})`: admin→`{'*'}` (no table touch) / flag-off→legacy empty /
  flag-on→union of `user_roles→role_permissions`; default-deny on error/empty/unknown.
  Barrel + server index export.
- `layers/base/server/utils/permissions.ts` — cached Nitro wrapper: 30s TTL +
  bounded LRU (5000) + `invalidatePermissions`/`invalidateAllPermissions`. Reads
  `useConfig().features.rbac`.
- `layers/base/server/utils/requirePermission.ts` — `requirePermission(event, key,
  msg?)` (401 anon / 403 missing) + `hasPermission(event, key)`. Reads
  `event.context.cpubPermissions` (+H3 context augmentation). NOT behind
  `requireFeature`.
- `layers/base/server/utils/auth.ts` — **`requireAdmin` reimplemented as
  `requirePermission(event, 'admin.access', 'Admin access required')`** — the
  linchpin. Legacy 403 message preserved verbatim.
- `layers/base/server/middleware/auth.ts` — attaches
  `event.context.cpubPermissions = await resolvePermissions(user.id)` after both
  `enrichUser` sites (SSR + API). Fail-closed.
- Flag `features.rbac` (default false) added in 3 declared places: config Zod schema,
  hand-written `FeatureFlags` interface (`config/src/types.ts`), and
  `layers/base/nuxt.config.ts` `runtimeConfig.public.features` (the declared-key
  gotcha). Plus the client `useFeatures.ts` interface + `DEFAULT_FLAGS` + return.
  Fixed two full-literal `FeatureFlags` test fixtures (`mockConfig.ts`,
  `identity/health.test.ts`).

## Invariants verified

- **INV-1** (no change flag-off): resolver flag-off test (non-admins → empty set =
  legacy admin-only); `requireAdmin` byte-identical (same 403 message, admin-only).
- **INV-2** (admin bypass): resolver admin test (both flag states → `*`),
  `hasPermissionPure` admin floor, `requirePermission` falls back to enriched
  `user.role` if context absent.
- **INV-3** (default deny): unknown user / empty / error → empty set → 403.

## Tests + gates (all green)

- New: `auth/permissions.test.ts` (12), `server/rbac/resolver.integration.test.ts`
  (6, PGlite), `schema/permissions.test.ts` (7).
- Full existing suites unchanged: server 1166, layer 675, schema 492, config 23,
  auth 84, test-utils 13.
- `pnpm build` 15/15 ✅ · `pnpm typecheck` 26/26 ✅ (`nuxt typecheck` 0 errors —
  confirms the auto-import wiring: requireAdmin→requirePermission, cpubPermissions
  context, useConfig().features.rbac, resolvePermissions in middleware).

## NOT done (deliberately) / next steps

- **Release + deploy to all 3 instances is NOT yet done** — awaiting go-ahead (npm
  publish is irreversible; touches 3 prod sites). Release plan: bump schema→0.23.0,
  server→2.64.0, auth→0.7.0, config (minor), layer→0.30.0; update create-commonpub
  pins + deveco/heatsync pins (^0.x doesn't cross minors — bump by hand); commit
  drizzle SQL; deploy commonpub (workspace) + deveco (npm) via push; **heatsync:
  apply 0009 DDL MANUALLY on the droplet (`db:push --force` drops it) and verify the
  3 tables exist**; curl `/` + `/api/features` after each deploy. Flag stays OFF
  everywhere (Phase 2 flips it on commonpub.io only).
- **Phase 1** — mechanical guard migration (73 `requireAdmin`→`requirePermission(key)`,
  15 ad-hoc → `ownerOrPermission`), still flag-off / zero-change. INV-6 sweep test.
- **Phase 2** — seed (migration 0010) + backfill `user_roles` + flip flag on
  commonpub.io. `seed.ts` + `ownerOrPermission.ts` not yet written.
- `/api/me` permissions[] + `useCan.ts` deferred (client-advisory; Phase 1/3).
