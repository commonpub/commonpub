/**
 * Built-in section definition: editorial.
 *
 * Phase 1c addition (session 159) — Staff Picks grid. Server-fetches
 * `/api/content?editorial=true&sort=editorial&limit=N` and renders a
 * responsive `<ContentCard>` grid. Mirrors the legacy
 * `EditorialSection.vue` shape; built fresh in the registry pattern.
 *
 * Used by commonpub.io's homepage (currently the legacy renderer); this
 * section unblocks porting that homepage into a real layout row in the
 * Phase 1c canary.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionEditorial from '../../components/sections/SectionEditorial.vue';

const configSchema = z.object({
  heading: z.string().max(120).default('Staff Picks'),
  limit: z.number().int().min(1).max(12).default(3),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const editorialSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'editorial',
  name: 'Editorial',
  description: 'Staff-picked content grid (editorial flag in /api/content)',
  icon: 'fa-pen-fancy',
  category: 'data',
  status: 'stable',
  configSchema,
  defaultConfig: { heading: 'Staff Picks', limit: 3, columns: 3 },
  schemaVersion: 1,
  component: SectionEditorial,
  // 3+ column ContentCard grid loses readability below half-width
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
