# Session 158 → 159 handoff prompt

Paste the prompt block below into the new session as the first message.

---

## Prompt to paste

> Fresh Claude Code session on the CommonPub monorepo. Before doing anything:
>
> 1. **Read `CLAUDE.md`** — standing rules. Rule #15: NEVER add AI attribution to git artifacts.
> 2. **Read memory** — `MEMORY.md` index in `~/.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/`. Especially the recent `project_session_158` (the big one — covers all of Phase 1c + the publish saga + the deveco recovery) + new feedback memories: `feedback-pnpm-install-drops-files`, `feedback-display-flex-on-img`, `feedback-regex-empty-alternation`, `feedback-deploy-health-check-warn-not-fail`. Also `feedback-deployment-architecture` for the per-droplet SSH key + paths (commonpub uses `~/.ssh/id_ed25519`; heatsync uses `/Users/obsidian/Projects/heatsync/heatsynclabs-io/secrets/ci_deploy_ed25519`; deveco uses the default key — all `root@<host>`). I have doctl access too (account `hackbuildvideo@gmail.com`).
> 3. **Read the previous session log** — `docs/sessions/158-phase-1c-sections-and-write-api.md`. The "Post-session-158 follow-up" section at the bottom covers the 3 rounds of fixes that finally got all 3 sites on Phase 1c.
>
> **Where everything stands** (verified live at session 158 end):
>
> - **commonpub.io**: workspace layer (auto-deploys main). Phase 1c live + inert (`layoutEngine: false`). All user-fixes live. ✓ 200.
> - **heatsynclabs.io**: npm `@commonpub/layer@0.23.3`. Phase 1c live + inert. All user-fixes live. ✓ 200.
> - **deveco.io**: npm `@commonpub/layer@0.23.3` (caught up after recovery from session 158's failed bump). Phase 1c live + inert. All user-fixes live. ✓ 200.
>
> **Published npm packages at end of session 158**:
> - `@commonpub/config@0.15.0` (added `features.layoutEngine`)
> - `@commonpub/server@2.57.0` (added layout CRUD + `seedHomepageLayout`)
> - `@commonpub/layer@0.23.3` (Phase 1c full slice + 3 user-reported fixes)
> - schema/ui/etc unchanged since session 156 publish
>
> **Migration 0005 state**:
> - commonpub.io: NOT applied (workspace deploy doesn't auto-migrate; user would need to run manually if they want to enable layoutEngine here)
> - heatsynclabs.io: NOT applied
> - deveco.io: applied (during the session 158 failed deploy — extra tables exist but go unused with flag off)
>
> **What's queued for this session, in priority order**:
>
> 1. **Phase 1c real-world canary**: pick one site (commonpub.io is the natural first since you have the most control there) — run migration 0005 + POST `/api/admin/layouts/seed-homepage` + flip `features.layoutEngine` to true. Verify the new homepage renders the seeded hero + content-feed correctly. Iterate on visual polish if needed. The flag flip is now safe (auto-fallback to legacy if no layout) but enabling the engine "for real" still needs the seed step.
>
> 2. **Phase 1c remaining work** (deferred from previous handoffs):
>    - Build remaining starter sections (editorial / contests / hubs / learning / stats / custom-html) — unblocks the real homepage migration
>    - Real homepage migration script: convert legacy `instance_settings.homepage.sections` JSON → `layouts` row. Depends on (a) above.
>    - Admin UI for layouts (Phase 3 in the plan — visual canvas editor with drag/drop/resize)
>
> 3. **Optional housekeeping**:
>    - Fix the deploy workflow's `curl … || echo` false-success pattern in deveco-io + heatsynclabs-io (memory `feedback-deploy-health-check-warn-not-fail`) — operator-side change.
>    - Standardise consumer-site Dockerfiles. Heatsync uses `npm install`, deveco uses `pnpm install --frozen-lockfile`. The pnpm path is fragile (memory `feedback-pnpm-install-drops-files`). Either bump consumer pins regularly to keep them on the schema major, or migrate to `npm install` for both.
>    - File a pnpm GitHub issue with the schema-install reproducer.
>
> **Hard rules in flight** (from MEMORY.md):
>
> - **No AI attribution** anywhere.
> - **`pnpm publish:layer`**, never `npm publish` for layer.
> - **Poll `pnpm view`** between publishes.
> - **Caret semver on 0.x.y** excludes minor bumps — manually edit consumer `package.json`.
> - **Pre-push hook** runs `pnpm typecheck`. `SKIP_SIMPLE_GIT_HOOKS=1 git push` if you need to bypass.
> - **NEVER trust `gh run list` deploy status** — always `curl /api/health` after a deploy.
> - **Before bumping consumer pins involving schema**, verify the post-install schema dist has ≥ 80 files (do a container-build smoke-test on the host). Bump the schema direct pin if it's still on an older major.
> - **heatsync has operator WIP** (`commonpub.config.ts` + `ONBOARDING.md` untracked) — NEVER stage them during a pin bump.
>
> First step: confirm you've read all the above (acknowledge briefly), verify all 3 sites still 200 with `curl -s -o /dev/null -w "%{http_code}\n" https://{commonpub.io,deveco.io,heatsynclabs.io}/api/health`, then propose your plan. Don't start any pin bumps, publishes, or migration runs without my approval.

---

## Notes on context

The plan doc (`docs/plans/layout-and-pages.md`) is the architectural source of truth for Phase 1c. The session 158 log + the 4 new feedback memories + this handoff are sufficient context for what's queued.
