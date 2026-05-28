# Session 161 — Schema-package refactor + per-section validation wired

**Date**: 2026-05-28 (continuation, same calendar day as 161-admin-sidebar-collapse)
**Branch**: `main` (commonpub.io workspace, no npm publishes)
**Trigger**: User picked "Path B — schema-package refactor" from the session 161 fork after the admin sidebar collapse shipped. Closes the deferred R2 P1 from session 160 audit ("admin bypasses URL guards / size caps / sandbox flags on layout writes").
**Driving rule**: CLAUDE.md #11 (TDD) + #14 (research before building — surveyed all 17 builtin files + existing validator + handlers before touching anything) + audit memory [[feedback-editor-security-patterns]] ("per-section configSchema enforcement at API boundary").

## The R2 backstory (one paragraph)

Session 160 round 2 caught that the `layoutCreateSchema` top-level Zod only validated `section.config` as `z.record(z.unknown())` — letting any admin bypass per-section URL guards, array bounds, and enum walls. Round 2 attempted the fix: built `validateSectionConfigs.ts` that pulled the section registry, called `safeParse` on each section's `configSchema`. **Build broke**: the registry transitively imports every `builtin/*.ts`, each of which imports its Vue renderer (`.vue`). Nitro can't bundle `.vue` into the server. R2 rolled back and deferred: "proper fix is move per-section Zod schemas to `@commonpub/schema` (server-safe). Then validator wires without registry, no Vue transitive."

Session 161 is that proper fix.

## What was done

### 1. `packages/schema/src/sectionConfigs.ts` (new — ~210 LOC)

Exports 17 per-section Zod schemas + 4 shared URL regex constants + 17 inferred TS types + the canonical `SECTION_CONFIG_SCHEMAS: Record<string, ZodType>` lookup map.

**Schema parity**: behavior preserved exactly — same `.max()`, `.min()`, `.regex()`, `.default()`, `.enum()` chains as the inline versions they replace. Cross-checked field-by-field against each `builtin/*.ts` during the move.

**Regex consolidation**: 6 inline `SAFE_*_URL` constants across the 17 files were collapsed into 4 named exports based on actual semantics:
- `URL_LINK_STRICT` — anchor-style (http(s), `/`, `#`, `mailto:`, `tel:`) non-empty (paired with `.min(1)`). Used by cta button + hero CTA hrefs.
- `URL_LINK_OR_EMPTY` — same as STRICT but allows empty. (Currently unused since callers all `.min(1)`; kept for future per-feature use.)
- `URL_MEDIA_OR_EMPTY` — http(s), root-relative path, or empty. Used by image src + gallery image src + video url.
- `URL_HTTPS_OR_EMPTY` — strict http(s) only or empty. Used by embed url (relative paths shouldn't apply to remote embeds).

All empty-branches use the explicit `^(?:$|...)` pattern, NOT `^(?:|...)` empty-alternation (which would match any string at position 0 — the bug from `feedback-regex-empty-alternation`).

### 2. `packages/schema/src/__tests__/sectionConfigs.test.ts` (new — 48 `it()` cases, 470 total schema tests post-add)

Covers per-schema:
- Defaults applied when fields omitted
- URL guards: known-bad schemes (`javascript:`, `data:`, `file:`, `vbscript:`, `ftp:`) rejected
- Array bounds (`.max(20)` on gallery, `.max(2)` on hero ctas, `.max(3)` on cta buttons)
- Enum walls (rejects `random` for content-feed sort, `5` for column union, etc)
- Size caps (8000-char paragraph html, 50_000-char custom-html, 100_000-char markdown source)
- Min requirements (heading text non-empty, cta heading non-empty, cta button label non-empty)
- Mailto/tel/anchor href acceptance (hero CTAs)
- `embedConfigSchema` REJECTS root-relative paths (the one URL-guard divergence from media schemas)

Plus a `SECTION_CONFIG_SCHEMAS` map test confirming exactly 17 registered types + every one accepts `{}`.

### 3. 17 × `layers/base/sections/builtin/*.ts` refactored

Each file:
- Dropped `import { z } from 'zod'`
- Added `import { {type}ConfigSchema, type {Type}Config } from '@commonpub/schema'`
- `configSchema,` shorthand → `configSchema: {type}ConfigSchema,`
- `SectionDefinition<z.infer<typeof configSchema>>` → `SectionDefinition<{Type}Config>`
- Inline `const SAFE_*_URL = /.../` constants + helper sub-schemas (e.g. `buttonSchema`) deleted (now in schema package)
- Comment block updated to point at the canonical location

Component imports, type slugs, names, descriptions, icons, categories, statuses, `defaultConfig` literals, `propMap` functions, `minColSpan`/`maxColSpan`/`defaultColSpan`, `resizable`, `featureGate` — all unchanged.

Verified via the existing `sections/__tests__/registry.test.ts` (29 tests) — still passing after each batch.

### 4. `layers/base/server/utils/validateSectionConfigs.ts` re-wired

- Dropped the `registry: SectionRegistry` parameter (single-arg signature now: `validateSectionConfigs(zones)`)
- Imports `SECTION_CONFIG_SCHEMAS` from `@commonpub/schema`
- Schema lookup: `SECTION_CONFIG_SCHEMAS[section.type]` instead of `registry.get(section.type)?.configSchema`
- Same error shape preserved (`{ statusCode: 400, data: { code: 'SECTION_CONFIG_INVALID', sectionErrors: [...] } }`)
- File-level comment expanded to explain why the previous attempt broke + how the move closes it

### 5. `layers/base/server/utils/__tests__/validateSectionConfigs.test.ts` updated

- Dropped `import { useSectionRegistry } from '../../../sections/registry'` (no longer needed — schemas live in the schema package)
- All `validateSectionConfigs(zones, realRegistry)` → `validateSectionConfigs(zones)`
- Added 6 new tests under "per-section enforcement (the actual win)":
  - cta with `javascript:` button href → rejected
  - gallery with 21 images → rejected (`.max(20)`)
  - heading with text > 240 chars → rejected
  - embed with `/local/path` → rejected (strict http(s) only)
  - content-feed with `sort: 'random'` → rejected
  - (plus the original 5 happy/unknown/bulk/position tests, all still passing)

### 6. POST + PUT handlers wired

`layers/base/server/api/admin/layouts/index.post.ts` + `[id].put.ts`:
- Import `validateSectionConfigs` from `../../../utils/validateSectionConfigs`
- After `parseBody(event, layoutCreateSchema)`, before `saveLayout(...)`:
  ```ts
  try {
    validateSectionConfigs(body.zones);
  } catch (err) {
    const e = err as { data?: { code?: string; sectionErrors?: unknown[] } };
    if (e?.data?.code === 'SECTION_CONFIG_INVALID') {
      console.info('cpub.audit.layout.config-rejected', JSON.stringify({
        at: new Date().toISOString(),
        adminId: admin.id,
        layoutId: id ?? null,
        scope: existing?.scope ?? body.scope,
        errorCount: e.data.sectionErrors?.length ?? 0,
      }));
    }
    throw err;
  }
  ```
- PUT handler's old "// NOTE: per-section configSchema enforcement is deferred…" block REMOVED — replaced by the actual wiring.

### 7. Nitro build verified locally (CRITICAL — R2 lesson)

`pnpm --filter @commonpub/reference build` succeeded (72MB output, 21MB gzip). No `.vue`-into-server-bundle errors. The R2 attempt failed this same step — confirming the schema-package move was the right fix.

(One pre-existing local-dev limitation surfaced: missing `@img/sharp-wasm32` optional dep on Mac → nitropack's node-externals plugin ENOENT on realpath. Added it as a root devDep. Pre-existing issue, unrelated to this refactor, but the workaround is worth keeping so future local builds don't repeat the head-scratch.)

### 8. Codebase-analysis updates

- `02-schema-inventory.md` Files block: added `layout.ts` (session 155 — was missing) + `sectionConfigs.ts` (session 161, 17 sections + lookup map)
- `05-layer-pages-components.md`: new "Per-section config validation (session 161)" subsection under the Layout engine block, documenting the audit-log event + the R2 → 161 narrative
- `11-codebase-stats.md`: session 161 deltas block updated to capture both the sidebar work + the schema refactor (test count bumps: schema 431→470, layer 281→287)

## Decisions

- **`SECTION_CONFIG_SCHEMAS` as the lookup map** (instead of named-import per schema in the validator): one source of truth for the type→schema mapping, sortable + listable. Adding a new section requires the schema export + one map entry — single source of forgetting.
- **4 shared regex constants** (down from 6 inline duplicates): some patterns were identical (gallery/image/video all use `URL_MEDIA_OR_EMPTY`); cta + hero had near-duplicates that I unified into `URL_LINK_STRICT` since both are paired with `.min(1)` making the empty-branch dead. Two genuinely-different patterns kept separate: media (`/` allowed) vs embed (https-only).
- **Re-export from `packages/schema/src/index.ts`** (no separate `./sectionConfigs` subpath export): the main barrel handles it; adding a subpath export would force consumers to choose between `import { dividerConfigSchema } from '@commonpub/schema'` vs `from '@commonpub/schema/sectionConfigs'`. Simpler to keep one path.
- **No schema package version bump** (`0.17.0` stays): the user's standing direction is "no npm publishes; heatsync + deveco stay on layer 0.24.0 dormant". Bumping in source without publishing would risk a future publisher writing `^0.18.0` peer deps that don't resolve. Version reflects what's published; bump when publishing.
- **Audit log emitted from the handler, not the validator**: the validator is composable infrastructure (could be called from other code paths in the future); the audit event is contextual (it knows the `adminId`, `scope`, `layoutId`). Cleaner separation.
- **`cpub.audit.layout.config-rejected`** event name matches the existing `cpub.audit.layout.create` / `cpub.audit.layout.force-save` pattern. Greppable from container logs.
- **Per-section configSchema enforcement is OPT-IN** in spirit (the validator throws on UNKNOWN types too): adding a section that's not in `SECTION_CONFIG_SCHEMAS` means it'll be rejected. Forces the schema-package + registry sync to be intentional. The 5 dormant tests catch the "I added a type but forgot the schema" mistake on the validator's own contract.

## Test counts (touched packages)

| Package | Before | After | Delta |
|---|---|---|---|
| `@commonpub/schema` | 431 | **470** | **+39** |
| `@commonpub/layer` | 281 | **287** | **+6** |
| `@commonpub/server` | 1125+3 skip | 1125+3 skip | unchanged |
| `pnpm typecheck` | 26/26 | 26/26 fresh | unchanged |
| Nitro build (`@commonpub/reference`) | (not run pre-refactor) | ✓ succeeds | first pass |

## Files

**Created**:
- `packages/schema/src/sectionConfigs.ts`
- `packages/schema/src/__tests__/sectionConfigs.test.ts`
- `docs/sessions/161-schema-package-refactor.md` (this file)

**Modified**:
- `packages/schema/src/index.ts` (re-export)
- 17 × `layers/base/sections/builtin/*.ts`
- `layers/base/server/utils/validateSectionConfigs.ts` (registry param removed; schema-map used)
- `layers/base/server/utils/__tests__/validateSectionConfigs.test.ts` (registry import removed; +6 enforcement tests)
- `layers/base/server/api/admin/layouts/index.post.ts` (validator wired + audit log)
- `layers/base/server/api/admin/layouts/[id].put.ts` (validator wired + audit log + stale "deferred" comment removed)
- `codebase-analysis/02-schema-inventory.md`
- `codebase-analysis/05-layer-pages-components.md`
- `codebase-analysis/11-codebase-stats.md`
- Root `package.json` (added `@img/sharp-wasm32` as devDep — local-build workaround)

## Open questions

None.

## Next steps

Back to the session 161 fork:
- ~~Path A — Phase 3b drag-drop~~ still queued (the big 2-session feature)
- ~~Path B — schema-package refactor~~ ✅ DONE this session
- The R2 deferred P1 is now LIVE. POST + PUT to `/api/admin/layouts/*` actually enforce per-section URL guards / array bounds / enum walls. Forensic audit trail in place.

User-reported follow-up (deferred to a future session): **editor canvas squish persists** even with the admin sidebar collapsed — the editor's own 3-column shell (palette / canvas / inspector) eats space, content cards still clip mid-word. Two solution paths in P2 queue: independently-collapsible palette+inspector OR Figma-style viewport zoom controls. Logged in `docs/sessions/161-handoff-prompt.md`.

## Memories captured

None new — this refactor was straightforward (the lessons were already in [[feedback-editor-security-patterns]] + the R2 audit doc). The two new memories from earlier in session 161 ([[feedback-vitest-import-meta-client-undefined]], [[feedback-vi-restoreallmocks-wipes-vifn-impls]]) still apply.
