# Session 235 Kickoff

## Paste this into a fresh session

> Read `CLAUDE.md`, `docs/sessions/234-handoff.md` (canonical current state), and `docs/STATUS.md`. Then
> `curl https://commonpub.io/api/features` + deveco.io + heatsynclabs.io BEFORE any flag/state claim
> (memory goes stale). Current state: sessions 231/232/233 are LIVE on all 3 instances (schema 0.57 /
> config 0.31 / infra 0.14 / auth 0.10 / server 2.106 / layer 0.98, migrations 0040+0041, new contest
> flags OFF). Branch **`session-234-remediation`** is built + green (pnpm test 33/33, typecheck 28/28) but
> NOT merged/rolled: 7 fixes (comment-write access gate [HIGH security], outbox negative-page 500 clamp,
> id-less reply dedup, CLI 0.5.22 re-pin, ENV_FLAG_MAP parity, WCAG-AA contrast, P-3 CI tripwire), clean
> fast-forward, NO migration.
>
> Decide with me FIRST (don't assume): (A) **roll `session-234-remediation`** — pre-roll audit the exact
> publish set (looks like server 2.107 + ui 0.13.2 + layer 0.99; no migration; reference envFlagMap deploys
> with commonpub.io; CLI needs a separate crates.io tag), then merge→main + fork pin bumps + live-verify;
> OR (B) **pick a backlog track** from 234-handoff.md; OR (C) knock out the **233 operator remainders**
> (Meili reindex, CLI crates.io tag `create-commonpub-v0.5.22`, unauth curl checklist).
>
> Two backlog items need a PRODUCT DECISION before any code — do NOT build them blind: the federation
> **mirror-storage gate** (§2b, P1 — naive gate over-blocks; needs "wanted content" semantics) and
> **profileVisibility** (make it a real feature or leave it). Build-ready-no-decision items: federation
> §1c/§2a/§2c, email-P3 send-time unsubscribe + broadcast drain-gate, monolith-4b. Strategic tracks
> (need go/no-go): contest-comms Phases 1/2/4, layout engine, instance-self-update.
>
> Disciplines: TDD (tests first); no feature without a flag; `var(--*)` only; explicit return types, no
> `any`; run `pnpm test` with NO dev server + no dev-DB mutation (concurrent runs flake); push-to-main
> auto-deploys+migrates commonpub.io (work on a branch); no AI attribution in commits; no em dashes in
> user-facing copy. For anything non-trivial use ultracode (design → adversarial-verify → TDD build) and
> DEFER-with-reason rather than guess.

## One-liner for the impatient
"Read 234-handoff.md, curl /api/features on all 3, then let's either roll session-234-remediation or pick
a backlog track — your call."
