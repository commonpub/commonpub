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
import { editorialSection } from './builtin/editorial';
import { statsSection } from './builtin/stats';
import { hubsSection } from './builtin/hubs';
import { contestsSection } from './builtin/contests';
import { learningSection } from './builtin/learning';
import { customHtmlSection } from './builtin/custom-html';
import { ctaSection } from './builtin/cta';
import { markdownSection } from './builtin/markdown';
import { gallerySection } from './builtin/gallery';
import { videoSection } from './builtin/video';
import { embedSection } from './builtin/embed';

// Singleton — registered once at module load. Vue/Nuxt's setup() runs
// per-component, but module load is once per app process. Safe.
const registry = new SectionRegistry();

// --- Built-in registrations -----------------------------------------------
// Phase 1c full catalog (session 159): divider (proof-of-life) + 11
// sections covering the four leading categories — layout (hero,
// divider), content (heading, paragraph, image, custom-html), and data
// (content-feed, editorial, stats, hubs, contests, learning).
//
// With the addition of editorial / stats / hubs / contests / learning /
// custom-html this session, every section type the legacy
// `homepage.sections` JSON dispatches to (HomepageSectionRenderer.vue)
// is now representable as a registered section — unblocking the real
// legacy-homepage migration (Phase 1c step 3 in the session-158 handoff).
//
// Phase 6b will add the remaining 18 types (gallery, video, embed,
// spacer, cta, featured-content, content-card, contest-list, hub-list,
// event-list, member-list, stats-grid, contact-form, newsletter,
// announcement, markdown, iframe, content-grid alias). See
// docs/plans/layout-and-pages.md §3.4.
registry.register(dividerSection);
registry.register(heroSection);
registry.register(headingSection);
registry.register(paragraphSection);
registry.register(imageSection);
registry.register(contentFeedSection);
registry.register(editorialSection);
registry.register(statsSection);
registry.register(hubsSection);
registry.register(contestsSection);
registry.register(learningSection);
registry.register(customHtmlSection);
// Phase 6b additions (session 159)
registry.register(ctaSection);
registry.register(markdownSection);
registry.register(gallerySection);
registry.register(videoSection);
registry.register(embedSection);

/**
 * Read-only accessor — the layer's standard pattern for shared state.
 * Use this everywhere instead of importing `registry` directly so we
 * can swap to a Nuxt-provided instance in Phase 9 (when thin apps
 * register their own sections via `commonpub.config.ts`).
 */
export function useSectionRegistry(): SectionRegistry {
  return registry;
}
