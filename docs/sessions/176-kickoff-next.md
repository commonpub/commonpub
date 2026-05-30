# Resume prompt — CommonPub (after session 175, RBAC Phase 0)

Paste between the `---` rules as the FIRST message of the next session. RBAC
Phase 0 is built, deep-audited, and fully tested on branch `rbac-phase-0` — but
**NOT yet published, NOT pushed, and NOT deployed.** Two jobs remain: (A) release
+ deploy Phase 0 (still flag-OFF, zero behavior change), then (B) Phase 1 — the
mechanical guard migration.

---

Fresh Claude Code session on the CommonPub monorepo
(`/Users/obsidian/Projects/ossuary-projects/commonpub`). commonpub.io builds from
workspace `main`; deveco.io (`ossuary-projects/deveco-io`) + heatsynclabs.io
(`heatsynclabs/heatsynclabs-io`, local `~/Projects/heatsync/heatsynclabs-io`) are
npm consumers. **No AI attribution in commits (CLAUDE.md rule #15). pnpm (never
npm) for publishing. `^0.x` caret does NOT cross minors — bump dependant pins by
hand. Always `curl /` + `/api/features` after a deploy. heatsync needs manual
droplet DDL on every schema migration (`db:push --force` drops it).**

Read FIRST, in full: `docs/plans/rbac.md` (the approved plan + session-175 audit
notes), `docs/sessions/175-rbac-phase-0.md` (what was built + the 2 bugs the audit
caught). Then the auto-memory MEMORY.md index.

## State: branch `rbac-phase-0`, 3 commits, working tree clean, NOT pushed

- `efbf059` Phase 0 primitives · `6ecc20b` audit fixes · `be331b7` INV-6/7 sweeps.
- Gates all green: `pnpm build` 15/15, `pnpm typecheck` 26/26 (0 errors), server
  1169, layer 753, schema 492, config 23, auth 84, test-utils 13.
- Migration **0009_rbac_roles_permissions** (3 additive tables: roles,
  role_permissions, user_roles; NO `ALTER` on users). Journal idx 9.
- `features.rbac` flag DEFAULT OFF (config schema + FeatureFlags type +
  layers/base/nuxt.config + client useFeatures). With it off the resolver returns
  empty sets and admins ride the gate-time floor ⇒ byte-identical to pre-RBAC.

## Phase 0 design facts the next session MUST preserve (don't regress)

- **`requireAdmin` is now `requirePermission(event, 'admin.access', 'Admin access
  required')`** (layers/base/server/utils/auth.ts) — the linchpin. All 65 admin
  routes flow through it unchanged.
- **Resolver caches an EMPTY set for admins**, NOT `{'*'}`. Admin access rides on
  the gate-time floor over the FRESH enriched `users.role`. (Caching `*` would let
  a demoted admin keep access for the 30s TTL → INV-1 break. This was audit bug #2.)
- **The gate floors on `user.role` (authoritative, from requireAuth), not
  `resolved.primaryRole`** (which is `''` after a default-deny → `??` won't fall
  back). This was audit bug #1.
- Resolver lives in the LAYER (`layers/base/server/utils/permissions.ts`), pure
  core in `packages/server/src/rbac/resolver.ts`. The middleware passes the
  enriched role so admin/flag-off paths do ZERO extra DB queries.
- Catalog = code constant (`packages/schema/src/permissions.ts`, 24 keys). Roles =
  data. `requirePermission`'s `needed` is typed `PermissionKey` → referenced keys
  are compile-checked against the catalog (INV-7 part 1).
- INV-6 sweep (`layers/base/server/api/admin/__tests__/all-routes-gated.test.ts`)
  asserts every admin route calls a guard — it will catch a dropped guard in Phase 1.

## JOB A — Release + deploy Phase 0 (flag stays OFF everywhere; do FIRST)

Gate through `pnpm build && pnpm typecheck && pnpm test` (= `publish:check`) before
publishing. Then per `docs/plans/rbac.md` Verification/Release:
- Bump: schema → 0.23.0, server → 2.64.0, auth → 0.7.0 (guards touched), config
  (minor), layer → 0.30.0. Update `create-commonpub` pins + deveco/heatsync pins
  BY HAND (caret won't cross the minor).
- `pnpm publish` in order config/schema → auth → server → layer (poll `npm view`
  between dependent bumps; never mask a publish-dependent install through grep).
- Commit the drizzle SQL (already committed on the branch). Deploy commonpub
  (workspace push) + deveco (npm, push). **heatsync: apply 0009 DDL MANUALLY on the
  droplet (`167.99.13.109`, see 174-kickoff for the heredoc pattern) and verify the
  3 tables exist BEFORE deploy** (`db:push --force` silently drops it; `| tee`
  masks the failure → green deploy + 500 live).
- `curl /` + `/api/features` on all 3 (rbac should be absent/false — flag off).
  Confirm admin endpoints still 200-as-admin / 403-as-member (unchanged).
- Decide branch strategy: squash-merge `rbac-phase-0` → `main` (commonpub builds
  from main) per CLAUDE.md, OR keep iterating on the branch through Phase 1 first.

## JOB B — Phase 1: mechanical guard migration (flag still OFF, byte-identical)

Per-domain PRs/commits. Still zero behavior change: flag off ⇒ non-admins resolve
to empty sets and admins ride the floor, so the specific key doesn't gate anything
until Phase 2 seeds roles — but pick the RIGHT key now so Phase 2 "just works".
- **73 `requireAdmin(event)` → `requirePermission(event, '<key>')`** mapping each
  admin endpoint to its catalog capability (users.* / content.* / settings.manage
  / theme.manage / layout.manage / contest.* / etc). The INV-6 sweep already
  asserts the guard is present; ADD per-domain contract tests asserting the SPECIFIC
  key per route group.
- **15 ad-hoc `user.role === 'x'` → `ownerOrPermission(event, {ownerId, key})`** —
  write this helper (`packages/server/src/rbac/ownerOrPermission.ts` per plan):
  feed `hasPermission(event, key)` into the existing service `isAdmin` boolean,
  signature-stable. These are NOT covered by the admin sweep → each needs its own
  contract test (the `entries-score-gating.test.ts` pattern). Find them with
  `grep -rn "\.role === '" layers packages --include=*.ts`.
- **SKIP hub-role checks** (`packages/server/src/hub/moderation.ts`, `members.ts`,
  `hubRoleEnum`, `PERMISSION_MAP`) — separate resource-scoped system, out of scope.
- Then Phase 2 (migration 0010 seed + backfill user_roles + flip `features.rbac`
  on commonpub.io only + generalize INV-4 last-admin floor), Phase 3 (admin
  roles UI), Phase 4 (flip flag on deveco + heatsync). `/api/me` permissions[] +
  `useCan.ts` were deferred from Phase 0 — wire them in Phase 1/3.

Work incrementally with a task list; keep `pnpm test` green at every step; run
`vue-tsc --noEmit` (CI strictness) before push. Confirm anything that looks off
before big mechanical sweeps.

---
