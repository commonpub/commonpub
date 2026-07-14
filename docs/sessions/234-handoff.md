# Session 234 Handoff — where things stand + what's next

Date: 2026-07-13. Canonical current-state doc (companion to `docs/STATUS.md`). Verify any version/flag
claim before trusting it: `npm view @commonpub/<pkg> version`, `curl https://<instance>/api/features`.

## LIVE in production (rolled sessions 231/232/233, verified 2026-07-13)

All 3 instances — **commonpub.io, deveco.io, heatsynclabs.io** — run the rolled stack:
`schema 0.57.0 / config 0.31.0 / test-utils 0.5.11 / infra 0.14.0 / editor 0.10.0 / auth 0.10.0 /
server 2.106.0 / layer 0.98.0`, migrations **0040 + 0041** applied. Shipped: the P1 content/hub privacy
batch (incl. `hub-post-ap` middleware + `public/v1/hubs` gates), GDPR export completeness, RBAC ceiling,
contest registration + deadline reminders, per-contest email editor, auto-register-on-entry, Callout/Quote
fix, and the reminder-milestone/ICU-deadline fixes. New flags `contestReminders` + `contestEmailEditor`
verified **OFF** on all 3 (operator hasn't flipped them). `emailNotifications`: deveco ON (console sink,
no transport), commonpub/heatsync OFF. `federateHubs` ON commonpub+deveco; `publicApi` ON deveco.

### Operator remainders from the 233 roll (still open — need live creds)
- **Meili reindex** `POST /api/admin/search/reindex` per instance — quality, NOT an outage (search falls
  back to Postgres FTS, verified `/api/search` → 200 on all 3). Do when convenient.
- **CLI crates.io tag** — the re-pin is DONE in code (session 234, create-commonpub 0.5.22); push tag
  `create-commonpub-v0.5.22` to fire `cli-release.yml`.
- **Full unauth curl checklist** on live (needs a known private-hub slug): private-hub AP post → 404;
  `/api/public/v1/hubs/<private>` → 404 on deveco. Code verified identical to the behaviorally-tested fix.
- **Flip `contestReminders`/`contestEmailEditor` ON** per instance via `/admin/features` when wanted
  (DB override, no redeploy), and wire a real email transport (`NUXT_RESEND_*`) for reminders to actually
  send.

## READY TO ROLL — branch `session-234-remediation` (NOT merged/pushed)

8 commits over `main`, **clean fast-forward, NO migration**, full `pnpm test` 33/33 + `pnpm typecheck`
28/28 green (isolated). Built via ultracode design→adversarial-verify→TDD. See
`docs/sessions/234-backlog-remediation.md`. Contents:
1. **fix(security) HIGH** — comment-write access gate (`createComment` had no read check → private-hub /
   members-content comment+notification injection; the write-side counterpart to the 233 read leaks).
2. **fix(federation)** — outbox negative-`?page=` → unauth-500 clamp.
3. **fix(federation)** — id-less inbound-reply dedup (stops unbounded comment-count inflation; no migration,
   reuses the `processed_activities` ledger).
4. **chore(cli)** — re-pin create-commonpub 0.5.22.
5. **fix(config)** — ENV_FLAG_MAP completeness (25→33 flags) + parity guard test.
6. **fix(a11y)** — StatBar label + kbd keycap WCAG AA; source-reading contrast guard.
7. **test(layer)** — P-3 CI tripwire banning un-audited raw `from(contentItems)` reads.

**Roll shape (pre-roll audit should confirm the exact publish set):** package-level changes are in
`@commonpub/server` (2.106→2.107), `@commonpub/ui` theme (0.13.1→0.13.2, reaches instances via the layer's
theme rebundle), `@commonpub/layer` (0.98→0.99). `apps/reference` (envFlagMap) deploys with commonpub.io,
doesn't publish. NO migration. NO new flag. Deploy = merge → `main` (fires commonpub.io deploy.yml) + fork
pin bumps + push ([[feedback_consumer_dual_lockfile_frozen_install]]). Live-verify the comment gate + a11y.

## REMAINING BACKLOG (verified against code, session-234 "what remains" survey)

**Security/correctness (build-ready, no decision needed):**
- Federation §1c — contest lifecycle notification dedup collision (status notifs overwrite each other; also
  a prerequisite for contest-comms Phase 1). P2.
- Federation §2a — inbox amplification via uncached 30s actor fetch (needs negative cache + key-rotation
  refetch; new `actor_resolution_failures` table = migration). P2.
- Federation §2c — backfill trusts outbox `actor` without host binding (attribution forgery). P2.
- Email P3 — send-time unsubscribe recheck; broadcast drain-gate + idempotency. P2 (contest-mail deps).
- monolith-4b — extract `inboxHandlers.onCreate` (~1500 lines) behind new inbound-Create tests. P2.

**Needs a PRODUCT/DESIGN decision before building (do NOT build blind):**
- **Federation mirror-storage gate (§2b, P1)** — `onCreate` stores content for any signed peer with no
  matching-mirror gate (unbounded growth). The naive mirror-only gate OVER-BLOCKS (a local follow of a
  remote actor with zero pull-mirrors loses that content). Needs a decision on "wanted content" semantics
  (follow-status + mirror + size/rate policy). DEFERRED by both design + adversarial verify in session 234.
- **profileVisibility enforcement** — field is currently non-writable (inert); a correct fix is a dedicated
  feature (add the writer + enforce across all 6 profile-read paths via a shared helper), not a partial
  gate. DEFERRED in session 234.
- Federation §2e R9/R10 hub-fed lifecycle (public→private orphans remote followers; needs `federateHubDelete`
  + `pending_deletion` state).
- **Contest communications Phases 1/2/4** — preference center + notification→email bridge (Phase 1);
  judge/stage/winner transactional emails (Phase 2); winner announcement + "message entrants" broadcast
  (Phase 4). Reminders shipped Phase 3 only.
- **Layout engine** Phases 4-10 — the largest dormant feature (commonpub.io-only canary). Strategic go/no-go.
- **instance-self-update** — plan "awaiting maintainer approval".

**Tech-debt / hygiene (small):**
- Prune merged branches `contest-registration-reminders` + `session-231-content-privacy` (local + remote).
- Fork ENV_FLAG_MAP drift (deveco/heatsync + apps/shell maps still partial — the reference guard doesn't
  cover them; a follow-up parity test per repo).
- a11y: `--accent`-as-link/nav-text (2.67:1) — a design decision, deferred with session 224.
- Rotate the DO Spaces secret (shared plaintext since session 200).

## Landmines / disciplines (carry forward)
- `curl /api/features` before ANY flag/state claim — memory goes stale. Deploy health is **warn-only**;
  curl-verify beyond the smoke.
- Run `pnpm test` with **NO dev server running + no dev-DB mutation** — concurrent runs flake integration
  tests (bit me in 233; both suites are green in isolation).
- Push-to-`main` auto-deploys commonpub.io + auto-migrates; work on a branch until ready.
- Forks: bump the 4 caret pins + BOTH lockfiles (heatsync tracks both; deveco's package-lock is gitignored
  but its ci.yml has the frozen-pnpm gate). 0.x carets don't cross minors — hand-edit.
- TDD (tests first), no new feature without a flag, `var(--*)` only, explicit return types, no `any`, no AI
  attribution in commits, no em dashes in user-facing copy.
