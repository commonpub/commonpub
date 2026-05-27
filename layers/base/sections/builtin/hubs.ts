/**
 * Built-in section definition: hubs.
 *
 * Stage E.4 — reuses the existing HubsSection (`layers/base/components/
 * homepage/HubsSection.vue`) which renders the Trending Hubs sidebar
 * card with join CTAs.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import HubsSection from '../../components/homepage/HubsSection.vue';

const configSchema = z.object({
  limit: z.number().int().min(1).max(20).default(4),
});

export const hubsSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'hubs',
  name: 'Hubs',
  description: 'Trending hubs with join action (uses HubsSection)',
  icon: 'fa-users',
  category: 'data',
  status: 'stable',
  featureGate: 'hubs',
  configSchema,
  defaultConfig: { limit: 4 },
  schemaVersion: 1,
  component: HubsSection,
  propMap: ({ config }) => ({ config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
