# Session 241 — Kickoff: careful full-codebase review (ultracode)

Paste the block below into a fresh session to start the review. It is self-contained; CLAUDE.md and the
memory index load automatically.

---

```
ultracode — Run a careful, exhaustive review of the ENTIRE CommonPub codebase. This is a REVIEW-and-DOCUMENT
session, not a feature build: your job is to understand every subsystem, find real correctness/security/
architecture/debt issues, and produce a canonical codebase-analysis document — NOT to ship changes.

## Discipline (non-negotiable)
- MAKE NO ASSUMPTIONS. Verify every claim empirically before trusting it: read the actual code, run the tests,
  check flag state with `curl https://<instance>/api/features`, versions with `npm view @commonpub/<pkg> version`.
  Treat CLAUDE.md / STATUS.md / MEMORY.md / session logs as leads to VERIFY, not as truth — they can lag reality.
- Production is LIVE on 3 instances (commonpub.io, deveco.io, heatsynclabs.io). Do NOT roll, publish, deploy,
  push, or mutate production/data. If you find something worth fixing, WRITE IT UP with a proposed fix and its
  risk; only implement + roll if I explicitly approve. Read-only recon by default.
- Adversarially verify findings before recording them: each candidate issue gets an independent skeptic that
  tries to REFUTE it (default = not-a-bug) by reading the real code. Record only what survives, with a concrete
  failure scenario (inputs → wrong result) and honest severity (P0 data-loss/security/crash → P3 minor).

## Verified baseline (2026-07-16, session 240 — re-verify before relying on it)
- npm latest LIVE on all 3: schema 0.59.0 / config 0.33.0 / server 2.113.0 / infra 0.17.0 / ui 0.13.2 /
  editor 0.11.0 / layer 0.106.0 / test-utils 0.5.13 / protocol 0.14.0 / auth 0.10.0. CLI create-commonpub 0.5.29.
- All 3 instances: health ok, 37 feature flags, latest migration 0042. All repos clean + pushed.
- Monorepo: pnpm + Turborepo; packages/* + apps/reference + layers/base (the Nuxt layer) + tools/create-commonpub
  (Rust CLI). Two consumer forks: ../deveco-io, ../heatsynclabs-io.

## Scope — the WHOLE tree, nothing exempt
packages/{schema,protocol,auth,ui,server,docs,editor,explainer,learning,infra,config,theme-studio,test-utils},
apps/reference, layers/base, tools/create-commonpub, and the two forks' overrides. Cover: correctness, security
(esp. the federation/AP untrusted-input boundary + auth + PII/GDPR), data model + migrations, concurrency/
exactly-once, query efficiency at scale, accessibility (WCAG 2.1 AA), test coverage, build-pipeline gaps, dead
code, and doc/reality drift.

## Known priority focus (from the session-240 audit — confirm, don't assume)
1. packages/server/src/federation/inboxHandlers.ts (~1523 lines) — the untrusted AP inbox boundary: signature
   verification, actor resolution, per-activity-type validation. Top security target.
2. packages/server/src/federation/{hubMirroring.ts (~1608), hubFederation.ts} — mirror ingestion, dedup,
   bounded-bulk backfill; known open items: §2a actor-fetch amplification, §2c backfill attribution forgery,
   §2b unbounded mirror-storage, §2e hub public→private orphaning.
3. packages/server/src/content/content.ts (~1433) — core CRUD: visibility gating, keyset-merge invariants
   (local SQL = fed SQL = JS comparator), and the surviving COUNT(*)-per-request on offset/detail paths.
4. layers/base BUILD GAP — it has NO typecheck/lint script (only indirect via apps/reference nuxt typecheck;
   never ESLinted); infra lacks lint. Large untested Vue views (ProjectView 1535, several 1000+ line pages).
5. packages/auth (AP SSO Model B/C), packages/config (the flag gate everything depends on — thin tests),
   and contest/PII/GDPR paths (draft-visibility gates, PII default-off in emails).
NOTE the audit found several old debts already RESOLVED (hooks bus live, transactional counters, reconcile-
counters removed, keyset pagination) — verify these hold and don't re-report them.

## How to work
- Use ultracode workflows: fan out read-only reviewers per subsystem in parallel, adversarially verify each
  finding, synthesize. Scale depth to risk (federation/auth/PII deep; small pure packages light).
- TRACK YOUR WORK: create a task per subsystem (TaskCreate) and update status as you go, so progress survives
  context limits and I can see coverage. Log what you verified vs. what you couldn't reach.
- Run the real gates where cheap: `pnpm build`, `pnpm typecheck`, targeted `vitest` for the modules you review.

## Deliverables (write these to the repo)
1. docs/reference/codebase-analysis.md — the CANONICAL analysis: per-package purpose + shape + health, the
   architecture/data-flow map, test-coverage map, and the build-pipeline state. Keep it factual + current.
2. docs/reviews/full-review-YYYY-MM-DD.md — the findings register: every confirmed finding with file:line,
   failure scenario, severity, and a proposed fix (ranked). Empty sections are fine — say "clean" explicitly.
3. Update STATUS.md / CLAUDE.md ONLY where you verified they are stale (with the corrected value). Don't rewrite
   accurate docs.
4. A short session log docs/sessions/241-*.md: what was reviewed, what's confirmed, what's still unreviewed, next.

## Guardrails
- Follow CLAUDE.md standing rules (schema-first, no feature without a flag, var(--*) only, TDD, no AI git
  attribution, session logging). Respect the roll landmines in docs/sessions/240-handoff.md if I later ask you to
  fix + ship anything (0.x caret pins don't cross minors; git push runs a slow pre-push typecheck hook — use
  --no-verify after validating; nuxt dev networkidle never settles — Playwright uses domcontentloaded).
- End when the tree is covered and the three docs are written. Surface the top confirmed issues + a recommended
  fix order; wait for my go before implementing anything.
```

---

## Why these choices
- **No-assumptions + read-only-by-default** because the target is live on 3 instances and the point is an honest
  map, not more shipping this turn.
- **Adversarial verify** mirrors the 239/240 audits that caught real bugs the finder-only pass would have over-
  reported.
- **Tracked tasks + a canonical `codebase-analysis.md`** so the review's value persists and survives context limits.
- **The priority focus list** is seeded from the session-240 state audit so the review starts on the highest-risk,
  highest-blast-radius surfaces (federation inbox/mirroring, content core, the layers/base build gap) instead of
  spreading evenly.
