/**
 * Built-in section definition: divider.
 *
 * Stage E.1 — reuses BlockDividerView (extended to accept optional
 * variant + spacingY on its `content` prop). Existing block callers
 * (BlockContentRenderer) pass nothing and get the legacy 36px solid line.
 * Layout-engine callers pass `{variant, spacingY}` via the propMap below
 * to customise.
 *
 * Schema moved to `@commonpub/schema/sectionConfigs` in session 161 so
 * the server can validate per-section configs without dragging Vue into
 * the Nitro bundle. See `validateSectionConfigs.ts`.
 */
import type { SectionDefinition } from '@commonpub/ui';
import { dividerConfigSchema, type DividerConfig } from '@commonpub/schema';
import BlockDividerView from '../../components/blocks/BlockDividerView.vue';

export const dividerSection: SectionDefinition<DividerConfig> = {
  type: 'divider',
  name: 'Divider',
  description: 'Horizontal rule with style + spacing (uses BlockDividerView)',
  icon: 'fa-minus',
  category: 'layout',
  status: 'stable',
  configSchema: dividerConfigSchema,
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
