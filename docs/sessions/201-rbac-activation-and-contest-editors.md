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

## Adversarial audit + fixes (same session, commit 2)

An independent adversarial review found a **P0 privilege-escalation** plus hardening gaps; all fixed:

- **P0 — admin bypass via `admin.*` wildcard.** `sanitizeGrants` stripped only the literal `*`, but
  `admin.*` (a valid segment wildcard) expands to `admin.access` in `hasPermissionPure` — so a
  `roles.manage` holder could create a custom role with `admin.*` and self-assign full admin. **Fix:**
  `ADMIN_BYPASS_GRANTS = {'*','admin.access','admin.*'}` stripped from every non-admin role
  (`rbac/admin.ts`). Regression test asserts a role granted `admin.*`/`admin.access` resolves NEITHER.
- **P1 — `users.manage` → mint-admin path.** `role.put.ts` gated only on `users.manage`, so a custom
  role with `users.manage` (but not admin) could promote anyone to the `admin` system role. **Fix:**
  promoting to `admin` now additionally requires `admin.access`. Combined with the P0 fix, escalation
  to admin from a custom role is fully contained.
- **P1 — reserved-key aliasing.** `createRole` now rejects the 5 system keys (`ROLE_KEY_RESERVED`),
  so no custom role can be keyed `admin` and inherit the `*` exception.
- **P2 — migration re-run safety.** `ADD COLUMN` → `ADD COLUMN IF NOT EXISTS` (0025 is now multi-stmt).
- **P2 — SQL/TS seed drift.** New test parses migration 0025's staff `CROSS JOIN` block and asserts it
  equals `STAFF_PERMISSION_SET` (the two seed paths can no longer drift silently).
- **P2 — test quality.** Added a full `rbac/admin.integration.test.ts` (createRole strips `*`/`admin.*`,
  reserved + dup key, updateRole replace/tune-staff/force-retain-admin-`*`/strip-`*`, deleteRole
  cascade + system-block, setUserCustomRoles add/remove/ignore-system, list counts/order) + INV-4
  POSITIVE case (demotion succeeds with 2 admins) + custom-role-survives-system-swap + editor-cannot-
  delete + expanded idempotency (roles/grants/user_roles all stable).

**Known non-regression (documented, not fixed):** INV-4's last-admin count is non-transactional
(check-then-act) — two concurrent demotions of the final two admins could race to zero. Matches the
pre-existing `delete-user` guard; break-glass (`admin-promote.yml` raw SQL + the `users.role='admin'`
floor) recovers. Wrap in a tx + row-lock if it ever matters.

Re-verified after fixes: server 1376 · layer 1021 · schema 466 · `nuxt typecheck` 0 errors · migration
0025 re-applied clean to a fresh Postgres.

## Robustness pass + missing UI + docs (commit 4)

A second independent review (robustness/edge-cases/test-determinism, separate from the security audit)
confirmed the federation-leak check is **clean** (`contest_stakeholders.role` is never serialized to
ActivityPub — only `contest/` references it), `viewerCanManage` is anon-safe, and cache invalidation
is correct. Fixes:

- **P1 — `addContestStakeholder` double-submit 500.** Select-then-insert with no `ON CONFLICT` could
  race the unique `(contestId,userId)` constraint on a double-click. Now `onConflictDoUpdate(set role)`
  (idempotent, matches the `rsvpEvent` precedent).
- **Missing UI (user request).** The `/api/admin/users/[id]/roles` endpoints existed but nothing used
  them — added per-user **custom-role assignment** to `/admin/users` (expandable row, checkboxes for
  non-system roles, only shown when custom roles exist). `roles.vue` (role CRUD) + sidebar link were
  already present.
- **Test hardening** (mutation-survival gaps the reviewer named): `userRoleEnum` ↔ `SYSTEM_ROLE_SEEDS`
  lockstep guard; additive no-clobber test (operator-added grant survives re-seed); INV-1-with-seed
  (staff still resolves empty with flag OFF after seeding); broadened the SQL drift test to all 5 role
  keys + admin `*` (not just staff); a real `memberCount >= 1` assertion (kills the "hardcode 0"
  mutation); restored the shared staff role after the "tune staff" test (isolation). Confirmed
  `seedRbac` is **not** wired to startup (only migration 0025 seeds in prod, once → operator edits to
  system roles persist).
- **Docs updated:** `docs/reference/guides/contests.md` (reviewer/editor + edit-authz),
  `docs/llm/facts.md` (201 timeline entry), `docs/llm/gotchas.md` (new RBAC section: the no-op-without-
  seed trap, the `admin.*` bypass, INV-1 short-circuit, editor scoping), `docs/plans/rbac.md` (Phases
  0–3 built), `docs/STATUS.md` (201 in-flight note).

Final gates: **server 1379 · layer 1021 · schema 466 · nuxt typecheck 0 · migration 0025 clean.**

## Production-readiness pass (commit 5) — transactions, degradation, personas

A step-back production audit (consistency, performance, cross-user state, per-persona/operator impact):

**Fixed (atomicity — the auth-critical path):**
- **`updateUserRole` is now one transaction** (INV-4 check + `users.role` update + `user_roles` swap).
  Previously sequential auto-committed statements left a window — and on a crash a PERMANENT state —
  where `users.role='member'` but the stale `admin` `user_roles` row still unioned admin's `*`
  (privilege RETENTION under flag-on). INV-4 now runs **inside** the txn with `SELECT … FOR UPDATE` on
  the admin rows, which **closes the concurrent-double-demotion TOCTOU** (was documented as a known gap).
- **`setUserCustomRoles`** read-modify-write wrapped in a transaction (no half-applied assignment set).
- **`viewerCanManage`** returned as a fresh `{ ...contest, viewerCanManage }` instead of mutating the
  fetched row — defensive against a cross-user leak if `getContestBySlug` is ever cached.
- New atomicity test: a `member→staff→verified` swap chain leaves EXACTLY ONE system membership.

**Verified safe (no degradation / no interference):**
- **Flag OFF (default) = zero new per-request DB work in the resolver** (admin + flag-off paths pass
  `primaryRole` and skip the query); authz is byte-identical to pre-change.
- **Flag ON**: one cached (30s, 5000-entry LRU) `user_roles→role_permissions` resolve per authed
  request — fine at maker-community scale.
- The auth middleware's `attachPermissions` is **try/caught** → a transient resolver DB error leaves
  permissions unset and the admin floor survives; no 500.
- Contest mutate fns' new `canManage` param has only route + test callers (verified). Migration 0025 is
  additive + idempotent and applies clean (re-verified on a fresh Postgres); it requires the 0009 RBAC
  tables, which are present on all 3 instances.
- Federation unaffected (RBAC + `contest_stakeholders.role` are instance-local).

**Operator / persona notes (no code change; for the release):**
- **Flipping `features.rbac` activates latent `staff` moderators** — every existing `role='staff'` user
  gains the moderator set on flip. Operators should audit who holds `staff` before enabling.
- **Editors/reviewers have no "contests I can edit/review" list** — they reach a contest via the
  in-app notification + link. A "my collaborations" view is a future nice-to-have.
- **Per-request `isContestEditor` query** runs on authenticated contest detail views (one tiny indexed
  lookup). Could be folded into `canViewContest` later; not a scale concern now.
- Multi-pod cache invalidation is per-process (≤30s elsewhere) — documented, acceptable for v1.

Final gates: **server 1380 · layer 1021 · schema 466 · nuxt typecheck 0 · migration 0025 clean.**

## Deployed to commonpub.io (2026-06-17, commit 6 + merge)

PR **#51** squash-merged to `main` (merge `3edc768`) → Deploy Production run **success**:
- `✅ db:migrate succeeded` — migration **0025** applied to commonpub.io's real DB (roles seeded,
  `user_roles` backfilled, `contest_stakeholders.role` added).
- `✅ / → 200`, `✅ /api/health → 200`, smoke passed.
- Live verify: `/api/features` → **`rbac: false`** (flag OFF, authz unchanged), `contests: true`.

So commonpub.io runs the new code with RBAC **staged/inert** and the per-contest editor live. Built
from workspace source — **no npm publish was needed** for commonpub.io. The Node-20-deprecation line in
the run is the pre-existing GH-Actions warning (non-blocking).

## Rolled to ALL 3 + npm publish + CLI (2026-06-17, same day)

- **Published npm:** schema **0.45.0** / server **2.89.0** / layer **0.82.0** (config/auth/protocol/ui
  unchanged). Layer's deps correctly rewritten to the new versions. Version bumps committed to `main`.
- **deveco.io:** pins → ^0.45/^2.89/^0.82, both lockfiles regenerated (pnpm-lock tracked, package-lock
  gitignored), `nuxi typecheck` ✅, CI (frozen-lockfile) ✅, deploy ✅ (`db:migrate` 0025 ✅), health 200.
- **heatsynclabs.io:** pins → same, all 3 tracked lockfiles regenerated, `nuxi typecheck` ✅, deploy ✅
  (`db:migrate` 0025 ✅), health 200.
- **CLI create-commonpub 0.5.16:** `template.rs` pins + `tests/cli.rs` assertions → ^0.45/^2.89/^0.82/
  config ^0.22.1, `cargo test` 29/29.
- **Consumer-compat verified:** neither consumer overrides any file the 201 work touched (deveco:
  default/auth layouts + logo + some pages; heatsync: SiteLogo + HeroSection) — all changes additive.

### ⚠️ RBAC flag state after rollout (important)
The seed (0025) makes `features.rbac` actually *do* something, so its live state now matters:
- **commonpub.io = ON** — enabled via the new `/admin/roles` toggle (the only code path that sets the
  override; admin-auth + a click).
- **deveco.io = ON** — a **pre-existing** `rbac` override (set some earlier session, dormant because the
  tables were empty) became **active** the moment 0025 seeded. So deveco's `staff` users are now
  moderators. **Operator: confirm this is intended; if not, Disable on `/admin/roles`.**
- **heatsynclabs.io = OFF** — inert (seeded but flag off = byte-identical authz).

Kill-switch everywhere: Disable on `/admin/roles` or clear the `rbac` override in `/admin/features`
(no redeploy). The ON state is fully audited/safe (admin floor, staff=moderator-no-admin.access,
members=nothing, custom roles contained, atomic role mutations).

**Phase 4 is therefore COMPLETE** (all 3 on the new code + seed). Only open item: the operator's
decision on whether deveco/commonpub.io should stay ON.

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
