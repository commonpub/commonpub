/**
 * Built-in section definition: hero.
 *
 * Stage E.4 — reuses the existing HeroSection which handles
 * contest-aware swap + dismiss button + hardcoded fallback copy
 * ("Build. Document. Share.").
 *
 * Schema (incl. URL_LINK_STRICT guard on CTA hrefs) lives in
 * `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { heroConfigSchema, type HeroConfig } from '@commonpub/schema';
import HeroSection from '../../components/homepage/HeroSection.vue';

export const heroSection: SectionDefinition<HeroConfig> = {
  type: 'hero',
  name: 'Hero',
  description: 'Top-of-page banner (uses HeroSection, contest-aware)',
  icon: 'fa-bullhorn',
  category: 'layout',
  status: 'stable',
  configSchema: heroConfigSchema,
  defaultConfig: { variant: 'default', customTitle: '', customSubtitle: '', ctas: [] },
  schemaVersion: 1,
  component: HeroSection,
  // HeroSection takes { config: HomepageSectionConfig }
  propMap: ({ config }) => ({ config }),
  minColSpan: 12,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: false,
};
