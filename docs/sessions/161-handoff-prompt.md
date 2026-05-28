# Session 160 → 161 handoff prompt — Phase 3a editor shell

Paste the prompt block below (everything between the `---` rules) as the first message of the new session.

---

> Fresh Claude Code session on the CommonPub monorepo. The previous session closed with the libraries chosen + installed for the layout editor. You're picking up at Phase 3a (editor shell read-only). **Be thorough and careful.** Don't rush. Verify each step before moving on.
>
> ## Step 0 — Mandatory reads BEFORE any code
>
> Read these in order. Do not skip. Acknowledge briefly when done; don't summarise them.
>
> 1. **`CLAUDE.md`** at the repo root — the standing rules. Especially:
>    - Rule #2: no feature without a flag in `commonpub.config.ts`
>    - Rule #3: no hardcoded color or font in any UI component — always `var(--*)`
>    - Rule #11: test-driven (tests first or alongside)
>    - Rule #12: WCAG 2.1 AA minimum
>    - Rule #15: NEVER add AI attribution (`Co-Authored-By`, `Signed-off-by`, or any AI mention) to git commits or PRs
> 2. **`~/.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/MEMORY.md`** — the memory index. Then specifically read these individual memories:
>    - `feedback-reuse-existing-components` — **the most important one for this session.** Layout engine = ARRANGER for existing components. Before writing any new component, check `layers/base/components/blocks/` AND `layers/base/components/homepage/`. Session 158-9 shipped 17 Section*.vue files; 16 were duplicates of existing components (~2200 lines wasted). Don't repeat.
>    - `feedback-no-coauthor` — git commit rule
>    - `feedback-pnpm-publish-layer` — publish rule
>    - `feedback-caret-semver-0x-minor-bump` — version bump rule
>    - `feedback-vue-tsc-strict-vs-vitest` — pre-push gauntlet pattern (CI's vue-tsc strict catches what vitest+esbuild doesn't)
>    - `feedback-deploy-health-check-warn-not-fail` — NEVER trust `gh run list` for deploy success; always curl `/api/health`
>    - `feedback-deployment-architecture` — per-droplet SSH keys + paths
>    - `feedback-nuxt-env-only-declared-keys` — env vars only propagate to `runtimeConfig` keys DECLARED in nuxt.config
>    - `feedback-usefetch-query-function` — `query: { k: fn }` serialises function as undefined; wrap in `computed()`
>    - `project-session-159-canary` — what shipped in the prior session (canary live, Stage E unification done, hero customization wired)
> 3. **`docs/plans/phase-3-editor.md`** — the plan for THIS session and the next ~5-6. Critical reads:
>    - Why hybrid (3 primitives) over a full editor framework
>    - `grid-layout-plus` + `@vue-dnd-kit/core` are INSTALLED (verify in `layers/base/package.json`)
>    - Execution sequence Phase 3a → 3b → 3c → 3d → 3e → 3f
>    - Risk register at the bottom
> 4. **`docs/plans/layout-engine-rollout.md`** — the meta tracker (Stages A-E done; Phase 3 = Stage F implicitly)
> 5. **`docs/plans/stage-e-unification.md`** — for context on what Stage E corrected. Section registry now uses `propMap` to dispatch to existing components.
> 6. **`docs/plans/layout-and-pages.md`** §7 (the architectural design for the editor, ~600 lines starting at line 520). Skim — the plan in (3) translates this to the hybrid approach.
>
> ## Step 1 — Verify current state (read-only)
>
> ```bash
> # All sites healthy?
> for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
>   echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
> done
>
> # commonpub.io homepage still on Stage E unified rendering?
> curl -sS https://commonpub.io/ | grep -oE 'cpub-(hero-banner|sb-card|btn-load-more|layout-(row|section))' | sort | uniq -c
> # Expect: cpub-hero-banner (legacy HeroSection class) + cpub-sb-card +
> # cpub-btn-load-more (ContentGridSection) + cpub-layout-row/section (LayoutSlot wrappers).
> # If you see cpub-section-hero / cpub-section-content-feed, REGRESSION — Stage E broke.
>
> # Catch-all 404 on unknown path:
> curl -s -o /dev/null -w '/random-test = %{http_code}\n' https://commonpub.io/random-test
>
> # Libraries installed?
> grep -E 'grid-layout-plus|@vue-dnd-kit' layers/base/package.json
> # Expect: grid-layout-plus 1.1.1 + @vue-dnd-kit/core 2.4.6
>
> # Test count baseline:
> pnpm --filter @commonpub/layer test 2>&1 | grep -E "Tests" | tail -1
> # Expect: ~183 passed
>
> # Typecheck clean:
> pnpm typecheck 2>&1 | tail -3
> # Expect: 26 typecheck tasks successful
> ```
>
> If anything diverges from expectations: STOP and investigate. Don't proceed with code until current state matches.
>
> ## Step 2 — Phase 3a execution (PROPOSE PLAN FIRST)
>
> Per the plan doc (`docs/plans/phase-3-editor.md` §Phase 3a), Phase 3a deliverables:
>
> - **3a.1** Add `:editable` prop to `LayoutSlot.vue` (default false). When true, wraps each section in a selection overlay div. NO behavior change yet — just visual affordance.
> - **3a.2** Page list — `layers/base/pages/admin/layouts/index.vue`. Table over `GET /api/admin/layouts` (endpoint exists from session 158).
> - **3a.3** Editor shell — `layers/base/pages/admin/layouts/[id].vue`. Three-column: section palette (left, reads from `useSectionRegistry().list()`), canvas (LayoutSlot :editable=true with previewOverride=draft), inspector (right, page-meta form).
> - **3a.4** Page-meta inspector form — title/description/ogImage/access/frame. Uses `PUT /api/admin/layouts/[id]` (endpoint exists).
> - **3a.5** Toolbar — viewport toggle (mobile/tablet/desktop preview width), save indicator, publish button.
> - **3a.6** Auto-save scaffolding — debounced PUT (~5s after last edit), 409 conflict modal.
> - **3a.7** Tests — page render + smoke test of fetch path.
> - **3a.8** Verify the editor pages load on commonpub.io (admin-only, won't affect public homepage).
>
> Before writing any code:
> 1. PROPOSE a detailed plan for each sub-task: what files, what tests, what edge cases.
> 2. Wait for my approval.
> 3. Execute one sub-task at a time. Commit after each. Push at logical checkpoints.
> 4. After each sub-task: run `pnpm typecheck`, `pnpm --filter @commonpub/layer test`, verify both green before next.
>
> ## Hard rules
>
> - **No AI attribution** in any commit, PR, or git artifact (`Co-Authored-By`, `Signed-off-by`, "Generated with X", etc).
> - **`pnpm publish:layer`** for layer publishes — never `npm publish`.
> - **Poll `pnpm view`** between dependent publishes.
> - **Caret semver on 0.x.y** excludes minor bumps — manually edit consumer `package.json`.
> - **Pre-push hook** runs `pnpm typecheck` automatically. `SKIP_SIMPLE_GIT_HOOKS=1 git push` only when intentionally bypassing.
> - **NEVER trust `gh run list`** for prod deploys — always curl `/api/health` after.
> - **Don't duplicate existing components** — read `feedback-reuse-existing-components` if you're unclear what this means.
> - **Test-driven** — write tests alongside (or before) the code. Don't ship untested.
> - **var(--*) only** for any new component styles.
> - **WCAG 2.1 AA** on every interactive element. Phase 3d will tighten this, but don't ship 3a code with obvious a11y gaps (button without aria-label, click handler without keyboard equivalent, etc).
> - **Editor is admin-only** — gate `/admin/layouts/*` pages on `requireFeature('admin')` + `requireFeature('layoutEngine')`. The catch-all middleware in `layers/base/middleware/feature-gate.global.ts` already handles `/admin/*` for the admin flag; add the layoutEngine gate inline in the page setup.
> - **Don't write Section*.vue files.** Use the section registry's existing entries. If you need to add a new section type, point it at an existing Block*View or Homepage X.vue component via propMap.
> - **Plan first, execute after approval.** This is a multi-session phase. Don't try to ship all of Phase 3 in one session.
> - **Bundle size matters** — editor is admin-only, lazy-load the new libraries behind the `/admin/layouts` route (Nuxt dynamic import OR async component).
>
> ## Standing context
>
> - **Branch**: main. Commit + push only when explicitly authorized; main pushes trigger commonpub.io auto-deploy.
> - **Editor is BEHIND `features.layoutEngine`** — flag is currently ON for commonpub.io. heatsync + deveco have it OFF (dormant infrastructure).
> - **commonpub.io homepage layout** exists in the `layouts` table (route '/'). The editor will edit IT plus future custom-page layouts.
> - **Editor pages live in `layers/base/pages/admin/layouts/`** — Nuxt auto-discovers. Existing `/admin/*` pages are the pattern to follow (look at `layers/base/pages/admin/index.vue` etc).
> - **Libraries installed**: `grid-layout-plus@1.1.1` (12-col grid drag/resize) + `@vue-dnd-kit/core@2.4.6` (palette → canvas drag with keyboard a11y). FormKit deferred to Phase 3e.
>
> ## What "thorough and careful" means here
>
> - Don't ship a 3a deliverable until ALL sub-tasks (3a.1-3a.8) are complete AND verified live on commonpub.io's `/admin/layouts/[id]` page.
> - Each sub-task: small commit. Push at the end of 3a.4 (page-meta form) and at the end of 3a.8 (full Phase 3a wrap).
> - Test BEFORE pushing. Pre-push hook runs typecheck but you should also run `pnpm --filter @commonpub/layer test` locally.
> - When you DON'T know how a primitive (grid-layout-plus or @vue-dnd-kit/core) works, READ ITS DOCS via WebFetch first. Don't guess at the API and ship.
> - When you make ANY visible change to the live homepage, verify with `curl -sS https://commonpub.io/ | grep -oE ...` BEFORE moving on. Don't trust the deploy succeeded just because gh says "success".
> - If you find another duplicate-component mistake or architectural issue: STOP, surface it to me, don't fix silently. We've already paid the price for me silently making bad calls in session 158-9.
>
> ## End state of session 160
>
> | Site | Health | Layer | Layout-engine state |
> |---|---|---|---|
> | commonpub.io | ✓ 200 | workspace `main` (df60657 latest) | LayoutSlot serving homepage via existing HomepageX components (Stage E). 5 sections in layout `e3a1acee`. Hero customizability wired (config.customTitle/Subtitle/eyebrow/ctas with hardcoded fallbacks). |
> | heatsynclabs.io | ✓ 200 | npm 0.24.0 | DORMANT — flag off, legacy renderer |
> | deveco.io | ✓ 200 | npm 0.24.0 | DORMANT — flag off, legacy renderer |
>
> All tests pass: layer 183, server 1122, repo 3,500+. 26/26 typecheck.
>
> First action: confirm you've read everything above (one paragraph max), then propose the detailed plan for Phase 3a.1 (LayoutSlot `:editable` prop + selection overlay). Wait for my OK before writing code.

---

That's the prompt. Copy from the first `>` line through the last `>` line (the "Wait for my OK before writing code" line) and paste as the new session's opening message.

## Quick context if you want to skim before pasting

- Last session: completed Stage E (section-renderer unification — 16 duplicate Section*.vue files deleted), wired hero customizability, decided on hybrid library approach, installed grid-layout-plus + @vue-dnd-kit/core.
- Next major work: Phase 3 editor UI. Estimated 5-6 sessions total with the hybrid; was 7 sessions building from scratch.
- All 3 prod sites healthy. commonpub.io homepage rendering correctly.
- Plan tracker at `docs/plans/phase-3-editor.md`. Living doc — update as each phase ships.
