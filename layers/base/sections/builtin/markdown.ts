/**
 * Built-in section definition: markdown.
 *
 * Stage E.2 — reuses BlockMarkdownView (`layers/base/components/blocks/
 * BlockMarkdownView.vue`). Same markdown renderer used by block-system
 * content. Source markdown lives in `content.source`; BlockMarkdownView
 * pipes through markdownToBlockTuples + sanitizeBlockHtml.
 *
 * Config matches BlockMarkdownView's content contract: `{source}`.
 * Pre-Stage-E my SectionMarkdown had `{heading, body}` — dropped to
 * follow the Block contract (renderer doesn't have a heading).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockMarkdownView from '../../components/blocks/BlockMarkdownView.vue';

const configSchema = z.object({
  source: z.string().max(100_000).default(''),
});

export const markdownSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'markdown',
  name: 'Markdown',
  description: 'Markdown body — safer than custom-html (uses BlockMarkdownView)',
  icon: 'fa-markdown',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { source: '' },
  schemaVersion: 1,
  component: BlockMarkdownView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
