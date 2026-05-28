/**
 * Built-in section definition: heading.
 *
 * Stage E.1 (session 159) — reuses the existing `BlockHeadingView`
 * renderer (`layers/base/components/blocks/BlockHeadingView.vue`)
 * instead of a parallel `SectionHeading.vue`.
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 * See `feedback-reuse-existing-components` memory + Stage E plan.
 */
import type { SectionDefinition } from '@commonpub/ui';
import { headingConfigSchema, type HeadingConfig } from '@commonpub/schema';
import BlockHeadingView from '../../components/blocks/BlockHeadingView.vue';

export const headingSection: SectionDefinition<HeadingConfig> = {
  type: 'heading',
  name: 'Heading',
  description: 'Single h1–h6 heading (uses BlockHeadingView)',
  icon: 'fa-heading',
  category: 'content',
  status: 'stable',
  configSchema: headingConfigSchema,
  defaultConfig: { level: 2, text: 'Section heading' },
  schemaVersion: 1,
  component: BlockHeadingView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
