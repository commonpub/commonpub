/**
 * Built-in section definition: divider.
 *
 * Phase 1 proof-of-life — the simplest possible registered section.
 * Validates the registry → LayoutSlot → renderer chain without any
 * Zod complexity, content fetches, or admin-only config.
 *
 * Phase 1c adds: hero, heading, paragraph, image, content-feed —
 * each in its own `builtin/{type}.ts` file, registered in
 * `../registry.ts` alongside this one.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionDivider from '../../components/sections/SectionDivider.vue';

const configSchema = z.object({
  variant: z.enum(['solid', 'dashed', 'dotted', 'accent']).default('solid'),
  spacingY: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
});

export const dividerSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'divider',
  name: 'Divider',
  description: 'Horizontal rule with style + spacing options',
  icon: 'fa-minus',
  category: 'layout',
  status: 'stable',
  configSchema,
  defaultConfig: { variant: 'solid', spacingY: 'md' },
  schemaVersion: 1,
  component: SectionDivider,
  // Dividers are always full-width; resize is meaningless for a 1px line
  minColSpan: 12,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: false,
};
