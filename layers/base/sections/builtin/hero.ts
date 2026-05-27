/**
 * Built-in section definition: hero.
 *
 * Stage E.4 — reuses the existing HeroSection (`layers/base/components/
 * homepage/HeroSection.vue`) which already handles contest-aware swap +
 * dismiss button + hardcoded fallback copy ("Build. Document. Share.").
 *
 * Config matches HomepageSectionConfig — the legacy homepage section
 * schema (variant + customTitle/customSubtitle + ctas optional). When
 * the operator hasn't customised anything, HeroSection renders its
 * hardcoded defaults; legacy admin form's customTitle/customSubtitle
 * fields override.
 *
 * URL guard kept on CTA hrefs — same threat model (admin-set href
 * renders to all visitors).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import HeroSection from '../../components/homepage/HeroSection.vue';

const SAFE_LINK_URL = /^(?:$|https?:\/\/|\/|#|mailto:|tel:)/i;

const ctaSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(2048).regex(SAFE_LINK_URL, {
    message: 'href must be http(s), relative (/), hash (#), mailto:, or tel:',
  }),
  variant: z.enum(['primary', 'secondary']).default('primary'),
});

const configSchema = z.object({
  variant: z.enum(['default', 'compact', 'centered']).default('default'),
  customTitle: z.string().max(255).default(''),
  customSubtitle: z.string().max(500).default(''),
  ctas: z.array(ctaSchema).max(2).default([]),
});

export const heroSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'hero',
  name: 'Hero',
  description: 'Top-of-page banner (uses HeroSection — contest-aware)',
  icon: 'fa-bullhorn',
  category: 'layout',
  status: 'stable',
  configSchema,
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
