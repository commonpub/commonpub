# Session 240 — Handoff (state, backlog, next)

Written 2026-07-16 after a state-and-consistency audit. Every version/flag/state claim below was
verified empirically (npm, `/api/features`, git), not from memory.

## Where things stand (verified)

**Live on all 3 instances** (commonpub.io, deveco.io, heatsynclabs.io) — health ok, **37 feature flags**,
latest migration **0042**:

| schema | config | server | infra | ui | editor | layer | test-utils | protocol | auth | CLI |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.59.0 | 0.33.0 | 2.113.0 | 0.17.0 | 0.13.2 | 0.11.0 | 0.106.0 | 0.5.13 | 0.14.0 | 0.10.0 | 0.5.29 |

All 3 repos (commonpub, deveco-io, heatsynclabs-io) **clean + pushed**; fork pins == npm latest.

**Recent arc (all LIVE):** 237-238 email block-editor bodies + M3 block-editor UI + `emailUnverified`;
239 two-tier contest signup card (register + reminders-only tiers, optional info, status-aware onboarding)
+ `registrationLink` in contest body editors; 240 stage-aware contest deadlines (emails + reminders key off
the next stage deadline, per-stage reminder ledger, editable deadline paragraph) + a "US entity attestation"
submission-form preset. Both 239 and 240 were adversarially audited and their confirmed findings fixed +
re-rolled. Detail: `docs/sessions/237–240-*.md`.

## Codebase health (recon, not a defect hunt)

Structurally healthy and **better than older logs imply** — several long-standing debts are RESOLVED in code:
the hooks bus is live (emitHook wired ~15 sites), like/comment counter writes are transactional,
the reconcile-counters corruption routine is gone, and feed pagination uses keyset cursors + composite indexes.

Standing concerns worth a careful review (see the kickoff prompt):
- **Monoliths:** `federation/hubMirroring.ts` (1608), `federation/inboxHandlers.ts` (1523, security-critical
  untrusted-input boundary), `content/content.ts` (1433); `views/ProjectView.vue` (1535) + several 1000+ line pages.
- **Build-pipeline gap:** `layers/base` — the largest UI surface — has NO `typecheck`/`lint` script; it's
  typechecked only indirectly via `apps/reference` `nuxt typecheck` and is never directly ESLinted. `infra` also
  lacks a `lint` script. Worth closing.
- **Surviving efficiency debt:** `COUNT(*)`-per-request on the offset/detail content paths (the keyset path is optimized).
- **Thin tests:** `config` (1 test — the flag gate everything depends on), `test-utils` (1), large layer `.vue` views (0 component tests).
- **Flag-count note:** config schema defines 36 boolean flags but `/api/features` reports 37 — docs agree with
  the live count, so the 37th is sourced outside `packages/config/src/schema.ts`; worth confirming in the review.

## Backlog (prioritized, deduped) — no open P0s, no active P1 regressions

**P1 (decision- or prerequisite-blocked, not build-ready):**
- **Federation mirror-storage gate (§2b)** — `inboxHandlers.onCreate` stores content for any signed peer with no
  matching-mirror gate → unbounded DB growth. Deferred twice pending a "wanted content" policy decision.
- **profileVisibility enforcement** — the field is inert (non-writable, unenforced across the 6 profile-read paths);
  needs a dedicated writer + shared enforcement helper.
- **Resend-verification + verify-reminder UX** — the standing blocker on `auth.requireEmailVerification` (OFF
  everywhere; enabling it locks out existing unverified users). Cited across sessions 237-240.

**P2 (build-ready):**
- Federation hardening: §1c contest-notif dedup collision (also unblocks contest-comms P1), §2a actor-fetch
  amplification (needs a negative cache + `actor_resolution_failures` table), §2c backfill attribution forgery,
  §2e hub-fed public→private orphaning; Email-P3 send-time unsubscribe recheck + outbox idempotency;
  monolith-4b (extract `onCreate` behind new inbound-Create tests).
- Contest Communications Phases 1/2/4 (preference center + notification→email bridge; transactional lifecycle
  emails; winner announcement + message-entrants) — Phase 3 (reminders) already shipped.
- Hero countdown stage-alignment (`ContestHero.vue` still shows the final date, not the stage `endsAt` — use the
  session-240 `nextContestDeadline` helper); Contest Signup as a droppable block.
- Dormant flag-gated features (each needs real build to activate): layoutEngine Phases 4-10 (biggest single item),
  RBAC activation Phases 2/3, cross-instance identity Phases 1-4b, `events`.

**P3 / operator remainders:**
- instance-self-update (design, awaiting maintainer approval).
- Meili reindex per instance (`POST /api/admin/search/reindex`; FTS fallback works, quality-only).
- Owed live behavioral tests: comment-write gate (authenticated non-member → 404), id-less reply dedup replay,
  StatBar a11y render ≥AA in both themes.
- `noreply@deveco.io` must be a verified Resend sending domain (or deveco mail fails gracefully).

## Roll landmines (reconfirmed this arc)
- 0.x caret pins do NOT cross a minor — CLI (`template.rs`+`cli.rs`) + BOTH forks hand-edited + lockfiles
  regenerated (deveco pnpm-lock; heatsync BOTH) on every publish that crosses a 0.x minor.
- `git push` runs a pre-push `pnpm typecheck` hook (~2 min) that times out the Bash tool — push with
  `--no-verify` after validating typecheck separately.
- Local `nuxt dev`: `networkidle` never settles (SSE/federation workers) → Playwright must use `domcontentloaded`;
  kill stale servers by port + `nuxt.mjs dev`/`cli/dist/dev` patterns, not just `pkill -f 'nuxt dev'`.
- Migrations reach prod via the schema npm package's shipped `migrations/` + `scripts/db-migrate.mjs` (every
  deploy runs it, `|| exit 1` gated).

## Next
Kickoff prompt for a careful full-codebase review is at the end of the session-240 chat / paste-ready below the
handoff. It prioritizes: federation inbox/mirroring (security), content core, the layers/base build gap, large
untested views, auth, and contest/PII/GDPR paths — and produces a canonical `docs/reference/codebase-analysis.md`.
