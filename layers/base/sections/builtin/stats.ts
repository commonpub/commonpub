/**
 * Built-in section definition: stats.
 *
 * Stage E.4 — reuses the existing StatsSection (`layers/base/
 * components/homepage/StatsSection.vue`) which fetches `/api/stats`
 * + renders the Projects/Posts/Members/Hubs sidebar card. StatsSection
 * takes no props (reads useFeatures internally for the hubs gate).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import StatsSection from '../../components/homepage/StatsSection.vue';

// Non-strict — admin tooling or migrations may pass extra fields
// (e.g., legacy migration adds `heading: 'Platform Stats'`); they're
// ignored since StatsSection takes no props.
const configSchema = z.object({});

export const statsSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'stats',
  name: 'Platform stats',
  description: 'Projects/Posts/Members/Hubs sidebar card (uses StatsSection)',
  icon: 'fa-chart-simple',
  category: 'data',
  status: 'stable',
  configSchema,
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
