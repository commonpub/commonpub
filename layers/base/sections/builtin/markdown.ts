/**
 * Built-in section definition: markdown.
 *
 * Phase 6b addition (session 159). Sanitised markdown body. Pipes the
 * source through `@commonpub/docs`'s `renderMarkdown` (remark + rehype
 * + rehype-sanitize with the docs default schema) so the rendered HTML
 * has the same XSS posture as docs pages.
 *
 * Unlike custom-html (which renders raw HTML at the admin's risk), this
 * section provides a SAFE authoring path: markdown source is sanitised
 * at render time, every visit, with no admin-input HTML reaching the
 * DOM unscrubbed.
 *
 * Config: heading (optional) + body (markdown source, max 100KB).
 * Sanitisation happens server-side via useAsyncData in the renderer.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionMarkdown from '../../components/sections/SectionMarkdown.vue';

const configSchema = z.object({
  heading: z.string().max(120).default(''),
  body: z.string().max(100_000).default(''),
});

export const markdownSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'markdown',
  name: 'Markdown',
  description: 'Markdown body — safer than custom-html for admin authoring',
  icon: 'fa-markdown',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { heading: '', body: '' },
  schemaVersion: 1,
  component: SectionMarkdown,
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
