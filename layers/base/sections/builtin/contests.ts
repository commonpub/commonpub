/**
 * Built-in section definition: contests.
 *
 * Stage E.4 — reuses the existing ContestsSection (`layers/base/
 * components/homepage/ContestsSection.vue`) which renders the Active
 * Contests sidebar card with `Nd left` countdowns.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import ContestsSection from '../../components/homepage/ContestsSection.vue';

const configSchema = z.object({
  limit: z.number().int().min(1).max(10).default(3),
});

export const contestsSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'contests',
  name: 'Contests',
  description: 'Active contests with deadlines (uses ContestsSection)',
  icon: 'fa-trophy',
  category: 'data',
  status: 'stable',
  featureGate: 'contests',
  configSchema,
  defaultConfig: { limit: 3 },
  schemaVersion: 1,
  component: ContestsSection,
  propMap: ({ config }) => ({ config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
