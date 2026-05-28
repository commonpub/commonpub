/**
 * Built-in section definition: cta — call-to-action panel.
 *
 * Phase 6b addition (session 159). Smaller than hero — typically used
 * mid-page to break up a long content area with a focused next-action.
 *
 * Config: heading + body + up to 3 buttons. Buttons each have
 * label/href/variant (primary/secondary/ghost). URL guard rejects
 * javascript:, data:, vbscript:, file:.
 *
 * **Stage E.3 audit (session 159)**: kept as a section-specific
 * SectionCta.vue renderer because the closest existing component
 * (BlockCalloutView, an info/tip/warning notice with icon + label)
 * doesn't support action buttons. Extending BlockCalloutView would
 * force two unrelated UI patterns through one renderer.
 *
 * Schema (incl. button URL guard) lives in `@commonpub/schema/sectionConfigs`
 * (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { ctaConfigSchema, type CtaConfig } from '@commonpub/schema';
import SectionCta from '../../components/sections/SectionCta.vue';

export const ctaSection: SectionDefinition<CtaConfig> = {
  type: 'cta',
  name: 'Call to Action',
  description: 'Heading + body + up to 3 buttons. Mid-page action panel.',
  icon: 'fa-arrow-right',
  category: 'content',
  status: 'stable',
  configSchema: ctaConfigSchema,
  defaultConfig: {
    variant: 'default',
    heading: 'Take the next step',
    body: '',
    buttons: [],
    align: 'left',
  },
  schemaVersion: 1,
  component: SectionCta,
  // CTA panels read fine at half-width; below that the heading wraps awkwardly
  minColSpan: 4,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
