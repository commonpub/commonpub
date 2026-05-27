/**
 * Layer-level section registry — the Vue runtime catalog that
 * `<LayoutSlot>` consults to render a section by its `type` slug.
 *
 * `SectionRegistry` (the class) lives in `@commonpub/ui` as Vue-aware
 * types. This file:
 *   1. Creates ONE shared registry instance per app process
 *   2. Calls `register()` for every built-in section type the layer ships
 *      (see `./builtin/*` — Phase 1c adds the actual section files)
 *   3. Exports `useSectionRegistry()` so consumers (LayoutSlot + the
 *      admin editor's palette) can read it without circular imports
 *
 * **Same instance on server + client.** Vue plugins instantiate at
 * setup time; section registration is synchronous + idempotent (the
 * `register()` method throws on duplicate slugs — fail-fast).
 *
 * Phase 1c next-session additions land in `./builtin/`:
 *   hero.ts, heading.ts, paragraph.ts, image.ts, contentFeed.ts
 * Each file declares one `SectionDefinition`, the index here imports +
 * registers it. To add a custom section in a thin layer app: same
 * pattern — drop a file in your own `sections/builtin/` and import +
 * register here.
 */
import { SectionRegistry } from '@commonpub/ui';
import { dividerSection } from './builtin/divider';

// Singleton — registered once at module load. Vue/Nuxt's setup() runs
// per-component, but module load is once per app process. Safe.
const registry = new SectionRegistry();

// --- Built-in registrations -----------------------------------------------
// Phase 1c will add: hero, heading, paragraph, image, content-feed.
// For now, ONE proof-of-life section (divider) validates the full chain
// from registry → LayoutSlot → rendered DOM without complex Zod schemas.
registry.register(dividerSection);

/**
 * Read-only accessor — the layer's standard pattern for shared state.
 * Use this everywhere instead of importing `registry` directly so we
 * can swap to a Nuxt-provided instance in Phase 9 (when thin apps
 * register their own sections via `commonpub.config.ts`).
 */
export function useSectionRegistry(): SectionRegistry {
  return registry;
}
