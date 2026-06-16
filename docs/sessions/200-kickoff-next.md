# Kickoff — next session (after session 199: field-drop audit + scheduled publishing + uploads infra)

Read this, then start. Canonical runbook: `docs/STATUS.md`. Work log:
`docs/sessions/199-field-drop-audit-and-scheduled-publishing.md` (incl. the uploads-infra
addendum at the bottom). **Always `curl https://<instance>/api/health` +
`npm view @commonpub/<pkg> version` before trusting any state claim.** Supersedes
`198-kickoff-next.md`.

## ✅ Where things stand (2026-06-16)

**commonpub.io ONLY** — session 199 + the uploads fix are LIVE there (it builds the workspace
from source). PRs #35 (field-drop + scheduled publishing), #36 + #37 (uploads infra) merged +
deployed; migration **0024** applied. Verified live: schedule endpoint returns 401 (deployed),
and in the prod container `sharp:fulfilled aws:fulfilled ioredis:fulfilled` + a real S3 PutObject
to DO Spaces succeeded and served publicly (HTTP 200).

**Repo versions: schema 0.44.0 / server 2.87.0 / layer 0.77.0.** Migrations through **0024**.

## ⚠️ TOP PRIORITY — npm is NOT published; 2 of 3 instances are still buggy

`npm view` shows **schema 0.43.0 / server 2.86.0 / layer 0.76.0** (pre-session). deveco.io and
heatsynclabs.io consume *published* packages, so they **still have the field-drop bugs** (hub
image/video category/content slug dropped) and **lack scheduled publishing**. To finish the roll:

1. `pnpm publish` (use `pnpm publish:layer` for the layer — NEVER `npm publish`; see
   [[feedback_pnpm_publish_layer]]): publish **schema 0.44.0**, **server 2.87.0**, **layer 0.77.0**.
   Order: schema → server → layer. Poll `npm view` between (propagation lag,
   [[feedback_npm_propagation_lag]]).
2. Roll deveco.io + heatsynclabs.io: bump the `^0.44 / ^2.87 / ^0.77` pins, regenerate
   **BOTH** lockfiles each (`pnpm-lock.yaml` AND the npm/Docker lockfile —
   [[feedback_consumer_dual_lockfile_frozen_install]]), push; their deploy runs migration 0024 via
   `db-migrate.mjs`. Heads-up: those repos have their OWN Dockerfiles — check whether they hit the
   same pruned-`sharp`/`@aws-sdk` runtime issue (see below) if they do image uploads.

## ⚠️ Operator action — rotate the Spaces key

The DO Spaces secret key was shared in plaintext during session 199. **Rotate it** in the DO
console, then update the `S3_SECRET_KEY` GitHub secret (`gh secret set S3_SECRET_KEY`) — no code
redeploy needed, the next deploy re-writes `.env`. (Spaces config now lives in GitHub secrets +
`deploy.yml`, not in the repo.)

## New this session — things to know

- **Scheduled publishing** is live (commonpub.io). `content_status` has a new `'scheduled'` value;
  `content_items.scheduled_at`. Worker = `layers/base/server/plugins/scheduled-publishing.ts` (60s
  sweep, atomic-claim `UPDATE…RETURNING`). Endpoint `POST /api/content/[id]/schedule`. UI: editor
  "Schedule" button. `'scheduled'` is gated exactly like `draft` (no public leak). Possible
  follow-up: author "scheduled" filter/badge in the content list; surface video category in `/videos`.
- **Uploads runtime deps**: the Dockerfile runtime stage now explicitly installs
  `sharp @aws-sdk/client-s3 ioredis` (lockfile-pinned) because they're optional-peers of
  `@commonpub/infra` that Nitro externalises and the `npm install` reconcile prunes. **Any new
  runtime-`import()`ed optional-peer dep must be added to that line or its feature 500s in prod.**
- **`d071a1c`** (operator's direct-to-main local-storage EACCES fix + `/uploads` serving route) is
  **dormant** while Spaces is configured — left as a fallback. If S3 is ever unset, that path
  reactivates.

## Cleanup done this session
- Deleted the throwaway `diag/sharp-check` branch (was used to read prod stdout via `server-cmd`).
- `deploy.yml` now has `paths-ignore` for docs/markdown so doc-only commits don't trigger a full
  prod rebuild.

## Verify-before-trust
```
curl -s https://commonpub.io/api/health
npm view @commonpub/server version          # 2.86.0 until published
gh workflow run server-cmd.yml --ref <branch-with-capture> -f command="..."   # read prod (see 199 addendum / memory)
```
