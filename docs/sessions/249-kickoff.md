# Session 249 — kickoff: PRODUCTION-READINESS SWEEP (contest goes live 2026-08-03, real traffic)

Read this first. **Standing rules:** utmost care; adversarially verify; **NEVER add AI attribution to any
commit/PR** (CLAUDE.md #15); **verify state empirically** (`npm view`, `curl /api/features`, read the code);
**local browser acceptance before deploy** (trusted port **3001**, drive the real flow, screenshot desktop +
true 390px via Playwright). macOS has no `timeout`.

## The situation

**A real contest goes LIVE on `deveco.io` tomorrow (2026-08-03) and will get real traffic** (public
registration, entry submission, a rich 41-field registration form with file upload + signature + 7
agreements). This session is a **production-readiness sweep**: find and fix what breaks under (a) real
concurrent traffic, (b) hostile/malformed input, and (c) the actual contest lifecycle — BEFORE it's live.
Prioritize things that cause **data loss, downtime, security exposure, or a broken entrant flow**. Don't
gold-plate; don't start the P2 unification. This is a hardening + verify pass.

## Baseline (verify before trusting)

- LIVE all 3: schema **0.63** / config **0.35** / infra **0.19** / server **2.122** / layer **0.117**,
  migration **0045**, 38 flags. `git` clean on `main`.
- **deveco.io** (the live instance) has ALL contest flags + `emailNotifications` + `emailUnverified` +
  `contestReminders` + `contestEmailEditor` **ON**. (commonpub.io has reminders/emailEditor OFF — so verify
  behavior on a config that matches deveco, and `curl https://deveco.io/api/features` to confirm.)
- Infra: Postgres 16, Redis/Valkey (queue — powers email/reminders), Meilisearch, S3/DO Spaces (uploads).
- Session 247 shipped the contest system + 3 security-hardening passes; session 248 shipped the sidebar
  schedule fix. The adversarial audits are done — this sweep is about **scale + operations + the live flow**,
  not re-auditing the same code.

## Suggested approach (ultracode — this is a fan-out sweep)

Run a Workflow: parallel finders across the dimensions below, adversarially verify each finding (refute by
default), synthesize confirmed blockers ranked by "what takes the contest down." Then fix the confirmed
blockers, re-verify E2E in a browser at true 390px, and roll. Keep the operator in the loop between phases.

## Sweep dimensions (ranked by launch-day risk)

### 1. SCALE / LOAD (highest — "we will be getting traffic")
- **Pagination + COUNT-every-request**: `project_pagination_scalability` memory — feeds/lists run a `COUNT(*)`
  on every request and lack composite indexes. Audit the HOT contest paths: contest list, **entries list**,
  **registrants list + export**, the public feed, judging queue. Add composite indexes / drop needless COUNTs
  / cursor-paginate where a full scan is on the request path.
- **N+1 queries** on entries/registrants/judging under load (per-row lookups in a map). Batch them.
- **Rate limiting coverage**: `packages/server/src/security.ts` + `index.ts` have limiters — VERIFY they
  actually cover the abusable public endpoints: `POST /contests/:slug/register`, entry submission, the PII
  **export** (`registrants-export` — a scraper could harvest), file upload, and auth. A spam script must not
  be able to flood registrations or exfiltrate PII.
- **DB connection pool** sizing + **Redis** health (reminders/email workers) under concurrency; the
  scheduled-publishing + contest-reminders workers (seen in dev logs) shouldn't thrash.
- **File upload**: size/type caps enforced server-side (not just client), storage quota, and the private-file
  serving path (`files/:id/raw`) performance + auth under load.

### 2. CORRECTNESS UNDER CONCURRENCY
- **Atomicity**: registration write + agreement-acceptance write + counters — are they in one transaction?
  (Batch-2 P2s from `docs/reviews/production-readiness-audit-2026-07-23.md`: non-atomic multi-writes, counter
  mis-targets.) A partial failure mid-registration must not orphan rows or mis-count.
- **Entry-count / registrant-count accuracy** under concurrent submits (double-submit, race on the counter).
- **Double-submit / idempotency** on register + entry submit (a user double-clicking, or a retry).
- **Ingestion caps** (batch-2 P2) if any federated ingestion runs on the live instance.

### 3. SECURITY (open items from the 247 audits — now they face real traffic)
- **CSP** (`packages/infra/.../security.ts`): `script-src 'unsafe-inline'` is the root enabler for the whole
  stored-XSS class the audits chased sink-by-sink. A nonce-based CSP is the biggest single hardening. Assess
  feasibility for launch (may be too invasive for tomorrow — decide + document).
- **Legacy-row URL scrub**: writes + renders are guarded, but no migration nulled pre-guard `javascript:`/
  `data:` rows. If deveco has any user-authored profile/hub/product/video/event URLs, a scrub migration (0046)
  is the belt. Check whether any bad rows exist on deveco first (`select ... where url !~ '^https?://'`).
- **Block-content `url`** is `z.unknown()` server-side (render-guarded only) — add `httpUrl` on write.
- **PII exposure**: re-confirm entrant-PII per-contest scoping + the export/registrants routes are
  organizer-only + `no-store`, and that the rich form's file/signature (private storage) never leak.
- **Abuse**: registration spam, export scraping, file-upload abuse, unverified-email registration (deveco has
  `emailUnverified` ON — confirm that's intended for launch).

### 4. THE LIVE CONTEST FLOW (drive it end-to-end on a deveco-matching config)
Register (rich 41-field form: file upload + signature + address + 7 agreements) → confirmation email →
reminders → entry submission (attach + proposal) → judging → results → surfacing (registrants panel + CSV
export + consent). **Email + reminder delivery actually works on deveco** (flags ON) — verify the outbox/queue
sends, links resolve, and unverified users get the right path. Screenshot desktop + true 390px.

### 5. OPERATIONS
- **Health/monitoring**: `/api/health` covers DB+Redis+storage? Any alerting? What's the on-call signal if the
  queue backs up or the DB pool exhausts?
- **Error handling**: hostile/malformed input on public endpoints returns a clean 4xx, never a 500 with a
  stack trace or a leaked query.
- **The red `e2e` CI**: still red (stale `/auth/register` submit-enabled assertion). Fix it so it stops
  masking a real launch-day regression.
- **Rollback + backups**: is there a DB backup + a quick rollback (revert layer pin / redeploy prior image)
  if launch goes wrong? Document the runbook.

## Roll mechanics (worked cleanly all session)
Build+publish `@commonpub/schema` → `server` → `layer` (`pnpm publish:layer`); poll `npm view` for
propagation (~100s layer lag) before bumping consumers; ff-merge `main` (commonpub.io deploys from it);
hand-edit deveco + heatsync pins (`^0.x` won't cross a minor) + regen BOTH lockfiles (`npm install
--package-lock-only` + `pnpm install --lockfile-only`); `git push --no-verify`. A migration this time (if the
scrub or an index needs one) = **0046** — apply via `db-migrate.mjs`/`db:push`, never hand-edit the DB.

## Landmines (verified this session)
- Dev server runs `@commonpub/{schema,server}` from `dist/` — a package **src** change needs a dist rebuild +
  dev-server **restart** to appear in the browser (layer files HMR live; a NEW auto-imported export in a util
  ALSO needs a restart — the auto-import scanner is stale otherwise).
- Docker Desktop can stop mid-session → dev Postgres vanishes, every query 500s (not a code bug). `open -a
  Docker` → `docker compose up -d` → wait `pg_isready` → restart dev server.
- Trusted port **3001** (not 3100 / not 127.0.0.1) or login CSRF-403s.
- The chrome extension can't force a true 390px CSS viewport — use **Playwright** (`viewport:{width:390}`) for
  real mobile screenshots (recipe pattern used in session 248).
- Always run `apps/reference` `nuxi typecheck` (vue-tsc strict) — vitest/esbuild misses type errors CI catches.
- Adversarially audit after EACH hardening roll — this session, every fix-roll introduced a small regression
  the next audit caught.
