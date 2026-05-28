/**
 * Built-in section definition: contests.
 *
 * Stage E.4 — reuses the existing ContestsSection (Active Contests
 * sidebar card with `Nd left` countdowns).
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { contestsConfigSchema, type ContestsConfig } from '@commonpub/schema';
import ContestsSection from '../../components/homepage/ContestsSection.vue';

export const contestsSection: SectionDefinition<ContestsConfig> = {
  type: 'contests',
  name: 'Contests',
  description: 'Active contests with deadlines (uses ContestsSection)',
  icon: 'fa-trophy',
  category: 'data',
  status: 'stable',
  featureGate: 'contests',
  configSchema: contestsConfigSchema,
  defaultConfig: { limit: 3 },
  schemaVersion: 1,
  component: ContestsSection,
  propMap: ({ config }) => ({ config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
