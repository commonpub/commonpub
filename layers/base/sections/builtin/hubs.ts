/**
 * Built-in section definition: hubs.
 *
 * Stage E.4 — reuses the existing HubsSection (Trending Hubs sidebar
 * card with join CTAs).
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { hubsConfigSchema, type HubsConfig } from '@commonpub/schema';
import HubsSection from '../../components/homepage/HubsSection.vue';

export const hubsSection: SectionDefinition<HubsConfig> = {
  type: 'hubs',
  name: 'Hubs',
  description: 'Trending hubs with join action (uses HubsSection)',
  icon: 'fa-users',
  category: 'data',
  status: 'stable',
  featureGate: 'hubs',
  configSchema: hubsConfigSchema,
  defaultConfig: { limit: 4 },
  schemaVersion: 1,
  component: HubsSection,
  propMap: ({ config }) => ({ config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
