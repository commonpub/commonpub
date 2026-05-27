/**
 * Layer-level section registry — the Vue runtime catalog that
 * `<LayoutSlot>` consults to render a section by its `type` slug.
 *
 * `SectionRegistry` (the class) lives in `@commonpub/ui` as Vue-aware
 * types. This file:
 *   1. Creates ONE shared registry instance per app process
 *   2. Calls `register()` for every built-in section type the layer ships
 *   3. Exports `useSectionRegistry()` so consumers (LayoutSlot + the
 *      admin editor's palette) can read it without circular imports
 *
 * **Same instance on server + client.** Vue plugins instantiate at
 * setup time; section registration is synchronous + idempotent (the
 * `register()` method throws on duplicate slugs — fail-fast).
 *
 * Adding a built-in section is THREE files (see any of `./builtin/*` for
 * the template):
 *   1. `./builtin/{type}.ts` — Zod schema + SectionDefinition export
 *   2. `../components/sections/Section{PascalType}.vue` — renderer
 *   3. One `registry.register(...)` line here
 *
 * To add a CUSTOM section from a thin layer app (Phase 9 — not yet
 * shipped): same pattern, registered from your `commonpub.config.ts`.
 */
import { SectionRegistry } from '@commonpub/ui';
import { dividerSection } from './builtin/divider';
import { headingSection } from './builtin/heading';
import { paragraphSection } from './builtin/paragraph';
import { imageSection } from './builtin/image';
import { heroSection } from './builtin/hero';
import { contentFeedSection } from './builtin/content-feed';

// Singleton — registered once at module load. Vue/Nuxt's setup() runs
// per-component, but module load is once per app process. Safe.
const registry = new SectionRegistry();

// --- Built-in registrations -----------------------------------------------
// Phase 1c starter catalog: divider (proof-of-life) + 5 sections covering
// the four leading categories — layout (hero, divider), content (heading,
// paragraph, image), and data (content-feed).
//
// Phase 6b adds the remaining 20 types (gallery, video, embed, spacer,
// cta, featured-content, content-card, contest-list, hub-list, event-list,
// member-list, stats-grid, contact-form, newsletter, announcement,
// markdown, custom-html, iframe, editorial). See docs/plans/layout-and-pages.md §3.4.
registry.register(dividerSection);
registry.register(heroSection);
registry.register(headingSection);
registry.register(paragraphSection);
registry.register(imageSection);
registry.register(contentFeedSection);

/**
 * Read-only accessor — the layer's standard pattern for shared state.
 * Use this everywhere instead of importing `registry` directly so we
 * can swap to a Nuxt-provided instance in Phase 9 (when thin apps
 * register their own sections via `commonpub.config.ts`).
 */
export function useSectionRegistry(): SectionRegistry {
  return registry;
}
