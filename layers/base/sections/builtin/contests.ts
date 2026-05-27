/**
 * Built-in section definition: contests.
 *
 * Phase 1c addition (session 159) — active-contests list. Server-fetches
 * `/api/contests?limit=N` and renders a sidebar-style card with title,
 * entry count, "Nd left" deadline, and per-row Enter CTA.
 *
 * Feature-gated on `features.contests`. If the flag is off the API
 * returns 404; the section renders nothing (empty branch). Sidebar
 * defaults (colSpan 4) match the legacy `ContestsSection.vue` placement.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionContests from '../../components/sections/SectionContests.vue';

const configSchema = z.object({
  heading: z.string().max(120).default('Active Contests'),
  limit: z.number().int().min(1).max(10).default(3),
});

export const contestsSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'contests',
  name: 'Contests',
  description: 'Active contests with deadlines (feature-gated)',
  icon: 'fa-trophy',
  category: 'data',
  status: 'stable',
  // Palette gate — see hubs.ts for the rationale.
  featureGate: 'contests',
  configSchema,
  defaultConfig: { heading: 'Active Contests', limit: 3 },
  schemaVersion: 1,
  component: SectionContests,
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
