/**
 * Built-in section definition: content-feed.
 *
 * Stage E.4 — reuses the existing ContentGridSection which has tabs
 * (For You / Latest / Following / per-type) + the content grid +
 * pagination via Load More.
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { contentFeedConfigSchema, type ContentFeedConfig } from '@commonpub/schema';
import ContentGridSection from '../../components/homepage/ContentGridSection.vue';

export const contentFeedSection: SectionDefinition<ContentFeedConfig> = {
  type: 'content-feed',
  name: 'Content feed',
  description: 'Filterable content grid with tabs + load more (uses ContentGridSection)',
  icon: 'fa-stream',
  category: 'data',
  status: 'stable',
  configSchema: contentFeedConfigSchema,
  defaultConfig: {
    heading: '',
    contentType: '',
    sort: 'recent',
    limit: 12,
    columns: 2,
    categorySlug: '',
  },
  schemaVersion: 1,
  component: ContentGridSection,
  // ContentGridSection takes { config: HomepageSectionConfig; title?: string }
  propMap: ({ config }) => ({
    config,
    title: (config.heading as string | undefined) ?? '',
  }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
