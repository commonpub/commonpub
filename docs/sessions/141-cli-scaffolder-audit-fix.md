# Session 141 — CLI scaffolder audit + fix

Date: 2026-05-15.

Audited `tools/create-commonpub` (the Rust scaffolder) against the
proven deveco.io thin-app production pattern. It generated the right
*shape* (npm deps, `extends: ['@commonpub/layer']`, theme override,
config-flag features) but had three serious divergences plus minor
gaps. Fixed the clear-cut ones; flagged one structural issue.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | CRITICAL | Version pins ~18 minors stale (`layer ^0.3.24` vs `^0.21.1`, `server ^2.15.0` vs `^2.51.0`, `schema ^0.8.12` vs `^0.16.0`, `config ^0.7.1` vs `^0.12.0`). A new instance installed a layer predating the identity system + migrations 0003/0004. | **fixed** (constants + bump) |
| 2 | HIGH | Dockerfile used `pnpm@latest` (both stages) — the session-140 deveco time-bomb. | **fixed** (pinned 10.10.0) |
| 3 | HIGH | No `scripts/db-migrate.mjs`; used `drizzle-kit push` which CLAUDE.md forbids in CI. | **fixed** (added script + CMD + package script) |
| 4 | MEDIUM | deploy.yml stub had no migration step. | **fixed** (comment explains auto-migrate) |
| 5 | LOW | `.env` didn't document `CPUB_FED_TOKEN_KEY`. | **fixed** |
| 6 | LOW | config/nuxt feature lists omit newer flags (zod-defaulted, functionally OK). | not changed (cosmetic) |
| — | STRUCTURAL | Hardcoded version constants go stale the moment a package publishes. | **deferred** — needs a release hook or scaffold-time `npm view` |

## What changed (commit `6ed59ed` + `969ab87`)

`tools/create-commonpub/src/template.rs`:
- Extracted `COMMONPUB_{CONFIG,LAYER,SCHEMA,SERVER}_VERSION` +
  `PNPM_VERSION` constants at the top — single source of truth with
  a RELEASE CHECKLIST comment. Bumped to current
  (0.12.0 / 0.21.1 / 0.16.0 / 2.51.0; pnpm 10.10.0).
- `render_package_json`: uses the constants; adds `pg` dep
  (node-postgres, for the migrate script); adds `db:migrate` script.
- `render_dockerfile`: pinned pnpm via `PNPM_VERSION`; runtime stage
  COPYs `scripts/`; `CMD` chains
  `node scripts/db-migrate.mjs && node .output/server/index.mjs`.
- New `render_db_migrate_script()` — mirrors deveco's proven
  `scripts/db-migrate.mjs` (drizzle-orm `migrate()` over committed
  `@commonpub/schema/migrations`).
- `render_env`: documents `CPUB_FED_TOKEN_KEY`.
- `render_deploy_workflow`: comment now explains migrations run
  automatically (no `drizzle-kit push`).

`tools/create-commonpub/src/scaffold.rs`:
- Writes `scripts/db-migrate.mjs` during scaffold.

`tools/create-commonpub/tests/cli.rs`:
- 6 new regression tests: `dockerfile_pins_pnpm_not_latest`,
  `dockerfile_runs_migrations_not_push`,
  `package_json_pins_current_commonpub_versions`,
  `db_migrate_script_uses_migrate_not_push`,
  `scaffold_writes_db_migrate_script`, `env_documents_fed_token_key`.

19/19 cargo tests pass. Verified with a real
`create-commonpub new smoke-instance --features ... --no-docker`
run — generated package.json had current pins, Dockerfile had
`pnpm@10.10.0` + the migrate CMD, `scripts/db-migrate.mjs` present,
`.env` documented the token key.

## The structural issue (deferred — needs a decision)

The version constants are hardcoded Rust. They WILL go stale again
the next time layer/server/schema/config publishes. Three options
for a future session:

1. **Release hook** — a script in the publish flow that rewrites the
   constants in `template.rs` and rebuilds the CLI. Deterministic;
   keeps the scaffolder reproducible. Most aligned with the
   existing "bump deveco pins after publish" muscle memory.
2. **Scaffold-time `npm view`** — the Rust CLI shells out to
   `npm view @commonpub/layer version` (etc.) when generating
   package.json. Always current; needs network at scaffold time
   and a graceful offline fallback to the baked-in floor.
3. **`latest` dist-tag** — `"@commonpub/layer": "latest"` in the
   generated package.json. Simplest; sacrifices reproducibility and
   fights CommonPub's deliberate tight-caret convention.

Recommendation: option 1. Recorded in `docs/llm/gotchas.md`
("Session 141 — CLI scaffolder version drift") as a release-checklist
item so it's not forgotten until the hook exists.

## Notes

- The CLI is a Rust crate (`create-commonpub` 0.5.1), NOT in the
  pnpm workspace / turbo — JS gates don't cover it. Its own
  `cargo test` is the gate. Run it after any template change.
- `tools/create-commonpub/reference-app/` uses `workspace:*` — that
  is the tool's own monorepo test fixture, NOT the scaffold output.
  Not a bug; `template.rs` string-generates the real output.
- This commit pushed to main → triggered a Deploy Production run.
  CLI-only change, so the app rebuild is a no-op; migration count
  stays 5; nothing user-visible. (Same pattern as prior docs-only
  pushes.)

## Prod state at session start (unchanged by this work)

Both sites healthy; schema 0.16.0, server 2.51.0, layer 0.21.1,
config 0.12.0, infra 0.7.0, auth 0.6.0, test-utils 0.5.4. Migration
count 5. All `features.identity.*` flags default off.
