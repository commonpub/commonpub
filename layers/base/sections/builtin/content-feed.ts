/**
 * Built-in section definition: content-feed.
 *
 * Phase 1c starter and the first DATA section. Fetches `/api/content`
 * with config-driven filters and renders a responsive grid of
 * `<ContentCard>`s.
 *
 * Config fields split into server-filter (forwarded to `/api/content`)
 * and render-only (`heading`, `columns`). Keeping the contract explicit
 * here matches the auto-form mapping in Phase 3e and stops accidental
 * pass-through of admin-only filter values.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionContentFeed from '../../components/sections/SectionContentFeed.vue';

const configSchema = z.object({
  heading: z.string().max(120).default(''),
  contentType: z.string().max(64).default(''),
  sort: z.enum(['recent', 'popular', 'featured', 'editorial']).default('recent'),
  limit: z.number().int().min(1).max(24).default(6),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(3),
  tag: z.string().max(64).default(''),
  featured: z.boolean().default(false),
});

export const contentFeedSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'content-feed',
  name: 'Content feed',
  description: 'Grid of content cards filtered by type / tag / sort',
  icon: 'fa-stream',
  category: 'data',
  status: 'stable',
  configSchema,
  defaultConfig: {
    heading: '',
    contentType: '',
    sort: 'recent',
    limit: 6,
    columns: 3,
    tag: '',
    featured: false,
  },
  schemaVersion: 1,
  component: SectionContentFeed,
  // Multi-column grid collapses to less than half-width — readability + the
  // card aspect ratio break down below 6
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
