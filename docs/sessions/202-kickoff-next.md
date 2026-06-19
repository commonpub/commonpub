# Kickoff — next session (after session 201: RBAC activation + per-contest editors)

Read this, then start. Canonical runbook: `docs/STATUS.md`. Work log + full audit trail:
`docs/sessions/201-rbac-activation-and-contest-editors.md`. Plan:
`docs/plans/rbac-activation-and-contest-editors.md`. **Always `curl https://<instance>/api/features`
+ `npm view @commonpub/<pkg> version` before trusting any state claim.** Supersedes
`200-kickoff-next.md`.

## ✅ Where things stand (2026-06-18) — ALL SHIPPED + ROLLED TO ALL 3

**npm: schema 0.45.0 / server 2.89.0 / layer 0.82.0** (config 0.22.1 / auth 0.8.0 unchanged).
**CLI: create-commonpub 0.5.16** (crates.io; pins ^0.45/^2.89/^0.82). Migration **0025** applied on
all three (commonpub.io, deveco.io, heatsynclabs.io — all health 200).

**Session 201 shipped two things:**

1. **RBAC activation.** The Phase-0/1 machinery shipped in 175–177, but Phase 2 (seed) + Phase 3
   (admin UI) were NEVER built — so enabling `features.rbac` was a no-op and `staff` == `member`.
   Now: migration 0025 seeds the 5 system roles + permission sets + backfills `user_roles`
   (`seedRbac()` mirror; idempotent); `updateUserRole` is an atomic transaction + last-admin floor
   (`SELECT … FOR UPDATE`); admin **roles UI** at `/admin/roles` (create/edit/delete + a one-click
   **Enable/Disable RBAC toggle**) + per-user custom-role assignment in `/admin/users`; `/api/me`
   returns `permissions[]`+`roleKeys[]`; `useCan()` composable. When ON: admin = full (`*` + floor),
   `staff` = moderator set (NO `admin.access`), member/pro/verified = nothing, custom roles resolve.
2. **Per-contest `editor` role** (flag-independent): `contest_stakeholders.role` (`reviewer`|`editor`).
   Editor = full edit of ONE contest, no system access, via `canManage = owner || isContestEditor ||
   contest.manage` on edit/transition/advance. Delete + judge/collaborator mgmt stay owner/
   `contest.manage` (no escalation). Manage via the contest Edit page's collaborator section.

Three adversarial audit rounds (security → robustness → production-readiness) hardened it: closed a
**P0** (admin bypass via the `admin.*` segment wildcard — `sanitizeGrants` strips
`* / admin.access / admin.*` from non-admin roles), reserved-key guard, `users.manage`→admin
promotion now requires `admin.access`, atomic role mutations, FOR-UPDATE last-admin floor, conflict-
safe stakeholder upsert. Gates at ship: server 1380 / layer 1021 / schema 466 / typecheck 0.

## ⚠️ Open items (need an operator decision / not code)

1. **`features.rbac` is ON on commonpub.io AND deveco.io; OFF on heatsync.** commonpub.io = you
   enabled it via the toggle. **deveco.io = a PRE-EXISTING `rbac` override that was dormant (empty
   tables) and went LIVE the moment 0025 seeded — so deveco's `staff` users are now moderators.**
   Decide: leave ON (intended) or **Disable** (`/admin/roles` toggle, or clear the `rbac` override in
   `/admin/features` — instant, no redeploy). Audit who holds `staff` on each ON instance.
   `curl https://<instance>/api/features | jq .rbac`.
2. **Rotate the DO Spaces secret key** (carried from session 199 — shared in plaintext). Rotate in DO
   console → `gh secret set S3_SECRET_KEY` (no redeploy; next deploy rewrites `.env`).

## RBAC — things to know (gotchas, see also `docs/llm/gotchas.md` RBAC section)

- **Enabling `rbac` does nothing without the seed** — the resolver unions `user_roles→role_permissions`;
  empty tables = same as flag-off. 0025 is the seed (deploy path); `seedRbac()` is the fresh-install/
  test mirror and is **NOT** wired to startup, so operator edits to a system role's perms persist.
- **INV-1 holds via the resolver short-circuit, not empty tables.** Flag-off returns the legacy
  mapping (admin via floor) BEFORE reading the now-seeded tables. Never gate guards behind the flag
  (`requireFeature('rbac')` would 404 admin endpoints) — the flag lives only in the resolver.
- **Stripping `*` isn't enough** — `admin.*` expands to `admin.access` in `hasPermissionPure`. The
  whole `ADMIN_BYPASS_GRANTS` set is stripped from non-admin roles (`packages/server/src/rbac/admin.ts`).
- **Kill-switch:** Disable on `/admin/roles` (or clear the override) reverts to admin-only instantly.

## Consumer roll recipe (for the next bump)

Publish: `pnpm --filter @commonpub/<pkg> publish --no-git-checks --access public` (schema/server),
`pnpm publish:layer` for the layer (NEVER `npm publish` — workspace:* leak). Poll `npm view` between.
Consumers: hand-edit `^0.45 / ^2.89 / ^0.82` pins (caret won't cross 0.x minors), then **deveco**:
`npm install` + `pnpm install --lockfile-only`, commit `pnpm-lock.yaml` ONLY (package-lock gitignored);
**heatsync**: same but commit BOTH lockfiles (tracked). Both deploys are non-frozen `npm install` +
WARN-only health — `curl /api/health` to confirm. CLI: bump `template.rs` pins + `tests/cli.rs`
asserts + `Cargo.toml`, `cargo test`, push tag `create-commonpub-v<ver>` → `cli-release.yml` publishes.
**Verify the layer compiles in a consumer before/after publish** (`npx nuxi typecheck` in deveco-io)
— layer source is typechecked IN the consumer.

## Verify-before-trust
```
for h in commonpub.io deveco.io heatsynclabs.io; do curl -s https://$h/api/features | jq '{rbac}'; done
npm view @commonpub/layer version          # expect 0.82.0 (schema 0.45.0 / server 2.89.0)
cargo search create-commonpub              # expect 0.5.16
```
