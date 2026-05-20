# Session 149 — DO Spaces CDN support + scaffolder storage fix

Date: 2026-05-19. Branch: `main`. **SHIPPED + verified live on all
three instances.** The deep certainty audit (three passes; 8
verification agents in total) caught a live P0 mid-process; the fix
was bundled into this release.

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

## Shipped (final)

### Deep certainty audit caught a LIVE P0

The user's "be 10000% certain — audit deeply, continue, audit again"
discipline directly caught a production outage. The empirical
safeFetch check (first call of the deep audit) showed `safeFetch`
threw `fetch failed` against a public URL: undici's custom
`connect.lookup` invokes with `all` semantics and expects
`callback(err, LookupAddress[])` — session-148's pinned dispatcher
returned the classic `(err, address, family)` single form, so undici
read `addresses[0].address` off a string → `ERR_INVALID_IP_ADDRESS:
undefined` → **every safeFetch threw "fetch failed" on commonpub.io,
deveco.io, heatsync since protocol 0.10.0 deployed**. Live-broken
routes: content import (`importFromUrl`), remote-image upload
(`upload-from-url`), image proxy. Session-148 gates missed it
because no test exercised a real fetch through the dispatcher — the
plan had explicitly deferred that integration test. Fixed in
`packages/protocol/src/ssrf.ts` (return the validated array);
network-free contract regression test added.

### Additional audit follow-ups bundled

- Admin backfill column set extended to all 10 local Spaces-target
  columns (users.avatar/banner_url, hubs.icon/banner_url,
  contests.banner_url, contentItems.banner_url, products.image_url,
  plus the original 3). Federation-table remote URLs deliberately
  excluded.
- `isExplainerDocument` hardened to require non-null hero (same
  500-class as the readTime hotfix; explainerDocumentSchema is dead
  code on the content write path).
- `packages/editor` + `packages/test-utils` `@commonpub/schema` pin
  changed `^0.14.3` → `workspace:*` (Drizzle-drift risk for external
  npm installs); both bumped to 0.7.10 / 0.5.6.

### Final 7-package publish chain (dep order, polled between each)

`@commonpub/protocol@0.10.1` → `@commonpub/infra@0.7.1` →
`@commonpub/editor@0.7.10` → `@commonpub/test-utils@0.5.6` →
`@commonpub/explainer@0.7.14` → `@commonpub/server@2.54.1` →
`@commonpub/layer@0.21.10`. All propagated; deveco.io + heatsync
bumped `@commonpub/layer ^0.21.10`. commonpub.io built from source.

### Live verification

**ALL 3 DEPLOYS SUCCESS** — commonpub.io run 26126600151, deveco.io
26127175025, heatsynclabs.io 26127193131. Empirical end-to-end
check on each via image-proxy (which routes through the
pinned-dispatcher `safeFetchBinary` — the previously-broken path):

```
https://commonpub.io      image-proxy → 200 13504B image/png
https://deveco.io         image-proxy → 200 13504B image/png
https://heatsynclabs.io   image-proxy → 200 13504B image/png
/api/health → 200 on all 3
```

The pinned dispatcher works correctly, public fetches succeed
through it, and SSRF (literal/RFC1918/metadata/DNS-rebind) is still
blocked (proven by `ssrf-pinned-lookup.test.ts` + the safeFetch
matrix).

## Local-only follow-up (not yet shipped)

`fix(layer): translate YouTube/Vimeo URLs in generic Embed block; add
video+embed to Project editor` (`083c289`) — user-reported: "video
embeds like YouTube don't work" + projects should support embeds.
Root causes: BlockEmbedView iframed the raw url so YouTube watch
URLs failed under X-Frame-Options; ProjectEditor's blockTypes had
no media blocks. Local commit, awaits a 0.21.11 patch or a bundled
follow-up release.

## Carryover hygiene (non-blocker, queued)

`packages/server`'s `files` glob `"!dist/__tests__/"` doesn't exclude
nested `dist/<sub>/__tests__/` — confirmed 8 such files in the
published tarball. Same pattern for `packages/explainer` shipping
`vue/__tests__/useSectionHistory.test.ts`. Non-security (mock data,
no creds), but bloat. Recommend `"!**/__tests__/"` + `"!**/*.test.*"`
in both `files` globs as a future hygiene patch.

## Bundled patch ship — `0.21.11` (same-session, post-149 rollup)

After session 149 closed, the user requested the local-only YouTube
fix + explainer cover-upload feature + tarball hygiene be bundled
into a single patch release rather than three separate ships.

### Contents

- **`feat(explainer): cover-image upload from Document tab`** (#29) —
  `DocumentPanel.vue` now exposes an Upload / Remove control beside
  the Hero image URL field; same uploader the rest of the editor
  uses (`/api/files/upload`, `credentials: 'same-origin'`). URL
  fallback preserved.
- **`fix(layer): YouTube/Vimeo URL translation in Embed block`**
  (#31, was local commit `083c289`) — `BlockEmbedView.vue` matches
  the same regex set as `BlockVideoView.vue` and rewrites watch
  URLs to `youtube-nocookie.com/embed/<id>`. Project editor
  `blockTypes` gained a Media group (`video`, `embed`).
- **`fix(packaging): exclude nested __tests__ from server + explainer
  tarballs`** — `packages/server` and `packages/explainer` `files`
  globs gained `"!**/__tests__/"` + `"!**/*.test.*"` +
  `"!**/*.spec.*"`. Verified post-publish: `server@2.54.2` and
  `explainer@0.7.15` tarballs each contain **0** nested test files
  (was 8 + 1 respectively).

### 3-package publish chain (dep order)

`@commonpub/server@2.54.2` → `@commonpub/explainer@0.7.15` →
`@commonpub/layer@0.21.11`. All propagated; deveco.io and
heatsynclabs.io bumped `@commonpub/layer ^0.21.10` → `^0.21.11`
(plus matching `@commonpub/server ^2.54.2` direct pin).
commonpub.io built from source.

### Live verification

**ALL 3 DEPLOYS SUCCESS** — commonpub.io run 26129169644,
deveco.io 26129192521, heatsynclabs.io 26129196153.

```
https://commonpub.io      health=200  contentImport=true  image-proxy=200
https://deveco.io         health=200  contentImport=true  image-proxy=200
https://heatsynclabs.io   health=200  contentImport=true  image-proxy=200
```

Tarball hygiene confirmed against the published artifacts.

### Doc landed

`docs/guides/developers.md` thin-app section gained an "Upgrading
a thin-app" subsection that codifies the lockstep-pin pattern: on
a **minor** bump of `@commonpub/config` or `@commonpub/server`,
the thin-app **must** bump its direct pin alongside the
`@commonpub/layer` bump, because `^0.x.y` is same-minor only.
This is the rule that prevented the `contentImport` P1 from
recurring across the 0.21.10 → 0.21.11 patch (both releases
stayed on `config@0.13`/`server@2.54`, so no minor crossing).

## Post-ship audit pass 2 (same-session)

After the bundled 0.21.11 went live, a final ultrathink-audit pass
swept for residual issues. Two minor findings, both fixed in
`706aa79` + `dfa4609` + the CHANGELOG sync.

### Findings + fixes

1. **`apps/shell/package.json` was a divergent subset of the
   scaffolder template** — missing `@commonpub/schema`, `drizzle-orm`,
   `drizzle-kit`, `db:push`/`db:studio` scripts, and
   `drizzle.config.ts`. The developers guide calls `apps/shell/` the
   starter template, so a contributor copying it would get a
   working Nuxt app with no DB path. Synced to scaffolder parity.

2. **Lockstep-pin doc mechanism was imprecise** — the previous text
   said pnpm "hoists 0.12.x". Corrected: the cause is that the
   thin-app's `commonpub.config.ts` imports `defineCommonPubConfig`
   from its **direct** `@commonpub/config` pin, so the zod schema
   bundled with that version parses the config. Zod strips unknown
   fields, so flags added in a later minor never appear in the
   merged config object.

3. **CHANGELOG "at time of writing" line was contradictory** —
   listed `editor 0.7.9, explainer 0.7.13` then `editor 0.7.10,
   explainer 0.7.15` two lines later. Consolidated.

### Verification

- All 13 published @commonpub/* tarballs checked: 0 nested test
  files across the board (no further hygiene bumps needed).
- Workspace typecheck: 26/26 success.
- Live SSRF defense empirically verified on all 3 prod instances:
  public=200, 127.0.0.1=400, metadata-IP=400.
- Live `/api/health`, `/api/features.contentImport=true`,
  `/api/image-proxy=200` on commonpub.io, deveco.io,
  heatsynclabs.io.

### Next session (queued)

**Federation-hardening Stage 3 — Parts 2 & 3:**

- **Item 6** — inbound digest re-serialization break (every signed
  inbound activity with a digest header would 401; fail-closed but a
  complete interop break). Fix: capture raw body once, hash raw
  bytes, parse a copy. Unit-testable via fixture signed requests.

- **Item 7** — signature coverage policy. Require `digest` ∈ signed
  set when body present; require `(request-target)`, `host`, `date`
  ∈ signed set; require Date present + recent + signed. Unit-testable
  matrix.

- **Item 8** — hand-minted Better-Auth session cookies are unsigned /
  wrong-named. Federated/Mastodon SSO produces a non-authenticating
  session after "already-linked → log in". Both flags OFF in prod
  so currently dormant. Fix: mint through `auth.api` or replicate
  `setSignedCookie` with the `__Secure-` prefix.

- **Item 9** — XFF rate-limit key spoofable (needs-confirmation of
  proxy contract before fixing).

Items 6 + 7 are unit-testable; Item 8 needs a real linked-account
exercise. None require a literal second instance to start
implementation — interop testing happens at the END of the session.

## Polish patch 0.21.13 — embed URL parsing

After the audit-pass-2 wrap, a follow-up polish patch addressed two
known limitations of the embed-URL rewrite:

- **YouTube `?t=` start-time was silently dropped** on the watch →
  `youtube-nocookie.com/embed/ID` rewrite. Now extracts the timestamp
  (bare seconds, `s`-suffixed, or `h+m+s` composite) and emits
  `?start=N` integer seconds — the parameter the iframe player
  actually accepts. YouTube's own `?t=` isn't honored by the embed
  iframe; only `?start=N` is.
- **Vimeo private-video hash was dropped**, so `vimeo.com/ID/HASH`
  rewrote to `player.vimeo.com/video/ID` and the iframe 403'd because
  the unlisted-video hash was missing. Now forwards as `?h=HASH`.

Extracted shared `toEmbedUrl()` + `extractStartSeconds()` helpers to
`layers/base/utils/embedUrl.ts` and pointed both `BlockEmbedView` and
`BlockVideoView` at them — was duplicated regex/rewrite logic before.
24 unit tests across YouTube format matrix (watch / shorts / embed /
v / m.* / youtu.be), Vimeo public+private, scheme-safety
(javascript: / data: / file: rejected), and the time-parser.

### Release botch + recovery (publish-tool gotcha)

`pnpm publish` substitutes `workspace:*` → concrete version on
publish; `npm publish` does NOT and leaves the workspace protocol
literally in the published `package.json`. I published 0.21.12 via
`npm publish` from inside `layers/base`, so consumers got
`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND: "@commonpub/auth@workspace:*" is
in the dependencies but no package named "@commonpub/auth" is
present in the workspace` on `pnpm install`.

Recovery (same session):
1. Bumped to 0.21.13 in `layers/base/package.json`.
2. Republished via `pnpm publish --access public --no-git-checks`
   from inside `layers/base`. Verified packed tarball: 0
   `workspace:*` occurrences; all 10 `@commonpub/*` deps resolved
   to concrete versions.
3. `npm deprecate @commonpub/layer@0.21.12 "Broken publish — …"`.
4. Bumped deveco + heatsync `@commonpub/layer ^0.21.13` (with clean
   `pnpm install` to regenerate the lockfile — deveco's first bump
   had a stale lockfile because its install bailed mid-stream on
   the broken 0.21.12).
5. All 3 deploys triggered + monitored.

**Lesson for next release** (the root `publish:all` script in
`package.json` covers `packages/*` but NOT `layers/base`): publish
the layer with `pnpm publish` from inside `layers/base/`, never
`npm publish`. Worth a `publish:layer` script that calls the right
command, or extending `publish:all` filter to include the layer.
