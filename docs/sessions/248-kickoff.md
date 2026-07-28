# Session 248 — kickoff (handoff after session 247)

Read this first. **Standing rules:** utmost care; adversarially verify; **NEVER add AI attribution to any
commit/PR** (CLAUDE.md #15); **verify state empirically** (`npm view`, `curl /api/features`, read the code —
don't trust docs/memory); **local browser acceptance before deploy** (run the app on a **trusted port 3001**,
drive the real flow, screenshot desktop + 390px). macOS has no `timeout` binary.

## Where things stand (verify before trusting)

- **LIVE on all 3** (commonpub.io + deveco + heatsync), verified 2026-07-25:
  schema **0.63** / config **0.35** / infra **0.19** / server **2.122** / layer **0.116**, migration **0045**,
  38 flags. `git` clean on `main`.
- Session 247 shipped in **three passes** (all rolled): (1) contest markdown-import + rich register UX +
  consent surfacing + 4 P1 security blockers; (2) a deep-audit hardening pass; (3) an `ultracode` adversarial
  audit that caught same-class XSS sinks the hardening missed AND regressions the hardening introduced. Detail:
  `docs/sessions/247-{roll,audit-hardening,adversarial-audit-fixes}.md`. All test gates green; contest system
  verified E2E; XSS `javascript:`/`data:` rejection + ban/consent behavior browser-verified.

## Priority work (open)

### P1 — the pre-existing red CI (`e2e` job)
GitHub Actions **CI has been red on every commit since ≥2026-07-17** (before session 247) — the `e2e`
(Playwright) job, NOT the gating `check` job (typecheck/lint/unit — that's green). The failing test is
`apps/reference/e2e/auth.spec.ts:101 › Register form › form fields accept input`: it asserts the `/auth/register`
submit button `toBeEnabled()` immediately on load (line 109), but the button is `disabled` (the register form
almost certainly disables submit until required fields are valid — a reasonable UX the test predates). This is
**not** a product bug and not from recent work. **Do:** confirm the register page's submit-enable logic, then
either fix the stale assertion (fill fields first, then assert enabled) or the page — and get CI fully green so
it stops masking real e2e regressions. Deploy Production is unaffected (separate job, succeeds).

### P1 — deferred security follow-ups (from the 247 adversarial audit)
These were consciously deferred as larger than the hotfix rolls (see `247-adversarial-audit-fixes.md` "Deferred"):
1. **CSP hardening** — `packages/infra/.../security.ts:92` sets `script-src 'self' 'unsafe-inline'`, which is the
   root enabler that makes any `javascript:` href executable at all. A nonce-based CSP (drop `'unsafe-inline'`)
   would blunt the entire stored-XSS class the audit chased sink-by-sink. Biggest single security win; needs
   care (inline scripts/styles must move to nonces) + full browser regression.
2. **Legacy-row URL scrub migration** — writes + renders are now guarded, but rows stored before the guards
   could still hold `javascript:`/`data:` in profile website/socialLinks, hub/product/video/event URLs. A one-off
   migration nulling stored URLs not matching `^https?://` closes it. Low urgency (render `safeHref` already
   neutralizes them; no known bad rows on these instances) — but the clean fix. This would be **migration 0046**.
3. **Block-content `url` server validation** — block content persists via `content: z.unknown()`
   (`schema/validators/content.ts`); `sanitizeBlockContent` only touches html/explainer fields, not block
   `url`. The parts/tool/downloads views are now render-guarded (`safeHref`), but validating those URLs with
   `httpUrl` on write is the belt to the render suspenders.

### P2 — the planned contest unification (plans written, build the confirmed slices)
- `docs/plans/unify-registration-and-entry-forms.md` — combined mode routes registration through the proposal
  path, **entry as source of truth**, with a `submissionSource: 'own' | 'registration'` stage link. P1 (consent
  surfacing) shipped; P2 (the flow rework: schema + server + UI) is the next build. **This was explicitly
  deferred in 247 — it's the main remaining feature work.**
- `docs/plans/team-registration-and-collaborative-content.md` — the repeatable `group` field + real
  multi-person content ownership (`content_collaborators`). Keystone Phase B (co-ownership authz) is
  security-sensitive; held for review.
- `docs/plans/registration-data-surfacing.md` — address-as-columns, file/signature download links, a
  shipping-only export. P1 (consent) shipped; A/B (address columns + downloads) are next.

### P3 — audit backlog (batch-2 P2s + 246 monolith/DRY)
From `docs/reviews/production-readiness-audit-2026-07-23.md`: non-atomic multi-writes, counter mis-targets,
ingestion caps; plus the 246 monolith-split / DRY / cruft backlog. Fast-follow, not gating.

## Roll mechanics (worked cleanly 3× this session)
Build+publish `@commonpub/schema` → `@commonpub/server` → `@commonpub/layer` (via `pnpm publish:layer`, which
rewrites `workspace:*`); poll `npm view` for propagation before bumping consumers (layer prop lag ~100s). Then
ff-merge `main` (commonpub.io deploys from it) and hand-edit deveco + heatsync pins (`^0.x` **won't** cross a
minor — edit by hand) + regen **both** lockfiles (`npm install --package-lock-only` + `pnpm install
--lockfile-only`) in each; push with `git push --no-verify` (the pre-push typecheck hook times out Bash).

## Landmines (verified this session)
- **Dev server runs `@commonpub/{schema,server}` from `dist/`** — a package **src** change needs a dist
  rebuild + dev-server **restart** to appear in the browser (layer files HMR live). Green unit tests alone don't
  prove the running app serves a package change.
- **Docker Desktop can stop mid-session** → the dev Postgres vanishes and every query 500s (looks like a code
  bug — it isn't). `open -a Docker`, `docker compose up -d`, wait for `pg_isready`, restart the dev server.
- **Trusted port:** run dev on **3001** (not 3100 / not 127.0.0.1) or login CSRF-403s.
- **vue-tsc strict vs vitest:** always run `apps/reference` `nuxi typecheck` — vitest (esbuild) misses type
  errors the CI `check` gate catches.
- **Lesson from 247:** each fix-roll risked introducing a small regression that the *next* audit caught.
  Adversarially audit after **each** hardening roll, and prefer a shared helper (e.g. `utils/safeUrl.ts#safeHref`)
  over patching sinks one at a time.
