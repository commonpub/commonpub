/**
 * Built-in section definition: custom-html.
 *
 * Stage E.4 — reuses the existing CustomHtmlSection (`layers/base/
 * components/homepage/CustomHtmlSection.vue`) which renders `config.html`
 * via `v-html` with an optional title.
 *
 * **SECURITY POSTURE**: identical to legacy CustomHtmlSection — `v-html`
 * with no runtime sanitisation. Admin-only via the layout API gate +
 * the existing homepage editor's section schema. Phase 6b plans server-
 * side sanitisation at admin-write time (see prior SectionCustomHtml.vue
 * doc + `docs/plans/layout-and-pages.md §6.5`).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import CustomHtmlSection from '../../components/homepage/CustomHtmlSection.vue';

const configSchema = z.object({
  title: z.string().max(255).default(''),
  html: z.string().max(50_000).default(''),
});

export const customHtmlSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'custom-html',
  name: 'Custom HTML',
  description: 'Raw HTML escape hatch (uses CustomHtmlSection)',
  icon: 'fa-code',
  category: 'content',
  status: 'beta',
  configSchema,
  defaultConfig: { title: '', html: '' },
  schemaVersion: 1,
  component: CustomHtmlSection,
  // CustomHtmlSection takes { config: HomepageSectionConfig; title?: string }
  propMap: ({ config }) => ({ config, title: (config.title as string | undefined) ?? '' }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
