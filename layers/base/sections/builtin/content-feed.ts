/**
 * Built-in section definition: content-feed.
 *
 * Stage E.4 — reuses the existing ContentGridSection (`layers/base/
 * components/homepage/ContentGridSection.vue`) which already has
 * tabs (For You / Latest / Following / per-type) + the content grid
 * + pagination via Load More. (My pre-Stage-E SectionContentFeed
 * reimplemented the pagination; it was already there.)
 *
 * Config matches HomepageSectionConfig (contentType, sort, limit,
 * columns, categorySlug). The optional `title` prop on
 * ContentGridSection comes from the section's heading config.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import ContentGridSection from '../../components/homepage/ContentGridSection.vue';

const configSchema = z.object({
  heading: z.string().max(120).default(''),
  contentType: z.string().max(64).default(''),
  sort: z.enum(['recent', 'popular', 'featured', 'editorial']).default('recent'),
  limit: z.number().int().min(1).max(24).default(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  categorySlug: z.string().max(64).default(''),
});

export const contentFeedSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'content-feed',
  name: 'Content feed',
  description: 'Filterable content grid with tabs + load more (uses ContentGridSection)',
  icon: 'fa-stream',
  category: 'data',
  status: 'stable',
  configSchema,
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
