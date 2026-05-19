# Session 149 — DO Spaces CDN support + scaffolder storage fix

Date: 2026-05-19. Branch: `main`. **Committed locally per maintainer
("commit dont push") — NOT pushed, NOT published, NOT deployed.
Pending a deep-certainty audit before the release is pushed.**

Triggered by the user: heatsynclabs.io's Space has CDN enabled
manually; is the code emitting CDN links? do commonpub.io/deveco.io
use Spaces? should the scaffolder set new instances up with CDN?

## Findings (investigation)

- **Storage adapter** `packages/infra/src/storage.ts`: public URL =
  `config.publicUrl ?? derive(endpoint/bucket | aws-vhost)`. URLs are
  **persisted absolute at upload time** (files.public_url,
  content_items.cover_image_url + variants, learning_paths) — config
  changes only affect NEW uploads; existing rows need a backfill.
- **heatsync** emits `.cdn` only because its live (uncommitted) `.env`
  `S3_PUBLIC_URL` was hand-edited to the CDN host; committed
  `deploy/.env.prod.example` still has the ORIGIN host (drift — will
  regress on a fresh setup). Uses Spaces.
- **deveco.io**: local `./uploads` (S3 commented out) — no Spaces,
  nothing to do.
- **commonpub.io**: storage mode lives in the droplet `.env`
  (unreadable here) — likely local; confirm before any backfill.
- **Scaffolder bug**: `template.rs` `render_env` emitted commented
  `NUXT_S3_*` vars. The adapter reads bare `process.env.S3_*`; Nuxt
  does NOT map `NUXT_S3_*` → `process.env`, so a scaffolded operator
  uncommenting them got **silently no S3**. No CDN guidance anywhere.

## Changes

- `packages/infra/src/storage.ts` — added an opt-in `cdn` option +
  `S3_CDN=true` env. `derivePublicUrl` only diverges from the original
  derivation when `cdn` AND a DO Spaces endpoint AND no explicit
  `S3_PUBLIC_URL` → builds
  `https://<bucket>.<region>.cdn.digitaloceanspaces.com`. Every other
  case is byte-identical to before (strictly zero-regression;
  explicit `S3_PUBLIC_URL` still wins). 5 new storage tests
  (incl. the `cdn=false` legacy-parity assertion). infra 288 pass.
- `tools/create-commonpub/src/template.rs` — `render_env` now emits
  **bare `S3_*`** vars + a DO Spaces+CDN recipe (`S3_CDN=true`,
  endpoint, "enable CDN on the Space first"). New cli.rs regression
  test asserts bare `S3_*`/`S3_CDN` and no `NUXT_S3_` reintroduction.
  cargo 27/27.
- `layers/base/server/api/admin/storage/backfill-cdn-urls.post.ts` —
  admin-only endpoint (requireAuth+requireAdmin) that rewrites stored
  Spaces origin URLs → CDN host across `files.public_url`,
  `content_items.cover_image_url`, `learning_paths.cover_image_url`.
  Host pair is derived from THIS instance's S3 env (can't touch
  another host). `?dryRun=1` returns counts only; idempotent.
  Surfaced as a Preview/Apply "Maintenance" card in
  `pages/admin/settings.vue` (confirm dialog on Apply). Replaces the
  earlier standalone SQL script (single source of truth).

## Verification

typecheck 26/26 · lint 24/24 · cargo 27/27 · infra 288/4skip ·
all package suites pass · only the known darwin sharp `shell#build`
flake red.

## Release plan (PREPARED, committed locally, NOT pushed/published)

Version bumps + CLI pins + README/CHANGELOG are committed so the
release is ready. **Nothing published or pushed** — awaiting the deep
certainty audit. When green: publish `@commonpub/infra` 0.7.0 →
**0.7.1** → `@commonpub/server` 2.54.0 → **2.54.1** → `@commonpub/
layer` 0.21.9 → **0.21.10** (dep order, poll npm between); then
deveco.io + heatsynclabs.io `@commonpub/layer ^0.21.10`;
commonpub.io builds from source. heatsync `deploy/.env.prod.example`
turned out to be gitignored (not version-controlled) — no repo
change; the `.cdn` fix is operator-side on the droplet `.env` (see
follow-up #2). heatsync working tree left pristine (only its
pre-existing `commonpub.config.ts` M + `ONBOARDING.md` untracked).

## Operator follow-ups (need explicit go-ahead — prod-affecting)

1. **Backfill** existing origin→CDN URLs on heatsync (and commonpub.io
   if on Spaces) via `scripts/backfill-spaces-cdn-urls.sql`. Until
   then, only new uploads use the CDN; old assets keep serving from
   origin (works, just not edge-cached).
2. **heatsync `deploy/.env.prod.example`**: finding corrected — this
   file is **gitignored** in the heatsync repo (`.gitignore: .env.*`),
   so it is NOT version-controlled and there is no committed drift to
   fix (and force-adding an ignored env file would be wrong). The
   real fix is operator-side on the droplet's live `.env`: set
   `S3_CDN=true` and the `.cdn` `S3_PUBLIC_URL` (investigation
   indicates the live `.env` was already hand-edited to the `.cdn`
   host). No repo change possible/needed here; heatsync working tree
   left pristine.
3. Confirm commonpub.io droplet `.env` storage mode (local vs Spaces).
