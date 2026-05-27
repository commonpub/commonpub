/**
 * Built-in section definition: editorial.
 *
 * Stage E.4 — reuses the existing EditorialSection (`layers/base/
 * components/homepage/EditorialSection.vue`) which fetches
 * `/api/content?editorial=true` and renders Staff Picks grid.
 *
 * Config matches HomepageSectionConfig (just `limit`). The component
 * hardcodes the "Staff Picks" heading + pen-fancy icon; future
 * extension could add an optional title prop.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import EditorialSection from '../../components/homepage/EditorialSection.vue';

const configSchema = z.object({
  limit: z.number().int().min(1).max(12).default(3),
});

export const editorialSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'editorial',
  name: 'Editorial',
  description: 'Staff-picked content grid (uses EditorialSection)',
  icon: 'fa-pen-fancy',
  category: 'data',
  status: 'stable',
  configSchema,
  defaultConfig: { limit: 3 },
  schemaVersion: 1,
  component: EditorialSection,
  propMap: ({ config }) => ({ config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
