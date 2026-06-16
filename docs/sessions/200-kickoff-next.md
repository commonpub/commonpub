# Kickoff — next session (after sessions 199–200: field-drop, scheduled publishing, uploads infra, federation fixes, terms, full roll)

Read this, then start. Canonical runbook: `docs/STATUS.md`. Work log:
`docs/sessions/199-field-drop-audit-and-scheduled-publishing.md` (incl. the uploads-infra
addendum). **Always `curl https://<instance>/api/health` +
`npm view @commonpub/<pkg> version` before trusting any state claim.** Supersedes
`198-kickoff-next.md`.

## ✅ Where things stand (2026-06-16) — ALL SHIPPED + ROLLED TO ALL 3

Published to npm + deployed to commonpub.io, deveco.io, heatsynclabs.io (all health 200, migration
**0024** applied everywhere). **npm: schema 0.44.0 / server 2.88.0 / layer 0.81.0** (config 0.22.1
unchanged). Everything from sessions 199–200 is now live on all three:

- **Image cropper** (layer 0.81.0) — reusable `ImageCropperModal` (vue-advanced-cropper, design-system
  styled): fixed aspect-ratio crop frame (avatar 1:1 PNG, banner 4:1, cover 16:9 JPEG), drag +
  zoom (slider/+-/scroll/pinch), WYSIWYG. Wired into the shared `ImageUpload` → hub/event/contest
  avatar+banner+cover. Render **verified headlessly** (Playwright). Also fixed a shared a11y bug:
  `useFocusTrap` now restores focus on the v-if-unmount close path (improves **all** modals).
  **Follow-ups NOT done:** the cropper is NOT yet wired into **profile** avatar/banner or the
  **content editors'** cover/banner (those use their own upload handlers); and the on-page **banner
  display containers** are fixed-height (viewport-dependent aspect) so a 4:1 crop still cover-crops
  slightly on wide screens — align them to the crop aspect for true end-to-end WYSIWYG.

- **Field-drop fixes** — hub icon/banner/privacy/website, video `categoryId`, content custom slug,
  learning `coverImageUrl`, lesson `durationMinutes` (PR #35).
- **Scheduled publishing** — `content_status` += `'scheduled'`, `scheduled_at`, atomic-claim worker
  + 60s plugin + `POST /api/content/[id]/schedule` + editor Schedule button (PR #35).
- **Uploads** — Dockerfile bundles sharp/@aws-sdk/client-s3/ioredis (pruned optional-peers);
  DO Spaces wired via deploy secrets. NOTE: this Dockerfile fix is in the **commonpub** repo;
  deveco/heatsync have their OWN Dockerfiles (both use non-frozen `npm install`) — if they enable
  image uploads, verify sharp/aws-sdk are present and configure their own Spaces (PR #36/#37).
- **Federation** — inbound `Update(Group)` ingests a remote hub's icon/banner/name (was ignored, so
  hub avatar/banner never federated); manual hub-mirror no longer drops `bannerUrl`; **registry peer
  discovery** via `GET /api/admin/registry/directory` + the Registry tab now shows for
  `announceToRegistry` instances (read-only) so pinging instances can see all peers (PR #39).
- **Terms** — templated Community Terms + Code of Conduct (`pages/terms.vue`): substitutes the
  instance name/domain from config, collapses "CommonPub and X" → "CommonPub" on the canonical
  instance. Verified live: commonpub "Welcome to CommonPub.", deveco "CommonPub and devEco.io",
  heatsync "CommonPub and heatsynclabs.io" (PR #41).
- **Hardening** (audit of PR #39) — `Update(Group)` bounds hub `name` + accepts only http(s)
  icon/banner; `bannerBgStyle()` util quotes/validates the federated-hub banner CSS `url()` sink
  (PR #41).

Publish: `pnpm --filter @commonpub/<pkg> publish --no-git-checks --access public` for schema/server,
`pnpm publish:layer` for the layer (NEVER `npm publish` — [[feedback_pnpm_publish_layer]]). Consumer
roll: bump `^0.44 / ^2.88 / ^0.79` pins; deveco's `package-lock.json` is **gitignored** (only commit
`pnpm-lock.yaml`), heatsync tracks **both** ([[feedback_consumer_dual_lockfile_frozen_install]]).
Both consumer deploys are non-frozen `npm install`, so the pin bump is what matters; their deploy
health check WARNS-not-fails ([[feedback_deploy_health_check_warn_not_fail]]) — curl /api/health to
confirm.

## ⚠️ Still open — rotate the Spaces key

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
