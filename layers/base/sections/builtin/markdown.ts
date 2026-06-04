/**
 * Built-in section definition: markdown.
 *
 * Stage E.2 — reuses BlockMarkdownView. Pipes source markdown through
 * markdownToBlockTuples + sanitizeBlockHtml — safer than custom-html.
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { markdownConfigSchema, type MarkdownConfig } from '@commonpub/schema';
import BlockMarkdownView from '../../components/blocks/BlockMarkdownView.vue';

export const markdownSection: SectionDefinition<MarkdownConfig> = {
  type: 'markdown',
  name: 'Markdown',
  description: 'Markdown body, safer than custom-html (uses BlockMarkdownView)',
  icon: 'fa-markdown',
  category: 'content',
  status: 'stable',
  configSchema: markdownConfigSchema,
  defaultConfig: { source: '' },
  schemaVersion: 1,
  component: BlockMarkdownView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
