/**
 * Built-in section definition: paragraph.
 *
 * Stage E.1 — reuses BlockTextView (`layers/base/components/blocks/
 * BlockTextView.vue`) which renders sanitised HTML body via
 * `sanitizeBlockHtml`. The Block system's `text` block produces this
 * same HTML output from TipTap; the layout-engine paragraph section
 * follows the same convention.
 *
 * Config: `{ html }` — sanitised at render time by BlockTextView.
 * Pre-Stage-E my SectionParagraph had `{text, align}` (plain text);
 * dropped to align with the Block contract. Admin-set HTML works
 * because BlockTextView pipes through sanitizeBlockHtml — same XSS
 * posture as the rest of the Block system.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockTextView from '../../components/blocks/BlockTextView.vue';

const configSchema = z.object({
  html: z.string().max(8000).default('<p>Paragraph body.</p>'),
});

export const paragraphSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'paragraph',
  name: 'Paragraph',
  description: 'Sanitised HTML body (uses BlockTextView)',
  icon: 'fa-align-left',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { html: '<p>Paragraph body.</p>' },
  schemaVersion: 1,
  component: BlockTextView,
  propMap: ({ config }) => ({ content: config }),
  // Prose reads best at ~6/12; allow narrower for sidebars + full-width on landing pages
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 6,
  resizable: true,
};
