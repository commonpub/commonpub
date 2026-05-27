/**
 * Built-in section definition: hubs.
 *
 * Phase 1c addition (session 159) — trending hubs list. Server-fetches
 * `/api/hubs?limit=N` and renders a sidebar-style card with icon, name,
 * member count, and a Join CTA per hub.
 *
 * Renderer also dispatches join requests via `POST /api/hubs/:slug/join`
 * for authenticated visitors (mirrors legacy `HubsSection.vue`); guests
 * are redirected to `/auth/login?redirect=/`.
 *
 * Defaults to colSpan 4 (sidebar). Set colSpan 12 for a horizontal
 * sweep on a community-discovery page.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionHubs from '../../components/sections/SectionHubs.vue';

const configSchema = z.object({
  heading: z.string().max(120).default('Trending Hubs'),
  limit: z.number().int().min(1).max(20).default(4),
});

export const hubsSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'hubs',
  name: 'Hubs',
  description: 'Trending hubs list with join action (feature-gated)',
  icon: 'fa-users',
  category: 'data',
  status: 'stable',
  // Palette gate — admins on a hubs-disabled instance shouldn't see this
  // type in the section-picker. Runtime gating is separate: each placed
  // instance's `visibility.features` array controls render visibility
  // (LayoutSlot honors it). Setting both here AND in the migration script
  // is the belt-and-braces.
  featureGate: 'hubs',
  configSchema,
  defaultConfig: { heading: 'Trending Hubs', limit: 4 },
  schemaVersion: 1,
  component: SectionHubs,
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 4,
  resizable: true,
};
