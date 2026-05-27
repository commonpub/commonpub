/**
 * Built-in section definition: heading.
 *
 * Phase 1c starter — single heading with optional eyebrow + subline.
 * Drives the auto-form via the configSchema (Phase 3e maps Zod kinds to
 * controls; level is a small enum → segmented control).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionHeading from '../../components/sections/SectionHeading.vue';

const configSchema = z.object({
  text: z.string().min(1).max(240).default('Section heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(2),
  align: z.enum(['left', 'center']).default('left'),
  eyebrow: z.string().max(120).default(''),
  subline: z.string().max(480).default(''),
});

export const headingSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'heading',
  name: 'Heading',
  description: 'Single h1–h4 heading with optional eyebrow + subline',
  icon: 'fa-heading',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { text: 'Section heading', level: 2, align: 'left', eyebrow: '', subline: '' },
  schemaVersion: 1,
  component: SectionHeading,
  // Heading reads fine narrow; allow as small as quarter-width
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
