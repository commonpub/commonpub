/**
 * Built-in section definition: editorial.
 *
 * Stage E.4 — reuses the existing EditorialSection which fetches
 * `/api/content?editorial=true` and renders Staff Picks grid.
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { editorialConfigSchema, type EditorialConfig } from '@commonpub/schema';
import EditorialSection from '../../components/homepage/EditorialSection.vue';

export const editorialSection: SectionDefinition<EditorialConfig> = {
  type: 'editorial',
  name: 'Editorial',
  description: 'Staff-picked content grid (uses EditorialSection)',
  icon: 'fa-pen-fancy',
  category: 'data',
  status: 'stable',
  configSchema: editorialConfigSchema,
  defaultConfig: { limit: 3 },
  schemaVersion: 1,
  component: EditorialSection,
  propMap: ({ config }) => ({ config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
