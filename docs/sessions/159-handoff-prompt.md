# Session 158 → 159 handoff prompt

Paste the prompt block below into the new session as the first message.

---

## Prompt to paste

> Fresh Claude Code session on the CommonPub monorepo. Before doing anything:
>
> 1. **Read `CLAUDE.md`** — standing rules. Rule #15: NEVER add AI attribution to git artifacts.
> 2. **Read memory** — `MEMORY.md` index in `~/.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/`. Especially the recent `project_session_158` + the new feedback entries: `feedback-pnpm-install-drops-files`, `feedback-display-flex-on-img`, `feedback-regex-empty-alternation`, `feedback-deploy-health-check-warn-not-fail`. Also `feedback-deployment-architecture` for the per-droplet SSH key + paths (commonpub uses `~/.ssh/id_ed25519`; heatsync uses `/Users/obsidian/Projects/heatsync/heatsynclabs-io/secrets/ci_deploy_ed25519`; deveco uses the default key).
> 3. **Read the previous session log** — `docs/sessions/158-phase-1c-sections-and-write-api.md`. The post-rollback investigation section explains the pnpm install bug + the two user-reported fixes that landed in commit `3a30d32`.
>
> **Where everything stands** (verified live):
>
> - **commonpub.io**: workspace layer (auto-deploys main, including `3a30d32`). Phase 1c live but inert (`layoutEngine: false`). Has the 2 user-reported fixes (feature-flag override sticks + avatar no-squish). ✓ 200.
> - **heatsynclabs.io**: npm `@commonpub/layer@0.23.1`. Phase 1c live but inert. Does NOT have the 2 user-fixes yet. ✓ 200.
> - **deveco.io**: rolled back to npm `@commonpub/layer@0.22.1` (the pre-Phase-1c baseline). Doesn't have Phase 1c OR the 2 user-fixes. Schema migration 0005 was applied to its DB during the failed deploy — extra tables exist but unused. ✓ 200.
>
> **What's queued for this session, in priority order**:
>
> 1. **Get the 2 user-fixes onto heatsync.** Publish `@commonpub/layer@0.23.2` (no schema/server bumps — layer-only changes), bump `heatsynclabs-io/package.json` `@commonpub/layer` pin `^0.23.1 → ^0.23.2`, push. Heatsync uses `npm install` in its Dockerfile so the pnpm install bug doesn't apply — safe to bump. Heatsync has uncommitted operator WIP (`commonpub.config.ts` + `ONBOARDING.md`) — stage ONLY `package.json + pnpm-lock.yaml`.
>
> 2. **Fix the pnpm install bug for deveco.** Two paths in order of preference:
>    - **(a)** Delete `deveco-io/pnpm-lock.yaml`, run `pnpm install` fresh (will regenerate). Verify the new lockfile produces a complete `@commonpub/schema@0.17.0` install by building locally + checking `ls .output/server/node_modules/@commonpub/schema/dist/ | wc -l` ≥ 80. If yes, commit + bump pins (config 0.15.0 / server 2.57.0 / layer 0.23.2) + push.
>    - **(b)** If (a) doesn't fix it: change `deveco-io/Dockerfile` to use `npm install` instead of `pnpm install --frozen-lockfile`. Matches heatsync's known-good approach. Same bump-pins-push afterward.
>
>    Pre-bump sanity check before pushing: SSH into deveco, build the image locally with the new lockfile/Dockerfile, run with `docker run --rm` on a non-prod port (`-p 13000:3000`), watch stderr. Only push the pin bump when local run starts cleanly.
>
>    The fixed deploy workflow's `curl … || echo` false-success pattern is also worth fixing (per memory `feedback-deploy-health-check-warn-not-fail`).
>
> 3. **Phase 1c remaining priorities** (deferred from session 158 handoff):
>    - Real homepage migration script (needs Phase 6b sections: editorial/contests/hubs/learning/stats/custom-html)
>    - Per-instance canary of `features.layoutEngine = true` (after migration 0005 + `POST /api/admin/layouts/seed-homepage`). Migration 0005 IS already applied on deveco's DB (ran during the failed 0.23.1 deploy). Commonpub.io needs it run.
>
> **Hard rules in flight**:
>
> - **No AI attribution** anywhere (memory `feedback-no-coauthor`).
> - **`pnpm publish:layer`**, never `npm publish` (memory `feedback-pnpm-publish-layer`).
> - **Poll `pnpm view`** between publishes (memory `feedback-npm-propagation-lag`).
> - **Caret semver on 0.x.y** excludes minor bumps — manually edit consumer `package.json`.
> - **Pre-push hook** runs `pnpm typecheck`. `SKIP_SIMPLE_GIT_HOOKS=1 git push` if you need to bypass (rare).
> - **NEVER trust `gh run list` deploy status** — always `curl /api/health` after a deploy (memory `feedback-deploy-health-check-warn-not-fail`).
> - **Before bumping deveco**, verify the post-install schema 0.17.0 dist/ has ≥ 80 files (memory `feedback-pnpm-install-drops-files`).
> - **heatsync's operator WIP**: NEVER stage `commonpub.config.ts` or `ONBOARDING.md` during a pin bump.
>
> First step: confirm you've read all the above (acknowledge briefly), verify all 3 sites still 200 with `curl -s -o /dev/null -w "%{http_code}\n" https://{commonpub.io,deveco.io,heatsynclabs.io}/api/health`, then propose your plan for which of the queued items to tackle in this session. Don't start touching consumer-site pins or publishing without a plan I can approve.

---

## Notes on context

The plan doc (`docs/plans/layout-and-pages.md`) is the architectural source of truth for Phase 1c — still relevant if you continue Phase 1c work. The session 158 log + the new memories are sufficient context for the immediate queued items.
