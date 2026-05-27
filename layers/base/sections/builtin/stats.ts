/**
 * Built-in section definition: stats.
 *
 * Phase 1c addition (session 159) — platform stats grid. Server-fetches
 * `/api/stats` (PlatformStats) and renders a small numeric grid:
 * Projects, Posts (blog + legacy article), Members, Hubs.
 *
 * Hubs metric is gated on `features.hubs` — when the flag is off, the
 * cell hides + the grid collapses to 1×3. Sidebar-friendly by default
 * (colSpan 4), but works as a narrow row at 12.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionStats from '../../components/sections/SectionStats.vue';

const configSchema = z.object({
  heading: z.string().max(120).default('Platform Stats'),
});

export const statsSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'stats',
  name: 'Platform stats',
  description: 'Numeric grid of platform totals (projects, posts, members, hubs)',
  icon: 'fa-chart-simple',
  category: 'data',
  status: 'stable',
  configSchema,
  defaultConfig: { heading: 'Platform Stats' },
  schemaVersion: 1,
  component: SectionStats,
  // Stat blocks tile down to 2×2 in a quarter-width column comfortably
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
