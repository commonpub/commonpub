# Build-pipeline findings (2026-07-17, session 242)

Investigated the "build-pipeline gap" (layers/base + infra have no lint; the layer had no
dedicated typecheck). Measured with a parallel read-only workflow + verified by hand. Summary:
the situation is bigger and more operator-facing than the original backlog line implied.

## What's actually true

1. **The layer IS typechecked in CI** — not a gap. `pnpm typecheck` (`turbo run typecheck`) runs
   `nuxt typecheck` in `apps/reference` + `apps/shell`, both of which `extends: ['../../layers/base']`.
   Their generated `.nuxt/tsconfig.json` / `.nuxt/tsconfig.server.json` include `layers/base/**/*`
   (client) and `layers/base/server/**/*` (server). A type error in layer source fails the CI `check`
   job's **Typecheck** step. Confirmed: the latest `check` runs PASS typecheck (fail later, at lint).
   - A *standalone* `layers/base` typecheck is NOT viable: `@commonpub/layer` has no `nuxt`/`vue-tsc`/
     `typescript` dep; `nuxi typecheck` there fails on `@nuxt/kit`. Rely on the reference-app typecheck.
   - Interim safeguard (memory `feedback_typecheck_layer_via_reference_app`): before rolling any
     `layers/base` change, run `cd apps/reference && pnpm typecheck`. (macOS has no `timeout` binary —
     don't wrap it, or it no-ops to a false "clean".)

2. **CI `check` job has been RED for a long time — at the Lint step — pre-existing.** `gh run list`
   shows `ci.yml` `check` failing on 12+ consecutive commits going back BEFORE session 242
   (c7376403, 6769a20a, ed8f6847, …). The failing step is **Lint**, not typecheck/test/build.
   Root cause: `package.json` pins `@eslint/js: ^10.0.1` (a major bump) whose `recommended` set added
   rules the codebase violates repo-wide (`no-useless-assignment`, `preserve-caught-error`, …). Example:
   `@commonpub/server#lint` = 2 errors + 82 warnings; none introduced by session 242's changes.

3. **`deploy.yml` does NOT gate on the `check` job.** They run independently on push to main; the
   Dockerfile's `pnpm build` (nuxt build) does not typecheck. So a red (or would-be-red) `check` does
   not block a production deploy. This is the real reason the session-242 `config`-scope layer bug could
   deploy (layer 0.107.1) — the CI net that catches it is both red and non-gating.

## Done this session (safe, in-scope)

- **`packages/infra` lint** — added `"lint": "eslint src/"` (parity with all 12 sibling packages;
  it already had `typecheck`). Fixed its 3 findings: `RedisClient` interface→`type RedisClient = Redis`
  (used only as a type); intentional `no-redeclare` dual namespace on `RateLimitStore` given an inline
  disable; removed a stale unused `eslint-disable` in `email/adapters.ts`. `eslint src/` + `tsc --noEmit`
  both clean. No runtime change.

## Deferred — needs an operator decision (do NOT do unilaterally)

- **eslint-10 strategy (unblocks CI):** either (a) revert `@eslint/js` to `^9.x` for a fast green (if the
  10.x bump wasn't deliberate), or (b) keep 10.x and triage the new-rule violations repo-wide (server
  2+82, plus layers/base, plus every other package) — likely ratcheting warnings and fixing the handful
  of real errors. Until one is chosen, `pnpm lint` / CI `check` stays red.
- **Gate deploy on check:** make `deploy.yml` `needs: check` (or add a typecheck+lint step to the deploy
  path) so a red pipeline can't ship. Real trade-off: slower deploys, CI flakiness could block releases —
  an operator call.
- **`layers/base` lint:** TS surface is ~clean (6 small errors, 32 warnings across 659 files) — a bounded
  fix once the eslint-10 strategy is set. The Vue surface (283 SFCs / 67,686 LOC) is currently UNLINTABLE
  (no `eslint-plugin-vue` / `vue-eslint-parser`); enabling it needs those deps + a ratchet (warnings/
  baseline), never a blind `--fix` over templates.

## Recommendation

Treat this as a small dedicated cleanup epic, operator-sequenced: pick the eslint-10 strategy → get
`pnpm lint` green → then `deploy.yml needs: check`. That converts CI from "red + ignored" back into a real
gate, which is the actual fix for the class of bug that shipped this session.
