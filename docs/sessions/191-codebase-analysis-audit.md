# Session 191 — codebase-analysis deep audit (docs-only)

2026-06-07. Full multi-pass accuracy audit of `codebase-analysis/` (14 files) + the
`docs/llm/` rules pack + root `README.md`, verifying every count / version / migration /
route / flag / behavioral claim against PRIMARY SOURCE (code, migration SQL, package.json,
git). No code changed — documentation only. 17 files touched (+347 / −225).

The folder was last fully audited session 181/182 and incrementally refreshed at session 188;
it had drifted across sessions 189 (contest stages) and 190 (public-API metrics + Stoa theme).

## Ground truth (recomputed this session)

- Versions: **schema 0.35.0, server 2.82.0, config 0.19.0, layer 0.64.1, ui 0.11.1**,
  protocol 0.13.0, auth 0.8.0, infra 0.8.0, editor 0.7.11, explainer 0.7.15, learning 0.5.2,
  docs 0.6.3, test-utils 0.5.6. CLI create-commonpub 0.5.7.
- Schema: **90 tables, 45 enums, 111 validators, 21 migrations (0000–0020), 130 FK refs**
  (107 cascade / 23 set-null / 0 restrict — all explicit).
- Layer: 90 pages, **139 components**, 34 composables, **327 server/api files** (321 handlers
  + 6 tests), 22 server/routes, **10 server plugins**, 11 server middleware, 3 route middleware,
  17 builtin sections, **12 theme CSS files**, **7 built-in themes** (stoa is default).
- Server: 25 module dirs + 11 top-level files. **22 boolean flags** + identity (5 sub-flags).
- 281 git-tracked `*.test.ts`. 26 ADRs (through 028). 161 session logs (through 190).

## What changed (by class)

- **Headline counts/versions** brought current across README/01/02/05/06/08/10/11 + facts.md
  + root README.
- **Migrations 0014–0020** re-derived from SQL: 0014 mirror_requests, 0015 registry_instances,
  0016 contests.cover_image_url, 0017 contest_status +draft/+paused + show_prizes, 0018
  stages/current_stage_id, 0019 stage_state, 0020 metrics_daily. Added the 3 new tables
  (mirror_requests, registry_instances, metrics_daily) + 3 enums + contest-stage columns to 02.
- **Public API (session 190)** documented across 02/03/04/08/09: `publicApi/` now has
  cors.ts/metrics.ts/metricsRollup.ts (export names verified); 7-endpoint `/metrics/*` group
  (6× read:analytics + federation read:federation+`publicApiMetricsFederation`); 13 read scopes
  + read:*; metrics_daily; new flag.
- **Contest stages (session 189)** — rewrote the 07 contest-lifecycle diagram from the actual
  `VALID_TRANSITIONS` map (7 states, bidirectional) + status-vs-stages/cohort/per-round-judging note.
- **Stoa default theme (session 190)** in 05/06/09 + the `base→stoa` instanceTheme fallback.
- **New session-190 invariants added to 09**: metrics privacy contract (SQL-enforced + `::float8`),
  CORS `*`-safe-only-without-cookies, Stoa fallback.
- **07 instance-mirroring diagram** rewritten — push is now consent-based (`requestMirror` →
  mirror_requests Offer/Approve/Reject; createMirror is pull-only). Verified direction semantics
  in `mirroring.ts` (requestMirror asks remote to pull-mirror US; approver creates the pull mirror).
- **10-doc-audit** regenerated vs the live tree (8 top-level docs, 6 reference guides incl. hooks.md,
  14 plans, 161 sessions).

## Corrections to prior audit beliefs (session-182 claims now stale)

- **All 13 hook events are emitted** (not 8). `content:liked`/`content:unliked` fire via a ternary
  at `social/social.ts:58` (literal-string grep misses it); `user:registered` from the layer bridge
  `middleware/auth.ts`; `hub:content:shared` + `federation:hub:post:received` wired session 183.
  Fixed conventions.md (was "8 emitted").
- **`leaveHub` and `submitContestEntry` are now transaction-wrapped** ("Atomic"/"mirrors joinHub",
  session 183) — they were the two non-transactional offenders the 182 audit flagged. Fixed 02
  (03 was already correct).
- **`scripts/reconcile-counters.mjs` now exists** (idempotent counter recompute, `--check` mode) —
  182 flagged its absence. Documented in 01/02/09.
- **`events` is NOT unvalidated** — `POST /api/events` uses an inline `createEventSchema`; the only
  gap is centralization (no shared validator in validators.ts). Reworded in 03 (02 already noted it).

## Methodology / decisions

- Deterministic counts recomputed via `grep`/`find`/`git ls-files`; FK split via `onDelete:` grep.
- Behavioral claims verified by reading source; four parallel verification agents surfaced
  candidates, every candidate re-checked against code before editing. Caught + rejected agent
  false-positives (e.g. "26 server module dirs" counted `__tests__`; the real product count is 25).
- 12 + 13 verified factually accurate (date-bumped only); gotchas.md + CLAUDE.md verified clean.
- No AI attribution in any commit (standing rule honored).

## Part 2 — re-audit + wider surface (same day)

Re-verified every round-1 edit against source (caught + fixed errors I'd introduced) and audited the
docs I had NOT opened. 27 files total (+406 / −252).

### Re-verification of round-1 work
- All headline numbers re-confirmed with stricter methods: 111 validators, 90 tables, 45 enums,
  130 FK (107/23/0), 139 components (0 test `.vue`), 321 handlers (327−6), 17 builtin sections,
  10 plugins, 12 theme CSS, 4 contest tables.
- **Error I introduced/copied, now fixed:** facts.md said "hub (5 files)" — it's **6**.
- Verified `createContest` can start `draft` (schema status optional) or default `upcoming` →
  the 07 contest diagram's two initial states are right.
- Verified `approveMirrorRequest` inlines the pull-mirror insert (does NOT call `createMirror`) and
  creates a pull mirror **of the requester** → relabeled that 07 sequence-diagram step.

### Wider surface (not touched before) — fixes
- **Fedify (standing rule #: NOT Fedify) — 4 current-state docs falsely claimed Fedify is USED:**
  `docs/federation.md` ("the AP framework CommonPub uses"), `packages/protocol/README.md` ("Wraps the
  Fedify framework"), `layers/base/README.md` ("federation endpoints (Fedify-mounted)"),
  `tools/worker/README.md` ("Fedify handles actual activity delivery"). All corrected to pure-TS /
  jose / no-Fedify. **Confirmed zero `@fedify/*` dependency and zero fedify imports** repo-wide.
- **ADR-004 (Fedify)** was still "Accepted" though the decision was fully reversed → marked
  **Superseded** (history preserved). **ADR-019**'s "Fedify Integration Strategy" decision marked
  superseded. `docs/adr/002` Fedify line noted moot in doc 10. Doc 10 supersession list updated.
- **STATUS.md** reference table: ui 0.11.0→**0.11.1**, layer 0.64.0→**0.64.1**; CLI `template.rs`
  bump target layer `0.62`→`^0.64`.
- **ui/README.md**: "4 built-in theme CSS"→7; the 3-row theme table → all 7 (incl. Stoa default).
- **theming.md**: added Stoa family + 2 CSS files; "5 built-in"→7; `family` union += `stoa`.
- **contests.md**: lifecycle was wrong — "cancelled is terminal" is false (`VALID_TRANSITIONS` allows
  `cancelled→draft/upcoming`); added draft/paused, bidirectional note, cohort-exclusion, stages pointer.
- Verified clean (no edits needed): `public-api.md` (metrics/CORS/scopes all exact), `task-recipes.md`,
  `llm/README.md`, `hooks.md`, `layout-engine.md`, CONTRIBUTING/SECURITY, the other package READMEs.
- **CHANGELOG.md** has 2 deep historical Fedify entries (lines 1457/1514) — left as dated historical
  record (it explicitly runs only through session 160; doc 10 flags it as stale).

## Open / next

- Docs-only; nothing published or deployed, no version bumps.
- Remaining tail risk is longest-tail prose wording; all structural counts + the 189/190 behavioral
  surface + the wider doc surface (STATUS, federation.md, ADRs, package READMEs, reference guides)
  are now read against code.
- The session-182 impl-audit memory (if still referenced) carries the now-stale "8 hooks / leaveHub
  non-transactional / no reconcile script" claims — superseded by the corrections above.
- **Doc gap noted, not filled:** there is no ADR that formally records the "pure-TS federation, no
  Fedify" decision (004/019 are now marked superseded pointing at CLAUDE.md/facts.md). A short
  ADR-NNN could be written if ADR completeness is wanted.

## Part 3 — third deep pass (exhaustive route/cell verification + unread human docs)

Three parallel agents did the work prior passes only SAMPLED: every 04 route-table row, every 02
domain "Notable" cell, every 03 module function/behavioral claim, plus the human docs never opened.

### Findings + fixes
- **03 prose (2 stale claims I'd missed)** — module sections still said `hub:content:shared` and
  `content:liked`/`content:unliked` were "declared but not emitted", contradicting 03's own (correct)
  hooks table. They ARE emitted (`shareContent` `posts.ts:764`; `toggleLike` ternary `social.ts:58`).
  Same hooks-bug class as the conventions.md fix — now fully swept (no "not emitted" framing remains).
- **docs/guides/developers.md** (worst offender): "85 pages, 106 components, 257 API routes" →
  90/139/327; "Five built-in themes" → 7 (+ Stoa default); "15 flags" → 22 + identity.
- **docs/guides/users.md**: "Contests run in 5 phases" → 7 statuses (draft/paused) + stages note;
  "carries all 4 themes inline" → count-agnostic.
- **.env.example**: removed **dead var `NUXT_AUTH_ORIGIN`** (read nowhere; Better Auth derives baseURL
  from `NUXT_PUBLIC_SITE_URL`); completed the FEATURE_* list 10→**19** keys with correct defaults;
  `article`→`blog` in the content-types example.
- **docs/deployment.md**: feature-flag table 6→**19** `FEATURE_*` keys (verified against
  `apps/reference/server/utils/config.ts`; noted publicApi/layoutEngine/rbac have no env key);
  `article`→`blog`.
- **docs/building-with-commonpub.md**: `REDIS_URL`→`NUXT_REDIS_URL` (consumer .env sample — code only
  reads the NUXT_ form); bogus `@0.1.0` install pins → real current versions.
- **ADR-023**: its SvelteKit-specific decisions (`apps/landing/` static app never built; "CSP in
  SvelteKit hooks") marked superseded — reversed by the Nuxt switch (025); doc 10 list updated.
- **04**: public `registry/` group (2 files) added to the route-group inventory table.

### Verified clean this pass (no edits)
- **04 route tables**: zero phantom routes, zero wrong auth labels, all gotcha/prose claims true
  (events status whitelist, votes array shape, `:username` exact-match, `/api/me` null-not-401).
- **02**: every domain "Notable" cell correct (constraints, counters, soft-delete, dead-column, FK).
- **03**: all module function names export-verified; transaction list + hooks table correct.
- quickstart.md, coding-standards.md, the other ~25 ADRs, the explainer "4 themes" export (genuinely 4).

Net across the first 3 parts: ~30 files, docs-only, no AI attribution, nothing published/deployed.

## Part 4 — whole-tree sweep (plans + deploy configs + remaining READMEs)

Swept the surfaces never opened: docs/plans/ (14), the deploy/ directory, and the app/tool READMEs.
This part found **functional bugs**, not just doc drift.

### FUNCTIONAL deploy bugs (config/scripts — flagged distinctly; verified against the runtimeConfig
### contract + the working deploy.yml, but NOT runtime-tested by me)
The Nuxt app reads `NUXT_`-prefixed runtimeConfig keys (databaseUrl←`NUXT_DATABASE_URL`,
authSecret←`NUXT_AUTH_SECRET`, emailAdapter/smtp*/uploadDir, public.*←`NUXT_PUBLIC_*`) + reads
`process.env.NUXT_REDIS_URL`/`MEILI_*`/`S3_*`/`FEATURE_*` directly. The deploy TEMPLATES used
un-prefixed names the app never reads (live instances work only because operators use their own
correct `.env`). Fixed:
- **deploy/app-spec.yaml** — `DATABASE_URL`/`REDIS_URL`/`AUTH_SECRET`/`INSTANCE_*` → `NUXT_`/`NUXT_PUBLIC_*`
  (DO one-click app would otherwise start with no DB and crash on the auth-secret guard). Valid YAML confirmed.
- **deploy/do-one-click.sh** — same `.env` var renames + replaced `npx drizzle-kit push --force` with
  `node scripts/db-migrate.mjs` (standing rule; push skips the keyset partial indexes; matches deploy.yml).
  `bash -n` clean.
- **deploy/.env.prod.example** — same renames across DB/auth/redis/instance/email/upload; removed the
  false "auto-composed in docker-compose.prod.yml" claims (compose only does `env_file`); fixed the
  **stale `FEATURE_COMMUNITIES`** (the flag was renamed to `hubs` → `FEATURE_HUBS`).
- **deploy/federation-seed.ts** — `type:'article'` → `'blog'` (deprecated alias).

### README fixes
- **apps/reference/README.md** + **apps/shell/README.md** — scaffolder invocation was `pnpm create commonpub`
  / `npx create-commonpub` (no such npm package) → `cargo install create-commonpub` + `create-commonpub new`
  (Rust/crates.io). reference README "migrations via drizzle-kit" → "via drizzle-orm's migrate()".

### Plan-doc status fixes (false release-state, not just lagging checkboxes)
- **rbac.md** — Phase 0 read "NOT yet published"; added a top banner: Phase 0/1 SHIPPED + LIVE all 3
  (175–177), flag default OFF, correct release versions (schema 0.24/server 2.66/auth 0.7/layer 0.33).
- **federation-discovery-and-hardening.md** — 5 phase headers "✅ (…not yet published/deployed)" →
  "✅ (SHIPPED + LIVE on all 3, session 188)".
- **public-api-cors-and-metrics.md** — 2× "Not yet released" → "SHIPPED + LIVE on all 3 (session 190)".

### Verified clean (no edits)
deploy/README.md, Caddyfile, nginx.conf, all 3 docker-compose files, droplet-setup.sh (ports/services
consistent); tools/create-commonpub/README.md (Rust, no pins); packages/explainer/src+vue READMEs;
CONTRIBUTING.md; SECURITY.md. The other 9 plans are accurate forward-looking/shipped docs.

### Left intentionally
- **CHANGELOG.md** — explicitly historical (runs through session 160); its stale version block + 2
  early Fedify-wrapper lines are dated historical record. doc 10 flags it. Not rewritten.
- **app-spec.yaml `ORIGIN`** and OAuth/Plausible vars in `.env.prod.example` — `ORIGIN` removed
  (dead; `NUXT_PUBLIC_SITE_URL` covers it); GitHub/Google/Plausible env reads weren't located in the
  reference app, so those example lines were left untouched (uncertain, not confirmed-wrong).
- **CLI `template.rs` version pins** are stale (layer ^0.49 etc.) but that's a known publish-time chore
  (see kickoff + `feedback_cli_scaffolder`), not a doc-audit fix.

NOTE: Part 4 includes **functional changes to deploy infrastructure** (app-spec.yaml, do-one-click.sh,
.env.prod.example, federation-seed.ts) — verified against the env contract + the working CI deploy
workflow, but not runtime-tested against a live DO deploy. Review before relying on a fresh one-click deploy.

Net across all 4 parts: docs + deploy templates; no package code changed; no AI attribution; nothing published/deployed.

## Part 5 — EMPIRICALLY verified the env-var changes (ran the real Nuxt code)

Prompted to actually prove the `NUXT_` prefix requirement rather than assert it. Ran the **actual
production nitropack `applyEnv`** (`node_modules/.pnpm/nitropack@2.13.2/.../utils.env.mjs`) against the
app's real `runtimeConfig` shape:
- **Bare `DATABASE_URL`/`AUTH_SECRET` → IGNORED**: `databaseUrl=""` (→ db.ts "DATABASE_URL is not
  configured" crash), `authSecret="dev-secret-change-me"` (→ "NUXT_AUTH_SECRET must be set in
  production" crash). **`NUXT_`-prefixed → populate correctly.** Mechanism: nitro reads
  `process.env[snakeCase(key).toUpperCase()]` with prefix `NUXT_` (altPrefix). Bare names never map.
- Ran a second test asserting **all 15** NUXT_ names I wrote (databaseUrl/authSecret/emailAdapter/
  smtp*/resend*/public.*) map to their runtimeConfig keys — **all ✓**. So the deploy fixes are correct,
  not guessed. (Also cross-checked db.ts's own error strings, which literally say "Set NUXT_DATABASE_URL".)

### Bug this verification caught in MY OWN Part-4 work
- **`UPLOAD_DIR` was wrongly changed to `NUXT_UPLOAD_DIR`.** `storage.ts:265` reads
  `process.env.UPLOAD_DIR` **bare** (no runtimeConfig reader). Reverted in `deploy/.env.prod.example`
  + `do-one-click.sh`, and fixed the two comments that mislabeled it. (MEILI_*/S3_*/FEATURE_* are also
  read bare — confirmed — and were left bare correctly.)

### Additional fix from the proof
- **Root `.env.example` had the same bug** (bare `DATABASE_URL`/`AUTH_SECRET`/`EMAIL_ADAPTER`/`SMTP_*`):
  a dev copying it would crash on first DB request. Fixed → `NUXT_DATABASE_URL` (+ kept bare
  `DATABASE_URL` so `drizzle-kit db:generate`, which reads bare, still works), `NUXT_AUTH_SECRET`,
  `NUXT_EMAIL_ADAPTER`/`NUXT_SMTP_*`/`NUXT_RESEND_*`; left `UPLOAD_DIR`/`MEILI_*` bare (read bare).

Caveat: I ran the exact env→runtimeConfig mapping function (authoritative for this question), not a full
DB-connected app boot. The var-name mapping is now proven; an end-to-end DO one-click deploy is still
worth a smoke test before relying on it.

## Part 6 — FULL local Docker run of a fresh instance (the smoke test)

Built the real image (`docker build -t commonpub-app:latest .`, full monorepo build, succeeded) and ran a
fresh instance in `/tmp/cpub-fresh` via docker compose (app + postgres) configured ENTIRELY by the
corrected `NUXT_`-prefixed `.env`. Also ran the real built `.output` on host for a fast positive/negative.

### Results — all green
- **Negative (host):** booting the real app with ONLY bare `DATABASE_URL`/`AUTH_SECRET` → app throws
  `"DATABASE_URL is not configured. Set NUXT_DATABASE_URL"` on the first DB request. Proves the old
  bare-name templates were genuinely broken.
- **Positive (host):** `NUXT_DATABASE_URL` + `NUXT_AUTH_SECRET` → boots, `/api/health` ok, `/api/features` 200.
- **Full Docker compose run:** `node scripts/db-migrate.mjs` in-container (via `NUXT_DATABASE_URL`) →
  `✅ db:migrate succeeded`, **90 tables** created. Then `/api/health` ok, `/api/features` 200,
  **homepage / → 200**, `/api/content` → 200. Homepage HTML carried **"Fresh Test Instance"** (proves
  `NUXT_PUBLIC_SITE_NAME` read) and `/api/features` returned `admin=true, federation=false, hubs=true`
  (proves the bare `FEATURE_*` resolver path). Tore the stack down afterward.

### Audit corrections this part surfaced
- **Root `.env.example`** still had dead `INSTANCE_DOMAIN`/`INSTANCE_NAME`/`INSTANCE_DESCRIPTION`
  (read NOWHERE — `commonpub.config.ts` hardcodes them; the app reads `runtimeConfig.public.*`). Fixed →
  `NUXT_PUBLIC_DOMAIN`/`SITE_NAME`/`SITE_DESCRIPTION`. (`GITHUB_*`/`PLAUSIBLE_*` are also read nowhere in
  the reference app — left as optional/empty, pre-existing.)
- Final classification sweep across all 4 env files: no bare app-vars, no wrongly-`NUXT_`'d bare-vars
  (`UPLOAD_DIR`/`MEILI_*`/`S3_*`/`FEATURE_*` correctly bare), no dead `INSTANCE_*`. **Clean.**

**Conclusion: the env changes are correct and verified end-to-end in a real Dockerized fresh instance.**
The one earlier mistake (`UPLOAD_DIR → NUXT_UPLOAD_DIR`) was caught and reverted in Part 5. A fresh
CommonPub instance built from this repo boots, migrates, and serves using exactly the corrected env names.

## Part 7 — README first-time-user walkthrough + CLI scaffolder test (Docker)

### README Quick Start — followed precisely, ALL WORKS
- `git clone https://github.com/commonpub/commonpub.git` — URL reachable (`git ls-remote` returns refs). ✓
- `docker compose up -d` infra (postgres 5433 / redis 6380 / meili 7701, all configurable). ✓
- `pnpm install` + `pnpm build` — same as the Docker build in Part 6, succeeds. ✓
- `cp .env.example .env` — present in the README (good). ✓
- `pnpm --filter=@commonpub/schema db:migrate` (= `drizzle-kit migrate`) — **exit 0**, "migrations applied
  successfully", **90 tables**. (The CLAUDE.md non-zero-exit concern doesn't bite on drizzle-kit 0.31.x.) ✓
- `pnpm dev:app` — booted, `/api/health` → 200, reading the copied `.env`'s `NUXT_DATABASE_URL`. ✓

### `create-commonpub` CLI — scaffolds + RUNS, but stale
Built the CLI from source (`cargo build --release`, ok), scaffolded `create-commonpub new cpub-cli-test
--defaults` into /tmp, brought up its docker-compose infra, `pnpm install` (pulled published packages),
`pnpm db:push` (89 tables + the 2 keyset partial indexes present), then `pnpm build` + ran the production
`.output`: `/api/health` 200, **homepage `/` 200**, `/docs` 200, HTML carried the generated site name. So a
scaffolded instance genuinely works end-to-end. (`pnpm dev` homepage hit a Nuxt dev-mode vite-node socket
flake — the production build is clean, so it's dev-only.) The CLI-generated `.env` correctly uses `NUXT_`
names (NUXT_DATABASE_URL/AUTH_SECRET/PUBLIC_*/EMAIL_*) — it was already right where the repo deploy files
were wrong.

**CLI issues found (staleness/polish, NOT blockers — scaffolded app still runs):**
- `template.rs` version pins are STALE: layer `^0.49.0` (cur 0.64.1), schema `^0.27.0` (0.35.0), server
  `^2.74.0` (2.82.0), config `^0.18.0` (0.19.0) → scaffolds an OLD instance (89 tables, no Stoa, no
  public-API metrics). Known publish-chore (see `feedback_cli_scaffolder`).
- `--theme` choices are `base/dark/generics/agora/agora-dark` — **missing `stoa`/`stoa-dark`** (the new default).
- CLI "Next steps" output says `pnpm db:push` — should recommend `pnpm db:migrate` (committed migrations;
  the generated app has both scripts, `db:migrate` = the correct `db-migrate.mjs`).
- Generated `.env` sets `REDIS_URL` — should be `NUXT_REDIS_URL` (the app only reads the NUXT_ form; inert
  as written, but Redis is opt-in so it doesn't crash).
- `--content-types` help + generated config still list `article` (deprecated alias → `blog`).

All test containers + /tmp scaffolds torn down; repo left clean (no stray `.env`).

## Part 8 — fixed the CLI staleness (create-commonpub → 0.5.8)

Bumped `tools/create-commonpub` so fresh scaffolds use the LATEST CommonPub:
- `template.rs` version constants → config `^0.19.0`, layer `^0.64.0`, schema `^0.35.0`, server `^2.82.0`
  (+ refreshed the "Last synced" comment to session 191 / Stoa default).
- Default theme `base` → **`stoa`**; theme list + `--theme` help now include `stoa`/`stoa-dark`.
- CLI "Next steps" output: `pnpm db:push` → **`pnpm db:migrate`** (committed migrations, the standing-rule path).
- Generated `.env` + `.env.example`: `REDIS_URL` → **`NUXT_REDIS_URL`** (the only env var the CLI had wrong;
  the rest were already correct NUXT_ names — the CLI templates were ahead of the repo deploy files).
- Dropped deprecated `article` from default content types + the interactive picker + `--content-types` help
  (now `project,blog,explainer`).
- `Cargo.toml` 0.5.7 → **0.5.8**; updated `tests/cli.rs` version assertions.

Verified: `cargo build` ok, `cargo test` **29 passed**. Re-scaffolded + ran end-to-end in Docker: `pnpm install`
pulled **layer 0.64.1**, `pnpm db:migrate` → **90 tables** (latest schema incl. `metrics_daily`), `pnpm build`
→ production run serves homepage **200** with **`data-theme="stoa"`**. (Metrics route 404s only because
`publicApi` defaults OFF — correctly gated.) **PUBLISHED to crates.io as `create-commonpub v0.5.8`**
(`cargo publish --allow-dirty --locked`; confirmed live via `cargo search`). Published from the uncommitted
working tree (`--allow-dirty`) — the CLI source + this session's other edits are not yet git-committed.
