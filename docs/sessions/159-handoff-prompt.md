# Session 158 → 159 handoff prompt

Paste the prompt block below (everything between the `---` rules) into the new session as the first message.

---

> Fresh Claude Code session on the CommonPub monorepo. Before doing anything:
>
> 1. **Read `CLAUDE.md`** — standing rules. Rule #15: NEVER add AI attribution to git artifacts.
> 2. **Read memory** — `MEMORY.md` index in `~/.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/`. Top of mind:
>    - `project_session_158` — the big one. Covers Phase 1c shipping + 4 hotfix rounds + the deveco recovery saga.
>    - New feedback memories from session 158: `feedback-pnpm-install-drops-files`, `feedback-display-flex-on-img`, `feedback-regex-empty-alternation`, `feedback-deploy-health-check-warn-not-fail`.
>    - `feedback-deployment-architecture` — per-droplet SSH key + paths. **commonpub** uses `~/.ssh/id_ed25519`; **heatsync** uses `/Users/obsidian/Projects/heatsync/heatsynclabs-io/secrets/ci_deploy_ed25519`; **deveco** uses the default key. All `root@<host>`. I have doctl access too (account `hackbuildvideo@gmail.com`).
>    - `feedback-pnpm-publish-layer`, `feedback-npm-propagation-lag`, `feedback-caret-semver-0x-minor-bump`, `feedback-vue-tsc-strict-vs-vitest`, `feedback-no-coauthor` — standing publish/git rules.
> 3. **Read the previous session log** — `docs/sessions/158-phase-1c-sections-and-write-api.md`. The "Post-session-158 follow-up" section at the bottom is the most-recent state.
>
> **End-of-session-158 state** (everything I should ALREADY be on top of):
>
> | Site | Layer | Phase 1c? | All 3 user-fixes? | Health | Latest commit |
> |---|---|---|---|---|---|
> | commonpub.io | workspace `main` | yes (inert) | yes | ✓ 200 | `9d8e3b1` |
> | heatsynclabs.io | npm `@commonpub/layer@0.23.3` | yes (inert) | yes | ✓ 200 | `f52b75c` |
> | deveco.io | npm `@commonpub/layer@0.23.3` | yes (inert) | yes | ✓ 200 | `0613d9d` |
>
> All Phase 1c routes (`/api/layouts/by-route`, `/api/admin/layouts/*`) return 404 on all sites because `features.layoutEngine: false` everywhere. The 3 user-reported fixes (feature-flag UI override sticks; blog avatar `<img>` no longer squished; homepage no-blank when flag flipped without seed) are live on all 3.
>
> **Published npm packages (current)**:
> - `@commonpub/config@0.15.0` — added `features.layoutEngine` (default OFF)
> - `@commonpub/server@2.57.0` — added layout CRUD + `seedHomepageLayout`
> - `@commonpub/layer@0.23.3` — Phase 1c full slice (5 starter sections + 9 admin routes + homepage adoption + URL XSS guard + 3 user-fix patches)
> - schema/ui/auth/protocol/editor/explainer/learning/docs/infra/test-utils unchanged since session 156 publish
>
> **Migration 0005 (layout engine tables) status**:
> - **commonpub.io**: NOT applied. Workspace deploy doesn't auto-migrate; needs `pnpm db:migrate` run manually (or via SSH on the prod host) before `layoutEngine` can do anything.
> - **heatsynclabs.io**: NOT applied. Same — needs `drizzle-kit migrate` via SSH.
> - **deveco.io**: APPLIED (during session 158's failed deploy — extra `layouts`/`layout_rows`/`layout_sections`/`layout_versions` tables exist, unused with flag off).
>
> **First step**: confirm you've read all the above (acknowledge briefly), then re-verify health:
> ```bash
> for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
>   echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
> done
> ```
> All should be `200`. If any aren't, debug that before anything else.
>
> ---
>
> **Queued for this session, in priority order — propose a plan, don't execute without my OK**:
>
> **1. Phase 1c real-world canary on commonpub.io** — the most natural next step. The plumbing is all shipped; nothing's actually been driven through the layout engine on a live site yet.
>
> Sequence:
> 1. SSH `root@commonpub.io` + `cd /opt/commonpub/` + run `drizzle-kit migrate` (apply migration 0005)
> 2. `POST https://commonpub.io/api/admin/layouts/seed-homepage` with admin auth (the flag has to be ON to reach this endpoint per `requireFeature('layoutEngine')` — so flip the flag first, OR run the seed server-side via the `seedHomepageLayout(db)` helper). Easier path: server-side script.
> 3. Flip `features.layoutEngine: true` (admin UI override or env var). As of layer 0.23.2 the admin UI override actually sticks.
> 4. Load `/` — should render the seeded hero ("Build. Document. Share." with two CTAs) above the content-feed grid, instead of the legacy homepage.
> 5. Iterate on visual polish or seed content if needed. Roll back at any point by flipping the flag back off — auto-fallback (layer 0.23.3) means even a half-configured layout doesn't blank the page.
>
> **2. Build the remaining starter sections** to unblock the real legacy-homepage migration:
> - `editorial` (staff-picks grid)
> - `contests` (active contests list — feature-gated)
> - `hubs` (trending hubs — feature-gated)
> - `learning` (learning paths — feature-gated)
> - `stats` (platform stats grid)
> - `custom-html` (admin-only, sanitised HTML)
>
> Each follows the locked divider pattern (3 files: `layers/base/sections/builtin/{type}.ts` + `layers/base/components/sections/Section{Type}.vue` + one register call). ~30 min per section incl. tests.
>
> **3. Real homepage migration script** — converts `instance_settings.homepage.sections` JSON to a `layouts` row. Depends on (2). Idempotent. Replaces the current `seedHomepageLayout` for instances that have customised their homepage.
>
> **4. Admin UI for layouts** (Phase 3 in `docs/plans/layout-and-pages.md` — visual canvas with drag/drop/resize). Big lift; multiple sessions. Don't start without explicit go-ahead.
>
> **Optional housekeeping** (low urgency):
> - Fix the deploy workflow's `curl … || echo "::warning"` false-success pattern in deveco-io + heatsynclabs-io (`feedback-deploy-health-check-warn-not-fail`) — change to `|| { echo "::error"; exit 1; }`.
> - Standardise consumer-site Dockerfiles. Heatsync uses `npm install` (worked); deveco uses `pnpm install --frozen-lockfile` (fragile — took deveco down session 158). Consider migrating deveco to `npm install`.
> - File a pnpm GitHub issue with the schema-install reproducer.
>
> ---
>
> **Hard rules** (don't violate without my OK):
>
> - **No AI attribution** in any commit, PR, or git artifact.
> - **`pnpm publish:layer`** for layer publishes — never `npm publish` (memory `feedback-pnpm-publish-layer`).
> - **Poll `pnpm view`** between publishes to catch npm propagation lag (memory `feedback-npm-propagation-lag`).
> - **Caret semver on 0.x.y** excludes minor bumps — manually edit consumer `package.json`, don't trust `pnpm update`.
> - **Pre-push hook** runs `pnpm typecheck` automatically. `SKIP_SIMPLE_GIT_HOOKS=1 git push` only when bypassing intentionally.
> - **NEVER trust `gh run list` "success"** for prod deploys — always `curl /api/health` after.
> - **Before any consumer pin bump involving schema**, verify post-install schema dist has ≥80 files via container-build smoke-test on the host. If less, bump the direct schema pin and regen lockfile (memory `feedback-pnpm-install-drops-files`).
> - **heatsync has uncommitted operator WIP** (`commonpub.config.ts` + `ONBOARDING.md`) — when bumping its pin, stage ONLY `package.json + pnpm-lock.yaml`.
> - **Plan first, execute after approval.** Pin bumps, publishes, and prod migrations need my green light.

---

That's the prompt. Copy from the first `>` line through the last `>` line and paste as the new session's opening message.

## Quick context if you want to skim before pasting

- Last session shipped Phase 1c end-to-end across all 3 prod sites (5 sections + 9 admin routes + homepage adoption + 3 user-fix rounds + the deveco pnpm-install-bug recovery).
- The plan doc (`docs/plans/layout-and-pages.md`) is the architectural source of truth for Phase 1c going forward.
- Migration 0005 only exists on deveco's DB; commonpub + heatsync still need it before they can flip the flag for real.
