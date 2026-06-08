# Kickoff — next session (after session 191: docs/env accuracy audit + CLI latest — ✅ SHIPPED)

Read this, then start. Canonical runbook: `docs/STATUS.md`. This session's work log:
`docs/sessions/191-codebase-analysis-audit.md`.
**Always `curl /api/features` + `npm view @commonpub/<pkg> version` / `cargo search create-commonpub`
before trusting any state claim.**

## ✅ SHIPPED this session (2026-06-07, session 191) — all on `main` (a0040a8)

Docs/tooling only — no `@commonpub/*` package code changed, no deploy needed (the 3 live instances
already use correct env files; the template fix is for FRESH deploys).

- **codebase-analysis/ accuracy audit** (the original ask): every file re-verified against source after
  sessions 189/190. Counts → 90 tables, 45 enums, 111 validators, 21 migrations, 130 FKs, 139 components,
  22 flags, 7 themes. Corrected the contest 7-state lifecycle + consent-based mirror diagrams, the
  public-API metrics/CORS surface, **all 13 hooks are emitted** (was "8"), and removed false "uses Fedify"
  claims (federation.md, protocol/layer/worker READMEs; ADR-004/019/023 marked superseded). Also fixed
  STATUS, facts.md, conventions.md, guides, plans, root + package READMEs.
- **Deploy env-var fix (functional):** the deploy templates used bare `DATABASE_URL`/`AUTH_SECRET`/etc.
  that Nuxt's runtimeConfig never reads → a fresh one-click/docker deploy would boot with no DB and crash
  on the auth-secret guard. Fixed `deploy/app-spec.yaml`, `do-one-click.sh`, `.env.prod.example`,
  `.env.example` to `NUXT_`-prefixed names (`UPLOAD_DIR`/`MEILI_*`/`S3_*`/`FEATURE_*` stay bare). Also
  `do-one-click.sh`: `drizzle-kit push --force` → `db-migrate.mjs`. **Empirically proven** by running the
  real app (bare → "DATABASE_URL is not configured"; NUXT_ → boots) + a full Dockerized fresh instance.
- **create-commonpub 0.5.8 PUBLISHED to crates.io:** pins bumped to latest (config ^0.19 / layer ^0.64 /
  schema ^0.35 / server ^2.82), default theme → **Stoa**, recommends `pnpm db:migrate`, `.env` uses
  `NUXT_REDIS_URL`, dropped deprecated `article`. `cargo test` 29 pass; scaffold→install→migrate→build→run
  verified (homepage 200, `data-theme="stoa"`).

## Verified non-issues (cross off the old backlog)
- **GitHub Actions Node-20 deprecation (was flagged for 2026-06-16):** NON-ISSUE — every action in
  `.github/workflows/` is already `@v4`/current (Node 20); no Node-16 actions. Nothing to do.

## Open items / next steps (genuinely paused — most need operator / multi-instance)

- **P3 mirror-request approve round-trip** — still the only federation flow un-exercised end-to-end.
  Needs an admin login on TWO instances (request from A, approve on B, confirm B pull-mirrors A). Carry-over
  from session 188.
- **E2E green (draft PR #7)** — the prod-build switch surfaced 7 console-error failures on
  auth/create/admin-theme pages + e2e-prod-env config gaps (live login itself works). Finish + merge.
- **deveco/heatsync custom-theme-fork fix** — they're pinned layer `^0.62`, so their operators still hit
  the fork-reverts-to-Classic bug (fixed in 0.64). Bumping their pins to `^0.64.0` is SAFE only if they
  have an explicit `instance_settings.theme.default` set (else the `base→stoa` fallback flips their
  branding). Confirm via admin → Appearance BEFORE bumping.
- **`approveMirrorRequest` not transactional** (STATUS "deferred federation backlog") — a duplicate
  `Accept(Offer)` is possible on partial-failure retry. Harmless today; wrap in a `db.transaction` when
  touching that path. (Server change → publish + deploy cycle.)
- **`@commonpub/test-utils` 0.5.6 publish drift** — source has a `mockConfig` flag the published 0.5.6
  lacks; publish a patch to sync if a consumer needs it.
- **Deferred theme architecture** — a forked custom theme reproduces token-driven styling but not a parent
  theme's explicit component CSS rules (e.g. Stoa's `h1{font-family:serif}`, the logo swap). Full fix =
  apply the parent theme's CSS on the live custom-theme page. Risk to existing custom themes → deliberate pass.
- **Stoa "feel" polish** — subjective/ongoing (roundness, border contrast, heading weight, shadow lift).
  Iterate via Playwright `addStyleTag` against the live layout BEFORE deploying.
- **Contest deferred** (from `docs/plans/contest-stages-and-editor-polish.md`): judge scores are
  single-slot not keyed by round (2nd review round overwrites — tag `judgeScores` by `stageId`);
  cohort-scoped judging gating; B3 (submission templates + teams).

## Respect these memories
[[feedback_cli_scaffolder]], [[feedback_caret_semver_0x_minor_bump]], [[feedback_pnpm_publish_layer]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_no_long_deploy_poll_loops]], [[feedback_verify_flag_state]], [[feedback_no_em_dashes_in_copy]],
[[feedback_no_coauthor]], [[feedback_nuxt_env_only_declared_keys]], [[feedback_verify_packages_changed_before_publish]].
