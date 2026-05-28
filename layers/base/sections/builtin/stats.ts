/**
 * Built-in section definition: stats.
 *
 * Stage E.4 — reuses the existing StatsSection (`layers/base/
 * components/homepage/StatsSection.vue`) which fetches `/api/stats`
 * + renders the Projects/Posts/Members/Hubs sidebar card. StatsSection
 * takes no props (reads useFeatures internally for the hubs gate).
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 * Schema is intentionally `z.object({})` so admin tooling / migrations
 * can pass extra fields (e.g., legacy `heading: 'Platform Stats'`)
 * without rejection; StatsSection ignores them since it takes no props.
 */
import type { SectionDefinition } from '@commonpub/ui';
import { statsConfigSchema, type StatsConfig } from '@commonpub/schema';
import StatsSection from '../../components/homepage/StatsSection.vue';

export const statsSection: SectionDefinition<StatsConfig> = {
  type: 'stats',
  name: 'Platform stats',
  description: 'Projects/Posts/Members/Hubs sidebar card (uses StatsSection)',
  icon: 'fa-chart-simple',
  category: 'data',
  status: 'stable',
  configSchema: statsConfigSchema,
  defaultConfig: {},
  schemaVersion: 1,
  component: StatsSection,
  // StatsSection takes no props — pass empty object
  propMap: () => ({}),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
