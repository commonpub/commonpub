# Session 142 — Admin bootstrap, one-click DigitalOcean deploy, import lazy-images

Date: 2026-05-16.

Two user asks, both audited → fixed → shipped → verified on both
prod sites.

## 1. "Can you scaffold + one-click-deploy to DO and set the admin?"

**Before:** the admin-bootstrap mechanism existed in the layer
(`auto-admin.ts`) but was invisible to scaffolded instances, and
there was NO DigitalOcean deploy spec anywhere (ADR 022 §4 specified
`.do/app.yaml` but it was never built).

**Shipped:**
- `layer 0.21.2` — `auto-admin.ts` gains the production opt-in
  `ADMIN_BOOTSTRAP_FIRST_USER` (1/true/yes): first registered user
  becomes admin when no admin exists and no `ADMIN_BOOTSTRAP_USER`
  is set. Default behavior unchanged; both prod sites already have
  admins (plugin early-returns) and don't set the env → zero impact.
- CLI (`tools/create-commonpub`, repo-only): `--admin-user` flag +
  interactive prompt; `.env`/`.env.example` surface
  `ADMIN_BOOTSTRAP_USER` / `ADMIN_BOOTSTRAP_FIRST_USER` (default =
  first-user, zero-config); new `.do/deploy.template.yaml` (DO App
  Platform spec — Dockerfile service, `/api/health` check, managed
  Postgres 16 bound to `NUXT_DATABASE_URL`, `NUXT_AUTH_SECRET` as
  SECRET, admin env wired); README "Deploy to DigitalOcean" button;
  7 new cargo regression tests (26/26 pass).

End-to-end path now exists: scaffold → push to GitHub → click
Deploy-to-DO → register → you're admin (or `--admin-user`/
`ADMIN_BOOTSTRAP_USER` for a named admin).

## 2. "Does import pull all images from a Hackster project?"

**Audited answer: No.** `ImportResult` has a single
`coverImageUrl`. In-story images were broken because Hackster (and
Medium, most CMSes) lazy-load: `<img src="data:…placeholder"
data-src="real.jpg">` and Turndown only reads `src`. There was zero
`data-src`/`srcset` resolution anywhere in the import module.

**Shipped — `server 2.52.0`:** new `import/images.ts`
`resolveContentImages(doc, baseUrl)` rewrites every `<img>` to its
real absolute URL (data-src / data-original / data-lazy-src /
data-srcset / srcset largest-descriptor / non-placeholder src),
strips lazy attrs, run BEFORE extraction in both
`platforms/hackster.ts` (before `extractStoryHtml`) and `generic.ts`
(before Readability). In-story images now survive as real image
blocks for Hackster AND every generic URL. 9 new unit tests; all 71
import tests pass (existing 19 hackster + 10 generic unbroken).

**Deliberately deferred (documented, bigger scope):** Hackster
project photo gallery/carousel extraction as an image set, and
downloading/re-hosting images into instance storage (import keeps
external CDN URLs; the display-time image-proxy is separate).

## Versions live on both sites (post-deploy verified)

schema 0.16.0, server **2.52.0**, config 0.12.0, layer **0.21.2**,
auth 0.6.0, infra 0.7.0, test-utils 0.5.4. Migration count 5
(no schema change this session). All `features.identity.*` and
`ADMIN_BOOTSTRAP_FIRST_USER` default off → no behavior change to
existing prod.

## Deploy notes / surprise

- **commonpub.io's first deploy of server 2.52.0 FAILED** at the
  post-build "Load image and restart" step with
  `ssh: handshake failed … connection reset by peer` — a transient
  network failure between GitHub Actions and the droplet, NOT a code
  or build issue (Docker build had already succeeded; deveco built
  the same published packages and deployed fine; layer CI was
  green; commonpub.io stayed healthy on the old container — zero
  downtime). Fixed by `gh run rerun --failed` (reuses the built
  image, retries the SSH load+restart). Re-run succeeded.
- **Recorded as a gotcha:** a single SSH-transient deploy failure is
  recoverable with `gh -R commonpub/commonpub run rerun <id> --failed`.
  Don't assume a "Load image and restart" failure is a code problem —
  check the log for `ssh: handshake failed` first.
- **Local `pnpm test` sharp-wasm32 ENOENT** remains a local-only
  darwin Nitro flake (Nitro `realpath`s sharp's uninstalled wasm32
  optional-dep dir). Confirmed local-only: layer CI green, both
  Docker/linux deploys built fine. CI is the authoritative gate.

## Post-deploy verification (both sites)

- `/api/health` 200 on commonpub.io + deveco.io
- `/api/features.identity` all false on both
- `resolveContentImages` + `LAZY_SRCSET_ATTRS` present in
  commonpub.io's `/app/.output/server/chunks/nitro/nitro.mjs`
  (import fix is in the running bundle)
- No `auto-admin` / `TypeError` errors in either container's logs
