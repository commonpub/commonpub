# Session 155 — Theme editor publish runbook

**Purpose**: take the theme editor from "85% ship-trustable in main" to "live on all 3 instances". One concrete checklist; no surprises.

**Prereqs**:
- All session 154 + 155 work committed to main (see §1)
- Logged into npm with publish rights for `@commonpub/*` (run `pnpm publish:layer --dry-run` to verify)
- `gh` CLI authenticated for deeds against `commonpub/commonpub`, `ossuary-projects/deveco-io`, `heatsynclabs/heatsynclabs-io`

## 1. Commit prep (run locally before publish)

**Standing rule reminders apply** (per CLAUDE.md + memory `feedback_no_coauthor`):
- No `Co-Authored-By: Claude`, `🤖 Generated with Claude Code`, or any other AI attribution in commit messages or PR bodies.
- Atomic commits — one logical change per commit. Squash on merge.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).

Suggested commit sequence (one PR or per-area branches as you prefer):

```bash
# Schema additions
git add packages/schema/
git commit -m "feat(schema): custom theme + layout engine validators

- Adds customThemeSchema, themeExportSchema, customThemeUpdateSchema
- Adds layoutSchema (scope/zones/rows/sections), layoutCreateSchema
- Adds layout.ts Drizzle tables: layouts, layout_rows, layout_sections, layout_versions
- Migration 0005_layout_engine.sql (count 5 -> 6)
- 41 new validator tests"

# Config + UI changes
git add packages/config/ packages/ui/
git commit -m "feat(ui,config): theme editor primitives + section registry

- @commonpub/config: optional themes[] RegisteredTheme for layer apps
- @commonpub/ui: split theme.ts into theme.ts + tokens.ts
- @commonpub/ui: TOKEN_SPECS registry, tokensByGroup, tokensToCss, previewFromTokens
- @commonpub/ui: SectionRegistry class for layout engine (Phase 1)
- 39 new tests across both packages"

# Server changes
git add packages/server/
git commit -m "feat(server): custom theme CRUD + Phase 0.5 test gap fill

- CustomThemeRecord + listCustomThemes/getCustomTheme/saveCustomTheme/deleteCustomTheme
- CUSTOM_THEME_PREFIX + parseCustomThemeId + customThemeDataAttr
- resolveTheme accepts cpub-custom-* IDs
- 39 new tests: 10 custom-themes CRUD, 14 homepage, 15 navigation"

# Layer changes (biggest commit)
git add layers/base/
git commit -m "feat(layer): admin theme editor + custom theme SSR injection

- /admin/theme rebuilt: family-grouped picker across built-in + registered + custom
- /admin/theme/edit/[id] new full-page editor (split-pane, token groups, preview scenes)
- AdminTheme* component family (8 components)
- useThemeAdmin composable + themeIds/themeDiscovery/themeIO utils
- Server middleware injects custom-theme tokens as inline <style id=cpub-theme-inline>
- API: GET/POST/PUT/DELETE /api/admin/themes + /discover
- 10 expanded HomepageSectionRenderer tests
- .gitignore: anchor /theme/ to layer root"

# Docs
git add docs/
git commit -m "docs: layout-engine plan + theme editor reference + session logs

- docs/plans/layout-and-pages.md (1342 lines, with drag-drop/mobile/a11y core)
- docs/reference/guides/theme-editor.md
- docs/sessions/154-theme-editor.md
- docs/sessions/155-layout-foundation.md
- docs/sessions/155-publish-runbook-theme.md (this file)
- codebase-analysis updates: 03 server modules, 04 API routes, 05 layer pages,
                             09 gotchas, 11 stats, 13 architecture patterns"

# E2E
git add apps/reference/e2e/theme.spec.ts
git commit -m "test(e2e): theme system Playwright coverage

- SSR HTML pin (data-theme absent on base, present on dark)
- Inline <style id=cpub-theme-inline> absent when no custom tokens
- Admin pages render at all routes (auth-gated)
- API surface refuses anonymous calls (401/403, not 404 or 200)
- Regression guards: no duplicate inline-style tags, XSS cookie escape"
```

## 2. Version bumps (semver)

These are all **MINOR** bumps — additive APIs, no breaking changes (the @commonpub/ui split has back-compat re-exports preserving every public symbol):

| Package | Current | New | Reason |
|---|---|---|---|
| `@commonpub/schema` | 0.16.0 | **0.17.0** | New validators: customTheme* + layout* + section registry types. New Drizzle tables. |
| `@commonpub/config` | 0.13.0 | **0.14.0** | Optional `themes: RegisteredTheme[]` added to `CommonPubConfig`. |
| `@commonpub/ui` | 0.8.5 | **0.9.0** | New: SectionRegistry, TOKEN_SPECS, tokensToCss, previewFromTokens, theme/tokens split (back-compat). New peerDep: zod. |
| `@commonpub/server` | 2.55.0 | **2.56.0** | Custom theme CRUD: listCustomThemes/saveCustomTheme/deleteCustomTheme + helpers. |
| `@commonpub/layer` | 0.21.22 | **0.22.0** | Admin theme editor UI + API + middleware changes. |

**Do NOT bump**: `@commonpub/auth`, `infra`, `editor`, `explainer`, `learning`, `protocol`, `docs`, `test-utils` — none of them changed.

Bump command (in this order — pnpm publish honors dependency graph):

```bash
# Use pnpm's recursive bump; or hand-edit each package.json then commit.
# DO NOT use `npm publish` — must be `pnpm publish` per memory `feedback_pnpm_publish_layer`.

# Hand-edit pattern:
for pkg in schema config ui server; do
  cd packages/$pkg
  # bump version manually in package.json or via npm version --no-git-tag-version
  cd -
done
# layer is special — see scripts/bundle-theme.mjs
```

After bumps, run one round of:

```bash
pnpm install   # propagates workspace deps
pnpm test
pnpm exec vue-tsc --noEmit --project apps/reference
```

Expected counts (from session 155 verification):
- schema: 413 passed
- config: 23 passed
- ui: 256 passed
- server: 1003 passed (with the new homepage + nav suites)
- layer: 95 passed
- reference typecheck: clean

## 3. Publish — strict dependency order

```bash
# 0. Build everything fresh
pnpm -r build

# 1. Schema (no deps inside the namespace beyond what's already published)
pnpm --filter @commonpub/schema publish

# 2. Config (depends on nothing internal)
pnpm --filter @commonpub/config publish

# 3. UI (depends on nothing internal; peerDep zod is consumer's concern)
pnpm --filter @commonpub/ui publish

# 4. Server (depends on schema)
pnpm --filter @commonpub/server publish

# 5. Layer (depends on all of the above) — ALWAYS via pnpm publish:layer
#    Per memory `feedback_pnpm_publish_layer`: npm publish leaves workspace:*
#    literal in the tarball → consumer install fails with ERR_PNPM_WORKSPACE_PKG_NOT_FOUND.
pnpm --filter @commonpub/layer run publish:layer
# Or if that script doesn't exist, cd packages-equivalent and `pnpm publish` from inside.
```

**After each publish, poll npm view before moving to the next** (memory `feedback_npm_propagation_lag`):

```bash
pnpm view @commonpub/schema version    # should match what you just published
```

Don't pipe publish-dependent install through grep in an `&&` chain — it masks failures + commits stale lockfiles.

## 4. Deploy to the three instances

```bash
# commonpub.io — auto-deploys from main, but only after the layer bump lands in its package.json
cd ../commonpub-io  # whatever the actual repo path is — adjust
pnpm update @commonpub/layer
git commit -am "chore: bump @commonpub/layer 0.21.22 -> 0.22.0"
git push  # triggers Deploy Production workflow

# deveco.io
cd ../deveco-io
pnpm update @commonpub/layer
git commit -am "chore: bump @commonpub/layer 0.21.22 -> 0.22.0"
git push

# heatsynclabs.io
cd ../heatsynclabs-io
pnpm update @commonpub/layer
git commit -am "chore: bump @commonpub/layer 0.21.22 -> 0.22.0"
git push
```

Watch workflows:
```bash
gh run watch --repo commonpub/commonpub-io
gh run watch --repo ossuary-projects/deveco-io
gh run watch --repo heatsynclabs/heatsynclabs-io
```

## 5. Migration 0005 — DO NOT RUN YET

The new migration adds 4 empty tables (`layouts`, `layout_rows`, `layout_sections`, `layout_versions`). They sit unused until Phase 1 ships the server CRUD + `<LayoutSlot>` consumer (next session). Running the migration alone is safe (empty tables) but provides no value.

**Decision**: defer migration deploy until Phase 1 is also publish-ready. That way the migration + first consumer ship together, reducing the window where the schema exists but isn't exercised.

If you'd rather ship the migration now anyway, the auto-deploy on commonpub.io / deveco.io / heatsynclabs.io will pick it up via the existing `db-migrate.mjs` script. Just be aware that the drizzle-kit meta snapshot for 0005 was **not** regenerated this session (see handoff §gotchas 1b); regenerate before deploy:

```bash
cd packages/schema
pnpm exec drizzle-kit generate   # may produce a 0006 if the schema diff includes more than expected
# If it produces 0006, reconcile: compare against my hand-written 0005, fix the diff.
# Hand-written SQL wins (it's the deploy source); regenerate meta from it.
```

## 6. Smoke test on each live instance

Per-instance manual checklist (~5 min each):

- [ ] `/admin/theme` loads — 5 built-in family cards visible
- [ ] If the instance has a `:root` CSS override (deveco), the "Capture current site theme" banner appears with non-zero count
- [ ] Click "Capture" — editor opens at `/admin/theme/edit/__new` with detected tokens populated
- [ ] Change an accent color via the inspector — preview pane updates immediately
- [ ] Toggle scene picker (Components / Article / Admin) — each renders
- [ ] Toggle Light/Dark mode — preview swaps
- [ ] Save — toast confirms, theme appears in /admin/theme as a custom card
- [ ] "Save & apply" on a different theme — homepage in another tab shows it on refresh
- [ ] Export — downloads `<slug>.cpub-theme.json`
- [ ] Import the file you just exported — auto-suffix on id collision
- [ ] Token overrides panel: add `accent: #ff6600` → save → next homepage load uses it
- [ ] Delete the active custom theme — toast notes default reset to Classic, homepage on next load reverts

Then a quick non-admin pass:

- [ ] Visit `/` as anonymous — page loads
- [ ] View source: `<html data-theme>` present iff non-base, `<style id="cpub-theme-inline">` present iff custom theme or token overrides active
- [ ] Toggle dark mode via the topbar → cookie set → reload → SSR HTML has `data-theme="dark"`

## 7. Post-deploy verification

```bash
# Health checks
curl -s https://commonpub.io/api/health | jq .
curl -s https://deveco.io/api/health | jq .
curl -s https://heatsynclabs.io/api/health | jq .

# Theme inline-style on each (deveco should have one since its theme uses :root)
curl -s https://deveco.io/ | grep -o 'data-theme="[^"]*"' | head -3
curl -s https://deveco.io/ | grep -c 'id="cpub-theme-inline"'  # 0 or 1
```

## 8. Rollback plan

If anything's off:
1. Revert the `@commonpub/layer` bump in each consumer site's `package.json`
2. `git revert HEAD` on the consumer site repo
3. Re-deploy (the same auto-deploy workflow handles the revert)
4. Custom themes saved in the DB during the brief on-window stay — they're harmless (the old renderer ignores them); when re-shipped, they're recoverable

The schema additions are non-destructive (only ADD COLUMN / CREATE TABLE), so even an aggressive revert doesn't need a down-migration.

## 9. Update session log + memory after ship

After the dust settles:
- Update `docs/sessions/156-theme-shipped.md` with: published versions, deployed instances, verification timestamps
- Update memory `project_session_154_theme_editor.md`: mark as **published** + add the post-ship lessons learned
- Update `codebase-analysis/11-codebase-stats.md` Versions row

## Open items NOT in this runbook

- **Phase 1 layout engine continuation** — see `docs/sessions/155-layout-foundation.md` for the next-up work
- **Layout engine migration 0005** — deferred, see §5 above
- **drizzle-kit meta regen** — required before §5 actually runs
- **E2E auth fixtures** — apps/reference/e2e currently lacks login fixtures; the new theme.spec.ts pins what we can without auth, but full editor click-through needs them (Phase 0.5 part 3, future session)
