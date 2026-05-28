/**
 * Built-in section definition: paragraph.
 *
 * Stage E.1 — reuses BlockTextView (sanitised HTML body via
 * `sanitizeBlockHtml`). Admin-set HTML works because BlockTextView pipes
 * through sanitizeBlockHtml — same XSS posture as the rest of the Block
 * system.
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { paragraphConfigSchema, type ParagraphConfig } from '@commonpub/schema';
import BlockTextView from '../../components/blocks/BlockTextView.vue';

export const paragraphSection: SectionDefinition<ParagraphConfig> = {
  type: 'paragraph',
  name: 'Paragraph',
  description: 'Sanitised HTML body (uses BlockTextView)',
  icon: 'fa-align-left',
  category: 'content',
  status: 'stable',
  configSchema: paragraphConfigSchema,
  defaultConfig: { html: '<p>Paragraph body.</p>' },
  schemaVersion: 1,
  component: BlockTextView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 6,
  resizable: true,
};
