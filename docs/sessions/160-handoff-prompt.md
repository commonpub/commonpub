# Session 159 → 160 handoff prompt

Paste the prompt block below (everything between the `---` rules) into the new session as the first message.

---

> Fresh Claude Code session on the CommonPub monorepo. Before doing anything:
>
> 1. **Read `CLAUDE.md`** — standing rules. Rule #15: NEVER add AI attribution to git artifacts.
> 2. **Read memory** — `MEMORY.md` index in `~/.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/`. Top of mind:
>    - `project-session-159-canary` — the big one. Captures the full autonomous run (16 commits + 3 stages) that landed Phase 1c canary + Phase 2 catch-all + 5 Phase 6b sections.
>    - New feedback from session 159: `feedback-nuxt-env-only-declared-keys`, `feedback-usefetch-query-function`.
>    - `feedback-deployment-architecture` — per-droplet SSH keys + paths. commonpub uses `~/.ssh/id_ed25519`; heatsync uses `/Users/obsidian/Projects/heatsync/heatsynclabs-io/secrets/ci_deploy_ed25519`; deveco uses default key. All `root@<host>`. I have doctl access too (account hackbuildvideo@gmail.com).
>    - Standing publish rules: `feedback-pnpm-publish-layer`, `feedback-npm-propagation-lag`, `feedback-caret-semver-0x-minor-bump`, `feedback-vue-tsc-strict-vs-vitest`, `feedback-no-coauthor`.
> 3. **Read the rollout plan tracker** — `docs/plans/layout-engine-rollout.md`. Living document. Stages A-C done; D-J still open. Decision log + memory-of-gotchas at the bottom.
> 4. **Read the previous session log** — `docs/sessions/159-canary-shipped.md` for the full Phase 1c canary arc. `docs/sessions/159-phase-1c-section-completion.md` for the section-build details.
>
> **End-of-session-159 state** (everything I should ALREADY be on top of):
>
> | Site | Layer | Phase 1c rendering | Custom-page catch-all | Health |
> |---|---|---|---|---|
> | commonpub.io | workspace `main` (latest 0473313) | **LayoutSlot — 7 sections, homepage live** | Live + verified end-to-end via canary seed | ✓ 200 |
> | heatsynclabs.io | npm `@commonpub/layer@0.24.0` | legacy renderer; dormant infra | Catch-all code shipped, untested on this site | ✓ 200 |
> | deveco.io | npm `@commonpub/layer@0.24.0` | legacy renderer; dormant infra | Catch-all code shipped, untested on this site | ✓ 200 |
>
> **Published npm**:
> - `@commonpub/server@2.58.0` — adds migrateHomepageSectionsToLayout, validateCustomPageScope, pathNormalize, `./layout/*` subpath export
> - `@commonpub/layer@0.24.0` — 17 sections (divider + 11 + 5 Phase 6b: cta/markdown/gallery/video/embed), migration endpoint, feature-flags-prime Nitro plugin, useLayout query fix, useFeatures SSR prime, Phase 2 custom-page catch-all
> - `@commonpub/config@0.15.0` (unchanged since session 158)
> - schema/ui/auth/protocol/editor/explainer/learning/docs/infra/test-utils unchanged since session 156
>
> **Migration 0005**: applied on all 3 sites. Catch-up: commonpub.io has migration applied (verified in session 159); heatsync + deveco received it on this session's npm install + container rebuild.
>
> **First step**: confirm you've read all the above (acknowledge briefly), then verify health + canary state:
> ```bash
> for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
>   echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
> done
> # commonpub.io should be rendering via LayoutSlot:
> curl -sS https://commonpub.io/ | grep -oE 'cpub-section-(hero|editorial|content-feed|stats|hubs|contests)' | sort -u
> # catch-all on unknown path returns 404:
> curl -s -o /dev/null -w '/nonexistent = %{http_code}\n' https://commonpub.io/nonexistent
> ```
> All sites should be 200. Section markers should show all 6 types. Catch-all 404.
>
> ---
>
> **Queued for this session, in priority order — propose a plan, don't execute without my OK**:
>
> **Critical follow-ups from session 159 (DO FIRST)**:
>
> 1. **A.fix.1 — `feature-flags-prime` plugin not bundled on heatsync/deveco** (P1). Layer 0.24.0's tarball ships `server/plugins/feature-flags-prime.ts`. heatsync's nitro chunk grep `cpubFeatureFlags` returned 0 (NOT loaded). Theory: Nuxt's auto-discovery of `server/plugins/` may not cross extended-layers. If true, plugin needs to ship as a Nuxt module OR be added to each consumer app's `server/plugins/`. Until fixed, operator opt-in on heatsync/deveco will have the SSR-flag-hydration bug (legacy renderer flashes before client hydration switches to LayoutSlot). Investigate: try `pnpm view @commonpub/layer@0.24.0 dist/server/plugins/feature-flags-prime.ts` then check whether heatsync's nuxt build actually picks it up via `nuxt extends '../node_modules/@commonpub/layer'`.
>
> 2. **B.fix.1 — PUT handler on /api/admin/layouts/[id] doesn't validate path-normalisation** (P3). Scope is immutable so a wrong-cased path 400s rather than 409. Low priority.
>
> 3. **B.fix.2 — FILE_ROUTE_PREFIXES hardcoded** (P2). Should be dynamic Nitro plugin scanning Nuxt's compiled routes at startup. Without this, thin apps adding routes (heatsync may add `/membership`) need to update the list manually OR risk allowing custom pages that 404 because of route conflict.
>
> 4. **B.fix.3 — Catch-all 'admin' access control uses client-hydrated user** (P2). Needs SSR-side admin probe to avoid existence-leak of admin-gated pages.
>
> 5. **C.fix.3 — 8 remaining Phase 6b sections** — spacer, featured-content, content-card, event-list, member-list, contact-form, newsletter, announcement, iframe. ~30 min each.
>
> **Next major stage (Stage D — Phase 3a: editor shell read-only)**:
>
> Per `docs/plans/layout-and-pages.md` §7, Phase 3 (editor UI) is 7 sessions: 3a (shell) → 3b (drag-drop, 2 sessions) → 3c (resize) → 3d (a11y) → 3e (auto-form from Zod) → 3f (inspector polish). Critical path for usability.
>
> Phase 3a deliverable (1 session):
> - LayoutSlot `:editable` prop with selection overlay + `@select` emit
> - `/admin/layouts/index.vue` — page list (one row per layout)
> - `/admin/layouts/[id].vue` — canvas + inspector
> - Right-side inspector panel with page-meta form (title, description, ogImage, access, frame)
> - Toolbar with viewport toggle (mobile/tablet/desktop preview)
> - Auto-save scaffolding (debounced PUT, conflict detection)
>
> **Other queued (lower priority)**:
>
> 6. Per-instance embed allowlist override (C.fix.1)
> 7. Lightbox composable for gallery (C.fix.2)
> 8. Phase 4: LayoutSlot adoption in `pages/hubs/[slug]`, blog/project/learn indexes, profile, footer, 404
> 9. Phase 5: theme/layout preview-scene integration
> 10. Phase 7-10 (versioning UI, multi-select, code-registered sections, perf hardening)
>
> ---
>
> **Hard rules** (don't violate without my OK):
>
> - **No AI attribution** in any commit, PR, or git artifact.
> - **`pnpm publish:layer`** for layer publishes — never `npm publish`.
> - **Poll `pnpm view`** between publishes to catch npm propagation lag.
> - **Caret semver on 0.x.y** excludes minor bumps — manually edit consumer `package.json`.
> - **Pre-push hook** runs `pnpm typecheck`. `SKIP_SIMPLE_GIT_HOOKS=1 git push` only when bypassing intentionally.
> - **NEVER trust `gh run list` "success"** for prod deploys — always `curl /api/health` after.
> - **Before any consumer pin bump involving schema**, verify post-install schema dist has ≥80 files via container-build smoke-test.
> - **heatsync has uncommitted operator WIP** (`commonpub.config.ts` + `ONBOARDING.md`) — when bumping its pin, stage ONLY `package.json + package-lock.json`.
> - **Plan first, execute after approval.** Pin bumps, publishes, and prod migrations need my green light. Stage D (editor) deserves its own focused session — don't try to compress 7 phases into one.
> - **Audit your shipped code as a hostile reader** — session 159's catch-all bug (P0) shipped because the bug was setup-time-only and wouldn't manifest until a real custom-page existed. Audit caught it. Don't ship without verifying the full output path end-to-end.

---

That's the prompt. Copy from the first `>` line through the last `>` line and paste as the new session's opening message.

## Quick context if you want to skim before pasting

- Session 159 was a long autonomous run: 18+ commits, 3 stages shipped + catch-all P0 found + fixed.
- The layout engine is LIVE on commonpub.io serving the homepage via LayoutSlot.
- Phase 2 (custom-page catch-all) is LIVE — confirmed end-to-end via a seeded test layout.
- 5 Phase 6b sections shipped: cta/markdown/gallery/video/embed.
- The big remaining work is Phase 3 (editor UI) — multi-session project.
