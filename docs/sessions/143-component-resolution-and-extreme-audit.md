# Session 143 — Mobile-nav bug class, extreme repo audit, SSRF hardening

Date: 2026-05-16. Branch: `main` (uncommitted at time of writing).

## 1. Reported bug → root cause → fix (Nuxt pathPrefix component resolution)

User report: "on existing instances on mobile the hamburger just shows
search." Root cause: Nuxt `pathPrefix` auto-import names a component by
`PascalCase(dir)+File`, de-duplicating only when the filename already
starts with the dir prefix.

- `nav/NavRenderer.vue` → `<NavRenderer>` (de-dups) → desktop nav worked.
- `nav/MobileNavRenderer.vue` → `<NavMobileNavRenderer>` (no de-dup); the
  layout referenced `<MobileNavRenderer>` → **never resolved** → mobile
  menu rendered only the inline Search/auth extras. Broken since
  `d59ec27` (Phase 3 nav, 2026-04-15) on **every** instance.

Proven via Nuxt's generated `components.d.ts` (no `MobileNavRenderer`
global) and SFC-compiler diff (`_resolveComponent("MobileNavRenderer")`
→ nothing vs `$setup["MobileNavRenderer"]` after fix).

Fixes:
- `layouts/default.vue` — explicit `import MobileNavRenderer from
  '../components/nav/MobileNavRenderer.vue'`.
- Same-class second bug found by an exhaustive sweep:
  `<BlockContentRenderer>` used bare (no import) in
  `components/blocks/BlockBuildStepView.vue` and
  `components/views/ProjectView.vue:512` (registered only as
  `BlocksBlockContentRenderer`) → **nested build-step content/images
  blanked** (impacts imported Hackster build steps). Fixed to the
  working auto-import name `<BlocksBlockContentRenderer>` (a static
  import is impossible — BlockContentRenderer ⇄ BlockBuildStepView are
  mutually recursive).
- `apps/reference/e2e/responsive.spec.ts` — regression e2e: opens the
  mobile hamburger, asserts a real nav link renders.
- Exhaustive deterministic sweep of every `.vue` in `layers/base` +
  `apps/reference` against the component manifest: now **CLEAN** (zero
  unresolved tags).

## 2. Extreme audit (3 parallel agents + gates)

Gates: typecheck 26/26, lint 0 errors (pre-existing unused-var warnings
only), unit tests all green (server 964, protocol 375, editor 230, ui
217, docs 131, explainer 191, learning 101). Only failure is the known
darwin-only `@img/sharp-wasm32` Nitro realpath flake (now surfaces on
`shell:build` via turbo cache rotation; CI/linux authoritative).

Verified NOT bugs (audit false positives, confirmed by reading code):
- Identity Phase 2a/2b flag gating is **correct** (routes 404 first
  statement when `signInWithRemote` off; startup plugin side-effect-free).
- `docs` `sanitizeSchema` allowing `style` — REQUIRED (shiki single-theme
  emits inline token-color styles) and safe (`allowDangerousHtml:false`
  in remark-rehype + rehype-stringify means no user raw HTML reaches the
  sanitizer). Added an explanatory comment so it isn't "fixed" again.
- `learning/quiz.ts` rounded pass-comparison — **intended, tested**
  behavior (quiz.test.ts:72-74 asserts 2/3→67 passes a 67 gate).
- `infra/structuredLogger.ts` circular-JSON — documented, tested fallback.
- `federation.ts:162` `resolveActor(uri, fetch)` — `resolveActor`
  self-guards (re-checks isPrivateUrl per hop), so not the vuln; the real
  gap was the sibling unguarded `fetch(actor.followers)`.

## 3. Real bugs fixed

| Sev | File | Fix |
|---|---|---|
| HIGH | `layers/base/server/api/files/upload-from-url.post.ts` | Replaced hand-rolled SSRF denylist + raw `fetch` with `safeFetchBinary` (redirect re-validation, streaming cap, hardened host check). |
| MED | `packages/server/src/import/ssrf.ts` | Timeout now spans body read (slow-trickle DoS); `isPrivateUrl` hardened: numeric-host encodings (dotless decimal/hex, octal), IPv4-mapped IPv6, multicast/reserved; new `isPrivateIp` export. Kept string-prefix check as a strict superset (no regression vs `127.0.0.1.evil.com`). DNS-rebinding left as a documented follow-up (needs undici dispatcher; live image-proxy + deterministic tests made in-helper DNS too risky this pass). |
| MED | `packages/server/src/federation/federation.ts:173` | Guard `fetch(actor.followers)` with `isPrivateUrl` + `redirect:'manual'`. |
| MED | `packages/protocol/src/actorResolver.ts` | `resolveActorViaWebFinger` timeout now spans the JSON body read (was cleared before `.json()`); `isPrivateUrl` hardened (numeric/mapped/multicast) as a superset. |
| LOW | `packages/docs/src/render/headings.ts` | Per-call regex (was module-level `/g`, `lastIndex` corruption risk). |
| LOW | `layers/base/server/middleware/auth.ts` | Add `/api/auth/mastodon/` to `isCustomAuthRoute` (explicit; stops fragile Better-Auth shadowing of the identity routes). |
| LOW | `tools/create-commonpub/src/template.rs` + `tests/cli.rs` | Stale pins → layer ^0.21.3 / server ^2.53.0; "Last synced" comment; test now asserts EXACT pins (forcing function for the RELEASE CHECKLIST). Repo-only, not npm. |
| LOW | `apps/shell/README.md` | Rewrote misleading docs (claimed npm-layer thin-app starter; actually a monorepo-local layer harness). Points users at `create-commonpub`. Disposition (delete vs realign to thin-app) flagged for product decision — NOT done unilaterally. |

All affected suites re-run green after fixes (protocol 375, server 964
incl. import-ssrf 26, docs 131; cargo 26 incl. tightened pin test;
typecheck 26/26; auto-import sweep CLEAN).

## 4. Republish set

`workspace:*` internal deps → pnpm resolves to concrete versions at
publish; no manual cross-pin edits. Version fields bumped:

| Package | From → To | Why |
|---|---|---|
| `@commonpub/protocol` | 0.9.9 → **0.9.10** | webfinger timeout-scope + SSRF host hardening |
| `@commonpub/server` | 2.52.0 → **2.53.0** | SSRF helper hardening + timeout-scope + `isPrivateIp` export + federation followers guard |
| `@commonpub/docs` | 0.6.2 → **0.6.3** | headings regex correctness |
| `@commonpub/layer` | 0.21.2 → **0.21.3** | mobile-nav + nested-block fixes + mastodon auth-route allowlist |

NO change → NOT republished: schema 0.16.0, auth 0.6.0, config 0.12.0,
infra 0.7.0, ui 0.8.5, editor 0.7.9, explainer 0.7.12, learning 0.5.2,
test-utils 0.5.4. `create-commonpub` = repo-only rebuild.

Publish order (npm availability): **protocol → docs → server → layer**
(docs ∥ protocol; server after protocol; layer last). Then deveco.io
pins: `@commonpub/layer ^0.21.3`, `@commonpub/server ^2.53.0` (config /
schema unchanged); deploy both sites (commonpub.io builds from source).

## 5. Open / deferred

- DNS-rebinding SSRF: implement connection-pinned resolution (undici
  dispatcher with fixed lookup) shared by import/image-proxy/federation.
- Broader federation SSRF: `hubMirroring`/`backfill`/`timeline`/
  `delivery` follow remote-supplied collection/next URIs with raw
  `fetch` — centralize an SSRF-safe AP fetch wrapper (MED, not done).
- `apps/shell`: decide delete vs realign to the published-layer thin-app
  pattern.
- `auto-admin.ts` `ADMIN_BOOTSTRAP_FIRST_USER`: documented first-mover
  race on a public URL — consider a boot-window bound (no code change
  this session; semantics are an intentional opt-in).
