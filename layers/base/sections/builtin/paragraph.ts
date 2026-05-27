/**
 * Built-in section definition: paragraph.
 *
 * Phase 1c starter — plain prose, blank-line split into `<p>` tags.
 * Upgrade to TipTap-driven rich text in Phase 3e via `.describe('rich')`
 * + a v2 migration; this v1 keeps the storage simple so the editor work
 * doesn't block on TipTap integration.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionParagraph from '../../components/sections/SectionParagraph.vue';

const configSchema = z.object({
  text: z.string().max(8000).default(''),
  align: z.enum(['left', 'center']).default('left'),
});

export const paragraphSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'paragraph',
  name: 'Paragraph',
  description: 'Plain prose body with blank-line paragraph breaks',
  icon: 'fa-align-left',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { text: '', align: 'left' },
  schemaVersion: 1,
  component: SectionParagraph,
  // Prose reads best at ~6/12; allow narrower for sidebars + full-width on landing pages
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 6,
  resizable: true,
};
