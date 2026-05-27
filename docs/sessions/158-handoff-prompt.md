# Session 157 → 158 handoff prompt

Paste the following into the new session as the first message. It tells the model
where to find context, what rules to follow, and what's queued next.

---

## Prompt to paste

> Fresh Claude Code session on the CommonPub monorepo. Before doing anything:
>
> 1. **Read `CLAUDE.md`** at the repo root — those rules override everything else.
>    Especially rule #15: **NEVER add `Co-Authored-By: Claude` or any AI
>    attribution to commits, PR bodies, or git artifacts.**
> 2. **Read memory** — `MEMORY.md` index in
>    `~/.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/`.
>    Especially the recent `project_session_154/155/156/157_*` and the
>    `feedback_*` files. Two memories you'll want top of mind:
>    `feedback_vue_tsc_strict_vs_vitest` (closed structurally by the
>    pre-push hook in session 157 — `pnpm typecheck` runs on every push)
>    and `feedback_pnpm_publish_layer` (always `pnpm publish:layer`,
>    never `npm publish`).
> 3. **Read the most recent session handoff** —
>    `docs/sessions/157-theme-hotfix-and-phase1-server.md`. The
>    "What's next session (Phase 1c)" block at the bottom is your
>    priority list.
> 4. **Read the plan** — `docs/plans/layout-and-pages.md` is the
>    architectural source of truth for the whole layout/page editor
>    system. ~1342 lines. Long but essential.
> 5. **LLM reference docs** at `docs/reference/guides/theme-editor.md`
>    (the system shipped in session 154-156, now live on all 3 sites).
>    Phase 1c will eventually need a `layout-engine.md` companion.
> 6. **Codebase analysis** at `codebase-analysis/` — start with
>    `11-codebase-stats.md` for the headline, then the topic-specific
>    files (03 server modules, 04 API routes, 05 layer pages,
>    08 feature flags, 09 gotchas).
>
> **Where we are right now**:
>
> - **All 3 production instances (commonpub.io, deveco.io, heatsynclabs.io)
>   are healthy** on `@commonpub/layer@0.22.1` (the theme-editor hotfix).
>   The theme editor at `/admin/theme` and `/admin/theme/edit/[id]` is
>   live and working — admins can pick a theme family, capture
>   `:root` overrides into a custom theme, edit tokens with live
>   preview, save, import/export.
> - **Phase 1 layout engine is in main + on commonpub.io's workspace
>   layer but completely inert** — `features.layoutEngine` defaults
>   OFF; `/api/layouts/by-route` returns `404 "Layout engine not enabled"`;
>   `<LayoutSlot>` exists but no page uses it yet. The schema (migration
>   0005), server CRUD, public endpoint, useLayout composable,
>   `<LayoutSlot>` component, section registry, and one proof-of-life
>   `divider` section are all in main. **Nothing layout-related ships
>   to deveco.io or heatsynclabs.io yet** — they're on `0.22.1` npm,
>   which predates Phase 1.
>
> **Phase 1c — what's next, in priority order**:
>
> 1. **Build 5 starter sections** following the `divider` pattern locked
>    in commit `afd5111`. Each section is 3 files:
>    `layers/base/sections/builtin/{type}.ts` (Zod schema +
>    SectionDefinition export), `layers/base/components/sections/Section{Type}.vue`
>    (renderer, `var(--*)` only), and a `registry.register(...)` line
>    in `layers/base/sections/registry.ts`. Targets: `hero`, `heading`,
>    `paragraph`, `image`, `contentFeed`. Plus tests for each.
> 2. **Homepage migration script** — converts the existing
>    `instance_settings.homepage.sections` JSON to a `layouts` row +
>    rows + sections. Idempotent (re-runs are no-ops). Behind the
>    `features.layoutEngine` flag.
> 3. **Adopt `<LayoutSlot>` in `pages/index.vue`** with
>    `v-if="features.layoutEngine"` and the legacy
>    `HomepageSectionRenderer` as the fallback. So the page tries the
>    new path when the flag's on, the old path when off.
> 4. **Bump + publish the bundle**: config 0.14.0 → 0.15.0,
>    server 2.56.0 → 2.57.0, layer 0.22.1 → 0.23.0. (Schema 0.17.0
>    already has migration 0005; no schema bump needed.) Per the
>    publish runbook at `docs/sessions/155-publish-runbook-theme.md`.
> 5. **Per-instance canary**: run migration 0005 on commonpub.io's
>    DB first, flip `features.layoutEngine` on, verify, then deveco.io
>    + heatsynclabs.io.
> 6. **Admin layout write API** (`POST/PUT/DELETE /api/admin/layouts/*`)
>    — when you add these, EVERY write handler MUST call
>    `invalidateLayoutsByRouteCache()` before returning (currently a
>    documented TODO in `layers/base/server/api/layouts/by-route.get.ts`).
>
> **Rules in flight**:
>
> - **No AI attribution** anywhere (memory `feedback_no_coauthor`).
> - **`pnpm publish:layer`**, never `npm publish` (memory `feedback_pnpm_publish_layer`).
> - **Poll `pnpm view`** between publishes (memory `feedback_npm_propagation_lag`).
> - **Caret semver on 0.x.y excludes minor bumps** — when updating a
>   consumer site's `^0.22.1` to 0.23.0, manually edit `package.json`
>   then `pnpm install` (memory `feedback_caret_semver_0x_minor_bump`).
> - **Always use drizzle-kit to generate migrations** — hand-written
>   SQL files skip the journal and silently never run (memory: see
>   09-gotchas-and-invariants.md "Drizzle migrator reads the journal").
> - **Pre-push hook** runs `pnpm typecheck` automatically. If you need
>   to push despite a known issue (rare), `SKIP_SIMPLE_GIT_HOOKS=1 git push`.
> - **heatsynclabs-io has uncommitted operator WIP** (commonpub.config.ts
>   modified, ONBOARDING.md untracked — operator's in-progress federation
>   canary). When bumping their layer pin, stage ONLY `package.json` +
>   `pnpm-lock.yaml`. Never touch the WIP files.
>
> Tests at the start of this session: schema 413 + config 23 + ui 256
> + server 1024 + layer 117 = **1833 across the touched packages**.
>
> First step: confirm you've read all the above (acknowledge briefly),
> then propose your plan for Phase 1c. Don't start coding without a
> plan I can approve.

---

## Notes on context length

The plan doc (`layout-and-pages.md`) is long. If context is tight,
skim the table of contents + skip to §3 (architectural shape), §7
(editor UX), and §10 (test strategy) — those are the load-bearing
sections for Phase 1c work.
