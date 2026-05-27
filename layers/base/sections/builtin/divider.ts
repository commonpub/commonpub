/**
 * Built-in section definition: divider.
 *
 * Stage E.1 — reuses BlockDividerView (extended to accept optional
 * variant + spacingY on its `content` prop). Existing block callers
 * (BlockContentRenderer) pass nothing and get the legacy 36px solid line.
 * Layout-engine callers pass `{variant, spacingY}` via the propMap below
 * to customise.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockDividerView from '../../components/blocks/BlockDividerView.vue';

const configSchema = z.object({
  variant: z.enum(['solid', 'dashed', 'dotted', 'accent']).default('solid'),
  spacingY: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
});

export const dividerSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'divider',
  name: 'Divider',
  description: 'Horizontal rule with style + spacing (uses BlockDividerView)',
  icon: 'fa-minus',
  category: 'layout',
  status: 'stable',
  configSchema,
  defaultConfig: { variant: 'solid', spacingY: 'md' },
  schemaVersion: 1,
  component: BlockDividerView,
  propMap: ({ config }) => ({ content: config }),
  // Dividers are always full-width; resize is meaningless for a 1px line
  minColSpan: 12,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: false,
};
