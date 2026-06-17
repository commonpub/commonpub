# Session 201 — RBAC activation + per-contest editors

Date: 2026-06-17. Branch: `rbac-activation-and-contest-editors` (NOT published, NOT deployed —
per operator decision: build + test on a branch, review before publish; `features.rbac` stays
default OFF). Plan: `docs/plans/rbac-activation-and-contest-editors.md`.

## Why (operator findings, all verified in code)

1. **Enabling `features.rbac` did nothing.** Phase 0 (machinery) + Phase 1 (73 `requireAdmin` →
   `requirePermission`) shipped (sessions 175–177), but **Phase 2 (seed/backfill) + Phase 3 (admin
   UI) were never built.** Migration 0009 only `CREATE TABLE`d the three RBAC tables — no seed, no
   backfill, no `seedRbac()`. `updateUserRole` wrote only `users.role`. So the tables were empty in
   prod; flipping the flag ran the resolver's step 3 against empty `user_roles` → empty set for every
   non-admin → identical to flag-off. A genuine no-op.
2. **`staff` behaved like `member`.** Its only behavioral hook was `canCreateContest` when
   `contestCreation: 'staff'` (default is `'admin'`). `roleGuard` has zero production call sites.
3. **Need a per-contest editor** with no system-wide access.

## What shipped (this branch)

### Part A — per-contest editor (operator chose: reuse `contest_stakeholders.role`)
- **schema**: `contest_stakeholders.role varchar(32) default 'reviewer'` (migration **0025**);
  `STAKEHOLDER_ROLES`/`stakeholderRoleSchema` (`reviewer`|`editor`).
- **server**: `isContestEditor()`; `addContestStakeholder` takes a role (upsert/promote);
  `updateContest`/`advanceContestStage`/`transitionContestStatus` gained a `canManage` boolean
  (owner check broadened to owner OR editor OR caller-cleared). Error copy "Not the contest owner"
  → "Not authorized to manage this contest" (route 403 mapping updated).
- **routes**: edit/advance/transition compute `canManage = ownerOrPermission(contest.manage) ||
  isContestEditor`. Contest GET sets a per-request `viewerCanManage` view-model flag. Stakeholder
  POST accepts a `role` (owner / `contest.manage` only — an editor cannot mint editors).
- **UI**: `ContestStakeholderManager` got a reviewer/editor selector + role change; the edit page +
  ContestSidebar show the Edit affordance to editors (`canManage`); Danger Zone + collaborator
  management stay owner-only.

### Part B — RBAC made real (Phases 2 + 3, flag still default OFF)
- **seed** (`packages/server/src/rbac/seed.ts` `seedRbac()` + SQL appended to migration **0025**):
  5 system roles (priorities 10–50), `admin → ['*']`, `staff →` the 10-key moderator set (NO
  `admin.access`), `member/pro/verified → []`, backfill `user_roles` from `users.role`. Idempotent
  (`ON CONFLICT DO NOTHING`; never clobbers later operator edits). **Verified live**: migration
  applied to a fresh Postgres → 5 roles, admin=1 perm, staff=10, column present.
- **updateUserRole**: now syncs `user_roles` (swaps the system-role membership) + **INV-4** refuses
  demoting the last admin; route invalidates the permission cache.
- **admin roles API** (`packages/server/src/rbac/admin.ts` + `/api/admin/roles*`,
  `/api/admin/permissions`, `/api/admin/users/[id]/roles`): list/create/update/delete roles +
  per-user custom-role assignment, all `requirePermission('roles.manage')`, audited, cache-invalidated.
  Only `admin` may hold `*`; system roles are undeletable; admin always retains `*`.
- **client**: `/api/me` returns `permissions[]` + `roleKeys[]`; `useAuth` exposes them;
  new `useCan(key)` composable (mirrors `hasPermissionPure`, admin floor); admin sidebar "Roles"
  link + `pages/admin/roles.vue` (create/edit/delete + permission-group checkboxes, off-flag banner).

## Gates (all green, on branch)
schema 466 · server 1360 · layer 1021 · `nuxt typecheck` EXIT 0. Migration 0025 applied + seed
verified against a fresh local Postgres. New admin routes pass the INV-6 sweep + the route-keys map.

## Decisions
- Stakeholder `role` column over a new `contest_editors` table (operator choice).
- `canManage` boolean threaded through the three owner-only contest fns (mirrors `deleteContest`).
- Seed lives in BOTH migration 0025 SQL (deploy path) and `seedRbac()` TS (fresh-install/tests); a
  test asserts staff's set. Editing a system role's permissions is allowed (tune staff); `admin`'s
  `*` is force-retained.

## Open / next
- **Release pending review** (not done this session): bump schema/server/layer (config/auth
  unchanged), publish in order, layer via `pnpm run publish:layer`, update deveco/heatsync/CLI pins,
  deploy all 3, curl-verify migration 0025 + flag behavior. `features.rbac` stays OFF; operator
  flips it on commonpub.io first when ready (the `roles.vue` banner notes it's inert until then).
- New users created AFTER the seed get a `user_roles` row only via `updateUserRole` (members need
  none — they have no perms; staff/admin go through role change which inserts). Signup-time seeding
  of the member membership is a nice-to-have, not required.
- Per-contest editors cannot delete the contest or manage judges/collaborators (owner/`contest.manage`
  only) — deliberate. Extend to editors later if desired.
