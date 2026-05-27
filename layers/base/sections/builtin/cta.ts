/**
 * Built-in section definition: cta — call-to-action panel.
 *
 * Phase 6b addition (session 159). Smaller than hero — typically used
 * mid-page to break up a long content area with a focused next-action.
 *
 * Config: heading + body + up to 3 buttons. Buttons each have
 * label/href/variant (primary/secondary/ghost). URL guard same shape
 * as hero CTAs (rejects javascript:, data:, vbscript:, file:).
 *
 * Variants:
 *   default  → boxed panel with subtle border
 *   contrast → high-contrast inverse (accent bg, contrast text)
 *   minimal  → no box, centered text + buttons
 *
 * **Stage E.3 audit (session 159)**: kept as a section-specific
 * SectionCta.vue renderer because the closest existing component
 * (BlockCalloutView, an info/tip/warning notice with icon + label)
 * doesn't support action buttons — the core CTA affordance. Extending
 * BlockCalloutView would force two unrelated UI patterns through one
 * renderer. Genuinely new component, not a duplicate.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionCta from '../../components/sections/SectionCta.vue';

// Mirrors hero.ts's SAFE_LINK_URL — same threat model (admin-set href
// renders to all visitors; Vue :href binding doesn't sanitize).
const SAFE_LINK_URL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

const buttonSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(2048).regex(SAFE_LINK_URL, {
    message: 'href must be http(s), relative (/), hash (#), mailto:, or tel:',
  }),
  variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
});

const configSchema = z.object({
  variant: z.enum(['default', 'contrast', 'minimal']).default('default'),
  heading: z.string().min(1).max(240).default('Take the next step'),
  body: z.string().max(800).default(''),
  // Capped at 3 — beyond that the CTA panel reads as a menu
  buttons: z.array(buttonSchema).max(3).default([]),
  align: z.enum(['left', 'center']).default('left'),
});

export const ctaSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'cta',
  name: 'Call to Action',
  description: 'Heading + body + up to 3 buttons. Mid-page action panel.',
  icon: 'fa-arrow-right',
  category: 'content',
  status: 'stable',
  configSchema,
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
