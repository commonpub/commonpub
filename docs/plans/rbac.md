# Global RBAC for CommonPub — Implementation Plan

## Context

CommonPub authorization today is a fixed 5-value enum (`member/pro/verified/staff/admin`)
on `users.role`, checked by **73 `requireAdmin()` call sites**, **66 admin
endpoints**, and **15 ad-hoc `user.role === 'x'`** comparisons. There is no way for
an operator to define new roles or grant granular powers, and `staff` is inert
(`requireAdmin` only admits `admin`). The session-174 contest work added
contest-scoped access (visibility / stakeholders / per-contest role-gate), but the
operator asked for a real, general role/permission system: operator-defined custom
roles, multi-role users, and a single permission choke-point — done safely, since a
mistake in an auth refactor this size could lock people out or open holes.

**Goal:** introduce a global RBAC layer — operator-defined roles bundling
capability-level permissions, resolved per-user, gating the instance-wide surface —
*without ever changing behavior until a flag flips, and without any path that can
lock out admins.*

### Scope decisions (confirmed with operator)
- **Global roles only.** Per-hub roles (`hubRoleEnum` + `packages/server/src/utils.ts`
  `hasPermission`/`PERMISSION_MAP`) are a SEPARATE resource-scoped system and are
  **explicitly out of scope — left untouched.** Public-API scopes (`requireApiScope`)
  also stay orthogonal.
- **`staff` becomes a real moderator** — seeded with a moderation permission set.
  This is a deliberate behavior change, but it only manifests when `features.rbac`
  is ON (flag-off = byte-identical to today).
- **Capability-level catalog (~20-25 keys)** — one key per coherent capability,
  mapping cleanly to the 66 admin endpoints.

## Architecture (mirrors existing precedents)

- **Permission catalog = a code constant** (`PERMISSIONS` + `PermissionKey` union),
  exactly like `PUBLIC_API_SCOPES` in `packages/schema/src/validators.ts` and
  `hasScope` in `packages/server/src/publicApi/scopes.ts`. Permissions change only
  when code does; they need a compile-time type, not a table.
- **Roles = data** in new tables (operator-authorable). `role_permissions.permissionKey`
  is a validated varchar (against the catalog, like `filterKnownScopes`), supporting
  `*` and segment wildcards (`admin.*`).
- **Resolution = a cached per-user resolver**, modeled on the config resolver
  (`apps/reference/server/utils/config.ts`: short TTL + background refresh + explicit
  `invalidate`). Resolve effective permissions by `userId`; **never bake into the
  Better Auth session token** (so demotion takes effect within the TTL, not on
  re-login). `enrichUser()` already re-reads `users.role` per request, so admin
  demotion is already ~immediate.

## Data model — `packages/schema/src/rbac.ts` (new, migration 0009, ADDITIVE only)

- `roles` — `id, key (unique), name, description, isSystem (bool), priority (int|null), createdAt, updatedAt`. System roles seeded: member/pro/verified/staff/admin with priority 10/20/30/40/50 (mirrors the `roleGuard` hierarchy so it can later read `priority`).
- `role_permissions` — PK `(roleId, permissionKey)`, `roleId → roles ON DELETE cascade`. `permissionKey` validated against the catalog on write.
- `user_roles` — PK `(userId, roleId)`, `userId → users ON DELETE cascade`, `roleId → roles ON DELETE cascade`, `grantedBy → users ON DELETE set null`. (Multi-role per user.)
- **Keep `users.role` (the `userRoleEnum` column) as the denormalized "primary/display role"** — read by `enrichUser`, `roleGuard`, `canCreateContest`, `getPlatformStats` GROUP BY, admin user list. The M2M tables are the source of truth for *permissions*; `users.role` stays the highest-priority **system** role. Custom roles are assignable via `user_roles` but are NEVER written to `users.role` (it's a pgEnum). No `ALTER` on `users` (safe for heatsync `db:push` + drizzle populated-table DDL hazard).
- **Block deletion of `isSystem` roles** in app code.

`packages/schema/src/permissions.ts` (new) — the catalog constant + `permissionKeySchema`. Initial ~22 keys, grouped:
`*` (admin bypass, only on the admin role) · `admin.access` (admin-only umbrella) · `users.read`, `users.manage`, `users.delete`, `roles.manage` · `content.read`, `content.moderate`, `content.editorial`, `reports.review` · `contest.create`, `contest.manage`, `event.create`, `event.manage` · `settings.manage`, `theme.manage`, `layout.manage`, `navigation.manage`, `search.manage`, `apikeys.manage`, `storage.manage`, `categories.manage`, `federation.manage`, `audit.read`.

### Seed — `packages/server/src/rbac/seed.ts` (used by migration + fresh-install `seedRbac()`)
- `admin` → `['*']` (+ unremovable hardcoded bypass, below).
- `staff` → `['content.read','content.moderate','content.editorial','reports.review','contest.create','contest.manage','event.create','event.manage','audit.read','users.read']` (the moderator set; **does NOT include `admin.access`** so admin-only endpoints stay admin-only).
- `member`/`pro`/`verified` → `[]` (entitlement tiers; meaning preserved via `priority` + `visibleToRoles`).
- Backfill (same migration): `INSERT INTO user_roles SELECT u.id, r.id FROM users u JOIN roles r ON r.key = u.role::text`.

## Resolution, helpers, enrichment

- **Pure core** — `packages/auth/src/permissions.ts`: `hasPermissionPure(granted: Set|string[], needed, primaryRole?) → boolean`. Admin floor (`primaryRole==='admin'` ⇒ true) → exact match → wildcard segment match. Generalizes `hasScope`.
- **Resolver** — `layers/base/server/utils/permissions.ts` (Nitro util, like `config.ts`; in the layer so it ships to all consumers — see Phase 0 correction): `resolvePermissions(userId) → { primaryRole, roleKeys[], permissions:Set, fetchedAt }` with **30s TTL** (auth-critical → favor freshness) + `invalidatePermissions(userId)` / `invalidateAllPermissions()`. Resolution order: **(1)** `primaryRole==='admin'` → ALL (never touches tables); **(2)** `features.rbac===false` → legacy mapping (admin→all, else→none) ⇒ identical to today; **(3)** union of `user_roles → role_permissions`, **default-deny on any error/empty**.
- **Enrichment** — extend `layers/base/server/middleware/auth.ts`: after `enrichUser`, set `event.context.cpubPermissions = await resolvePermissions(user.id)` (one cached Map hit on the hot path, like `feature-flags-prime`). Fail-closed for non-admins; admin bypass survives a `role_permissions` outage because it reads `users.role` from the same enrich query.
- **Server gate** — `layers/base/server/utils/requirePermission.ts` (mirrors `requireScope.ts`): `requirePermission(event, key) → AuthUser` (401 if anon, 403 if missing) + `hasPermission(event, key) → boolean` (for owner-OR-permission cases). **Do NOT wrap these in `requireFeature('rbac')`** — `requireFeature` 404s when off, which would 404 admin endpoints; the flag lives ONLY inside the resolver.
- **Client** — `layers/base/composables/useCan.ts`: `useCan(key) → ComputedRef<boolean>`. `/api/me` (`layers/base/server/api/me.get.ts`) extended to return `permissions[]` + `roleKeys[]`; `useAuth.refreshSession()` populates a `useState('auth-permissions')`. Client checks are UX-only (hide buttons); the server is the enforcement boundary. `isAdmin` stays (alias of `useCan('admin.access')` later).

## Back-compat invariants (asserted by tests at EVERY commit)
- **INV-1 — no behavior change until flip:** flag off ⇒ `requirePermission`/`hasPermission`/`useCan` produce byte-identical decisions to today.
- **INV-2 — admin bypass:** `users.role==='admin'` ⇒ all permissions, in code, regardless of tables/flag/resolver health. No DB state can lock out admin.
- **INV-3 — default deny:** unknown key / resolver error / null set ⇒ 403.
- **INV-4 — last-privileged-user floor:** refuse any demote/revoke/delete/disable that leaves zero users with `admin.access`. Generalizes the existing guard in `layers/base/server/api/auth/delete-user.post.ts:11-25` (`SELECT … WHERE role='admin' LIMIT 2`).
- **INV-5 — bootstrap intact:** `auto-admin.ts` + `ADMIN_BOOTSTRAP_USER` + `admin-promote.yml` keep writing `users.role='admin'`; INV-2 means that alone restores full access.
- **INV-6 — every admin route gated:** every `**/api/admin/**` handler calls a permission guard (source-contract sweep test).
- **INV-7 — catalog exhaustive:** every referenced permission key exists in the catalog; every catalog key maps to the admin role.

`requireAdmin` is reimplemented as **`requirePermission(event, 'admin.access')`** (one ~5-line diff in `layers/base/server/utils/auth.ts` — the linchpin that routes all 73 sites through the new machinery). Because `admin.access` is seeded ONLY to admin and resolver step 1/2 make admins/flag-off resolve as before, this is bit-identical to today. `roleGuard`, `canCreateContest` stay (read `users.role`). `contests.visibleToRoles` gate broadens from "is `user.role` in list" to "do `roleKeys` intersect list" — a strict superset (back-compat + lets custom roles appear).

## Phased rollout (each phase independently shippable + verifiable; flag default OFF)

Add `rbac: z.boolean().default(false)` to `packages/config/src/schema.ts` featureFlags + declare in `layers/base/nuxt.config.ts` `runtimeConfig.public.features` (the declared-key gotcha).

- **Phase 0 — primitives, inert.** Migration 0009 (3 additive tables) + catalog + resolver + helpers + `requireAdmin` reimpl + `features.rbac` flag. ZERO behavior change (resolver step 1/2). Ship to all 3 instances. (Dual-`role`-column question resolved — see risk #1; `users.role` enum is canonical.)
  - **Resolver location correction (session 175):** the cached Nitro resolver lives in **`layers/base/server/utils/permissions.ts`** (the published `@commonpub/layer`), NOT `apps/reference/server/utils/`. Rationale: the consumers — `middleware/auth.ts`, `requireAdmin`/`requireScope` — are all in the layer, and the layer middleware already calls `useDB()`+`useConfig()` from layer code on every consumer. `config.ts` only lives in the app because it imports the app-root `~/commonpub.config`; the resolver needs neither. Placing it in the app would crash deveco/heatsync (their published-layer middleware would call a util their thin app repos don't define). The **pure resolution core** stays in `packages/server/src/rbac/resolver.ts` (PGlite-testable); the layer util is just the cache+invalidate wrapper around it.
- **Phase 1 — mechanical guard migration, still ZERO change (flag off).** Per-domain PRs: 73 `requireAdmin` → `requirePermission(event, '<key>')`; 15 ad-hoc → an `ownerOrPermission(event,{ownerId,key})` helper (feed `hasPermission(set,key)` into the existing service `isAdmin` boolean — signature-stable). Hub-role checks (`hub/moderation.ts`, `members.ts`) explicitly skipped. INV-6 sweep test runs from here on.
- **Phase 2 — seed + enable behind flag.** Migration 0010 (seed roles/permissions + backfill `user_roles`). Generalize INV-4. Flip `features.rbac=true` on **commonpub.io only**; soak. Now staff gains its moderator set and custom-role grants resolve (admins still bypass).
- **Phase 3 — admin UI.** `pages/admin/roles/` + `GET/POST/PUT/DELETE /api/admin/roles` + `PUT /api/admin/users/[id]/roles`, all `requirePermission('roles.manage')` + audited + `invalidatePermissions`. Roll commonpub → deveco → heatsync.
- **Phase 4 — enable everywhere.** Flip flag on deveco + heatsync.

**Kill-switch:** `features.rbac=false` + `invalidateAllPermissions()` instantly reverts to legacy admin-only — no redeploy. Break-glass: `admin-promote.yml` raw SQL.

## Critical files
- New: `packages/schema/src/rbac.ts`, `packages/schema/src/permissions.ts`, `packages/server/src/rbac/{seed,resolver,hasPermission,ownerOrPermission}.ts`, `packages/auth/src/permissions.ts`, `layers/base/server/utils/permissions.ts` (cache wrapper — was `apps/reference/...`, corrected session 175), `layers/base/server/utils/requirePermission.ts`, `layers/base/composables/useCan.ts`, `layers/base/server/api/admin/roles/**`, `pages/admin/roles/**`.
- Edited: `layers/base/server/utils/auth.ts` (`requireAdmin` reimpl), `layers/base/server/middleware/auth.ts` (attach `cpubPermissions`), `packages/server/src/admin/admin.ts` (`updateUserRole` → sync `user_roles` + invalidate + last-admin floor), `packages/config/src/schema.ts` + `layers/base/nuxt.config.ts` (flag), `layers/base/server/api/me.get.ts`, the 73+15 guard sites (Phase 1).

## Verification
- **Unit** (`packages/server/src/rbac/__tests__/`): resolver (admin bypass / flag-off legacy / custom resolve / error→deny), `hasPermissionPure`, `ownerOrPermission`, last-privileged floor.
- **Permission matrix** (`packages/server/src/__tests__/rbac-matrix.integration.test.ts`, PGlite + `createTestUser(db,{role})`): roles × endpoints allow/deny, **run flag-off (= legacy, proves INV-1) AND flag-on-default-seed (staff moderator set) AND flag-on-custom-grant**.
- **Source-contract sweeps**: INV-6 (`api/admin/__tests__/all-routes-gated.test.ts` — fs-enumerate every admin route, assert each matches `requirePermission(`/`requireAdmin(`); INV-7 (catalog exhaustive). Per-endpoint contract tests for the 15 non-admin privileged sites (the `entries-score-gating.test.ts` pattern) — these are NOT covered by the admin sweep.
- **Migration test**: apply 0009+0010 to fresh PGlite seeded with `users.role='admin'`; assert tables + backfill + resolver agrees.
- **Gates**: `pnpm publish:check` (build+typecheck+all tests) green before each release; `nuxt typecheck` 0 errors.
- **Per-phase live check (3 instances)** after each flag flip: admin endpoint → 200 as admin, 403 as member, exact grants for a custom-role user; `admin-promote.yml` still works. **heatsync:** apply 0009 + 0010 SQL MANUALLY on the droplet (`db:push --force` drops DDL) and verify the 3 tables exist BEFORE flipping the flag.
- **Release/deploy:** bump schema (→0.23.0) / server (→2.64.0) / auth (→0.7.0, if guards touched) / layer (→0.30.0); update `create-commonpub` pins + the version-pin assertion test + deveco/heatsync pins; commit drizzle-generated SQL (PR-reviewed); deploy commonpub (workspace) + deveco (npm) via push; heatsync manual DDL then push. Roll flag commonpub → deveco → heatsync.

## Top residual risks (watch list)
1. **~~Dual `users.role` columns~~ — RESOLVED (session 175, Phase 0).** There is
   no dual column. The two `role:` lines in `packages/schema/src/auth.ts` are on
   **different tables**: `:27` is `users.role` (`userRoleEnum`, the canonical
   global role) and `:98` is `members.role` (a `varchar(32)` on the
   `organizations`↔`members` org-membership join table — an unrelated
   resource-scoped concept, not a second column on `users`). All three consumers
   converge on the single `users.role` enum: `enrichUser`
   (`middleware/auth.ts:68`) reads it, `auto-admin.ts:84` writes it
   (`db.update(users).set({ role:'admin' })`), and `admin-promote.yml:33` writes
   it (`UPDATE users SET role='admin'`). INV-2/INV-5 are therefore safe as
   written, and the backfill `JOIN r ON r.key = u.role::text` casts this enum
   correctly. No `ALTER` on `users`; no hazard.
2. **`requireFeature` 404 trap** — never gate guards behind the flag; flag lives in the resolver only.
3. **Staff behavior change is intentional but flag-gated** — the matrix test must assert staff's exact new endpoint set on flag-on, and unchanged on flag-off.
4. **Non-`/api/admin` privileged endpoints** (contests/events/videos/docs/products) aren't covered by the admin sweep — they need their own contract tests.
5. **Multi-pod cache staleness** — per-process Map; `invalidatePermissions` clears the local node only (≤30s elsewhere). Acceptable for v1; document. Invalidate AFTER the DB commit.
6. **Federation/remote users** → empty permission set (resolver keyed on local `users.id`; remote actors have no `user_roles`).
7. **Client `useCan` is advisory** — never grant access on `useCan` without a server guard behind it.

## After approval
Persist this plan to `docs/plans/rbac.md` (the handoff already points there) as the first implementation step, then execute Phase 0.
