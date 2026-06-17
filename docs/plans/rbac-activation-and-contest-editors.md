# RBAC Activation + Per-Contest Editors — Implementation Plan

> Created session 201 (2026-06-17). Answers two operator findings:
> (1) enabling `features.rbac` does nothing and `staff` behaves like `member`; (2) need a way to
> grant a single user full edit rights on ONE contest without any system-wide access.
> Companion research: see the session-201 log. Predecessor plan: `docs/plans/rbac.md` (Phases 0–1
> shipped; this plan delivers the never-built Phases 2–3).

## Root-cause findings (verified in code)

**Why enabling RBAC does nothing.** Phase 0 (machinery) + Phase 1 (73 `requireAdmin` →
`requirePermission`) shipped (sessions 175–177). **Phase 2 (seed/backfill) and Phase 3 (admin UI)
were never built.** Migration `0009` only `CREATE TABLE`s `roles`/`role_permissions`/`user_roles`
— no seed, no backfill. There is no `seedRbac()`. `updateUserRole` (`admin.ts:295`) writes only
`users.role`, never `user_roles`. No `/api/admin/roles` routes, no `useCan`, `/api/me` returns no
permissions. So the tables are empty in prod; flipping `features.rbac=true` makes the resolver run
step 3 (`resolver.ts:83`) against empty `user_roles` → empty set for every non-admin → identical to
flag-off. Admins bypass via the floor either way. **No-op.**

**Why `staff` == `member`.** `staff`'s only behavioral hook is `canCreateContest` (`contest.ts:383`)
when `contestCreation: 'staff'` — and the default policy is `'admin'` (`config/src/schema.ts:111`).
`roleGuard` (the member<pro<verified<staff<admin hierarchy) has ZERO production call sites. So on a
default instance `staff` is inert. After Part B, `staff` gains its seeded moderator permission set
(active only when the flag is on).

**Contest edit is owner-only.** `updateContest` (`contest.ts:464`), `advanceContestStage`
(`contest.ts:~1330`), `transitionContestStatus` (`contest.ts:~989`) all hard-check
`createdById !== userId` with no admin/permission fallback. Only delete/judges/stakeholders use
`ownerOrPermission(..., 'contest.manage')`. So today not even a site admin can edit a contest they
didn't create. The editor feature must thread a `canManage` decision through these three functions.

---

## Part A — Per-contest editor (via `contest_stakeholders.role`)

Operator chose to reuse the existing `contest_stakeholders` table with a `role` column rather than a
new table. `reviewer` = today's view-only semantics; `editor` = full edit rights to that one contest.

### A1. Schema (`packages/schema`)
- `contestStakeholders`: add `role: varchar('role', { length: 32 }).default('reviewer').notNull()`.
- New `STAKEHOLDER_ROLES = ['reviewer','editor'] as const` + `stakeholderRoleSchema` (zod enum) in
  `validators.ts` (or `contest.ts` validators). Export the type.
- Migration **0025** (additive): `ALTER TABLE contest_stakeholders ADD COLUMN role varchar(32)
  NOT NULL DEFAULT 'reviewer';` (existing rows → `reviewer`, preserving current view-only behavior).
- Tests: schema/validator unit test for the enum.

### A2. Server (`packages/server/src/contest`)
- `addContestStakeholder(db, contestId, userId, opts?)` — add `role?: 'reviewer'|'editor'` (default
  `'reviewer'`); persist it; on conflict allow a role UPDATE (so a reviewer can be promoted to editor
  via the same endpoint, or via a dedicated update). Notification copy varies by role.
- `listContestStakeholders` — return `role`.
- New `isContestEditor(db, contestId, userId): Promise<boolean>` — true iff a row exists with
  `role === 'editor'`. (`isContestStakeholder` stays role-agnostic for VIEW access — both roles view.)
- **Refactor authz to a `canManage` boolean** (mirrors the existing `deleteContest(db,id,userId,
  canManage)` precedent):
  - `updateContest(db, slug, data, canManage: boolean)` — drop the internal `createdById !== userId`
    check; gate on `canManage`. (Caller passes the decision.)
  - `advanceContestStage(db, contestId, userId, input, canManage: boolean)` — keep `userId` for
    audit/notify; gate on `canManage` instead of the owner check.
  - `transitionContestStatus(db, contestId, userId, newStatus, canManage: boolean)` — same.
  - Keep `getContestEntry`/scoring/judge gates unchanged (judges are separate).
- TDD: `updateContest`/`advance`/`transition` allow when `canManage=true`, 403/null when false;
  `isContestEditor` true only for editor rows; reviewer cannot manage.

### A3. Routes (`layers/base/server/api/contests/[slug]`)
Compute the decision once per route and pass it down:
```ts
const canManage =
  ownerOrPermission(event, contest.createdById, 'contest.manage') ||
  (await isContestEditor(db, contest.id, user.id));
```
- `index.put.ts` (edit) — pass `canManage` to `updateContest`; 403 when false.
- `advance.post.ts`, `transition.post.ts` — same.
- `stakeholders/index.post.ts` — accept `role` in the body (validated); still gated by
  `ownerOrPermission(..., 'contest.manage')` (only owner/admin/`contest.manage` can ADD editors —
  an editor cannot mint more editors, avoiding privilege self-escalation). Document this.
- `stakeholders/[userId]` — allow PATCH role (optional) or rely on re-POST upsert; DELETE unchanged.
- Editors get edit rights but **NOT** the right to delete the contest or manage editors/stakeholders
  (those stay owner/`contest.manage`). Judges add: keep at owner/`contest.manage` for now (document;
  can extend to editors later if desired).

### A4. UI
- `components/contest/ContestStakeholderManager.vue` — add a per-person role selector
  (Reviewer / Editor) and label the section so the two roles are clear ("Reviewers can view;
  Editors can edit"). No em dashes in copy.
- Contest edit page (`pages/contests/[slug]/edit.vue`) + ContestHero "Edit" affordance — surface the
  edit entry point to editors, not just the owner. The page already loads for stakeholders (they can
  view); ensure the Edit button/route is shown when the user is owner OR editor OR has
  `contest.manage`. Server is the enforcement boundary; client check is UX-only.
- `/api/me` / contest detail should expose enough for the client to know "I can manage this contest"
  — simplest: a `canManage` boolean on the contest detail payload computed server-side per request
  (preferred over client role math).

---

## Part B — Make RBAC real (Phases 2 + 3 from `docs/plans/rbac.md`)

### B1. Seed + backfill (migration 0025, same migration as A1 or sequential — keep additive)
- `packages/server/src/rbac/seed.ts` `seedRbac(db)` — idempotent upsert of system roles +
  permissions, for fresh installs and tests:
  - Roles (`isSystem=true`, priority): `member`(10), `pro`(20), `verified`(30), `staff`(40),
    `admin`(50).
  - `role_permissions`: `admin → ['*']`; `staff → ['content.read','content.moderate',
    'content.editorial','reports.review','contest.create','contest.manage','event.create',
    'event.manage','audit.read','users.read']` (moderator set; **no `admin.access`**);
    `member`/`pro`/`verified → []`.
  - Backfill: `INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u
    JOIN roles r ON r.key = u.role::text ON CONFLICT DO NOTHING`.
- **Deploy path:** put the seed + backfill as idempotent SQL (`INSERT ... ON CONFLICT DO NOTHING`,
  fixed UUIDs or key-based upsert) directly in migration **0025** so all 3 instances get it via
  `db-migrate.mjs` (the committed-migrations path — never hand-edit DB). `seedRbac()` TS mirrors it
  for fresh installs / PGlite tests. Keep them in sync (one test asserts they agree).
- TDD: after seed, `staff` resolves the moderator set (flag-on); `member` resolves empty; backfill
  gives every user the `user_roles` row matching `users.role`.

### B2. `updateUserRole` sync + last-admin floor (INV-4)
- `updateUserRole(db, userId, newRole, adminId, ip?)` — after updating `users.role`, **sync
  `user_roles`**: remove the user's previous SYSTEM-role membership and add the new one (leave custom
  roles intact). Custom roles are never written to `users.role`.
- **INV-4**: refuse any role change / demotion that would leave zero users holding `admin.access`
  (generalize the `delete-user.post.ts:11-25` guard). Throw a clear error.
- The route (`role.put.ts`) calls `invalidatePermissions(userId)` AFTER the commit (cache is in the
  layer; server can't call it).
- TDD: demoting the last admin is refused; role change swaps the system `user_roles` row + keeps
  custom roles; cache invalidated.

### B3. Admin roles API + UI + client (`roles.manage`)
- API (all `requirePermission(event, 'roles.manage')`, audited, `invalidatePermissions`/
  `invalidateAllPermissions` after writes):
  - `GET /api/admin/roles` — list roles + their permission keys + member counts.
  - `POST /api/admin/roles` — create custom role (key/name/desc + permission keys, validated against
    the catalog via `isPermissionGrant`). Reject `*` for non-admin roles (only the seeded admin role
    may hold `*`).
  - `PUT /api/admin/roles/[id]` — edit name/desc/permissions. Block editing `key`/permissions of
    `isSystem` roles? Decision: allow editing a system role's permission SET (e.g. tune staff) but
    block deleting it and block removing `*`/`admin.access` from `admin`. Keep INV-7 (catalog).
  - `DELETE /api/admin/roles/[id]` — block `isSystem`.
  - `PUT /api/admin/users/[id]/roles` — set the user's custom-role assignments (multi-role);
    system/primary role still managed by `role.put.ts`. Enforce INV-4 if it touches admin.
- Client:
  - `/api/me.get.ts` — include `permissions: string[]` + `roleKeys: string[]` from
    `event.context.cpubPermissions`.
  - `composables/useCan.ts` — `useCan(key) → ComputedRef<boolean>` reading a `useState`-cached
    permission set populated on session refresh. `isAdmin` becomes (or aliases) `useCan('admin.access')`
    — but keep the `role==='admin'` fast path for back-compat.
  - `pages/admin/roles/` — list/create/edit roles + a permission-key multiselect; user admin page
    gains custom-role assignment. All gated client-side by `useCan('roles.manage')` (UX only).
- TDD: route contract tests (roles.manage gate, catalog validation, `*` restriction, INV-4); matrix
  test flag-on with seeded staff set; INV-6 sweep still green.

### B4. Flag rollout
- Ship with `features.rbac` still **default false** (no behavior change on deploy). After verifying
  seed + admin UI on commonpub.io, flip the flag there first (Phase 2 soak), then deveco/heatsync
  (Phase 4). The flip is the operator's call; the kill-switch is flag-off + `invalidateAllPermissions`.

---

## Invariants to keep green (from `docs/plans/rbac.md`)
- INV-1 no behavior change while flag off · INV-2 admin floor in code · INV-3 default-deny ·
  **INV-4 last-admin floor (now also in `updateUserRole` + role-assignment)** · INV-5 bootstrap ·
  INV-6 every admin route gated · INV-7 catalog exhaustive. Run the existing sweep/matrix tests at
  every commit.

## Release (per STATUS.md runbook)
- Bump: `schema` (stakeholder role + any validator), `server` (seed/authz/updateUserRole),
  `auth` (only if `hasPermissionPure` touched — likely not), `config` (no change), `layer` (routes/
  UI/useCan/me). Publish order schema → config → … → server → … → layer; layer ONLY via
  `pnpm run publish:layer`.
- Migration **0025** additive (stakeholder role + RBAC seed/backfill). Commit the drizzle SQL.
- Update deveco/heatsync/CLI pins (hand-edit across 0.x minors). Deploy commonpub (push main),
  then deveco + heatsync; **curl-verify** `/api/health`, the new `/api/admin/roles` (as admin),
  and that 0025 applied. Update `docs/STATUS.md` + session log.

## Standing-rules checklist
- TDD (tests first) · feature already flagged (`features.rbac`); contest editor rides the existing
  `contests` flag (no new flag needed — it's an extension of contest access) · no hardcoded color/font
  · `var(--*)` only · no em dashes in user-facing copy · session log after · no AI co-author in git.
