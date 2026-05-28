/**
 * Built-in section definition: custom-html.
 *
 * Stage E.4 — reuses the existing CustomHtmlSection (renders
 * `config.html` via `v-html` with an optional title).
 *
 * **SECURITY POSTURE**: identical to legacy CustomHtmlSection — `v-html`
 * with no runtime sanitisation. Admin-only via the layout API gate +
 * the existing homepage editor's section schema. Phase 6b plans server-
 * side sanitisation at admin-write time (see prior SectionCustomHtml.vue
 * doc + `docs/plans/layout-and-pages.md §6.5`).
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { customHtmlConfigSchema, type CustomHtmlConfig } from '@commonpub/schema';
import CustomHtmlSection from '../../components/homepage/CustomHtmlSection.vue';

export const customHtmlSection: SectionDefinition<CustomHtmlConfig> = {
  type: 'custom-html',
  name: 'Custom HTML',
  description: 'Raw HTML escape hatch (uses CustomHtmlSection)',
  icon: 'fa-code',
  category: 'content',
  status: 'beta',
  configSchema: customHtmlConfigSchema,
  defaultConfig: { heading: '', html: '' },
  schemaVersion: 1,
  component: CustomHtmlSection,
  // CustomHtmlSection takes { config: HomepageSectionConfig; title?: string }
  propMap: ({ config }) => ({ config, title: (config.heading as string | undefined) ?? '' }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
