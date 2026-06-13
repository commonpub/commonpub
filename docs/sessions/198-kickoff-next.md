# Kickoff — next session (after session 197: contest large-text hardening + HTML render)

Read this, then start. Canonical runbook: `docs/STATUS.md`. Work log:
`docs/sessions/197-contest-largetext-hardening.md`. New invariants:
`codebase-analysis/09-gotchas-and-invariants.md` (4 fresh entries — see below).
**Always `curl /api/features` + `npm view @commonpub/<pkg> version` before trusting any
state claim.** This file supersedes `197-kickoff-next.md`.

## ✅ Where things stand (2026-06-11, all SHIPPED + LIVE on all 3)

Published: **schema 0.43.0 / config 0.22.1 / protocol 0.13.0 / auth 0.8.0 / server 2.86.0 /
ui 0.13.1 / theme-studio 0.6.1 / editor 0.7.12 / infra 0.8.0 / layer 0.76.0 /
create-commonpub 0.5.15 (crates.io — STALE, see backlog)**. Migrations through **0023**.
All three instances healthy + rolled in lockstep (commonpub.io builds the workspace;
deveco + heatsync pin `^0.43 / ^2.86 / ^0.76` from npm).

**Session 197 — one incident, three shipped rounds + a footer fix:**

1. **Large-text hardening** (schema 0.41 / editor 0.7.12 / layer 0.74) — a big HTML blob pasted
   into a contest description slowed the server, logged the user out, and made their *draft*
   404 ("not found"). Root causes + fixes:
   - **Ingest:** `parseBody` (`layers/base/server/utils/validate.ts`) now rejects
     `Content-Length > 10MB` with 413 **before** `readBody` buffers + `JSON.parse`s. One
     chokepoint for all JSON writes. Generous on purpose — `content` is `z.unknown()`
     (unbounded), a tight cap would reject real large saves. Multipart uploads bypass `parseBody`.
   - **Render:** the markdown parser (`packages/editor/src/markdown/parser.ts`) was building a
     fresh `unified()` processor PER block node (O(N)); now shares two frozen processors
     (`treeToHtml`) + a 100k backstop → plain text. Output verified byte-identical.
   - **Caps:** contest description/rules/prizesDescription 10k → **50k** (`CONTEST_RICH_TEXT_MAX`,
     still bounded). Columns are already `text`, no migration.
   - **Logout:** `useAuth().refreshSession()` no longer clears auth on a *thrown* `/api/me`
     (network/5xx/slow) — only a successful "no session" response logs out.
   - **Edit page:** `useLazyFetch` flashed "Contest not found" during client-nav loading; now
     `status`-gated loading state.
2. **Markdown ⇄ Full-HTML render** (schema 0.42 / server 2.85 / layer 0.75, **migration 0022**) —
   markdown mode mangles a styled HTML document (CommonMark indented-code + the strict
   `sanitizeBlockHtml` strips `div/section/svg/style`). Added an HTML render mode via
   **`sanitizeRichHtml`** (`useSanitize.ts`): a permissive but **default-deny** allowlist that
   renders layout/CSS/SVG verbatim (tag/attr CASE preserved so `viewBox`/`linearGradient` survive)
   but drops `<script>/<style>/<iframe>/<object>/<embed>` *with bodies*, `on*`, `javascript:` URLs,
   and scrubs `url()/expression()/@import/behavior` from `style`. Script execution is NEVER
   allowed even in HTML mode (pages render to untrusted viewers). `CpubMarkdown` gained a `format`
   prop. Contest detail page switched `useLazyFetch` → blocking `useFetch` (SSR-render the body,
   kill the empty-description flash).
3. **Per-field format** (schema 0.43 / server 2.86 / layer 0.76, **migration 0023**) — split the
   single `contentFormat` into independent `descriptionFormat` / `rulesFormat` /
   `prizesDescriptionFormat`. New `FormatToggle.vue` (compact Markdown/HTML segmented control)
   beside each field's label in create + edit. **The old `content_format` column is left inert
   (deprecated)** — dropping-while-adding is a rename-ambiguous diff drizzle-kit can't resolve
   headlessly (no TTY); 0023 just ADDs the three.
4. **deveco footer** — GitHub link → `https://github.com/devEcoConsultingLLC/deveco-io`
   (`deveco-io/layouts/default.vue`, hardcoded, not config-driven).

**Hard-won invariants (re-read before touching contest text / sanitizer / migrations):**
- `codebase-analysis/09-gotchas-and-invariants.md` gained 4 entries: free-text fields are
  load-bearing-bounded at BOTH ingest + render; transient `/api/me` must not log out;
  `useLazyFetch` renders the not-found branch during client-nav loading; contest long-text has
  two render paths gated PER-FIELD (+ `sanitizeRichHtml` must never gain script-capable tags).
- **Consumer deploys hard-fail on a stale `pnpm-lock.yaml`** (CI runs `pnpm install
  --frozen-lockfile`). Bumping deveco/heatsync pins = update BOTH `package-lock.json` (npm/Docker)
  AND `pnpm-lock.yaml` (`pnpm install --lockfile-only`). deveco's npm lock is gitignored;
  heatsync's is tracked. (Bit me mid-session; now a memory.)
- **drizzle-kit `db:generate` needs a TTY** to resolve add+drop column ambiguity — it throws
  headlessly. Keep migrations ADD-only here, or drop columns in a separate pure-drop generate.

## Carried-over backlog (verified still open)

- **Drop the deprecated `content_format` column** — left inert in `contests` (session 197). Drop
  it in a later *interactive* `db:generate` (the headless one can't disambiguate the 3-way split).
- **`create-commonpub` CLI pins are STALE** — still ^schema 0.35 / server ^2.82 / layer ^0.64-era;
  now trails 0.43/2.86/0.76. Only affects NEW scaffolds. Bump `template.rs` + `tests/cli.rs` +
  `Cargo.toml`, `cargo test`, `cargo publish` (crates.io; needs local creds or the tag workflow).
- **`@commonpub/test-utils` publish drift** — source `mockConfig.ts` ahead of published 0.5.6.
- **P3 mirror-request approve round-trip** — only un-exercised federation flow; `approveMirrorRequest`
  still not transactional (wrap in `db.transaction` when touching it).
- **Deferred theme architecture** — forked custom theme reproduces tokens but not parent component CSS.
- **Theme Phase E remainder** — `border-style` token + full per-component radius migration.
- **Contest deferred** — judge scores single-slot not per-round (tag `judgeScores` by `stageId`);
  cohort-scoped judging gating; B3 submission templates + teams.
- **Search follow-ups** — Postgres path has no relevance ranking (recency stands in); revisit
  `search/index.get.ts` branch order if Meilisearch is ever properly indexed.

## Respect these memories

[[feedback_consumer_dual_lockfile_frozen_install]] (NEW — update BOTH lockfiles), [[reference_status_runbook]],
[[feedback_pnpm_publish_layer]], [[feedback_caret_semver_0x_minor_bump]], [[feedback_npm_propagation_lag]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_no_long_deploy_poll_loops]], [[feedback_layer_source_consumer_typecheck]],
[[feedback_verify_flag_state]], [[feedback_no_em_dashes_in_copy]], [[feedback_no_coauthor]],
[[feedback_cli_scaffolder]], [[feedback_vue_tsc_strict_vs_vitest]].
